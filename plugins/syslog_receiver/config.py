from pydantic_settings import BaseSettings


class SyslogConfig(BaseSettings):
    REDIS_URL: str = "redis://redis:6379/0"
    CORE_API_URL: str = "http://api-gateway:8000"
    DATABASE_URL: str = "postgresql+asyncpg://aiops:aiops@postgres:5432/aiops"
    SYSLOG_UDP_PORT: int = 514
    SYSLOG_TCP_PORT: int = 514

    model_config = {"env_file": ".env"}
