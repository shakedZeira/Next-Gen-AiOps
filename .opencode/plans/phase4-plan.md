# Phase 4 Implementation Plan

## Overview
Phase 4 covers 5 workstreams: Geo Map enhancements, Docs page, SRE-driven improvements, and Phase 4 feature candidates.

---

## Item 1: Inter-Site Flow Animation on Geo Map ✅ COMPLETED

**Goal:** Add animated traffic flow lines between sites showing data flow direction, volume, and health.

### Design
- Use Leaflet `L.polyline` with quadratic bezier arc curves between sites
- Flow direction: animated dash offset using CSS `@keyframes` on SVG stroke
- Flow color: green (healthy), yellow (degraded), red (critical) based on connection status
- Flow thickness: represents utilization (thin=low, thick=high)
- Tooltip on hover shows: source → target, type, bandwidth, latency, utilization, status, packets/errors

### Files Modified
- `ui/src/components/GeoMap.tsx` — Animated curved flow polylines with `getArcPoints()` helper
- `ui/src/index.css` — CSS `@keyframes flowDash` animation for stroke-dashoffset
- `core_platform/routers/cmdb.py` — `GET /topology/inter-site/flows` with 5 real traffic flows
- `ui/src/types/index.ts` — `SiteFlow` interface

### What Changed (Aug 20)
- Replaced broken SVG divIcon marker approach (static 200px horizontal line at midpoint) with proper Leaflet polylines drawn between actual site coordinates
- Added `getArcPoints()` function that computes quadratic bezier curve points with perpendicular offset proportional to distance
- Animated dash overlay layer with CSS `stroke-dashoffset` animation via `requestAnimationFrame`
- Removed orphaned `SiteGeoMap.tsx` component
- Fixed DCRoom import from `core_platform.models.cmdb` to `aiops_shared.models.dc`

---

## Item 2: Zoomed-In Site Geo Map with Topology ✅ COMPLETED

**Goal:** Click site on global geo map → fly to site, show Cytoscape topology graph inside the circle on the map.

### Design
- Click "Zoom In" on site popup → `map.flyTo()` to zoom 14
- Draw 800m-radius dashed blue circle on the site
- Fetch site topology + overview data
- Render Cytoscape topology graph inside a circular-clipped div, pixel-positioned using `latLngToContainerPoint()`
- Fade-in animation (0.8s opacity transition) after flyTo completes
- Position syncs on `zoomend`/`moveend` events
- Compact info bar with device/room/rack counts, teams
- "← Global" button to zoom back out

### Files Modified
- `ui/src/components/GeoMap.tsx` — `focusOnSite()`, `resetToGlobal()`, `calcOverlayPos()`, overlay rendering
- `ui/src/pages/CMDBExplorer.tsx` — Removed `onSiteClick` and `onNavigateToTopology` props
- `ui/src/api/client.ts` — `getSiteTopology()`, `getSiteOverview()` methods
- `core_platform/routers/cmdb.py` — `/sites/{name}/overview`, `/sites/{name}/map-data` endpoints

### What Changed (Aug 20)
- GeoMap rewritten with focused site drill-down mode
- Overlay positioned via `map.latLngToContainerPoint()` for pixel-perfect alignment
- `SITE_RADIUS_METERS = 800` for the circle
- Deleted orphaned `SiteGeoMap.tsx` and `.part1` files
- Fixed 500 errors from DCRoom import bug

---

## Item 3: Documentation Page ✅ COMPLETED

**Goal:** Add a `/docs` page explaining all project capabilities.

### Files Created
- `ui/src/pages/Docs.tsx` — 390-line comprehensive documentation page

### Content Structure
13 sections: Overview, Getting Started, Dashboard, CMDB Explorer, Geo Map, NOC Alerts, AI Chatbot, DC Explorer, Agent Monitor, System Health, Architecture, API Reference, Deployment

### What Changed (Aug 20)
- Created sidebar-based docs navigation with 13 sections
- Dark theme consistent with the app
- ASCII architecture diagram
- Code blocks with API endpoints
- **Text color fix:** Changed body text from `text-gray-300` → `text-gray-200`, nav items from `text-gray-400` → `text-gray-300` for better readability

---

## Item 4: SRE Deep Dive Improvements ✅ COMPLETED

### 4A: Critical Quick Wins

| # | Fix | File | Status |
|---|-----|------|--------|
| 1 | Fix `time.sleep()` → `asyncio.sleep()` | `plugins/generator/otel_emitter.py` | ✅ Done |
| 2 | Add security headers to nginx | `ui/nginx.conf` | ✅ Done |
| 3 | Add Redis password to docker-compose | `docker-compose.yml` | ✅ Done |
| 4 | Add DB check to health endpoint | `core_platform/routers/health.py` | ✅ Done |
| 5 | Add Cache-Control headers to topology endpoints | `core_platform/routers/cmdb.py` | ✅ Done |

### 4B: Architecture Fixes

| # | Fix | File(s) | Status |
|---|-----|---------|--------|
| 6 | Fix httpx connection pooling in proxy | `core_platform/main.py` | ✅ Done |
| 7 | Add proxy request timeouts | `core_platform/main.py` | ✅ Done |
| 8 | Fix ApprovalManager to read from Redis | `plugins/chatbot/approval.py` | ✅ Done |
| 9 | Fix unbounded list in agent-monitor | `plugins/agent_monitor/router.py` | ✅ Done |
| 10 | Add ErrorBoundary to React app | `ui/src/App.tsx` | ✅ Done |
| 11 | Wire Dashboard stats to real APIs | `ui/src/pages/Dashboard.tsx` | ✅ Done |
| 12 | Wire edge health to real alert data | `ui/src/components/TopologyGraph.tsx` | ✅ Done |
| 13 | Wire NodeDetailPanel alerts to real data | `ui/src/components/NodeDetailPanel.tsx` | ✅ Done |

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

## Execution Status

### Wave 1 ✅ Quick Wins + Geo Map Backend
### Wave 2 ✅ Geo Map Frontend + Docs
### Wave 3 ✅ Architecture Fixes + Dashboard
### Wave 4 ✅ Rebuild & Verify
### Wave 5 (Current) — Bug Fixes & Polish
- [x] Fix geo map flow lines (curved polylines, not static SVG markers)
- [x] Fix docs text colors (too dim on dark background)
- [ ] Commit & push all changes
