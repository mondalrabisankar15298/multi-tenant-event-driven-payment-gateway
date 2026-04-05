from fastapi import APIRouter, HTTPException, Depends
from uuid import UUID
from ..models.schemas import CustomerCreate, CustomerUpdate, CustomerResponse
from ..services import customer_service
from ..services.merchant_service import get_merchant_id_by_uuid
from ..utils.auth import verify_merchant_access

router = APIRouter(
    prefix="/api/{merchant_uuid}/customers", 
    tags=["customers"],
    dependencies=[Depends(verify_merchant_access)]
)


async def resolve_merchant_id(merchant_uuid: UUID) -> int:
    mid = await get_merchant_id_by_uuid(str(merchant_uuid))
    if not mid:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return mid


@router.post("", response_model=CustomerResponse, status_code=201)
async def create_customer(merchant_uuid: UUID, data: CustomerCreate):
    mid = await resolve_merchant_id(merchant_uuid)
    try:
        customer = await customer_service.create_customer(
            mid, data.name, data.email, data.phone
        )
        return customer
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
async def list_customers(merchant_uuid: UUID, page: int = 1, limit: int = 25):
    mid = await resolve_merchant_id(merchant_uuid)
    data, total = await customer_service.list_customers(mid, page, limit)
    return {
        "data": data,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(merchant_uuid: UUID, customer_id: str):
    mid = await resolve_merchant_id(merchant_uuid)
    customer = await customer_service.get_customer(mid, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(merchant_uuid: UUID, customer_id: str, data: CustomerUpdate):
    mid = await resolve_merchant_id(merchant_uuid)
    customer = await customer_service.update_customer(
        mid, customer_id, data.name, data.email, data.phone
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(merchant_uuid: UUID, customer_id: str):
    mid = await resolve_merchant_id(merchant_uuid)
    deleted = await customer_service.delete_customer(mid, customer_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Customer not found")
