import json
import re
import uuid
from difflib import SequenceMatcher

import redis.asyncio as aioredis


class AlertDeduplicator:
    DEDUP_WINDOW = 300  # 5 minutes
    GROUP_SIMILARITY = 0.75
    STATS_KEY = "alert:stats"

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client

    def normalize_name(self, name: str) -> str:
        normalized = name.lower()
        normalized = re.sub(r'\bp\d+\b', '', normalized)
        normalized = re.sub(r'gigabitethernet0/\d+', 'gigabitethernet0/n', normalized)
        normalized = re.sub(r'\b\d+/\d+\b', 'n/n', normalized)
        normalized = re.sub(r'0x[0-9a-f]+', '', normalized)
        normalized = re.sub(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b', '', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        return normalized

    def _similarity(self, a: str, b: str) -> float:
        return SequenceMatcher(None, a, b).ratio()

    async def check_dedup(self, service: str, normalized_name: str) -> str | None:
        dedup_key = f"dedup:{service}:{normalized_name}"
        existing_id = await self.redis.get(dedup_key)
        if existing_id:
            return existing_id.decode() if isinstance(existing_id, bytes) else existing_id
        return None

    async def register_dedup(self, service: str, normalized_name: str, alert_id: str):
        dedup_key = f"dedup:{service}:{normalized_name}"
        await self.redis.set(dedup_key, alert_id, ex=self.DEDUP_WINDOW)

    async def find_or_create_incident(self, service: str, normalized_name: str) -> str:
        scan_cursor = None
        while True:
            scan_cursor, keys = await self.redis.scan(
                scan_cursor or 0, match="alerts:*", count=50
            )
            for key in keys:
                key_str = key.decode() if isinstance(key, bytes) else key
                if key_str.startswith("dedup:"):
                    continue
                if key_str.startswith("alerts:"):
                    continue
                data = await self.redis.hget("alerts", key_str)
                if not data:
                    continue
                try:
                    alert = json.loads(data)
                except (json.JSONDecodeError, TypeError):
                    continue
                if alert.get("service") != service:
                    continue
                if alert.get("status") not in ("active", "acknowledged"):
                    continue
                existing_norm = alert.get("normalized_name", "")
                if not existing_norm:
                    existing_norm = self.normalize_name(alert.get("name", ""))
                if self._similarity(normalized_name, existing_norm) >= self.GROUP_SIMILARITY:
                    incident_id = alert.get("incident_id")
                    if incident_id:
                        return incident_id
            if scan_cursor == 0:
                break

        return str(uuid.uuid4())

    async def increment_stats(self, field: str):
        await self.redis.hincrby(self.STATS_KEY, field, 1)

    async def get_stats(self) -> dict:
        stats = await self.redis.hgetall(self.STATS_KEY)
        return {
            "total_created": int(stats.get(b"total_created", 0)),
            "deduplicated": int(stats.get(b"deduplicated", 0)),
            "incidents_formed": int(stats.get(b"incidents_formed", 0)),
            "throttled": int(stats.get(b"throttled", 0)),
        }
