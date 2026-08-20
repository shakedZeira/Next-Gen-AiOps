# Implementation Plan: Phase 2 — Enhanced Features

## Overview
6 new features building on top of the completed CMDB topology system. Each feature is self-contained and can be implemented via sub-agents in parallel.

---

## Feature 1: Aggregated Site-Level Topology ("All Sites" Tab)

### Problem
When "All Sites" is selected in the CMDB Explorer, the topology shows ALL 105 nodes and 123 edges. The user wants a clean site-as-node abstraction.

### Design
- **Backend**: New endpoint `GET /api/v1/cmdb/topology/site-aggregate` that returns:
  - 5 nodes (one per site) with metadata: `device_count`, `topology_type`, `site_type`
  - Inter-site edges derived from cross-site relationships
- **Frontend**: When "All Sites" + "Site Overview" view is active, use the aggregated topology instead of global topology
- **Node rendering**: Each site node shows the site name, device count badge, and topology type icon
- **Edge rendering**: Inter-site connections show connection type (MPLS/SD-WAN/VPN) with bandwidth/latency labels

### Files
- `core_platform/cmdb/repository.py` — Add `get_site_aggregate_topology()` method
- `core_platform/routers/cmdb.py` — Add `GET /topology/site-aggregate` endpoint
- `ui/src/types/index.ts` — Add `SiteAggregateTopology` interface
- `ui/src/api/client.ts` — Add `getSiteAggregateTopology()` method
- `ui/src/pages/CMDBExplorer.tsx` — Use aggregated topology when in Site Overview mode
- `ui/src/components/TopologyGraph.tsx` — Add `siteAggregate` mode with site-node styling

---

## Feature 2: Alert NOC Filter Buttons

### Problem
The status filter buttons (Active/Acknowledged/Resolved) appear non-functional. Root cause: demo data doesn't respond to filtering, and the acknowledge/resolve actions only update local state without calling the backend.

### Design
- **Make filters work on demo data**: Apply client-side filtering to `DEMO_ALERTS` when API is unavailable
- **Wire acknowledge/resolve to backend**: Call `alertsAPI.acknowledge()` and `alertsAPI.resolve()` before updating local state
- **Visual feedback**: Show toast/snackbar on successful action

### Files
- `ui/src/pages/NOCAlerts.tsx` — Fix filter logic to apply client-side filtering, wire action handlers to API

---

## Feature 3: Chatbot Enhancements — Chat History + Remediation UI

### Problem
1. Chat messages lost on page refresh (React state only)
2. Chatbot responses are terse — not "chatty"
3. Remediation approval flow exists in backend but UI doesn't show pending approvals properly

### Design

#### 3a: Chat Persistence (localStorage)
- On message send, persist full message array to `localStorage.setItem('chat_history', JSON.stringify(messages))`
- On mount, load from localStorage
- Add "Clear Chat" button
- Add thread management: sidebar list of saved conversations with timestamps

#### 3b: More Conversational Agent
- Update `plugins/chatbot/agent.py` system prompt to be more conversational
- Add context-aware responses: reference CMDB data, alert counts, topology info
- Add suggestion chips after responses ("Show me alerts", "Check topology", "Run diagnostics")

#### 3c: Remediation UI
- The `ApprovalQueue` component exists but receives empty `approvals` array
- Poll `chatbotAPI.pendingApprovals()` on interval and display in the approval panel
- Show remediation suggestions in chat as interactive cards (not just text)
- When agent suggests a fix, render as a clickable card with "Approve" / "Reject" buttons

### Files
- `plugins/chatbot/agent.py` — Improve system prompt, add CMDB context
- `plugins/chatbot/router.py` — Add `GET /history/{thread_id}` endpoint (returns from MemorySaver)
- `ui/src/pages/ChatBot.tsx` — Add localStorage persistence, thread list, suggestion chips, approval polling
- `ui/src/components/ApprovalQueue.tsx` — Style approval cards with remediation details

---

## Feature 4: Node Drill-Down Panel

### Problem
No way to click a node and see detailed information about it.

### Design
- **Click handler on Cytoscape nodes**: When a node is clicked, emit event to React
- **Slide-out panel**: Right-side panel (w-96) slides in with:
  - CI name, type, provider, environment, team, site
  - Status badge (mock: healthy/degraded/warning)
  - **Connected devices**: List of direct neighbors with relationship type
  - **Alert history**: Last N alerts for this CI (mock data)
  - **Properties**: All key-value pairs from labels
  - **Quick actions**: "View in topology", "Run diagnostics", "View logs"
- **Backend**: New endpoint `GET /api/v1/cmdb/ci/{ci_id}/details` that returns CI + neighbors + mock alert history
- **Animation**: Panel slides in from right with backdrop overlay

