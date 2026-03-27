
from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException
from ..database import get_pool, get_merchant_schema

router = APIRouter(prefix="/api/{merchant_id}/customers", tags=["customers"])


@router.get("")
async def list_customers(merchant_id: int, limit: int = 100):
    schema = await get_merchant_schema(merchant_id)
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
async def get_customer(merchant_id: int, customer_id: uuid.UUID):
    schema = await get_merchant_schema(merchant_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"SELECT * FROM {schema}.customers WHERE customer_id = $1",
            customer_id,
        )
        return dict(row) if row else {"error": "Not found"}
