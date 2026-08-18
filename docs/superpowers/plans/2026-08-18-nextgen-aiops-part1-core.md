# Next-Gen AiOps — Part 1: Core Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Core Platform for a Next-Gen AiOps demo: project scaffold, Docker Compose, shared library, PostgreSQL schema, API Gateway, Auth, CMDB, and OTel ingestion config.

**Architecture:** Hybrid Platform + Plugin pattern. Core Platform (FastAPI) provides API Gateway, Auth, CMDB, and OTel ingestion. Five plugin services register with core. PostgreSQL with recursive CTEs for topology queries. Redis for caching/queue. Ollama for local LLM. otel-lgtm for observability stack.

**Tech Stack:** Python 3.11, FastAPI 0.110+, SQLAlchemy 2.0, PostgreSQL 16, Pydantic v2, OpenTelemetry SDK 1.25+, Redis 7, Docker Compose v2

**Spec:** `docs/superpowers/specs/2026-08-18-nextgen-aiops-design.md`

---

## Global Constraints

- Python 3.11+, FastAPI 0.110+, Pydantic v2, SQLAlchemy 2.0
- OpenTelemetry Python SDK 1.25+ with GenAI semantic conventions
- JWT auth with RS256, 15min access / 7d refresh tokens
- RBAC: admin (full), operator (ack alerts, approve chatbot), viewer (read-only)
- All telemetry via OTLP to otel-lgtm collector (port 4318 HTTP)
- PostgreSQL recursive CTEs for graph queries (no external graph DB)
- Docker Compose v2, all services health-checked
- Pre-commit: ruff, mypy, pytest; CI: GitHub Actions
- Shared Python library: `aiops_shared/` package

---

## Task 1: Project Scaffold + Docker Compose

**Files:**
- Create: `pyproject.toml`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `Makefile`
- Create: `README.md`

**Subagent:** `general` — project scaffold

- [ ] **Step 1: Create pyproject.toml**

```toml
[build-system]
requires = ["setuptools>=68.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "nextgen-aiops"
version = "0.1.0"
description = "Next-Gen AiOps Monitoring Demo"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.29.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.29.0",
    "pydantic>=2.6.0",
    "pydantic-settings>=2.2.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "redis>=5.0.0",
    "celery>=5.3.0",
    "httpx>=0.27.0",
    "opentelemetry-api>=1.25.0",
    "opentelemetry-sdk>=1.25.0",
    "opentelemetry-exporter-otlp>=1.25.0",
    "opentelemetry-instrumentation-fastapi>=0.46b0",
    "opentelemetry-instrumentation-httpx>=0.46b0",
    "prometheus-client>=0.20.0",
]

[project.optional-dependencies]
dev = [
    "ruff>=0.4.0",
    "mypy>=1.10.0",
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=5.0.0",
    "httpx>=0.27.0",
]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "B", "SIM"]

[tool.mypy]
python_version = "3.11"
strict = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
version: "3.9"

services:
  otel-lgtm:
    image: grafana/otel-lgtm:latest
    ports:
      - "3000:3000"   # Grafana
      - "9090:9090"   # Prometheus
      - "3100:3100"   # Loki
      - "3200:3200"   # Tempo
      - "4317:4317"   # OTel gRPC
      - "4318:4318"   # OTel HTTP
    volumes:
      - ./otel-lgtm/config:/etc/otel-lgtm
    environment:
      - ENABLE_LOGS_ALL=true
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: aiops
      POSTGRES_USER: aiops
      POSTGRES_PASSWORD: aiops
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aiops -d aiops"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    healthcheck:
      test: ["CMD", "ollama", "list"]
      interval: 30s
      timeout: 10s
      retries: 3

  api-gateway:
    build:
      context: .
      dockerfile: Dockerfile.core
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      otel-lgtm:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://aiops:aiops@postgres:5432/aiops
      REDIS_URL: redis://redis:6379/0
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-lgtm:4318
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 15s
      timeout: 5s
      retries: 3

volumes:
  postgres_data:
  ollama_data:
```

