from pydantic_settings import BaseSettings


class GeneratorConfig(BaseSettings):
    SERVICE_COUNT: int = 5
    ERROR_RATE: float = 0.05
    LATENCY_MEAN_MS: int = 100
    LATENCY_STDDEV_MS: int = 30
    TRANSACTIONS_PER_MIN: int = 60
    EMIT_INTERVAL_S: float = 5.0
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://otel-lgtm:4318"

    model_config = {"env_file": ".env"}
