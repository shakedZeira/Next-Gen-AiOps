# Plan: Alert Noise Reduction + Simulated Live Alerts

## Overview
Two features:
1. **Alert Noise Reduction** — Temporal dedup + fuzzy grouping to reduce alert volume by 60-80%
2. **Simulated Live Alerts** — Scenario runner to trigger realistic failure patterns on demand

---

## Feature 1: Alert Noise Reduction

### Problem
Both generators (app-level every 5s, infra every 10s) create duplicate alerts constantly. Same alert name + service fires repeatedly with no dedup. The NOC console floods with identical alerts, making it impossible to identify real incidents.

### Design

#### 1A. Temporal Dedup
- Before creating a new alert, check Redis for an active alert with **same normalized name + same service**
- If found within **dedup window (5 min)**: increment `repeat_count` on existing alert, update `last_seen`, do NOT create new alert
- If not found or outside window: create new alert with `repeat_count=1`

#### 1B. Alert Name Normalization
- Strip numbers: "P99", "P95", port numbers ("GigabitEthernet0/3" → "GigabitEthernet0/N")
- Strip timestamps, UUIDs
- Lowercase and collapse whitespace
- Example: "High Latency P99 - payments-api" and "High Latency P95 - payments-api" normalize to same key

#### 1C. Fuzzy Incident Grouping
- After dedup check, compare normalized name against recent alerts (last 5 min) using `difflib.SequenceMatcher`
- If similarity > 0.8: assign same `incident_id`
- Incidents auto-resolve when all constituent alerts resolve

### Backend Changes

#### `plugins/alert_noc/models.py` — Add fields to AlertResponse
```python
class AlertResponse(AlertCreate):
    id: str
    status: AlertStatus
    created_at: datetime
    acknowledged_at: datetime | None = None
    acknowledged_by: str | None = None
    resolved_at: datetime | None = None
    # NEW fields:
    repeat_count: int = 1
    first_seen: datetime | None = None
    last_seen: datetime | None = None
    incident_id: str | None = None
    normalized_name: str | None = None
```

#### `plugins/alert_noc/dedup.py` — NEW FILE: Deduplication engine
```python
class AlertDeduplicator:
    DEDUP_WINDOW = 300  # 5 minutes
    GROUP_SIMILARITY = 0.8
    
    async def process(self, data: AlertCreate) -> tuple[AlertCreate, str | None]:
        """Returns (alert_data, existing_alert_id_or_None)"""
        normalized = self.normalize_name(data.name)
        
        # Step 1: Check for existing active alert with same normalized name + service
        existing_id = await self._find_existing(data.service, normalized)
        if existing_id:
            return data, existing_id  # Caller should update, not create
        
        # Step 2: Try to group with recent alerts
        incident_id = await self._find_incident(data.service, normalized)
        
        return data, None  # Caller should create new
    
    def normalize_name(self, name: str) -> str:
        # Strip "P99", "P95", port numbers, etc.
        # Lowercase, collapse whitespace
        ...
    
    async def _find_existing(self, service: str, normalized: str) -> str | None:
        # Check Redis dedup keys
        ...
    
    async def _find_incident(self, service: str, normalized: str) -> str | None:
        # Find recent alerts with similar normalized names
        # Return incident_id if found, None if new incident needed
        ...
```

#### `plugins/alert_noc/store.py` — Integrate dedup into create flow
```python
async def create_alert(self, data: AlertCreate) -> AlertResponse:
    dedup = AlertDeduplicator(self.redis)
    existing_id = await dedup.check(data)
    
    if existing_id:
        # Update existing alert's repeat_count and last_seen
        return await self._bump_existing(existing_id)
    
    # Create new alert with normalized_name and incident_id
    alert_id = str(uuid.uuid4())
    incident_id = await dedup.find_or_create_incident(data)
    normalized = dedup.normalize_name(data.name)
    
    alert = AlertResponse(
        id=alert_id, **data.model_dump(),
        status=AlertStatus.ACTIVE,
        created_at=datetime.utcnow(),
        first_seen=datetime.utcnow(),
        last_seen=datetime.utcnow(),
        repeat_count=1,
        incident_id=incident_id,
        normalized_name=normalized,
    )
    await self.redis.hset("alerts", alert_id, alert.model_dump_json())
    await self.redis.sadd("alerts:active", alert_id)
    return alert
```

#### `plugins/alert_noc/router.py` — New endpoints
```python
@router.get("/alerts/incidents")
async def list_incidents(status: str | None = None):
    """Return alerts grouped by incident_id"""
    ...

@router.get("/alerts/stats")
async def alert_stats():
    """Return dedup stats: total created, deduplicated, active"""
    ...
```

### Frontend Changes

#### `ui/src/types/index.ts` — Update Alert type
```typescript
interface Alert {
    // ... existing fields ...
    repeat_count?: number;
    first_seen?: string;
    last_seen?: string;
    incident_id?: string;
}
```

