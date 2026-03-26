# 🏗 Multi-Tenant Event-Driven Payment Gateway Platform

> **Purpose**: This is the single-source-of-truth reference document for the entire system.  
> Refer to this file when building any service, writing any schema, or designing any UI flow.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Docker Compose Services](#5-docker-compose-services)
6. [Multi-Tenancy Model](#6-multi-tenancy-model)
7. [Dynamic Schema Creation Flow](#7-dynamic-schema-creation-flow)
8. [System 1: Payment Core Service (Write)](#8-system-1-payment-core-service-write)
9. [System 2: Connect Service (Event Engine)](#9-system-2-connect-service-event-engine)
10. [System 3: Merchant Dashboard Service (Read)](#10-system-3-merchant-dashboard-service-read)
11. [Event Catalog](#11-event-catalog)
12. [Kafka Message Format](#12-kafka-message-format)
13. [Outbox Worker](#13-outbox-worker)
14. [Webhook System](#14-webhook-system)
15. [Frontend UIs](#15-frontend-uis)
16. [Database Schemas (Complete DDL)](#16-database-schemas-complete-ddl)
17. [Read DB Transformations](#17-read-db-transformations)
18. [End-to-End Flows](#18-end-to-end-flows)
19. [Core Design Principles](#19-core-design-principles)
20. [Verification Checklist](#20-verification-checklist)

---

## 1. Project Overview

We are building a **multi-tenant B2B payment gateway platform** — similar in concept to Stripe or Razorpay — using an event-driven architecture. The system does **not** integrate with real banks; it simulates the payment lifecycle to demonstrate enterprise-grade architecture patterns.

**What makes this project impressive for interviews:**

| Pattern | Implementation |
|---|---|
| CQRS | Separate write DB (System 1) and read DB (System 3) |
| Transactional Outbox | Guarantees zero event loss — domain event + business write in one TX |
| Event Streaming | Kafka/Redpanda distributes changes between systems |
| Multi-Tenant Isolation | Schema-per-merchant in PostgreSQL |
| Webhook Delivery | HMAC-signed HTTP callbacks with exponential backoff retry + DLQ |
| Idempotent Consumers | `processed_events` table prevents duplicates on replay |
| Pre-Aggregated Analytics | Read DB has transformed tables (`daily_revenue`, `payment_method_stats`) |
| Background Workers | Celery + Redis for outbox polling, webhook retries, and async jobs |

---

## 2. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend (all 3 services) | **Python / FastAPI** | Async, fast, auto-generated OpenAPI docs |
| Async DB Driver | **asyncpg** | Native async PostgreSQL driver for Python |
| Async Kafka | **aiokafka** | Async Kafka producer/consumer |
| Background Workers | **Celery** | Outbox worker, webhook retry, async jobs |
| Cache / Queue | **Redis** | Celery broker + result backend |
| Frontend (2 UIs) | **React (Vite)** | Fast dev builds, modern tooling |
| Write Database | **PostgreSQL 16** | Schema-per-tenant, JSONB, `FOR UPDATE SKIP LOCKED` |
| Read Database | **PostgreSQL 16** | Same engine, different data model (transformed) |
| Event Broker | **Redpanda** | Kafka-compatible, no Zookeeper, lightweight for local dev |
| Broker UI | **Redpanda Console** | Visual topic/consumer inspection |
| Containerization | **Docker Compose** | Orchestrates all 11 services |
| HTTP Client (webhooks) | **httpx** | Async HTTP for webhook dispatch |

---

## 3. High-Level Architecture

```
                 ┌──────────────────────────────┐
                 │  Admin Portal (React UI)      │ Port 5173
                 │  System 1 Frontend            │
                 └──────────────┬───────────────┘
                                │ HTTP
                                ▼
                 ┌──────────────────────────────┐
                 │  System 1: Payment Core       │ Port 8001
                 │  FastAPI (Write Service)      │
                 └──────────────┬───────────────┘
                                │
                                ▼
                 ┌──────────────────────────────┐
                 │  Core DB (PostgreSQL)         │ Port 5433
                 │  public.merchants             │
                 │  public.domain_events         │
                 │  merchant_{id}.payments       │
                 │  merchant_{id}.customers      │
                 │  merchant_{id}.refunds        │
                 │  merchant_{id}.ledger_entries  │
                 └──────────────┬───────────────┘
                                │
                 ┌──────────────────────────────┐
                 │  Celery Worker (Outbox)       │
                 │  Polls every 2s via Redis     │◄──── Redis (Port 6379)
                 └──────────────┬───────────────┘
                                │
                                ▼
                 ┌──────────────────────────────┐
                 │  Redpanda (Kafka-compatible)  │ Port 9092
                 │  Topic: payments.events       │ Console: 8080
                 │  Partition Key: merchant_id   │
                 └──────────┬───────────────────┘
                            │
            ┌───────────────┴────────────────┐
            ▼                                ▼
  ┌──────────────────────┐       ┌───────────────────────┐
  │  DB Sync Consumer    │       │  Webhook Consumer     │
  │  (Consumer Group 1)  │       │  (Consumer Group 2)   │
  │  Transform + Upsert  │       │  HMAC Sign + Deliver  │
  └──────────┬───────────┘       └───────────┬───────────┘
             │                               │
             ▼                               ▼
  ┌──────────────────────┐       ┌───────────────────────┐
  │  Read DB (PostgreSQL)│       │  Celery Worker        │
  │  Port 5434           │       │  (Webhook Retry)      │
  │  Transformed Schema  │       │  via Redis            │
  └──────────┬───────────┘       └───────────┬───────────┘
             │                               │
             ▼                               ▼
  ┌──────────────────────┐       ┌───────────────────────┐
  │  System 3: Dashboard │       │  Merchant Backends    │
  │  FastAPI (Read Only) │       │  (External Systems)   │
  │  Port 8003           │       └───────────────────────┘
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │  Merchant Dashboard  │
  │  React UI            │
  │  Port 5174           │
  └──────────────────────┘
```

---

## 4. Monorepo Structure

```
multi-tenant-payment-gateway/
│
├── docker-compose.yml              # All 11 services
├── .env.example                    # Environment template
├── .env                            # Local config (gitignored)
├── .gitignore
├── README.md                       # Quick-start guide
├── ARCHITECTURE.md                 # ← THIS FILE
│
├── services/
│   ├── payment-core-service/       # SYSTEM 1 — Write API + Outbox
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── src/
│   │       ├── main.py             # FastAPI entry
│   │       ├── config.py           # Pydantic Settings
│   │       ├── database.py         # asyncpg pool
│   │       ├── celery_app.py       # Celery instance config
│   │       ├── tasks/
│   │       │   └── outbox_task.py   # Celery beat: poll → Kafka
│   │       ├── routers/
│   │       │   ├── merchants.py
│   │       │   ├── customers.py
│   │       │   ├── payments.py
│   │       │   └── refunds.py
│   │       ├── services/
│   │       │   ├── merchant_service.py
│   │       │   ├── customer_service.py
│   │       │   ├── payment_service.py
│   │       │   └── refund_service.py
│   │       ├── models/
│   │       │   └── schemas.py
│   │       └── utils/
│   │           └── event_emitter.py
│   │
│   ├── connect-service/            # SYSTEM 2 — Event Engine
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── src/
│   │       ├── main.py             # FastAPI + consumer startup
│   │       ├── config.py
│   │       ├── database.py
│   │       ├── celery_app.py       # Celery instance config
│   │       ├── consumers/
│   │       │   ├── db_sync_consumer.py
│   │       │   └── webhook_consumer.py
│   │       ├── tasks/
│   │       │   └── webhook_retry_task.py  # Celery: retry failed webhooks
│   │       ├── services/
│   │       │   ├── sync_service.py
│   │       │   ├── schema_manager.py
│   │       │   └── webhook_service.py
│   │       ├── routers/
│   │       │   └── webhooks.py
│   │       └── utils/
│   │           └── idempotency.py
│   │
│   └── merchant-dashboard-service/ # SYSTEM 3 — Read API
│       ├── Dockerfile
│       ├── requirements.txt
│       └── src/
│           ├── main.py
│           ├── config.py
│           ├── database.py
│           └── routers/
│               ├── payments.py
│               ├── refunds.py
│               ├── customers.py
│               └── analytics.py
│
├── frontends/
│   ├── admin-portal/               # SYSTEM 1 UI
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   └── src/
│   │       ├── App.jsx
│   │       ├── main.jsx
│   │       ├── index.css
│   │       ├── contexts/
│   │       │   └── MerchantContext.jsx
│   │       ├── pages/
│   │       │   ├── MerchantsPage.jsx
│   │       │   ├── CustomersPage.jsx
│   │       │   ├── PaymentsPage.jsx
│   │       │   ├── RefundsPage.jsx
│   │       │   └── EventsLogPage.jsx
│   │       ├── components/
│   │       │   ├── Layout.jsx
│   │       │   ├── MerchantSelector.jsx
│   │       │   ├── MerchantForm.jsx
│   │       │   ├── CustomerForm.jsx
│   │       │   ├── PaymentForm.jsx
│   │       │   ├── PaymentActions.jsx
│   │       │   └── DataTable.jsx
│   │       └── api/
│   │           └── client.js
│   │
│   └── merchant-dashboard/         # SYSTEM 3 UI
│       ├── Dockerfile
│       ├── package.json
│       ├── vite.config.js
│       └── src/
│           ├── App.jsx
│           ├── main.jsx
│           ├── index.css
│           ├── contexts/
│           │   └── MerchantContext.jsx
│           ├── pages/
│           │   ├── DashboardPage.jsx
│           │   ├── PaymentsPage.jsx
│           │   ├── RefundsPage.jsx
│           │   └── CustomersPage.jsx
│           ├── components/
│           │   ├── Layout.jsx
│           │   ├── MerchantSelector.jsx
│           │   ├── StatCard.jsx
│           │   ├── RevenueChart.jsx
│           │   ├── PaymentTable.jsx
│           │   ├── FilterBar.jsx
│           │   └── DataTable.jsx
│           └── api/
│               └── client.js
│
├── infra/
│   ├── postgres/
│   │   ├── init-core-db.sql
│   │   └── init-read-db.sql
│   └── redpanda/
│       └── topic-init.sh
│
└── scripts/
    └── seed.sh
```

---

## 5. Docker Compose Services

| # | Service Name | Image | Host Port | Internal Port | Purpose |
|---|---|---|---|---|---|
| 1 | `core-db` | postgres:16-alpine | 5433 | 5432 | Write database |
| 2 | `read-db` | postgres:16-alpine | 5434 | 5432 | Read database |
| 3 | `redis` | redis:7-alpine | 6379 | 6379 | Celery broker + cache |
| 4 | `redpanda` | redpandadata/redpanda | 9092, 19092 | 9092 | Event broker |
| 5 | `redpanda-console` | redpandadata/console | 8080 | 8080 | Broker web UI |
| 6 | `payment-core-service` | build: ./services/payment-core-service | 8001 | 8001 | System 1 API |
| 7 | `core-celery-worker` | build: ./services/payment-core-service | — | — | Outbox poller (Celery beat + worker) |
| 8 | `connect-service` | build: ./services/connect-service | 8002 | 8002 | System 2 API + consumers |
| 9 | `connect-celery-worker` | build: ./services/connect-service | — | — | Webhook retry worker |
| 10 | `merchant-dashboard-service` | build: ./services/merchant-dashboard-service | 8003 | 8003 | System 3 API |
| 11 | `admin-portal` | build: ./frontends/admin-portal | 5173 | 5173 | System 1 UI |
| 12 | `merchant-dashboard` | build: ./frontends/merchant-dashboard | 5174 | 5174 | System 3 UI |

**Startup Order** (via healthchecks + `depends_on`):
```
core-db, read-db, redis  → pg_isready / redis PING healthcheck
        ↓
redpanda                 → admin API healthcheck
        ↓
payment-core-service     → starts (FastAPI)
core-celery-worker       → starts (outbox beat + worker)
connect-service          → starts (Kafka consumers + FastAPI)
connect-celery-worker    → starts (webhook retry worker)
merchant-dashboard-svc   → starts (connects to read-db)
        ↓
admin-portal             → starts (connects to System 1 API)
merchant-dashboard UI    → starts (connects to System 3 API)
```

---

## 6. Multi-Tenancy Model

Each merchant (tenant) gets its own **PostgreSQL schema**. Data is strictly isolated.

```
┌─────────────────────────────────────────────┐
│                 WRITE DB                     │
│                                             │
│  public.merchants          (registry)       │
│  public.domain_events      (outbox)         │
│                                             │
│  merchant_1.customers                       │
│  merchant_1.payments                        │
│  merchant_1.refunds                         │
│  merchant_1.ledger_entries                  │
│                                             │
│  merchant_2.customers      (totally         │
│  merchant_2.payments        isolated!)      │
│  merchant_2.refunds                         │
│  merchant_2.ledger_entries                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                  READ DB                     │
│                                             │
│  public.processed_events   (idempotency)    │
│  public.webhook_subscriptions               │
│  public.delivery_logs                       │
│  public.dead_letter_queue                   │
│                                             │
│  merchant_1.customers      (+ aggregates)   │
│  merchant_1.payments       (+ denormalized) │
│  merchant_1.refunds        (+ denormalized) │
│  merchant_1.daily_revenue  (pre-aggregated) │
│  merchant_1.payment_method_stats            │
│                                             │
│  merchant_2.* ...                           │
└─────────────────────────────────────────────┘
```

---

## 7. Dynamic Schema Creation Flow

**Nobody manually creates tables.** Everything is automated:

### Step 1: Admin creates merchant via UI
```
Admin Portal → POST /api/merchants { name: "Acme Corp", email: "a@acme.com" }
```

### Step 2: System 1 backend (single transaction)
```sql
BEGIN;
  -- 1. Register merchant
  INSERT INTO public.merchants (name, email, schema_name)
  VALUES ('Acme Corp', 'a@acme.com', 'merchant_1');

  -- 2. Create WRITE schema + tables
  CREATE SCHEMA merchant_1;
  CREATE TABLE merchant_1.customers (...);
  CREATE TABLE merchant_1.payments (...);
  CREATE TABLE merchant_1.refunds (...);
  CREATE TABLE merchant_1.ledger_entries (...);

  -- 3. Emit event via outbox
  INSERT INTO public.domain_events (
    merchant_id, schema_name, event_type, entity_type, entity_id, payload
  ) VALUES (1, 'merchant_1', 'merchant.created.v1', 'merchant', '1', '{...}');
COMMIT;
```

### Step 3: Outbox worker publishes to Kafka
```
Topic: payments.events | Key: 1 | Value: { event_type: "merchant.created.v1", ... }
```

### Step 4: DB Sync Consumer creates READ schema
```sql
-- On receiving merchant.created.v1:
CREATE SCHEMA IF NOT EXISTS merchant_1;
CREATE TABLE merchant_1.customers (... + total_payments, total_spent, last_payment_at);
CREATE TABLE merchant_1.payments (... + customer_name, customer_email);
CREATE TABLE merchant_1.refunds (... + payment_amount, customer_name);
CREATE TABLE merchant_1.daily_revenue (...);
CREATE TABLE merchant_1.payment_method_stats (...);
```

### Result
Both databases are ready. The merchant appears in the UI dropdown.

---

## 8. System 1: Payment Core Service (Write)

### Core Entities

#### Merchant
| Field | Type | Description |
|---|---|---|
| merchant_id | SERIAL PK | Auto-increment ID |
| name | VARCHAR(255) | Business name |
| email | VARCHAR(255) UNIQUE | Contact email |
| schema_name | VARCHAR(100) UNIQUE | DB schema name (e.g. `merchant_1`) |
| api_key | UUID | Generated API key |
| status | VARCHAR(20) | `active` / `suspended` |
| created_at | TIMESTAMPTZ | Registration timestamp |

#### Customer (per-merchant)
| Field | Type | Description |
|---|---|---|
| customer_id | SERIAL PK | Auto-increment |
| name | VARCHAR(255) | Full name |
| email | VARCHAR(255) | Email |
| phone | VARCHAR(50) | Phone number |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### Payment (per-merchant)
| Field | Type | Description |
|---|---|---|
| payment_id | UUID PK | Unique payment ID |
| customer_id | INT FK | References customers |
| amount | DECIMAL(12,2) | Payment amount |
| currency | VARCHAR(3) | Currency code (default: INR) |
| status | VARCHAR(30) | State machine status |
| method | VARCHAR(30) | `card` / `upi` / `netbanking` / `wallet` |
| description | TEXT | Order description |
| metadata | JSONB | Arbitrary merchant key-values |
| failure_reason | VARCHAR(255) | Reason if failed |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### Refund (per-merchant)
| Field | Type | Description |
|---|---|---|
| refund_id | UUID PK | Unique refund ID |
| payment_id | UUID FK | References payments |
| amount | DECIMAL(12,2) | Refund amount (full or partial) |
| reason | TEXT | Refund reason |
| status | VARCHAR(30) | `initiated` / `processed` / `failed` |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### Ledger Entry (per-merchant)
| Field | Type | Description |
|---|---|---|
| ledger_id | SERIAL PK | Auto-increment |
| payment_id | UUID FK | Related payment |
| refund_id | UUID FK | Related refund (nullable) |
| entry_type | VARCHAR(30) | Type of financial entry |
| amount | DECIMAL(12,2) | Entry amount |
| balance_after | DECIMAL(12,2) | Running balance |
| created_at | TIMESTAMPTZ | |

### Payment State Machine

```
┌─────────┐      ┌────────────┐      ┌──────────┐      ┌─────────┐
│ created │─────→│ authorized │─────→│ captured │─────→│ settled │
└─────────┘      └────────────┘      └──────────┘      └─────────┘
     │                  │
     ▼                  ▼
 ┌────────┐      ┌────────────────┐
 │ failed │      │  auth_expired  │
 └────────┘      └────────────────┘
```

Valid transitions:
| From | To | API Action | Event |
|---|---|---|---|
| `created` | `authorized` | `/authorize` | `payment.authorized.v1` |
| `created` | `failed` | `/fail` | `payment.failed.v1` |
| `authorized` | `captured` | `/capture` | `payment.captured.v1` |
| `captured` | `settled` | (auto/manual) | `payment.settled.v1` |

### Refund State Machine

```
┌───────────┐      ┌───────────┐      ┌─────────┐
│ initiated │─────→│ processed │─────→│ settled │
└───────────┘      └───────────┘      └─────────┘
      │
      ▼
  ┌────────┐
  │ failed │
  └────────┘
```

### API Endpoints

| Method | Endpoint | Description | Event |
|---|---|---|---|
| `POST` | `/api/merchants` | Onboard merchant + create schema | `merchant.created.v1` |
| `GET` | `/api/merchants` | List all merchants (for dropdown) | — |
| `GET` | `/api/merchants/{id}` | Get merchant detail | — |
| `POST` | `/api/{mid}/customers` | Create customer | `customer.created.v1` |
| `PUT` | `/api/{mid}/customers/{id}` | Update customer | `customer.updated.v1` |
| `DELETE` | `/api/{mid}/customers/{id}` | Delete customer | `customer.deleted.v1` |
| `GET` | `/api/{mid}/customers` | List customers | — |
| `POST` | `/api/{mid}/payments` | Create payment | `payment.created.v1` |
| `POST` | `/api/{mid}/payments/{id}/authorize` | Authorize | `payment.authorized.v1` |
| `POST` | `/api/{mid}/payments/{id}/capture` | Capture | `payment.captured.v1` |
| `POST` | `/api/{mid}/payments/{id}/fail` | Fail | `payment.failed.v1` |
| `GET` | `/api/{mid}/payments` | List payments | — |
| `POST` | `/api/{mid}/payments/{id}/refund` | Create refund | `refund.initiated.v1` |
| `POST` | `/api/{mid}/refunds/{id}/process` | Process refund | `refund.processed.v1` |
| `GET` | `/api/{mid}/refunds` | List refunds | — |
| `GET` | `/api/events` | View domain_events outbox | — |

### Transactional Write Pattern

Every mutation follows this exact pattern:

```python
async def create_payment(pool, merchant_id, data):
    async with pool.acquire() as conn:
        async with conn.transaction():
            # 1. Write to tenant table
            payment = await conn.fetchrow(
                f"INSERT INTO merchant_{merchant_id}.payments (...) VALUES (...) RETURNING *",
                ...
            )
            # 2. Write domain event (SAME transaction)
            await conn.execute(
                "INSERT INTO public.domain_events (...) VALUES (...)",
                merchant_id, f"merchant_{merchant_id}",
                "payment.created.v1", "payment",
                str(payment["payment_id"]), json.dumps(dict(payment))
            )
            # 3. Insert ledger entry (SAME transaction)
            await conn.execute(
                f"INSERT INTO merchant_{merchant_id}.ledger_entries (...) VALUES (...)"
            )
            # Transaction auto-commits or auto-rollbacks
            return payment
```

---

## 9. System 2: Connect Service (Event Engine)

System 2 runs **two independent Kafka consumer groups** in the same FastAPI process, plus a **webhook subscription management API**.

### Consumer Group 1: DB Sync (`db-sync-group`)

**Purpose**: Transform and sync data from System 1 into System 3's read-optimized schema.

```
For each Kafka message:
  1. Check processed_events → if exists, SKIP (idempotent)
  2. Route by event_type:
     ├─ merchant.created.v1 → Create READ schema + all tables
     ├─ payment.created.v1  → Upsert payment + update aggregates
     ├─ payment.captured.v1 → Update status + recalculate stats
     ├─ payment.failed.v1   → Update status + increment failure counts
     ├─ refund.initiated.v1 → Insert refund + adjust revenue
     ├─ customer.created.v1 → Insert customer
     ├─ customer.updated.v1 → Update customer + cascade denormalized fields
     └─ customer.deleted.v1 → Delete customer
  3. INSERT into processed_events
  4. Commit Kafka offset
```

### Consumer Group 2: Webhook Delivery (`webhook-delivery-group`)

**Purpose**: Deliver HMAC-signed webhooks to external merchant systems.

```
For each Kafka message:
  1. Query webhook_subscriptions WHERE merchant_id AND event_type matches AND active = true
  2. For each matching subscription:
     a. Build JSON payload
     b. Sign: HMAC-SHA256(subscription.secret, payload)
     c. POST to subscription.url with headers:
        - X-Webhook-Signature: sha256=<sig>
        - X-Webhook-Event: <event_type>
        - X-Webhook-Id: <event_id>
     d. Log to delivery_logs
  3. Handle response:
     - 2xx → mark success
     - 4xx → disable webhook (active = false)
     - 5xx / timeout → schedule retry
```

### Webhook Management API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/webhooks` | Register subscription |
| `GET` | `/api/webhooks?merchant_id=` | List subscriptions |
| `GET` | `/api/webhooks/{id}` | Subscription detail |
| `PUT` | `/api/webhooks/{id}` | Update (URL, events) |
| `DELETE` | `/api/webhooks/{id}` | Remove subscription |
| `GET` | `/api/webhooks/{id}/logs` | Delivery logs |
| `GET` | `/api/webhooks/dlq?merchant_id=` | Dead letter queue |
| `POST` | `/api/webhooks/dlq/{id}/retry` | Retry DLQ entry |

---

## 10. System 3: Merchant Dashboard Service (Read)

**Strictly read-only.** Connects to `read-db` only. Only System 2 writes to this DB.

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/merchants` | List merchants (for dropdown — reads public.merchants mirror) |
| `GET` | `/api/{mid}/payments` | Payments with filters (see below) |
| `GET` | `/api/{mid}/payments/{id}` | Payment detail |
| `GET` | `/api/{mid}/refunds` | List refunds |
| `GET` | `/api/{mid}/customers` | Customers with aggregated stats |
| `GET` | `/api/{mid}/customers/{id}` | Customer detail |
| `GET` | `/api/{mid}/analytics/summary` | Total revenue, count, success rate |
| `GET` | `/api/{mid}/analytics/daily` | Daily revenue breakdown |
| `GET` | `/api/{mid}/analytics/methods` | Payment method distribution |

### Payment Query Filters

| Parameter | Type | Example |
|---|---|---|
| `status` | string | `?status=captured` |
| `method` | string | `?method=upi` |
| `from` | date | `?from=2026-03-01` |
| `to` | date | `?to=2026-03-31` |
| `customer_id` | int | `?customer_id=42` |
| `min_amount` | decimal | `?min_amount=1000` |
| `max_amount` | decimal | `?max_amount=5000` |
| `page` | int | `?page=2` |
| `limit` | int | `?limit=25` (max 100) |

---

## 11. Event Catalog

| Event Type | Entity | Trigger | Payload |
|---|---|---|---|
| `merchant.created.v1` | merchant | Merchant onboarded | Full merchant object |
| `customer.created.v1` | customer | New customer added | Full customer object |
| `customer.updated.v1` | customer | Customer edited | Full customer snapshot |
| `customer.deleted.v1` | customer | Customer removed | `{ customer_id }` |
| `payment.created.v1` | payment | Payment initiated | Full payment object |
| `payment.authorized.v1` | payment | Authorization success | Full payment snapshot |
| `payment.captured.v1` | payment | Amount captured | Full payment snapshot |
| `payment.failed.v1` | payment | Payment failed | Full payment + failure_reason |
| `payment.settled.v1` | payment | Funds settled | Full payment snapshot |
| `refund.initiated.v1` | refund | Refund requested | Full refund + payment_id |
| `refund.processed.v1` | refund | Refund processed | Full refund snapshot |
| `refund.failed.v1` | refund | Refund failed | Full refund snapshot |

---

## 12. Kafka Message Format

```json
{
  "event_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "merchant_id": 1,
  "schema_name": "merchant_1",
  "event_type": "payment.captured.v1",
  "entity_type": "payment",
  "entity_id": "pay_f8e7d6c5-abcd-1234-5678-ef9012345678",
  "payload": {
    "payment_id": "pay_f8e7d6c5-abcd-1234-5678-ef9012345678",
    "customer_id": 42,
    "amount": 1500.00,
    "currency": "INR",
    "status": "captured",
    "method": "upi",
    "description": "Order #12345",
    "metadata": { "order_id": "12345" },
    "created_at": "2026-03-26T16:00:00Z",
    "updated_at": "2026-03-26T16:01:30Z"
  },
  "created_at": "2026-03-26T16:01:30Z"
}
```

**Kafka Config:**
- Topic: `payments.events`
- Partition Key: `merchant_id` (ensures ordering per merchant)
- Guarantees: Order within each merchant, parallel across merchants

---

## 13. Outbox Worker

Runs as a **Celery Beat** scheduled task inside `core-celery-worker` container.

Celery Beat schedules this task every 2 seconds. The worker picks it up and publishes to Kafka.

```python
# tasks/outbox_task.py
from celery_app import celery
import psycopg2, json
from aiokafka import AIOKafkaProducer

@celery.task(name='outbox.publish_pending_events')
def publish_pending_events():
    """Celery task: poll domain_events → publish to Kafka"""
    conn = psycopg2.connect(CORE_DB_URL)
    cur = conn.cursor()

    # 1. Fetch pending events with row locking
    cur.execute("""
        SELECT * FROM public.domain_events
        WHERE status = 'pending'
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 50
    """)
    events = cur.fetchall()

    producer = KafkaProducer(bootstrap_servers=KAFKA_BROKERS)

    for event in events:
        try:
            # 2. Publish to Kafka
            producer.send(
                topic='payments.events',
                key=str(event['merchant_id']).encode(),
                value=json.dumps(event).encode()
            )
            # 3. Mark as published
            cur.execute(
                "UPDATE public.domain_events SET status = 'published' WHERE event_id = %s",
                (event['event_id'],)
            )
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f'Outbox publish failed: {e}')
            # Event stays 'pending', retried next beat

    producer.close()
    conn.close()

# Celery Beat Schedule (in celery_app.py)
celery.conf.beat_schedule = {
    'outbox-poll': {
        'task': 'outbox.publish_pending_events',
        'schedule': 2.0,  # every 2 seconds
    },
}
```

---

## 14. Webhook System

### HMAC Signature Generation

```python
import hmac, hashlib, json

def sign_payload(secret: str, payload: dict) -> str:
    payload_bytes = json.dumps(payload, sort_keys=True).encode()
    signature = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
    return f"sha256={signature}"
```

### Webhook HTTP Headers

```
POST https://merchant-backend.com/webhook
Content-Type: application/json
X-Webhook-Id: <event_id>
X-Webhook-Event: payment.captured.v1
X-Webhook-Signature: sha256=abc123def456...
X-Webhook-Timestamp: 2026-03-26T16:01:30Z
```

### Retry Schedule

| Attempt | Delay | Total Elapsed | Action on Failure |
|---|---|---|---|
| 1 | Immediate | 0 | Retry |
| 2 | 30 seconds | 30s | Retry |
| 3 | 5 minutes | ~5.5 min | Retry |
| 4 | 30 minutes | ~35.5 min | Retry |
| 5 | 2 hours | ~2.5 hours | Retry |
| 6 | 24 hours | ~26.5 hours | **Move to DLQ** |

### Response Handling

| HTTP Status | Action |
|---|---|
| 2xx | Mark success, log it |
| 4xx | Disable webhook (`active = false`), log it |
| 5xx / timeout | Schedule retry with backoff |

---

## 15. Frontend UIs

### Global Merchant Selector (Both UIs)

Both the Admin Portal and Merchant Dashboard have a **global merchant dropdown** in the top navigation bar.

```
┌─────────────────────────────────────────────────────────┐
│  🏦 PaymentGateway    [ Select Merchant ▼ (Acme Corp) ] │
│─────────────────────────────────────────────────────────│
│                                                         │
│  SIDEBAR          MAIN CONTENT                          │
│  ┌────────┐      ┌─────────────────────┐               │
│  │ Menu   │      │ (Scoped to selected │               │
│  │ Items  │      │  merchant only)     │               │
│  └────────┘      └─────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

**Rules:**
1. Dropdown fetches from `GET /api/merchants`
2. Until a merchant is selected, all data pages show "Select a merchant to continue"
3. Once selected, the `merchant_id` is stored in React Context
4. All API calls automatically include the selected `merchant_id` in the URL path
5. Switching merchant reloads the page data

### Admin Portal (System 1 UI) — Port 5173

| Page | Features |
|---|---|
| **Merchants** | List all, Create new (form: name, email). This is the ONLY page that works without selecting a merchant first. |
| **Customers** | List (for selected merchant), Create, Edit, Delete |
| **Payments** | List (for selected merchant), Create (select customer, amount, method), Action buttons (Authorize, Capture, Fail, Refund) |
| **Refunds** | List (for selected merchant), Process button |
| **Events Log** | Read-only table showing `public.domain_events` with status badges (pending/published) |

### Merchant Dashboard (System 3 UI) — Port 5174

| Page | Features |
|---|---|
| **Dashboard** | Stat cards (Total Revenue, Payment Count, Success Rate, Total Refunds), Daily Revenue chart, Payment Method breakdown |
| **Payments** | Filterable/sortable table (status, method, date range, amount range, pagination). Each row shows customer_name without JOIN. |
| **Refunds** | Table with payment_amount and customer_name denormalized |
| **Customers** | Table with total_payments, total_spent, last_payment_at aggregated |

---

## 16. Database Schemas (Complete DDL)

### Core DB (Write) — `init-core-db.sql`

```sql
-- =============================================
-- PUBLIC SCHEMA (shared across all merchants)
-- =============================================

CREATE TABLE public.merchants (
    merchant_id     SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    schema_name     VARCHAR(100) UNIQUE NOT NULL,
    api_key         UUID DEFAULT gen_random_uuid(),
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.domain_events (
    event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     INT NOT NULL REFERENCES public.merchants(merchant_id),
    schema_name     VARCHAR(100) NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       VARCHAR(100) NOT NULL,
    payload         JSONB NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_domain_events_pending
    ON public.domain_events(status, created_at)
    WHERE status = 'pending';
```

### Per-Merchant Write Schema (created dynamically)

```sql
-- Template: replace {id} with actual merchant_id
CREATE SCHEMA merchant_{id};

CREATE TABLE merchant_{id}.customers (
    customer_id   SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255),
    phone         VARCHAR(50),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE merchant_{id}.payments (
    payment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   INT NOT NULL REFERENCES merchant_{id}.customers(customer_id),
    amount        DECIMAL(12,2) NOT NULL,
    currency      VARCHAR(3) DEFAULT 'INR',
    status        VARCHAR(30) DEFAULT 'created',
    method        VARCHAR(30) NOT NULL,
    description   TEXT,
    metadata      JSONB DEFAULT '{}',
    failure_reason VARCHAR(255),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE merchant_{id}.refunds (
    refund_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id    UUID NOT NULL REFERENCES merchant_{id}.payments(payment_id),
    amount        DECIMAL(12,2) NOT NULL,
    reason        TEXT,
    status        VARCHAR(30) DEFAULT 'initiated',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE merchant_{id}.ledger_entries (
    ledger_id     SERIAL PRIMARY KEY,
    payment_id    UUID REFERENCES merchant_{id}.payments(payment_id),
    refund_id     UUID REFERENCES merchant_{id}.refunds(refund_id),
    entry_type    VARCHAR(30) NOT NULL,
    amount        DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Read DB — `init-read-db.sql`

```sql
-- =============================================
-- PUBLIC SCHEMA (shared utilities)
-- =============================================

CREATE TABLE public.processed_events (
    event_id     UUID PRIMARY KEY,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.webhook_subscriptions (
    subscription_id  SERIAL PRIMARY KEY,
    merchant_id      INT NOT NULL,
    url              VARCHAR(500) NOT NULL,
    event_types      TEXT[] NOT NULL,
    secret           VARCHAR(255) NOT NULL,
    active           BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.delivery_logs (
    log_id           SERIAL PRIMARY KEY,
    subscription_id  INT NOT NULL REFERENCES public.webhook_subscriptions(subscription_id),
    event_id         UUID NOT NULL,
    attempt          INT NOT NULL,
    status_code      INT,
    response_body    TEXT,
    success          BOOLEAN NOT NULL,
    next_retry_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.dead_letter_queue (
    dlq_id           SERIAL PRIMARY KEY,
    subscription_id  INT NOT NULL REFERENCES public.webhook_subscriptions(subscription_id),
    event_id         UUID NOT NULL,
    payload          JSONB NOT NULL,
    failure_reason   TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### Per-Merchant Read Schema (created by DB Sync Consumer)

```sql
-- Template: created when merchant.created.v1 event is consumed
CREATE SCHEMA merchant_{id};

-- Customers with precomputed aggregates
CREATE TABLE merchant_{id}.customers (
    customer_id     INT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(50),
    total_payments  INT DEFAULT 0,
    total_spent     DECIMAL(12,2) DEFAULT 0,
    last_payment_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ
);

-- Payments with denormalized customer info (no JOINs for UI)
CREATE TABLE merchant_{id}.payments (
    payment_id      UUID PRIMARY KEY,
    customer_id     INT NOT NULL,
    customer_name   VARCHAR(255),
    customer_email  VARCHAR(255),
    amount          DECIMAL(12,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'INR',
    status          VARCHAR(30),
    method          VARCHAR(30),
    description     TEXT,
    failure_reason  VARCHAR(255),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ
);
CREATE INDEX idx_payments_status ON merchant_{id}.payments(status);
CREATE INDEX idx_payments_date ON merchant_{id}.payments(created_at);
CREATE INDEX idx_payments_method ON merchant_{id}.payments(method);
CREATE INDEX idx_payments_customer ON merchant_{id}.payments(customer_id);

-- Refunds with denormalized context
CREATE TABLE merchant_{id}.refunds (
    refund_id       UUID PRIMARY KEY,
    payment_id      UUID NOT NULL,
    payment_amount  DECIMAL(12,2),
    customer_name   VARCHAR(255),
    amount          DECIMAL(12,2) NOT NULL,
    reason          TEXT,
    status          VARCHAR(30),
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ
);

-- Pre-aggregated daily revenue (dashboard chart)
CREATE TABLE merchant_{id}.daily_revenue (
    date            DATE PRIMARY KEY,
    total_amount    DECIMAL(12,2) DEFAULT 0,
    payment_count   INT DEFAULT 0,
    success_count   INT DEFAULT 0,
    failed_count    INT DEFAULT 0,
    refund_amount   DECIMAL(12,2) DEFAULT 0,
    net_revenue     DECIMAL(12,2) DEFAULT 0
);

-- Pre-aggregated payment method stats
CREATE TABLE merchant_{id}.payment_method_stats (
    method          VARCHAR(30) PRIMARY KEY,
    total_amount    DECIMAL(12,2) DEFAULT 0,
    count           INT DEFAULT 0,
    success_count   INT DEFAULT 0,
    success_rate    DECIMAL(5,2) DEFAULT 0
);
```

---

## 17. Read DB Transformations

The DB Sync Consumer does NOT simply copy data. It **transforms** it.

### Transformation Matrix

| Event | Sync Operations |
|---|---|
| `merchant.created.v1` | Create entire read schema + 5 tables |
| `customer.created.v1` | INSERT customer with defaults (total_payments=0, total_spent=0) |
| `customer.updated.v1` | UPDATE customer fields + CASCADE `customer_name` to all payments and refunds |
| `customer.deleted.v1` | DELETE customer |
| `payment.created.v1` | 1. UPSERT payment with `customer_name`, `customer_email` (looked up from customers table)<br>2. UPSERT `daily_revenue` row for payment date (+1 payment_count, +amount)<br>3. UPSERT `payment_method_stats` (+1 count, +amount)<br>4. UPDATE customer `total_payments += 1` |
| `payment.authorized.v1` | UPDATE payment status only |
| `payment.captured.v1` | 1. UPDATE payment status<br>2. UPDATE `daily_revenue.success_count += 1`<br>3. UPDATE `payment_method_stats.success_count += 1`, recalc `success_rate`<br>4. UPDATE customer `total_spent += amount`, `last_payment_at = NOW()` |
| `payment.failed.v1` | 1. UPDATE payment status + failure_reason<br>2. UPDATE `daily_revenue.failed_count += 1`<br>3. Recalc `payment_method_stats.success_rate` |
| `refund.initiated.v1` | 1. INSERT refund with `payment_amount` + `customer_name` (looked up)<br>2. UPDATE `daily_revenue.refund_amount += refund_amount`<br>3. Recalc `daily_revenue.net_revenue`<br>4. UPDATE customer `total_spent -= refund_amount` |
| `refund.processed.v1` | UPDATE refund status |

---

## 18. End-to-End Flows

### Flow 1: Complete Payment Journey

```
User Action                  System 1 (Write)              Kafka           System 2 (Connect)              System 3 (Read)
───────────                  ────────────────              ─────           ──────────────────              ───────────────
1. Create Merchant           INSERT merchant               →               Create read schema              Merchant in dropdown
                             CREATE SCHEMA                 merchant.       +5 tables in read DB
                             +4 tables in write DB         created.v1

2. Select Merchant           (UI only — sets context)

3. Create Customer           INSERT customer               →               INSERT customer                 Customer visible
                                                          customer.       (total_payments=0)
                                                          created.v1

4. Create Payment            INSERT payment (status:       →               UPSERT payment +               Payment visible
   (₹1500, UPI)             created)                      payment.        customer_name.                  (status: created)
                             INSERT ledger_entry           created.v1      UPDATE daily_revenue.
                                                                          UPDATE method_stats.
                                                                          UPDATE customer.total_payments

5. Authorize Payment         UPDATE status →               →               UPDATE payment status           Status: authorized
                             authorized                    payment.
                                                          authorized.v1

6. Capture Payment           UPDATE status →               →               UPDATE payment status.          Status: captured
                             captured                      payment.        UPDATE daily_revenue             Dashboard: ₹1500
                             INSERT ledger_entry           captured.v1     .success_count.                 revenue updated
                                                                          UPDATE method_stats.
                                                                          UPDATE customer
                                                                          .total_spent +=1500

7. Refund ₹500               INSERT refund                 →               INSERT refund +                 Refund visible
                             INSERT ledger_entry           refund.         payment_amount +                Dashboard: revenue
                                                          initiated.v1    customer_name.                  adjusted
                                                                          UPDATE daily_revenue
                                                                          .refund_amount.
                                                                          UPDATE customer
                                                                          .total_spent -=500
```

### Flow 2: Webhook Delivery

```
1. Merchant registers webhook:
   POST /api/webhooks { merchant_id: 1, url: "https://acme.com/hook", event_types: ["payment.captured.v1"], secret: "whsec_abc" }

2. Payment is captured → event published to Kafka

3. Webhook Consumer picks up event:
   → Finds matching subscription
   → Builds payload
   → Signs with HMAC-SHA256
   → POST https://acme.com/hook

4. If 2xx → log success
   If 5xx → retry at T+30s, T+5m, T+30m, T+2h, T+24h
   If 4xx → disable webhook
   After 6 failures → move to DLQ
```

---

## 19. Core Design Principles

| # | Principle | Implementation |
|---|---|---|
| 1 | **Source of Truth** | Only System 1 owns data. System 3 is a projection. |
| 2 | **Event-Driven** | All inter-system communication via Kafka events. No direct DB sharing. |
| 3 | **Loose Coupling** | Each system can be deployed, scaled, and restarted independently. |
| 4 | **Transactional Outbox** | Domain event + business write commit atomically. Zero event loss. |
| 5 | **Idempotency** | `processed_events` table + `ON CONFLICT` upserts. Safe to replay. |
| 6 | **Eventual Consistency** | Read system may lag by 2-5 seconds. Acceptable for dashboards. |
| 7 | **Multi-Tenant Isolation** | Schema-per-merchant. No data leaks. No shared tables per tenant. |
| 8 | **CQRS** | Write model (normalized, ledger) vs Read model (denormalized, pre-aggregated). |

---

## 20. Verification Checklist

- [ ] `docker compose up --build -d` — all 9 containers healthy
- [ ] Create merchant in Admin Portal → schema exists in both DBs
- [ ] Merchant appears in dropdown on both UIs
- [ ] Create customer → visible in System 3 after ~5s
- [ ] Create payment → authorize → capture → full journey in System 3
- [ ] Refund payment → dashboard revenue adjusts
- [ ] Second merchant → data strictly isolated
- [ ] Replay Kafka message → no duplicate in read DB
- [ ] Register webhook → fire event → delivery logged
- [ ] Bad webhook URL → retries → lands in DLQ
- [ ] Redpanda Console shows topics, messages, consumer lag
- [ ] Events Log page shows outbox with pending/published status
