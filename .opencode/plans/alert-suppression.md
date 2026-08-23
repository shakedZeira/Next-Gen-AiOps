# Plan: Alert Suppression

**Impact: MEDIUM | Effort: LOW (1 day)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Hide secondary alerts when a primary (root cause) alert exists, reducing noise during multi-alert cascades.

## Current State
- Deduplication merges identical alerts (60s window)
- Incident grouping clusters related alerts
- But secondary symptoms still show individually in the alert list
- No concept of "primary" vs "secondary" alerts

## Design

### Suppression Rules
| Rule | Logic | Example |
|------|-------|---------|
| Service cascade | If primary alert exists for service, suppress lower-severity alerts for same service within 5 min | "Payment Gateway Down" (critical) suppresses "High Latency Payment Gateway" (high) |
| Dependency cascade | If upstream CI alert exists, suppress downstream CI alerts within 3 min | "Core Switch Down" suppresses "Server Unreachable" for servers behind that switch |
| Timeout | Suppressed alerts auto-expire after 10 minutes (become visible again) | — |

### Alert Fields
```python
class AlertResponse:
    ...
    suppressed: bool = False
    suppressed_by: str | None = None  # ID of primary alert
    suppressed_at: datetime | None = None
```

## Implementation

### Backend

#### 1. Add suppression fields to model
- File: `plugins/alert_noc/models.py`
- Add `suppressed`, `suppressed_by`, `suppressed_at` to `AlertResponse`

#### 2. Suppression engine
- File: `plugins/alert_noc/suppression.py` (NEW)
- `class AlertSuppressor`:
  - `check_suppress(alert) -> (bool, primary_id | None)`
  - Maintains a ring buffer of recent alerts (Redis sorted set, 5-min window)
  - Rules: check for higher-severity alert to same service within 5 min
  - Check CMDB for dependency relationship (upstream → downstream)

#### 3. Wire into store
- File: `plugins/alert_noc/store.py`
- After `create_alert()`, run suppressor
- If suppressed: set `suppressed=True`, store in Redis, DON'T publish WS event
- If not suppressed: publish normally

#### 4. Suppressed alerts endpoint
- File: `plugins/alert_noc/router.py`
- `GET /alerts?suppressed=true` — show suppressed alerts (hidden by default)
- Add `suppressed=false` default filter to list endpoint

### Frontend

#### 5. Suppression indicator
- File: `ui/src/components/AlertTable.tsx`
- Show "Suppressed" badge on suppressed alerts
- Toggle to show/hide suppressed alerts

#### 6. Suppression count
- File: `ui/src/pages/NOCAlerts.tsx`
- Show "X suppressed" counter in stats bar

## Files to Create/Modify
- `plugins/alert_noc/models.py` — add suppression fields
- `plugins/alert_noc/suppression.py` — NEW: suppression engine
- `plugins/alert_noc/store.py` — wire suppression into create flow
- `plugins/alert_noc/router.py` — suppressed filter
- `ui/src/components/AlertTable.tsx` — suppression badge + toggle
- `ui/src/pages/NOCAlerts.tsx` — suppressed count
- `ui/src/types/index.ts` — Alert type update
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Inject "Payment Gateway Down" (critical) → alert appears
2. Within 5 min, inject "High Latency Payment Gateway" (high) → suppressed
3. Suppressed alert doesn't appear in default list
4. Toggle "Show Suppressed" → suppressed alerts visible with badge
5. After 10 min, suppressed alert auto-expires and reappears
