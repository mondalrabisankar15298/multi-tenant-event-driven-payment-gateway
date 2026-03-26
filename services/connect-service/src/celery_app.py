from celery import Celery
from .config import settings

celery = Celery(
    "connect_service",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

celery.conf.imports = ("src.tasks.webhook_retry_task",)
