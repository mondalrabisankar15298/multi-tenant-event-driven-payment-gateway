import pytest
import httpx
import asyncio
import os

CORE_URL = os.getenv("CORE_SERVICE_URL", "http://localhost:8001")
DASHBOARD_URL = os.getenv("DASHBOARD_SERVICE_URL", "http://localhost:8003")

@pytest.mark.asyncio
async def test_end_to_end_payment_flow(client, merchant_setup):
    merchant = merchant_setup
    merchant_uuid = merchant["merchant_uuid"]
    api_key = merchant["api_key"]
    headers = {"X-API-Key": str(api_key)}

    # 2. Create a Customer for this merchant
    res = await client.post(f"{CORE_URL}/api/{merchant_uuid}/customers", json={
        "name": "John Doe",
        "email": "john.doe@example.com",
        "phone": "+1234567890"
    }, headers=headers)
    assert res.status_code == 201, f"Failed to create customer: {res.text}"
    customer = res.json()
    customer_id = customer["customer_id"]
    
    # 3. Create a Payment
    res = await client.post(f"{CORE_URL}/api/{merchant_uuid}/payments", json={
        "customer_id": customer_id,
        "amount": 150.50,
        "currency": "USD",
        "method": "card",
        "description": "Test E2E Payment"
    }, headers=headers)
    assert res.status_code == 201, f"Failed to create payment: {res.text}"
    payment = res.json()
    payment_id = payment["payment_id"]
    
    # 4. Authorize and Capture Payment
    res = await client.post(f"{CORE_URL}/api/{merchant_uuid}/payments/{payment_id}/authorize", headers=headers)
    assert res.status_code == 200, f"Failed to authorize payment: {res.text}"
    
    res = await client.post(f"{CORE_URL}/api/{merchant_uuid}/payments/{payment_id}/capture", headers=headers)
    assert res.status_code == 200, f"Failed to capture payment: {res.text}"
    assert res.json()["status"] == "captured"
    
    # 5. Wait for events to sync to read-db via Connect Service
    # Add retry logic since Kafka sync might take longer depending on load
    max_retries = 10
    payments = []
    for i in range(max_retries):
        await asyncio.sleep(2)
        res = await client.get(f"{DASHBOARD_URL}/api/{merchant_uuid}/payments?limit=10&offset=0", headers=headers)
        if res.status_code == 200:
            body = res.json()
            items = body.get("items", []) if isinstance(body, dict) else body
            # The dashboard response structure for list payments is {"data": [...], "total": ...}
            if isinstance(body, dict) and "data" in body:
                items = body["data"]
            
            synced = next((p for p in items if p["payment_id"] == payment_id), None)
            if synced and synced["status"] == "captured":
                payments = items
                break
    else:
        assert False, "Timeout waiting for payment to sync and reach 'captured' status in dashboard"
    assert len(payments) > 0, "No payments synced to dashboard"
    
    synced_payment = next((p for p in payments if p["payment_id"] == payment_id), None)
    assert synced_payment is not None, "Synced payment not found"
    assert synced_payment["status"] == "captured"
    assert float(synced_payment["amount"]) == 150.50  # Should be preserved properly
    
    # 7. Create a Refund
    res = await client.post(f"{CORE_URL}/api/{merchant_uuid}/payments/{payment_id}/refund", json={
        "amount": 50.00,
        "reason": "Partial E2E Refund"
    }, headers=headers)
    assert res.status_code == 201, f"Failed to create refund: {res.text}"
    res.json() # Verify response can be parsed as JSON
    
    # 8. Check events API for pagination and functionality
    res = await client.get(f"{CORE_URL}/api/events?limit=5")
    assert res.status_code == 200
    events = res.json()
    assert isinstance(events, list)
    
    print("E2E Test Passed Successfully!")


@pytest.mark.asyncio
async def test_merchant_response_security(client):
    """Verify that sensitive fields are not exposed in merchant API responses."""
    import time
    unique_suffix = int(time.time() * 1000)
    
    # Create a merchant
    res = await client.post(f"{CORE_URL}/api/merchants", json={
        "name": f"Security Test {unique_suffix}",
        "email": f"security-{unique_suffix}@test.com"
    })
    assert res.status_code == 201
    data = res.json()
    
    # POST response should NOT expose api_key or schema_name
    assert "merchant_uuid" in data
    assert "api_key" not in data, "api_key should not be exposed in POST response"
    assert "schema_name" not in data, "schema_name should not be exposed in POST response"
    assert "name" in data
    assert "status" in data
    
    # GET list response should NOT expose api_key or schema_name
    res = await client.get(f"{CORE_URL}/api/merchants")
    assert res.status_code == 200
    list_data = res.json()
    for m in list_data.get("data", []):
        assert "api_key" not in m, "api_key should not be exposed in GET list"
        assert "schema_name" not in m, "schema_name should not be exposed in GET list"
        assert "merchant_uuid" in m
