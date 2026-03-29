import uuid
from typing import Optional

from fastapi import APIRouter, Query
from ..database import get_pool, get_merchant_schema

router = APIRouter(prefix="/api/{merchant_id}/payments", tags=["payments"])


@router.get("")
async def list_payments(
    merchant_id: int,
    status: Optional[str] = None,
    method: Optional[str] = None,
    customer_id: Optional[uuid.UUID] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    page: int = 1,
    limit: int = 25,
):
    schema = await get_merchant_schema(merchant_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Build dynamic WHERE clause
        conditions = []
        params = []
        idx = 1

        if status:
            conditions.append(f"status = ${idx}")
            params.append(status)
            idx += 1
        if method:
            conditions.append(f"method = ${idx}")
            params.append(method)
            idx += 1
        if customer_id:
            conditions.append(f"customer_id = ${idx}")
            params.append(customer_id)
            idx += 1
        if min_amount:
            conditions.append(f"amount >= ${idx}")
            params.append(min_amount)
            idx += 1
        if max_amount:
            conditions.append(f"amount <= ${idx}")
            params.append(max_amount)
            idx += 1
        if from_date:
            conditions.append(f"created_at >= ${idx}::date")
            params.append(from_date)
            idx += 1
        if to_date:
            conditions.append(f"created_at <= ${idx}::date + interval '1 day'")
            params.append(to_date)
            idx += 1

        where = " AND ".join(conditions) if conditions else "TRUE"
        offset = (page - 1) * limit

        # Get count
        count = await conn.fetchval(
            f"SELECT COUNT(*) FROM {schema}.payments WHERE {where}", *params
        )

        # Get data
        params.extend([limit, offset])
        rows = await conn.fetch(
            f"""
            SELECT * FROM {schema}.payments
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *params,
        )

        return {
            "data": [dict(r) for r in rows],
            "total": count,
            "page": page,
            "limit": limit,
            "pages": (count + limit - 1) // limit if count else 0,
        }


@router.get("/{payment_id}")
async def get_payment(merchant_id: int, payment_id: str):
    schema = await get_merchant_schema(merchant_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"SELECT * FROM {schema}.payments WHERE payment_id = $1", payment_id
        )
        return dict(row) if row else {"error": "Not found"}
