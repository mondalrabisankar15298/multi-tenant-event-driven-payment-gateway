import logging

logger = logging.getLogger(__name__)


async def try_claim_event(pool, event_id) -> bool:
    """Returns True if WE claimed it (proceed). False if already claimed."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO public.processed_events (event_id) VALUES ($1) "
            "ON CONFLICT DO NOTHING RETURNING event_id",
            event_id,
        )
        if not row:
            logger.info(f"Event {event_id} already processed, skipping")
        return row is not None
