import asyncpg
from .config import settings

pool = None


async def get_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(
            dsn=settings.core_db_dsn,
            min_size=5,
            max_size=20,
        )
    return pool


async def close_pool():
    global pool
    if pool:
        await pool.close()
        pool = None
