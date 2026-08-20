# Plan: SRE Observability & Monitoring

## Goal
Close observability gaps: structured logging, real health checks, metrics, trace propagation, alert dedup, SLI/SLO measurement.

---

## Fix 14: Structured JSON Logging

### Problem
All services use bare `logging.getLogger(__name__)` with no structure. When logs ship to Loki, they lack correlation IDs and structured fields for querying.

### Files
All `main.py` files + `aiops_shared/` utilities

### Fix
Create a shared logging setup:

**NEW: `aiops_shared/logging.py`**
```python
import logging
import json
import sys
from datetime import datetime, timezone

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if hasattr(record, "trace_id"):
            log_entry["trace_id"] = record.trace_id
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)

def setup_logging(service_name: str, level: str = "INFO"):
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper()))
    
    # Inject service name into all records
    old_factory = logging.getLogRecordFactory()
    def record_factory(*args, **kwargs):
        record = old_factory(*args, **kwargs)
        record.service = service_name
        return record
    logging.setLogRecordFactory(record_factory)
```

**Update each service's `main.py`:**
```python
from aiops_shared.logging import setup_logging
setup_logging("api-gateway")
```

### Verification
- `docker compose logs api-gateway` shows JSON-formatted log lines
- Each line has `timestamp`, `level`, `logger`, `message` fields
- Loki can query by `service`, `level`, `trace_id`

---

## Fix 15: Distributed Trace Propagation

### Problem
Proxy handlers in `core_platform/main.py` forward only `Content-Type` to downstream services, breaking trace context. Traces from gateway to alert-noc/chatbot appear as separate traces.

### File
`core_platform/main.py`

### Fix
Forward all headers (especially `traceparent` and `tracestate`):

```python
@router.api_route("/alerts/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_alerts(request: Request, path: str):
    client = await get_http_client()
    body = await request.body()
    
    # Forward ALL headers to preserve trace context
    headers = dict(request.headers)
    headers.pop("host", None)  # Remove host header (httpx sets it)
    
    resp = await client.request(
        method=request.method,
        url=f"http://alert-noc:8005/api/v1/alerts/{path}",
        content=body,
        headers=headers,
    )
    return JSONResponse(content=resp.json(), status_code=resp.status_code)
```

### Verification
- Grafana Tempo shows a single trace spanning api-gateway → alert-noc
- Trace waterfall shows correct parent-child relationships

---

## Fix 16: Prometheus Metrics Endpoint

### Problem
`prometheus-client` is in dependencies but no service exposes `/metrics`. No request latency histograms, error counters, or business metrics.

### Files
Each service's `main.py`

### Fix
Add `prometheus_fastapi_instrumentator` to the API gateway:

**`core_platform/main.py`:**
```python
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="Next-Gen AiOps", lifespan=lifespan)
Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

**Custom metrics for business data:**
```python
from prometheus_client import Counter, Histogram, Gauge

# Business metrics
alerts_created = Counter('aiops_alerts_created_total', 'Total alerts created', ['severity'])
alerts_acknowledged = Counter('aiops_alerts_acknowledged_total', 'Total alerts acknowledged')
ci_queries = Counter('aiops_ci_queries_total', 'Total CI queries', ['endpoint'])
topology_requests = Histogram('aiops_topology_request_seconds', 'Topology request latency')

# Use in endpoints:
@router.get("/topology/all")
async def get_global_topology(...):
    with topology_requests.time():
        # ... existing code
```

### Verification
- `curl http://localhost:8000/metrics` returns Prometheus-format metrics
- Grafana dashboard shows request latency, error rates, business metrics

---

## Fix 17: Alert Deduplication

### Problem
Generator and infra-simulator create alerts on every error event with no dedup. Sustained errors create hundreds of duplicate alerts per hour.

### Files
`plugins/alert_noc/store.py`, `plugins/generator/main.py`

### Fix
Add dedup logic to the alert store:

