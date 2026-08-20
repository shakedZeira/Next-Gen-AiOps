from collections import deque
from fastapi import APIRouter
from plugins.agent_monitor.models import LLMStats, ModelHealth

router = APIRouter()

# In-memory stats (would be Redis/DB in production)
# Using bounded deque to prevent unbounded memory growth
_stats = {
    "requests": deque(maxlen=10000),
    "models": {},
}


@router.get("/stats", response_model=LLMStats)
async def get_stats():
    requests = list(_stats["requests"])
    total = len(requests)
    if total == 0:
        return LLMStats(total_requests=0, total_input_tokens=0, total_output_tokens=0, total_cost_usd=0, avg_latency_ms=0, error_rate=0, models=[])
    return LLMStats(
        total_requests=total,
        total_input_tokens=sum(r["input_tokens"] for r in requests),
        total_output_tokens=sum(r["output_tokens"] for r in requests),
        total_cost_usd=sum(r["cost_usd"] for r in requests),
        avg_latency_ms=sum(r["latency_ms"] for r in requests) / total,
        error_rate=sum(1 for r in requests if not r["success"]) / total,
        models=[{"model": m, "requests": len(rs)} for m, rs in _stats["models"].items()],
    )


@router.get("/health/models", response_model=list[ModelHealth])
async def get_model_health():
    models = []
    for model_name, model_requests in _stats["models"].items():
        errors = sum(1 for r in model_requests if not r["success"])
        latencies = [r["latency_ms"] for r in model_requests]
        models.append(ModelHealth(
            model=model_name,
            requests=len(model_requests),
            errors=errors,
            avg_latency_ms=sum(latencies) / max(len(latencies), 1),
            p99_latency_ms=sorted(latencies)[int(len(latencies) * 0.99)] if latencies else 0,
            tokens_per_minute=0,
            cost_per_hour=0,
            status="healthy" if errors / max(len(model_requests), 1) < 0.05 else "degraded",
        ))
    return models