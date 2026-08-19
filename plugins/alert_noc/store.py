import json
import uuid
from datetime import datetime
import redis.asyncio as aioredis
from plugins.alert_noc.models import AlertCreate, AlertResponse, AlertStatus


class AlertStore:
    def __init__(self):
        self.redis = aioredis.from_url("redis://redis:6379/0")

    async def create_alert(self, data: AlertCreate) -> AlertResponse:
        alert_id = str(uuid.uuid4())
        alert = AlertResponse(
            id=alert_id, **data.model_dump(),
            status=AlertStatus.ACTIVE, created_at=datetime.utcnow(),
        )
        await self.redis.hset("alerts", alert_id, alert.model_dump_json())
        await self.redis.sadd("alerts:active", alert_id)
        return alert

    async def get_alert(self, alert_id: str) -> AlertResponse | None:
        data = await self.redis.hget("alerts", alert_id)
        if data:
            return AlertResponse.model_validate_json(data)
        return None

    async def list_alerts(self, status: str | None = None, team: str | None = None) -> list[AlertResponse]:
        if status:
            ids = await self.redis.smembers(f"alerts:{status}")
        else:
            ids = await self.redis.smembers("alerts:active")
        alerts = []
        for alert_id in ids:
            alert = await self.get_alert(alert_id.decode() if isinstance(alert_id, bytes) else alert_id)
            if alert:
                if team and alert.team != team:
                    continue
                alerts.append(alert)
        return sorted(alerts, key=lambda a: a.created_at, reverse=True)

    async def acknowledge(self, alert_id: str, acknowledged_by: str) -> bool:
        alert = await self.get_alert(alert_id)
        if not alert:
            return False
        alert.status = AlertStatus.ACKNOWLEDGED
        alert.acknowledged_at = datetime.utcnow()
        alert.acknowledged_by = acknowledged_by
        await self.redis.hset("alerts", alert_id, alert.model_dump_json())
        await self.redis.srem("alerts:active", alert_id)
        await self.redis.sadd("alerts:acknowledged", alert_id)
        return True

    async def resolve(self, alert_id: str) -> bool:
        alert = await self.get_alert(alert_id)
        if not alert:
            return False
        alert.status = AlertStatus.RESOLVED
        alert.resolved_at = datetime.utcnow()
        await self.redis.hset("alerts", alert_id, alert.model_dump_json())
        await self.redis.srem("alerts:active", alert_id)
        await self.redis.srem("alerts:acknowledged", alert_id)
        await self.redis.sadd("alerts:resolved", alert_id)
        return True

    async def get_alert_groups(self) -> list[dict]:
        alerts = await self.list_alerts("active")
        groups = {}
        for alert in alerts:
            key = f"{alert.service}:{alert.severity}"
            if key not in groups:
                groups[key] = {"service": alert.service, "severity": alert.severity, "count": 0, "alerts": []}
            groups[key]["count"] += 1
            groups[key]["alerts"].append(alert)
        return list(groups.values())


alert_store = AlertStore()
