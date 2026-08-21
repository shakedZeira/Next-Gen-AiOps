from pydantic_settings import BaseSettings


class ChatBotConfig(BaseSettings):
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    MODEL_NAME: str = "qwen2.5:1.5b"
    CORE_API_URL: str = "http://api-gateway:8000"
    ALERT_NOC_URL: str = "http://alert-noc:8005"
    REDIS_URL: str = "redis://:changeme@redis:6379/0"
    APPROVAL_TTL_S: int = 300
    CONTEXT_WINDOW: int = 20
    CONVERSATION_TTL_S: int = 3600

    model_config = {"env_file": ".env"}