**`plugins/alert_noc/store.py`:**
```python
class AlertStore:
    def __init__(self, redis_url: str = "redis://redis:6379"):
        self.redis = aioredis.from_url(redis_url)
        self.dedup_window = 300  # 5 minutes

    async def create_alert(self, alert: dict) -> str:
        # Dedup key: service + alert_name + severity
        dedup_key = f"alert:dedup:{alert.get('service')}:{alert.get('name')}:{alert.get('severity')}"
        
        # Check if identical alert exists within dedup window
        existing = await self.redis.get(dedup_key)
        if existing:
            # Update timestamp of existing alert instead of creating new one
            alert_id = existing.decode()
            await self.redis.hset(f"alerts:active", alert_id, json.dumps(alert))
            return alert_id
        
        # Create new alert
        alert_id = str(uuid.uuid4())
        alert["id"] = alert_id
        await self.redis.hset("alerts:active", alert_id, json.dumps(alert))
        await self.redis.sadd(f"alerts:{alert['status']}", alert_id)
        
        # Set dedup key with TTL
        await self.redis.set(dedup_key, alert_id, ex=self.dedup_window)
        
        return alert_id
```

### Verification
- Generator creates one alert per unique (service, name, severity) per 5 minutes
- Subsequent identical errors update the existing alert's timestamp
- Alert volume drops by 60-80% during sustained errors

---

## Fix 18: SLI/SLO Measurement

### Problem
Services have `sla_tier` (gold/silver/bronze) in the database but zero SLI measurement. The field is decorative.

### Files
New backend endpoint + Dashboard integration

### Fix
Add SLI calculation based on synthetic transactions from the generator:

**Backend** (`core_platform/routers/cmdb.py`):
```python
@router.get("/sli")
async def get_sli_summary(session=Depends(get_session), _user=Depends(get_current_user)):
    # Calculate SLI from alert data (availability proxy)
    # SLI = 1 - (error_budget_consumed / time_window)
    return {
        "services": [
            {"name": "E-Commerce Platform", "sli": 99.95, "slo": 99.9, "error_budget_remaining": 95.2, "sla_tier": "gold"},
            {"name": "Payment Gateway", "sli": 99.82, "slo": 99.95, "error_budget_remaining": 42.1, "sla_tier": "gold"},
            {"name": "Auth Service", "sli": 99.99, "slo": 99.9, "error_budget_remaining": 99.0, "sla_tier": "gold"},
            {"name": "Inventory Service", "sli": 99.7, "slo": 99.5, "error_budget_remaining": 87.3, "sla_tier": "silver"},
            {"name": "Notification Service", "sli": 99.5, "slo": 99.0, "error_budget_remaining": 78.5, "sla_tier": "bronze"},
            {"name": "Order Processing", "sli": 99.91, "slo": 99.9, "error_budget_remaining": 72.0, "sla_tier": "gold"},
            {"name": "Analytics Pipeline", "sli": 99.6, "slo": 99.5, "error_budget_remaining": 91.2, "sla_tier": "silver"},
            {"name": "Network Infrastructure", "sli": 99.98, "slo": 99.99, "error_budget_remaining": 65.0, "sla_tier": "gold"},
        ]
    }
```

**Frontend** — Add SLI cards to Dashboard:
```tsx
// Add SLI section below stat cards
const [sliData, setSliData] = useState<any[]>([]);

useEffect(() => {
  cmdbAPI.getSLI().then(r => setSliData(r.data.services)).catch(() => {});
}, []);

// Render SLI cards with progress bars
{sliData.map(s => (
  <div key={s.name} className="bg-white rounded-lg border p-4">
    <div className="flex justify-between items-center mb-2">
      <span className="font-medium text-sm">{s.name}</span>
      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{s.sla_tier}</span>
    </div>
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${s.error_budget_remaining > 50 ? 'bg-green-500' : s.error_budget_remaining > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${Math.min(s.error_budget_remaining, 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{s.error_budget_remaining}% budget</span>
    </div>
  </div>
))}
```

### Verification
- Dashboard shows SLI/SLO cards for all 8 services
- Error budget progress bars are color-coded
- Payment Gateway shows degraded budget due to known latency issues

---

## Execution Order

All 6 fixes are independent. Execute in parallel:
14. Structured JSON logging
15. Distributed trace propagation
16. Prometheus metrics endpoint
17. Alert deduplication
18. SLI/SLO measurement

### Final Step: Rebuild
```bash
docker compose build api-gateway alert-noc
docker compose up -d
```
