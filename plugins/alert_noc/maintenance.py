import json
import logging
import uuid
from datetime import datetime

import redis.asyncio as aioredis

logger = logging.getLogger("alert_noc.maintenance")


class MaintenanceWindow:
    def __init__(
        self,
        id: str,
        name: str,
        service: str,
        start_time: str,
        end_time: str,
        created_by: str = "system",
        reason: str = "",
        status: str = "active",
        created_at: str | None = None,
    ):
        self.id = id
        self.name = name
        self.service = service
        self.start_time = start_time
        self.end_time = end_time
        self.created_by = created_by
        self.reason = reason
        self.status = status
        self.created_at = created_at or datetime.utcnow().isoformat()

    def is_active(self) -> bool:
        now = datetime.utcnow()
        start_str = self.start_time.replace("Z", "+00:00")
        end_str = self.end_time.replace("Z", "+00:00")
        start = datetime.fromisoformat(start_str).replace(tzinfo=None)
        end = datetime.fromisoformat(end_str).replace(tzinfo=None)
        return start <= now <= end and self.status == "active"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "service": self.service,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "created_by": self.created_by,
            "reason": self.reason,
            "status": self.status,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "MaintenanceWindow":
        return cls(**data)


class MaintenanceStore:
    def __init__(self, redis: aioredis.Redis):
        self.redis = redis
        self._key = "maintenance:windows"

    async def create_window(
        self, name: str, service: str, start_time: str, end_time: str,
        created_by: str = "system", reason: str = ""
    ) -> MaintenanceWindow:
        window_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        window = MaintenanceWindow(
            id=window_id,
            name=name,
            service=service,
            start_time=start_time,
            end_time=end_time,
            created_by=created_by,
            reason=reason,
            created_at=now,
        )
        await self.redis.hset(self._key, window_id, json.dumps(window.to_dict()))
        logger.info("Maintenance window created: %s for %s", name, service)
        return window

    async def get_window(self, window_id: str) -> MaintenanceWindow | None:
        data = await self.redis.hget(self._key, window_id)
        if data:
            try:
                return MaintenanceWindow.from_dict(json.loads(data))
            except (json.JSONDecodeError, KeyError, TypeError):
                return None
        return None

    async def list_windows(self, status: str | None = None) -> list[MaintenanceWindow]:
        all_data = await self.redis.hgetall(self._key)
        windows = []
        for raw in all_data.values():
            try:
                w = MaintenanceWindow.from_dict(json.loads(raw))
                if status and w.status != status:
                    continue
                windows.append(w)
            except (json.JSONDecodeError, KeyError, TypeError):
                pass
        return sorted(windows, key=lambda w: w.start_time, reverse=True)

    async def get_active_windows(self) -> list[MaintenanceWindow]:
        all_data = await self.redis.hgetall(self._key)
        windows = []
        for raw in all_data.values():
            try:
                w = MaintenanceWindow.from_dict(json.loads(raw))
                if w.is_active():
                    windows.append(w)
            except (json.JSONDecodeError, KeyError, TypeError):
                pass
        return windows

    async def cancel_window(self, window_id: str) -> MaintenanceWindow | None:
        window = await self.get_window(window_id)
        if not window:
            return None
        window.status = "cancelled"
        await self.redis.hset(self._key, window_id, json.dumps(window.to_dict()))
        logger.info("Maintenance window cancelled: %s", window.name)
        return window

    async def check_mute(self, service: str) -> MaintenanceWindow | None:
        active = await self.get_active_windows()
        for w in active:
            if w.service == service or w.service == "*":
                return w
        return None

    async def cleanup_expired(self) -> int:
        now = datetime.utcnow()
        all_data = await self.redis.hgetall(self._key)
        removed = 0
        for wid, raw in all_data.items():
            try:
                w = MaintenanceWindow.from_dict(json.loads(raw))
                if w.status == "active":
                    end_str = w.end_time.replace("Z", "+00:00")
                    end = datetime.fromisoformat(end_str).replace(tzinfo=None)
                    if now > end:
                        w.status = "expired"
                        await self.redis.hset(self._key, wid, json.dumps(w.to_dict()))
                        removed += 1
            except (json.JSONDecodeError, KeyError, TypeError):
                pass
        return removed
