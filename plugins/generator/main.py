import asyncio
import random
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from plugins.generator.config import GeneratorConfig
from plugins.generator.topology import DEFAULT_TOPOLOGY
from plugins.generator.otel_emitter import init_emitter, emit_transaction

logger = logging.getLogger(__name__)
config = GeneratorConfig()
running = False


async def generation_loop():
    global running
    running = True
    tracer, meter = init_emitter("synthetic-generator", config.OTEL_EXPORTER_OTLP_ENDPOINT)
    logger.info("Starting synthetic generation with %d services", len(DEFAULT_TOPOLOGY))
    while running:
        for svc in DEFAULT_TOPOLOGY:
            result = emit_transaction(tracer, meter, svc.name, svc.latency_mean_ms, svc.error_rate)
            if result["error"]:
                logger.warning("Error in %s: status=%d", svc.name, result["status"])
        await asyncio.sleep(config.EMIT_INTERVAL_S)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(generation_loop())
    yield
    global running
    running = False
    task.cancel()


app = FastAPI(title="Synthetic Generator", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "healthy", "services": len(DEFAULT_TOPOLOGY)}


@app.get("/status")
async def status():
    return {"running": running, "service_count": len(DEFAULT_TOPOLOGY), "error_rate": config.ERROR_RATE}
