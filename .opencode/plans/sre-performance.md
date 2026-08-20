# Plan: SRE Performance & Scalability

## Goal
Fix 10 performance and scalability issues that would break at scale.

---

## Fix 29: N+1 Query in CI Details

### Problem
`core_platform/cmdb/repository.py` `get_ci_details()` makes 4 separate queries instead of 1 JOIN.

### File
`core_platform/cmdb/repository.py`

### Fix
Replace 4 queries with a single query using UNION ALL:

```python
async def get_ci_details(self, ci_id: str) -> dict:
    query = text("""
        WITH neighbors AS (
            SELECT 
                ci2.id, ci2.name, ci2.type,
                r.type as relationship,
                'downstream' as direction
            FROM relationship r
            JOIN ci ci2 ON ci2.id = r.target_id
            WHERE r.source_id = :ci_id
            
            UNION ALL
            
            SELECT 
                ci2.id, ci2.name, ci2.type,
                r.type as relationship,
                'upstream' as direction
            FROM relationship r
            JOIN ci ci2 ON ci2.id = r.source_id
            WHERE r.target_id = :ci_id
        )
        SELECT * FROM neighbors
    """)
    result = await self.session.execute(query, {"ci_id": ci_id})
    neighbors = [dict(row) for row in result.mappings().all()]
    
    # Get the CI itself
    ci_result = await self.session.execute(select(CI).where(CI.id == ci_id))
    ci = ci_result.scalar_one_or_none()
    
    return {
        "ci": ci,
        "neighbors": neighbors
    }
```

### Verification
- `GET /api/v1/cmdb/ci/{id}/details` returns same data as before
- Only 2 queries executed (CI + neighbors) instead of 4

---

## Fix 30: Response Caching with Redis

### Problem
Every topology page load hits the database. No caching layer.

### Files
`core_platform/routers/cmdb.py`, `aiops_shared/database.py`

### Fix
Add Redis caching decorator:

```python
import json
import hashlib
from functools import wraps

def cached(ttl_seconds: int = 60, prefix: str = "cache"):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key from function name and args
            key_data = f"{func.__name__}:{json.dumps(kwargs, sort_keys=True, default=str)}"
            cache_key = f"{prefix}:{hashlib.md5(key_data.encode()).hexdigest()}"
            
            # Try cache first
            try:
                cached_value = await redis.get(cache_key)
                if cached_value:
                    return json.loads(cached_value)
            except Exception:
                pass
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            try:
                await redis.set(cache_key, json.dumps(result, default=str), ex=ttl_seconds)
            except Exception:
                pass
            
            return result
        return wrapper
    return decorator

# Usage:
@router.get("/topology/all")
@cached(ttl_seconds=60, prefix="topology")
async def get_global_topology(session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    return await repo.get_global_topology()
```

### Verification
- First request: slow (database query)
- Second request within 60s: fast (Redis cache hit)
- After 60s: slow again (cache expired, fresh query)

---

## Fix 31: Redis Pipeline for Alert Listing

### Problem
`plugins/alert_noc/store.py` `list_alerts()` does N+1 Redis queries (1 SMEMBERS + N HGET).

### File
`plugins/alert_noc/store.py`

### Fix
Use Redis pipeline for batch fetching:

```python
async def list_alerts(self, status: str = None) -> list[dict]:
    # Get all alert IDs for the status
    if status:
        alert_ids = await self.redis.smembers(f"alerts:{status}")
    else:
        # Union of all status sets
        alert_ids = await self.redis.sunion("alerts:active", "alerts:acknowledged", "alerts:resolved")
    
    if not alert_ids:
        return []
    
    # Batch fetch all alert data in one pipeline
    pipe = self.redis.pipeline()
    for alert_id in alert_ids:
        pipe.hget("alerts:active", alert_id)
        pipe.hget("alerts:acknowledged", alert_id)
        pipe.hget("alerts:resolved", alert_id)
    results = await pipe.execute()
    
    # Parse results (every 3 results = one alert)
    alerts = []
    for i in range(0, len(results), 3):
        for j in range(3):
            if results[i + j]:
                try:
                    alert = json.loads(results[i + j])
                    alerts.append(alert)
                except json.JSONDecodeError:
                    pass
    
    return alerts
```

### Verification
- 100 alerts: single pipeline call instead of 101 individual calls
- Response time drops from ~200ms to ~20ms

---

## Fix 32: Composite Index for Site Topology

### Problem
No composite index for the `source_id + target_id` query pattern used in site topology.

### File
`db/init.sql`

### Fix
```sql
CREATE INDEX IF NOT EXISTS idx_relationship_source_target 
ON relationship(source_id, target_id);

CREATE INDEX IF NOT EXISTS idx_ci_site_type 
ON ci(site, type);

CREATE INDEX IF NOT EXISTS idx_alert_status_service 
ON alert(status, ci_id);
```

### Verification
- `EXPLAIN ANALYZE` on site topology query shows index scan instead of sequential scan
- Query time improves for larger datasets

---

## Fix 33: Cytoscape Instance Reuse

### Problem
`TopologyGraph.tsx` destroys and recreates the entire Cytoscape instance on every state change. Causes flicker and wastes computation.

### File
`ui/src/components/TopologyGraph.tsx`

