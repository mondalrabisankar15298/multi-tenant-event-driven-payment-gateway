import logging

logger = logging.getLogger(__name__)


async def ensure_merchant_schema(pool, schema_name: str):
    """Create the read-optimized merchant schema and tables if they don't exist."""
    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)",
            schema_name,
        )
        if exists:
            return

        logger.info(f"Creating read schema: {schema_name}")

        await conn.execute(f"CREATE SCHEMA {schema_name}")

        # Customers with precomputed aggregates
        await conn.execute(f"""
            CREATE TABLE {schema_name}.customers (
                customer_id     INT PRIMARY KEY,
                name            VARCHAR(255) NOT NULL,
                email           VARCHAR(255),
                phone           VARCHAR(50),
                total_payments  INT DEFAULT 0,
                total_spent     DECIMAL(12,2) DEFAULT 0,
                last_payment_at TIMESTAMPTZ,
                created_at      TIMESTAMPTZ,
                updated_at      TIMESTAMPTZ
            )
        """)

        # Payments with denormalized customer info
        await conn.execute(f"""
            CREATE TABLE {schema_name}.payments (
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
                metadata        JSONB DEFAULT '{{}}'::jsonb,
                created_at      TIMESTAMPTZ,
                updated_at      TIMESTAMPTZ
            )
        """)
        await conn.execute(f"CREATE INDEX idx_{schema_name}_payments_status ON {schema_name}.payments(status)")
        await conn.execute(f"CREATE INDEX idx_{schema_name}_payments_date ON {schema_name}.payments(created_at)")
        await conn.execute(f"CREATE INDEX idx_{schema_name}_payments_method ON {schema_name}.payments(method)")

        # Refunds with denormalized context
        await conn.execute(f"""
            CREATE TABLE {schema_name}.refunds (
                refund_id       UUID PRIMARY KEY,
                payment_id      UUID NOT NULL,
                payment_amount  DECIMAL(12,2),
                customer_name   VARCHAR(255),
                amount          DECIMAL(12,2) NOT NULL,
                reason          TEXT,
                status          VARCHAR(30),
                created_at      TIMESTAMPTZ,
                updated_at      TIMESTAMPTZ
            )
        """)

        # Pre-aggregated daily revenue
        await conn.execute(f"""
            CREATE TABLE {schema_name}.daily_revenue (
                date            DATE PRIMARY KEY,
                total_amount    DECIMAL(12,2) DEFAULT 0,
                payment_count   INT DEFAULT 0,
                success_count   INT DEFAULT 0,
                failed_count    INT DEFAULT 0,
                refund_amount   DECIMAL(12,2) DEFAULT 0,
                net_revenue     DECIMAL(12,2) DEFAULT 0
            )
        """)

        # Pre-aggregated payment method stats
        await conn.execute(f"""
            CREATE TABLE {schema_name}.payment_method_stats (
                method          VARCHAR(30) PRIMARY KEY,
                total_amount    DECIMAL(12,2) DEFAULT 0,
                count           INT DEFAULT 0,
                success_count   INT DEFAULT 0,
                success_rate    DECIMAL(5,2) DEFAULT 0
            )
        """)

        logger.info(f"Read schema {schema_name} created successfully")
