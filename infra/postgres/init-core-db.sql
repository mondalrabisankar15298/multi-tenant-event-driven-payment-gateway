-- =============================================
-- CORE DB: Public schema (shared across all merchants)
-- =============================================

-- Merchant registry
CREATE TABLE public.merchants (
    merchant_id     SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    schema_name     VARCHAR(100) UNIQUE NOT NULL,
    api_key         UUID,
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Transactional outbox (domain events)
CREATE TABLE public.domain_events (
    event_id        UUID PRIMARY KEY,
    merchant_id     INT NOT NULL REFERENCES public.merchants(merchant_id),
    schema_name     VARCHAR(100) NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       VARCHAR(100) NOT NULL,
    payload         JSONB NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for outbox worker polling
CREATE INDEX idx_domain_events_pending
    ON public.domain_events(status, created_at)
    WHERE status = 'pending';
