# Plan: Future Features (Tier 1/2/3)

## Goal
15 features prioritized by impact and feasibility, organized into 3 tiers.

---

## Completed Features

### Feature 1: Alert Noise Reduction ✅ COMPLETED
**Impact: HIGH | Effort: MEDIUM (2-3 days)** — Implemented and deployed.

#### What Was Built
- `plugins/alert_noc/dedup.py` — Temporal dedup with 60s window, normalized name matching
- `plugins/alert_noc/models.py` — `repeat_count`, `first_seen`, `last_seen`, `incident_id`, `normalized_name` fields
- `plugins/alert_noc/store.py` — Redis-backed store with dedup integration
- `plugins/alert_noc/router.py` — `/alerts/incidents`, `/alerts/stats` endpoints
- `plugins/alert_noc/scenarios.py` — 5 failure scenarios (payment-outage, network-failure, disk-exhaustion, cascading-microservice, database-failover)
- Frontend: AlertTable with ×N badge, NOCAlerts with alerts/incidents toggle, simulate button, auto-refresh

#### Commits
- `2ad3667` — Backend + frontend implementation
- `d9a81f6` — Fix simulate button 404 (proxy route)

---

### Feature 16: Service Filtering by Site ✅ COMPLETED
**Impact: MEDIUM | Effort: LOW (1 day)** — Implemented and deployed.

#### What Was Built
- Backend: `get_site_topology(site, view, service_id)` — filters CIs by service membership via ServiceCI join
- Backend: `GET /cmdb/services` — all services with CI counts
- Backend: `GET /cmdb/sites/{name}/services` — services with CIs in a specific site
- Frontend: Service dropdown in CMDBExplorer when viewing a specific site
- Frontend: Topology graph filters to show only CIs belonging to selected service
- Frontend: SiteService type, API client methods

#### Bug Fixes Applied (2026-08-20)
- **Service filter not appearing for non-HQ sites**: All 8 services only had CIs mapped to `global-hq`. Added multi-site service-CI mappings via migration `004_expand_service_ci_mappings.sql` — all services now span 2-5 sites.
- **TopologyGraph visual highlighting broken**: `selectedService` prop was receiving `selectedFlow` (team name) instead of the actual service name. Fixed CMDBExplorer to resolve service UUID → name and pass as `highlightedService`.
- **Incidents not clickable**: `get_incident()`, `acknowledge_incident()`, `resolve_incident()` in `store.py` only searched active alerts. Added `list_all_alerts()` method that searches across all statuses (active, acknowledged, resolved). All three methods now use it.
- Updated seed data `service_ci_map` in `db/seed.py` for future re-seeds.

#### Commits
- `4e6c2dd` — Service filter initial implementation
- `88977c1` — Flow dropdown fix
- `491b19e` — Bug fixes for service filter + incidents (multi-site CI mappings, list_all_alerts, highlightedService)

---

### Feature 17: Change-Aware Correlation ✅ COMPLETED
**Impact: HIGH | Effort: MEDIUM (2-3 days)** — Implemented and deployed.

Correlate alerts with recent deployments/config changes to identify root cause.

#### What Was Built
- `aiops_shared/models/change.py` — SQLAlchemy 2.0 Change model
- `db/migrations/006_create_changes.sql` — change table with indexes
- `db/seed_changes.py` — 27 realistic changes across 7 services
- `core_platform/routers/changes.py` — CRUD + correlation endpoints (`/changes/correlate/{service}`)
- `ui/src/components/RecentChanges.tsx` — risk-colored panel with "LIKELY ROOT CAUSE" badge
- `ui/src/components/AlertDetail.tsx` — alert drill-down with changes, timeline, suggest fix
- `ui/src/api/client.ts` — changesAPI (list/recent/correlate)
- `plugins/chatbot/tools.py` — get_recent_changes tool + TOOL_MAP entry
- `ui/src/pages/Docs.tsx` — Change-Aware Correlation section + API Reference

#### Commits
- `a5a7fe2` — Backend + frontend implementation
- `b571966` — Improved visibility + alert drill-down

---

### Feature 18: Alert Drill-Down ✅ COMPLETED
**Impact: MEDIUM | Effort: LOW (0.5 day)** — Implemented and deployed.

Click any alert in the NOC Alerts table to see full detail view.

#### What Was Built
- `ui/src/components/AlertDetail.tsx` — full alert detail with metadata, description, changes, timeline, suggest fix
- `ui/src/components/AlertTable.tsx` — clickable rows with `onAlertClick` callback
- `ui/src/pages/NOCAlerts.tsx` — wires AlertDetail drill-down

#### Commits
- `b571966` — Alert drill-down implementation

---

## Tier 1 — High Impact, Medium Effort (Remaining)

### Feature 2: ML Anomaly Detection
**Impact: HIGH | Effort: MEDIUM (3-4 days)**

