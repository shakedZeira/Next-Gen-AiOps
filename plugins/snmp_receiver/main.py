import json
import logging
import time
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as aioredis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from plugins.snmp_receiver.ci_mapper import resolve_ci_by_ip
from plugins.snmp_receiver.config import SnmpConfig
from plugins.snmp_receiver.oid_mapper import (
    SNMP_TRAP_OID,
    SYS_UPTIME_OID,
    describe_interface,
    format_uptime,
    lookup_trap,
)
from plugins.snmp_receiver.server import TrapUDPServer
from plugins.snmp_receiver.trap_parser import ParsedTrap, build_manual_trap

logger = logging.getLogger("snmp_receiver")
logging.basicConfig(level=logging.INFO)

config = SnmpConfig()
redis_client = aioredis.from_url(config.REDIS_URL)

TRAP_HISTORY_KEY = "snmp:recent"

stats = {
    "traps_received": 0,
    "alerts_published": 0,
    "ci_resolved": 0,
    "unmapped_oids": 0,
    "processing_errors": 0,
    "start_time": None,
}

by_severity: dict[str, int] = {}
by_source: dict[str, int] = {}
by_trap: dict[str, int] = {}
MAX_STATS_KEYS = 500


def _bump(counter: dict, key: str) -> None:
    if key in counter or len(counter) < MAX_STATS_KEYS:
        counter[key] = counter.get(key, 0) + 1


async def publish_alert(alert_data: dict) -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{config.ALERT_NOC_URL}/api/v1/alerts",
                json=alert_data,
            )
            if resp.status_code in (200, 201):
                logger.info(
                    "Alert created: %s [%s] on %s",
                    alert_data.get("name"),
                    alert_data.get("severity"),
                    alert_data.get("service"),
                )
                return True
            logger.warning(
                "Alert creation returned %d: %s", resp.status_code, resp.text[:200]
            )
    except Exception as e:
        logger.error("Failed to create alert: %s", e)
    return False


def build_description(meta: dict, parsed: ParsedTrap, device_name: str) -> str:
    parts = [
        meta["description"],
        f"Device: {device_name}",
        f"Source: {parsed.source_ip}",
    ]
    if parsed.uptime_ticks is not None:
        parts.append(f"Device uptime: {format_uptime(parsed.uptime_ticks)}")
    iface = describe_interface(meta["name"], parsed.varbinds)
    if iface:
        parts.append(iface)
    extras = [
        f"{vb['oid']}={vb['value']}"
        for vb in parsed.varbinds
        if vb["oid"] not in (SYS_UPTIME_OID, SNMP_TRAP_OID)
    ][:5]
    if extras:
        parts.append(f"Varbinds: {', '.join(extras)}")
    return " | ".join(parts)


async def process_trap(parsed: ParsedTrap) -> dict:
    stats["traps_received"] += 1
    meta = lookup_trap(parsed.trap_oid)
    if meta["name"] == "snmpTrap":
        stats["unmapped_oids"] += 1

    ci = await resolve_ci_by_ip(parsed.source_ip, redis_client, config)
    if ci:
        stats["ci_resolved"] += 1

    device_name = (ci or {}).get("name") or parsed.source_ip
    device_type = (ci or {}).get("type") or "unknown"
    description = build_description(meta, parsed, device_name)
    severity = meta["severity"]

    _bump(by_severity, severity)
    _bump(by_source, parsed.source_ip)
    _bump(by_trap, meta["name"])

    alert_data = {
        "name": f"{meta['name']} - {device_name}",
        "service": "Network Infrastructure",
        "severity": severity,
        "description": description,
        "team": (ci or {}).get("team") or "network",
        "labels": {
            "device.name": device_name,
            "device.type": device_type,
            "alert.trigger": meta["name"],
            "source": "snmp-trap",
            "source.ip": parsed.source_ip,
            "oid": parsed.trap_oid or "unknown",
        },
    }
    published = await publish_alert(alert_data)
    if published:
        stats["alerts_published"] += 1

    entry = {
        "timestamp": parsed.received_at,
        "source_ip": parsed.source_ip,
        "source_port": parsed.source_port,
        "snmp_version": parsed.snmp_version,
        "trap_oid": parsed.trap_oid,
        "trap_name": meta["name"],
        "severity": severity,
        "uptime_ticks": parsed.uptime_ticks,
        "uptime_seconds": parsed.uptime_seconds,
        "device_name": device_name,
        "device_type": device_type,
        "ci_matched": ci is not None,
        "alert_published": published,
        "description": description,
        "varbinds": parsed.varbinds[:10],
    }

    await redis_client.lpush(TRAP_HISTORY_KEY, json.dumps(entry))
    await redis_client.ltrim(TRAP_HISTORY_KEY, 0, config.TRAP_HISTORY_SIZE - 1)
    await redis_client.incr("snmp:stats:received")

    logger.info(
        "Trap %s (%s) from %s -> %s [%s]",
        meta["name"],
        parsed.snmp_version,
        parsed.source_ip,
        device_name,
        severity,
    )
    return entry


