import json
import logging
import asyncio
import uuid
from aiokafka import AIOKafkaConsumer
from ..database import get_pool
from ..utils.idempotency import check_and_mark, mark_processed
from ..services.schema_manager import ensure_merchant_schema
from ..services.sync_service import sync_event
from ..config import settings

logger = logging.getLogger(__name__)


async def start_db_sync_consumer():
    """Consumer Group 1: DB Sync — Transform and sync data to read DB."""
    consumer = AIOKafkaConsumer(
        settings.KAFKA_TOPIC,
        bootstrap_servers=settings.KAFKA_BROKERS,
        group_id="db-sync-group",
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
    )

    while True:
        try:
            await consumer.start()
            pool = await get_pool()
            logger.info("DB Sync consumer started")

            async for msg in consumer:
                event = msg.value
                event_id_str = event.get("event_id")
                try:
                    event_id = uuid.UUID(event_id_str)
                except (ValueError, TypeError):
                    logger.error(f"Invalid event_id: {event_id_str}")
                    await consumer.commit()
                    continue

                logger.info(f"DB Sync received: {event.get('event_type')} for merchant {event.get('merchant_id')}")

                # Idempotency check
                if await check_and_mark(pool, event_id):
                    await consumer.commit()
                    continue

                # If merchant.created, ensure schema exists
                if event.get("event_type") == "merchant.created.v1":
                    await ensure_merchant_schema(pool, event["schema_name"])

                # Transform and sync
                await sync_event(pool, event)

                # Mark processed
                await mark_processed(pool, event_id)

                # Commit offset
                await consumer.commit()
                logger.info(f"DB Sync processed: {event.get('event_type')}")

        except Exception as e:
            logger.error(f"DB Sync consumer error: {e}")
            await asyncio.sleep(5)
        finally:
            try:
                await consumer.stop()
            except Exception:
                pass
