# Plan: Automation Tools (Ansible)

**Impact: MEDIUM | Effort: LOW-MEDIUM (2-3 days)**
**Status: NOT STARTED**
**Dependencies: Runbook Automation (runbook-automation.md)**

---

## Goal
Trigger Ansible playbooks from alerts/incidents for automated remediation of common issues.

## Current State
- Runbook automation planned but not built
- No orchestration platform integration
- Manual remediation only

## Design

### Integration Pattern
Alert -> Chatbot suggests runbook -> Runbook includes Ansible steps -> Approval gate -> Execute playbook -> Verify result

### Supported Playbook Types
- Service restart
- Config rollback
- Certificate renewal
- DNS update
- Firewall rule change

## Implementation

### Backend
1. `plugins/automation/ansible_runner.py` (NEW) - Ansible execution
   - `run_playbook(playbook, inventory, extra_vars)` -> result
   - Async execution with status tracking
   - Output streaming via WebSocket
   - Timeout and cancellation support
2. `plugins/automation/router.py` (NEW) - API
   - `GET /api/v1/automation/playbooks` - list available playbooks
   - `POST /api/v1/automation/run` - execute playbook
   - `GET /api/v1/automation/runs/{id}` - get run status/output
3. Config: ANSIBLE_HOST, ANSIBLE_KEY, PLAYBOOK_DIR

### Frontend
4. `ui/src/pages/AutomationRuns.tsx` (NEW) - playbook execution history
5. `ui/src/components/PlaybookRunner.tsx` (NEW) - select and run playbook
6. `ui/src/api/client.ts` - automationAPI

### Docker
7. Add ansible-runner package to requirements
8. Mount playbook directory as volume

## Verification
1. List playbooks -> shows available playbooks
2. Run "restart-service" playbook -> approval gate -> executes
3. Output streams in real-time
4. Run history shows past executions with status