- [ ] **Step 3: Create .env.example**

```bash
DATABASE_URL=postgresql+asyncpg://aiops:aiops@localhost:5432/aiops
REDIS_URL=redis://localhost:6379/0
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
OLLAMA_BASE_URL=http://localhost:11434
```

- [ ] **Step 4: Create .gitignore**

```
__pycache__/
*.pyc
.pytest_cache/
.mypy_cache/
.ruff_cache/
*.egg-info/
dist/
build/
.venv/
.env
.env.local
*.db
node_modules/
ui/dist/
.ollama/
```

- [ ] **Step 5: Create Makefile**

```makefile
.PHONY: dev up down logs test lint typecheck

dev:
	uvicorn core_platform.main:app --reload --host 0.0.0.0 --port 8000

up:
	docker compose up -d --build

down:
	docker compose down -v

logs:
	docker compose logs -f

test:
	pytest -v --cov=core_platform --cov=aiops_shared

lint:
	ruff check .

typecheck:
	mypy core_platform/ aiops_shared/
```

- [ ] **Step 6: Initialize git**

```bash
git init
git add .
git commit -m "chore: project scaffold with Docker Compose"
```

---

## Task 2: Shared Library — `aiops_shared/`

**Files:**
- Create: `aiops_shared/__init__.py`
- Create: `aiops_shared/config.py`
- Create: `aiops_shared/database.py`
- Create: `aiops_shared/models/__init__.py`
- Create: `aiops_shared/models/ci.py`
- Create: `aiops_shared/models/relationship.py`
- Create: `aiops_shared/models/service.py`
- Create: `aiops_shared/models/service_ci.py`
- Create: `aiops_shared/models/user.py`
- Create: `aiops_shared/models/alert.py`
- Create: `aiops_shared/exceptions.py`
- Create: `aiops_shared/otel/__init__.py`
- Create: `aiops_shared/otel/instrumentation.py`
- Test: `tests/test_shared_models.py`

**Subagent:** `general` — shared library

**Interfaces:**
- Produces: `get_session()`, `get_sync_session()`, config singleton, all Pydantic models, OTel helpers

- [ ] **Step 1: Create aiops_shared/config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://aiops:aiops@localhost:5432/aiops"
    REDIS_URL: str = "redis://localhost:6379/0"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4318"
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    model_config = {"env_file": ".env"}


settings = Settings()
```

- [ ] **Step 2: Create aiops_shared/database.py**

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from aiops_shared.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_size=20)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
```

- [ ] **Step 3: Create all model files** (ci.py, relationship.py, service.py, service_ci.py, user.py, alert.py)

Example `aiops_shared/models/ci.py`:

```python
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from aiops_shared.database import Base


class CI(Base):
    __tablename__ = "ci"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    environment: Mapped[str | None] = mapped_column(String(50), nullable=True)
    labels: Mapped[dict] = mapped_column(JSONB, default=dict)
    properties: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    relationships_as_source = relationship("Relationship", back_populates="source", foreign_keys="Relationship.source_id")
    relationships_as_target = relationship("Relationship", back_populates="target", foreign_keys="Relationship.target_id")
    service_memberships = relationship("ServiceCI", back_populates="ci")
```

- [ ] **Step 4: Create aiops_shared/otel/instrumentation.py**

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, OTLPSpanExporter
from opentelemetry.sdk.resources import SERVICE_NAME, SERVICE_VERSION, Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor


def init_tracer(service_name: str) -> TracerProvider:
    resource = Resource.create({
        SERVICE_NAME: service_name,
        SERVICE_VERSION: "0.1.0",
    })
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter()
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return provider


def instrument_fastapi(app, service_name: str) -> None:
    FastAPIInstrumentor.instrument_app(app, service_name=service_name)
