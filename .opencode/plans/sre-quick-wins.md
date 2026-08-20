# Plan: SRE Quick Wins

## Goal
5 fast fixes (< 1 day each) that significantly improve production-readiness.

---

## Quick Win 1: Fix Event Loop Blocking in Generator

### Problem
`plugins/generator/otel_emitter.py` line 44 uses `time.sleep(latency / 1000)` which is a synchronous blocking call inside an async context. With 16 services generating metrics, this blocks the event loop for seconds per cycle.

### File
`plugins/generator/otel_emitter.py`

### Fix
```python
# BEFORE (line 44)
time.sleep(latency / 1000)

# AFTER
await asyncio.sleep(latency / 1000)
```

Also need to:
1. Add `import asyncio` at top
2. Make `emit_transaction` an async function: `async def emit_transaction(...)`
3. Update caller in `main.py` to await it

### Verification
- Generator container starts without errors
- No "event loop blocked" warnings in logs
- Other services remain responsive during generation cycles

---

## Quick Win 2: Add Security Headers to nginx

### Problem
`ui/nginx.conf` has no security headers. An auditor would immediately flag missing `X-Content-Type-Options`, `X-Frame-Options`, etc.

### File
`ui/nginx.conf`

### Fix
Add after `listen 80;` or in the server block:
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

### Verification
- `curl -I http://localhost` shows all security headers
- UI still loads correctly (no CSP blocking assets)

---

## Quick Win 3: Add Redis Password

### Problem
Redis is exposed on port 6379 with no authentication. Any process on the host can read/write alert data, approval states, and chat sessions.

### File
`docker-compose.yml`

### Fix
```yaml
redis:
  image: redis:7-alpine
  command: redis-server --requirepass ${REDIS_PASSWORD:-changeme}
  ports:
    - "127.0.0.1:6379:6379"  # Bind to localhost only
```

Also update all services that connect to Redis:
- `plugins/chatbot/approval.py` — Add password to Redis URL
- `plugins/alert_noc/store.py` — Add password to Redis URL
- `plugins/agent_monitor/router.py` — Add password to Redis URL

Add to `.env.example`:
```
REDIS_PASSWORD=changeme
```

### Verification
- All containers start and connect to Redis successfully
- `redis-cli -h localhost` without password gets `NOAUTH`
- `redis-cli -h localhost -a changeme` connects successfully

---

## Quick Win 4: Add Database Check to Health Endpoint

### Problem
`core_platform/routers/health.py` unconditionally returns `{"status": "healthy"}` regardless of database connectivity. A dead database would not be detected.

### File
`core_platform/routers/health.py`

### Fix
```python
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from aiops_shared.database import get_session

router = APIRouter()

@router.get("/health")
async def health(session=Depends(get_session)):
    checks = {"database": "disconnected"}
    status_code = 200
    
    try:
        await session.execute(text("SELECT 1"))
        checks["database"] = "connected"
    except Exception as e:
        status_code = 503
        checks["database_error"] = str(e)
    
    # Check Redis
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url("redis://redis:6379")
        await r.ping()
        await r.aclose()
        checks["redis"] = "connected"
    except Exception:
        status_code = 503
        checks["redis"] = "disconnected"
    
    result = {
        "status": "healthy" if status_code == 200 else "unhealthy",
        "service": "nextgen-aiops",
        "version": "0.1.0",
        **checks
    }
    
    return JSONResponse(status_code=status_code, content=result)
```

### Verification
- `curl http://localhost:8000/health` returns `{"status":"healthy","database":"connected","redis":"connected"}`
- Stop postgres container → health returns 503 with `database: disconnected`
- Stop redis container → health returns 503 with `redis: disconnected`

---

## Quick Win 5: Add Cache-Control Headers to Topology Endpoints

### Problem
Every page load triggers full database queries for topology data that rarely changes. No caching headers means browsers re-fetch on every navigation.

### File
`core_platform/routers/cmdb.py`

### Fix
Add response headers to the topology endpoints:

```python
from fastapi.responses import JSONResponse

@router.get("/topology/all")
async def get_global_topology(session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    topology = await repo.get_global_topology()
    return JSONResponse(
        content=topology,
        headers={"Cache-Control": "public, max-age=60", "ETag": f'"topology-{len(topology.get("nodes", []))}-{len(topology.get("edges", []))}"'}
    )

@router.get("/topology/site-aggregate")
async def get_site_aggregate_topology(session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    topology = await repo.get_site_aggregate_topology()
    return JSONResponse(
        content=topology,
        headers={"Cache-Control": "public, max-age=120"}
    )

@router.get("/topology/site/{site_name}")
async def get_site_topology(site_name: str, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    topology = await repo.get_site_topology(site_name)
    return JSONResponse(
        content=topology,
        headers={"Cache-Control": "public, max-age=60"}
    )

@router.get("/sites")
async def get_sites(session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    sites = await repo.get_all_sites()
    return JSONResponse(
        content=sites,
        headers={"Cache-Control": "public, max-age=300"}
    )
```

### Verification
- `curl -I http://localhost:8000/api/v1/cmdb/topology/all` shows `Cache-Control: public, max-age=60`
- Browser DevTools Network tab shows 304 responses on repeat visits
- API responses still return correct data

---

## Execution Order

All 5 quick wins are independent and can be done in parallel:
1. Fix time.sleep() → asyncio.sleep()
2. Add security headers to nginx
3. Add Redis password
4. Add DB check to health endpoint
5. Add Cache-Control headers

### Final Step: Rebuild & Verify
```bash
docker compose build api-gateway ui generator
docker compose up -d
```
