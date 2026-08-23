import json
import logging
import uuid
from datetime import datetime, timedelta

import redis.asyncio as aioredis

logger = logging.getLogger("alert_noc.storm")

STORM_ALERT_THRESHOLD = 10
STORM_ALERT_WINDOW_SECONDS = 60
STORM_SERVICE_THRESHOLD = 5
STORM_SERVICE_WINDOW_SECONDS = 120
STORM_COOLDOWN_SECONDS = 300

SEVERITY_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}


class StormEvent:
    def __init__(
        self,
        id: str,
        detected_at: datetime,
        alert_count: int,
        affected_services: list[str],
        root_cause_alert_id: str,
        status: str = "active",
        throttled: bool = True,
        cleared_at: datetime | None = None,
    ):
        self.id = id
        self.detected_at = detected_at
        self.cleared_at = cleared_at
        self.alert_count = alert_count
        self.affected_services = affected_services
        self.root_cause_alert_id = root_cause_alert_id
        self.status = status
        self.throttled = throttled

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "detected_at": self.detected_at.isoformat(),
            "cleared_at": self.cleared_at.isoformat() if self.cleared_at else None,
            "alert_count": self.alert_count,
            "affected_services": self.affected_services,
            "root_cause_alert_id": self.root_cause_alert_id,
            "status": self.status,
            "throttled": self.throttled,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "StormEvent":
        return cls(
            id=data["id"],
            detected_at=datetime.fromisoformat(data["detected_at"]),
            cleared_at=datetime.fromisoformat(data["cleared_at"]) if data.get("cleared_at") else None,
            alert_count=data["alert_count"],
            affected_services=data.get("affected_services", []),
            root_cause_alert_id=data["root_cause_alert_id"],
            status=data.get("status", "active"),
            throttled=data.get("throttled", True),
        )


class StormDetector:
    def __init__(self, redis: aioredis.Redis):
        self.redis = redis
        self._recent_key = "alerts:recent_for_storm"
        self._active_storm_key = "alerts:active_storm"
        self._storms_key = "alerts:storms"

    async def record_alert(self, alert_id: str, service: str, severity: str, created_at: datetime) -> None:
        entry = {"id": alert_id, "service": service, "severity": severity}
        score = created_at.timestamp()
        await self.redis.zadd(self._recent_key, {json.dumps(entry): score})

        cutoff = datetime.utcnow() - timedelta(seconds=STORM_ALERT_WINDOW_SECONDS + 10)
        await self.redis.zremrangebyscore(self._recent_key, "-inf", cutoff.timestamp())

    async def check_storm(self) -> StormEvent | None:
        existing = await self.get_active_storm()
        if existing:
            await self._extend_storm(existing)
            return existing

        now = datetime.utcnow()
        window_start = now - timedelta(seconds=STORM_ALERT_WINDOW_SECONDS)
        recent = await self.redis.zrangebyscore(self._recent_key, window_start.timestamp(), "+inf")

        if len(recent) >= STORM_ALERT_THRESHOLD:
            return await self._create_storm(recent, now)

        svc_window_start = now - timedelta(seconds=STORM_SERVICE_WINDOW_SECONDS)
        svc_recent = await self.redis.zrangebyscore(self._recent_key, svc_window_start.timestamp(), "+inf")
        services = set()
        for raw in svc_recent:
            try:
                entry = json.loads(raw)
                services.add(entry.get("service", ""))
            except (json.JSONDecodeError, TypeError):
                pass

        if len(services) >= STORM_SERVICE_THRESHOLD:
            return await self._create_storm(svc_recent, now)

        return None

    async def _create_storm(self, alert_entries: list, now: datetime) -> StormEvent:
        services = set()
        best_sev = -1
        root_cause_id = None

        for raw in alert_entries:
            try:
                entry = json.loads(raw)
                services.add(entry.get("service", ""))
                sev = SEVERITY_ORDER.get(entry.get("severity", "info"), 0)
                if sev > best_sev:
                    best_sev = sev
                    root_cause_id = entry.get("id")
            except (json.JSONDecodeError, TypeError):
                pass

        storm_id = str(uuid.uuid4())
        storm = StormEvent(
            id=storm_id,
            detected_at=now,
            alert_count=len(alert_entries),
            affected_services=sorted(services),
            root_cause_alert_id=root_cause_id or "",
        )

        await self.redis.set(self._active_storm_key, json.dumps(storm.to_dict()))
        await self.redis.zadd(
            self._storms_key,
            {json.dumps(storm.to_dict()): now.timestamp()},
        )

        cutoff = now - timedelta(days=7)
        await self.redis.zremrangebyscore(self._storms_key, "-inf", cutoff.timestamp())

        logger.info(
            "Storm detected: %d alerts, %d services, root cause: %s",
            storm.alert_count,
            len(storm.affected_services),
            storm.root_cause_alert_id,
        )
        return storm

    async def _extend_storm(self, storm: StormEvent) -> None:
        now = datetime.utcnow()
        storm_window = now - timedelta(seconds=STORM_ALERT_WINDOW_SECONDS)
        recent = await self.redis.zrangebyscore(self._recent_key, storm_window.timestamp(), "+inf")
        storm.alert_count = len(recent)

        services = set()
        for raw in recent:
            try:
                entry = json.loads(raw)
                services.add(entry.get("service", ""))
            except (json.JSONDecodeError, TypeError):
                pass
        storm.affected_services = sorted(services)

        await self.redis.set(self._active_storm_key, json.dumps(storm.to_dict()))

    async def get_active_storm(self) -> StormEvent | None:
        data = await self.redis.get(self._active_storm_key)
        if not data:
            return None
        try:
            storm = StormEvent.from_dict(json.loads(data))
            if storm.status != "active":
                return None
            if storm.detected_at + timedelta(seconds=STORM_COOLDOWN_SECONDS) < datetime.utcnow():
                await self.clear_storm(storm.id)
                return None
            return storm
        except (json.JSONDecodeError, KeyError, TypeError):
            return None

    async def clear_storm(self, storm_id: str) -> StormEvent | None:
        data = await self.redis.get(self._active_storm_key)
        if not data:
            return None
        try:
            storm = StormEvent.from_dict(json.loads(data))
            if storm.id != storm_id:
                return None
            storm.status = "cleared"
            storm.cleared_at = datetime.utcnow()
            storm.throttled = False
            await self.redis.delete(self._active_storm_key)
            await self.redis.zadd(
                self._storms_key,
                {json.dumps(storm.to_dict()): storm.detected_at.timestamp()},
            )
            logger.info("Storm cleared: %s", storm_id)
            return storm
        except (json.JSONDecodeError, KeyError, TypeError):
            return None

    async def is_throttled(self, alert_service: str, alert_severity: str) -> bool:
        storm = await self.get_active_storm()
        if not storm or not storm.throttled:
            return False
        if storm.root_cause_alert_id:
            return True
        return True

    async def get_storms(self, limit: int = 20) -> list[dict]:
        raw = await self.redis.zrevrange(self._storms_key, 0, limit - 1)
        storms = []
        for entry in raw:
            try:
                storms.append(json.loads(entry))
            except (json.JSONDecodeError, TypeError):
                pass
        return storms

    async def get_root_cause_alert(self) -> str | None:
        storm = await self.get_active_storm()
        if storm:
            return storm.root_cause_alert_id
        return None
