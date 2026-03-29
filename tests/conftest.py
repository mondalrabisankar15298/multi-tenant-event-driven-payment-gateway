import pytest
import psycopg2
import httpx

# Constants
CORE_URL = "http://localhost:8001"
# Default to Docker-Compose internal hostnames if not provided (tests run outside docker usually)
CORE_DB_URL = "postgres://payment_admin:payment_secret@localhost:5433/payment_core"
READ_DB_URL = "postgres://payment_admin:payment_secret@localhost:5434/payment_read"

@pytest.fixture
async def client():
    async with httpx.AsyncClient() as c:
        yield c

@pytest.fixture(scope="function")
async def merchant_setup(client):
    """
    Fixture to create a test merchant and AUTOMATICALLY clean it up from:
    1. Core DB (Schema + Merchants table + Domain Events)
    2. Read DB (Schema + Merchants table + Processed Events)
    """
    import time
    unique_suffix = int(time.time() * 1000)
    
    # 1. Create a Merchant via API
    res = await client.post(f"{CORE_URL}/api/merchants", json={
        "name": f"Test Merchant E2E {unique_suffix}",
        "email": f"test-e2e-{unique_suffix}@example.com"
    })
    assert res.status_code == 201
    merchant = res.json()
    merchant_id = merchant["merchant_id"]
    schema_name = merchant["schema_name"]
    
    # Yield the merchant data to the test
    yield merchant
    
    # --- CLEANUP (Mandatory) ---
    print(f"\n[Cleanup] Removing merchant {merchant_id} and schema {schema_name}...")
    
    # 1. Clean Read DB
    try:
        conn_read = psycopg2.connect(READ_DB_URL)
        conn_read.autocommit = True
        with conn_read.cursor() as cur:
            cur.execute(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE;")
            cur.execute("DELETE FROM public.webhook_subscriptions WHERE merchant_id = %s;", (merchant_id,))
            cur.execute("DELETE FROM public.merchants WHERE merchant_id = %s;", (merchant_id,))
        conn_read.close()
    except Exception as e:
        print(f"Warning: Read DB cleanup failed for merchant {merchant_id}: {e}")

    # 2. Clean Core DB
    try:
        conn_core = psycopg2.connect(CORE_DB_URL)
        conn_core.autocommit = True
        with conn_core.cursor() as cur:
            cur.execute(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE;")
            cur.execute("DELETE FROM public.domain_events WHERE merchant_id = %s;", (merchant_id,))
            cur.execute("DELETE FROM public.merchants WHERE merchant_id = %s;", (merchant_id,))
        conn_core.close()
    except Exception as e:
        print(f"Warning: Core DB cleanup failed for merchant {merchant_id}: {e}")
