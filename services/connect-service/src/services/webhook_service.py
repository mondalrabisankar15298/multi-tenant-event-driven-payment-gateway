import hmac
import hashlib
import json
import logging
import httpx
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def dispatch_webhook(pool, event: dict):
    """Find matching subscriptions and deliver webhooks."""
    merchant_id = event["merchant_id"]
    event_type = event["event_type"]

    async with pool.acquire() as conn:
        # Find matching active subscriptions
        subscriptions = await conn.fetch(
            """
            SELECT * FROM public.webhook_subscriptions
            WHERE merchant_id = $1 AND active = true AND $2 = ANY(event_types)
            """,
            merchant_id, event_type,
        )

    for sub in subscriptions:
        await _deliver_webhook(pool, sub, event)


async def _deliver_webhook(pool, subscription, event: dict):
    """Deliver a single webhook with HMAC signature."""
    payload = {
        "event_id": event["event_id"],
        "event_type": event["event_type"],
        "merchant_id": event["merchant_id"],
        "payload": event["payload"],
        "created_at": event["created_at"],
    }

    # Sign payload
    payload_bytes = json.dumps(payload, sort_keys=True, default=str).encode()
    signature = hmac.new(
        subscription["secret"].encode(), payload_bytes, hashlib.sha256
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Id": str(event["event_id"]),
        "X-Webhook-Event": event["event_type"],
        "X-Webhook-Signature": f"sha256={signature}",
        "X-Webhook-Timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                subscription["url"],
                json=payload,
                headers=headers,
            )

        status_code = response.status_code
        success = 200 <= status_code < 300

        # Log delivery
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO public.delivery_logs
                    (subscription_id, event_id, attempt, status_code, response_body, success)
                VALUES ($1, $2, 1, $3, $4, $5)
                """,
                subscription["subscription_id"],
                event["event_id"],
                status_code,
                response.text[:500],
                success,
            )

        if not success:
            if 400 <= status_code < 500:
                # Client error → disable webhook
                async with pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE public.webhook_subscriptions SET active = false WHERE subscription_id = $1",
                        subscription["subscription_id"],
                    )
                logger.warning(f"Webhook disabled due to {status_code}: {subscription['url']}")
            else:
                # Server error → schedule retry via Celery
                from ..tasks.webhook_retry_task import retry_webhook
                retry_webhook.apply_async(
                    args=[subscription["subscription_id"], str(event["event_id"]), payload, 2],
                    countdown=30,  # 30 seconds for attempt 2
                )
                logger.info(f"Scheduled retry for webhook: {subscription['url']}")

    except Exception as e:
        logger.error(f"Webhook delivery failed: {e}")
        # Log failure
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO public.delivery_logs
                    (subscription_id, event_id, attempt, status_code, response_body, success)
                VALUES ($1, $2, 1, 0, $3, false)
                """,
                subscription["subscription_id"],
                event["event_id"],
                str(e)[:500],
            )
        # Schedule retry
        from ..tasks.webhook_retry_task import retry_webhook
        retry_webhook.apply_async(
            args=[subscription["subscription_id"], str(event["event_id"]), payload, 2],
            countdown=30,
        )
