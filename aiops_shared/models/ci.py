import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from aiops_shared.database import Base


class CI(Base):
    __tablename__ = "ci"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    environment: Mapped[str | None] = mapped_column(String(50), nullable=True)
    team: Mapped[str | None] = mapped_column(String(100), nullable=True)
    site: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    site_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    network_layer: Mapped[str | None] = mapped_column(String(50), nullable=True)
    topology_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    labels: Mapped[dict] = mapped_column(JSONB, default=dict)
    properties: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    relationships_as_source = relationship("Relationship", back_populates="source", foreign_keys="Relationship.source_id")
    relationships_as_target = relationship("Relationship", back_populates="target", foreign_keys="Relationship.target_id")
    service_memberships = relationship("ServiceCI", back_populates="ci")
