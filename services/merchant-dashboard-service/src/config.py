from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    READ_DB_HOST: str = "read-db"
    READ_DB_PORT: int = 5432
    READ_DB_USER: str = "payment_admin"
    READ_DB_PASSWORD: str = "payment_secret"
    READ_DB_NAME: str = "payment_read"
    DASHBOARD_SERVICE_PORT: int = 8003
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174"

    @property
    def read_db_dsn(self) -> str:
        return f"postgresql://{self.READ_DB_USER}:{self.READ_DB_PASSWORD}@{self.READ_DB_HOST}:{self.READ_DB_PORT}/{self.READ_DB_NAME}"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
