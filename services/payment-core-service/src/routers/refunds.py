from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from ..models.schemas import RefundCreate, RefundResponse
from ..services import refund_service
from ..services.merchant_service import get_merchant_id_by_uuid
from ..utils.auth import verify_merchant_access

router = APIRouter(
    tags=["refunds"],
    dependencies=[Depends(verify_merchant_access)]
)


async def resolve_merchant_id(merchant_uuid: UUID) -> int:
    mid = await get_merchant_id_by_uuid(str(merchant_uuid))
    if not mid:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return mid


@router.post("/api/{merchant_uuid}/payments/{payment_id}/refund", response_model=RefundResponse, status_code=201)
async def create_refund(merchant_uuid: UUID, payment_id: str, data: RefundCreate):
    mid = await resolve_merchant_id(merchant_uuid)
    try:
        refund = await refund_service.create_refund(
            mid, payment_id, data.amount, data.reason
        )
        return refund
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/{merchant_uuid}/refunds/{refund_id}/process", response_model=RefundResponse)
async def process_refund(merchant_uuid: UUID, refund_id: str):
    mid = await resolve_merchant_id(merchant_uuid)
    try:
        refund = await refund_service.process_refund(mid, refund_id)
        if not refund:
            raise HTTPException(status_code=404, detail="Refund not found")
        return refund
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/{merchant_uuid}/refunds")
async def list_refunds(merchant_uuid: UUID, page: int = 1, limit: int = 25):
    mid = await resolve_merchant_id(merchant_uuid)
    data, total = await refund_service.list_refunds(mid, page, limit)
    return {
        "data": data,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }
