from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://aiops:aiops@localhost:5432/aiops"
    REDIS_URL: str = "redis://localhost:6379/0"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4318"
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    model_config = {"env_file": ".env"}


settings = Settings()
