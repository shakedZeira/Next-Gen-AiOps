# Plan: Alert Escalation

**Impact: MEDIUM | Effort: LOW-MEDIUM (2-3 days)**
**Status: COMPLETED**
**Dependencies: None**

---

## Goal
Automatically escalate unhandled alerts after configurable timeouts, notifying the next tier of responders.

## Current State
- Alerts have status (active/acknowledged/resolved) but no escalation
- No time-based escalation rules
- No notification chain

## Design

### Escalation Levels
| Level | Timeout | Action |
|-------|---------|--------|
| L1 | 0 min | Alert fires → assigned team notified |
| L2 | 15 min unacknowledged → | Escalate to team lead |
| L3 | 30 min unacknowledged → | Escalate to on-call manager |
| L4 | 60 min unacknowledged → | Escalate to VP/CTO |

### Escalation Record
```json
{
  "alert_id": "uuid",
  "escalation_level": 2,
  "escalated_at": "2026-08-23T12:15:00Z",
  "escalated_to": "lead@aiops.local",
  "acknowledged": false
}
```

## Implementation

### Backend

#### 1. Escalation rules model
- File: `plugins/alert_noc/escalation.py` (NEW)
- `class EscalationEngine`:
  - `LEVELS`: configurable escalation chain
  - `check_escalations()`: scan active alerts, escalate if overdue
  - Runs as background task every 60s

#### 2. Escalation fields on alert
- File: `plugins/alert_noc/models.py`
- Add `escalation_level`, `escalated_at`, `escalated_to` to AlertResponse

#### 3. Background task
- File: `plugins/alert_noc/main.py`
- Lifespan: start `escalation_task` on startup
- Loops every 60s, checks all active alerts
- If unacknowledged for >15 min → level 2, >30 min → level 3, etc.

#### 4. Escalation API
- File: `plugins/alert_noc/router.py`
- `GET /alerts/{id}/escalation` — get escalation history
- `POST /alerts/{id}/escalation/acknowledge` — acknowledge at level (stops further escalation)

#### 5. WebSocket events
- File: `plugins/alert_noc/store.py`
- New event type: `alert.escalated`
- Published when escalation level increases

### Frontend

#### 6. Escalation indicator
- File: `ui/src/components/AlertTable.tsx`
- Show escalation level badge (L1/L2/L3/L4) with color
- Show "Escalated to: X" tooltip

#### 7. Escalation timeline
- File: `ui/src/components/AlertDetail.tsx`
- Timeline entry for each escalation level
- Show who it was escalated to

#### 8. Escalation rules config
- File: `ui/src/pages/NOCAlerts.tsx`
- Settings panel showing escalation rules
- Configurable timeouts (future: per-service rules)

## Files to Create/Modify
- `plugins/alert_noc/escalation.py` — NEW: escalation engine
- `plugins/alert_noc/models.py` — add escalation fields
- `plugins/alert_noc/store.py` — escalation WS events
- `plugins/alert_noc/router.py` — escalation endpoints
- `plugins/alert_noc/main.py` — background task
- `ui/src/components/AlertTable.tsx` — escalation badges
- `ui/src/components/AlertDetail.tsx` — escalation timeline
- `ui/src/types/index.ts` — Alert type update
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Create critical alert → L1 badge shows
2. Wait 15s (demo timeout) → L2 badge shows, WS event fires
3. Acknowledge at L2 → escalation stops
4. Don't acknowledge → L3, L4 cascade
5. AlertDetail shows full escalation timeline
