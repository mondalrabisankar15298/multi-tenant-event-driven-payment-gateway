import logging

logger = logging.getLogger(__name__)


async def check_and_mark(pool, event_id: str) -> bool:
    """Check if event was already processed. Returns True if already processed."""
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT event_id FROM public.processed_events WHERE event_id = $1",
            event_id,
        )
        if existing:
            logger.info(f"Event {event_id} already processed, skipping")
            return True
        return False


async def mark_processed(pool, event_id: str):
    """Mark event as processed."""
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO public.processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING",
            event_id,
        )
