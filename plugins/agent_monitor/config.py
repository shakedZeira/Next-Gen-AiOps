from pydantic_settings import BaseSettings


class AgentMonitorConfig(BaseSettings):
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://otel-lgtm:4318"
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    MODEL_NAME: str = "llama3.1:8b"
    SIMULATE_TRAFFIC: bool = True
    TRAFFIC_INTERVAL_S: float = 10.0

    model_config = {"env_file": ".env"}
