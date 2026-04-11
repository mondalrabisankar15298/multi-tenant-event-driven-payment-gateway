import os
import json
import urllib.request
import urllib.parse
import urllib.error
import time

ADMIN_KEY = "dev-admin-key-change-in-production"
CONNECT_URL = "http://localhost:8002"

def do_request(url, method="GET", headers=None, json_data=None, data=None):
    if headers is None:
        headers = {}
    
    if json_data is not None:
        body = json.dumps(json_data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif data is not None:
        body = urllib.parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    else:
        body = None

    req = urllib.request.Request(url, data=body, method=method)
    for k, v in headers.items():
        req.add_header(k, v)
        
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            if content:
                try:
                    return resp.status, json.loads(content.decode("utf-8"))
                except BaseException:
                    return resp.status, content.decode("utf-8")
            return resp.status, None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")

print("Starting Admin Core Setup...")

# 1. Create a consumer
status, consumer = do_request(
    f"{CONNECT_URL}/api/v1/admin/consumers",
    method="POST",
    headers={"X-Admin-Key": ADMIN_KEY},
    json_data={
        "name": "E2E Automated Bulk Test Consumer",
        "description": "testing",
        "scopes": ["payments:read", "customers:read", "refunds:read", "events:read", "merchants:read"]
    }
)
if status >= 400:
    print("Failed creating consumer:", consumer)
    exit(1)

consumer = consumer.get("data", consumer)
client_id = consumer["client_id"]
client_secret = consumer["client_secret"]
consumer_id = consumer["consumer_id"]

print(f"Consumer Created: {consumer_id}")

# 2. Get merchants
status, merchants = do_request(
    f"{CONNECT_URL}/api/v1/admin/consumers/merchants/all",
    headers={"X-Admin-Key": ADMIN_KEY}
)

merchants = merchants.get("data", [] if isinstance(merchants, dict) else merchants)
if not merchants:
    print("No merchants found, creating dummies.")
    do_request("http://localhost:8001/admin/merchants", "POST", json_data={"name": "M1", "email": "m1@ts.com"})
    do_request("http://localhost:8001/admin/merchants", "POST", json_data={"name": "M2", "email": "m2@ts.com"})
    status, merchants = do_request(
        f"{CONNECT_URL}/api/v1/admin/consumers/merchants/all",
        headers={"X-Admin-Key": ADMIN_KEY}
    )

merchant_uuids = [m["merchant_uuid"] for m in merchants[:2]]
print(f"Assigning merchants to consumer: {merchant_uuids}")

# 3. Assign merchants
status, resp = do_request(
    f"{CONNECT_URL}/api/v1/admin/consumers/{consumer_id}/merchants",
    method="POST",
    headers={"X-Admin-Key": ADMIN_KEY},
    json_data={"merchant_uuids": merchant_uuids}
)
if status >= 400:
    print("Failed assigning merchants:", resp)
    exit(1)

print("Merchants assigned successfully.")

# 4. OAuth
print("\nPerforming OAuth Client Credentials Flow...")
status, resp = do_request(
    f"{CONNECT_URL}/api/v1/oauth/token",
    method="POST",
    data={
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "payments:read customers:read refunds:read events:read merchants:read"
    }
)
if status != 200:
    print(f"OAuth failed: {resp}")
    exit(1)

token = resp["access_token"]
print("Obtained OAuth token successfully.")

# 5. Bulk APIs
headers = {
    "Authorization": f"Bearer {token}"
}

print("\n--- Testing Third-Party Endpoints ---\n")

endpoints = [
    ("/api/v1/merchants", None),
]

for m_uuid in merchant_uuids:
    endpoints.extend([
        ("/api/v1/customers?limit=5", m_uuid),
        ("/api/v1/payments?limit=5", m_uuid),
        ("/api/v1/refunds?limit=5", m_uuid),
        ("/api/v1/events?limit=5", m_uuid),
    ])

success = True
for ep, m_uuid in endpoints:
    req_headers = headers.copy()
    if m_uuid:
        req_headers["X-Merchant-UUID"] = str(m_uuid)
    
    print(f"GET {ep} (Merchant: {m_uuid if m_uuid else 'Global'})")
    status, data = do_request(f"{CONNECT_URL}{ep}", headers=req_headers)
    if status == 200:
        if type(data) is dict:
            print(f"  ✓ Success! Got {len(data.get('data', []))} records.")
        else:
            print(f"  ✓ Success! (Non-dict body)")
    else:
        print(f"  ✗ Failed! Status: {status}")
        print(f"  Response: {data}")
        success = False

# Cleanup
do_request(f"{CONNECT_URL}/api/v1/admin/consumers/{consumer_id}", method="DELETE", headers={"X-Admin-Key": ADMIN_KEY})
print("\nTest cleanup complete.")

if not success:
    exit(1)
print("All endpoints passed correctly.")
