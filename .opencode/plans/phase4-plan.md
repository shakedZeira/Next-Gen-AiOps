# Phase 4 Implementation Plan

## Overview
Phase 4 covers 5 workstreams: Geo Map enhancements, Docs page, SRE-driven improvements, and Phase 4 feature candidates.

---

## Item 1: Inter-Site Flow Animation on Geo Map

**Goal:** Add animated traffic flow lines between sites showing data flow direction, volume, and health.

### Design
- Use Leaflet `L.polyline` with CSS animation via `L.divIcon` or canvas overlay
- Flow direction: animated dash offset using CSS `@keyframes`
- Flow color: green (healthy), yellow (degraded), red (critical) based on connection status
- Flow thickness: represents bandwidth/utilization (thin=low, thick=high)
- Tooltip on hover shows: source → target, type, bandwidth, latency, status

### Files to Modify
- `ui/src/components/GeoMap.tsx` — Add animated flow overlay
- `core_platform/routers/cmdb.py` — Add `GET /topology/inter-site/flows` with traffic data
- `ui/src/types/index.ts` — Add `SiteFlow` interface

### Implementation Steps
1. Add backend endpoint `GET /api/v1/cmdb/topology/inter-site/flows` returning:
   ```json
   [{
     "source_site": "global-hq",
     "target_site": "regional-dc-1",
     "connection_type": "mpls",
     "bandwidth_mbps": 10000,
     "utilization_pct": 67,
     "latency_ms": 12,
     "status": "healthy",
     "bytes_per_sec": 670000000
   }]
   ```
2. Create animated polyline rendering using Leaflet canvas with CSS animations
3. Add flow legend (color = health, thickness = utilization)
4. Add toggle to show/hide flows on the geo map
5. Add flow data to popups on connection lines

### CSS Animation Approach
```css
.flow-line {
  stroke-dasharray: 12 8;
  animation: flowDash 1s linear infinite;
}
@keyframes flowDash {
  to { stroke-dashoffset: -20; }
}
```

---

## Item 2: Zoomed-In Site Geo Map

**Goal:** When clicking a site on the global geo map, show a zoomed-in map of that site with building/room/rack markers.

### Design
- New `SiteGeoMap` component that shows a single site at street-level zoom
- Markers for: DC rooms (building icons), racks (server icons), key CIs (device icons)
- Clicking a room marker navigates to DC Explorer with that room pre-selected
- Clicking a CI marker shows a mini detail popup
- Uses the existing DC room/rack/equipment API data

### Files to Create/Modify
- `ui/src/components/SiteGeoMap.tsx` — **NEW** zoomed-in site map
- `ui/src/components/GeoMap.tsx` — Add click handler to site markers
- `ui/src/pages/CMDBExplorer.tsx` — Add site geo map modal/panel
- `core_platform/routers/cmdb.py` — Add `GET /cmdb/sites/{site_name}/map-data` returning room/CI coordinates
- `ui/src/types/index.ts` — Add `SiteMapPin` interface

### Implementation Steps
1. Add backend endpoint `GET /api/v1/cmdb/sites/{site_name}/map-data` returning:
   ```json
   {
     "center": {"lat": 40.7128, "lng": -74.0060},
     "zoom": 15,
     "pins": [
       {"id": "room-uuid", "name": "DC1-Main", "type": "room", "lat": 40.713, "lng": -74.005, "details": {"tier": 3, "racks": 10}},
       {"id": "ci-uuid", "name": "Core-SW-1", "type": "switch", "lat": 40.7132, "lng": -74.0055, "site": "global-hq"}
     ]
   }
   ```
   Since we don't have real GPS coordinates for rooms/CIs within a site, generate synthetic coordinates as offsets from the site center (e.g., rooms at ±0.001 degrees).

2. Create `SiteGeoMap.tsx` component:
   - Leaflet map centered on site coordinates, zoom 15-17
   - Custom markers per pin type (building, server, switch, router icons)
   - Click handler on room pins → navigate to `/dc-explorer?room={id}`
   - Click handler on CI pins → show mini popup with CI details
   - "Back to Global Map" button

3. Modify CMDBExplorer:
   - When in 'geo' view mode and user clicks a site marker, show `SiteGeoMap` in a modal or replace the global map
   - Add breadcrumb: Global Map > Site Name

4. Modify `GeoMap.tsx`:
   - Wire popup "View Site Map" button to call `onSiteClick`

---

## Item 3: Documentation Page

**Goal:** Add a `/docs` page explaining all project capabilities with interactive examples.

### Files to Create/Modify
- `ui/src/pages/Docs.tsx` — **NEW** documentation page
- `ui/src/App.tsx` — Add route `/docs`
- `ui/src/components/Sidebar.tsx` — Add nav item

