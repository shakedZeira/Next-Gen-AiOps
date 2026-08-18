import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from aiops_shared.database import Base


class ServiceCI(Base):
    __tablename__ = "service_ci"

    service_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("service.id", ondelete="CASCADE"), primary_key=True)
    ci_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ci.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(50), default="dependency")

    service = relationship("Service", back_populates="ci_memberships")
    ci = relationship("CI", back_populates="service_memberships")
