-- =============================================
-- READ DB: Public schema (shared utilities)
-- =============================================

-- Idempotency tracking for DB Sync Consumer
CREATE TABLE public.processed_events (
    event_id     UUID PRIMARY KEY,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook subscriptions
CREATE TABLE public.webhook_subscriptions (
    subscription_id  SERIAL PRIMARY KEY,
    merchant_id      INT NOT NULL,
    url              VARCHAR(500) NOT NULL,
    event_types      TEXT[] NOT NULL,
    secret           VARCHAR(255) NOT NULL,
    active           BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery audit log
CREATE TABLE public.delivery_logs (
    log_id           SERIAL PRIMARY KEY,
    subscription_id  INT NOT NULL REFERENCES public.webhook_subscriptions(subscription_id),
    event_id         UUID NOT NULL,
    attempt          INT NOT NULL,
    status_code      INT,
    response_body    TEXT,
    success          BOOLEAN NOT NULL,
    next_retry_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Dead Letter Queue for failed webhook deliveries
CREATE TABLE public.dead_letter_queue (
    dlq_id           SERIAL PRIMARY KEY,
    subscription_id  INT NOT NULL REFERENCES public.webhook_subscriptions(subscription_id),
    event_id         UUID NOT NULL,
    payload          JSONB NOT NULL,
    failure_reason   TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Merchant mirror (synced from write DB via merchant.created.v1 events)
CREATE TABLE public.merchants (
    merchant_id     INT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    schema_name     VARCHAR(100) UNIQUE NOT NULL,
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ
);