#### Design
- **Temporal dedup**: Same alert (service + name + severity) within 5-minute window → merge into single alert with "repeat count" field
- **Fuzzy grouping**: Alerts with similar titles (edit distance < 3) → group into incident
- **Alert correlation**: Alerts from related CIs within 60 seconds → group into incident tree

#### Backend Changes
```python
# plugins/alert_noc/store.py
class AlertDeduplicator:
    def __init__(self, redis):
        self.redis = redis
        self.dedup_window = 300  # 5 minutes
        self.group_window = 60   # 1 minute for grouping
    
    async def process_alert(self, alert: dict) -> dict:
        # Step 1: Temporal dedup
        dedup_key = f"dedup:{alert['service']}:{alert['name']}:{alert['severity']}"
        existing = await self.redis.get(dedup_key)
        
        if existing:
            # Update repeat count on existing alert
            existing_alert = json.loads(existing)
            existing_alert['repeat_count'] = existing_alert.get('repeat_count', 1) + 1
            existing_alert['last_seen'] = time.time()
            await self.redis.set(dedup_key, json.dumps(existing_alert), ex=self.dedup_window)
            return existing_alert  # Don't create new alert
        
        # Step 2: Store for grouping
        alert['first_seen'] = time.time()
        alert['repeat_count'] = 1
        await self.redis.set(dedup_key, json.dumps(alert), ex=self.dedup_window)
        
        # Step 3: Try to group with recent alerts
        grouped = await self._try_group(alert)
        if grouped:
            return grouped  # Added to existing incident
        
        return alert  # New incident
    
    async def _try_group(self, alert: dict) -> dict | None:
        # Find recent alerts with similar titles
        recent = await self.redis.keys("dedup:*")
        for key in recent:
            data = json.loads(await self.redis.get(key))
            if self._fuzzy_match(alert['title'], data['title']):
                # Group into same incident
                return await self._create_incident_group([alert, data])
        return None
    
    def _fuzzy_match(self, title1: str, title2: str) -> bool:
        # Simple edit distance check
        from difflib import SequenceMatcher
        return SequenceMatcher(None, title1.lower(), title2.lower()).ratio() > 0.8
```

#### Frontend Changes
- Update alert table to show "repeat count" badge
- Add "incidents" view mode that groups alerts by incident
- Show incident timeline with alert cascade

#### Verification
- Generator creates 100 alerts/hour → dedup reduces to ~20 unique alerts
- Similar alerts (e.g., "High Latency on Service A" and "High Latency on Service B") are grouped
- Alert table shows repeat counts

---

### Feature 2: ML Anomaly Detection
**Impact: HIGH | Effort: MEDIUM (3-4 days)**

Replace z-score threshold alerts with Isolation Forest anomaly detection.

#### Design
- Train Isolation Forest on historical metric data (CPU, memory, latency, error rate)
- Detect anomalies in real-time as new data arrives
- Anomaly score > threshold → generate alert with confidence score
- Support for multivariate anomalies (e.g., CPU high + memory low = anomaly)

#### Backend Changes
```python
# NEW: plugins/anomaly_detector/detector.py
from sklearn.ensemble import IsolationForest
import numpy as np

class AnomalyDetector:
    def __init__(self):
        self.models = {}  # service_name -> trained model
        self.feature_names = ['cpu_usage', 'memory_usage', 'latency_p99', 'error_rate', 'throughput']
    
    def train(self, service_name: str, historical_data: np.ndarray):
        """Train Isolation Forest on historical metrics."""
        model = IsolationForest(
            n_estimators=100,
            contamination=0.05,  # Expect 5% anomalies
            random_state=42
        )
        model.fit(historical_data)
        self.models[service_name] = model
    
    def predict(self, service_name: str, current_metrics: np.ndarray) -> dict:
        """Predict if current metrics are anomalous."""
        if service_name not in self.models:
            return {"anomaly": False, "score": 0.0, "confidence": 0.0}
        
        model = self.models[service_name]
        score = model.score_samples(current_metrics.reshape(1, -1))[0]
        prediction = model.predict(current_metrics.reshape(1, -1))[0]
        
        # Convert score to confidence (0-100%)
        confidence = min(100, max(0, (score + 0.5) * 100))
        
        return {
            "anomaly": prediction == -1,
            "score": float(score),
            "confidence": confidence,
            "features": dict(zip(self.feature_names, current_metrics.tolist()))
        }
```

