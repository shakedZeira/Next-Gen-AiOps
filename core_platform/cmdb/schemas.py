from pydantic import BaseModel
from uuid import UUID


class CICreate(BaseModel):
    name: str
    type: str
    provider: str | None = None
    environment: str | None = None
    labels: dict = {}
    properties: dict = {}


class CIResponse(CICreate):
    id: UUID


class RelationshipCreate(BaseModel):
    source_id: UUID
    target_id: UUID
    type: str
    discovered_by: str | None = None
    confidence: float = 1.0


class RelationshipResponse(RelationshipCreate):
    id: UUID


class ServiceCreate(BaseModel):
    name: str
    owner_team: str | None = None
    sla_tier: str = "bronze"


class ServiceResponse(ServiceCreate):
    id: UUID
    operational_status: str


class ServiceCIRequest(BaseModel):
    ci_id: UUID
    role: str = "dependency"


class TopologyResponse(BaseModel):
    nodes: list[dict]
    edges: list[dict]


class ImpactResponse(BaseModel):
    ci_id: UUID
    ci_name: str
    ci_type: str
    depth: int
    downstream: list[dict]


class RootCauseCandidatesResponse(BaseModel):
    alert_ci_id: UUID
    candidates: list[dict]
