from fastapi import APIRouter
from ..database import get_pool, get_merchant_schema

router = APIRouter(prefix="/api/{merchant_uuid}/analytics", tags=["analytics"])


@router.get("/summary")
async def get_summary(merchant_uuid: str):
    """Total revenue, payment count, success rate, and average payment amount."""
    schema = await get_merchant_schema(merchant_uuid)
    pool = await get_pool()
    async with pool.acquire() as conn:
        stats = await conn.fetchrow(
            f"""
            SELECT
                COUNT(*) as total_payments,
                COALESCE(SUM(amount), 0) as total_amount,
                COUNT(*) FILTER (WHERE status = 'captured' OR status = 'settled') as success_count,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
                COALESCE(AVG(amount), 0) as avg_amount,
                ROUND(
                    COUNT(*) FILTER (WHERE status = 'captured' OR status = 'settled')::DECIMAL /
                    NULLIF(COUNT(*), 0) * 100, 2
                ) as success_rate
            FROM {schema}.payments
            """
        )

        refund_total = await conn.fetchval(
            f"SELECT COALESCE(SUM(amount), 0) FROM {schema}.refunds WHERE status = 'processed'"
        )

        return {
            "total_payments": stats["total_payments"],
            "total_revenue": float(stats["total_amount"]),
            "net_revenue": float(stats["total_amount"]) - float(refund_total),
            "success_count": stats["success_count"],
            "failed_count": stats["failed_count"],
            "success_rate": float(stats["success_rate"] or 0),
            "avg_payment_amount": float(stats["avg_amount"]),
            "total_refunds": float(refund_total),
        }


@router.get("/daily")
async def get_daily_revenue(merchant_uuid: str, days: int = 30):
    """Daily revenue breakdown for charts."""
    schema = await get_merchant_schema(merchant_uuid)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT date, total_amount, payment_count, success_count,
                   failed_count, refund_amount, net_revenue
            FROM {schema}.daily_revenue
            ORDER BY date DESC
            LIMIT $1
            """,
            days,
        )
        return [dict(r) for r in rows]


@router.get("/methods")
async def get_method_stats(merchant_uuid: str):
    """Payment method distribution."""
    schema = await get_merchant_schema(merchant_uuid)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT method, total_amount, count, success_count, success_rate
            FROM {schema}.payment_method_stats
            ORDER BY count DESC
            """
        )
        return [dict(r) for r in rows]
