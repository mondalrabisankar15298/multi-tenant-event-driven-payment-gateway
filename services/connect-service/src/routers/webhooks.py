from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..database import get_pool

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


class WebhookCreate(BaseModel):
    merchant_id: int
    url: str
    event_types: list[str]
    secret: str


class WebhookUpdate(BaseModel):
    url: Optional[str] = None
    event_types: Optional[list[str]] = None
    active: Optional[bool] = None


@router.post("", status_code=201)
async def create_webhook(data: WebhookCreate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO public.webhook_subscriptions (merchant_id, url, event_types, secret)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            data.merchant_id, data.url, data.event_types, data.secret,
        )
        return dict(row)


@router.get("")
async def list_webhooks(merchant_id: int = None):
    pool = await get_pool()
    async with pool.acquire() as conn:
        if merchant_id:
            rows = await conn.fetch(
                "SELECT * FROM public.webhook_subscriptions WHERE merchant_id = $1 ORDER BY created_at DESC",
                merchant_id,
            )
        else:
            rows = await conn.fetch("SELECT * FROM public.webhook_subscriptions ORDER BY created_at DESC")
        return [dict(r) for r in rows]


@router.get("/{subscription_id}")
async def get_webhook(subscription_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM public.webhook_subscriptions WHERE subscription_id = $1",
            subscription_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Subscription not found")
        return dict(row)


@router.put("/{subscription_id}")
async def update_webhook(subscription_id: int, data: WebhookUpdate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT * FROM public.webhook_subscriptions WHERE subscription_id = $1",
            subscription_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Subscription not found")

        row = await conn.fetchrow(
            """
            UPDATE public.webhook_subscriptions
            SET url = COALESCE($1, url),
                event_types = COALESCE($2, event_types),
                active = COALESCE($3, active)
            WHERE subscription_id = $4
            RETURNING *
            """,
            data.url, data.event_types, data.active, subscription_id,
        )
        return dict(row)


@router.delete("/{subscription_id}", status_code=204)
async def delete_webhook(subscription_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM public.webhook_subscriptions WHERE subscription_id = $1",
            subscription_id,
        )
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Subscription not found")


@router.get("/{subscription_id}/logs")
async def get_webhook_logs(subscription_id: int, limit: int = 50):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM public.delivery_logs WHERE subscription_id = $1 ORDER BY created_at DESC LIMIT $2",
            subscription_id, limit,
        )
        return [dict(r) for r in rows]


@router.get("/dlq/entries")
async def get_dlq(merchant_id: int = None, limit: int = 50):
    pool = await get_pool()
    async with pool.acquire() as conn:
        if merchant_id:
            rows = await conn.fetch(
                """
                SELECT d.* FROM public.dead_letter_queue d
                JOIN public.webhook_subscriptions s ON d.subscription_id = s.subscription_id
                WHERE s.merchant_id = $1
                ORDER BY d.created_at DESC LIMIT $2
                """,
                merchant_id, limit,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM public.dead_letter_queue ORDER BY created_at DESC LIMIT $1",
                limit,
            )
        return [dict(r) for r in rows]


@router.post("/dlq/{dlq_id}/retry")
async def retry_dlq(dlq_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        entry = await conn.fetchrow(
            "SELECT * FROM public.dead_letter_queue WHERE dlq_id = $1", dlq_id
        )
        if not entry:
            raise HTTPException(status_code=404, detail="DLQ entry not found")

        # Re-dispatch via Celery
        from ..tasks.webhook_retry_task import retry_webhook
        retry_webhook.apply_async(
            args=[entry["subscription_id"], str(entry["event_id"]), entry["payload"], 1],
            countdown=0,
        )

        # Remove from DLQ
        await conn.execute("DELETE FROM public.dead_letter_queue WHERE dlq_id = $1", dlq_id)
        return {"status": "retrying", "dlq_id": dlq_id}
