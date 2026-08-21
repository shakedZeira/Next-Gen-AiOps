# Plan: SRE Performance & Scalability (Fixes 29-37)

**Impact: HIGH | Effort: MEDIUM (3-4 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Optimize performance for production readiness.

## Current State
- N+1 query in `get_ci_details`
- No Redis response caching
- No Redis pipeline for alert listing
- No composite DB indexes
- No Cytoscape instance reuse
- No CI pagination
- No DB pool monitoring
- No async idempotent seed script
- No WebSocket real-time alerts

## Implementation

### Fix 29: N+1 Query in get_ci_details
- File: `core_platform/cmdb/repository.py`
- Problem: `get_ci_details()` makes N queries for relationships
- Solution: Use single JOIN query to fetch CI + relationships + related CIs
- Expected improvement: 10x faster for CIs with many relationships

### Fix 30: Redis Response Caching
- File: `core_platform/routers/cmdb.py`
- Add `@cached(ttl=60)` decorator to read-heavy endpoints
- Cache topology responses (change infrequently)
- Cache service list (change rarely)
- Expected improvement: 5x faster for repeated requests

### Fix 31: Redis Pipeline for Alert Listing
- File: `plugins/alert_noc/store.py`
- Problem: `list_alerts()` does SMEMBERS + individual HGETs
- Solution: Use Redis pipeline for batch operations
- Expected improvement: 3x faster for listing 100+ alerts

### Fix 32: Composite DB Indexes
- File: `db/migrations/012_add_performance_indexes.sql` (NEW)
```sql
-- Composite indexes for common queries
CREATE INDEX idx_ci_site_type ON ci(site, type);
CREATE INDEX idx_ci_service_type ON ci(service, type);
CREATE INDEX idx_relationship_source ON relationship(source_ci_id);
CREATE INDEX idx_relationship_target ON relationship(target_ci_id);
CREATE INDEX idx_change_service_timestamp ON "change"(service, timestamp DESC);
CREATE INDEX idx_alert_status ON alert(status);
CREATE INDEX idx_alert_service ON alert(service);
```

### Fix 33: Cytoscape Instance Reuse
- File: `ui/src/components/TopologyGraph.tsx`
- Problem: New Cytoscape instance on every render
- Solution: Memoize Cytoscape instance, only recreate on data change
- Expected improvement: 2x faster re-renders

### Fix 34: CI Pagination
- File: `core_platform/routers/cmdb.py`
- Add `skip` and `limit` parameters to `GET /cmdb/ci`
- Default: 50 CIs per page
- Return total count in response

### Fix 35: DB Pool Monitoring
- File: `core_platform/routers/health.py`
- Add `GET /health/db-pool` endpoint
- Return pool stats: size, checked out, overflow
- Alert if pool exhaustion approaching

### Fix 36: Async Idempotent Seed Script
- File: `db/seed.py`
- Use async SQLAlchemy sessions
- Add `ON CONFLICT DO NOTHING` for idempotency
- Add progress logging
- Expected improvement: 5x faster seeding

### Fix 37: WebSocket Real-Time Alerts
- Already covered in `websocket-realtime-push.md` plan

## Files to Modify
- `core_platform/cmdb/repository.py` — Fix 29: N+1 query
- `core_platform/routers/cmdb.py` — Fix 30: caching, Fix 34: pagination
- `plugins/alert_noc/store.py` — Fix 31: Redis pipeline
- `db/migrations/012_add_performance_indexes.sql` — NEW: Fix 32
- `ui/src/components/TopologyGraph.tsx` — Fix 33: instance reuse
- `core_platform/routers/health.py` — Fix 35: DB pool monitoring
- `db/seed.py` — Fix 36: async idempotent

## Verification
1. Run `pytest tests/test_performance.py` — all tests pass
2. Benchmark: list 1000 CIs → < 500ms
3. Benchmark: get CI details → < 100ms
4. Benchmark: list 100 alerts → < 200ms
5. Monitor DB pool → no exhaustion under load
