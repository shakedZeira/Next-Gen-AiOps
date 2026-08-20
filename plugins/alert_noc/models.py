from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class AlertStatus(str, Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    ESCALATED = "escalated"


class AlertCreate(BaseModel):
    name: str
    service: str
    severity: AlertSeverity
    description: str
    team: str = "unassigned"
    runbook_url: str | None = None
    labels: dict = {}


class AlertResponse(AlertCreate):
    id: str
    status: AlertStatus
    created_at: datetime
    acknowledged_at: datetime | None = None
    acknowledged_by: str | None = None
    resolved_at: datetime | None = None
    repeat_count: int = 1
    first_seen: datetime | None = None
    last_seen: datetime | None = None
    incident_id: str | None = None
    normalized_name: str | None = None


class AlertAcknowledge(BaseModel):
    acknowledged_by: str


class AlertGroup(BaseModel):
    service: str
    severity: AlertSeverity
    count: int
    alerts: list[AlertResponse]


class IncidentGroup(BaseModel):
    incident_id: str
    title: str
    service: str
    severity: str
    alert_count: int
    alerts: list[AlertResponse]
    first_seen: datetime | None = None
    last_seen: datetime | None = None