### Content Structure
1. **Overview** — What is Next-Gen AiOps, architecture diagram (text-based)
2. **Getting Started** — Login, default credentials, first steps
3. **Dashboard** — Site health overview, stat cards, topology
4. **CMDB Explorer** — 3 view modes explained, site filtering, CI details
5. **Geo Map** — Global map, site map, flow visualization
6. **NOC Alerts** — Filtering, acknowledge/resolve workflow
7. **AI Chatbot** — How to use, suggestion chips, approval queue
8. **DC Explorer** — Room layout, rack visualization, 42U elevation
9. **Agent Monitor** — LLM usage, model health
10. **System Health** — Infrastructure monitoring
11. **Architecture** — Tech stack, microservices, database schema
12. **API Reference** — Key endpoints with examples
13. **Deployment** — Docker Compose setup, environment variables

### Design
- Sidebar-based navigation within the docs page
- Code blocks with syntax highlighting
- Dark theme consistent with the app

---

## Item 4: SRE Deep Dive Improvements

### 4A: Critical Quick Wins (< 1 day each)

| # | Fix | File | Effort |
|---|-----|------|--------|
| 1 | Fix `time.sleep()` → `asyncio.sleep()` in generator | `plugins/generator/otel_emitter.py` | 30 min |
| 2 | Add security headers to nginx | `ui/nginx.conf` | 10 min |
| 3 | Add Redis password to docker-compose | `docker-compose.yml` | 20 min |
| 4 | Add DB check to health endpoint | `core_platform/routers/health.py` | 30 min |
| 5 | Add Cache-Control headers to topology endpoints | `core_platform/routers/cmdb.py` | 20 min |

### 4B: Architecture Fixes (1-2 days each)

| # | Fix | File(s) | Effort |
|---|-----|---------|--------|
| 6 | Fix httpx connection pooling in proxy | `core_platform/main.py` | 1 hr |
| 7 | Add proxy request timeouts | `core_platform/main.py` | 30 min |
| 8 | Fix ApprovalManager to read from Redis | `plugins/chatbot/approval.py` | 1 hr |
| 9 | Fix unbounded list in agent-monitor | `plugins/agent_monitor/router.py` | 30 min |
| 10 | Add ErrorBoundary to React app | `ui/src/App.tsx` | 30 min |
| 11 | Wire Dashboard stats to real APIs | `ui/src/pages/Dashboard.tsx` | 2 hr |
| 12 | Wire edge health to real alert data | `ui/src/components/TopologyGraph.tsx` | 2 hr |
| 13 | Wire NodeDetailPanel alerts to real data | `ui/src/components/NodeDetailPanel.tsx` | 1 hr |

---

## Item 5: Phase 4 Feature Candidates (Future)

### Tier 1 — High Impact, Medium Effort
1. **Alert Noise Reduction** — Temporal dedup + fuzzy grouping (reduce alert volume by 60-80%)
2. **ML Anomaly Detection** — Isolation Forest replacing z-score threshold alerts
3. **Change-Aware Correlation** — Correlate alerts with recent deployments/config changes
4. **Incident Timeline** — Visual timeline showing alert cascade and resolution
5. **Runbook Automation** — YAML-based playbooks with approval gates

### Tier 2 — High Impact, High Effort
6. **Predictive Alerting** — Forecast metric trends, alert before threshold breach
7. **Self-Healing Pipeline** — Anomaly → RCA → Fix → Approval → Execute → Validate
8. **Service Dependency Map** — Real-time service mesh visualization with latency/error rates
9. **Capacity Planning** — Trend analysis for CPU/memory/disk/network forecasting
10. **Cost Attribution** — Map infrastructure costs to services/teams

### Tier 3 — Medium Impact, Low Effort
11. **WebSocket Real-Time Push** — Eliminate polling for alerts/status
12. **CI Search & Filtering** — Text search across all CIs
13. **Impact Analysis Visualization** — Highlight downstream blast radius on topology
14. **SLI/SLO Dashboard** — Error budget tracking per service
15. **Audit Log** — Track all user actions with timestamps

---

## Execution Order

### Wave 1 (Parallel): Quick Wins + Geo Map Backend
1. Fix `time.sleep()` → `asyncio.sleep()`
2. Add security headers to nginx
3. Add Redis password
4. Add DB check to health endpoint
5. Add Cache-Control headers
6. Add inter-site flow endpoint
7. Add site map-data endpoint

### Wave 2 (Parallel): Geo Map Frontend + Docs
8. Implement animated flow lines on GeoMap
9. Implement SiteGeoMap component
10. Integrate SiteGeoMap into CMDBExplorer
11. Create Docs page with all sections

### Wave 3 (Parallel): Architecture Fixes + Dashboard
12. Fix httpx connection pooling
13. Add proxy timeouts
14. Fix ApprovalManager Redis reading
15. Fix agent-monitor memory leak
16. Add React ErrorBoundary
17. Wire Dashboard to real APIs
18. Wire edge health to real data
19. Wire NodeDetailPanel to real alerts

### Wave 4: Rebuild & Verify
20. Docker rebuild all services
21. End-to-end testing
22. Performance verification
