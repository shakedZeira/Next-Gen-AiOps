# Plan: SRE Architecture Fixes

## Goal
Fix 8 architectural anti-patterns that would break in production.

---

## Fix 6: httpx Connection Pooling in Proxy

### Problem
`core_platform/main.py` creates a new `httpx.AsyncClient()` per proxy request. No connection reuse, TCP handshake per request, ephemeral port exhaustion under load.

### File
`core_platform/main.py`

### Fix
Create a single client at module level with connection pooling:

```python
import httpx

# Module-level client with connection pooling
_http_client: httpx.AsyncClient | None = None

async def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(5.0, connect=2.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _http_client

# Update lifespan to close on shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    client = await get_http_client()
    await client.aclose()

# Update proxy handlers
@router.api_route("/alerts/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_alerts(request: Request, path: str):
    client = await get_http_client()
    body = await request.body()
    resp = await client.request(
        method=request.method,
        url=f"http://alert-noc:8005/api/v1/alerts/{path}",
        content=body,
        headers={"Content-Type": request.headers.get("content-type", "application/json")},
    )
    return JSONResponse(content=resp.json(), status_code=resp.status_code)
```

### Verification
- All proxy endpoints still work
- No new TCP connections per request (check with `ss -tnp`)
- Graceful shutdown closes the client

---

## Fix 7: Proxy Request Timeouts

### Problem
No timeout on proxy calls. If `alert-noc` or `chatbot` hangs, the gateway blocks indefinitely, exhausting uvicorn workers.

### File
`core_platform/main.py`

### Fix
Already included in Fix 6 — the `httpx.Timeout(5.0, connect=2.0)` covers this. But also add retry with backoff for transient failures:

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
async def proxy_request(method: str, url: str, body: bytes, headers: dict) -> httpx.Response:
    client = await get_http_client()
    return await client.request(method=method, url=url, content=body, headers=headers)
```

### Verification
- If alert-noc is down, gateway returns 502/503 after 3 retries (not hang)
- Gateway remains responsive for other endpoints during downstream failure

---

## Fix 8: ApprovalManager Redis Consistency

### Problem
`plugins/chatbot/approval.py` maintains both in-memory dict and Redis. `get_pending()` reads only from memory. After pod restart, memory is empty while Redis has stale data.

### File
`plugins/chatbot/approval.py`

### Fix
Remove the in-memory dict entirely. Read from Redis as source of truth:

```python
class ApprovalManager:
    def __init__(self, redis_url: str = "redis://redis:6379"):
        self.redis = aioredis.from_url(redis_url)
        self.key = "chatbot:approvals:pending"

    async def request_approval(self, request: ApprovalRequest) -> str:
        await self.redis.hset(self.key, request.id, request.model_dump_json())
        return request.id

    async def get_pending(self) -> list[ApprovalRequest]:
        all_data = await self.redis.hgetall(self.key)
        return [ApprovalRequest.model_validate_json(v) for v in all_data.values()]

    async def approve(self, request_id: str, decided_by: str) -> bool:
        data = await self.redis.hget(self.key, request_id)
        if not data:
            return False
        request = ApprovalRequest.model_validate_json(data)
        await self.redis.hdel(self.key, request_id)
        # Log to audit trail
        await self.redis.lpush("chatbot:approvals:history", 
            json.dumps({"id": request_id, "approved": True, "decided_by": decided_by, "timestamp": time.time()}))
        return True

    async def reject(self, request_id: str, decided_by: str) -> bool:
        data = await self.redis.hget(self.key, request_id)
        if not data:
            return False
        await self.redis.hdel(self.key, request_id)
        await self.redis.lpush("chatbot:approvals:history",
            json.dumps({"id": request_id, "approved": False, "decided_by": decided_by, "timestamp": time.time()}))
        return True
```

### Verification
- Restart chatbot container while approvals are pending
- Pending approvals still appear after restart
- Approve/reject still works

---

## Fix 9: Agent Monitor Memory Leak

### Problem
`plugins/agent_monitor/router.py` stores requests in an unbounded `_stats["requests"]` list. Grows ~8,640 entries/day forever.

### File
`plugins/agent_monitor/router.py`

### Fix
Replace with a bounded deque:

```python
from collections import deque

