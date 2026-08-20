from uuid import UUID

from pydantic import BaseModel


class CICreate(BaseModel):
    name: str
    type: str
    provider: str | None = None
    environment: str | None = None
    team: str | None = None
    site: str | None = None
    site_type: str | None = None
    network_layer: str | None = None
    topology_type: str | None = None
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


class SiteInfoResponse(BaseModel):
    name: str
    site_type: str | None = None
    device_count: int
    topology_type: str | None = None

class InterSiteConnectionResponse(BaseModel):
    source_site: str
    target_site: str
    connection_type: str
    source_device: str
    target_device: str
    status: str


class DCRoomResponse(BaseModel):
    id: UUID
    name: str
    site: str
    room_type: str | None = None
    tier_rating: int | None = None
    total_racks: int = 0
    power_capacity_kw: float | None = None
    cooling_type: str | None = None
    pue_target: float | None = None
    labels: dict = {}


class DCRackResponse(BaseModel):
    id: UUID
    name: str
    room_id: UUID
    site: str
    row: str | None = None
    rack_number: int | None = None
    u_height: int = 42
    max_power_kw: float | None = None
    current_temp_c: float | None = None
    status: str = "active"
    labels: dict = {}


class DCRackEquipmentResponse(BaseModel):
    id: UUID
    rack_id: UUID
    ci_id: UUID | None = None
    name: str
    equipment_type: str
    u_start: int
    u_height: int = 1
    manufacturer: str | None = None
    model: str | None = None
    serial_number: str | None = None
    power_consumption_w: float | None = None
    mgmt_ip: str | None = None
    status: str = "active"
    labels: dict = {}
