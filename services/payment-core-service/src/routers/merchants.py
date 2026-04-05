from fastapi import APIRouter, HTTPException
from uuid import UUID
from ..models.schemas import MerchantCreate, MerchantResponse, MerchantUpdate, MerchantPublicResponse
from ..services import merchant_service

router = APIRouter(prefix="/api/merchants", tags=["merchants"])


@router.post("", response_model=MerchantPublicResponse, status_code=201)
async def create_merchant(data: MerchantCreate):
    try:
        merchant = await merchant_service.create_merchant(data.name, data.email)
        return merchant
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
async def list_merchants(page: int = 1, limit: int = 25):
    data, total = await merchant_service.list_merchants(page, limit)
    public_data = [
        {
            "merchant_uuid": str(m["merchant_uuid"]),
            "name": m["name"],
            "email": m["email"],
            "status": m["status"],
            "created_at": m["created_at"],
        }
        for m in data
    ]
    return {
        "data": public_data,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }


@router.get("/{merchant_uuid}", response_model=MerchantPublicResponse)
async def get_merchant(merchant_uuid: UUID):
    merchant = await merchant_service.get_merchant_by_uuid(str(merchant_uuid))
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return merchant


@router.put("/{merchant_uuid}", response_model=MerchantPublicResponse)
async def update_merchant(merchant_uuid: UUID, data: MerchantUpdate):
    merchant = await merchant_service.get_merchant_by_uuid(str(merchant_uuid))
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    try:
        updated = await merchant_service.update_merchant(
            merchant["merchant_id"], data.name, data.email, data.status
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Admin-only endpoints (internal) ──────────────────────────────────

admin_router = APIRouter(prefix="/api/admin/merchants", tags=["admin-merchants"])


@admin_router.get("/{merchant_uuid}/credentials")
async def get_merchant_credentials(merchant_uuid: UUID):
    """Return api_key for a merchant. Admin/internal use only."""
    merchant = await merchant_service.get_merchant_by_uuid(str(merchant_uuid))
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return {"merchant_uuid": str(merchant["merchant_uuid"]), "api_key": str(merchant["api_key"])}


# ─── Admin-only endpoints (internal) ──────────────────────────────────

admin_router = APIRouter(prefix="/api/admin/merchants", tags=["admin-merchants"])


@admin_router.get("/{merchant_uuid}/credentials")
async def get_merchant_credentials(merchant_uuid: UUID):
    """Return api_key for a merchant. Admin/internal use only."""
    merchant = await merchant_service.get_merchant_by_uuid(str(merchant_uuid))
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return {"merchant_uuid": str(merchant["merchant_uuid"]), "api_key": str(merchant["api_key"])}
