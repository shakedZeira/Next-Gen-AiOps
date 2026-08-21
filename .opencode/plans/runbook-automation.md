# Plan: Runbook Automation

**Impact: HIGH | Effort: MEDIUM (3-4 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
YAML-based playbooks with approval gates for automated remediation.

## Current State
- Chatbot can suggest fixes but cannot execute them
- No approval workflow
- No runbook definition format
- No execution engine

## Design

### YAML Schema
```yaml
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

### Step Types
| Type | Description |
|------|-------------|
| `check` | Query metrics and validate threshold |
| `action` | Execute a command or API call |
| `approval` | Request human approval |
| `wait_for_approval` | Block until approval received |
| `notification` | Send notification to channel |
| `condition` | Conditional step execution |

## Implementation

### Backend

#### 1. Create runbook plugin
- File: `plugins/runbook/main.py` (NEW)
- FastAPI app with runbook engine
- Port: 8007 (internal)

#### 2. Create runbook engine
- File: `plugins/runbook/engine.py` (NEW)
```python
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
                request_id = await self.approval_manager.request_approval(
                    ApprovalRequest(
                        tool_name=step['action'],
                        arguments=step['params'],
                        context=f"Runbook: {runbook_name}, Step: {step['name']}"
                    )
                )
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

#### 3. Create approval manager
- File: `plugins/runbook/approval.py` (NEW)
```python
class ApprovalManager:
    def __init__(self, redis):
        self.redis = redis
    
    async def request_approval(self, request: ApprovalRequest) -> str:
        request_id = str(uuid.uuid4())
        await self.redis.hset("pending_approvals", request_id, json.dumps(request.dict()))
        return request_id
    
    async def approve(self, request_id: str, user: str):
        await self.redis.hdel("pending_approvals", request_id)
        await self.redis.hset("approved_requests", request_id, json.dumps({"user": user, "timestamp": time.time()}))
    
    async def deny(self, request_id: str, user: str):
        await self.redis.hdel("pending_approvals", request_id)
        await self.redis.hset("denied_requests", request_id, json.dumps({"user": user, "timestamp": time.time()}))
```

#### 4. Create API endpoints
- File: `plugins/runbook/router.py` (NEW)
- `GET /api/v1/runbooks` — list available runbooks
- `POST /api/v1/runbooks/{name}/execute` — execute a runbook
- `GET /api/v1/runbooks/{name}` — get runbook details
- `GET /api/v1/runbooks/pending-approvals` — list pending approvals
- `POST /api/v1/runbooks/approve/{request_id}` — approve a request
- `POST /api/v1/runbooks/deny/{request_id}` — deny a request
- `GET /api/v1/runbooks/history` — get execution history

#### 5. Create sample runbooks
- File: `runbooks/high-latency-payment.yaml` (NEW)
- File: `runbooks/disk-exhaustion.yaml` (NEW)
- File: `runbooks/database-failover.yaml` (NEW)

#### 6. Add to docker-compose
- File: `docker-compose.yml`
- Add `runbook-engine` service:
  ```yaml
  runbook-engine:
    build: ./plugins/runbook
    ports:
      - "8007:8007"
    environment:
      - REDIS_URL=redis://:changeme@redis:6379/0
      - ALERT_NOC_URL=http://alert-noc:8005
    volumes:
      - ./runbooks:/app/runbooks:ro
    depends_on:
      - redis
      - alert-noc
  ```

#### 7. Add proxy route to API gateway
- File: `core_platform/main.py`
- Add route: `/api/v1/runbooks/{path}` → `http://runbook-engine:8007`

### Frontend

#### 8. Create Runbooks page
- File: `ui/src/pages/Runbooks.tsx` (NEW)
- List of available runbooks with descriptions
- "Execute" button for each runbook
- Execution history table
- Pending approvals section with approve/deny buttons

#### 9. Create RunbookDetail component
- File: `ui/src/components/RunbookDetail.tsx` (NEW)
- Runbook YAML visualization (steps list)
- Execution progress (current step highlighted)
- Step results (pass/fail)
- Approval requests

#### 10. Add to routing
- File: `ui/src/App.tsx`
- Add route: `/runbooks` → `Runbooks`

#### 11. Add to navigation
- File: `ui/src/components/Sidebar.tsx`
- Add "Runbooks" nav item with play icon

#### 12. Add to Docs page
- File: `ui/src/pages/Docs.tsx`
- Add "Runbook Automation" section

## Files to Create/Modify
- `plugins/runbook/` — NEW: entire plugin directory
  - `main.py` — FastAPI app
  - `engine.py` — runbook execution engine
  - `approval.py` — approval manager
  - `router.py` — API endpoints
  - `config.py` — configuration
  - `Dockerfile` — container build
- `runbooks/` — NEW: YAML runbook definitions
  - `high-latency-payment.yaml`
  - `disk-exhaustion.yaml`
  - `database-failover.yaml`
- `docker-compose.yml` — add runbook-engine service
- `core_platform/main.py` — add proxy route
- `ui/src/pages/Runbooks.tsx` — NEW: runbooks page
- `ui/src/components/RunbookDetail.tsx` — NEW: runbook detail
- `ui/src/App.tsx` — add route
- `ui/src/components/Sidebar.tsx` — add nav item
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Navigate to /runbooks
2. See 3 sample runbooks listed
3. Click "Execute" on high-latency runbook
4. See execution progress (step 1: check latency)
5. Step 2: approval request appears
6. Click "Approve" → execution continues
7. Step 3: action executes
8. Step 4: verification passes
9. Execution history shows completed runbook
