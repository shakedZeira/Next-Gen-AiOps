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
        nodes = [{"id": str(c.id), "name": c.name, "type": c.type, "team": c.team or "unassigned"} for c in cis]

        rel_result = await self.session.execute(select(Relationship))
        rels = rel_result.scalars().all()
        edges = [{"source": str(r.source_id), "target": str(r.target_id), "type": r.type} for r in rels]

        return {"nodes": nodes, "edges": edges}

    async def get_ci_by_name(self, name: str) -> CI | None:
        result = await self.session.execute(select(CI).where(CI.name == name))
        return result.scalar_one_or_none()