### Files
- `core_platform/cmdb/repository.py` — Add `get_ci_details(ci_id)` method (CI + neighbors)
- `core_platform/routers/cmdb.py` — Add `GET /ci/{ci_id}/details` endpoint
- `ui/src/types/index.ts` — Add `CIDetails` interface
- `ui/src/api/client.ts` — Add `getCIDetails(ciId)` method
- `ui/src/components/NodeDetailPanel.tsx` — **New**: Slide-out panel component
- `ui/src/components/TopologyGraph.tsx` — Add `onNodeClick` callback prop
- `ui/src/pages/CMDBExplorer.tsx` — Wire node click to panel state

---

## Feature 5: Data Center / Room Layout Visualization

### Problem
No visualization of physical DC layout (rooms, racks, equipment positions).

### Design

#### 5a: Backend Data Model
- New DB tables: `dc_room`, `dc_rack`, `dc_rack_equipment`
- Seed data for each site with realistic layouts:
  - **HQ DC**: 2 rooms (DC1, DC2), 20 racks each, spine-leaf fabric
  - **Regional DC**: 1 room, 8 racks, collapsed spine
  - **Metro Ring**: 1 wiring closet, 2 racks
  - **Branch NYC**: 1 room, 3 racks
  - **Branch London**: 1 closet, 1 rack

#### 5b: DC Room Hierarchy
```
Site -> Room -> Row -> Rack -> U-Position -> Equipment
```

Rack layout per facility type:
- **HQ DC (Tier III/IV)**: Spine switches (4), leaf switches (2/rack), 20-30 servers/rack, dual PDUs, patch panels
- **Regional DC (Tier II/III)**: 4 spines, 2 leaves/rack, 15-20 servers/rack
- **Branch**: Collapsed core, 2-4 switches, 0-2 servers

#### 5c: Room Overview Page
- Visual grid of racks in a room (like DCIM view)
- Each rack shows: fill %, power draw, temperature, status color
- Click rack -> drill into U-position view

#### 5d: Rack Elevation View
- Vertical 42U rack visualization
- Each U slot colored by equipment type
- Hover shows: device name, model, IPs
- Side panels show: power (left PDU), network (right PDU)

### Files
- `aiops_shared/models/dc.py` — **New**: SQLAlchemy models for Room, Rack, RackEquipment
- `db/init.sql` — Add dc_room, dc_rack, dc_rack_equipment tables
- `db/seed.py` — Add DC room/rack seed data per site
- `core_platform/cmdb/schemas.py` — Add DC-related Pydantic schemas
- `core_platform/cmdb/repository.py` — Add DC query methods
- `core_platform/routers/cmdb.py` — Add DC endpoints
- `ui/src/types/index.ts` — Add DC types
- `ui/src/api/client.ts` — Add DC API methods
- `ui/src/pages/DCExplorer.tsx` — **New**: Room overview + rack elevation page
- `ui/src/components/RackVisualization.tsx` — **New**: 42U rack elevation component
- `ui/src/components/Sidebar.tsx` — Add "DC Explorer" nav item
- `ui/src/App.tsx` — Add `/dc-explorer` route

---

## Feature 6: Direct Connections Map

### Problem
No way to click a device and see a focused view of everything directly connected to it.

### Design
- **Click "Connections" button** in the Node Detail Panel (Feature 4)
- **New visualization**: Center node at the middle, direct neighbors radiating outward
- **Edge labels**: Show relationship type (depends_on, connects_to, hosts, etc.)
- **Node coloring**: By type (router=orange, switch=teal, server=blue, etc.)
- **Backend**: Uses same `get_ci_details` endpoint from Feature 4 (returns neighbors list)
- **Frontend**: Dedicated Cytoscape layout (circle/breadthfirst) with center node highlighted

### Files
- `ui/src/components/ConnectionsMap.tsx` — **New**: Focused neighbor visualization
- `ui/src/components/NodeDetailPanel.tsx` — Add "View Connections" button
- `ui/src/pages/CMDBExplorer.tsx` — Add connections view state/toggle

---

## Execution Order

### Phase A: Quick Fixes (Features 2 + 3) — Parallel
- Feature 2: Alert NOC filter fix
- Feature 3: Chatbot enhancements

### Phase B: Topology Enhancements (Features 1 + 6) — Parallel  
- Feature 1: Aggregated site topology
- Feature 6: Direct connections map

### Phase C: Interactive Features (Feature 4)
- Feature 4: Node drill-down panel

### Phase D: DC Layout (Feature 5)
- Feature 5: DC room/rack visualization

### Phase E: Rebuild & Test
- Rebuild Docker containers
- Verify TypeScript compilation
- Test all features
