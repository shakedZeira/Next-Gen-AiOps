from uuid import UUID
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from core_platform.cmdb.repository import CMDBRepository
from core_platform.cmdb.schemas import (
    CICreate, CIResponse, RelationshipCreate, RelationshipResponse,
    ServiceCreate, ServiceResponse, ServiceCIRequest, TopologyResponse,
    ImpactResponse, SiteInfoResponse, InterSiteConnectionResponse,
    DCRoomResponse, DCRackResponse, DCRackEquipmentResponse,
)
from core_platform.auth.dependencies import get_current_user
from sqlalchemy import select
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
    return CIResponse(id=ci.id, name=ci.name, type=ci.type, provider=ci.provider, environment=ci.environment, team=ci.team, site=ci.site, site_type=ci.site_type, network_layer=ci.network_layer, topology_type=ci.topology_type, labels=ci.labels, properties=ci.properties)


@router.get("/ci/{ci_id}/details")
async def get_ci_details(ci_id: UUID, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    details = await repo.get_ci_details(ci_id)
    if not details:
        return JSONResponse(status_code=404, content={"error": "CI not found"})
    return details


@router.get("/ci", response_model=list[CIResponse])
async def list_cis(skip: int = 0, limit: int = 100, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    cis = await repo.list_cis(skip, limit)
    return [CIResponse(id=c.id, name=c.name, type=c.type, provider=c.provider, environment=c.environment, team=c.team, site=c.site, site_type=c.site_type, network_layer=c.network_layer, topology_type=c.topology_type, labels=c.labels, properties=c.properties) for c in cis]


@router.post("/relationship", response_model=RelationshipResponse)
async def create_relationship(data: RelationshipCreate, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    rel = await repo.create_relationship(data.model_dump())
    return RelationshipResponse(id=rel.id, **data.model_dump())


@router.get("/service", response_model=list[ServiceResponse])
async def list_services(session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    svcs = await repo.list_services()
    return [ServiceResponse(id=s.id, name=s.name, owner_team=s.owner_team, sla_tier=s.sla_tier, operational_status=s.operational_status) for s in svcs]


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


@router.get("/topology/site-aggregate")
async def get_site_aggregate_topology(session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    topo = await repo.get_site_aggregate_topology()
    return JSONResponse(
        content={"nodes": topo["nodes"], "edges": topo["edges"]},
        headers={"Cache-Control": "public, max-age=120"}
    )


@router.get("/topology/all")
async def get_global_topology(session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    topo = await repo.get_global_topology()
    return JSONResponse(
        content={"nodes": topo["nodes"], "edges": topo["edges"]},
        headers={"Cache-Control": "public, max-age=60"}
    )


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


@router.get("/sites/locations")
async def get_site_locations(session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    sites = await repo.get_all_sites()
    SITE_COORDS = {
        "global-hq": {"lat": 40.7128, "lng": -74.0060, "city": "New York", "country": "USA"},
        "regional-dc-1": {"lat": 41.8781, "lng": -87.6298, "city": "Chicago", "country": "USA"},
        "metro-ring-1": {"lat": 32.7767, "lng": -96.7970, "city": "Dallas", "country": "USA"},
        "branch-nyc": {"lat": 40.7580, "lng": -73.9855, "city": "New York", "country": "USA"},
        "branch-london": {"lat": 51.5074, "lng": -0.1278, "city": "London", "country": "UK"},
    }
    result = []
    for s in sites:
        coords = SITE_COORDS.get(s["site"], {"lat": 0, "lng": 0, "city": "Unknown", "country": ""})
        result.append({
            "site": s["site"], "name": s["site"].replace("-", " ").title(),
            "city": coords["city"], "country": coords["country"],
            "lat": coords["lat"], "lng": coords["lng"],
            "site_type": s.get("site_type", "unknown"), "device_count": s["device_count"],
            "topology_type": s.get("topology_type", "unknown"),
        })
    return result


@router.get("/sites")
async def get_sites(session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    sites = await repo.get_all_sites()
    return JSONResponse(
        content=[{"name": s["site"], "site_type": s.get("site_type"), "device_count": s["device_count"], "topology_type": s.get("topology_type")} for s in sites],
        headers={"Cache-Control": "public, max-age=300"}
    )


@router.get("/topology/site/{site_name}")
async def get_site_topology(site_name: str, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    topo = await repo.get_site_topology(site_name)
    return JSONResponse(
        content={"nodes": topo["nodes"], "edges": topo["edges"]},
        headers={"Cache-Control": "public, max-age=60"}
    )


@router.get("/topology/inter-site", response_model=list[InterSiteConnectionResponse])
async def get_inter_site_connections(session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    conns = await repo.get_inter_site_connections()
    return [InterSiteConnectionResponse(**c) for c in conns]


@router.get("/dc/rooms")
async def get_dc_rooms(site: str = None, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    return await repo.get_dc_rooms(site)


@router.get("/dc/rooms/{room_id}")
async def get_dc_room(room_id: UUID, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    room = await repo.get_dc_room(room_id)
    if not room:
        return JSONResponse(status_code=404, content={"error": "Room not found"})
    return room


@router.get("/dc/rooms/{room_id}/racks")
async def get_dc_racks(room_id: UUID, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    return await repo.get_dc_racks(room_id)


@router.get("/dc/racks/{rack_id}/equipment")
async def get_dc_rack_equipment(rack_id: UUID, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    return await repo.get_dc_rack_equipment(rack_id)


@router.get("/topology/inter-site/flows")
async def get_inter_site_flows(_user=Depends(get_current_user)):
    return [
        {
            "source_site": "global-hq",
            "target_site": "regional-dc-1",
            "connection_type": "mpls",
            "bandwidth_mbps": 10000,
            "utilization_pct": 67,
            "latency_ms": 12,
            "status": "healthy",
            "packets_per_sec": 145000,
            "errors_per_sec": 2,
            "source_device": "hq-wan-router-1",
            "target_device": "dc1-wan-router-1"
        },
        {
            "source_site": "global-hq",
            "target_site": "metro-ring-1",
            "connection_type": "mpls",
            "bandwidth_mbps": 5000,
            "utilization_pct": 43,
            "latency_ms": 28,
            "status": "healthy",
            "packets_per_sec": 87000,
            "errors_per_sec": 0,
            "source_device": "hq-wan-router-1",
            "target_device": "ring-pe-router-1"
        },
        {
            "source_site": "regional-dc-1",
            "target_site": "branch-nyc",
            "connection_type": "sdwan",
            "bandwidth_mbps": 2000,
            "utilization_pct": 82,
            "latency_ms": 35,
            "status": "degraded",
            "packets_per_sec": 42000,
            "errors_per_sec": 15,
            "source_device": "dc1-wan-router-1",
            "target_device": "nyc-sdwan-edge-1"
        },
        {
            "source_site": "regional-dc-1",
            "target_site": "branch-london",
            "connection_type": "sdwan",
            "bandwidth_mbps": 1000,
            "utilization_pct": 29,
            "latency_ms": 89,
            "status": "healthy",
            "packets_per_sec": 12000,
            "errors_per_sec": 1,
            "source_device": "dc1-wan-router-2",
            "target_device": "lon-sdwan-edge"
        },
        {
            "source_site": "global-hq",
            "target_site": "branch-nyc",
            "connection_type": "vpn",
            "bandwidth_mbps": 500,
            "utilization_pct": 11,
            "latency_ms": 45,
            "status": "healthy",
            "packets_per_sec": 3200,
            "errors_per_sec": 0,
            "source_device": "hq-wan-router-2",
            "target_device": "nyc-sdwan-edge-2"
        }
    ]


@router.get("/sites/{site_name}/overview")
async def get_site_overview(site_name: str, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    
    # Get device count and types
    cis = await repo.get_cis_by_site(site_name)
    device_count = len(cis)
    type_counts = {}
    for ci in cis:
        t = ci.get("type", "unknown")
        type_counts[t] = type_counts.get(t, 0) + 1
    
    # Get room count and total racks
    from core_platform.models.cmdb import DCRoom
    rooms_result = await session.execute(
        select(DCRoom).where(DCRoom.site == site_name)
    )
    rooms = rooms_result.scalars().all()
    room_count = len(rooms)
    total_racks = sum(r.total_racks for r in rooms)
    
    # Get teams
    teams = list(set(ci.get("team") for ci in cis if ci.get("team")))
    
    # Get topology type from a CI
    topology_type = next((ci.get("topology_type") for ci in cis if ci.get("topology_type")), "unknown")
    
    # Get site type from first CI
    site_type = next((ci.get("site_type") for ci in cis if ci.get("site_type")), "unknown")
    
    return {
        "site_name": site_name,
        "site_type": site_type,
        "topology_type": topology_type,
        "device_count": device_count,
        "room_count": room_count,
        "total_racks": total_racks,
        "teams": teams,
        "device_types": type_counts,
        "key_devices": [ci for ci in cis if ci.get("type") in {"router", "firewall", "load_balancer", "switch"}][:5]
    }


@router.get("/sites/{site_name}/map-data")
async def get_site_map_data(site_name: str, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    
    SITE_COORDS = {
        "global-hq": {"lat": 40.7128, "lng": -74.0060},
        "regional-dc-1": {"lat": 41.8781, "lng": -87.6298},
        "metro-ring-1": {"lat": 32.7767, "lng": -96.7970},
        "branch-nyc": {"lat": 40.7580, "lng": -73.9855},
        "branch-london": {"lat": 51.5074, "lng": -0.1278},
    }
    
    center = SITE_COORDS.get(site_name, {"lat": 0, "lng": 0})
    
    from core_platform.models.cmdb import DCRoom
    rooms_result = await session.execute(
        select(DCRoom).where(DCRoom.site == site_name)
    )
    rooms = rooms_result.scalars().all()
    
    cis = await repo.get_cis_by_site(site_name)
    
    import math
    pins = []
    
    for i, room in enumerate(rooms):
        angle = (2 * math.pi * i) / max(len(rooms), 1)
        offset_lat = 0.002 * math.cos(angle)
        offset_lng = 0.002 * math.sin(angle)
        pins.append({
            "id": str(room.id),
            "name": room.name,
            "type": "room",
            "lat": center["lat"] + offset_lat,
            "lng": center["lng"] + offset_lng,
            "details": {
                "room_type": room.room_type,
                "tier_rating": room.tier_rating,
                "total_racks": room.total_racks,
                "power_capacity_kw": room.power_capacity_kw,
                "cooling_type": room.cooling_type,
            }
        })
    
    key_types = {"router", "firewall", "load_balancer", "switch", "physical_server"}
    key_cis = [ci for ci in cis if ci.get("type") in key_types]
    
    for i, ci in enumerate(key_cis[:20]):
        angle = (2 * math.pi * i) / min(len(key_cis), 20)
        radius = 0.001 + (i % 3) * 0.0005
        offset_lat = radius * math.cos(angle)
        offset_lng = radius * math.sin(angle)
        pins.append({
            "id": ci["id"],
            "name": ci["name"],
            "type": ci["type"],
            "lat": center["lat"] + offset_lat,
            "lng": center["lng"] + offset_lng,
            "details": {
                "provider": ci.get("provider"),
                "team": ci.get("team"),
                "network_layer": ci.get("network_layer"),
            }
        })
    
    return {
        "center": center,
        "zoom": 15,
        "pins": pins
    }