#### `ui/src/components/AlertTable.tsx` — Show repeat count badge
- Add "×N" badge next to alert name when `repeat_count > 1`
- Add incident grouping indicator

#### `ui/src/pages/NOCAlerts.tsx` — Add incident view toggle
- "Alerts" | "Incidents" toggle in the filter bar
- Incidents view groups by `incident_id`, shows alert count and timeline
- Fetch from `GET /alerts/incidents` when in incidents mode

### Files to Modify
| File | Change |
|------|--------|
| `plugins/alert_noc/models.py` | Add `repeat_count`, `first_seen`, `last_seen`, `incident_id`, `normalized_name` |
| `plugins/alert_noc/dedup.py` | **NEW** — `AlertDeduplicator` class |
| `plugins/alert_noc/store.py` | Integrate dedup into `create_alert()`, add `_bump_existing()` |
| `plugins/alert_noc/router.py` | Add `/alerts/incidents`, `/alerts/stats` endpoints |
| `ui/src/types/index.ts` | Add new fields to `Alert` interface |
| `ui/src/components/AlertTable.tsx` | Repeat count badge, incident indicator |
| `ui/src/pages/NOCAlerts.tsx` | Incidents view toggle, fetch incidents |
| `ui/src/api/client.ts` | Add `incidents()`, `stats()` API methods |

### Verification
- Generator creates ~100 alerts/hour → dedup should reduce to ~20-30 unique alerts
- Alert table shows "×5" badges on deduplicated alerts
- Incidents view groups related alerts
- Same alert name + service within 5 min → only 1 alert created, repeat_count increments

---

## Feature 2: Simulated Live Alerts

### Problem
Currently alerts are generated randomly by two generators. There's no way to trigger specific failure scenarios for demo/testing purposes. Need a way to simulate realistic cascading failures.

### Design

#### 2A. Scenario Definitions
Predefined failure scenarios that generate realistic alert sequences:

**Scenario 1: "Payment Service Outage"**
- t+0s: High Latency P99 - payments-api (high)
- t+5s: Error Rate Spike - payments-api (critical)
- t+10s: Request Timeout - payments-api (critical)
- t+15s: OOM Killed - payments-app-container (critical)
- t+20s: Health Check Failed - payments-app-container (medium)
- t+30s: Database Connection Pool Exhausted - postgres-payments (high)

**Scenario 2: "Network Failure"**
- t+0s: BGP Peer Down - core-router-1 (critical)
- t+5s: OSPF Adjacency Change - core-router-2 (high)
- t+10s: Link Down - GigabitEthernet0/1 - core-switch-1 (critical)
- t+15s: High Latency P99 - all dependent services (high)
- t+20s: Request Timeout - ecommerce-api, order-service (critical)

**Scenario 3: "Disk Space Exhaustion"**
- t+0s: Disk Space Low - payments-app-server (medium)
- t+30s: Disk Space Critical - payments-app-server (high)
- t+60s: Disk Space Critical - payments-db-server (high)
- t+90s: Service Down - postgres-payments (critical)
- t+120s: Error Rate Spike - payments-api (critical)

**Scenario 4: "Cascading Microservice Failure"**
- t+0s: High Latency P99 - inventory-api (high)
- t+5s: Error Rate Spike - inventory-api (critical)
- t+10s: High Latency P99 - order-service (high) — depends on inventory
- t+15s: Request Timeout - order-service (critical)
- t+20s: Error Rate Spike - ecommerce-api (critical) — depends on order
- t+25s: Error Rate Spike - payments-api (critical) — depends on order

**Scenario 5: "Database Failover"**
- t+0s: Memory Critical - postgres-payments-server (high)
- t+10s: Service Down - postgres-payments (critical)
- t+15s: Database Connection Pool Exhausted - payments-api (high)
- t+20s: High Latency P99 - payments-api (critical)
- t+25s: Request Timeout - payments-api (critical)

#### 2B. Scenario Runner
- New endpoint: `POST /api/v1/simulate/scenario` with `{"scenario": "payment-outage"}`
- Triggers the scenario's alert sequence with correct timing
- Returns `{"status": "started", "scenario": "payment-outage", "alert_count": 6}`
- Running scenarios tracked in Redis with status (running/completed)

#### 2C. UI Integration
- "Simulate" button in NOC Alert Console header
- Dropdown to select scenario
- Click "Run" → alerts appear in real-time over the next 30-60 seconds
- Visual indicator showing scenario is running

### Backend Changes

