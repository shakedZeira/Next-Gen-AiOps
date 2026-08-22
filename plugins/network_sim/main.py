from __future__ import annotations
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from plugins.network_sim.engine import get_engine
from plugins.network_sim.config import DATABASE_URL


class PingRequest(BaseModel):
    src_id: str
    dst_ip: str


class TracerouteRequest(BaseModel):
    src_id: str
    dst_ip: str


class FailureRequest(BaseModel):
    target_id: str
    failure_type: str = "link"
    interface_name: str | None = None


class RecoveryRequest(BaseModel):
    target_id: str
    recovery_type: str = "link"
    interface_name: str | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = get_engine()
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import text

        db_engine = create_async_engine(DATABASE_URL)
        async_session = sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as session:
            result = await session.execute(text("SELECT id, name, type, provider, environment, team, site, site_type, network_layer, topology_type, labels, management_ip, loopback_ip, subnet FROM ci"))
            rows = result.fetchall()
            cis = [
                {
                    "id": str(r[0]),
                    "name": r[1],
                    "type": r[2],
                    "provider": r[3],
                    "environment": r[4],
                    "team": r[5],
                    "site": r[6],
                    "site_type": r[7],
                    "network_layer": r[8],
                    "topology_type": r[9],
                    "labels": r[10] if isinstance(r[10], dict) else {},
                    "management_ip": str(r[11]) if r[11] else None,
                    "loopback_ip": str(r[12]) if r[12] else None,
                    "subnet": str(r[13]) if r[13] else None,
                }
                for r in rows
            ]

            rel_result = await session.execute(text("SELECT source_id, target_id, type FROM relationship"))
            rel_rows = rel_result.fetchall()
            topology = {
                "nodes": [{"id": str(c["id"]), "name": c["name"], "type": c["type"]} for c in cis],
                "edges": [{"source": str(r[0]), "target": str(r[1]), "type": r[2]} for r in rel_rows],
            }

        engine.build_from_cmdb(topology, cis)
        await db_engine.dispose()
    except Exception as e:
        print(f"[network_sim] Build failed: {e}")

    yield


app = FastAPI(title="Network Simulation Engine", lifespan=lifespan)


@app.get("/api/v1/network-sim/health")
async def health():
    engine = get_engine()
    return {"status": "ok", "devices": len(engine.devices), "links": len(engine.links)}


@app.get("/api/v1/network-sim/devices")
async def list_devices():
    engine = get_engine()
    return engine.get_all_devices_summary()


@app.get("/api/v1/network-sim/devices/{device_id}/routes")
async def get_routes(device_id: str):
    engine = get_engine()
    dev = engine.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"device_id": device_id, "device_name": dev.name, "routes": engine.get_routing_table(device_id)}


@app.get("/api/v1/network-sim/devices/{device_id}/arp")
async def get_arp(device_id: str):
    engine = get_engine()
    dev = engine.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"device_id": device_id, "device_name": dev.name, "arp_cache": engine.get_arp_cache(device_id)}


@app.get("/api/v1/network-sim/devices/{device_id}/mac-table")
async def get_mac_table(device_id: str):
    engine = get_engine()
    dev = engine.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"device_id": device_id, "device_name": dev.name, "mac_table": engine.get_mac_table(device_id)}


@app.post("/api/v1/network-sim/ping")
async def ping(req: PingRequest):
    engine = get_engine()
    result = engine.ping(req.src_id, req.dst_ip)
    return result


@app.post("/api/v1/network-sim/traceroute")
async def traceroute(req: TracerouteRequest):
    engine = get_engine()
    result = engine.traceroute(req.src_id, req.dst_ip)
    return result


@app.post("/api/v1/network-sim/failure")
async def inject_failure(req: FailureRequest):
    engine = get_engine()
    return engine.inject_failure(req.target_id, req.failure_type, req.interface_name)


@app.post("/api/v1/network-sim/recovery")
async def recover(req: RecoveryRequest):
    engine = get_engine()
    return engine.recover(req.target_id, req.recovery_type, req.interface_name)


@app.get("/api/v1/network-sim/devices/{device_id}/interfaces")
async def get_interfaces(device_id: str):
    engine = get_engine()
    dev = engine.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"device_id": device_id, "device_name": dev.name, "interfaces": engine.get_interfaces(device_id)}


@app.get("/api/v1/network-sim/link-states")
async def get_link_states():
    engine = get_engine()
    return {"links": engine.get_link_states()}


@app.get("/api/v1/network-sim/shortest-path")
async def shortest_path(src_id: str, dst_ip: str):
    engine = get_engine()
    path_ids = engine.shortest_path(src_id, dst_ip)
    if not path_ids:
        raise HTTPException(status_code=404, detail="No path found")
    path_devices = []
    for did in path_ids:
        dev = engine.get_device(did)
        if dev:
            path_devices.append({"id": did, "name": dev.name, "site": dev.site})
    return {"path": path_devices}


@app.get("/api/v1/network-sim/events")
async def get_events(count: int = 50):
    engine = get_engine()
    return {"events": engine.event_log.get_recent(count)}


@app.websocket("/api/v1/network-sim/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    engine = get_engine()
    last_count = 0
    try:
        while True:
            events = engine.event_log.get_recent(100)
            if len(events) > last_count:
                new_events = events[last_count:]
                await websocket.send_json({"events": new_events})
                last_count = len(events)
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        pass
