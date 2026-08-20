import uuid
from sqlalchemy import Column, String, Integer, Float, JSON
from sqlalchemy.dialects.postgresql import UUID
from aiops_shared.database import Base


class DCRoom(Base):
    __tablename__ = "dc_room"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    site = Column(String, nullable=False, index=True)
    room_type = Column(String)
    tier_rating = Column(Integer)
    total_racks = Column(Integer, default=0)
    power_capacity_kw = Column(Float)
    cooling_type = Column(String)
    pue_target = Column(Float)
    labels = Column(JSON, default=dict)


class DCRack(Base):
    __tablename__ = "dc_rack"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    room_id = Column(UUID(as_uuid=True), nullable=False)
    site = Column(String, nullable=False)
    row = Column(String)
    rack_number = Column(Integer)
    u_height = Column(Integer, default=42)
    max_power_kw = Column(Float)
    current_temp_c = Column(Float)
    status = Column(String, default="active")
    labels = Column(JSON, default=dict)


class DCRackEquipment(Base):
    __tablename__ = "dc_rack_equipment"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rack_id = Column(UUID(as_uuid=True), nullable=False)
    ci_id = Column(UUID(as_uuid=True), nullable=True)
    name = Column(String, nullable=False)
    equipment_type = Column(String, nullable=False)
    u_start = Column(Integer, nullable=False)
    u_height = Column(Integer, default=1)
    manufacturer = Column(String)
    model = Column(String)
    serial_number = Column(String)
    power_consumption_w = Column(Float)
    mgmt_ip = Column(String)
    status = Column(String, default="active")
    labels = Column(JSON, default=dict)
