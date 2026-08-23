# Plan: Custom Scripts

**Impact: MEDIUM | Effort: LOW-MEDIUM (2 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Allow operators to write and execute custom Python/Shell scripts for extending system behavior (custom alert enrichment, remediation, reporting).

## Current State
- System behavior is hardcoded
- No user-extensible scripting
- Custom logic requires code changes

## Design

### Script Types
| Type | Trigger | Purpose |
|------|---------|---------|
| Enrichment | On alert creation | Add external data to alerts |
| Remediation | On alert ack | Auto-fix common issues |
| Reporting | Scheduled | Generate reports |
| Webhook | On event | Custom outbound logic |

### Execution Sandboxing
- Scripts run in isolated subprocess
- Time limit (30s default)
- No network access by default (opt-in)
- Output captured and logged

## Implementation

### Backend
1. `plugins/custom_scripts/executor.py` (NEW) - script runner
   - `execute(script_code, context)` -> result
   - Subprocess with timeout
   - stdout/stderr capture
2. `plugins/custom_scripts/router.py` (NEW) - API
   - `GET /api/v1/scripts` - list scripts
   - `POST /api/v1/scripts` - create/update script
   - `POST /api/v1/scripts/{id}/run` - execute
   - `GET /api/v1/scripts/{id}/runs` - execution history
3. Store scripts in PostgreSQL (code, name, type, schedule)

### Frontend
4. `ui/src/pages/ScriptEditor.tsx` (NEW) - code editor with syntax highlighting
5. `ui/src/pages/ScriptRuns.tsx` (NEW) - execution history
6. `ui/src/api/client.ts` - scriptsAPI

## Verification
1. Create enrichment script -> alert created -> script runs -> data added
2. Create remediation script -> trigger -> auto-fixes issue
3. Script timeout -> graceful error
4. Script history shows all executions with output
