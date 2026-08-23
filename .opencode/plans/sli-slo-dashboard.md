# Plan: SLI/SLO Dashboard ✅ COMPLETED

**Impact: MEDIUM | Effort: LOW-MEDIUM (1-2 days)**
**Status: COMPLETED** — Commit `171d1ed`
**Dependencies: None**

---

## Goal
Track Service Level Indicators (SLIs) and Service Level Objectives (SLOs) for each service.

## Current State
- No SLI/SLO tracking exists
- Dashboard shows system health as `100 - Math.log2(alertCount + 1) * 5`
- No error budget concept
- No availability/latency targets

## Design

### SLI Definitions (per service)
| SLI | Formula | Target |
|-----|---------|--------|
| Availability | `1 - (errors / total_requests)` | 99.9% |
| Latency (P99) | `percentile(latency, 99)` | < 500ms |
| Error Rate | `errors / total_requests` | < 1% |

### SLO Structure
```json
{
  "service": "Payment Gateway",
  "slo_name": "Availability",
  "sli_value": 99.95,
  "slo_target": 99.9,
  "error_budget_remaining": 100,
  "status": "healthy"
}
```

### Error Budget
- Monthly budget: `(1 - SLO_target) * 30 * 24 * 60` minutes
- Consumed when alerts fire
- Remaining = budget - consumed
- Status: healthy (>50%), warning (25-50%), critical (<25%), exhausted (0%)

## Implementation

### Backend

#### 1. Add SLI/SLO model
- File: `aiops_shared/models/slo.py` (NEW)
```python
class ServiceSLO(Base):
    __tablename__ = "service_slo"
    
    id = Column(String, primary_key=True)
    service = Column(String, nullable=False)
    slo_type = Column(String)  # availability, latency, error_rate
    sli_value = Column(Float)  # current SLI value
    slo_target = Column(Float)  # target (e.g., 99.9)
    error_budget_total = Column(Float)  # minutes per month
    error_budget_remaining = Column(Float)
    last_updated = Column(DateTime)
```

#### 2. Add migration
- File: `db/migrations/007_create_slo.sql` (NEW)
```sql
CREATE TABLE IF NOT EXISTS service_slo (
  id VARCHAR(255) PRIMARY KEY,
  service VARCHAR(255) NOT NULL,
  slo_type VARCHAR(50) NOT NULL,
  sli_value FLOAT,
  slo_target FLOAT,
  error_budget_total FLOAT,
  error_budget_remaining FLOAT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_slo_service ON service_slo(service);
```

#### 3. Add SLO endpoints
- File: `core_platform/routers/slo.py` (NEW)
- `GET /api/v1/slo` — list all SLOs
- `GET /api/v1/slo/{service}` — get SLOs for a service
- `POST /api/v1/slo` — create/update SLO
- `GET /api/v1/slo/{service}/budget` — get error budget status

#### 4. Seed SLO data
- File: `db/seed_slo.py` (NEW)
- Create SLOs for all 8 services:
  - Availability: 99.9% target
  - Latency P99: 500ms target
  - Error Rate: 1% target

#### 5. Calculate SLI from alerts
- File: `core_platform/routers/slo.py`
- On SLO query: check recent alerts for the service
- Calculate availability = 1 - (alerts / time_window)
- Update error budget based on alert severity

### Frontend

#### 6. Create SLO Dashboard page
- File: `ui/src/pages/SLODashboard.tsx` (NEW)
- Grid of service cards showing:
  - Service name
  - 3 SLI gauges (Availability, Latency, Error Rate)
  - Error budget bar (green/yellow/red)
  - Status badge (healthy/warning/critical/exhausted)

#### 7. Add to routing
- File: `ui/src/App.tsx`
- Add route: `/slo` → `SLODashboard`

#### 8. Add to navigation
- File: `ui/src/components/Sidebar.tsx`
- Add "SLO" nav item with target icon

#### 9. Add to Docs page
- File: `ui/src/pages/Docs.tsx`
- Add "SLI/SLO Dashboard" section

## Files to Create/Modify
- `aiops_shared/models/slo.py` — NEW: SLO model
- `db/migrations/007_create_slo.sql` — NEW: migration
- `db/seed_slo.py` — NEW: seed data
- `core_platform/routers/slo.py` — NEW: SLO endpoints
- `core_platform/main.py` — register SLO router
- `ui/src/pages/SLODashboard.tsx` — NEW: dashboard page
- `ui/src/App.tsx` — add route
- `ui/src/components/Sidebar.tsx` — add nav item
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Navigate to /slo
2. See 8 service cards with SLI gauges
3. Click a service → see detailed SLO view
4. Error budget bar shows remaining budget
5. Trigger alerts → error budget decreases
6. Budget goes below 25% → status changes to "warning"
