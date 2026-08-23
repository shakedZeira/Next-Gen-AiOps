# Plan: Multi-site (Disaster Recovery)

**Impact: LOW | Effort: HIGH (5+ days)**
**Status: NOT STARTED**
**Dependencies: Active/Active (`active-active.md`), Backup and Restore (`backup-restore.md`)**

---

## Goal
Deploy across multiple physical sites with automatic failover for disaster recovery and business continuity.

## Current State
- Single-site deployment
- No geographic redundancy
- No failover mechanism

## Design

### DR Architecture
| Site | Role | Data |
|------|------|------|
| Primary | Active read/write | Full PostgreSQL + Redis |
| DR Site | Standby | Replicated PostgreSQL + Redis replica |

### Failover
- Automated failover on primary site failure (health check timeout)
- Manual failover for planned maintenance
- Data consistency via synchronous replication

## Implementation

### Backend
1. `core_platform/dr/manager.py` (NEW) - DR manager
   - `check_primary_health()` -> liveness probe
   - `initiate_failover()` -> promote DR to primary
   - `update_dns()` -> point to new primary
2. `core_platform/routers/dr.py` (NEW) - DR status API

### Infrastructure
3. PostgreSQL logical replication (primary -> DR)
4. Redis replication (primary -> DR replica)
5. DNS failover (Route53 health checks)
6. Site-aware configuration

## Verification
1. Primary site healthy -> all traffic to primary
2. Kill primary -> DR promoted within 60s
3. Traffic flows to DR site
4. Primary restored -> sync back
