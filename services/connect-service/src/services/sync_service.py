import json
import logging
from datetime import datetime, timezone
from decimal import Decimal

logger = logging.getLogger(__name__)


async def sync_event(pool, event: dict):
    """Transform and sync an event to the read DB."""
    event_type = event["event_type"]
    from ..utils.validators import validate_schema_name
    schema = validate_schema_name(event["schema_name"])
    payload = event["payload"] if isinstance(event["payload"], dict) else json.loads(event["payload"])

    handler = SYNC_HANDLERS.get(event_type)
    if handler:
        await handler(pool, schema, payload)
    else:
        logger.warning(f"No sync handler for event type: {event_type}")


# ─── Handler Functions ────────────────────────────────────

async def _sync_merchant_created(pool, schema, payload):
    """Sync merchant to the read DB merchants mirror."""
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO public.merchants (merchant_id, merchant_uuid, name, email, schema_name, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (merchant_id) DO UPDATE SET
                merchant_uuid = EXCLUDED.merchant_uuid,
                name = $3, email = $4, status = $6, updated_at = $8
            """,
            payload.get("merchant_id"), payload.get("merchant_uuid"), payload.get("name"), payload.get("email"),
            payload.get("schema_name"), payload.get("status", "active"),
            datetime.fromisoformat(str(payload.get("created_at"))) if payload.get("created_at") else datetime.now(timezone.utc),
            datetime.fromisoformat(str(payload.get("updated_at"))) if payload.get("updated_at") else datetime.now(timezone.utc),
        )


async def _sync_merchant_updated(pool, schema, payload):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE public.merchants
            SET name = $1, email = $2, status = $3, updated_at = $4,
                merchant_uuid = COALESCE($5, merchant_uuid)
            WHERE merchant_id = $6
            """,
            payload.get("name"), payload.get("email"), payload.get("status"),
            datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc),
            payload.get("merchant_uuid"),
            payload["merchant_id"]
        )


async def _sync_customer_created(pool, schema, payload):
    async with pool.acquire() as conn:
        await conn.execute(
            f"""
            INSERT INTO {schema}.customers
                (customer_id, name, email, phone, total_payments, total_spent, created_at, updated_at)
            VALUES ($1::uuid, $2, $3, $4, 0, 0, $5, $6)
            ON CONFLICT (customer_id) DO UPDATE
                SET name = $2, email = $3, phone = $4, updated_at = $6
            """,
            payload["customer_id"], payload["name"], payload.get("email"), payload.get("phone"),
            datetime.fromisoformat(str(payload["created_at"])) if payload.get("created_at") else datetime.now(timezone.utc),
            datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc),
        )


async def _sync_customer_updated(pool, schema, payload):
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Update customer
            await conn.execute(
                f"""
                UPDATE {schema}.customers
                SET name = $1, email = $2, phone = $3, updated_at = $4
                WHERE customer_id = $5::uuid
                """,
                payload["name"], payload.get("email"), payload.get("phone"),
                datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc),
                payload["customer_id"],
            )
            # Cascade: update denormalized customer_name in payments
            await conn.execute(
                f"UPDATE {schema}.payments SET customer_name = $1, customer_email = $2 WHERE customer_id = $3::uuid",
                payload["name"], payload.get("email"), payload["customer_id"],
            )
            # Cascade: update denormalized customer_name in refunds
            await conn.execute(
                f"""
                UPDATE {schema}.refunds SET customer_name = $1
                WHERE payment_id IN (SELECT payment_id FROM {schema}.payments WHERE customer_id = $2::uuid)
                """,
                payload["name"], payload["customer_id"],
            )


async def _sync_customer_deleted(pool, schema, payload):
    async with pool.acquire() as conn:
        await conn.execute(
            f"DELETE FROM {schema}.customers WHERE customer_id = $1::uuid",
            payload["customer_id"],
        )


