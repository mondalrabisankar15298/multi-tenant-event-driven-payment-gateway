from fastapi import APIRouter, HTTPException
from ..models.schemas import RefundCreate, RefundResponse
from ..services import refund_service

router = APIRouter(tags=["refunds"])


@router.post("/api/{merchant_id}/payments/{payment_id}/refund", response_model=RefundResponse, status_code=201)
async def create_refund(merchant_id: int, payment_id: str, data: RefundCreate):
    try:
        refund = await refund_service.create_refund(
            merchant_id, payment_id, data.amount, data.reason
        )
        return refund
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/{merchant_id}/refunds/{refund_id}/process", response_model=RefundResponse)
async def process_refund(merchant_id: int, refund_id: str):
    try:
        refund = await refund_service.process_refund(merchant_id, refund_id)
        if not refund:
            raise HTTPException(status_code=404, detail="Refund not found")
        return refund
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/{merchant_id}/refunds", response_model=list[RefundResponse])
async def list_refunds(merchant_id: int):
    return await refund_service.list_refunds(merchant_id)