```

- [ ] **Step 5: Create test and run it**

```python
# tests/test_shared_models.py
import uuid
from aiops_shared.models.ci import CI
from aiops_shared.models.relationship import Relationship
from aiops_shared.models.service import Service


def test_ci_creation():
    ci = CI(name="web-server-1", type="host", provider="aws")
    assert ci.name == "web-server-1"
    assert ci.type == "host"


def test_relationship_creation():
    rel = Relationship(
        source_id=uuid.uuid4(),
        target_id=uuid.uuid4(),
        type="depends_on",
        discovered_by="tag",
    )
    assert rel.type == "depends_on"
```

- [ ] **Step 6: Commit**

```bash
git add aiops_shared/ tests/test_shared_models.py
git commit -m "feat: add shared library with models, config, database, otel"
```

---

## Task 3: PostgreSQL Schema + Migrations

**Files:**
- Create: `db/init.sql`
- Create: `db/migrations/001_create_tables.sql`
- Create: `db/migrations/002_create_cte_functions.sql`

**Subagent:** `general` — db schema

**Interfaces:**
- Consumes: Models from Task 2
- Produces: Schema used by CMDB service (Task 4)

- [ ] **Step 1: Create db/init.sql**

```sql
-- Tables
CREATE TABLE IF NOT EXISTS ci (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    provider VARCHAR(50),
    environment VARCHAR(50),
    labels JSONB DEFAULT '{}',
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relationship (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES ci(id) ON DELETE CASCADE,
    target_id UUID REFERENCES ci(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    properties JSONB DEFAULT '{}',
    discovered_by VARCHAR(50),
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    owner_team VARCHAR(100),
    sla_tier VARCHAR(20) DEFAULT 'bronze',
    operational_status VARCHAR(20) DEFAULT 'operational',
    entry_point_ci_id UUID REFERENCES ci(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_ci (
    service_id UUID REFERENCES service(id) ON DELETE CASCADE,
    ci_id UUID REFERENCES ci(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'dependency',
    PRIMARY KEY (service_id, ci_id)
);

-- Indexes
CREATE INDEX idx_ci_type ON ci(type);
CREATE INDEX idx_ci_provider ON ci(provider);
CREATE INDEX idx_ci_environment ON ci(environment);
CREATE INDEX idx_ci_labels ON ci USING GIN(labels);
CREATE INDEX idx_relationship_source ON relationship(source_id);
CREATE INDEX idx_relationship_target ON relationship(target_id);
CREATE INDEX idx_relationship_type ON relationship(type);
CREATE INDEX idx_service_status ON service(operational_status);
```

- [ ] **Step 2: Create db/migrations/002_create_cte_functions.sql**

```sql
-- Recursive CTE: Get upstream dependencies (what does this CI depend on?)
CREATE OR REPLACE FUNCTION get_upstream_dependencies(p_ci_id UUID)
RETURNS TABLE(ci_id UUID, ci_name VARCHAR, ci_type VARCHAR, depth INT) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE upstream AS (
        SELECT r.target_id, 1 AS depth
        FROM relationship r
        WHERE r.source_id = p_ci_id
        UNION ALL
        SELECT r.target_id, u.depth + 1
        FROM relationship r
        INNER JOIN upstream u ON r.source_id = u.target_id
        WHERE u.depth < 10
    )
    SELECT DISTINCT c.id, c.name, c.type, u.depth
    FROM upstream u
    JOIN ci c ON c.id = u.target_id;
END;
$$ LANGUAGE plpgsql;

-- Recursive CTE: Get downstream impact (what is impacted if this CI fails?)
CREATE OR REPLACE FUNCTION get_downstream_impact(p_ci_id UUID)
RETURNS TABLE(ci_id UUID, ci_name VARCHAR, ci_type VARCHAR, depth INT) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE downstream AS (
        SELECT r.source_id, 1 AS depth
        FROM relationship r
        WHERE r.target_id = p_ci_id
        UNION ALL
        SELECT r.source_id, d.depth + 1
        FROM relationship r
        INNER JOIN downstream d ON r.target_id = d.source_id
        WHERE d.depth < 10
    )
    SELECT DISTINCT c.id, c.name, c.type, d.depth
    FROM downstream d
    JOIN ci c ON c.id = d.source_id;
END;
$$ LANGUAGE plpgsql;

-- Get full service topology
CREATE OR REPLACE FUNCTION get_service_topology(p_service_id UUID)
RETURNS TABLE(ci_id UUID, ci_name VARCHAR, ci_type VARCHAR, rel_type VARCHAR, rel_source UUID, rel_target UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.name, c.type, r.type, r.source_id, r.target_id
    FROM service_ci sc
    JOIN ci c ON c.id = sc.ci_id
    LEFT JOIN relationship r ON (r.source_id = c.id OR r.target_id = c.id)
    WHERE sc.service_id = p_service_id;
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 3: Commit**

```bash
git add db/
git commit -m "feat: PostgreSQL schema with CI, relationship, service tables and CTE functions"
```

---

## Task 4: Core Platform — API Gateway + Auth

**Files:**
- Create: `core_platform/__init__.py`
- Create: `core_platform/main.py`
- Create: `core_platform/auth/__init__.py`
- Create: `core_platform/auth/router.py`
- Create: `core_platform/auth/service.py`
- Create: `core_platform/auth/dependencies.py`
- Create: `core_platform/auth/schemas.py`
- Create: `core_platform/routers/__init__.py`
- Create: `core_platform/routers/health.py`
- Create: `core_platform/routers/cmdb.py`
- Create: `core_platform/dependencies.py`
- Create: `Dockerfile.core`
- Test: `tests/test_auth.py`

**Subagent:** `general` — API gateway + auth

**Interfaces:**
- Consumes: aiops_shared (models, config, database, otel) from Task 2
- Produces: `/api/v1/*` endpoints, JWT auth, RBAC dependency

- [ ] **Step 1: Create core_platform/main.py**

```python
from fastapi import FastAPI
from aiops_shared.otel.instrumentation import init_tracer, instrument_fastapi
from core_platform.auth.router import router as auth_router
from core_platform.routers.health import router as health_router
from core_platform.routers.cmdb import router as cmdb_router

app = FastAPI(title="Next-Gen AiOps Platform", version="0.1.0")

init_tracer("api-gateway")
instrument_fastapi(app, "api-gateway")

app.include_router(health_router, tags=["health"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(cmdb_router, prefix="/api/v1/cmdb", tags=["cmdb"])


@app.get("/")
async def root():
    return {"service": "nextgen-aiops", "version": "0.1.0"}
```

- [ ] **Step 2: Create core_platform/auth/service.py**

```python
import uuid
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from aiops_shared.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Demo users
DEMO_USERS = {
    "admin@aiops.local": {
        "id": str(uuid.uuid4()),
        "email": "admin@aiops.local",
        "password_hash": pwd_context.hash("admin123"),
        "role": "admin",
    },
    "operator@aiops.local": {
        "id": str(uuid.uuid4()),
        "email": "operator@aiops.local",
        "password_hash": pwd_context.hash("operator123"),
        "role": "operator",
    },
    "viewer@aiops.local": {
        "id": str(uuid.uuid4()),
        "email": "viewer@aiops.local",
        "password_hash": pwd_context.hash("viewer123"),
        "role": "viewer",
    },
}


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "role": role, "exp": expire},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": user_id, "type": "refresh", "exp": expire},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
```

- [ ] **Step 3: Create core_platform/auth/router.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from core_platform.auth.schemas import LoginRequest, TokenPair, LoginResponse, UserResponse
from core_platform.auth.service import (
    DEMO_USERS, verify_password, create_access_token, create_refresh_token, decode_token
)
from core_platform.auth.dependencies import get_current_user

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    user = DEMO_USERS.get(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access = create_access_token(user["id"], user["role"])
    refresh = create_refresh_token(user["id"])
    return LoginResponse(
        tokens=TokenPair(access_token=access, refresh_token=refresh),
        user=UserResponse(id=user["id"], email=user["email"], role=user["role"]),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(refresh_token: str):
    try:
        payload = decode_token(refresh_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = next((u for u in DEMO_USERS.values() if u["id"] == payload["sub"]), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user["id"], user["role"])
    new_refresh = create_refresh_token(user["id"])
    return TokenPair(access_token=access, refresh_token=new_refresh)


@router.get("/me", response_model=UserResponse)
async def me(user=Depends(get_current_user)):
    return user
```

- [ ] **Step 4: Create core_platform/auth/dependencies.py**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core_platform.auth.service import decode_token, DEMO_USERS
from core_platform.auth.schemas import UserResponse

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserResponse:
    try:
        payload = decode_token(credentials.credentials)
        user = next((u for u in DEMO_USERS.values() if u["id"] == payload["sub"]), None)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return UserResponse(id=user["id"], email=user["email"], role=user["role"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_role(*roles):
    async def check(user: UserResponse = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return check
```

- [ ] **Step 5: Create core_platform/auth/schemas.py**

```python
from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    role: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str


class LoginResponse(BaseModel):
    tokens: TokenPair
    user: UserResponse
```

- [ ] **Step 6: Create core_platform/routers/health.py**

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "healthy"}
```

- [ ] **Step 7: Create Dockerfile.core**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY aiops_shared/ aiops_shared/
COPY core_platform/ core_platform/
EXPOSE 8000
CMD ["uvicorn", "core_platform.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 8: Create test and run it**

```python
# tests/test_auth.py
from httpx import AsyncClient
from core_platform.main import app


async def test_login_success():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post("/auth/login", json={
            "email": "admin@aiops.local",
            "password": "admin123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "tokens" in data
        assert data["user"]["role"] == "admin"


async def test_login_invalid():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post("/auth/login", json={
            "email": "wrong@aiops.local",
            "password": "wrong",
        })
        assert resp.status_code == 401


async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"
```

- [ ] **Step 9: Commit**

```bash
git add core_platform/ Dockerfile.core tests/test_auth.py
git commit -m "feat: core platform with API gateway, auth, JWT, RBAC"
```

---

## Task 5: CMDB Service — CRUD + Topology Queries

**Files:**
- Create: `core_platform/routers/cmdb.py`
- Create: `core_platform/cmdb/__init__.py`
- Create: `core_platform/cmdb/schemas.py`
- Create: `core_platform/cmdb/repository.py`
- Test: `tests/test_cmdb.py`

**Subagent:** `general` — CMDB service

**Interfaces:**
- Consumes: CI, Relationship, Service models from Task 2; database session from Task 2; recursive CTE functions from Task 3
- Produces: `/api/v1/cmdb/*` endpoints (CI CRUD, Relationship CRUD, Service CRUD, topology queries)

- [ ] **Step 1: Create core_platform/cmdb/schemas.py**

```python
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
```

- [ ] **Step 2: Create core_platform/cmdb/repository.py**

```python
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
```

- [ ] **Step 3: Create core_platform/routers/cmdb.py**

```python
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
```

- [ ] **Step 4: Create test and run it**

```python
# tests/test_cmdb.py
from uuid import uuid4
from httpx import AsyncClient
from core_platform.main import app


async def login_admin(client: AsyncClient) -> str:
    resp = await client.post("/auth/login", json={"email": "admin@aiops.local", "password": "admin123"})
    return resp.json()["tokens"]["access_token"]


async def test_crud_ci():
    async with AsyncClient(app=app, base_url="http://test") as client:
        token = await login_admin(client)
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.post("/api/v1/cmdb/ci", json={
            "name": "db-postgres-1", "type": "database", "provider": "aws",
            "environment": "prod", "labels": {"team": "platform"},
        }, headers=headers)
        assert resp.status_code == 200
        ci_id = resp.json()["id"]
        resp = await client.get(f"/api/v1/cmdb/ci/{ci_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "db-postgres-1"
```

- [ ] **Step 5: Commit**

```bash
git add core_platform/cmdb/ core_platform/routers/cmdb.py tests/test_cmdb.py
git commit -m "feat: CMDB service with CI, relationship, topology queries"
```

---

## Task 6: OTel Ingestion Config + Seeding Data

**Files:**
- Create: `otel-lgtm/config/otelcol-config.yaml`
- Create: `db/seed.py`
- Create: `db/seed_data.json`

**Subagent:** `general` — otel config + seed data

**Interfaces:**
- Consumes: PostgreSQL schema from Task 3
- Produces: Pre-seeded CMDB data for demo (services, CIs, relationships)

- [ ] **Step 1: Create otel-lgtm/config/otelcol-config.yaml**

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
  batch:
    timeout: 1s
    send_batch_size: 1024

exporters:
  debug:
    verbosity: basic
  otlphttp/tempo:
    endpoint: http://tempo:3200
    tls:
      insecure: true
  otlphttp/loki:
    endpoint: http://loki:3100/otlp
    tls:
      insecure: true
  prometheusremotewrite:
    endpoint: http://mimir:9009/api/v1/push

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlphttp/tempo]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlphttp/loki]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheusremotewrite]
```

- [ ] **Step 2: Create db/seed.py**

```python
import json
import uuid
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://aiops:aiops@localhost:5432/aiops"
engine = create_engine(DATABASE_URL)

SEED_DATA = {
    "services": [
        {"id": str(uuid.uuid4()), "name": "E-Commerce Platform", "owner_team": "frontend", "sla_tier": "gold"},
        {"id": str(uuid.uuid4()), "name": "Payment Gateway", "owner_team": "payments", "sla_tier": "gold"},
        {"id": str(uuid.uuid4()), "name": "Inventory Service", "owner_team": "backend", "sla_tier": "silver"},
        {"id": str(uuid.uuid4()), "name": "Notification Service", "owner_team": "platform", "sla_tier": "bronze"},
    ],
    "cis": [
        {"id": str(uuid.uuid4()), "name": "nginx-lb-1", "type": "load_balancer", "provider": "aws", "environment": "prod", "labels": {"app": "nginx", "tier": "frontend"}},
        {"id": str(uuid.uuid4()), "name": "web-server-1", "type": "host", "provider": "aws", "environment": "prod", "labels": {"app": "ecommerce", "tier": "frontend"}},
        {"id": str(uuid.uuid4()), "name": "web-server-2", "type": "host", "provider": "aws", "environment": "prod", "labels": {"app": "ecommerce", "tier": "frontend"}},
        {"id": str(uuid.uuid4()), "name": "api-gateway-ci", "type": "api_gateway", "provider": "aws", "environment": "prod", "labels": {"app": "api-gateway", "tier": "backend"}},
        {"id": str(uuid.uuid4()), "name": "postgres-payments", "type": "database", "provider": "aws", "environment": "prod", "labels": {"app": "payments", "tier": "data"}},
        {"id": str(uuid.uuid4()), "name": "redis-cache", "type": "cache", "provider": "aws", "environment": "prod", "labels": {"app": "redis", "tier": "data"}},
        {"id": str(uuid.uuid4()), "name": "kafka-broker-1", "type": "message_queue", "provider": "aws", "environment": "prod", "labels": {"app": "kafka", "tier": "messaging"}},
        {"id": str(uuid.uuid4()), "name": "payment-processor-1", "type": "microservice", "provider": "aws", "environment": "prod", "labels": {"app": "payments", "tier": "backend"}},
        {"id": str(uuid.uuid4()), "name": "inventory-db", "type": "database", "provider": "aws", "environment": "prod", "labels": {"app": "inventory", "tier": "data"}},
        {"id": str(uuid.uuid4()), "name": "notification-svc", "type": "microservice", "provider": "aws", "environment": "prod", "labels": {"app": "notifications", "tier": "backend"}},
    ],
    "relationships": [
        {"source": 0, "target": 1, "type": "depends_on"},
        {"source": 1, "target": 3, "type": "depends_on"},
        {"source": 3, "target": 4, "type": "depends_on"},
        {"source": 3, "target": 5, "type": "depends_on"},
        {"source": 3, "target": 6, "type": "depends_on"},
        {"source": 6, "target": 7, "type": "depends_on"},
        {"source": 7, "target": 4, "type": "depends_on"},
        {"source": 6, "target": 8, "type": "depends_on"},
        {"source": 6, "target": 9, "type": "depends_on"},
    ],
}


def seed():
    with engine.connect() as conn:
        for svc in SEED_DATA["services"]:
            conn.execute(text(
                "INSERT INTO service (id, name, owner_team, sla_tier) VALUES (:id, :name, :owner_team, :sla_tier) ON CONFLICT (name) DO NOTHING"
            ), svc)

        for ci in SEED_DATA["cis"]:
            conn.execute(text(
                "INSERT INTO ci (id, name, type, provider, environment, labels) VALUES (:id, :name, :type, :provider, :environment, :labels::jsonb)"
            ), {**ci, "labels": json.dumps(ci.get("labels", {}))})

        cis = SEED_DATA["cis"]
        svcs = SEED_DATA["services"]
        conn.execute(text("INSERT INTO service_ci (service_id, ci_id, role) VALUES (:sid, :cid, :role)"), {"sid": svcs[0]["id"], "cid": cis[0]["id"], "role": "entry_point"})
        conn.execute(text("INSERT INTO service_ci (service_id, ci_id, role) VALUES (:sid, :cid, :role)"), {"sid": svcs[0]["id"], "cid": cis[1]["id"], "role": "dependency"})
        conn.execute(text("INSERT INTO service_ci (service_id, ci_id, role) VALUES (:sid, :cid, :role)"), {"sid": svcs[1]["id"], "cid": cis[4]["id"], "role": "entry_point"})

        for rel in SEED_DATA["relationships"]:
            conn.execute(text(
                "INSERT INTO relationship (source_id, target_id, type, discovered_by) VALUES (:source_id, :target_id, :type, 'manual')"
            ), {"source_id": cis[rel["source"]]["id"], "target_id": cis[rel["target"]]["id"], "type": rel["type"]})

        conn.commit()
    print("Seed data inserted successfully!")


if __name__ == "__main__":
    seed()
```

- [ ] **Step 3: Commit**

```bash
git add otel-lgtm/ db/seed.py db/seed_data.json
git commit -m "feat: OTel ingestion config and CMDB seed data"
```

---

## Task Summary

| Task | Description | Subagent | Parallel Group |
|------|-------------|----------|----------------|
| 1 | Project Scaffold + Docker Compose | general | — (first) |
| 2 | Shared Library | general | After Task 1 |
| 3 | PostgreSQL Schema | general | After Task 1 |
| 4 | API Gateway + Auth | general | After Task 2 |
| 5 | CMDB Service | general | After Tasks 3, 4 |
| 6 | OTel Config + Seed Data | general | After Task 3 |

**Parallel Execution Groups:**
- Group A (after Task 1): Tasks 2 + 3 can run in parallel
- Group B (after Tasks 2+3): Tasks 4 + 6 can run in parallel
- Group C (after Tasks 3+4): Task 5

**Total Estimated Time:** ~45-60 minutes with parallel subagents
