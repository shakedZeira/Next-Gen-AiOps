# Plan: SRE Observability & Monitoring (Fixes 14-18)

**Impact: HIGH | Effort: MEDIUM (2-3 days)**
**Status: PARTIAL (Fix 17 done)**
**Dependencies: None**

---

## Goal
Complete observability stack: structured logging, tracing, metrics, SLI/SLO.

## Current State
- Fix 17 (alert dedup) — ✅ DONE
- Fix 14 (structured JSON logging) — NOT DONE
- Fix 15 (trace parent forwarding) — NOT DONE
- Fix 16 (Prometheus metrics) — NOT DONE
- Fix 18 (SLI/SLO measurement) — NOT DONE

## Implementation

### Fix 14: Structured JSON Logging
- File: `aiops_shared/logging.py` (NEW)
```python
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        if hasattr(record, "trace_id"):
            log_entry["trace_id"] = record.trace_id
            log_entry["span_id"] = record.span_id
        
        return json.dumps(log_entry)

def setup_logging(service_name: str):
    """Configure structured JSON logging."""
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    
    logging.root.handlers = [handler]
    logging.root.setLevel(logging.INFO)
    
    # Add service name to all logs
    logging.Loggeradapter = lambda logger, extra: logging.LoggerAdapter(logger, {"service": service_name})
```

- File: `core_platform/main.py`
- Import and call `setup_logging("api-gateway")` at startup

### Fix 15: Trace Parent Forwarding
- File: `core_platform/main.py`
- Add middleware to extract `traceparent` header
- Forward to downstream services in proxy routes
- Expected: End-to-end tracing across all services

```python
@app.middleware("http")
async def forward_trace_headers(request: Request, call_next):
    traceparent = request.headers.get("traceparent")
    if traceparent:
        request.state.traceparent = traceparent
    response = await call_next(request)
    return response
```

### Fix 16: Prometheus Metrics
- File: `core_platform/main.py`
- Add `prometheus_fastapi_instrumentator` middleware
- Expose `/metrics` endpoint
- Expected: CPU, memory, request count, latency histograms

```python
from prometheus_fastapi_instrumentator import Instrumentator

instrumentator = Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
    excluded_handlers=["/metrics", "/health"],
)
instrumentator.instrument(app)
instrumentator.expose(app, endpoint="/metrics")
```

### Fix 18: SLI/SLO Measurement
- Already covered in `sli-slo-dashboard.md` plan

## Files to Create/Modify
- `aiops_shared/logging.py` — NEW: Fix 14: JSON formatter
- `core_platform/main.py` — Fix 14: setup logging, Fix 15: trace forwarding, Fix 16: Prometheus
- `plugins/alert_noc/main.py` — Fix 14: setup logging
- `plugins/chatbot/main.py` — Fix 14: setup logging
- Other plugins — Fix 14: setup logging

## Verification
1. Start services → logs are JSON formatted
2. Make API request → trace_id appears in logs
3. Visit `/metrics` → Prometheus metrics exposed
4. Query Prometheus → request count, latency histograms available
