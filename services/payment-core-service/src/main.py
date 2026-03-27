from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.requests import Request
import logging

from .database import get_pool, close_pool
from .routers import merchants, customers, payments, refunds
from .utils.logger import setup_logging, get_logger
from prometheus_client import make_asgi_app

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create DB pool
    await get_pool()
    yield
    # Shutdown: close DB pool
    await close_pool()


app = FastAPI(
    title="Payment Core Service",
    description="System 1 — Multi-Tenant Payment Gateway (Write Side)",
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

from .config import settings

# CORS
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

# Routers
app.include_router(merchants.router)
app.include_router(customers.router)
app.include_router(payments.router)
app.include_router(refunds.router)


# Events log endpoint
@app.get("/api/events", tags=["events"])
async def get_events(status: str = None, limit: int = 50):
    """View domain_events outbox (for admin portal Events Log page)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        if status:
            rows = await conn.fetch(
                "SELECT * FROM public.domain_events WHERE status = $1 ORDER BY created_at DESC LIMIT $2",
                status, limit,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM public.domain_events ORDER BY created_at DESC LIMIT $1",
                limit,
            )
        return [dict(r) for r in rows]


@app.get("/health", tags=["health"])
async def health_check():
    health_status = {"status": "healthy", "service": "payment-core-service", "components": {}}
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
            health_status["components"]["db"] = "ok"
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["components"]["db"] = f"error: {str(e)}"
    
    return health_status
