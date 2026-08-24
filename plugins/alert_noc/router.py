from fastapi import APIRouter
from pydantic import BaseModel

from plugins.alert_noc.models import AlertAcknowledge, AlertCreate
from plugins.alert_noc.store import alert_store

router = APIRouter()


class ScenarioRequest(BaseModel):
    scenario: str


class MaintenanceCreateRequest(BaseModel):
    name: str
    service: str
    start_time: str
    end_time: str
    created_by: str = "admin@aiops.local"
    reason: str = ""


@router.post("/alerts", response_model=dict)
async def create_alert(data: AlertCreate):
    alert = await alert_store.create_alert(data)
    return alert.model_dump()


@router.get("/alerts", response_model=list[dict])
async def list_alerts(status: str | None = None, team: str | None = None, suppressed: bool | None = None, throttled: bool | None = None, muted: bool | None = None):
    alerts = await alert_store.list_alerts(status, team, suppressed, throttled, muted)
    return [a.model_dump() for a in alerts]


@router.get("/alerts/groups", response_model=list[dict])
async def get_alert_groups():
    return await alert_store.get_alert_groups()


@router.get("/alerts/incidents")
async def list_incidents(status: str | None = None):
    return await alert_store.list_incidents(status)


@router.get("/alerts/incidents/{incident_id}")
async def get_incident(incident_id: str):
    incident = await alert_store.get_incident(incident_id)
    if not incident:
        return {"error": "Incident not found"}
    return incident


@router.post("/alerts/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(incident_id: str, data: AlertAcknowledge):
    count = await alert_store.acknowledge_incident(incident_id, data.acknowledged_by)
    return {"success": count > 0, "acknowledged_count": count}


@router.post("/alerts/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str):
    count = await alert_store.resolve_incident(incident_id)
    return {"success": count > 0, "resolved_count": count}


@router.get("/alerts/stats")
async def alert_stats():
    stats = await alert_store.dedup.get_stats()
    stats["suppressed"] = await alert_store.suppressor.get_suppressed_count()
    active_storm = await alert_store.storm.get_active_storm()
    stats["storm_active"] = active_storm is not None
    return stats


@router.get("/alerts/storms")
async def list_storms(limit: int = 20):
    return await alert_store.storm.get_storms(limit)


@router.get("/alerts/storms/active")
async def get_active_storm():
    storm = await alert_store.storm.get_active_storm()
    if not storm:
        return None
    return storm.to_dict()


@router.post("/alerts/storms/{storm_id}/clear")
async def clear_storm(storm_id: str):
    storm = await alert_store.storm.clear_storm(storm_id)
    if not storm:
        return {"error": "Storm not found or already cleared"}
    return storm.to_dict()


@router.get("/alerts/maintenance")
async def list_maintenance_windows(status: str | None = None):
    windows = await alert_store.maintenance.list_windows(status)
    return [w.to_dict() for w in windows]


@router.get("/alerts/maintenance/active")
async def list_active_maintenance():
    windows = await alert_store.maintenance.get_active_windows()
    return [w.to_dict() for w in windows]


@router.post("/alerts/maintenance")
async def create_maintenance_window(data: MaintenanceCreateRequest):
    window = await alert_store.maintenance.create_window(
        name=data.name,
        service=data.service,
        start_time=data.start_time,
        end_time=data.end_time,
        created_by=data.created_by,
        reason=data.reason,
    )
    return window.to_dict()


@router.delete("/alerts/maintenance/{window_id}")
async def cancel_maintenance_window(window_id: str):
    window = await alert_store.maintenance.cancel_window(window_id)
    if not window:
        return {"error": "Window not found"}
    return window.to_dict()


@router.post("/alerts/maintenance/cleanup")
async def cleanup_expired_windows():
    removed = await alert_store.maintenance.cleanup_expired()
    return {"cleaned": removed}


@router.get("/alerts/{alert_id}")
async def get_alert(alert_id: str):
    alert = await alert_store.get_alert(alert_id)
    if not alert:
        return {"error": "Alert not found"}
    return alert.model_dump()


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, data: AlertAcknowledge):
    success = await alert_store.acknowledge(alert_id, data.acknowledged_by)
    return {"success": success}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    success = await alert_store.resolve(alert_id)
    return {"success": success}


@router.get("/simulate/scenarios")
async def list_scenarios():
    from plugins.alert_noc.scenarios import SCENARIOS
    return [
        {"id": k, "name": v["name"], "description": v["description"], "alert_count": len(v["alerts"])}
        for k, v in SCENARIOS.items()
    ]


@router.post("/simulate/scenario")
async def run_scenario(data: ScenarioRequest):
    import asyncio

    from plugins.alert_noc.scenarios import ScenarioRunner
    runner = ScenarioRunner(alert_store)
    asyncio.create_task(runner.run(data.scenario))
    return {"status": "started", "scenario": data.scenario}
