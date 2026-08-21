# Plan: Self-Healing Pipeline

**Impact: HIGH | Effort: HIGH (5-7 days)**
**Status: NOT STARTED**
**Dependencies: ML Anomaly Detection + Runbook Automation (plans exist)**

---

## Goal
End-to-end: Anomaly → RCA → Fix → Approval → Execute → Validate.

## Current State
- Anomaly detection detects anomalies
- Runbook automation executes playbooks
- No integrated pipeline
- No automatic remediation
- No rollback capability

## Design

### Pipeline Flow
```
Anomaly Detected → RCA Analysis → Fix Selection → Approval → Execute → Validate → Rollback (if failed)
```

### Pipeline Stages
| Stage | Description | Automation Level |
|-------|-------------|------------------|
| 1. Detection | Anomaly detected by ML model | Fully automated |
| 2. RCA | Root cause analysis via correlation | Fully automated |
| 3. Fix Selection | Select appropriate runbook | Fully automated |
| 4. Approval | Human approval for destructive actions | Human-in-the-loop |
| 5. Execution | Execute runbook steps | Fully automated |
| 6. Validation | Verify fix worked | Fully automated |
| 7. Rollback | Undo if fix failed | Fully automated |

## Implementation

### Backend

#### 1. Create pipeline plugin
- File: `plugins/self_healing/main.py` (NEW)
- FastAPI app with pipeline orchestrator
- Port: 8009 (internal)

#### 2. Create pipeline orchestrator
- File: `plugins/self_healing/orchestrator.py` (NEW)
```python
class PipelineOrchestrator:
    def __init__(self, anomaly_detector, rca_engine, runbook_engine, approval_manager):
        self.anomaly_detector = anomaly_detector
        self.rca_engine = rca_engine
        self.runbook_engine = runbook_engine
        self.approval_manager = approval_manager
    
    async def execute_pipeline(self, alert: dict) -> dict:
        """Execute the full self-healing pipeline."""
        pipeline_id = str(uuid.uuid4())
        
        # Stage 1: Detection (already done - alert exists)
        await self._log_stage(pipeline_id, "detection", "completed", alert)
        
        # Stage 2: RCA Analysis
        rca_result = await self.rca_engine.analyze(alert)
        await self._log_stage(pipeline_id, "rca", "completed", rca_result)
        
        # Stage 3: Fix Selection
        runbook = await self._select_runbook(alert, rca_result)
        await self._log_stage(pipeline_id, "fix_selection", "completed", runbook)
        
        # Stage 4: Approval (if required)
        if runbook.get("requires_approval"):
            approval_result = await self._request_approval(runbook)
            if not approval_result["approved"]:
                await self._log_stage(pipeline_id, "approval", "denied", approval_result)
                return {"status": "aborted", "reason": "Approval denied"}
            await self._log_stage(pipeline_id, "approval", "approved", approval_result)
        
        # Stage 5: Execution
        execution_result = await self.runbook_engine.execute(runbook["name"], alert)
        await self._log_stage(pipeline_id, "execution", execution_result["status"], execution_result)
        
        # Stage 6: Validation
        validation_result = await self._validate_fix(alert)
        await self._log_stage(pipeline_id, "validation", validation_result["status"], validation_result)
        
        # Stage 7: Rollback (if validation failed)
        if not validation_result["passed"]:
            rollback_result = await self._rollback(runbook, execution_result)
            await self._log_stage(pipeline_id, "rollback", rollback_result["status"], rollback_result)
            return {"status": "failed", "pipeline_id": pipeline_id, "rollback": rollback_result}
        
        return {"status": "success", "pipeline_id": pipeline_id}
    
    async def _select_runbook(self, alert: dict, rca_result: dict) -> dict:
        """Select the appropriate runbook based on alert and RCA."""
        # Match alert type + service to runbook triggers
        for runbook in self.runbook_engine.runbooks.values():
            trigger = runbook.get("trigger", {})
            if (trigger.get("alert_name") in alert.get("name", "") and
                trigger.get("service") == alert.get("service")):
                return runbook
        return None
    
    async def _validate_fix(self, alert: dict) -> dict:
        """Check if the alert resolved after fix."""
        # Wait 60 seconds for metrics to stabilize
        await asyncio.sleep(60)
        
        # Check if alert is still active
        # If resolved, validation passed
        # If still active, validation failed
        return {"passed": True, "message": "Alert resolved"}
    
    async def _rollback(self, runbook: dict, execution_result: dict) -> dict:
        """Undo the changes made by the runbook."""
        # Execute rollback steps if defined
        if "rollback" in runbook:
            return await self.runbook_engine.execute(runbook["rollback"], {})
        return {"status": "no_rollback_defined"}
```

