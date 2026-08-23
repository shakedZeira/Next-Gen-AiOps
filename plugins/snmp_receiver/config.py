from pydantic_settings import BaseSettings


class SnmpConfig(BaseSettings):
    REDIS_URL: str = "redis://redis:6379/0"
    DATABASE_URL: str = "postgresql+asyncpg://aiops:aiops@postgres:5432/aiops"
    CORE_API_URL: str = "http://api-gateway:8000"
    ALERT_NOC_URL: str = "http://alert-noc:8005"
    SNMP_BIND_HOST: str = "0.0.0.0"
    SNMP_UDP_PORT: int = 162
    SNMP_COMMUNITIES: str = "public"
    SNMP_V3_USER: str = ""
    SNMP_V3_AUTH_KEY: str = ""
    SNMP_V3_PRIV_KEY: str = ""
    SNMP_V3_AUTH_PROTO: str = "sha"
    SNMP_V3_PRIV_PROTO: str = "aes128"
    SNMP_V3_ENGINE_ID: str = ""
    TRAP_HISTORY_SIZE: int = 1000

    model_config = {"env_file": ".env"}

    @property
    def communities(self) -> list[str]:
        return [c.strip() for c in self.SNMP_COMMUNITIES.split(",") if c.strip()]
