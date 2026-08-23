# Plan: Maintenance Windows

**Impact: MEDIUM | Effort: LOW-MEDIUM (1-2 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Mute alerts during planned maintenance windows so operators aren't bombarded with expected downtime alerts.

## Current State
- No maintenance window concept
- All alerts show regardless of planned activity
- Operators must manually ignore known maintenance alerts

## Design

### Maintenance Window Schema
```json
{
  "id": "uuid",
  "name": "Payment Gateway Upgrade",
  "service": "Payment Gateway",
  "sites": ["global-hq"],
  "start_time": "2026-08-25T02:00:00Z",
  "end_time": "2026-08-25T06:00:00Z",
  "created_by": "admin@aiops.local",
  "reason": "v2.3.1 rolling upgrade",
  "status": "active"
}
```

### Muting Logic
- When alert fires during active maintenance window → mark as `muted=True`
- Muted alerts stored but not shown in default NOC view
- Muted alerts visible in "Maintenance" filter tab
- After window ends → muted alerts auto-unmute
- WebSocket does NOT push muted alerts

## Implementation

### Backend

#### 1. Maintenance window model
- File: `aiops_shared/models/maintenance.py` (NEW)
- Columns: id, name, service, sites (JSON), start_time, end_time, created_by, reason

#### 2. Migration
- File: `db/migrations/009_create_maintenance_windows.sql`

#### 3. Maintenance API
- File: `core_platform/routers/maintenance.py` (NEW)
- `GET /api/v1/maintenance` — list all windows
- `POST /api/v1/maintenance` — create window
- `DELETE /api/v1/maintenance/{id}` — cancel window
- `GET /api/v1/maintenance/active` — currently active windows

#### 4. Muting logic in alert-noc
- File: `plugins/alert_noc/suppression.py` — extend with maintenance check
- On alert creation: check if service+site matches any active window
- If match: set `muted=True`, don't publish via WS

#### 5. Unmute cron
- File: `plugins/alert_noc/main.py`
- Background task: check every 60s for expired windows, unmute alerts

### Frontend

#### 6. Maintenance Windows panel
- File: `ui/src/components/MaintenanceWindows.tsx` (NEW)
- List of upcoming/active windows with countdown
- Create form: service, site, start/end time, reason
- Cancel button

#### 7. NOC Alerts integration
- File: `ui/src/pages/NOCAlerts.tsx`
- Add "Maintenance" filter tab
- Show muted count in stats

#### 8. API client
- File: `ui/src/api/client.ts`
- `maintenanceAPI.list()`, `.create()`, `.cancel()`, `.active()`

## Files to Create/Modify
- `aiops_shared/models/maintenance.py` — NEW: model
- `db/migrations/009_create_maintenance_windows.sql` — NEW: migration
- `core_platform/routers/maintenance.py` — NEW: API endpoints
- `core_platform/main.py` — register router
- `plugins/alert_noc/suppression.py` — maintenance muting
- `plugins/alert_noc/main.py` — unmute cron task
- `ui/src/components/MaintenanceWindows.tsx` — NEW: UI panel
- `ui/src/pages/NOCAlerts.tsx` — maintenance filter
- `ui/src/api/client.ts` — maintenanceAPI
- `ui/src/types/index.ts` — MaintenanceWindow type
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Create maintenance window for "Payment Gateway" (next 2 hours)
2. Inject alert for Payment Gateway → alert muted, not in default view
3. Switch to "Maintenance" tab → muted alert visible
4. Window expires → alert auto-unmutes
5. Create window for specific site → only alerts from that site muted
