# 🏗 Multi-Tenant Event-Driven Payment Gateway Platform

> A production-grade **CQRS** + **Event Sourcing** payment gateway with schema-per-tenant isolation, Kafka event streaming, and real-time analytics.

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Backend | **Python / FastAPI** × 3 services |
| Workers | **Celery + Redis** |
| Frontend | **React (Vite)** × 2 UIs |
| Databases | **PostgreSQL 16** × 2 (Write + Read) |
| Events | **Redpanda** (Kafka-compatible) |
| Containers | **Docker Compose** (12 services) |

## 🚀 Quick Start

```bash
# 1. Clone and enter
cd multi-tenant-payment-gateway

# 2. Start everything
docker compose up --build

# 3. Access
# Admin Portal:       http://localhost:5173
# Merchant Dashboard: http://localhost:5174
# System 1 API Docs:  http://localhost:8001/docs
# System 2 API Docs:  http://localhost:8002/docs
# System 3 API Docs:  http://localhost:8003/docs
# Redpanda Console:   http://localhost:8080
```

## 📐 Architecture

```
Frontend (React) → System 1 (FastAPI) → Postgres (Write + Outbox)
                                              ↓
                                      Celery Worker (Outbox) → Redis
                                              ↓
                                      Redpanda (Kafka)
                                              ↓
                           ┌──────────────────┴──────────────────┐
                           ↓                                     ↓
                  DB Sync Consumer                     Webhook Consumer
                  (Transform + Aggregate)              (HMAC Sign + Deliver)
                           ↓                                     ↓
                  Postgres (Read DB)                   Celery Worker (Retry)
                           ↓
                  System 3 (FastAPI) → Frontend (Dashboard)
```

## 📦 Services

| Service | Port | Purpose |
|---|---|---|
| `payment-core-service` | 8001 | Write API (CRUD + state machine) |
| `connect-service` | 8002 | Kafka consumers + webhooks |
| `merchant-dashboard-service` | 8003 | Read-only analytics API |
| `admin-portal` | 5173 | Admin UI (System 1) |
| `merchant-dashboard` | 5174 | Analytics UI (System 3) |
| `core-db` | 5433 | PostgreSQL (write) |
| `read-db` | 5434 | PostgreSQL (read) |
| `redis` | 6379 | Celery broker |
| `redpanda` | 9092 | Kafka broker |
| `redpanda-console` | 8080 | Broker UI |

## 📖 Full Documentation

See [ARCHITECTURE.md](ARCHITECTURE.md) for complete:
- Database schemas (DDL)
- API endpoint reference
- Event catalog (12 event types)
- Payment state machine
- Webhook system (HMAC + retry + DLQ)
- Read DB transformation matrix
- End-to-end flow diagrams