**New endpoint:**
```python
@router.post("/anomaly/detect")
async def detect_anomaly(service_name: str, metrics: dict, _user=Depends(get_current_user)):
    detector = get_detector()
    result = detector.predict(service_name, np.array([
        metrics['cpu_usage'],
        metrics['memory_usage'],
        metrics['latency_p99'],
        metrics['error_rate'],
        metrics['throughput']
    ]))
    
    if result['anomaly']:
        # Generate alert
        await create_alert({
            "service": service_name,
            "name": f"Anomaly detected in {service_name}",
            "severity": "high" if result['confidence'] > 80 else "medium",
            "description": f"Anomaly score: {result['score']:.3f}, Confidence: {result['confidence']:.1f}%",
            "labels": result['features']
        })
    
    return result
```

#### Frontend Changes
- Add anomaly score to service health cards
- Show anomaly timeline (when anomalies occurred)
- Add "Anomaly Detection" toggle in Dashboard

#### Verification
- Train on historical data → detect known anomalies
- False positive rate < 5%
- Anomalies generate alerts with confidence scores

---

### Feature 3: Change-Aware Correlation ✅ COMPLETED
**Impact: HIGH | Effort: MEDIUM (2-3 days)**

Correlate alerts with recent deployments/config changes to identify root cause.

#### Design
- Track deployment events (CI/CD webhook or manual entry)
- When alert fires, check for recent changes (within 30 minutes)
- Include change context in alert description
- Calculate "change risk score" based on timing and scope

#### Backend Changes
```python
# NEW: plugins/change_tracker/models.py
from sqlalchemy import Column, String, DateTime, JSON
from aiops_shared.database import Base

class Change(Base):
    __tablename__ = "changes"
    
    id = Column(String, primary_key=True)
    service = Column(String, nullable=False)
    type = Column(String)  # deployment, config, infrastructure
    description = Column(String)
    author = Column(String)
    timestamp = Column(DateTime)
    metadata = Column(JSON)
    status = Column(String)  # successful, failed, rolled_back

# NEW: plugins/change_tracker/correlator
class ChangeCorrelator:
    def __init__(self, db_session):
        self.db = db_session
    
    async def correlate(self, alert: dict) -> dict:
        """Find recent changes that might have caused this alert."""
        alert_time = alert.get('created_at', datetime.utcnow())
        lookback = timedelta(minutes=30)
        
        # Find changes to this service within lookback window
        changes = await self.db.execute(
            select(Change)
            .where(Change.service == alert['service'])
            .where(Change.timestamp >= alert_time - lookback)
            .where(Change.timestamp <= alert_time)
            .order_by(Change.timestamp.desc())
        )
        
        recent_changes = changes.scalars().all()
        
        if recent_changes:
            # Calculate risk score based on timing
            risk_score = 0
            for change in recent_changes:
                minutes_since = (alert_time - change.timestamp).total_seconds() / 60
                # Closer changes = higher risk
                risk_score += max(0, 100 - (minutes_since * 3.33))
            
            risk_score = min(100, risk_score / len(recent_changes))
            
            alert['change_correlation'] = {
                'has_recent_changes': True,
                'changes': [
                    {
                        'id': c.id,
                        'type': c.type,
                        'description': c.description,
                        'author': c.author,
                        'timestamp': c.timestamp.isoformat(),
                        'minutes_before_alert': (alert_time - c.timestamp).total_seconds() / 60
                    }
                    for c in recent_changes
                ],
                'risk_score': risk_score,
                'likely_cause': risk_score > 70
            }
        else:
            alert['change_correlation'] = {
                'has_recent_changes': False,
                'risk_score': 0
            }
        
        return alert
```

#### Frontend Changes
- Show "Recent Changes" section in alert details
- Highlight alerts with high change risk score
- Add "Changes" tab in service view showing deployment history

#### Verification
- Deploy a change → alert fires within 30 minutes → correlation shown
- Alert description includes "Likely caused by deployment X by user Y"
- Risk score accurately reflects timing proximity

---

### Feature 4: Incident Timeline ✅ PARTIAL
**Impact: HIGH | Effort: MEDIUM (2-3 days)**

Visual timeline showing alert cascade and resolution for incident investigation.

#### What Was Built
- `IncidentDetail.tsx` — full incident drill-down with timeline (creation → alerts → ack → resolve events)
- `AlertDetail.tsx` — alert drill-down with timeline, changes, suggest fix
- `AlertTable.tsx` — clickable rows with `onAlertClick` callback
- `NOCAlerts.tsx` — wires AlertDetail and IncidentDetail drill-downs

#### Design
- When multiple alerts fire within a short window, group into an "incident"
- Show timeline with: first alert, subsequent alerts, acknowledgments, resolutions
- Color-coded by severity
- Expandable to show related changes and RCA results