### Fix
Keep the Cytoscape instance alive and update elements:

```typescript
useEffect(() => {
  if (!containerRef.current) return;
  
  // Only create instance once
  if (!cyRef.current) {
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: buildElements(topology),
      layout: { name: 'preset' },
      style: [/* ... existing styles */],
    });
  } else {
    // Update elements without destroying
    cyRef.current.elements().remove();
    cyRef.current.add(buildElements(topology));
    cyRef.current.layout({ name: 'breadthfirst', ... }).run();
  }
}, [topology, selectedSite, selectedService]);
```

### Verification
- Switching sites doesn't cause visible flicker
- Graph updates smoothly
- Memory usage stays flat

---

## Fix 34: Pagination for CI Listing

### Problem
`get_global_topology()` loads ALL CIs into memory. At 105 CIs this is fine; at 10,000+ it would be hundreds of MB.

### Files
`core_platform/routers/cmdb.py`, `core_platform/cmdb/repository.py`

### Fix
Add pagination support:

```python
@router.get("/ci")
async def list_cis(skip: int = 0, limit: int = 100, site: str = None, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    cis = await repo.list_cis(skip=skip, limit=limit, site=site)
    total = await repo.count_cis(site=site)
    return {"items": cis, "total": total, "skip": skip, "limit": limit}
```

**Repository:**
```python
async def list_cis(self, skip: int = 0, limit: int = 100, site: str = None) -> list[dict]:
    query = select(CI)
    if site:
        query = query.where(CI.site == site)
    query = query.offset(skip).limit(limit)
    result = await self.session.execute(query)
    return [dict(row) for row in result.mappings().all()]

async def count_cis(self, site: str = None) -> int:
    query = select(func.count(CI.id))
    if site:
        query = query.where(CI.site == site)
    result = await self.session.execute(query)
    return result.scalar()
```

### Verification
- `GET /api/v1/cmdb/ci?skip=0&limit=10` returns 10 CIs
- `GET /api/v1/cmdb/ci?skip=10&limit=10` returns next 10
- Total count is accurate

---

## Fix 35: DB Connection Pool Monitoring

### Problem
Pool of 20 connections with no metrics on utilization, checkout wait time, or stale connections.

### File
`aiops_shared/database.py`

### Fix
Add pool stats endpoint:

```python
@router.get("/health/pool")
async def get_pool_stats():
    pool = engine.pool
    return {
        "pool_size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
    }
```

Add to health check:
```python
@router.get("/health")
async def health(session=Depends(get_session)):
    # ... existing checks
    
    # Pool stats
    pool = session.get_bind().pool
    checks["db_pool"] = {
        "size": pool.size(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
    }
    
    return result
```

### Verification
- `GET /health` includes `db_pool` stats
- `GET /health/pool` shows pool utilization
- Under load, `checked_out` increases

---

## Fix 36: Async Seed Script

### Problem
`db/seed.py` uses synchronous SQLAlchemy while everything else is async. Not idempotent.

### File
`db/seed.py`

### Fix
Convert to async and add idempotency:

```python
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def seed():
    engine = create_async_engine("postgresql+asyncpg://aiops:aiops@postgres:5432/aiops")
    async with engine.begin() as conn:
        # Use ON CONFLICT for idempotency
        await conn.execute(text("""
            INSERT INTO ci (id, name, type, provider, environment, team, site, site_type, network_layer, topology_type, labels)
            VALUES (:id, :name, :type, :provider, :environment, :team, :site, :site_type, :network_layer, :topology_type, :labels::jsonb)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                labels = EXCLUDED.labels
        """), ci_data)
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())
```

### Verification
- Running seed twice doesn't create duplicates
- All CIs are updated with latest data
- Script completes in < 30 seconds

---

## Fix 37: WebSocket for Real-Time Alerts

### Problem
All UI data fetching is poll-based. NOC operators miss events between polls.

### Files
`core_platform/main.py`, `ui/src/pages/NOCAlerts.tsx`

### Fix
Add WebSocket endpoint:

**Backend:**
```python
from fastapi import WebSocket, WebSocketDisconnect

connected_clients: list[WebSocket] = []

@router.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            # Keep connection alive, receive pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

async def broadcast_alert(alert: dict):
    for client in connected_clients:
        try:
            await client.send_json(alert)
        except Exception:
            pass
```

**Frontend:**
```typescript
const [ws, setWs] = useState<WebSocket | null>(null);

useEffect(() => {
  const socket = new WebSocket(`ws://${window.location.host}/api/v1/ws/alerts`);
  socket.onmessage = (event) => {
    const alert = JSON.parse(event.data);
    setAlerts(prev => [alert, ...prev]);
  };
  setWs(socket);
  return () => socket.close();
}, []);
```

### Verification
- New alerts appear in NOC console without page refresh
- WebSocket reconnects after disconnection
- No performance degradation with multiple clients

---

## Execution Order

All 9 fixes are independent. Execute in parallel:
29. N+1 query fix
30. Redis caching
31. Redis pipeline for alerts
32. Composite indexes
33. Cytoscape instance reuse
34. CI pagination
35. DB pool monitoring
36. Async seed script
37. WebSocket for alerts

### Final Step: Rebuild
```bash
docker compose build api-gateway alert-noc ui
docker compose up -d
```