#### 3. Create API endpoints
- File: `plugins/self_healing/router.py` (NEW)
- `POST /api/v1/pipeline/execute` — execute pipeline for an alert
- `GET /api/v1/pipeline/{pipeline_id}` — get pipeline status
- `GET /api/v1/pipeline/history` — get pipeline execution history
- `POST /api/v1/pipeline/{pipeline_id}/approve` — approve pipeline step
- `POST /api/v1/pipeline/{pipeline_id}/deny` — deny pipeline step

#### 4. Add to docker-compose
- File: `docker-compose.yml`
- Add `self-healing-engine` service:
  ```yaml
  self-healing-engine:
    build: ./plugins/self_healing
    ports:
      - "8009:8009"
    environment:
      - REDIS_URL=redis://:changeme@redis:6379/0
      - ALERT_NOC_URL=http://alert-noc:8005
      - RCA_ENGINE_URL=http://rca-engine:8003
      - RUNBOOK_ENGINE_URL=http://runbook-engine:8007
    depends_on:
      - redis
      - alert-noc
      - rca-engine
      - runbook-engine
  ```

#### 5. Add proxy route to API gateway
- File: `core_platform/main.py`
- Add route: `/api/v1/pipeline/{path}` → `http://self-healing-engine:8009`

### Frontend

#### 6. Create Pipeline page
- File: `ui/src/pages/Pipeline.tsx` (NEW)
- Pipeline execution history table
- Active pipelines with progress indicators
- Pipeline detail view (all stages with status)
- Approval requests section

#### 7. Create PipelineDetail component
- File: `ui/src/components/PipelineDetail.tsx` (NEW)
- Visual pipeline flow (stages connected by arrows)
- Stage status icons (pending/running/completed/failed)
- Stage details expandable
- Approve/Deny buttons for approval stages

#### 8. Add "Heal" button to alerts
- File: `ui/src/components/AlertDetail.tsx`
- Add "Self-Heal" button
- On click: execute pipeline for this alert

#### 9. Add to routing
- File: `ui/src/App.tsx`
- Add route: `/pipeline` → `Pipeline`

#### 10. Add to navigation
- File: `ui/src/components/Sidebar.tsx`
- Add "Pipeline" nav item with zap icon

#### 11. Add to Docs page
- File: `ui/src/pages/Docs.tsx`
- Add "Self-Healing Pipeline" section

## Files to Create/Modify
- `plugins/self_healing/` — NEW: entire plugin directory
  - `main.py` — FastAPI app
  - `orchestrator.py` — pipeline orchestrator
  - `router.py` — API endpoints
  - `config.py` — configuration
  - `Dockerfile` — container build
- `docker-compose.yml` — add self-healing-engine service
- `core_platform/main.py` — add proxy route
- `ui/src/pages/Pipeline.tsx` — NEW: pipeline page
- `ui/src/components/PipelineDetail.tsx` — NEW: pipeline detail
- `ui/src/components/AlertDetail.tsx` — add "Self-Heal" button
- `ui/src/App.tsx` — add route
- `ui/src/components/Sidebar.tsx` — add nav item
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Navigate to /pipeline
2. See empty pipeline history
3. Trigger high latency alert on Payment Gateway
4. Click "Self-Heal" button
5. See pipeline execution:
   - Stage 1: Detection ✓
   - Stage 2: RCA ✓ (found "database connection pool exhausted")
   - Stage 3: Fix Selection ✓ (selected "High Latency Payment Gateway" runbook)
   - Stage 4: Approval ⏳ (waiting for approval)
6. Click "Approve" → execution continues
7. Stage 5: Execution ✓ (scaled up payment gateway)
8. Stage 6: Validation ✓ (latency improved)
9. Pipeline completed successfully
10. Dashboard shows pipeline metrics