#### Backend Changes
```python
# plugins/alert_noc/incident.py
class IncidentManager:
    def __init__(self, redis):
        self.redis = redis
        self.incident_window = 300  # 5 minutes
    
    async def create_incident(self, trigger_alert: dict) -> dict:
        incident = {
            "id": str(uuid.uuid4()),
            "title": trigger_alert['title'],
            "service": trigger_alert['service'],
            "created_at": time.time(),
            "alerts": [trigger_alert],
            "status": "active",
            "severity": trigger_alert['severity'],
            "timeline": [
                {
                    "timestamp": time.time(),
                    "type": "alert_created",
                    "message": f"Alert created: {trigger_alert['title']}",
                    "severity": trigger_alert['severity']
                }
            ]
        }
        await self.redis.hset("incidents", incident['id'], json.dumps(incident))
        return incident
    
    async def add_alert_to_incident(self, incident_id: str, alert: dict):
        data = json.loads(await self.redis.hget("incidents", incident_id))
        data['alerts'].append(alert)
        data['timeline'].append({
            "timestamp": time.time(),
            "type": "alert_added",
            "message": f"Related alert: {alert['title']}",
            "severity": alert['severity']
        })
        # Update severity to highest among all alerts
        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
        data['severity'] = max(data['alerts'], key=lambda a: severity_order.get(a['severity'], 0))['severity']
        await self.redis.hset("incidents", incident_id, json.dumps(data))
```

#### Frontend Changes
- New `IncidentTimeline.tsx` component
- Horizontal timeline with alert events
- Click any event to see full details
- Add "Incidents" view to NOC console

#### Verification
- Multiple alerts within 5 minutes → grouped into incident
- Timeline shows chronological order of events
- Resolution of final alert closes the incident

---

### Feature 5: Runbook Automation
**Impact: HIGH | Effort: MEDIUM (3-4 days)**

YAML-based playbooks with approval gates for automated remediation.
**Plan:** `runbook-automation.md` (not yet created)

#### Design
- Define runbooks as YAML files with steps
- Each step can be: check, action, approval, notification
- Chatbot can trigger runbooks based on alert type
- All destructive actions require human approval

#### YAML Schema
```yaml
# runbooks/high-latency-payment-gateway.yaml
name: "High Latency on Payment Gateway"
trigger:
  alert_name: "High Latency P99"
  service: "Payment Gateway"
  severity: ["critical", "high"]

steps:
  - name: "Check current latency"
    type: check
    action: query_metrics
    params:
      metric: "http_request_duration_seconds"
      service: "payment-gateway"
      threshold: 2.0
    
  - name: "Check database connection pool"
    type: check
    action: query_metrics
    params:
      metric: "db_connection_pool_active"
      service: "payment-gateway"
      threshold: 45
    
  - name: "Propose connection pool increase"
    type: approval
    action: propose_fix
    params:
      description: "Increase DB connection pool from 50 to 100"
      command: "kubectl scale deployment payment-gateway --replicas=3"
    
  - name: "Wait for approval"
    type: wait_for_approval
    
  - name: "Scale up payment gateway"
    type: action
    condition: approved
    action: execute_fix
    params:
      command: "kubectl scale deployment payment-gateway --replicas=3"
    
  - name: "Verify latency improved"
    type: check
    action: query_metrics
    params:
      metric: "http_request_duration_seconds"
      service: "payment-gateway"
      threshold: 1.5
      wait_seconds: 60
    
  - name: "Notify team"
    type: notification
    action: send_notification
    params:
      channel: "slack"
      message: "Payment Gateway scaled up, latency improved"
```

#### Backend Changes
```python
# plugins/runbook/engine.py
class RunbookEngine:
    def __init__(self, approval_manager, alert_store):
        self.approval_manager = approval_manager
        self.alert_store = alert_store
        self.runbooks = self._load_runbooks()
    
    def _load_runbooks(self) -> dict:
        runbooks = {}
        for path in Path("runbooks").glob("*.yaml"):
            with open(path) as f:
                rb = yaml.safe_load(f)
                runbooks[rb['name']] = rb
        return runbooks
    
    async def execute(self, runbook_name: str, context: dict) -> dict:
        rb = self.runbooks[runbook_name]
        results = []
        
        for step in rb['steps']:
            if step['type'] == 'approval':
                # Create approval request
                request_id = await self.approval_manager.request_approval(
                    ApprovalRequest(
                        tool_name=step['action'],
                        arguments=step['params'],
                        context=f"Runbook: {runbook_name}, Step: {step['name']}"
                    )
                )
                # Wait for approval
                approved = await self._wait_for_approval(request_id)
                if not approved and step.get('condition') == 'approved':
                    return {"status": "aborted", "reason": "Approval denied"}
            
            elif step['type'] == 'action':
                result = await self._execute_action(step)
                results.append(result)
            
            elif step['type'] == 'check':
                result = await self._execute_check(step)
                results.append(result)
                if not result.get('passed'):
                    return {"status": "failed", "step": step['name'], "result": result}
        
        return {"status": "completed", "results": results}
```

