from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import get_pool, close_pool
from .routers import payments, refunds, customers, analytics


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(
    title="Merchant Dashboard Service",
    description="System 3 — Read-Only Analytics & Dashboard API",
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

app.include_router(payments.router)
app.include_router(refunds.router)
app.include_router(customers.router)
app.include_router(analytics.router)


@app.get("/api/merchants", tags=["merchants"])
async def list_merchants():
    """List merchants from the mirror table (for dropdown)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM public.merchants ORDER BY created_at DESC")
        return [dict(r) for r in rows]


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "healthy", "service": "merchant-dashboard-service"}
