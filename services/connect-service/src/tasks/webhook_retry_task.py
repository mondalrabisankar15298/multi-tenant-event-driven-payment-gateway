import hmac
import hashlib
import json
import logging
import psycopg2
import psycopg2.extras
from ..celery_app import celery
from ..config import settings

logger = logging.getLogger(__name__)

# Retry schedule: attempt → delay in seconds
RETRY_DELAYS = {
    2: 30,        # 30 seconds
    3: 300,       # 5 minutes
    4: 1800,      # 30 minutes
    5: 7200,      # 2 hours
    6: 86400,     # 24 hours
}


@celery.task(name="src.tasks.webhook_retry_task.retry_webhook", bind=True)
def retry_webhook(self, subscription_id: int, event_id: str, payload: dict, attempt: int):
    """Celery task: retry failed webhook delivery with exponential backoff."""
    conn = None
    try:
        conn = psycopg2.connect(settings.read_db_dsn, cursor_factory=psycopg2.extras.RealDictCursor)
        cur = conn.cursor()

        # Get subscription
        cur.execute(
            "SELECT * FROM public.webhook_subscriptions WHERE subscription_id = %s AND active = true",
            (subscription_id,)
        )
        subscription = cur.fetchone()
        if not subscription:
            logger.info(f"Subscription {subscription_id} not found or inactive, skipping retry")
            return

        # Sign and deliver
        payload_bytes = json.dumps(payload, sort_keys=True, default=str).encode()
        signature = hmac.new(
            subscription["secret"].encode(), payload_bytes, hashlib.sha256
        ).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Id": event_id,
            "X-Webhook-Event": payload.get("event_type", "unknown"),
            "X-Webhook-Signature": f"sha256={signature}",
        }

        import httpx as httpx_sync
        with httpx_sync.Client(timeout=10.0) as client:
            response = client.post(subscription["url"], json=payload, headers=headers)

        status_code = response.status_code
        success = 200 <= status_code < 300

        # Log
        cur.execute(
            """
            INSERT INTO public.delivery_logs
                (subscription_id, event_id, attempt, status_code, response_body, success)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (subscription_id, event_id, attempt, status_code, response.text[:500], success)
        )
        conn.commit()

        if success:
            logger.info(f"Webhook retry attempt {attempt} succeeded: {subscription['url']}")
            return

        if 400 <= status_code < 500:
            cur.execute(
                "UPDATE public.webhook_subscriptions SET active = false WHERE subscription_id = %s",
                (subscription_id,)
            )
            conn.commit()
            return

        # Schedule next retry or move to DLQ
        next_attempt = attempt + 1
        if next_attempt > 6:
            # Move to Dead Letter Queue
            cur.execute(
                """
                INSERT INTO public.dead_letter_queue
                    (subscription_id, event_id, payload, failure_reason)
                VALUES (%s, %s, %s::jsonb, %s)
                """,
                (subscription_id, event_id, json.dumps(payload, default=str),
                 f"Max retries ({attempt}) exceeded. Last status: {status_code}")
            )
            conn.commit()
            logger.warning(f"Moved webhook to DLQ after {attempt} attempts: {subscription['url']}")
        else:
            delay = RETRY_DELAYS.get(next_attempt, 86400)
            retry_webhook.apply_async(
                args=[subscription_id, event_id, payload, next_attempt],
                countdown=delay,
            )
            logger.info(f"Scheduled retry attempt {next_attempt} in {delay}s: {subscription['url']}")

    except Exception as e:
        logger.error(f"Webhook retry failed: {e}")
        if conn:
            conn.rollback()
        raise self.retry(exc=e, countdown=60, max_retries=2)

    finally:
        if conn:
            conn.close()