#### Frontend Changes
- New "Runbooks" page showing available runbooks
- Runbook execution history
- Manual trigger button for each runbook
- Integration with chatbot (AI suggests runbook)

#### Verification
- Alert fires → chatbot suggests runbook → user approves → runbook executes
- All steps logged with timestamps
- Failed checks abort the runbook

---

## Tier 2 — High Impact, High Effort (Implement Later)

### Feature 6: Predictive Alerting
**Impact: HIGH | Effort: HIGH (5-7 days)**

Forecast metric trends and alert before threshold breach.
**Plan:** Not yet created

#### Design
- Use ARIMA or Prophet for time series forecasting
- Train on historical metrics (last 7 days)
- Forecast next 30 minutes
- Alert if forecast exceeds threshold with >80% confidence

#### Key Components
- `plugins/forecasting/` — New microservice
- Forecast model training pipeline
- Real-time scoring endpoint
- Dashboard showing forecast vs actual

---

### Feature 7: Self-Healing Pipeline
**Impact: HIGH | Effort: HIGH (5-7 days)**

End-to-end: Anomaly → RCA → Fix → Approval → Execute → Validate.
**Plan:** Not yet created

#### Design
- Combines: Anomaly Detection + RCA Engine + Runbook Automation
- Full automation with human-in-the-loop at critical decisions
- Rollback capability if fix fails
- Audit trail for all actions

#### Key Components
- Pipeline orchestrator
- RCA integration with anomaly alerts
- Automated fix selection based on runbooks
- Validation step (verify fix worked)

---

### Feature 8: Service Dependency Map
**Impact: MEDIUM-HIGH | Effort: HIGH (4-5 days)**

Real-time service mesh visualization with latency/error rates.
**Plan:** Not yet created

#### Design
- Extend CMDB topology to show service-to-service dependencies
- Overlay real-time metrics (latency, error rate, throughput)
- Color edges by health
- Click edge to see detailed metrics

#### Key Components
- Service discovery integration
- Real-time metric collection per edge
- Cytoscape visualization with metric overlay

---

### Feature 9: Capacity Planning
**Impact: MEDIUM-HIGH | Effort: HIGH (5-7 days)**

Trend analysis for CPU/memory/disk/network forecasting.
**Plan:** Not yet created

#### Design
- Collect historical resource usage (CPU, memory, disk, network)
- Forecast when resources will be exhausted
- Generate capacity alerts (e.g., "Disk full in 14 days")
- Recommend scaling actions

#### Key Components
- Resource usage collection agent
- Trend analysis engine
- Forecasting models (linear regression, Prophet)
- Capacity dashboard

---

### Feature 10: Cost Attribution
**Impact: MEDIUM-HIGH | Effort: HIGH (5-7 days)**

Map infrastructure costs to services/teams.
**Plan:** Not yet created

#### Design
- Track compute, storage, network costs per service
- Allocate shared costs (database, cache) proportionally
- Show cost per team, per service, per environment
- Trend analysis and budget alerts

#### Key Components
- Cost data collection (cloud APIs or manual entry)
- Allocation engine
- Cost dashboard with drill-down
- Budget threshold alerts

---

## Tier 3 — Medium Impact, Low Effort (Quick Wins)

### Feature 11: WebSocket Real-Time Push ✅ COMPLETED
**Impact: MEDIUM | Effort: LOW (1-2 days)** — Implemented and deployed.

Real-time alert push via WebSocket instead of polling.

#### What Was Built
- `plugins/alert_noc/store.py` — Redis pub/sub `_publish()` method, calls on create/repeat/acknowledge/resolve
- `plugins/alert_noc/main.py` — WebSocket endpoint `/api/v1/alerts/ws` with Redis subscriber per client
- `ui/nginx.conf` — dedicated `/api/v1/alerts/ws` location with WebSocket upgrade headers
- `ui/vite.config.ts` — `ws: true` proxy for dev mode
- `ui/src/hooks/useAlertsWebSocket.ts` — custom hook with auto-reconnect, exponential backoff
- `ui/src/pages/NOCAlerts.tsx` — WebSocket handler replaces 2s polling; connection status indicator (green/red dot)

#### Commits
- `3e466bc` — WebSocket real-time push implementation

---

### Feature 12: CI Search & Filtering ✅ COMPLETED
**Impact: MEDIUM | Effort: LOW (1 day)** — Implemented and deployed.

Client-side text search in CMDB Explorer for filtering CIs by name, type, team, site, and provider.

#### What Was Built
- Search input in toolbar with magnifying glass icon, real-time filtering
- `filteredCIs` filters by case-insensitive substring match across name/type/team/site/provider
- TopologyGraph `searchQuery` prop: highlights matching nodes (gold border), dims non-matching
- Search resets on site change; intersects with existing site/service filters
- CI list shows "X of Y" count when search is active
- Docs page updated with CI Search subsection

