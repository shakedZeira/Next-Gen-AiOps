# Plan: Data Retention

**Impact: LOW | Effort: LOW (1 day)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Configurable history retention policy for alerts, events, audit logs, and metrics to manage storage and comply with data policies.

## Current State
- Alerts persist indefinitely in Redis
- Audit logs (when built) grow unbounded
- No TTL or cleanup mechanism

## Design

### Retention Policies
| Data Type | Default TTL | Configurable |
|-----------|-------------|--------------|
| Active alerts | Until resolved | Yes |
| Resolved alerts | 30 days | Yes |
| Audit logs | 90 days | Yes |
| Incident groups | 90 days | Yes |
| WebSocket events | 24 hours | Yes |
| Conversation history | 7 days | Yes |

## Implementation

### Backend
1. `core_platform/retention.py` (NEW) - retention manager
   - `cleanup_expired()` - scan and delete expired records
   - Runs as background task every hour
   - Configurable per data type via env vars
2. `core_platform/routers/retention.py` (NEW) - config API
   - `GET /api/v1/retention` - get current policies
   - `POST /api/v1/retention` - update policies
   - `POST /api/v1/retention/cleanup` - trigger manual cleanup
3. Background task in api-gateway lifespan

### Frontend
4. `ui/src/components/RetentionSettings.tsx` (NEW) - policy config UI
5. `ui/src/api/client.ts` - retentionAPI

## Verification
1. Default retention active -> old alerts auto-deleted after 30 days
2. Change retention to 7 days -> cleanup removes older alerts
3. Manual cleanup button -> immediate cleanup
4. Audit log shows cleanup history
