import json
from ..database import get_pool
from ..utils.event_emitter import emit_event


VALID_TRANSITIONS = {
    "created": ["authorized", "failed"],
    "authorized": ["captured"],
    "captured": ["settled"],
}


async def create_payment(merchant_id: int, customer_id: int, amount: float,
                         currency: str, method: str, description: str = None,
                         metadata: dict = None) -> dict:
    schema = f"merchant_{merchant_id}"
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # 1. Insert payment
            payment = await conn.fetchrow(
                f"""
                INSERT INTO {schema}.payments
                    (customer_id, amount, currency, method, description, metadata)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                RETURNING *
                """,
                customer_id, amount, currency, method, description,
                json.dumps(metadata or {}),
            )

            # 2. Insert ledger entry
            await conn.execute(
                f"""
                INSERT INTO {schema}.ledger_entries
                    (payment_id, entry_type, amount, balance_after)
                VALUES ($1, 'payment_created', $2,
                    (SELECT COALESCE(SUM(CASE WHEN entry_type LIKE 'payment%%' THEN amount ELSE -amount END), 0)
                     FROM {schema}.ledger_entries) + $2)
                """,
                payment["payment_id"], amount,
            )

            # 3. Emit event
            await emit_event(
                conn,
                merchant_id=merchant_id,
                schema_name=schema,
                event_type="payment.created.v1",
                entity_type="payment",
                entity_id=str(payment["payment_id"]),
                payload=dict(payment),
            )
            return dict(payment)


async def transition_payment(merchant_id: int, payment_id: str, target_status: str,
                             failure_reason: str = None) -> dict | None:
    schema = f"merchant_{merchant_id}"
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            payment = await conn.fetchrow(
                f"SELECT * FROM {schema}.payments WHERE payment_id = $1 FOR UPDATE",
                payment_id,
            )
            if not payment:
                return None

            current_status = payment["status"]
            allowed = VALID_TRANSITIONS.get(current_status, [])
            if target_status not in allowed:
                raise ValueError(
                    f"Invalid transition: {current_status} → {target_status}. "
                    f"Allowed: {allowed}"
                )

            update_fields = "status = $1, updated_at = NOW()"
            params = [target_status, payment_id]
            if failure_reason and target_status == "failed":
                update_fields += ", failure_reason = $3"
                params.append(failure_reason)

            updated = await conn.fetchrow(
                f"UPDATE {schema}.payments SET {update_fields} WHERE payment_id = $2 RETURNING *",
                *params,
            )

            # Ledger entry for captured payments
            if target_status == "captured":
                await conn.execute(
                    f"""
                    INSERT INTO {schema}.ledger_entries
                        (payment_id, entry_type, amount, balance_after)
                    VALUES ($1, 'payment_captured', $2,
                        (SELECT COALESCE(SUM(CASE WHEN entry_type LIKE 'payment%%' THEN amount ELSE -amount END), 0)
                         FROM {schema}.ledger_entries))
                    """,
                    payment_id, float(payment["amount"]),
                )

            # Map target_status to event type
            event_type_map = {
                "authorized": "payment.authorized.v1",
                "captured": "payment.captured.v1",
                "failed": "payment.failed.v1",
                "settled": "payment.settled.v1",
            }
            await emit_event(
                conn,
                merchant_id=merchant_id,
                schema_name=schema,
                event_type=event_type_map[target_status],
                entity_type="payment",
                entity_id=str(payment_id),
                payload=dict(updated),
            )
            return dict(updated)


async def list_payments(merchant_id: int) -> list[dict]:
    schema = f"merchant_{merchant_id}"
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(f"SELECT * FROM {schema}.payments ORDER BY created_at DESC")
        return [dict(r) for r in rows]


async def get_payment(merchant_id: int, payment_id: str) -> dict | None:
    schema = f"merchant_{merchant_id}"
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"SELECT * FROM {schema}.payments WHERE payment_id = $1", payment_id
        )
        return dict(row) if row else None
