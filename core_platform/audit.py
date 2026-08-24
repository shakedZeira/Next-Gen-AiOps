import json
import logging
import uuid
from datetime import datetime

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

AUDIT_KEY = "audit:logs"
AUDIT_INDEX_KEY = "audit:index"


class AuditLogger:
    def __init__(self, redis: aioredis.Redis):
        self.redis = redis

    async def log(
        self,
        user: str,
        action: str,
        resource_type: str,
        resource_id: str = "",
        details: dict | None = None,
        ip_address: str = "",
    ) -> dict:
        event = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "user": user,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
            "ip_address": ip_address,
        }

        await self.redis.hset(AUDIT_KEY, event["id"], json.dumps(event))
        await self.redis.zadd(
            AUDIT_INDEX_KEY,
            {event["id"]: datetime.utcnow().timestamp()},
        )

        logger.info("Audit: %s %s %s by %s", action, resource_type, resource_id[:8] if resource_id else "", user)
        return event

    async def list(
        self,
        user: str | None = None,
        action: str | None = None,
        resource_type: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        all_ids = await self.redis.zrevrange(AUDIT_INDEX_KEY, 0, -1)
        events = []

        for eid in all_ids:
            data = await self.redis.hget(AUDIT_KEY, eid if isinstance(eid, str) else eid.decode())
            if not data:
                continue
            try:
                event = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                continue

            if user and event.get("user") != user:
                continue
            if action and event.get("action") != action:
                continue
            if resource_type and event.get("resource_type") != resource_type:
                continue

            events.append(event)

        return events[offset: offset + limit]

    async def count(self) -> int:
        return await self.redis.zcard(AUDIT_INDEX_KEY)

    async def stats(self) -> dict:
        all_ids = await self.redis.zrevrange(AUDIT_INDEX_KEY, 0, -1)
        action_counts: dict[str, int] = {}
        user_counts: dict[str, int] = {}

        for eid in all_ids:
            data = await self.redis.hget(AUDIT_KEY, eid if isinstance(eid, str) else eid.decode())
            if not data:
                continue
            try:
                event = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                continue

            action = event.get("action", "unknown")
            user = event.get("user", "unknown")
            action_counts[action] = action_counts.get(action, 0) + 1
            user_counts[user] = user_counts.get(user, 0) + 1

        top_actions = sorted(action_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        top_users = sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            "total": len(all_ids),
            "top_actions": [{"action": a, "count": c} for a, c in top_actions],
            "top_users": [{"user": u, "count": c} for u, c in top_users],
        }


_audit_logger: AuditLogger | None = None


async def get_audit_logger() -> AuditLogger:
    global _audit_logger
    if _audit_logger is None:
        import os
        redis_url = os.getenv("REDIS_URL", "redis://:changeme@redis:6379/0")
        r = aioredis.from_url(redis_url, decode_responses=True)
        _audit_logger = AuditLogger(r)
    return _audit_logger
