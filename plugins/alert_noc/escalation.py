import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from plugins.alert_noc.models import AlertResponse, AlertStatus

logger = logging.getLogger(__name__)


@dataclass
class EscalationLevel:
    level: int
    timeout_seconds: int
    target: str
    label: str


@dataclass
class EscalationEvent:
    alert_id: str
    level: int
    escalated_at: str
    escalated_to: str
    acknowledged: bool = False


LEVELS = [
    EscalationLevel(level=1, timeout_seconds=0, target="team", label="Team"),
    EscalationLevel(level=2, timeout_seconds=900, target="lead", label="Team Lead"),
    EscalationLevel(level=3, timeout_seconds=1800, target="manager", label="On-Call Manager"),
    EscalationLevel(level=4, timeout_seconds=3600, target="vp", label="VP/CTO"),
]

ESCALATION_KEY = "alerts:escalations"


class EscalationEngine:
    def __init__(self, redis):
        self.redis = redis
        self._running = False
        self._started_at = datetime.utcnow()

    async def get_escalation_history(self, alert_id: str) -> list[dict]:
        data = await self.redis.hget(ESCALATION_KEY, alert_id)
        if not data:
            return []
        try:
            events = json.loads(data)
            return events
        except (json.JSONDecodeError, TypeError):
            return []

    async def _save_history(self, alert_id: str, events: list[dict]):
        await self.redis.hset(ESCALATION_KEY, alert_id, json.dumps(events))

    async def escalate(self, alert: AlertResponse, level: int) -> EscalationEvent | None:
        if level < 2 or level > len(LEVELS):
            return None

        target_level = LEVELS[level - 1]
        event = EscalationEvent(
            alert_id=alert.id,
            level=level,
            escalated_at=datetime.utcnow().isoformat(),
            escalated_to=f"{target_level.target}@aiops.local",
        )

        history = await self.get_escalation_history(alert.id)
        history.append({
            "level": level,
            "escalated_at": event.escalated_at,
            "escalated_to": event.escalated_to,
            "acknowledged": False,
        })
        await self._save_history(alert.id, history)

        logger.info("Alert %s escalated to L%d (%s)", alert.id[:8], level, event.escalated_to)
        return event

    async def acknowledge_at_level(self, alert_id: str, level: int) -> bool:
        history = await self.get_escalation_history(alert_id)
        updated = False
        for event in history:
            if event["level"] == level:
                event["acknowledged"] = True
                updated = True
        if updated:
            await self._save_history(alert_id, history)
        return updated

    async def check_escalations(self, alert_store) -> list[dict]:
        from plugins.alert_noc.store import alert_store as store
        alerts = await store.list_alerts(status="active")
        escalated = []

        for alert in alerts:
            if alert.status != AlertStatus.ACTIVE:
                continue
            if alert.acknowledged_at:
                continue
            if alert.created_at < self._started_at:
                continue

            age = (datetime.utcnow() - alert.created_at).total_seconds()

            current_level = alert.escalation_level or 1
            for target_level in LEVELS:
                if target_level.level <= current_level:
                    continue
                if age >= target_level.timeout_seconds:
                    event = await self.escalate(alert, target_level.level)
                    if event:
                        alert.escalation_level = target_level.level
                        alert.escalated_at = event.escalated_at
                        alert.escalated_to = event.escalated_to
                        await store.redis.hset("alerts", alert.id, alert.model_dump_json())
                        escalated.append({
                            "alert_id": alert.id,
                            "level": target_level.level,
                            "escalated_to": event.escalated_to,
                            "alert_name": alert.name,
                        })

        return escalated

    async def run_background_check(self, alert_store, publish_fn):
        try:
            escalated = await self.check_escalations(alert_store)
            for item in escalated:
                if publish_fn:
                    await publish_fn("alert.escalated", item)
        except Exception as e:
            logger.error("Escalation check error: %s", e)
