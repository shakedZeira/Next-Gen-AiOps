import asyncio
import random
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from plugins.infra_simulator.config import InfraSimulatorConfig
from plugins.infra_simulator.topology import INFRA_DEVICES
from plugins.infra_simulator.log_emitter import init_log_emitter, emit_device_logs
from plugins.infra_simulator.alert_rules import trigger_alert

logger = logging.getLogger(__name__)
config = InfraSimulatorConfig()
running = False


async def simulation_loop():
    global running
    running = True
    provider = init_log_emitter("infra-simulator", config.OTEL_EXPORTER_OTLP_ENDPOINT)
    logger.info("Starting infra simulation with %d devices", len(INFRA_DEVICES))
    cycle = 0
    while running:
        cycle += 1
        for device in INFRA_DEVICES:
            emit_device_logs(provider.get_logger("infra-simulator"), device)
            if random.random() < device.error_probability:
                await trigger_alert(device, config.ALERT_NOC_URL)
        if cycle % 6 == 0:
            random_device = random.choice(INFRA_DEVICES)
            await trigger_alert(random_device, config.ALERT_NOC_URL)
        await asyncio.sleep(config.INFRA_EMIT_INTERVAL_S)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(simulation_loop())
    yield
    global running
    running = False
    task.cancel()


app = FastAPI(title="Infrastructure Simulator", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "healthy", "devices": len(INFRA_DEVICES)}


@app.get("/status")
async def status():
    return {"running": running, "device_count": len(INFRA_DEVICES)}
