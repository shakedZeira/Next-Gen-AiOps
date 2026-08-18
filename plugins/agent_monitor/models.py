from pydantic import BaseModel
from datetime import datetime


class LLMRequest(BaseModel):
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: float
    cost_usd: float
    success: bool
    timestamp: datetime


class LLMStats(BaseModel):
    total_requests: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    avg_latency_ms: float
    error_rate: float
    models: list[dict]


class ModelHealth(BaseModel):
    model: str
    requests: int
    errors: int
    avg_latency_ms: float
    p99_latency_ms: float
    tokens_per_minute: int
    cost_per_hour: float
    status: str  # healthy, degraded, down
