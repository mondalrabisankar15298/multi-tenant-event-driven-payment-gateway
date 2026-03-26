from fastapi import APIRouter, HTTPException
from ..models.schemas import PaymentCreate, PaymentResponse
from ..services import payment_service

router = APIRouter(prefix="/api/{merchant_id}/payments", tags=["payments"])


@router.post("", response_model=PaymentResponse, status_code=201)
async def create_payment(merchant_id: int, data: PaymentCreate):
    try:
        payment = await payment_service.create_payment(
            merchant_id, data.customer_id, data.amount, data.currency,
            data.method, data.description, data.metadata
        )
        return payment
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[PaymentResponse])
async def list_payments(merchant_id: int):
    return await payment_service.list_payments(merchant_id)


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(merchant_id: int, payment_id: str):
    payment = await payment_service.get_payment(merchant_id, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.post("/{payment_id}/authorize", response_model=PaymentResponse)
async def authorize_payment(merchant_id: int, payment_id: str):
    try:
        return await payment_service.transition_payment(merchant_id, payment_id, "authorized")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{payment_id}/capture", response_model=PaymentResponse)
async def capture_payment(merchant_id: int, payment_id: str):
    try:
        return await payment_service.transition_payment(merchant_id, payment_id, "captured")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{payment_id}/fail", response_model=PaymentResponse)
async def fail_payment(merchant_id: int, payment_id: str):
    try:
        return await payment_service.transition_payment(
            merchant_id, payment_id, "failed", failure_reason="Payment declined"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
