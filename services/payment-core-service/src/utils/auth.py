from fastapi import Request, HTTPException
from ..services.merchant_service import get_merchant

async def verify_merchant_access(request: Request, merchant_id: int):
    """Validate X-API-Key header against the merchant's api_key."""
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    merchant = await get_merchant(merchant_id)
    if not merchant or str(merchant["api_key"]) != api_key:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return merchant
