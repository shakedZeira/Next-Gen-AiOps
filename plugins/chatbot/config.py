from pydantic_settings import BaseSettings


class ChatBotConfig(BaseSettings):
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    MODEL_NAME: str = "llama3.1:8b"
    CORE_API_URL: str = "http://api-gateway:8000"
    REDIS_URL: str = "redis://redis:6379/0"
    APPROVAL_TTL_S: int = 300

    model_config = {"env_file": ".env"}
