import asyncio
import json

import redis.asyncio as aioredis

from plugins.syslog_receiver.config import SyslogConfig

_cache: dict[str, dict] = {}
_cache_ttl: dict[str, float] = {}
CACHE_TTL_SECONDS = 300


async def resolve_host_to_ci(
    hostname: str, redis_client: aioredis.Redis, config: SyslogConfig
) -> dict | None:
    cache_key = f"syslog:ci:{hostname}"
    now = asyncio.get_event_loop().time()

    if hostname in _cache and now - _cache_ttl.get(hostname, 0) < CACHE_TTL_SECONDS:
        return _cache[hostname]

    cached = await redis_client.get(cache_key)
    if cached:
        ci = json.loads(cached)
        _cache[hostname] = ci
        _cache_ttl[hostname] = now
        return ci

    import httpx

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{config.CORE_API_URL}/api/v1/cmdb/ci",
                params={"hostname": hostname},
            )
            if resp.status_code == 200:
                data = resp.json()
                ci = data if isinstance(data, dict) else data[0] if data else None
                if ci:
                    await redis_client.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(ci))
                    _cache[hostname] = ci
                    _cache_ttl[hostname] = now
                    return ci
    except Exception:
        pass

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{config.CORE_API_URL}/api/v1/cmdb/ci",
                params={"search": hostname},
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data if isinstance(data, list) else [data] if data else []
                for ci in items:
                    name = (ci.get("name") or "").lower()
                    if hostname.lower() in name or name in hostname.lower():
                        await redis_client.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(ci))
                        _cache[hostname] = ci
                        _cache_ttl[hostname] = now
                        return ci
    except Exception:
        pass

    return None


def guess_service_from_ci(ci: dict | None, hostname: str) -> str:
    if ci:
        site = ci.get("site", "")
        ci_type = ci.get("type", "")
        name = ci.get("name", "")

        if "switch" in ci_type.lower() or "router" in ci_type.lower():
            return f"Network - {site}" if site else "Network"
        if "firewall" in ci_type.lower():
            return f"Security - {site}" if site else "Security"
        if "server" in ci_type.lower():
            return f"Compute - {site}" if site else "Compute"
        if "core" in name.lower():
            return f"Core Services - {site}" if site else "Core Services"
        return f"{ci_type} - {site}" if site else ci_type or "Unknown"

    return "Unknown"
