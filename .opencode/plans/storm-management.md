# Plan: Storm Management

**Impact: MEDIUM | Effort: LOW-MEDIUM (2-3 days)**
**Status: NOT STARTED**
**Dependencies: Alert Suppression (alert-suppression.md)**

---

## Goal
Detect and intelligently manage alert storms — bursts of alerts that overwhelm operators and obscure the root cause.

## Current State
- Deduplication handles identical alerts (60s window)
- Incident grouping clusters related alerts
- But no storm detection — a genuine storm (e.g., network outage generating 100+ alerts) still floods the console
- No automatic throttling during storms

## Design

### Storm Detection
A "storm" is defined as:
- >10 active alerts within 60 seconds, OR
- >5 services affected within 2 minutes

### Storm Response
| Phase | Trigger | Action |
|-------|---------|--------|
| Detection | Threshold exceeded | Mark storm active, create StormEvent |
| Throttling | Storm active | Only show root-cause alerts, suppress symptoms |
| Summary | Storm active | Show single "Storm Summary" card with affected services, root cause |
| Recovery | Storm cleared (no new alerts for 5 min) | Auto-unthrottle, show all alerts |

### Storm Event
```json
{
  "id": "uuid",
  "detected_at": "2026-08-23T12:00:00Z",
  "cleared_at": null,
  "alert_count": 45,
  "affected_services": ["Payment Gateway", "E-Commerce Platform"],
  "root_cause_alert_id": "uuid",
  "status": "active",
  "throttled": true
}
```

## Implementation

### Backend

#### 1. Storm detector
- File: `plugins/alert_noc/storm.py` (NEW)
- `class StormDetector`:
  - Maintains sliding window of alert timestamps (Redis sorted set)
  - `check_storm() -> StormEvent | None`
  - `is_storm_active() -> bool`
  - `get_root_cause() -> Alert | None` — highest-severity alert in storm

#### 2. Storm fields on alerts
- File: `plugins/alert_noc/models.py`
- Add `storm_id`, `throttled` to AlertResponse

#### 3. Throttle logic
- File: `plugins/alert_noc/store.py`
- After `create_alert()`: check storm detector
- If storm active + alert is not root cause → set `throttled=True`, don't publish WS event
- Root cause alert published normally

#### 4. Storm API
- File: `plugins/alert_noc/router.py`
- `GET /alerts/storms` — list storms
- `GET /alerts/storms/active` — current storm
- `POST /alerts/storms/{id}/clear` — manually clear storm

#### 5. WebSocket events
- `storm.detected` — new storm
- `storm.cleared` — storm resolved

### Frontend

#### 6. Storm summary card
- File: `ui/src/components/StormSummary.tsx` (NEW)
- Shows when storm is active: alert count, affected services, root cause, time since detection
- "View All" toggle to show throttled alerts

#### 7. NOC Alerts integration
- File: `ui/src/pages/NOCAlerts.tsx`
- Show StormSummary at top when storm active
- "X throttled alerts" counter

#### 8. Alert table
- File: `ui/src/components/AlertTable.tsx`
- Show throttled badge on throttled alerts
- Storm filter tab

## Files to Create/Modify
- `plugins/alert_noc/storm.py` — NEW: storm detector
- `plugins/alert_noc/models.py` — add storm fields
- `plugins/alert_noc/store.py` — throttle logic
- `plugins/alert_noc/router.py` — storm endpoints
- `plugins/alert_noc/store.py` — storm WS events
- `ui/src/components/StormSummary.tsx` — NEW: storm card
- `ui/src/pages/NOCAlerts.tsx` — storm integration
- `ui/src/components/AlertTable.tsx` — throttled badge
- `ui/src/api/client.ts` — stormAPI
- `ui/src/types/index.ts` — StormEvent type
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Run "cascading-microservice" scenario → 20+ alerts fire
2. Storm detected → StormSummary card appears
3. Only root-cause alert visible, others throttled
4. Wait 5 min without new alerts → storm clears, all alerts reappear
5. Manual clear button works
