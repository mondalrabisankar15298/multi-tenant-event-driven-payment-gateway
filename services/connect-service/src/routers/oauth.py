"""
OAuth 2.0 Token Endpoint — Client Credentials Flow (RFC 6749)

POST /api/v1/oauth/token
"""
import logging
import base64
from fastapi import APIRouter, HTTPException, Form, Request
from ..services.oauth_service import authenticate_consumer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/oauth", tags=["OAuth"])


@router.post("/token")
async def token_endpoint(
    request: Request,
    grant_type: str = Form(None),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    scope: str = Form(None),
):
    """
    OAuth 2.0 Client Credentials token endpoint.

    - grant_type: must be "client_credentials"
    - client_id: consumer's client ID
    - client_secret: consumer's client secret
    - scope: (optional) space-separated list of scopes (must be subset of assigned)
    """
    if not grant_type:
        # Sometimes grant_type isn't parsed natively if basic auth is used weirdly, but usually it is in form
        form_data = await request.form()
        grant_type = form_data.get("grant_type", grant_type)
        
    if grant_type != "client_credentials":
        raise HTTPException(
            status_code=400,
            detail={
                "error": "unsupported_grant_type",
                "message": "Only 'client_credentials' grant type is supported",
            },
        )

    # Fallback to HTTP Basic Auth if missing from body
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Basic "):
        try:
            encoded = auth_header.split(" ", 1)[1]
            decoded = base64.b64decode(encoded).decode("utf-8")
            if ":" in decoded:
                b_client_id, b_client_secret = decoded.split(":", 1)
                client_id = client_id or b_client_id
                client_secret = client_secret or b_client_secret
        except Exception:
            pass

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_request", "message": "Missing client_id or client_secret"},
        )

    # TEMPORARY DEBUG: Write what we got to a file
    try:
        with open("/tmp/postman_debug.log", "w") as f:
            f.write(f"RECEIVED_CLIENT_ID='{client_id}'\nRECEIVED_CLIENT_SECRET='{client_secret}'\n")
    except Exception:
        pass

    try:
        result = await authenticate_consumer(client_id, client_secret, scope)
        return result
    except ValueError as e:
        error_msg = str(e)
        if "credentials" in error_msg.lower():
            raise HTTPException(status_code=401, detail={"error": "invalid_client", "message": error_msg})
        elif "suspended" in error_msg.lower() or "revoked" in error_msg.lower():
            raise HTTPException(status_code=403, detail={"error": "access_denied", "message": error_msg})
        else:
            raise HTTPException(status_code=400, detail={"error": "invalid_request", "message": error_msg})
