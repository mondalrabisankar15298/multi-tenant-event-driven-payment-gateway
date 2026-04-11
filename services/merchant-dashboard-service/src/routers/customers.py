
import uuid

from fastapi import APIRouter, Query
from ..database import get_pool, get_merchant_schema

router = APIRouter(prefix="/api/{merchant_uuid}/customers", tags=["customers"])


@router.get("")
async def list_customers(
    merchant_uuid: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=200),
):
    schema = await get_merchant_schema(merchant_uuid)
    pool = await get_pool()
    offset = (page - 1) * limit
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT customer_id, name, email, phone,
                   total_payments, total_spent, last_payment_at,
                   created_at, updated_at
            FROM {schema}.customers
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset,
        )
        total = await conn.fetchval(f"SELECT COUNT(*) FROM {schema}.customers")
    return {
        "data": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "limit": limit,
    }


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
