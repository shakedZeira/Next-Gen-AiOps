# Plan: Backup and Restore

**Impact: LOW | Effort: LOW-MEDIUM (1-2 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Support backup and restore of platform data (PostgreSQL, Redis, configuration) for disaster recovery and business continuity.

## Current State
- No backup mechanism
- Docker volumes are ephemeral
- Data loss on container rebuild

## Design

### Backup Scope
| Component | Data | Method |
|-----------|------|--------|
| PostgreSQL | CIs, services, relationships, changes, SLOs | pg_dump |
| Redis | Alerts, dedup, conversations, cache | RDB snapshot + AOF |
| Configuration | docker-compose.yml, .env, nginx.conf | File copy |

### Backup Schedule
- PostgreSQL: daily pg_dump to volume
- Redis: save every 15 min (RDB)
- Config: on every change

## Implementation

### Backend
1. `core_platform/backup.py` (NEW) - backup manager
   - `backup_postgres()` -> dump file with timestamp
   - `backup_redis()` -> trigger BGSAVE
   - `list_backups()` -> available backup files
   - `restore_postgres(backup_file)` -> restore from dump
2. `core_platform/routers/backup.py` (NEW) - API
   - `POST /api/v1/backup/create` - trigger backup
   - `GET /api/v1/backup/list` - list backups
   - `POST /api/v1/backup/restore/{file}` - restore
   - `GET /api/v1/backup/status` - backup job status

### Docker
3. Backup volume mount: `backup_data:/backups`
4. Cron job in container for daily backups

### Frontend
5. `ui/src/pages/BackupRestore.tsx` (NEW) - backup management UI
6. `ui/src/api/client.ts` - backupAPI

## Verification
1. Trigger manual backup -> backup file created
2. List backups -> shows timestamped files
3. Restore from backup -> data restored
4. Daily auto-backup -> cron runs at configured time
