# Plan: Audit Log

**Impact: MEDIUM | Effort: LOW (1 day)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Track all user actions for compliance and debugging.

## Current State
- No audit logging exists
- User actions (ack, resolve, create) are not tracked
- No way to see who did what and when

## Design

### Audit Event Structure
```json
{
  "id": "uuid",
  "timestamp": "2026-08-21T10:00:00Z",
  "user": "admin@aiops.local",
  "action": "alert.acknowledge",
  "resource_type": "alert",
  "resource_id": "alert-123",
  "details": {
    "service": "Payment Gateway",
    "severity": "critical"
  },
  "ip_address": "172.18.0.1"
}
```

### Actions to Track
| Category | Actions |
|----------|---------|
| Alerts | acknowledge, resolve, create |
| Incidents | acknowledge, resolve |
| CMDB | create_ci, update_ci, delete_ci, create_relationship |
| Chat | create_thread, delete_thread, send_message |
| Auth | login, logout, token_refresh |

## Implementation

### Backend

#### 1. Add audit log model
- File: `aiops_shared/models/audit.py` (NEW)
```python
class AuditLog(Base):
    __tablename__ = "audit_log"
    
    id = Column(String, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user = Column(String, nullable=False)
    action = Column(String, nullable=False)
    resource_type = Column(String)
    resource_id = Column(String)
    details = Column(JSON)
    ip_address = Column(String)
```

#### 2. Add migration
- File: `db/migrations/008_create_audit_log.sql` (NEW)
```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(255) PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  "user" VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45)
);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_user ON audit_log("user");
CREATE INDEX idx_audit_action ON audit_log(action);
```

#### 3. Create audit logger utility
- File: `aiops_shared/audit.py` (NEW)
```python
async def log_audit(
    session: AsyncSession,
    user: str,
    action: str,
    resource_type: str = None,
    resource_id: str = None,
    details: dict = None,
    ip_address: str = None
):
    log = AuditLog(
        id=str(uuid.uuid4()),
        user=user,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address
    )
    session.add(log)
    await session.commit()
```

#### 4. Add audit endpoints
- File: `core_platform/routers/audit.py` (NEW)
- `GET /api/v1/audit` — list audit logs (with filters: user, action, resource, date range)
- `GET /api/v1/audit/stats` — get audit statistics (actions per user, top actions)

#### 5. Instrument existing routers
- File: `core_platform/routers/cmdb.py`
- After CI create/update/delete: call `log_audit()`
- After relationship create: call `log_audit()`

- File: `plugins/alert_noc/store.py`
- After alert ack/resolve: call `log_audit()` (via HTTP to audit endpoint)

- File: `plugins/chatbot/router.py`
- After thread create/delete: call `log_audit()`

### Frontend

#### 6. Create Audit Log page
- File: `ui/src/pages/AuditLog.tsx` (NEW)
- Table with columns: Timestamp, User, Action, Resource, Details
- Filters: user dropdown, action dropdown, date range picker
- Pagination (50 per page)
- Click row to expand details JSON

#### 7. Add to routing
- File: `ui/src/App.tsx`
- Add route: `/audit` → `AuditLog`

#### 8. Add to navigation
- File: `ui/src/components/Sidebar.tsx`
- Add "Audit" nav item with clipboard icon

#### 9. Add to Docs page
- File: `ui/src/pages/Docs.tsx`
- Add "Audit Log" section

## Files to Create/Modify
- `aiops_shared/models/audit.py` — NEW: audit model
- `aiops_shared/audit.py` — NEW: audit logger utility
- `db/migrations/008_create_audit_log.sql` — NEW: migration
- `core_platform/routers/audit.py` — NEW: audit endpoints
- `core_platform/main.py` — register audit router
- `core_platform/routers/cmdb.py` — instrument CI operations
- `plugins/alert_noc/store.py` — instrument alert operations
- `plugins/chatbot/router.py` — instrument chat operations
- `ui/src/pages/AuditLog.tsx` — NEW: audit log page
- `ui/src/App.tsx` — add route
- `ui/src/components/Sidebar.tsx` — add nav item
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Navigate to /audit
2. See empty audit log
3. Ack an alert → audit log shows "alert.acknowledge" entry
4. Create a CI → audit log shows "cmdb.create_ci" entry
5. Filter by user → see only that user's actions
6. Filter by action → see only that action type
7. Click row → see full details JSON
