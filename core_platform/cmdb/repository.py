import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from aiops_shared.models.ci import CI
from aiops_shared.models.relationship import Relationship
from aiops_shared.models.service import Service
from aiops_shared.models.service_ci import ServiceCI


class CMDBRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_ci(self, data: dict) -> CI:
        ci = CI(**data)
        self.session.add(ci)
        await self.session.commit()
        await self.session.refresh(ci)
        return ci

    async def get_ci(self, ci_id: uuid.UUID) -> CI | None:
        return await self.session.get(CI, ci_id)

    async def list_cis(self, skip: int = 0, limit: int = 100) -> list[CI]:
        result = await self.session.execute(select(CI).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def create_relationship(self, data: dict) -> Relationship:
        rel = Relationship(**data)
        self.session.add(rel)
        await self.session.commit()
        await self.session.refresh(rel)
        return rel

    async def create_service(self, data: dict) -> Service:
        svc = Service(**data)
        self.session.add(svc)
        await self.session.commit()
        await self.session.refresh(svc)
        return svc

    async def list_services(self) -> list[Service]:
        result = await self.session.execute(select(Service))
        return list(result.scalars().all())

    async def add_ci_to_service(self, service_id: uuid.UUID, ci_id: uuid.UUID, role: str) -> None:
        sc = ServiceCI(service_id=service_id, ci_id=ci_id, role=role)
        self.session.add(sc)
        await self.session.commit()

    async def get_upstream_dependencies(self, ci_id: uuid.UUID) -> list[dict]:
        result = await self.session.execute(
            text("SELECT * FROM get_upstream_dependencies(:ci_id)"),
            {"ci_id": str(ci_id)},
        )
        return [dict(row) for row in result]

    async def get_downstream_impact(self, ci_id: uuid.UUID) -> list[dict]:
        result = await self.session.execute(
            text("SELECT * FROM get_downstream_impact(:ci_id)"),
            {"ci_id": str(ci_id)},
        )
        return [dict(row) for row in result]

    async def get_service_topology(self, service_id: uuid.UUID) -> list[dict]:
        result = await self.session.execute(
            text("SELECT * FROM get_service_topology(:service_id)"),
            {"service_id": str(service_id)},
        )
        return [dict(row) for row in result]

    async def get_global_topology(self) -> dict:
        ci_result = await self.session.execute(select(CI))
        cis = ci_result.scalars().all()
        nodes = [{"id": str(c.id), "name": c.name, "type": c.type, "team": c.team or "unassigned", "site": c.site or "unassigned"} for c in cis]

        rel_result = await self.session.execute(select(Relationship))
        rels = rel_result.scalars().all()
        edges = [{"source": str(r.source_id), "target": str(r.target_id), "type": r.type} for r in rels]

        return {"nodes": nodes, "edges": edges}

    async def get_ci_by_name(self, name: str) -> CI | None:
        result = await self.session.execute(select(CI).where(CI.name == name))
        return result.scalar_one_or_none()

    async def get_all_sites(self) -> list[dict]:
        result = await self.session.execute(
            text("SELECT DISTINCT site, site_type, topology_type, COUNT(*) as device_count FROM ci WHERE site IS NOT NULL GROUP BY site, site_type, topology_type")
        )
        return [dict(zip(result.keys(), row, strict=False)) for row in result]

    async def get_site_topology(self, site: str, view: str = "detailed") -> dict:
        ci_result = await self.session.execute(
            select(CI).where(CI.site == site)
        )
        cis = ci_result.scalars().all()

        # Overview view: only "principal" device types (ServiceNow Principal Class pattern)
        principal_types = {"router", "switch", "firewall", "load_balancer", "physical_server", "database"}
        if view == "overview":
            cis = [c for c in cis if c.type in principal_types]

        ci_ids = {c.id for c in cis}
        nodes = [{"id": str(c.id), "name": c.name, "type": c.type, "team": c.team or "unassigned", "site": c.site} for c in cis]

        rel_result = await self.session.execute(
            select(Relationship).where(
                (Relationship.source_id.in_(ci_ids)) & (Relationship.target_id.in_(ci_ids))
            )
        )
        rels = rel_result.scalars().all()
        edges = [{"source": str(r.source_id), "target": str(r.target_id), "type": r.type} for r in rels]
        return {"nodes": nodes, "edges": edges}

    async def get_site_aggregate_topology(self) -> dict:
        """Returns a topology with one node per site and inter-site connections."""
        sites_result = await self.session.execute(
            text("SELECT DISTINCT site, site_type, topology_type, COUNT(*) as device_count FROM ci WHERE site IS NOT NULL GROUP BY site, site_type, topology_type")
        )
        sites = [dict(zip(sites_result.keys(), row, strict=False)) for row in sites_result]

        nodes = []
        for s in sites:
            nodes.append({
                "id": s["site"],
                "name": s["site"],
                "type": "site",
                "team": "site",
                "site": s["site"],
                "site_type": s.get("site_type", "unknown"),
                "topology_type": s.get("topology_type", "unknown"),
                "device_count": s["device_count"],
            })

        conns = await self.get_inter_site_connections()
        seen = set()
        edges = []
        for c in conns:
            key = tuple(sorted([c["source_site"], c["target_site"]]))
            if key not in seen:
                seen.add(key)
                edges.append({
                    "source": c["source_site"],
                    "target": c["target_site"],
                    "type": c["connection_type"],
                })

        return {"nodes": nodes, "edges": edges}

    async def get_ci_details(self, ci_id: uuid.UUID) -> dict | None:
        ci = await self.get_ci(ci_id)
        if not ci:
            return None

        upstream = await self.session.execute(
            select(Relationship).where(Relationship.target_id == ci_id)
        )
        downstream = await self.session.execute(
            select(Relationship).where(Relationship.source_id == ci_id)
        )
        upstream_rels = upstream.scalars().all()
        downstream_rels = downstream.scalars().all()

        neighbors = []
        neighbor_ids = set()
        for r in upstream_rels:
            neighbor_ids.add(r.source_id)
            neighbors.append({"id": str(r.source_id), "name": "", "type": "", "relationship": r.type, "direction": "upstream"})
        for r in downstream_rels:
            neighbor_ids.add(r.target_id)
            neighbors.append({"id": str(r.target_id), "name": "", "type": "", "relationship": r.type, "direction": "downstream"})

        if neighbor_ids:
            cis_result = await self.session.execute(select(CI).where(CI.id.in_(neighbor_ids)))
            ci_map = {c.id: c for c in cis_result.scalars().all()}
            for n in neighbors:
                neighbor_ci = ci_map.get(uuid.UUID(n["id"]))
                if neighbor_ci:
                    n["name"] = neighbor_ci.name
                    n["type"] = neighbor_ci.type

        return {
            "ci": {
                "id": str(ci.id),
                "name": ci.name,
                "type": ci.type,
                "provider": ci.provider,
                "environment": ci.environment,
                "team": ci.team,
                "site": ci.site,
                "site_type": ci.site_type,
                "network_layer": ci.network_layer,
                "topology_type": ci.topology_type,
                "labels": ci.labels,
            },
            "neighbors": neighbors,
        }

    async def get_inter_site_connections(self) -> list[dict]:
        result = await self.session.execute(text("""
            SELECT
                s.site as source_site,
                t.site as target_site,
                r.type as connection_type,
                s.name as source_device,
                t.name as target_device,
                'healthy' as status
            FROM relationship r
            JOIN ci s ON r.source_id = s.id
            JOIN ci t ON r.target_id = t.id
            WHERE s.site IS NOT NULL AND t.site IS NOT NULL AND s.site != t.site
        """))
        return [dict(zip(result.keys(), row, strict=False)) for row in result]

    async def get_dc_rooms(self, site: str | None = None) -> list[dict]:
        if site:
            result = await self.session.execute(text("SELECT * FROM dc_room WHERE site = :site"), {"site": site})
        else:
            result = await self.session.execute(text("SELECT * FROM dc_room"))
        rows = result.mappings().all()
        return [dict(r) for r in rows]

    async def get_dc_room(self, room_id: uuid.UUID) -> dict | None:
        result = await self.session.execute(text("SELECT * FROM dc_room WHERE id = :id"), {"id": room_id})
        row = result.mappings().first()
        return dict(row) if row else None

    async def get_dc_racks(self, room_id: uuid.UUID) -> list[dict]:
        result = await self.session.execute(
            text('SELECT * FROM dc_rack WHERE room_id = :room_id ORDER BY "row", rack_number'),
            {"room_id": room_id},
        )
        rows = result.mappings().all()
        return [dict(r) for r in rows]

    async def get_dc_rack_equipment(self, rack_id: uuid.UUID) -> list[dict]:
        result = await self.session.execute(
            text("SELECT * FROM dc_rack_equipment WHERE rack_id = :rack_id ORDER BY u_start"),
            {"rack_id": rack_id},
        )
        rows = result.mappings().all()
        return [dict(r) for r in rows]

    async def get_cis_by_site(self, site: str) -> list[dict]:
        result = await self.session.execute(
            select(CI).where(CI.site == site)
        )
        cis = result.scalars().all()
        return [
            {
                "id": str(ci.id), "name": ci.name, "type": ci.type,
                "provider": ci.provider, "team": ci.team,
                "network_layer": ci.network_layer,
            }
            for ci in cis
        ]
