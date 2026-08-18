import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from aiops_shared.database import Base


class Service(Base):
    __tablename__ = "service"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    owner_team: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sla_tier: Mapped[str] = mapped_column(String(20), default="bronze")
    operational_status: Mapped[str] = mapped_column(String(20), default="operational")
    entry_point_ci_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("ci.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ci_memberships = relationship("ServiceCI", back_populates="service")
