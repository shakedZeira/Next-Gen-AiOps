# Plan: Audit Trail

**Impact: MEDIUM | Effort: LOW (1 day)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Log every user action (ack, resolve, simulate, chat, etc.) with timestamp, user, action, and target for compliance and forensics.

## Current State
- No audit logging exists
- Actions happen but are not recorded
- No way to see who did what and when

## Design

### Event Schema
```json
{
  "id": "uuid",
  "timestamp": "2026-08-23T12:00:00Z",
  "user": "admin@aiops.local",
  "action": "alert.acknowledge",
  "resource_type": "alert",
  "resource_id": "abc-123",
  "details": { "service": "Payment Gateway", "severity": "critical" },
  "ip_address": "10.0.1.5"
}
```

### Actions to Log
| Source | Actions |
|--------|---------|
| NOC Alerts | alert.acknowledge, alert.resolve, incident.acknowledge, incident.resolve |
| Chatbot | chat.message, chat.suggest_fix, chat.approve, chat.reject |
| Network Sim | sim.failure_inject, sim.recovery |
| CMDB | ci.create, ci.update, impact.show |
| SLO | slo.view |
| Scenarios | scenario.run |

## Implementation

### Backend

#### 1. Audit log model + table
- File: `aiops_shared/models/audit_log.py` (NEW)
- Columns: id (UUID), timestamp, user, action, resource_type, resource_id, details (JSONB), ip_address
- Migration: `db/migrations/008_create_audit_log.sql`

#### 2. Audit logger utility
- File: `core_platform/audit.py` (NEW)
- `async def log_action(session, user, action, resource_type, resource_id, details, ip)`
- Wraps SQLAlchemy insert

#### 3. Wire into existing routers
- `core_platform/routers/cmdb.py` — log CI operations
- `plugins/alert_noc/router.py` — log ack/resolve/simulate
- `plugins/chatbot/router.py` — log chat messages, suggest-fix, approvals

#### 4. Audit log API endpoint
- File: `core_platform/routers/audit.py` (NEW)
- `GET /api/v1/audit` — list with filters (user, action, resource, date range)
- `GET /api/v1/audit/stats` — top actions, top users, timeline

### Frontend

#### 5. Audit Log page
- File: `ui/src/pages/AuditLog.tsx` (NEW)
- Table: timestamp, user, action, resource, details
- Filters: date range, user, action type
- Auto-refresh every 30s

#### 6. Navigation
- `ui/src/App.tsx` — route `/audit`
- `ui/src/components/Sidebar.tsx` — nav item with clipboard-check icon

## Files to Create/Modify
- `aiops_shared/models/audit_log.py` — NEW: SQLAlchemy model
- `db/migrations/008_create_audit_log.sql` — NEW: migration
- `core_platform/audit.py` — NEW: logger utility
- `core_platform/routers/audit.py` — NEW: API endpoints
- `core_platform/main.py` — register audit router
- `plugins/alert_noc/router.py` — add audit logging calls
- `plugins/chatbot/router.py` — add audit logging calls
- `ui/src/pages/AuditLog.tsx` — NEW: audit log page
- `ui/src/App.tsx` — add route
- `ui/src/components/Sidebar.tsx` — add nav item
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Ack an alert → audit log shows the action
2. Run a scenario → audit log shows scenario.run
3. Chat with bot → audit log shows chat.message
4. Filter by user → only that user's actions
5. Filter by date → only actions in range
