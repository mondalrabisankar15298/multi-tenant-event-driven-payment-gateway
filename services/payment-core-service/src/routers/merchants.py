from fastapi import APIRouter, HTTPException
from ..models.schemas import MerchantCreate, MerchantResponse
from ..services import merchant_service

router = APIRouter(prefix="/api/merchants", tags=["merchants"])


@router.post("", response_model=MerchantResponse, status_code=201)
async def create_merchant(data: MerchantCreate):
    try:
        merchant = await merchant_service.create_merchant(data.name, data.email)
        return merchant
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[MerchantResponse])
async def list_merchants():
    return await merchant_service.list_merchants()


@router.get("/{merchant_id}", response_model=MerchantResponse)
async def get_merchant(merchant_id: int):
    merchant = await merchant_service.get_merchant(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return merchant
