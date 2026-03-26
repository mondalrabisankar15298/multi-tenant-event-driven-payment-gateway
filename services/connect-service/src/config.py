from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Core DB (for reading merchant info if needed)
    CORE_DB_HOST: str = "core-db"
    CORE_DB_PORT: int = 5432
    CORE_DB_USER: str = "payment_admin"
    CORE_DB_PASSWORD: str = "payment_secret"
    CORE_DB_NAME: str = "payment_core"

    # Read DB
    READ_DB_HOST: str = "read-db"
    READ_DB_PORT: int = 5432
    READ_DB_USER: str = "payment_admin"
    READ_DB_PASSWORD: str = "payment_secret"
    READ_DB_NAME: str = "payment_read"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Kafka
    KAFKA_BROKERS: str = "redpanda:9092"
    KAFKA_TOPIC: str = "payments.events"

    # Webhook
    WEBHOOK_MAX_RETRIES: int = 6
    WEBHOOK_HMAC_SECRET: str = "whsec_supersecretkey"

    # Service
    CONNECT_SERVICE_PORT: int = 8002

    @property
    def read_db_dsn(self) -> str:
        return f"postgresql://{self.READ_DB_USER}:{self.READ_DB_PASSWORD}@{self.READ_DB_HOST}:{self.READ_DB_PORT}/{self.READ_DB_NAME}"

    @property
    def core_db_dsn(self) -> str:
        return f"postgresql://{self.CORE_DB_USER}:{self.CORE_DB_PASSWORD}@{self.CORE_DB_HOST}:{self.CORE_DB_PORT}/{self.CORE_DB_NAME}"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
