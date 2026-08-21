# Plan: Service Dependency Map

**Impact: MEDIUM-HIGH | Effort: HIGH (4-5 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Real-time service mesh visualization with latency/error rates.

## Current State
- CMDB topology shows CI relationships (devices, not services)
- No service-to-service dependency visualization
- No real-time metrics overlay
- No latency/error rate per edge

## Design

### Architecture
```
Service Discovery → Dependency Mapper → Metric Collector → Cytoscape Visualization
    (Consul/etcd)      (API calls)        (OTel)              (Frontend)
```

### Service Dependencies
- Services call other services via HTTP/gRPC
- Dependencies discovered via:
  1. Static configuration (YAML)
  2. Dynamic discovery (trace analysis)
  3. Manual entry

### Metrics per Edge
| Metric | Description |
|--------|-------------|
| Latency | P50, P95, P99 response time |
| Error Rate | 4xx/5xx responses per total |
| Throughput | Requests per second |
| Availability | Success rate |

## Implementation

### Backend

#### 1. Create dependency mapper plugin
- File: `plugins/dependency_mapper/main.py` (NEW)
- FastAPI app with dependency discovery
- Port: 8010 (internal)

#### 2. Create dependency model
- File: `aiops_shared/models/dependency.py` (NEW)
```python
class ServiceDependency(Base):
    __tablename__ = "service_dependency"
    
    id = Column(String, primary_key=True)
    source_service = Column(String, nullable=False)
    target_service = Column(String, nullable=False)
    dependency_type = Column(String)  # http, grpc, async
    latency_p50 = Column(Float)
    latency_p95 = Column(Float)
    latency_p99 = Column(Float)
    error_rate = Column(Float)
    throughput = Column(Float)
    availability = Column(Float)
    last_updated = Column(DateTime)
```

#### 3. Add migration
- File: `db/migrations/009_create_service_dependency.sql` (NEW)
```sql
CREATE TABLE IF NOT EXISTS service_dependency (
  id VARCHAR(255) PRIMARY KEY,
  source_service VARCHAR(255) NOT NULL,
  target_service VARCHAR(255) NOT NULL,
  dependency_type VARCHAR(50),
  latency_p50 FLOAT,
  latency_p95 FLOAT,
  latency_p99 FLOAT,
  error_rate FLOAT,
  throughput FLOAT,
  availability FLOAT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_dep_source ON service_dependency(source_service);
CREATE INDEX idx_dep_target ON service_dependency(target_service);
```

#### 4. Create dependency discovery
- File: `plugins/dependency_mapper/discovery.py` (NEW)
```python
class DependencyDiscovery:
    def __init__(self, db_session):
        self.db = db_session
    
    async def discover_from_traces(self):
        """Analyze OTel traces to discover dependencies."""
        # Query trace data for service-to-service calls
        # Extract source → target pairs
        # Store in service_dependency table
    
    async def discover_from_config(self, config_path: str):
        """Load dependencies from YAML config."""
        with open(config_path) as f:
            config = yaml.safe_load(f)
            for dep in config.get("dependencies", []):
                await self._store_dependency(dep)
    
    async def _store_dependency(self, dep: dict):
        """Store dependency in database."""
        # Check if exists, update metrics if so
        # Otherwise create new dependency
```

#### 5. Create API endpoints
- File: `plugins/dependency_mapper/router.py` (NEW)
- `GET /api/v1/dependencies` — list all dependencies
- `GET /api/v1/dependencies/{service}` — get dependencies for a service
- `POST /api/v1/dependencies` — add dependency manually
- `GET /api/v1/dependencies/graph` — get dependency graph for visualization
- `POST /api/v1/dependencies/discover` — trigger discovery

#### 6. Seed dependency data
- File: `db/seed_dependencies.py` (NEW)
- Create realistic service dependencies:
  - Payment Gateway → User Service, Order Service, Notification Service
  - E-Commerce Platform → Payment Gateway, Inventory Service, Search Service
  - etc.

#### 7. Add to docker-compose
- File: `docker-compose.yml`
- Add `dependency-mapper` service:
  ```yaml
  dependency-mapper:
    build: ./plugins/dependency_mapper
    ports:
      - "8010:8010"
    environment:
      - DATABASE_URL=postgresql+asyncpg://aiops:aiops@postgres:5432/aiops
      - REDIS_URL=redis://:changeme@redis:6379/0
    depends_on:
      - postgres
      - redis
  ```

#### 8. Add proxy route to API gateway
- File: `core_platform/main.py`
- Add route: `/api/v1/dependencies/{path}` → `http://dependency-mapper:8010`

### Frontend

#### 9. Create Service Map page
- File: `ui/src/pages/ServiceMap.tsx` (NEW)
- Cytoscape visualization of service dependencies
- Nodes = services, Edges = dependencies
- Edge thickness = throughput
- Edge color = health (green/yellow/red based on error rate)
- Click edge → show metrics (latency, error rate, throughput)
- Click node → show service details + dependencies

#### 10. Add edge metrics overlay
- File: `ui/src/components/DependencyGraph.tsx` (NEW)
- Display latency/error rate on edges
- Color edges by health:
  - Green: error rate < 1%
  - Yellow: error rate 1-5%
  - Red: error rate > 5%
- Animate edges by throughput (dash animation speed)

#### 11. Add to routing
- File: `ui/src/App.tsx`
- Add route: `/service-map` → `ServiceMap`

#### 12. Add to navigation
- File: `ui/src/components/Sidebar.tsx`
- Add "Service Map" nav item with network icon

#### 13. Add to Docs page
- File: `ui/src/pages/Docs.tsx`
- Add "Service Dependency Map" section

## Files to Create/Modify
- `plugins/dependency_mapper/` — NEW: entire plugin directory
  - `main.py` — FastAPI app
  - `discovery.py` — dependency discovery
  - `router.py` — API endpoints
  - `config.py` — configuration
  - `Dockerfile` — container build
- `aiops_shared/models/dependency.py` — NEW: dependency model
- `db/migrations/009_create_service_dependency.sql` — NEW: migration
- `db/seed_dependencies.py` — NEW: seed data
- `docker-compose.yml` — add dependency-mapper service
- `core_platform/main.py` — add proxy route
- `ui/src/pages/ServiceMap.tsx` — NEW: service map page
- `ui/src/components/DependencyGraph.tsx` — NEW: dependency graph
- `ui/src/App.tsx` — add route
- `ui/src/components/Sidebar.tsx` — add nav item
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Navigate to /service-map
2. See service dependency graph
3. Payment Gateway → User Service edge shows latency: 45ms
4. Edge color is green (error rate < 1%)
5. Click edge → see detailed metrics
6. Click node → see service details
7. Trigger payment gateway alert → edge turns red
8. Dashboard shows service health map