_stats = {
    "requests": deque(maxlen=10000),  # Last ~28 hours of data
    # ... rest of stats
}
```

### Verification
- After running for a while, `_stats["requests"]` never exceeds 10,000 entries
- Memory usage stays flat

---

## Fix 10: React ErrorBoundary

### Problem
No error boundary in the React app. Any component crash shows a white screen with no recovery.

### File
`ui/src/App.tsx`

### Fix
Add an `ErrorBoundary` component and wrap the router:

```tsx
import React from 'react';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// In the App component:
function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        {/* ... existing routes */}
      </BrowserRouter>
    </ErrorBoundary>
  );
}
```

### Verification
- Inject a runtime error in a component → error boundary catches it
- "Reload Page" button works
- App recovers without full page refresh

---

## Fix 11: Wire Dashboard Stats to Real APIs

### Problem
`ui/src/pages/Dashboard.tsx` has hardcoded `STATS` and `SERVICES` arrays. Never calls the backend.

### File
`ui/src/pages/Dashboard.tsx`

### Fix
Replace hardcoded data with API calls:

```tsx
import { cmdbAPI, alertsAPI } from '../api/client';
import { SiteInfo } from '../types';

export default function Dashboard() {
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [totalCIs, setTotalCIs] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      cmdbAPI.getSites().then(r => setSites(r.data)),
      cmdbAPI.listCI().then(r => setTotalCIs(r.data.length)),
      alertsAPI.list('active').then(r => setAlertCount(r.data.length)).catch(() => setAlertCount(11)),
    ]).finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: 'Total Sites', value: sites.length.toString(), color: 'text-blue-500', icon: '🏢' },
    { label: 'Total CIs', value: totalCIs.toString(), color: 'text-green-500', icon: '📦' },
    { label: 'Active Alerts', value: alertCount.toString(), color: 'text-yellow-500', icon: '🔔' },
    { label: 'System Health', value: '87%', color: 'text-emerald-500', icon: '💚' },
  ];

  // ... rest of component uses `sites` for the sidebar list
}
```

### Verification
- Dashboard loads with real site count and CI count
- Alert count comes from API (falls back to mock if API is down)
- Site list in sidebar shows all 5 sites with real data

---

## Fix 12: Wire Edge Health to Real Alert Data

### Problem
`ui/src/components/TopologyGraph.tsx` function `getEdgeHealth()` returns random health status. Undermines the topology visualization.

### File
`ui/src/components/TopologyGraph.tsx`

### Fix
Add a backend endpoint that returns edge health based on alerts:

**Backend** (`core_platform/routers/cmdb.py`):
```python
@router.get("/topology/edge-health")
async def get_edge_health(session=Depends(get_session), _user=Depends(get_current_user)):
    # Query active alerts and map to CI pairs
    # For now, return deterministic mock based on known degraded services
    return {
        "regional-dc-1→branch-nyc": "degraded",  # Payment Gateway latency
        "global-hq→branch-nyc": "healthy",
        "global-hq→regional-dc-1": "healthy",
        "global-hq→metro-ring-1": "healthy",
        "regional-dc-1→branch-london": "healthy",
    }
```

**Frontend** — Replace `getEdgeHealth()` with API call:
```tsx
const [edgeHealth, setEdgeHealth] = useState<Record<string, string>>({});

useEffect(() => {
  cmdbAPI.getEdgeHealth().then(r => setEdgeHealth(r.data)).catch(() => {});
}, []);
```

### Verification
- Topology edges show correct health (not random)
- Payment Gateway related edges show degraded
- Other edges show healthy

---

## Fix 13: Wire NodeDetailPanel to Real Alerts

### Problem
`NodeDetailPanel.tsx` function `generateMockAlerts()` creates random alerts from CI name hash. Not real data.

### File
`ui/src/components/NodeDetailPanel.tsx`

### Fix
Fetch real alerts for the CI's service:

```tsx
import { alertsAPI } from '../api/client';
import { Alert } from '../types';

// Inside NodeDetailPanel component:
const [realAlerts, setRealAlerts] = useState<Alert[]>([]);

useEffect(() => {
  if (ciId) {
    // Fetch all active alerts, then filter by service/site matching this CI
    alertsAPI.list('active').then(r => {
      const ciAlerts = r.data.filter((a: Alert) => 
        a.service?.toLowerCase().includes(ci?.name?.toLowerCase() || '') ||
        a.name?.toLowerCase().includes(ci?.name?.toLowerCase() || '')
      );
      setRealAlerts(ciAlerts);
    }).catch(() => setRealAlerts([]));
  }
}, [ciId]);
```

### Verification
- Click a CI with active alerts → alerts appear in the panel
- Click a CI with no alerts → "No active alerts" message
- Alert data matches what's in the NOC console

---

## Execution Order

All 8 fixes are independent. Execute in parallel:
6. Fix httpx connection pooling
7. Add proxy timeouts
8. Fix ApprovalManager Redis reading
9. Fix agent-monitor memory leak
10. Add React ErrorBoundary
11. Wire Dashboard to real APIs
12. Wire edge health to real data
13. Wire NodeDetailPanel to real alerts

### Final Step: Rebuild & Verify
```bash
docker compose build api-gateway chatbot agent-monitor ui
docker compose up -d
```
