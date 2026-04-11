"""
Analytics API Router — Admin-only endpoints.
All queries read from Core DB Replica.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from ..utils.auth import verify_admin_access
from ..services.analytics_service import (
    get_system_overview,
    get_consumer_stats,
    get_time_series_api_calls,
    get_time_series_webhooks,
    get_audit_summary,
    get_endpoint_breakdown,
    get_raw_audit_log,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/analytics",
    tags=["Admin - Analytics"],
    dependencies=[Depends(verify_admin_access)],
)


@router.get("/overview")
async def analytics_overview():
    """System-wide analytics overview."""
    data = await get_system_overview()
    return {"data": data}


@router.get("/consumers/{consumer_id}")
async def consumer_analytics(consumer_id: str):
    """Detailed analytics for a specific consumer."""
    data = await get_consumer_stats(consumer_id)
    return {"data": data}


@router.get("/consumers/{consumer_id}/api-calls")
async def consumer_api_calls_timeseries(
    consumer_id: str,
    from_dt: Optional[str] = Query(None, alias="from"),
    to_dt: Optional[str] = Query(None, alias="to"),
    granularity: str = "hour",
):
    """Time-series API call data for a consumer."""
    now = datetime.now(timezone.utc)
    from_datetime = datetime.fromisoformat(from_dt) if from_dt else now - timedelta(hours=24)
    to_datetime = datetime.fromisoformat(to_dt) if to_dt else now

    data = await get_time_series_api_calls(consumer_id, from_datetime, to_datetime, granularity)
    return {"data": data, "granularity": granularity}


@router.get("/consumers/{consumer_id}/webhooks")
async def consumer_webhooks_timeseries(
    consumer_id: str,
    from_dt: Optional[str] = Query(None, alias="from"),
    to_dt: Optional[str] = Query(None, alias="to"),
    granularity: str = "hour",
):
    """Time-series webhook delivery data for a consumer."""
    now = datetime.now(timezone.utc)
    from_datetime = datetime.fromisoformat(from_dt) if from_dt else now - timedelta(hours=24)
    to_datetime = datetime.fromisoformat(to_dt) if to_dt else now

    data = await get_time_series_webhooks(consumer_id, from_datetime, to_datetime, granularity)
    return {"data": data, "granularity": granularity}


@router.get("/consumers/{consumer_id}/audit-summary")
async def consumer_audit_summary(consumer_id: str):
    """Total API call counts for a consumer across multiple time windows."""
    data = await get_audit_summary(consumer_id)
    return {"data": data}


@router.get("/consumers/{consumer_id}/endpoint-breakdown")
async def consumer_endpoint_breakdown(consumer_id: str):
    """API calls grouped by endpoint with call counts and avg response time (30d)."""
    data = await get_endpoint_breakdown(consumer_id)
    return {"data": data}


@router.get("/consumers/{consumer_id}/audit-log")
async def consumer_audit_log(
    consumer_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=10, le=200),
):
    """Paginated raw audit log of all API calls made by a consumer."""
    data = await get_raw_audit_log(consumer_id, page, page_size)
    return {"data": data}
