import asyncio
import random
import logging
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI
from plugins.generator.config import GeneratorConfig
from plugins.generator.topology import DEFAULT_TOPOLOGY
from plugins.generator.otel_emitter import init_emitter, emit_transaction

logger = logging.getLogger(__name__)
config = GeneratorConfig()
running = False

ALERT_SERVICES = {
    "payments-api": {"service": "Payment Gateway", "team": "payments"},
    "ecommerce-api": {"service": "E-Commerce Platform", "team": "backend"},
    "inventory-api": {"service": "Inventory Service", "team": "backend"},
    "order-service": {"service": "Order Processing", "team": "backend"},
    "analytics-api": {"service": "Analytics Pipeline", "team": "data"},
    "auth-api": {"service": "Auth Service", "team": "security"},
}


async def create_alert(service_name: str, error_type: str):
    info = ALERT_SERVICES.get(service_name, {"service": service_name, "team": "unassigned"})
    severity_map = {"high_latency": "high", "error_spike": "critical", "timeout": "critical", "disk_low": "medium"}
    severity = severity_map.get(error_type, "high")
    name_map = {
        "high_latency": f"High Latency P99 - {service_name}",
        "error_spike": f"Error Rate Spike - {service_name}",
        "timeout": f"Request Timeout - {service_name}",
        "disk_low": f"Disk Space Low - {service_name}",
    }
    payload = {
        "name": name_map.get(error_type, f"Alert - {service_name}"),
        "service": info["service"],
        "severity": severity,
        "description": f"Auto-detected {error_type} on {service_name}",
        "team": info["team"],
        "labels": {"service": service_name, "source": "synthetic-generator"},
    }
    try:
        async with httpx.AsyncClient() as client:
            await client.post("http://alert-noc:8005/api/v1/alerts", json=payload, timeout=5)
    except Exception as e:
        logger.warning("Failed to create alert: %s", e)


async def generation_loop():
    global running
    running = True
    tracer, meter = init_emitter("synthetic-generator", config.OTEL_EXPORTER_OTLP_ENDPOINT)
    logger.info("Starting synthetic generation with %d services", len(DEFAULT_TOPOLOGY))
    cycle = 0
    while running:
        cycle += 1
        for svc in DEFAULT_TOPOLOGY:
            result = await emit_transaction(tracer, meter, svc.name, svc.latency_mean_ms, svc.error_rate)
            if result["error"]:
                logger.warning("Error in %s: status=%d", svc.name, result["status"])
                if random.random() < 0.3:
                    await create_alert(svc.name, "error_spike")
            elif result["latency_ms"] > svc.latency_mean_ms * 2:
                if random.random() < 0.2:
                    await create_alert(svc.name, "high_latency")
        if cycle % 12 == 0:
            random_svc = random.choice(DEFAULT_TOPOLOGY)
            await create_alert(random_svc.name, "disk_low")
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
