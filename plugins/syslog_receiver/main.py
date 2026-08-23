import asyncio
import json
import logging
import socket
import time
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI

from plugins.syslog_receiver.config import SyslogConfig
from plugins.syslog_receiver.mapper import resolve_host_to_ci, guess_service_from_ci
from plugins.syslog_receiver.patterns import (
    match_alert,
    priority_to_severity,
    priority_to_facility,
)
from plugins.syslog_receiver.server import (
    SyslogUDPServer,
    SyslogTCPServer,
    parse_syslog,
)

logger = logging.getLogger("syslog_receiver")
logging.basicConfig(level=logging.INFO)

config = SyslogConfig()
redis_client = aioredis.from_url(config.REDIS_URL)

stats = {
    "messages_received": 0,
    "alerts_generated": 0,
    "parse_errors": 0,
    "start_time": None,
}

recent_messages: list[dict] = []
MAX_RECENT = 200


async def publish_alert(alert_data: dict):
    import httpx

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{config.CORE_API_URL}/api/v1/alerts",
                json=alert_data,
            )
            if resp.status_code in (200, 201):
                stats["alerts_generated"] += 1
                logger.info(
                    "Alert created: %s [%s] on %s",
                    alert_data.get("name"),
                    alert_data.get("severity"),
                    alert_data.get("service"),
                )
            else:
                logger.warning("Alert creation returned %d: %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.error("Failed to create alert: %s", e)


async def handle_syslog_message(raw_message: str, addr, transport: str):
    stats["messages_received"] += 1

    parsed = parse_syslog(raw_message)
    if not parsed:
        stats["parse_errors"] += 1
        return

    ci = await resolve_host_to_ci(parsed.hostname, redis_client, config)
    service = guess_service_from_ci(ci, parsed.hostname)

    alert_match = match_alert(parsed.message)
    if alert_match:
        alert_name, matched_severity = alert_match
        severity = matched_severity
    else:
        alert_name = f"Syslog: {parsed.app_name}"
        severity = parsed.severity

    msg_entry = {
        "timestamp": parsed.timestamp.isoformat(),
        "hostname": parsed.hostname,
        "app_name": parsed.app_name,
        "facility": parsed.facility,
        "severity": parsed.severity,
        "message": parsed.message[:500],
        "transport": transport,
        "source_ip": addr[0] if addr else "unknown",
        "alert_generated": alert_match is not None,
        "alert_name": alert_name if alert_match else None,
    }
    recent_messages.insert(0, msg_entry)
    if len(recent_messages) > MAX_RECENT:
        recent_messages.pop()

    await redis_client.lpush("syslog:recent", json.dumps(msg_entry))
    await redis_client.ltrim("syslog:recent", 0, MAX_RECENT - 1)
    await redis_client.incr("syslog:stats:received")

    if alert_match:
        alert_data = {
            "name": alert_name,
            "service": service,
            "severity": severity,
            "description": f"Syslog from {parsed.hostname}: {parsed.message[:200]}",
            "team": "network" if "Network" in service else "platform",
            "labels": {
                "source": "syslog",
                "hostname": parsed.hostname,
                "facility": parsed.facility,
                "transport": transport,
                "app_name": parsed.app_name,
                "source_ip": addr[0] if addr else "unknown",
            },
        }
        await publish_alert(alert_data)


async def start_udp_server():
    loop = asyncio.get_event_loop()
    handler = SyslogUDPServer(handle_syslog_message)
    transport, protocol = await loop.create_datagram_endpoint(
        lambda: handler,
        local_addr=("0.0.0.0", config.SYSLOG_UDP_PORT),
    )
    logger.info("Syslog UDP server started on port %d", config.SYSLOG_UDP_PORT)
    return transport


async def start_tcp_server():
    loop = asyncio.get_event_loop()
    server = await loop.create_server(
        lambda: SyslogTCPServer(handle_syslog_message),
        "0.0.0.0",
        config.SYSLOG_TCP_PORT,
    )
    logger.info("Syslog TCP server started on port %d", config.SYSLOG_TCP_PORT)
    return server


@asynccontextmanager
async def lifespan(app: FastAPI):
    stats["start_time"] = time.time()
    udp_transport = await start_udp_server()
    tcp_server = await start_tcp_server()
    yield
    udp_transport.close()
    tcp_server.close()
    await redis_client.aclose()


app = FastAPI(title="Syslog Receiver", lifespan=lifespan)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "messages_received": stats["messages_received"],
        "alerts_generated": stats["alerts_generated"],
        "uptime_seconds": time.time() - stats["start_time"] if stats["start_time"] else 0,
    }


@app.get("/api/v1/syslog/stats")
async def get_stats():
    return {
        "messages_received": stats["messages_received"],
        "alerts_generated": stats["alerts_generated"],
        "parse_errors": stats["parse_errors"],
        "uptime_seconds": time.time() - stats["start_time"] if stats["start_time"] else 0,
        "recent_messages_count": len(recent_messages),
    }


@app.get("/api/v1/syslog/messages")
async def get_messages(limit: int = 50, hostname: str | None = None, severity: str | None = None):
    msgs = recent_messages
    if hostname:
        msgs = [m for m in msgs if hostname.lower() in m["hostname"].lower()]
    if severity:
        msgs = [m for m in msgs if m["severity"] == severity]
    return msgs[:limit]
