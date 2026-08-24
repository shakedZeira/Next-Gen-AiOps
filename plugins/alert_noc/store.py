import asyncio
import json
import logging
import uuid
from datetime import datetime

import redis.asyncio as aioredis

logger = logging.getLogger("alert_noc.store")

from plugins.alert_noc.config import AlertNOCConfig
from plugins.alert_noc.dedup import AlertDeduplicator
from plugins.alert_noc.models import AlertCreate, AlertResponse, AlertStatus
from plugins.alert_noc.suppression import AlertSuppressor
from plugins.alert_noc.storm import StormDetector
from plugins.alert_noc.maintenance import MaintenanceStore
from plugins.alert_noc.escalation import EscalationEngine

ALERTS_CHANNEL = "alerts:events"


class AlertStore:
    def __init__(self):
        config = AlertNOCConfig()
        self.redis = aioredis.from_url(config.REDIS_URL)
        self.dedup = AlertDeduplicator(self.redis)
        self.suppressor = AlertSuppressor(self.redis)
        self.storm = StormDetector(self.redis)
        self.maintenance = MaintenanceStore(self.redis)
        self.escalation = EscalationEngine(self.redis)
        self._ws_clients: set = set()

    async def _publish(self, event_type: str, alert: AlertResponse):
        event = {"type": event_type, "alert": alert.model_dump(mode="json")}
        await self.redis.publish(ALERTS_CHANNEL, json.dumps(event))

    def add_ws_client(self, ws):
        self._ws_clients.add(ws)

    def remove_ws_client(self, ws):
        self._ws_clients.discard(ws)

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
                await self._publish("alert.repeat", existing)
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

        suppressed, primary_id = await self.suppressor.check_suppress(alert)
        if suppressed:
            alert.suppressed = True
            alert.suppressed_by = primary_id
            alert.suppressed_at = now
            await self.redis.hset("alerts", alert_id, alert.model_dump_json())
            await self.redis.sadd("alerts:active", alert_id)
            await self.suppressor.register_alert(alert)
            await self.dedup.increment_stats("total_created")
            await self.dedup.increment_stats("suppressed")
            logger.info("Alert suppressed: %s by %s", alert.name, primary_id)
            return alert

        mute_window = await self.maintenance.check_mute(data.service)
        if mute_window:
            alert.muted = True
            alert.muted_by = mute_window.id
            await self.redis.hset("alerts", alert_id, alert.model_dump_json())
            await self.redis.sadd("alerts:active", alert_id)
            await self.dedup.increment_stats("total_created")
            await self.dedup.increment_stats("muted")
            await self.suppressor.register_alert(alert)
            logger.info("Alert muted during maintenance %s: %s", mute_window.name, alert.name)
            return alert

        await self.storm.record_alert(alert_id, data.service, data.severity, now)

        storm = await self.storm.check_storm()
        if storm and storm.throttled:
            root_cause_id = await self.storm.get_root_cause_alert()
            if alert_id != root_cause_id:
                alert.throttled = True
                alert.storm_id = storm.id
                await self.redis.hset("alerts", alert_id, alert.model_dump_json())
                await self.redis.sadd("alerts:active", alert_id)
                await self.dedup.increment_stats("total_created")
                await self.dedup.increment_stats("throttled")
                await self.suppressor.register_alert(alert)
                logger.info("Alert throttled in storm %s: %s", storm.id, alert.name)
                return alert
            else:
                alert.storm_id = storm.id

        await self.redis.hset("alerts", alert_id, alert.model_dump_json())
        await self.redis.sadd("alerts:active", alert_id)
        await self.dedup.register_dedup(data.service, normalized, alert_id)
        await self.dedup.increment_stats("total_created")
        await self.suppressor.register_alert(alert)
        await self._publish("alert.created", alert)
        return alert

    async def get_alert(self, alert_id: str) -> AlertResponse | None:
        data = await self.redis.hget("alerts", alert_id)
        if data:
            try:
                return AlertResponse.model_validate_json(data)
            except Exception:
                return None
        return None

    async def list_alerts(self, status: str | None = None, team: str | None = None, suppressed: bool | None = None, throttled: bool | None = None, muted: bool | None = None) -> list[AlertResponse]:
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
                if suppressed is not None:
                    if alert.suppressed != suppressed:
                        continue
                elif alert.suppressed:
                    continue
                if throttled is not None:
                    if alert.throttled != throttled:
                        continue
                if muted is not None:
                    if alert.muted != muted:
                        continue
                elif alert.muted:
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
        if not alerts:
            return []

        # Step 1: group by initial incident_id
        raw_groups: dict[str, list[AlertResponse]] = {}
        for alert in alerts:
            iid = alert.incident_id or alert.id
            raw_groups.setdefault(iid, []).append(alert)

        # Step 2: merge groups that are related (same service + overlapping names / cascade)
        merged = self._merge_related_incidents(list(raw_groups.values()))

        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
        result = []
        for group in merged:
            top_severity = max(group, key=lambda a: severity_order.get(a.severity, 0)).severity
            first = min((a.first_seen or a.created_at) for a in group)
            last = max((a.last_seen or a.created_at) for a in group)
            teams = list({a.team for a in group if a.team})
            services = list({a.service for a in group if a.service})
            result.append({
                "incident_id": group[0].incident_id or group[0].id,
                "title": self._derive_incident_title(group),
                "service": services[0] if len(services) == 1 else f"{services[0]} +{len(services)-1}" if services else "unknown",
                "severity": top_severity,
                "alert_count": len(group),
                "alerts": [a.model_dump() for a in group],
                "first_seen": first.isoformat() if first else None,
                "last_seen": last.isoformat() if last else None,
                "teams": teams,
                "services": services,
                "status": "active" if any(a.status == AlertStatus.ACTIVE for a in group) else "acknowledged" if any(a.status == AlertStatus.ACKNOWLEDGED for a in group) else "resolved",
            })

        return sorted(result, key=lambda i: severity_order.get(i["severity"], 0), reverse=True)

    def _merge_related_incidents(self, groups: list[list[AlertResponse]]) -> list[list[AlertResponse]]:
        if len(groups) <= 1:
            return groups

        # Build an index: service -> list of group indices
        service_idx: dict[str, list[int]] = {}
        for i, group in enumerate(groups):
            for svc in {a.service for a in group if a.service}:
                service_idx.setdefault(svc, []).append(i)

        # Union-Find for merging
        parent = list(range(len(groups)))

        def find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(x: int, y: int):
            rx, ry = find(x), find(y)
            if rx != ry:
                parent[rx] = ry

        # Merge groups in the same service if they share normalized name patterns
        for svc, indices in service_idx.items():
            for i in range(len(indices)):
                for j in range(i + 1, len(indices)):
                    gi, gj = groups[indices[i]], groups[indices[j]]
                    if self._should_merge(gi, gj):
                        union(indices[i], indices[j])

        # Collect merged groups
        buckets: dict[int, list[AlertResponse]] = {}
        for i, group in enumerate(groups):
            root = find(i)
            buckets.setdefault(root, []).extend(group)

        # Deduplicate alerts that ended up in the same bucket
        result = []
        for alerts in buckets.values():
            seen = set()
            deduped = []
            for a in alerts:
                if a.id not in seen:
                    seen.add(a.id)
                    deduped.append(a)
            result.append(deduped)

        return result

    def _should_merge(self, group_a: list[AlertResponse], group_b: list[AlertResponse]) -> bool:
        names_a = {self._base_name(a.name) for a in group_a}
        names_b = {self._base_name(a.name) for a in group_b}

        # Same normalized name pattern → definitely related
        if names_a & names_b:
            return True

        # Shared keywords in alert names (e.g. both mention "latency" or "disk")
        kw_a = set()
        kw_b = set()
        for n in names_a:
            kw_a.update(n.lower().split())
        for n in names_b:
            kw_b.update(n.lower().split())
        shared = kw_a & kw_b - {"the", "a", "is", "on", "for", "and", "or", "of", "in", "at", "to"}
        if len(shared) >= 2:
            return True

        # Same service + similar time window (within 10 min) + same severity
        times_a = [(a.first_seen or a.created_at) for a in group_a]
        times_b = [(a.first_seen or a.created_at) for a in group_b]
        sevs_a = {a.severity for a in group_a}
        sevs_b = {a.severity for a in group_b}
        if sevs_a & sevs_b:
            for ta in times_a:
                for tb in times_b:
                    if abs((ta - tb).total_seconds()) < 600:
                        return True

        return False

    def _base_name(self, name: str) -> str:
        import re
        n = name.lower()
        n = re.sub(r'\bp\d+\b', '', n)
        n = re.sub(r'\b\d+/\d+\b', 'n/n', n)
        n = re.sub(r'\s+', ' ', n).strip()
        return n

    def _derive_incident_title(self, alerts: list[AlertResponse]) -> str:
        if len(alerts) == 1:
            return alerts[0].name
        from collections import Counter
        name_counts = Counter(self._base_name(a.name) for a in alerts)
        most_common = name_counts.most_common(1)[0][0]
        services = {a.service for a in alerts if a.service}
        svc_str = services.pop() if len(services) == 1 else f"{next(iter(services))} +{len(services)-1}" if services else ""
        return f"{most_common} ({len(alerts)} alerts, {svc_str})" if svc_str else f"{most_common} ({len(alerts)} alerts)"

    async def get_incident(self, incident_id: str) -> dict | None:
        """Fetch a single incident by ID, using the same merging logic as list_incidents."""
        alerts = await self.list_all_alerts()
        if not alerts:
            return None

        # Group by initial incident_id, then merge like list_incidents does
        raw_groups: dict[str, list[AlertResponse]] = {}
        for alert in alerts:
            iid = alert.incident_id or alert.id
            raw_groups.setdefault(iid, []).append(alert)

        merged = self._merge_related_incidents(list(raw_groups.values()))

        # Find the group that contains an alert whose incident_id matches
        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
        for group in merged:
            group_iids = {a.incident_id or a.id for a in group}
            if incident_id in group_iids:
                top_severity = max(group, key=lambda a: severity_order.get(a.severity, 0)).severity
                first = min((a.first_seen or a.created_at) for a in group)
                last = max((a.last_seen or a.created_at) for a in group)
                teams = list({a.team for a in group if a.team})
                services = list({a.service for a in group if a.service})
                return {
                    "incident_id": incident_id,
                    "title": self._derive_incident_title(group),
                    "service": services[0] if len(services) == 1 else f"{services[0]} +{len(services)-1}" if services else "unknown",
                    "severity": top_severity,
                    "alert_count": len(group),
                    "alerts": [a.model_dump() for a in sorted(group, key=lambda a: a.created_at)],
                    "first_seen": first.isoformat() if first else None,
                    "last_seen": last.isoformat() if last else None,
                    "teams": teams,
                    "services": services,
                    "status": "active" if any(a.status == AlertStatus.ACTIVE for a in group) else "acknowledged" if any(a.status == AlertStatus.ACKNOWLEDGED for a in group) else "resolved",
                }

        return None

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
        await self._publish("alert.acknowledged", alert)
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
        await self._publish("alert.resolved", alert)
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
