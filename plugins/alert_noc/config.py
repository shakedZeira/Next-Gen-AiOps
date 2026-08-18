from pydantic_settings import BaseSettings


class AlertNOCConfig(BaseSettings):
    REDIS_URL: str = "redis://redis:6379/0"
    CORE_API_URL: str = "http://api-gateway:8000"

    model_config = {"env_file": ".env"}
