import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import get_pool, close_pool
from .consumers.db_sync_consumer import start_db_sync_consumer
from .consumers.webhook_consumer import start_webhook_consumer
from .routers import webhooks


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create DB pool and start consumers
    await get_pool()

    # Start Kafka consumers as background tasks
    db_sync_task = asyncio.create_task(start_db_sync_consumer())
    webhook_task = asyncio.create_task(start_webhook_consumer())

    yield

    # Shutdown
    db_sync_task.cancel()
    webhook_task.cancel()
    await close_pool()


app = FastAPI(
    title="Connect Service",
    description="System 2 — Event Engine (Kafka Consumers + Webhook Management)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router)


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "healthy", "service": "connect-service"}
