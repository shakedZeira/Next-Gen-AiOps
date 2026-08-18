from pydantic_settings import BaseSettings


class RCAConfig(BaseSettings):
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://otel-lgtm:4318"
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    MODEL_NAME: str = "llama3.1:8b"
    ANOMALY_THRESHOLD_SD: float = 3.0
    TIME_WINDOW_MIN: int = 5
    MAX_CANDIDATES: int = 3

    model_config = {"env_file": ".env"}
