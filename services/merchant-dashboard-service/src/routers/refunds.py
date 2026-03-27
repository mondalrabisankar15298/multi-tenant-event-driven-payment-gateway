from fastapi import APIRouter
from ..database import get_pool, get_merchant_schema

router = APIRouter(prefix="/api/{merchant_id}/refunds", tags=["refunds"])


@router.get("")
async def list_refunds(merchant_id: int, limit: int = 50):
    schema = await get_merchant_schema(merchant_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM {schema}.refunds ORDER BY created_at DESC LIMIT $1",
            limit,
        )
        return [dict(r) for r in rows]
