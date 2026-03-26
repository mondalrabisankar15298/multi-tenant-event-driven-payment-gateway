from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import get_pool, close_pool
from .routers import merchants, customers, payments, refunds


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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    return {"status": "healthy", "service": "payment-core-service"}