async def _sync_payment_created(pool, schema, payload):
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Look up customer info for denormalization
            customer = await conn.fetchrow(
                f"SELECT name, email FROM {schema}.customers WHERE customer_id = $1",
                payload["customer_id"],
            )
            customer_name = customer["name"] if customer else None
            customer_email = customer["email"] if customer else None

            # Upsert payment with denormalized customer info
            await conn.execute(
                f"""
                INSERT INTO {schema}.payments
                    (payment_id, customer_id, customer_name, customer_email, amount, currency,
                     status, method, description, failure_reason, metadata, created_at, updated_at)
                VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
                ON CONFLICT (payment_id) DO UPDATE
                    SET status = $7, failure_reason = $10, updated_at = $13
                """,
                payload["payment_id"], payload["customer_id"], customer_name, customer_email,
                Decimal(str(payload["amount"])), payload.get("currency", "INR"),
                payload["status"], payload["method"], payload.get("description"),
                payload.get("failure_reason"), json.dumps(payload.get("metadata", {})),
                datetime.fromisoformat(str(payload["created_at"])) if payload.get("created_at") else datetime.now(timezone.utc),
                datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc),
            )

            # Update daily_revenue
            payment_time = datetime.fromisoformat(str(payload["created_at"])) if payload.get("created_at") else datetime.now(timezone.utc)
            payment_date = payment_time.date()
            update_time = datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc)
            
            await conn.execute(
                f"""
                INSERT INTO {schema}.daily_revenue (date, total_amount, payment_count, net_revenue, created_at, updated_at)
                VALUES ($1, $2, 1, $2, $3, $4)
                ON CONFLICT (date) DO UPDATE
                    SET total_amount = {schema}.daily_revenue.total_amount + $2,
                        payment_count = {schema}.daily_revenue.payment_count + 1,
                        net_revenue = {schema}.daily_revenue.net_revenue + $2,
                        updated_at = $4
                """,
                payment_date, Decimal(str(payload["amount"])), payment_time, update_time,
            )

            # Update payment_method_stats
            await conn.execute(
                f"""
                INSERT INTO {schema}.payment_method_stats (method, total_amount, count, created_at, updated_at)
                VALUES ($1, $2, 1, $3, $4)
                ON CONFLICT (method) DO UPDATE
                    SET total_amount = {schema}.payment_method_stats.total_amount + $2,
                        count = {schema}.payment_method_stats.count + 1,
                        updated_at = $4
                """,
                payload["method"], Decimal(str(payload["amount"])), payment_time, update_time,
            )

            # Update customer total_payments
            await conn.execute(
                f"UPDATE {schema}.customers SET total_payments = total_payments + 1 WHERE customer_id = $1::uuid",
                payload["customer_id"],
            )


async def _sync_payment_updated(pool, schema, payload):
    async with pool.acquire() as conn:
        await conn.execute(
            f"""
            UPDATE {schema}.payments 
            SET description = $1, metadata = $2::jsonb, updated_at = $3
            WHERE payment_id = $4::uuid
            """,
            payload.get("description"), json.dumps(payload.get("metadata", {})),
            datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc),
            payload["payment_id"]
        )


async def _sync_payment_captured(pool, schema, payload):
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                f"UPDATE {schema}.payments SET status = $1, updated_at = $2 WHERE payment_id = $3::uuid",
                "captured",
                datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc),
                payload["payment_id"],
            )
            # Update daily_revenue success_count
            payment_date = datetime.fromisoformat(str(payload["created_at"])).date() if payload.get("created_at") else datetime.now(timezone.utc).date()
            update_time = datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc)
            await conn.execute(
                f"""
                UPDATE {schema}.daily_revenue
                SET success_count = success_count + 1,
                    updated_at = $2
                WHERE date = $1
                """,
                payment_date, update_time,
            )
            # Update method stats success
            await conn.execute(
                f"""
                UPDATE {schema}.payment_method_stats
                SET success_count = success_count + 1,
                    success_rate = ROUND((success_count + 1)::DECIMAL / NULLIF(count, 0) * 100, 2),
                    updated_at = $2
                WHERE method = $1
                """,
                payload["method"], update_time,
            )
            # Update customer total_spent
            await conn.execute(
                f"""
                UPDATE {schema}.customers
                SET total_spent = total_spent + $1, last_payment_at = $3
                WHERE customer_id = $2::uuid
                """,
                Decimal(str(payload["amount"])), payload["customer_id"], update_time,
            )


