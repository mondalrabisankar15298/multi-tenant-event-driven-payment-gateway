import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Core DB
    CORE_DB_HOST: str = "core-db"
    CORE_DB_PORT: int = 5432
    CORE_DB_USER: str = "payment_admin"
    CORE_DB_PASSWORD: str = "payment_secret"
    CORE_DB_NAME: str = "payment_core"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Kafka
    KAFKA_BROKERS: str = "redpanda:9092"
    KAFKA_TOPIC: str = "payments.events"

    # Service
    CORE_SERVICE_PORT: int = 8001
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174"

    @property
    def core_db_url(self) -> str:
        return f"postgresql://{self.CORE_DB_USER}:{self.CORE_DB_PASSWORD}@{self.CORE_DB_HOST}:{self.CORE_DB_PORT}/{self.CORE_DB_NAME}"

    @property
    def core_db_dsn(self) -> str:
        """asyncpg DSN (no driver prefix)."""
        return f"postgresql://{self.CORE_DB_USER}:{self.CORE_DB_PASSWORD}@{self.CORE_DB_HOST}:{self.CORE_DB_PORT}/{self.CORE_DB_NAME}"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
