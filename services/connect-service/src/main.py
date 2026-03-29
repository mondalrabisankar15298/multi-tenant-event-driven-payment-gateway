import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.requests import Request

from .database import get_pool, close_pool
from .consumers.db_sync_consumer import start_db_sync_consumer
from .consumers.webhook_consumer import start_webhook_consumer
from .routers import webhooks
from .utils.logger import setup_logging, get_logger
from .config import settings
from prometheus_client import make_asgi_app

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create DB pool and start consumers
    await get_pool()

    shutdown_event = asyncio.Event()

    def handle_task_result(task: asyncio.Task):
        try:
            task.result()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Background consumer task failed: {e}", exc_info=True)

    # Start Kafka consumers as background tasks
    db_sync_task = asyncio.create_task(start_db_sync_consumer(shutdown_event))
    db_sync_task.add_done_callback(handle_task_result)
    
    webhook_task = asyncio.create_task(start_webhook_consumer(shutdown_event))
    webhook_task.add_done_callback(handle_task_result)

    yield

    # Shutdown
    shutdown_event.set()
    await asyncio.gather(db_sync_task, webhook_task, return_exceptions=True)
    await close_pool()


app = FastAPI(
    title="Connect Service",
    description="System 2 — Event Engine (Kafka Consumers + Webhook Management)",
    version="1.0.0",
    lifespan=lifespan,
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)

# Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

app.include_router(webhooks.router)


@app.get("/health", tags=["health"])
async def health_check():
    health_status = {"status": "healthy", "service": "connect-service", "components": {}}
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
            health_status["components"]["db"] = "ok"
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["components"]["db"] = f"error: {str(e)}"
    
    return health_status