async def _sync_payment_failed(pool, schema, payload):
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                f"UPDATE {schema}.payments SET status = 'failed', failure_reason = $1, updated_at = $2 WHERE payment_id = $3::uuid",
                payload.get("failure_reason"),
                datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc),
                payload["payment_id"],
            )
            update_time = datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc)
            payment_date = datetime.fromisoformat(str(payload["created_at"])).date() if payload.get("created_at") else datetime.now(timezone.utc).date()
            await conn.execute(
                f"UPDATE {schema}.daily_revenue SET failed_count = failed_count + 1, updated_at = $2 WHERE date = $1",
                payment_date, update_time,
            )
            await conn.execute(
                f"""
                UPDATE {schema}.payment_method_stats
                SET success_rate = ROUND(success_count::DECIMAL / NULLIF(count, 0) * 100, 2),
                    updated_at = $2
                WHERE method = $1
                """,
                payload["method"], update_time,
            )


async def _sync_payment_authorized(pool, schema, payload):
    async with pool.acquire() as conn:
        await conn.execute(
            f"UPDATE {schema}.payments SET status = 'authorized', updated_at = $1 WHERE payment_id = $2::uuid",
            datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc),
            payload["payment_id"],
        )


async def _sync_refund_initiated(pool, schema, payload):
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Look up payment for denormalized context
            payment = await conn.fetchrow(
                f"SELECT amount, customer_name FROM {schema}.payments WHERE payment_id = $1::uuid",
                payload["payment_id"],
            )
            payment_amount = float(payment["amount"]) if payment else None
            customer_name = payment["customer_name"] if payment else None

            await conn.execute(
                f"""
                INSERT INTO {schema}.refunds
                    (refund_id, payment_id, payment_amount, customer_name, amount, reason, status, created_at, updated_at)
                VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (refund_id) DO UPDATE SET status = $7, updated_at = $9
                """,
                payload["refund_id"], payload["payment_id"], payment_amount, customer_name,
                Decimal(str(payload["amount"])), payload.get("reason"), payload["status"],
                datetime.fromisoformat(str(payload["created_at"])) if payload.get("created_at") else datetime.now(timezone.utc),
                datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc),
            )

            # Update daily_revenue refund_amount
            update_time = datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc)
            payment_date = datetime.fromisoformat(str(payload["created_at"])).date() if payload.get("created_at") else datetime.now(timezone.utc).date()
            await conn.execute(
                f"""
                UPDATE {schema}.daily_revenue
                SET refund_amount = refund_amount + $1,
                    net_revenue = net_revenue - $1,
                    updated_at = $3
                WHERE date = $2
                """,
                Decimal(str(payload["amount"])), payment_date, update_time,
            )

            # Update customer total_spent
            if payload.get("customer_id"):
                await conn.execute(
                    f"UPDATE {schema}.customers SET total_spent = total_spent - $1 WHERE customer_id = $2::uuid",
                    Decimal(str(payload["amount"])), payload["customer_id"],
                )


async def _sync_refund_processed(pool, schema, payload):
    async with pool.acquire() as conn:
        await conn.execute(
            f"UPDATE {schema}.refunds SET status = 'processed', updated_at = $1 WHERE refund_id = $2::uuid",
            datetime.fromisoformat(str(payload["updated_at"])) if payload.get("updated_at") else datetime.now(timezone.utc),
            payload["refund_id"],
        )


# ─── Handler Registry ────────────────────────────────────

SYNC_HANDLERS = {
    "merchant.created.v1": _sync_merchant_created,
    "merchant.updated.v1": _sync_merchant_updated,
    "customer.created.v1": _sync_customer_created,
    "customer.updated.v1": _sync_customer_updated,
    "customer.deleted.v1": _sync_customer_deleted,
    "payment.created.v1": _sync_payment_created,
    "payment.updated.v1": _sync_payment_updated,
    "payment.authorized.v1": _sync_payment_authorized,
    "payment.captured.v1": _sync_payment_captured,
    "payment.failed.v1": _sync_payment_failed,
    "refund.initiated.v1": _sync_refund_initiated,
    "refund.processed.v1": _sync_refund_processed,
}
