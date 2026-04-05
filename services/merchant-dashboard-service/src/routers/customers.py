
import uuid

from fastapi import APIRouter
from ..database import get_pool, get_merchant_schema

router = APIRouter(prefix="/api/{merchant_uuid}/customers", tags=["customers"])


@router.get("")
async def list_customers(merchant_uuid: str, limit: int = 100):
    schema = await get_merchant_schema(merchant_uuid)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT customer_id, name, email, phone,
                   total_payments, total_spent, last_payment_at,
                   created_at, updated_at
            FROM {schema}.customers
            ORDER BY created_at DESC
            LIMIT $1
            """,
            limit,
        )
        return [dict(r) for r in rows]


@router.get("/{customer_id}")
async def get_customer(merchant_uuid: str, customer_id: uuid.UUID):
    schema = await get_merchant_schema(merchant_uuid)
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"SELECT * FROM {schema}.customers WHERE customer_id = $1",
            customer_id,
        )
        return dict(row) if row else {"error": "Not found"}
