# Plan: ITSM Integration (ServiceNow)

**Impact: MEDIUM | Effort: MEDIUM (3-4 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Bidirectional integration with ServiceNow ITSM for incident management, CI synchronization, and change correlation.

## Current State
- CMDB is standalone (PostgreSQL)
- No ServiceNow connection
- Change data is manually seeded

## Design

### Integration Points
| Direction | Data | Frequency |
|-----------|------|-----------|
| Aiops -> ServiceNow | Alert incidents | Real-time (on alert) |
| ServiceNow -> Aiops | CI changes, incidents | Polling (5 min) or webhook |
| Aiops -> ServiceNow | CMDB CI updates | On change |

### ServiceNow Tables
- `incident` - map alerts to SNOW incidents
- `cmdb_ci` - sync CIs from SNOW CMDB
- `change_request` - pull changes for correlation

## Implementation

### Backend
1. `plugins/integrations/servicenow.py` (NEW) - ServiceNow REST API client
   - `create_incident(alert, service)` -> SNOW incident number
   - `update_incident(number, data)`
   - `get_ci_changes(ci_sys_id, since)` - recent changes
   - `sync_cis()` - full CMDB sync
   - Auth: basic auth or OAuth2
2. `plugins/integrations/router.py` - add SNOW endpoints
   - `POST /api/v1/integrations/servicenow/incident` - create
   - `GET /api/v1/integrations/servicenow/changes` - recent changes
   - `POST /api/v1/integrations/servicenow/sync` - trigger CI sync
3. `db/migrations/010_add_servicenow_fields.sql` - add snow_incident_number, snow_ci_sysid to alerts/CIs

### Frontend
4. `ui/src/components/ServiceNowLink.tsx` (NEW) - SNOW incident link on alerts
5. `ui/src/pages/CMDBExplorer.tsx` - show SNOW CI sys_id if synced
6. `ui/src/api/client.ts` - itsmAPI

### Config
7. SNOW_URL, SNOW_USER, SNOW_PASS env vars
8. Sync interval configuration

## Verification
1. Critical alert -> ServiceNow incident created automatically
2. SNOW incident number shown on alert detail
3. Click link -> opens ServiceNow incident
4. Manual CI sync -> CIs updated from ServiceNow CMDB
5. Changes from ServiceNow appear in RecentChanges panel