async def handle_incoming_trap(parsed: ParsedTrap) -> None:
    try:
        await process_trap(parsed)
    except Exception:
        stats["processing_errors"] += 1
        logger.exception("Failed to process trap from %s", parsed.source_ip)


trap_server = TrapUDPServer(config, handle_incoming_trap)


@asynccontextmanager
async def lifespan(app: FastAPI):
    stats["start_time"] = time.time()
    trap_server.start()
    yield
    trap_server.stop()
    await redis_client.aclose()


app = FastAPI(title="SNMP Trap Receiver", lifespan=lifespan)


class VarBindPayload(BaseModel):
    oid: str
    value: str = ""


class ManualTrapPayload(BaseModel):
    source_ip: str = "127.0.0.1"
    trap_oid: str | None = None
    trap_name: str | None = Field(default=None, examples=["linkDown"])
    snmp_version: str = "v2c"
    uptime_ticks: int | None = None
    varbinds: list[VarBindPayload] = []


@app.get("/health")
@app.get("/api/v1/snmp/health")
async def health():
    return {
        "status": "healthy",
        "listener_running": trap_server.running,
        "udp_port": config.SNMP_UDP_PORT,
        "traps_received": stats["traps_received"],
        "alerts_published": stats["alerts_published"],
        "uptime_seconds": time.time() - stats["start_time"] if stats["start_time"] else 0,
    }


@app.get("/stats")
@app.get("/api/v1/snmp/stats")
async def get_stats():
    history_size = await redis_client.llen(TRAP_HISTORY_KEY)
    return {
        "traps_received": stats["traps_received"],
        "alerts_published": stats["alerts_published"],
        "ci_resolved": stats["ci_resolved"],
        "unmapped_oids": stats["unmapped_oids"],
        "processing_errors": stats["processing_errors"],
        "listener_running": trap_server.running,
        "history_size": history_size,
        "by_severity": by_severity,
        "by_source": by_source,
        "by_trap": by_trap,
        "uptime_seconds": time.time() - stats["start_time"] if stats["start_time"] else 0,
    }


@app.get("/traps")
@app.get("/api/v1/snmp/traps")
async def get_traps(limit: int = 100, severity: str | None = None, source_ip: str | None = None):
    limit = max(1, min(limit, config.TRAP_HISTORY_SIZE))
    raw_entries = await redis_client.lrange(TRAP_HISTORY_KEY, 0, limit * 3 - 1)
    traps = [json.loads(raw) for raw in raw_entries]
    if severity:
        traps = [t for t in traps if t.get("severity") == severity]
    if source_ip:
        traps = [t for t in traps if t.get("source_ip") == source_ip]
    return traps[:limit]


@app.post("/trap")
@app.post("/api/v1/snmp/trap")
async def inject_trap(payload: ManualTrapPayload):
    try:
        parsed = build_manual_trap(payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    entry = await process_trap(parsed)
    return {"status": "accepted", "trap": entry}
