import asyncio
import json
import logging

import redis.asyncio as aioredis

from plugins.snmp_receiver.config import SnmpConfig

logger = logging.getLogger("snmp_receiver")

_cache: dict[str, dict] = {}
_cache_ttl: dict[str, float] = {}
CACHE_TTL_SECONDS = 300


async def resolve_ci_by_ip(
    ip: str, redis_client: aioredis.Redis, config: SnmpConfig
) -> dict | None:
    if not ip or ip == "unknown":
        return None

    cache_key = f"snmp:ci:{ip}"
    now = asyncio.get_event_loop().time()

    if ip in _cache and now - _cache_ttl.get(ip, 0) < CACHE_TTL_SECONDS:
        return _cache[ip]

    cached = await redis_client.get(cache_key)
    if cached:
        ci = json.loads(cached)
        _cache[ip] = ci
        _cache_ttl[ip] = now
        return ci

    import httpx

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{config.CORE_API_URL}/api/v1/cmdb/ci",
                params={"ip": ip},
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data if isinstance(data, list) else [data] if data else []
                if items:
                    await _store(cache_key, ip, items[0], redis_client, now)
                    return items[0]
    except Exception as e:
        logger.debug("CMDB lookup by ip failed for %s: %s", ip, e)

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{config.CORE_API_URL}/api/v1/cmdb/resolve-ip/{ip}")
            if resp.status_code == 200:
                data = resp.json()
                ci = data.get("ci") if isinstance(data, dict) else None
                if ci:
                    await _store(cache_key, ip, ci, redis_client, now)
                    return ci
    except Exception as e:
        logger.debug("CMDB resolve-ip fallback failed for %s: %s", ip, e)

    return None


async def _store(
    cache_key: str, ip: str, ci: dict, redis_client: aioredis.Redis, now: float
) -> None:
    await redis_client.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(ci))
    _cache[ip] = ci
    _cache_ttl[ip] = now