#### Commits
- `5ca3c3f` — CI search & text filtering implementation

---

### Feature 5: Chat Human Language ✅ COMPLETED
**Impact: HIGH | Effort: MEDIUM (2-3 days)** — Implemented and deployed.

LLM-powered SRE assistant with real tool calling via Ollama.

#### What Was Built
- `plugins/chatbot/agent.py` — Ollama `/api/chat` + tool-calling loop (max 5 rounds), SRE system prompt
- `plugins/chatbot/tools.py` — 7 real tool implementations (alerts via HTTP, CMDB via direct DB)
- `plugins/chatbot/config.py` — ALERT_NOC_URL, MODEL_NAME=qwen2.5:1.5b, CONTEXT_WINDOW=20
- `plugins/chatbot/router.py` — Redis-backed conversation history (1-hour TTL)
- `docker-compose.yml` — ports mapping, DATABASE_URL for chatbot
- `ui/src/pages/Docs.tsx` — Updated AI Chatbot section
- Model: qwen2.5:1.5b (986MB, fits in 4GB WSL RAM)

#### Verified
- Basic chat → natural language response ✅
- Tool calling → get_alerts invoked, returned real data ✅
- Conversation memory → follow-up questions use context ✅
- History endpoint → Redis persistence ✅
- Topology queries → get_topology invoked ✅

---

### Feature 17: Delete Chat Threads ✅ COMPLETED
**Impact: LOW | Effort: LOW (0.25 day)** — Implemented and deployed.

#### What Was Built
- Backend: `DELETE /api/v1/chatbot/history/{thread_id}` — removes Redis key + messages
- Frontend: trash icon appears on hover for each thread in sidebar
- Deleting active thread auto-switches to first remaining thread (or creates new one)
- Deletes both Redis server-side data and localStorage client-side data

---

### Feature 18: Smarter Incident Grouping ✅ COMPLETED
**Impact: HIGH | Effort: MEDIUM (1 day)** — Implemented and deployed.

Merged related alerts into smaller, more meaningful incident groups using multiple correlation signals.

#### What Was Built
- **Union-Find algorithm** in `store.py` for transitive merging of related incident groups
- **Correlation signals**: same service + keyword overlap (≥2 shared words), cascade timing (alerts within 10min on same service with same severity)
- **Dynamic incident titles**: shows dominant alert pattern, count, and affected services
- **Multi-service display**: incidents spanning multiple services show "+N" indicator
- `services[]` field added to IncidentGroup type for frontend

---

### Feature 19: Incident Suggestions (AI-Powered) ✅ COMPLETED
**Impact: HIGH | Effort: MEDIUM (0.5 day)** — Implemented and deployed.

One-click AI analysis of incidents with topology-aware remediation suggestions.

#### What Was Built
- Backend: `POST /api/v1/chatbot/suggest-fix` — receives incident context (alerts, service, severity, teams), sends structured prompt to LLM which uses tools to analyze topology and alerts
- Frontend: purple "Suggest Fix" button on each incident card in NOC Alerts list
- Frontend: "Suggest Fix" button in IncidentDetail view header
- Navigates to chatbot with pre-created thread containing AI analysis
- ChatBot accepts `threadId` and `title` via React Router navigation state
- Thread auto-created with incident context for seamless investigation flow

---

### Feature 13: Impact Analysis Visualization ✅ COMPLETED
**Impact: MEDIUM | Effort: LOW (1-2 days)** — Implemented and deployed.

Highlight downstream blast radius on topology.

#### What Was Built
- Backend: `get_downstream_impact()` PostgreSQL recursive CTE, deduplication in `cmdb/repository.py`
- Frontend: "Show Impact" / "Clear Impact" toggle in NodeDetailPanel Actions tab
- TopologyGraph: `impactNodes` + `highlightedNodeId` props — red fill for impacted nodes, amber border for source, dashed red edges, depth labels
- Non-impact nodes dimmed to focus on blast radius

#### Design
- "Show Impact" button on NodeDetailPanel
- Calls `GET /api/v1/cmdb/impact/{ci_id}`
- Highlights affected nodes in red
- Shows impact depth (how many levels downstream)

---

### Feature 14: SLI/SLO Dashboard ✅ COMPLETED
**Impact: MEDIUM | Effort: LOW-MEDIUM (1-2 days)** — Implemented and deployed.

Service Level Indicators and Objectives dashboard with real-time error budget tracking.

#### What Was Built
- `core_platform/routers/slo.py` — 8 services × 3 SLIs (availability, latency P99, error rate), real-time computation from live alert data via alert-noc HTTP
- Error budget: 30-day window, alert-based consumption, 4 statuses (healthy/warning/critical/exhausted)
- `ui/src/pages/SLODashboard.tsx` — gauge rings, error budget bars, tier badges, status indicators
- Dashboard service cards clickable → `/slo?service=X` drill-down with highlighted card
- Sidebar: SLI/SLO nav entry with chart-bar icon
- Docs page: SLI/SLO Dashboard section

