import asyncio
import logging
import random
from collections import deque
from contextlib import asynccontextmanager

from fastapi import FastAPI

from plugins.agent_monitor.config import AgentMonitorConfig
from plugins.agent_monitor.metrics_collector import init_metrics, record_llm_call
from plugins.agent_monitor.router import _stats, router

logger = logging.getLogger(__name__)
config = AgentMonitorConfig()


async def simulate_traffic():
    meters = init_metrics(config.OTEL_EXPORTER_OTLP_ENDPOINT)
    models = ["llama3.1:8b", "qwen2.5:7b"]
    while True:
        model = random.choice(models)
        input_tokens = random.randint(50, 500)
        output_tokens = random.randint(100, 1000)
        latency = random.gauss(200, 50)
        success = random.random() > 0.03
        cost = 0.0  # local models are free

        record_llm_call(meters, model, input_tokens, output_tokens, latency, success)
        _stats["requests"].append({"model": model, "input_tokens": input_tokens, "output_tokens": output_tokens, "latency_ms": latency, "cost_usd": cost, "success": success})
        if model not in _stats["models"]:
            _stats["models"][model] = deque(maxlen=10000)
        _stats["models"][model].append(_stats["requests"][-1])

        await asyncio.sleep(config.TRAFFIC_INTERVAL_S)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(simulate_traffic())
    yield
    task.cancel()


app = FastAPI(title="Agent Monitor", lifespan=lifespan)
app.include_router(router, prefix="/api/v1/agent-monitor")


@app.get("/health")
async def health():
    return {"status": "healthy"}
