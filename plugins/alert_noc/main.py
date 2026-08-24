import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from plugins.alert_noc.router import router
from plugins.alert_noc.store import ALERTS_CHANNEL, alert_store

ESCALATION_CHECK_INTERVAL = 60


async def escalation_background_task():
    while True:
        try:
            await alert_store.escalation.run_background_check(
                alert_store, alert_store._publish
            )
        except Exception as e:
            pass
        await asyncio.sleep(ESCALATION_CHECK_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(escalation_background_task())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Alert NOC", lifespan=lifespan)
app.include_router(router, prefix="/api/v1")


@app.websocket("/api/v1/alerts/ws")
async def alerts_websocket(websocket: WebSocket):
    await websocket.accept()
    alert_store.add_ws_client(websocket)
    pubsub = alert_store.redis.pubsub()
    await pubsub.subscribe(ALERTS_CHANNEL)
    try:
        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=1.0
            )
            if message and message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                await websocket.send_text(data)
            await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        alert_store.remove_ws_client(websocket)
        await pubsub.unsubscribe(ALERTS_CHANNEL)
        await pubsub.close()


@app.get("/health")
async def health():
    return {"status": "healthy"}
