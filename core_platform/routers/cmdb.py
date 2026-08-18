from uuid import UUID
from fastapi import APIRouter, Depends
from core_platform.cmdb.repository import CMDBRepository
from core_platform.cmdb.schemas import (
    CICreate, CIResponse, RelationshipCreate, RelationshipResponse,
    ServiceCreate, ServiceResponse, ServiceCIRequest, TopologyResponse,
    ImpactResponse,
)
from core_platform.auth.dependencies import get_current_user
from aiops_shared.database import get_session

router = APIRouter()


@router.post("/ci", response_model=CIResponse)
async def create_ci(data: CICreate, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    ci = await repo.create_ci(data.model_dump())
    return CIResponse(id=ci.id, **data.model_dump())


@router.get("/ci/{ci_id}", response_model=CIResponse)
async def get_ci(ci_id: UUID, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    ci = await repo.get_ci(ci_id)
    return CIResponse(id=ci.id, name=ci.name, type=ci.type, provider=ci.provider, environment=ci.environment, labels=ci.labels, properties=ci.properties)


@router.get("/ci", response_model=list[CIResponse])
async def list_cis(skip: int = 0, limit: int = 100, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    cis = await repo.list_cis(skip, limit)
    return [CIResponse(id=c.id, name=c.name, type=c.type, provider=c.provider, environment=c.environment, labels=c.labels, properties=c.properties) for c in cis]


@router.post("/relationship", response_model=RelationshipResponse)
async def create_relationship(data: RelationshipCreate, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    rel = await repo.create_relationship(data.model_dump())
    return RelationshipResponse(id=rel.id, **data.model_dump())


@router.post("/service", response_model=ServiceResponse)
async def create_service(data: ServiceCreate, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    svc = await repo.create_service(data.model_dump())
    return ServiceResponse(id=svc.id, **data.model_dump(), operational_status=svc.operational_status)


@router.post("/service/{service_id}/ci")
async def add_ci_to_service(service_id: UUID, data: ServiceCIRequest, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    await repo.add_ci_to_service(service_id, data.ci_id, data.role)
    return {"status": "ok"}


@router.get("/topology/{service_id}")
async def get_topology(service_id: UUID, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    rows = await repo.get_service_topology(service_id)
    nodes = [{"id": str(r["ci_id"]), "name": r["ci_name"], "type": r["ci_type"]} for r in rows]
    edges = [{"source": str(r["rel_source"]), "target": str(r["rel_target"]), "type": r["rel_type"]} for r in rows if r["rel_source"]]
    return TopologyResponse(nodes=nodes, edges=edges)


@router.get("/impact/{ci_id}")
async def get_impact(ci_id: UUID, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    downstream = await repo.get_downstream_impact(ci_id)
    return ImpactResponse(ci_id=ci_id, ci_name="", ci_type="", depth=0, downstream=downstream)
