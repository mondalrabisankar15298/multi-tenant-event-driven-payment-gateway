from ..database import get_pool
from ..utils.event_emitter import emit_event


async def create_refund(merchant_id: int, payment_id: str, amount: float,
                        reason: str = None) -> dict:
    schema = f"merchant_{merchant_id}"
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Verify payment exists and is captured
            payment = await conn.fetchrow(
                f"SELECT * FROM {schema}.payments WHERE payment_id = $1", payment_id
            )
            if not payment:
                raise ValueError("Payment not found")
            if payment["status"] not in ("captured", "settled"):
                raise ValueError(f"Cannot refund payment with status: {payment['status']}")
            if amount > float(payment["amount"]):
                raise ValueError("Refund amount exceeds payment amount")

            # Insert refund
            refund = await conn.fetchrow(
                f"""
                INSERT INTO {schema}.refunds (payment_id, amount, reason)
                VALUES ($1, $2, $3)
                RETURNING *
                """,
                payment_id, amount, reason,
            )

            # Ledger entry
            await conn.execute(
                f"""
                INSERT INTO {schema}.ledger_entries
                    (payment_id, refund_id, entry_type, amount, balance_after)
                VALUES ($1, $2, 'refund_issued', $3,
                    (SELECT COALESCE(SUM(CASE WHEN entry_type LIKE 'payment%%' THEN amount ELSE -amount END), 0)
                     FROM {schema}.ledger_entries) - $3)
                """,
                payment_id, refund["refund_id"], amount,
            )

            await emit_event(
                conn,
                merchant_id=merchant_id,
                schema_name=schema,
                event_type="refund.initiated.v1",
                entity_type="refund",
                entity_id=str(refund["refund_id"]),
                payload={**dict(refund), "payment_amount": float(payment["amount"])},
            )
            return dict(refund)


async def process_refund(merchant_id: int, refund_id: str) -> dict | None:
    schema = f"merchant_{merchant_id}"
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            refund = await conn.fetchrow(
                f"SELECT * FROM {schema}.refunds WHERE refund_id = $1 FOR UPDATE",
                refund_id,
            )
            if not refund:
                return None
            if refund["status"] != "initiated":
                raise ValueError(f"Cannot process refund with status: {refund['status']}")

            updated = await conn.fetchrow(
                f"""
                UPDATE {schema}.refunds
                SET status = 'processed', updated_at = NOW()
                WHERE refund_id = $1
                RETURNING *
                """,
                refund_id,
            )

            await emit_event(
                conn,
                merchant_id=merchant_id,
                schema_name=schema,
                event_type="refund.processed.v1",
                entity_type="refund",
                entity_id=str(refund_id),
                payload=dict(updated),
            )
            return dict(updated)


async def list_refunds(merchant_id: int) -> list[dict]:
    schema = f"merchant_{merchant_id}"
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(f"SELECT * FROM {schema}.refunds ORDER BY created_at DESC")
        return [dict(r) for r in rows]
