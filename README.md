<div align="center">

# ⚡ Multi-Tenant Event-Driven Payment Gateway

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&pause=1000&color=6366F1&center=true&vCenter=true&width=600&lines=CQRS+%2B+Transactional+Outbox+Pattern;Schema-Per-Tenant+Isolation;Kafka+Event+Streaming;Automated+E2E+Smoke+Testing;Production-Grade+Microservices" alt="Typing SVG" />

<br />

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Redpanda](https://img.shields.io/badge/Redpanda-Kafka--Compatible-E50695?style=for-the-badge&logo=apachekafka&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Celery](https://img.shields.io/badge/Celery-Workers-37814A?style=for-the-badge&logo=celery&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

<br/>

> A **production-grade multi-tenant B2B payment gateway** — built from scratch to demonstrate enterprise-level backend engineering.
> Designed with **CQRS**, **Transactional Outbox**, **Schema-per-Tenant isolation**, **real-time Kafka event streaming**,
> **HMAC-signed webhooks**, **OAuth 2.0 Security**, and a **self-monitoring E2E health system**.

<br/>

[🚀 Quick Start](#-quick-start) · [🏗 Architecture](#-architecture) · [📦 Services](#-services--ports) · [🖥 Platform Monitor](#-platform-monitor) · [🧪 Testing](#-testing) · [📮 Postman](#-postman-collections)

</div>

---

## 🧩 Why This Project?

Most "payment gateway" projects are CRUD APIs. This one is different.

This platform replicates real-world patterns used by companies like **Stripe**, **Razorpay**, and **Adyen** — without integrating with actual banks. The goal is to showcase how **enterprise backend engineering** works at scale:

| 🏆 Pattern | ✅ How It's Done Here |
|---|---|
| **CQRS** | System 1 is the write side. System 3 is a completely separate read projection. No shared DB. |
| **Transactional Outbox** | Domain events are written in the same database transaction as the business record. Zero event loss, ever. |
| **Event Streaming** | All inter-system communication flows through Redpanda (Kafka-compatible). No direct service calls. |
| **Multi-Tenancy** | PostgreSQL schema-per-merchant. Complete data isolation. `merchant_1.*`, `merchant_2.*`, etc. |
| **Idempotent Consumers** | `processed_events` table + `ON CONFLICT` upserts prevent phantom duplicates on replay. |
| **PostgreSQL Streaming Replication** | A `core-db-replica` serves heavy analytical Bulk API read loads to avoid degrading primary DB write operations. |
| **Gateway Security (OAuth 2.0)** | System 2 acts as a fully secure Gateway utilizing OAuth 2.0 Client Credentials flow, granular scopes, and token verification. |
| **Webhook Delivery** | HMAC-SHA256 signed HTTP callbacks. Exponential backoff. Dead Letter Queue with manual retry. |
| **Rate Limiting & Middlewares** | Redis-based token bucket rate limiting on API endpoints, and global request IDs tracking for comprehensive distributed tracing. |
| **Self-Monitoring** | A dedicated Platform Monitor runs automated E2E smoke tests and persists health history in Redis. |

---

## 🏗 Architecture

### High-Level System Design

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                          WRITE SIDE  (System 1)                             ║
║                                                                              ║
║   ┌─────────────────┐   HTTP    ┌──────────────────────────────┐            ║
║   │  Admin Portal   │ ────────► │  Payment Core Service        │  Port 8001 ║
║   │  React UI       │           │  FastAPI (Write API)         │            ║
║   │  Port 5173      │           └──────────────┬───────────────┘            ║
║   └─────────────────┘                          │  SAME TRANSACTION          ║
║                                                ▼                            ║
║                              ┌─────────────────────────────────┐            ║
║                              │  Core DB (WAL Streaming)        │            ║
║                              │  ├─ public.merchants            │ ────────   ║
║                              │  ├─ public.domain_events        │        │   ║
║                              │  ├─ merchant_1.payments         │        │   ║
║                              └───────────────┬─────────────────┘        │   ║
╚══════════════════════════════════════════════│══════════════════════════│═══╝
                                               │ Polled 2s                ▼
                                               ▼                    ┌──────────────┐
                               ┌───────────────────────────────┐    │ Core Replica │
                               │     Redis  (Port 6379)        │    │ Read-Only    │
                               │     Celery Broker + Cache     │    │ Bulk API     │
                               └───────────────────────────────┘    └──────────────┘
                                               │
                                               ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                         EVENT BUS  (Redpanda)                               ║
║                                                                              ║
║              Topic: payments.events  │  Partition Key: merchant_id          ║
╚═══════════════════════════╦════════════════════╦════════════════════════════╝
                            │                    │
            Consumer Group 1│                    │Consumer Group 2
                            ▼                    ▼
            ┌────────────────────┐    ┌─────────────────────────┐
            │  DB Sync Consumer  │    │  Webhook Consumer       │
            │  Transform+Upsert  │    │  HMAC Sign + HTTP POST  │
            └─────────┬──────────┘    └──────────┬──────────────┘
                      │                          │
                      ▼                          ▼
╔═════════════════════╧═══════════╗   ┌─────────────────────────┐
║      READ SIDE  (System 3)      ║   │  Celery Retry Worker    │
║                                 ║   │  Exponential Backoff    │
║  ┌───────────────────────────┐  ║   │  Up to 6 retries → DLQ  │
║  │  Read DB  (PostgreSQL)    │  ║   └─────────────────────────┘
║  │  :5434                    │  ║
║  │  ├─ public.processed_events│  ║  ╔══════════════════════════════════╗
║  │  ├─ merchant_1.payments   │  ║  ║      CONNECT GATEWAY (System 2)  ║
║  │  └─ merchant_1.daily_rev  │  ║  ║   OAuth 2.0, Webhook Settings,   ║
║  └──────────────┬─────────────┘  ║  ║   Bulk APIs, Consumer Control    ║
╚═════════════════│═════════════════╝  ╚══════════════════════════════════╝
                  │
                  ▼
   ┌──────────────────────────────────┐        ┌────────────────────────────┐
   │  Dashboard Service  (Port 8003) │        │  Connect Admin UI  (5175)  │
   │  FastAPI  (Strictly Read-Only)  │        └────────────────────────────┘
   │         │                        │
   │         ▼                        │
   │  Merchant Dashboard UI (5174)   │
   └──────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════════╗
║                     OBSERVABILITY  (System 4)                               ║
║                                                                              ║
║   Platform Monitor  (Port 5176)                                             ║
║   ├─ Health checks every 5 minutes (7+ components, latency tracking)        ║
║   ├─ Automated E2E Smoke Test every 1 hour (full payment lifecycle)         ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

### 💳 Payment State Machine

```
              ┌─────────┐
  POST /pay → │ pending │
              └────┬────┘
                   │  POST /authorize
                   ▼
          ┌────────────────┐
          │  authorized    │
          └────┬───────────┘
               │  POST /capture
               ▼
          ┌──────────┐         ┌──────────────┐
          │ captured │ ──────► │   settled    │
          └──────────┘         └──────────────┘
               │
               ▼  (partial or full)
          ┌──────────────┐    ┌───────────┐    ┌─────────┐
          │  initiated   │ ─► │ processed │ ─► │ settled │
          │  (refund)    │    └───────────┘    └─────────┘
          └──────────────┘
```

---

### 🌐 Dynamic Schema — How Multi-Tenancy Works

When a merchant is created, three things happen **atomically in one database transaction**:

```
POST /api/merchants { "name": "Acme Corp", "email": "acme@example.com" }
          │
          └─► BEGIN;
                  1. INSERT INTO public.merchants → gets merchant_id = 7
                  2. CREATE SCHEMA merchant_7
                  3. CREATE TABLE merchant_7.customers  (...)
                  4. CREATE TABLE merchant_7.payments   (...)
                  5. CREATE TABLE merchant_7.refunds    (...)
                  6. CREATE TABLE merchant_7.ledger_entries (...)
                  7. INSERT INTO public.domain_events  ← Outbox record
              COMMIT;
          │
          └─► Celery picks up domain_events → publishes to Kafka
                  │
                  └─► DB Sync Consumer receives merchant.created.v1
                          └─► Creates merchant_7.* schema in READ DB too
```

Both databases are ready in seconds. The merchant instantly appears in all dropdowns across both UIs.

---

## 🛠 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Backend Framework** | FastAPI | Async, type-safe, auto-generated OpenAPI docs |
| **Async DB Driver** | asyncpg | Native async PostgreSQL — fastest available |
| **Sync DB Driver** | psycopg2 | Used by Celery tasks (sync context) |
| **Background Jobs** | Celery 5.x | Outbox poller, webhook retry, async tasks |
| **Task Scheduler** | Celery Beat | Schedules outbox polling every 2 seconds |
| **Event Broker** | Redpanda | Kafka-compatible streaming engine, optimized for speed |
| **Cache / Queue** | Redis 7 | Celery broker + monitoring history store + Rate Limiting |
| **Databases** | PostgreSQL 16 | Schema-per-tenant, Native Streaming Replication, JSONB |
| **Frontend UI** | React + Vite | Fast HMR, modern build tooling, Error Boundaries |
| **Security** | OAuth 2.0 | Client Credentials flow for Third-Party integrations |
| **Metrics** | Prometheus | Native Python metrics exposure across nodes |
| **Containerization** | Docker Compose | One-command full stack orchestration |

---

## 📦 Services & Ports

| # | Container | Port | Role |
|---|---|---|---|
| 1 | `core-db` | **5433** | PostgreSQL — Write database (schema-per-tenant) |
| 2 | `core-db-replica`| **5435** | PostgreSQL — Replica for fast read streaming |
| 3 | `read-db` | **5434** | PostgreSQL — Read database (transformed, aggregated) |
| 4 | `redis` | **6379** | Celery broker + monitoring history + rate limits |
| 5 | `redpanda` | **19092** | Kafka-compatible event broker |
| 6 | `redpanda-console`| **8080** | Redpanda web UI (topics, consumers, lag) |
| 7 | `topic-init` | — | One-shot: creates `payments.events` topic |
| 8 | `payment-core-service` | **8001** | System 1 — Write API + `/metrics` |
| 9 | `core-celery-worker` | — | Celery Beat — Outbox poller (every 2s) |
| 10 | `connect-service` | **8002** | System 2 — Event Engine, Webhook API, Bulk API, OAuth 2.0 Gateway |
| 11 | `connect-celery-worker`| — | Webhook retry worker (exponential backoff) |
| 12 | `merchant-dashboard-service`| **8003** | System 3 — Read-only analytics API |
| 13 | `admin-portal` | **5173** | React UI — Top-level system config & payments |
| 14 | `merchant-dashboard` | **5174** | React UI — Analytics & reporting per-merchant |
| 15 | `connect-gateway-admin` | **5175** | React UI — Manage third-party consumers and webhooks |
| 16 | `platform-monitor` | **5176** | System 4 — Health dashboard + E2E tests + logging metrics |

---

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** v24+ with at least **8 GB RAM** allocated
- **Git**

### Step 1 — Clone

```bash
git clone https://github.com/your-username/multi-tenant-payment-gateway.git
cd multi-tenant-payment-gateway
```

### Step 2 — Configure Environment

```bash
cp .env.example .env
# The defaults work out of the box.
```

### Step 3 — Launch Everything

```bash
docker compose up --build -d
```

Wait ~30 seconds for all services to initialise. Verify they're healthy:

```bash
docker compose ps
# All containers should show: healthy or running
```

### Step 4 — Access the Platform

| 🌐 Interface | 🔗 URL | 🔑 Required Login? |
|---|---|---|
| **Admin Portal** | http://localhost:5173 | No |
| **Merchant Dashboard** | http://localhost:5174 | No |
| **Connect Gateway Admin**| http://localhost:5175 | Yes (Default key: `dev-admin-key-change-in-production`) |
| **Platform Monitor** | http://localhost:5176 | No |
| **System 1 API Docs** | http://localhost:8001/docs | — |
| **System 2 API Docs** | http://localhost:8002/docs | — |
| **System 3 API Docs** | http://localhost:8003/docs | — |
| **Redpanda Console** | http://localhost:8080 | — |

### Step 5 — Create a Merchant & Run Payments

```bash
# 1. Create Merchant
curl -X POST http://localhost:8001/api/merchants \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "email": "acme@example.com"}'

# -> Save returned 'api_key'

# 2. Create Customer
curl -X POST http://localhost:8001/api/1/customers \
  -H "X-API-Key: $YOUR_API_KEY" -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@doe.com", "phone": "9999999999"}'

# 3. Create & Process Payment
curl -X POST http://localhost:8001/api/1/payments \
  -H "X-API-Key: $YOUR_API_KEY" -H "Content-Type: application/json" \
  -d '{"customer_id": 1, "amount": 1500.00, "currency": "INR", "method": "upi", "description": "Order #001"}'

# Authorize -> Capture (Use newly created PAYMENT_ID)
curl -X POST http://localhost:8001/api/1/payments/$PAYMENT_ID/authorize -H "X-API-Key: $YOUR_API_KEY"
curl -X POST http://localhost:8001/api/1/payments/$PAYMENT_ID/capture  -H "X-API-Key: $YOUR_API_KEY"
```

### Stop / Reset

```bash
docker compose down
# Full reset — removes all volumes/data
docker compose down -v
```

---

## 📡 API Reference

> Interactive OpenAPI docs: http://localhost:8001/docs · http://localhost:8002/docs · http://localhost:8003/docs

### 🔑 Authentication Basics

- **System 1 & 3 (Internal):** Use `X-API-Key` assigned to Merchants.
- **System 2 (Third Party):** Use OAuth 2.0 Access Token via `Authorization: Bearer <Token>`.
- **Admin Endpoints:** Use `X-Admin-Key` from environment configuration.

---

<details>
<summary>📋 <strong>System 1 — Merchants & Internal Operations</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/merchants` | Onboard merchant + create DB schemas |
| `GET` | `/api/merchants` | List all merchants |
| `POST` | `/api/{mid}/customers` | Create customer |
| `POST` | `/api/{mid}/payments` | Create payment (`pending`) |
| `POST` | `/api/{mid}/payments/{id}/authorize` | Authorize payment |
| `POST` | `/api/{mid}/payments/{id}/capture`| Capture payment |
| `POST` | `/api/{mid}/payments/{id}/refund` | Refund payment |

</details>

<details>
<summary>🛡 <strong>System 2 — Connect Gateway (OAuth 2.0 & Webhooks)</strong></summary>

| Method | Endpoint | Security | Description |
|---|---|---|---|
| `POST` | `/api/v1/oauth/token` | Client Credentials | Retrieve Bearer Token for Third-Party API hits |
| `POST` | `/api/v1/third-party/webhooks` | Bearer Token (`manage`) | Register a webhook endpoint |
| `GET` | `/api/v1/third-party/webhooks` | Bearer Token | List all endpoints for consumer |
| `GET` | `/api/v1/payments` | Bearer Token | Fetch bulk payments (reads from Replica) |
| `GET` | `/api/v1/events` | Bearer Token | Retrieve paginated domain events |

**Consumer Management (Requires `X-Admin-Key`)**
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/admin/consumers` | Register a new remote Consumer App |
| `POST` | `/api/v1/admin/consumers/{id}/rotate-secret` | Generate new Client Secret |
| `POST` | `/api/v1/admin/consumers/{id}/merchants` | Assign Merchant to Consumer scope |

</details>

<details>
<summary>📊 <strong>System 3 — Merchant Analytics</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/{mid}/analytics/summary` | Total revenue, count, success rate |
| `GET` | `/api/{mid}/analytics/daily` | Day-by-day revenue (pre-aggregated) |
| `GET` | `/api/{mid}/analytics/methods` | Payment method distribution |
| `GET` | `/api/{mid}/payments` | Filtered payments list |

</details>

---

## 🖥 Platform Monitor

> **Dashboard:** http://localhost:5176

The Platform Monitor is a fully self-contained observability service with a rich dark-mode dashboard. It monitors the entire platform from the outside, performing latency tracking and full journey verifications.

* Automated hourly **E2E Smoke Tests** mimicking Merchant configurations down to processing/syncing refunds natively.
* Persistence over Redis keeping up to 50 latest checkpoints unharmed across container crashes.

---

## 🗃 Event Catalog

Every mutation in System 1 emits a domain event. The events flow through Kafka and are consumed by System 2.

| Event Type | Trigger | Read DB Effect |
|---|---|---|
| `merchant.created.v1` | Merchant onboarded | Create full schema in read DB |
| `customer.created.v1` | New customer | Insert customer row |
| `customer.updated.v1` | Customer edited | Update row + cascade denormalized fields |
| `payment.authorized.v1`| Payment authorized | Update status |
| `payment.captured.v1` | Payment captured | Update status + recalculate aggregates |
| `refund.initiated.v1` | Refund requested | Insert refund row + adjust revenue |

---

## 🧪 Testing

The project ships with a full **pytest-based integration and E2E test suite** — no mocking, all real Docker services evaluated automatically through GitHub Actions.

```bash
docker compose up -d
pytest tests/ -v
# Run specific flows
pytest tests/test_e2e_flow.py -v
```

---

## 📮 Postman Collections

Found in the root directory:
1. `multi-tenant-payment-gateway.postman_collection.json` (Primary APIs).
2. `third-party-bulk-api.postman_collection.json` (OAuth 2.0 & Gateway features).

---

<div align="center">

---

**Built with meticulous attention to production engineering patterns.**

⚡ FastAPI &nbsp;·&nbsp; 🐘 PostgreSQL &nbsp;·&nbsp; 🎯 Redpanda &nbsp;·&nbsp; ⚛️ React &nbsp;·&nbsp; 🐳 Docker

📖 See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the complete technical deep-dive including all schemas, DDL, transformation matrices, and end-to-end flow diagrams.

</div>
