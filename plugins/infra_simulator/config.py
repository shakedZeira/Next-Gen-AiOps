from pydantic_settings import BaseSettings


class InfraSimulatorConfig(BaseSettings):
    INFRA_EMIT_INTERVAL_S: float = 10.0
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://otel-lgtm:4318"
    ALERT_NOC_URL: str = "http://alert-noc:8005"

    model_config = {"env_file": ".env"}
