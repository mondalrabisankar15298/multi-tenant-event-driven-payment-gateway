from fastapi import APIRouter, Query
from ..database import get_pool, get_merchant_schema

router = APIRouter(prefix="/api/{merchant_uuid}/refunds", tags=["refunds"])


@router.get("")
async def list_refunds(
    merchant_uuid: str,
    status: str = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=200),
):
    schema = await get_merchant_schema(merchant_uuid)
    pool = await get_pool()
    offset = (page - 1) * limit

    conditions = []
    filter_params = []
    idx = 1

    if status:
        conditions.append(f"status = ${idx}")
        filter_params.append(status)
        idx += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    async with pool.acquire() as conn:
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM {schema}.refunds {where}",
            *filter_params,
        )

        rows = await conn.fetch(
            f"""
            SELECT refund_id, payment_id, payment_amount, customer_name,
                   amount, reason, status, created_at, updated_at
            FROM {schema}.refunds
            {where}
            ORDER BY created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *filter_params, limit, offset,
        )

    return {
        "data": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "limit": limit,
    }
