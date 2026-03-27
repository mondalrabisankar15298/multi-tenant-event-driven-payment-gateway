import asyncpg
from .config import settings

pool = None


async def get_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(
            dsn=settings.read_db_dsn,
            min_size=5,
            max_size=20,
            command_timeout=60,
            max_inactive_connection_lifetime=300,
            setup=init_connection
        )
    return pool


async def close_pool():
    global pool
    if pool:
        await pool.close()
        pool = None


async def get_merchant_schema(merchant_id: int) -> str:
    p = await get_pool()
    async with p.acquire() as conn:
        row = await conn.fetchrow("SELECT schema_name FROM public.merchants WHERE merchant_id = $1", merchant_id)
        if not row:
            raise ValueError(f"Merchant {merchant_id} not found")
        from .utils.validators import validate_schema_name
        return validate_schema_name(row["schema_name"])
