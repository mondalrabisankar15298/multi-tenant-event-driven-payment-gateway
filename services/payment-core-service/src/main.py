from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.requests import Request

from .database import get_pool, close_pool
from .routers import merchants, customers, payments, refunds, seed_proxy
from .config import settings
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
app.include_router(merchants.admin_router)
app.include_router(customers.router)
app.include_router(payments.router)
app.include_router(refunds.router)
app.include_router(seed_proxy.router)


# Events log endpoint
@app.get("/api/events", tags=["events"])
async def get_events(
    status: str = None,
    merchant_uuid: str = None,
    entity_type: str = None,
    event_type: str = None,
    from_date: str = None,
    to_date: str = None,
):
    """View domain_events outbox with full filter support (admin portal). Returns all matching events."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT de.*, m.merchant_uuid 
            FROM public.domain_events de
            JOIN public.merchants m ON de.merchant_id = m.merchant_id
        """
        conditions = []
        params = []
        idx = 1

        if status:
            conditions.append(f"de.status = ${idx}")
            params.append(status)
            idx += 1
        if merchant_uuid:
            conditions.append(f"m.merchant_uuid = ${idx}")
            params.append(merchant_uuid)
            idx += 1
        if entity_type:
            conditions.append(f"de.entity_type = ${idx}")
            params.append(entity_type)
            idx += 1
        if event_type:
            conditions.append(f"de.event_type = ${idx}")
            params.append(event_type)
            idx += 1
        if from_date:
            conditions.append(f"de.created_at >= ${idx}::timestamptz")
            params.append(from_date)
            idx += 1
        if to_date:
            conditions.append(f"de.created_at <= ${idx}::timestamptz + interval '1 day'")
            params.append(to_date)
            idx += 1

        where = " AND ".join(conditions) if conditions else "TRUE"

        rows = await conn.fetch(
            f"{query} WHERE {where} ORDER BY de.created_at DESC",
            *params,
        )
        events = []
        for r in rows:
            event_dict = dict(r)
            event_dict.pop("merchant_id", None)
            events.append(event_dict)
        return events


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
