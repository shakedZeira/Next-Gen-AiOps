# Plan: Prometheus Integration

**Impact: MEDIUM | Effort: LOW-MEDIUM (2-3 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Scrape Prometheus metrics to enrich SLI calculations with real metric data and display live metrics alongside topology.

## Current State
- SLI values computed from alert counts (synthetic)
- No real metric data source
- Prometheus is a standard in K8s/cloud environments

## Design

### Metric Collection
- Query Prometheus HTTP API for instant and range queries
- Cache results in Redis (30s TTL)
- Map Prometheus labels to CMDB CIs

### SLI Enrichment
- Use real `up{job="service-name"}` for availability SLI
- Use `http_request_duration_seconds_bucket` for latency P99
- Use `rate(http_requests_total{code=~"5.."}[5m])` for error rate

### Dashboard Enrichment
- Show live CPU/memory/disk on NodeDetailPanel
- Show latency/error rate on ServiceHealthCard

## Implementation

### Backend
1. `plugins/metrics_collector/prometheus.py` (NEW) - Prometheus client
   - `query(instant_query)` -> metric results
   - `query_range(query, start, end, step)` -> time series
   - `label_values(metric, label)` -> label values
   - Config: PROMETHEUS_URL
2. `plugins/metrics_collector/sli_enricher.py` (NEW) - enrich SLO data
   - `enrich_sli(service, sli_type)` -> real metric value
   - Fallback to synthetic if Prometheus unavailable
3. Wire into `core_platform/routers/slo.py` - optional Prometheus enrichment
4. `plugins/metrics_collector/main.py` (NEW) - standalone service or embedded

### Frontend
5. `ui/src/components/MetricChart.tsx` (NEW) - sparkline/time series chart (recharts or chart.js)
6. `ui/src/components/NodeDetailPanel.tsx` - live CPU/memory metrics
7. `ui/src/components/ServiceHealthCard.tsx` - real latency/error rate
8. `ui/src/api/client.ts` - metricsAPI

### Docker
9. Docker Compose: add PROMETHEUS_URL env var
10. Optional: add Prometheus service to docker-compose for demo

## Verification
1. SLO dashboard shows real metrics when Prometheus available
2. Falls back to synthetic when Prometheus unavailable
3. NodeDetailPanel shows live CPU/memory charts
4. ServiceHealthCard shows real latency from Prometheus
