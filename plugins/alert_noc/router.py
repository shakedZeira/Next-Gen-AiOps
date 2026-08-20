from fastapi import APIRouter
from pydantic import BaseModel

from plugins.alert_noc.models import AlertAcknowledge, AlertCreate
from plugins.alert_noc.store import alert_store

router = APIRouter()


class ScenarioRequest(BaseModel):
    scenario: str


@router.post("/alerts", response_model=dict)
async def create_alert(data: AlertCreate):
    alert = await alert_store.create_alert(data)
    return alert.model_dump()


@router.get("/alerts", response_model=list[dict])
async def list_alerts(status: str | None = None, team: str | None = None):
    alerts = await alert_store.list_alerts(status, team)
    return [a.model_dump() for a in alerts]


@router.get("/alerts/groups", response_model=list[dict])
async def get_alert_groups():
    return await alert_store.get_alert_groups()


@router.get("/alerts/incidents")
async def list_incidents(status: str | None = None):
    return await alert_store.list_incidents(status)


@router.get("/alerts/stats")
async def alert_stats():
    return await alert_store.dedup.get_stats()


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