#### `plugins/alert_noc/scenarios.py` — NEW FILE: Scenario definitions
```python
SCENARIOS = {
    "payment-outage": {
        "name": "Payment Service Outage",
        "description": "Cascading failure in payment processing",
        "alerts": [
            {"delay": 0,  "name": "High Latency P99 - payments-api", "service": "Payment Gateway", "severity": "high", "team": "payments"},
            {"delay": 5,  "name": "Error Rate Spike - payments-api", "service": "Payment Gateway", "severity": "critical", "team": "payments"},
            {"delay": 10, "name": "Request Timeout - payments-api", "service": "Payment Gateway", "severity": "critical", "team": "payments"},
            {"delay": 15, "name": "OOM Killed - payments-app", "service": "Payment Gateway", "severity": "critical", "team": "payments"},
            {"delay": 20, "name": "Health Check Failed - payments-app", "service": "Payment Gateway", "severity": "medium", "team": "payments"},
            {"delay": 30, "name": "DB Connection Pool Exhausted - postgres-payments", "service": "Payment Gateway", "severity": "high", "team": "payments"},
        ],
    },
    # ... 4 more scenarios
}

class ScenarioRunner:
    async def run(self, scenario_name: str):
        scenario = SCENARIOS[scenario_name]
        for alert_def in scenario["alerts"]:
            await asyncio.sleep(alert_def["delay"])
            await self._create_alert(alert_def)
```

#### `plugins/alert_noc/router.py` — New endpoint
```python
@router.post("/simulate/scenario")
async def run_scenario(data: ScenarioRequest):
    """Trigger a predefined failure scenario"""
    runner = ScenarioRunner(alert_store)
    asyncio.create_task(runner.run(data.scenario))
    return {"status": "started", "scenario": data.scenario}

@router.get("/simulate/scenarios")
async def list_scenarios():
    """List available scenarios"""
    return [{"id": k, "name": v["name"], "description": v["description"], "alert_count": len(v["alerts"])} 
            for k, v in SCENARIOS.items()]
```

#### `ui/src/api/client.ts` — New API methods
```typescript
simulateAPI = {
    listScenarios: () => api.get('/simulate/scenarios'),
    runScenario: (scenario: string) => api.post('/simulate/scenario', { scenario }),
}
```

#### `ui/src/pages/NOCAlerts.tsx` — Simulate button
- Add "Simulate" button in header bar
- Dropdown with scenario names
- Click "Run" triggers the scenario
- Show toast "Scenario started: Payment Service Outage"
- Auto-refresh alerts every 3s while scenario is running

### Files to Create/Modify
| File | Change |
|------|--------|
| `plugins/alert_noc/scenarios.py` | **NEW** — 5 scenario definitions + `ScenarioRunner` class |
| `plugins/alert_noc/router.py` | Add `/simulate/scenario`, `/simulate/scenarios` endpoints |
| `ui/src/api/client.ts` | Add `simulateAPI` methods |
| `ui/src/pages/NOCAlerts.tsx` | Simulate button, scenario dropdown, auto-refresh |

### Verification
- Click "Simulate" → select "Payment Service Outage" → click "Run"
- Alerts appear in the table over 30 seconds with correct severity progression
- Dedup works correctly (no duplicate alerts within the scenario)
- Scenario completes and alerts auto-group into an incident

---

## Execution Order

### Step 1: Backend — Alert Models + Dedup
1. Update `plugins/alert_noc/models.py` with new fields
2. Create `plugins/alert_noc/dedup.py` with dedup logic
3. Update `plugins/alert_noc/store.py` to integrate dedup
4. Add new endpoints to `plugins/alert_noc/router.py`

### Step 2: Backend — Scenario Runner
5. Create `plugins/alert_noc/scenarios.py` with 5 scenarios
6. Add `/simulate/*` endpoints to router

### Step 3: Frontend — Alert Table + Incidents
7. Update `ui/src/types/index.ts` with new Alert fields
8. Update `ui/src/api/client.ts` with new API methods
9. Update `ui/src/components/AlertTable.tsx` with repeat count badge
10. Update `ui/src/pages/NOCAlerts.tsx` with incidents view + simulate button

### Step 4: Verify
11. TypeScript check
12. Docker build
13. Test: trigger scenario → verify dedup → verify incidents view
14. Git push

---

## Status: COMPLETED ✅

### Commits
- `2ad3667` — Alert noise reduction + simulated live alerts (backend + frontend)
- `d9a81f6` — Fix simulate button 404 (add `/api/v1/simulate/*` proxy route)
- `9cbf623` — ServiceNow Principal Class pattern (site overview simplification)
- `4a7abe1` — Expandable site topology (drill-down in CMDBExplorer)
- `851f719` — Fix expand/collapse bug (CMDBExplorer not passing expandable prop)
- `a14781f` — Fix CI failures (ruff lint + mypy type errors)

### Verified
- All 5 failure scenarios generate realistic alerts with correct dedup
- Incidents view groups related alerts with repeat counts
- Simulate button triggers auto-refresh during scenario
- Expandable topology shows principal devices, click to expand children
- ruff: 0 errors, mypy: 0 errors, npm build: success
