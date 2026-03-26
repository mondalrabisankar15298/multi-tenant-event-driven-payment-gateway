from celery import Celery
from .config import settings

celery = Celery(
    "payment_core",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "outbox-poll": {
            "task": "src.tasks.outbox_task.publish_pending_events",
            "schedule": 2.0,
        },
    },
)

celery.conf.imports = ("src.tasks.outbox_task",)
