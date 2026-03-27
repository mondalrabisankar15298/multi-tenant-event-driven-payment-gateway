import pytest
import httpx
import os

CORE_URL = os.getenv("CORE_SERVICE_URL", "http://localhost:8001")
DASHBOARD_URL = os.getenv("DASHBOARD_SERVICE_URL", "http://localhost:8003")

@pytest.mark.asyncio
async def test_core_health():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{CORE_URL}/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

@pytest.mark.asyncio
async def test_dashboard_health():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{DASHBOARD_URL}/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