#### Commits
- `171d1ed` — SLI/SLO Dashboard implementation

---

### Feature 15: Audit Log
**Impact: MEDIUM | Effort: LOW (1 day)**
Audit trail for all user actions.
**Plan:** `audit-trail.md`

### Feature 20: Dark Mode
**Impact: MEDIUM | Effort: LOW (1-2 days)**
Dark theme for NOC environments.
**Plan:** `dark-mode.md`

### Feature 21: Alert Suppression
**Impact: MEDIUM | Effort: LOW (1 day)**
Hide secondary alerts when primary (root cause) alert exists.
**Plan:** `alert-suppression.md`

### Feature 22: Maintenance Windows
**Impact: MEDIUM | Effort: LOW-MEDIUM (1-2 days)**
Mute alerts during planned maintenance windows.
**Plan:** `maintenance-windows.md`

### Feature 23: Alert Escalation
**Impact: MEDIUM | Effort: LOW-MEDIUM (2-3 days)**
Auto-escalate unhandled alerts after configurable timeouts.
**Plan:** `alert-escalation.md`

### Feature 24: Storm Management
**Impact: MEDIUM | Effort: LOW-MEDIUM (2-3 days)**
Detect and intelligently manage alert storms.
**Plan:** `storm-management.md`

### Feature 25: Syslog Collection
**Impact: HIGH | Effort: LOW-MEDIUM (2-3 days)**
Receive and process syslog messages from devices as alert sources.
**Plan:** `syslog-collection.md`

### Feature 26: SNMP Trap Receiver
**Impact: HIGH | Effort: MEDIUM (3-4 days)**
Receive and process SNMP traps from network devices.
**Plan:** `snmp-trap-receiver.md`

---

## Execution Order

### Wave 1: Tier 3 Quick Wins ✅ MOSTLY DONE
- [x] CI search & filtering
- [x] WebSocket real-time push ✅
- [x] Impact analysis visualization ✅
- [x] SLI/SLO dashboard ✅
- [ ] Audit log (1 day) → `audit-log.md`

### Wave 2: Tier 1 Features ✅ MOSTLY DONE
- [x] Alert noise reduction ✅
- [x] Service filtering by site ✅
- [ ] ML anomaly detection (3-4 days) → `ml-anomaly-detection.md`
- [x] Change-aware correlation ✅
- [x] Incident timeline ✅ (IncidentDetail + AlertDetail drill-down)
- [ ] Runbook automation (3-4 days) → `runbook-automation.md`

### Wave 3: Tier 2 Features (Future)
- [ ] Predictive alerting (5-7 days) → `predictive-alerting.md`
- [ ] Self-healing pipeline (5-7 days) → `self-healing-pipeline.md`
- [ ] Service dependency map (4-5 days) → `service-dependency-map.md`
- [ ] Capacity planning (5-7 days) → `capacity-planning.md`
- [ ] Cost attribution (5-7 days) → `cost-attribution.md`

### Wave 4: Feature Matrix Tier 1 (Data Collection + Processing)
- [ ] Syslog Collection (2-3 days) → `syslog-collection.md`
- [ ] SNMP Trap Receiver (3-4 days) → `snmp-trap-receiver.md`
- [ ] Alert Suppression (1 day) → `alert-suppression.md`
- [ ] Storm Management (2-3 days) → `storm-management.md` (depends on Suppression)
- [ ] Maintenance Windows (1-2 days) → `maintenance-windows.md`
- [ ] Alert Escalation (2-3 days) → `alert-escalation.md`
- [ ] Audit Trail (1 day) → `audit-trail.md`
- [ ] Dark Mode (1-2 days) → `dark-mode.md`

### SRE Waves (Production Readiness)
- [ ] SRE Performance (3-4 days) → `sre-performance.md`
- [ ] SRE Operational (3-4 days) → `sre-operational.md`
- [x] SRE Observability (2-3 days) → `sre-observability.md` (Fix 17 done)
- [x] SRE Security (3-4 days) → `sre-security.md` (Fixes 21, 26 done)

---

## Project Status Summary (Aug 2026)

