import json
import logging
from datetime import datetime, timedelta

import redis.asyncio as aioredis

from plugins.alert_noc.models import AlertResponse

logger = logging.getLogger("alert_noc.suppression")

SEVERITY_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}

SUPPRESSION_WINDOW_SECONDS = 300  # 5 minutes
SUPPRESSION_TTL_SECONDS = 600  # 10 minutes auto-expire


class AlertSuppressor:
    def __init__(self, redis: aioredis.Redis):
        self.redis = redis
        self._key = "alerts:recent_for_suppression"

    async def check_suppress(self, alert: AlertResponse) -> tuple[bool, str | None]:
        """Check if alert should be suppressed. Returns (suppressed, primary_alert_id)."""
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=SUPPRESSION_WINDOW_SECONDS)

        recent_raw = await self.redis.zrangebyscore(
            self._key,
            cutoff.timestamp(),
            "+inf",
        )

        for raw in recent_raw:
            try:
                entry = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue

            if entry.get("id") == alert.id:
                continue

            if entry.get("service") != alert.service:
                continue

            entry_sev = SEVERITY_ORDER.get(entry.get("severity", "info"), 0)
            alert_sev = SEVERITY_ORDER.get(alert.severity, 0)

            if entry_sev > alert_sev:
                logger.info(
                    "Suppressing alert %s (%s) by primary %s (%s) for service %s",
                    alert.name,
                    alert.severity,
                    entry.get("name"),
                    entry.get("severity"),
                    alert.service,
                )
                return True, entry.get("id")

        return False, None

    async def register_alert(self, alert: AlertResponse) -> None:
        """Register alert in the recent ring buffer for suppression checks."""
        entry = {
            "id": alert.id,
            "name": alert.name,
            "service": alert.service,
            "severity": alert.severity,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
        }
        score = alert.created_at.timestamp() if alert.created_at else datetime.utcnow().timestamp()
        await self.redis.zadd(self._key, {json.dumps(entry): score})

        cutoff = datetime.utcnow() - timedelta(seconds=SUPPRESSION_TTL_SECONDS)
        await self.redis.zremrangebyscore(self._key, "-inf", cutoff.timestamp())

    async def get_suppressed_count(self) -> int:
        """Count currently suppressed alerts."""
        count = 0
        all_ids = set()
        for status in ("active", "acknowledged"):
            ids = await self.redis.smembers(f"alerts:{status}")
            all_ids.update(ids)

        for alert_id in all_ids:
            data = await self.redis.hget("alerts", alert_id.decode() if isinstance(alert_id, bytes) else alert_id)
            if data:
                try:
                    alert = AlertResponse.model_validate_json(data)
                    if alert.suppressed:
                        count += 1
                except Exception:
                    pass
        return count
