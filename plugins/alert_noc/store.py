import uuid
from datetime import datetime

import redis.asyncio as aioredis

from plugins.alert_noc.config import AlertNOCConfig
from plugins.alert_noc.dedup import AlertDeduplicator
from plugins.alert_noc.models import AlertCreate, AlertResponse, AlertStatus


class AlertStore:
    def __init__(self):
        config = AlertNOCConfig()
        self.redis = aioredis.from_url(config.REDIS_URL)
        self.dedup = AlertDeduplicator(self.redis)

    async def create_alert(self, data: AlertCreate) -> AlertResponse:
        normalized = self.dedup.normalize_name(data.name)

        existing_id = await self.dedup.check_dedup(data.service, normalized)
        if existing_id:
            existing = await self.get_alert(existing_id)
            if existing and existing.status == AlertStatus.ACTIVE:
                existing.repeat_count += 1
                existing.last_seen = datetime.utcnow()
                await self.redis.hset("alerts", existing_id, existing.model_dump_json())
                await self.dedup.increment_stats("deduplicated")
                return existing

        incident_id = await self.dedup.find_or_create_incident(data.service, normalized)

        alert_id = str(uuid.uuid4())
        now = datetime.utcnow()
        alert = AlertResponse(
            id=alert_id, **data.model_dump(),
            status=AlertStatus.ACTIVE,
            created_at=now,
            first_seen=now,
            last_seen=now,
            repeat_count=1,
            incident_id=incident_id,
            normalized_name=normalized,
        )
        await self.redis.hset("alerts", alert_id, alert.model_dump_json())
        await self.redis.sadd("alerts:active", alert_id)
        await self.dedup.register_dedup(data.service, normalized, alert_id)
        await self.dedup.increment_stats("total_created")
        return alert

    async def get_alert(self, alert_id: str) -> AlertResponse | None:
        data = await self.redis.hget("alerts", alert_id)
        if data:
            try:
                return AlertResponse.model_validate_json(data)
            except Exception:
                return None
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

    async def list_all_alerts(self) -> list[AlertResponse]:
        """List ALL alerts across all statuses."""
        all_ids: set[bytes] = set()
        for status in ("active", "acknowledged", "resolved"):
            ids = await self.redis.smembers(f"alerts:{status}")
            all_ids.update(ids)
        alerts = []
        for alert_id in all_ids:
            alert = await self.get_alert(alert_id.decode() if isinstance(alert_id, bytes) else alert_id)
            if alert:
                alerts.append(alert)
        return sorted(alerts, key=lambda a: a.created_at, reverse=True)

    async def list_incidents(self, status: str | None = None) -> list[dict]:
        alerts = await self.list_alerts(status)
        incidents: dict[str, list[AlertResponse]] = {}
        for alert in alerts:
            iid = alert.incident_id or alert.id
            if iid not in incidents:
                incidents[iid] = []
            incidents[iid].append(alert)

        result = []
        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
        for iid, inc_alerts in incidents.items():
            if len(inc_alerts) < 1:
                continue
            top_severity = max(inc_alerts, key=lambda a: severity_order.get(a.severity, 0)).severity
            first = min((a.first_seen or a.created_at) for a in inc_alerts)
            last = max((a.last_seen or a.created_at) for a in inc_alerts)
            teams = list({a.team for a in inc_alerts if a.team})
            result.append({
                "incident_id": iid,
                "title": inc_alerts[0].name,
                "service": inc_alerts[0].service,
                "severity": top_severity,
                "alert_count": len(inc_alerts),
                "alerts": [a.model_dump() for a in inc_alerts],
                "first_seen": first.isoformat() if first else None,
                "last_seen": last.isoformat() if last else None,
                "teams": teams,
                "status": "active" if any(a.status == AlertStatus.ACTIVE for a in inc_alerts) else "acknowledged" if any(a.status == AlertStatus.ACKNOWLEDGED for a in inc_alerts) else "resolved",
            })

        return sorted(result, key=lambda i: severity_order.get(i["severity"], 0), reverse=True)

    async def get_incident(self, incident_id: str) -> dict | None:
        """Fetch a single incident by ID."""
        alerts = await self.list_all_alerts()
        inc_alerts = [a for a in alerts if (a.incident_id or a.id) == incident_id]
        if not inc_alerts:
            return None

        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
        top_severity = max(inc_alerts, key=lambda a: severity_order.get(a.severity, 0)).severity
        first = min((a.first_seen or a.created_at) for a in inc_alerts)
        last = max((a.last_seen or a.created_at) for a in inc_alerts)
        teams = list({a.team for a in inc_alerts if a.team})

        return {
            "incident_id": incident_id,
            "title": inc_alerts[0].name,
            "service": inc_alerts[0].service,
            "severity": top_severity,
            "alert_count": len(inc_alerts),
            "alerts": [a.model_dump() for a in sorted(inc_alerts, key=lambda a: a.created_at)],
            "first_seen": first.isoformat() if first else None,
            "last_seen": last.isoformat() if last else None,
            "teams": teams,
            "status": "active" if any(a.status == AlertStatus.ACTIVE for a in inc_alerts) else "acknowledged" if any(a.status == AlertStatus.ACKNOWLEDGED for a in inc_alerts) else "resolved",
        }

    async def acknowledge_incident(self, incident_id: str, acknowledged_by: str) -> int:
        """Bulk acknowledge all active alerts in an incident. Returns count acknowledged."""
        alerts = await self.list_all_alerts()
        count = 0
        for alert in alerts:
            if (alert.incident_id or alert.id) == incident_id and alert.status == AlertStatus.ACTIVE:
                await self.acknowledge(alert.id, acknowledged_by)
                count += 1
        return count

    async def resolve_incident(self, incident_id: str) -> int:
        """Bulk resolve all alerts in an incident. Returns count resolved."""
        alerts = await self.list_all_alerts()
        count = 0
        for alert in alerts:
            if (alert.incident_id or alert.id) == incident_id and alert.status != AlertStatus.RESOLVED:
                await self.resolve(alert.id)
                count += 1
        return count

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
            groups[key]["alerts"].append(alert.model_dump())
        return list(groups.values())


alert_store = AlertStore()