### Completed Work
1. **Phase 1-3:** Backend, seed data, topology visualization, chat suggestions, dashboard overview, geo map
2. **Phase 4A — SRE Quick Wins:** async sleep, security headers, Redis auth, health checks, cache headers, httpx pooling, ErrorBoundary, dashboard wiring
3. **Geo Map:** Leaflet dark-theme map with animated traffic flows, site drill-down with topology overlay
4. **Alert NOC:** Temporal dedup, incident grouping, 5 failure scenarios, simulate button, auto-refresh
5. **CMDB Explorer:** Expandable topology, ServiceNow Principal Class pattern, service filtering by site
6. **Docs Page:** 13-section comprehensive documentation
7. **CI Pipeline:** ruff, mypy, pytest, npm build all passing
8. **IP Address Assignment:** All 105 CIs with management/loopback IPs, subnet addressing
9. **IP Address Search:** resolve_ip endpoint, search by IP in CMDB Explorer, Resolve IP modal in NOC
10. **Chat Human Language:** Ollama qwen2.5:1.5b, 7 real tools, Redis conversation memory
11. **Incidents Drill-Down:** Click incident → detail view with timeline, bulk ack/resolve
12. **Alert Drill-Down:** Click alert → detail view with metadata, changes, timeline, suggest fix
13. **Change-Aware Correlation:** change table, 30-min lookback, risk scoring, RecentChanges panel, chatbot integration
14. **Smarter Incident Grouping:** Union-Find algorithm, multi-signal correlation, dynamic titles
15. **Delete Chat Threads:** Backend DELETE endpoint, frontend trash icon
16. **Incident Suggestions:** One-click AI analysis via chatbot with change context
17. **Impact Analysis Visualization:** Blast radius highlighting on CMDB topology with depth labels
18. **WebSocket Real-Time Push:** Redis pub/sub + WS endpoint, auto-reconnect hook, no more polling
19. **SLI/SLO Dashboard:** 8 services, 3 SLIs each, real-time error budget, Dashboard drill-down

### Remaining Work (Prioritized)
| Priority | Feature | Effort | Impact | Status | Plan |
|----------|---------|--------|--------|--------|------|
| 1 | IP Address Assignment | 0.5 day | MEDIUM | ✅ COMPLETED | `ip-address-assignment.md` |
| 2 | IP Address Search | 0.25 day | MEDIUM | ✅ COMPLETED | `ip-address-search.md` |
| 3 | Chat Human Language | 2-3 days | HIGH | ✅ COMPLETED | `chat-human-language.md` |
| 4 | Manual Device + MIB Loading | 2-3 days | HIGH | NOT STARTED | `manual-device-mib.md` |
| 5 | LLD Automated Planner | 3-4 days | HIGH | NOT STARTED | `lld-automated-planner.md` |
| 6 | Network Simulation Engine | 3-5 days | HIGH | ✅ COMPLETED | `network-simulation.md` |
| 7 | ML Anomaly Detection | 3-4 days | HIGH | NOT STARTED | `ml-anomaly-detection.md` |
| 8 | Change-Aware Correlation | 2-3 days | HIGH | ✅ COMPLETED | `change-aware-correlation.md` |
| 9 | Incident Timeline (visual) | 2-3 days | HIGH | ✅ PARTIAL | — |
| 10 | Runbook Automation | 3-4 days | HIGH | NOT STARTED | `runbook-automation.md` |
| 11 | Impact Analysis Visualization | 1-2 days | MEDIUM | ✅ COMPLETED | `impact-analysis-visualization.md` |
| 12 | WebSocket Real-Time Push | 1-2 days | MEDIUM | ✅ COMPLETED | `websocket-realtime-push.md` |
| 13 | SLI/SLO Dashboard | 1-2 days | MEDIUM | ✅ COMPLETED | `sli-slo-dashboard.md` |
| 14 | Service Dependency Map | 4-5 days | HIGH | NOT STARTED | `service-dependency-map.md` |
| 15 | Predictive Alerting | 5-7 days | HIGH | NOT STARTED | `predictive-alerting.md` |
| 16 | Syslog Collection | 2-3 days | HIGH | NOT STARTED | `syslog-collection.md` |
| 17 | SNMP Trap Receiver | 3-4 days | HIGH | NOT STARTED | `snmp-trap-receiver.md` |
| 18 | Alert Suppression | 1 day | MEDIUM | NOT STARTED | `alert-suppression.md` |
| 19 | Storm Management | 2-3 days | MEDIUM | NOT STARTED | `storm-management.md` |
| 20 | Maintenance Windows | 1-2 days | MEDIUM | NOT STARTED | `maintenance-windows.md` |
| 21 | Alert Escalation | 2-3 days | MEDIUM | NOT STARTED | `alert-escalation.md` |
| 22 | Audit Trail | 1 day | MEDIUM | NOT STARTED | `audit-trail.md` |
| 23 | Dark Mode | 1-2 days | MEDIUM | NOT STARTED | `dark-mode.md` |

**Recommended next:** Syslog Collection (2-3 days) → SNMP Trap Receiver (3-4 days) → Alert Suppression (1 day) → Storm Management (2-3 days) → Maintenance Windows (1-2 days) → Escalation (2-3 days) → Audit Trail (1 day) → Dark Mode (1-2 days).
