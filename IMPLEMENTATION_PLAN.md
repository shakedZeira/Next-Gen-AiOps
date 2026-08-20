# Implementation Plan: Realistic Network Topologies, Device Icons & System Health

## Overview
Enhance the CMDB and topology visualization with realistic network topologies, Lucide SVG device icons, per-site views, and a new system health monitoring tab. Each task uses dedicated sub-agents for parallel execution.

---

## Task 1: Add Site/Location Concept to Data Models

### Sub-Agent: Backend Data Model Agent
**Type:** `general`
**Purpose:** Update CI model, schemas, repository, and API endpoints with site/location support

**Responsibilities:**
- Add `site`, `site_type`, `network_layer`, `topology_type` fields to CI model
- Update Pydantic schemas for CI creation and response
- Implement site-based query methods in repository
- Create new API endpoints for site topology

**Files to Modify:**
- `aiops_shared/models/ci.py` - Add site fields to CI model
- `core_platform/cmdb/schemas.py` - Update CICreate, CIResponse schemas
- `core_platform/cmdb/repository.py` - Add get_site_topology(), get_inter_site_connections(), get_all_sites()
- `core_platform/routers/cmdb.py` - Add GET /sites, GET /topology/site/{site}, GET /topology/inter-site

**New Fields for CI Model:**
```python
site = Column(String, nullable=True, index=True)
site_type = Column(String, nullable=True)  # hq, dc, regional_hub, large_branch, small_branch
network_layer = Column(String, nullable=True)  # access, distribution, core, wan_edge
topology_type = Column(String, nullable=True)  # ring, hub_and_spoke, hierarchical, mesh
```

**New API Endpoints:**
```
GET /api/v1/cmdb/sites                    - List all sites with device counts
GET /api/v1/cmdb/topology/site/{site_name} - Topology for specific site
GET /api/v1/cmdb/topology/inter-site       - Inter-site connections
```

---

## Task 2: Create Realistic Topology Seed Data

### Sub-Agent: Seed Data Agent
**Type:** `general`
**Purpose:** Create 5 realistic sites with proper network topologies and inter-site connections

**Responsibilities:**
- Design and implement 5 site topologies based on research
- Create realistic CI entries with site attributes
- Define relationships matching real network patterns
- Add inter-site WAN/SD-WAN connections

**Sites to Create:**

### Site 1: Global HQ (Three-Tier Hierarchical)
```
                    [core-sw-1]----[core-sw-2]
                   /              \
            [dist-sw-1a]      [dist-sw-2a]
           / | \ \            / | \ \
     [acc-1]...[acc-4]   [acc-5]...[acc-8]
         |           |         |          |
     [servers]   [servers] [servers]  [servers]
```
- 2 core switches (paired, Cisco Catalyst 9600)
- 4 distribution switches (2 pairs, Cisco Catalyst 9500)
- 8 access switches (Cisco Catalyst 9300)
- 2 WAN edge routers (Cisco CSR 1000v)
- 2 firewalls (Palo Alto PA-5200)
- Physical servers, containers, pods

### Site 2: Regional DC (Hub-and-Spoke Hub)
- Core switches connecting to WAN
- Distribution layer for server farms
- Load balancers (F5 BIG-IP)
- Storage arrays (NetApp)
- Database servers

### Site 3: Metro Ring (ERPS Ring)
- 6 switches in ring topology (Juniper EX4400)
- RPL between designated nodes
- Sub-ring for access layer
- PE routers at ring edge

### Site 4: Large Branch (Collapsed Core)
- 2 distribution/core switches (collapsed, Cisco Catalyst 9400)
- 4 access switches
- Local servers
- SD-WAN edge (Cisco Viptela)

### Site 5: Small Branch
- 1 switch (Cisco Catalyst 9200)
- 1 router/SD-WAN edge
- Local server

**Inter-Site Connections:**
- MPLS links between HQ and Regional DC
- SD-WAN tunnels from branches to hubs
- VPN connections for backup
- Dark fiber between HQ and Regional DC

**File:** `db/seed.py`

---

## Task 3: CMDB Topology Visualization per Site

### Sub-Agent: Frontend Topology Agent
**Type:** `general`
**Purpose:** Update TopologyGraph and CMDBExplorer with site filtering and toggle

**Responsibilities:**
- Add site selector dropdown to CMDBExplorer
- Implement toggle between detailed and aggregated views
- Add site boundary visualization
- Style inter-site connections differently

**Files to Modify:**
- `ui/src/types/index.ts` - Add SiteInfo, SiteTopology interfaces
- `ui/src/api/client.ts` - Add getSites(), getSiteTopology(), getInterSiteTopology()
- `ui/src/components/TopologyGraph.tsx` - Add siteFilter, showInterSite props
- `ui/src/pages/CMDBExplorer.tsx` - Add site selector and toggle UI

**UI Features:**
1. **Site Selector**: Dropdown to select specific site or "All Sites"
2. **View Toggle**:
   - "Detailed View": Show all devices within selected site
   - "Aggregated View": Show site as single node with connections
3. **Site Boundaries**: Visual grouping of nodes by site (colored backgrounds/borders)
4. **Inter-Site Links**: Special edge styling for WAN/MPLS connections with metrics

**New Interfaces:**
```typescript
interface SiteInfo {
  name: string;
  site_type: string;
  device_count: number;
  topology_type: string;
}

interface SiteTopology {
  site: SiteInfo;
  nodes: Array<{id: string; name: string; type: string; team?: string}>;
  edges: Array<{source: string; target: string; type: string}>;
}

interface InterSiteConnection {
  source_site: string;
  target_site: string;
  connection_type: string; // mpls, sdwan, vpn, dark_fiber
  bandwidth: string;
  latency_ms: number;
  status: string;
}
```

---

## Task 4: Device Icons Integration (Lucide)

### Sub-Agent: Icons Integration Agent
**Type:** `general`
**Purpose:** Integrate Lucide SVG icons into Cytoscape.js topology visualization

**Responsibilities:**
- Create device icon mapping using Lucide SVGs
- Update TopologyGraph to use background-image with SVG icons
- Optimize with memoization and data URIs
- Maintain existing color/shape differentiation

**Icon Mapping:**
```typescript
const DEVICE_ICONS: Record<string, string> = {
  // Network devices
  router:           'https://unpkg.com/lucide-static@latest/icons/router.svg',
  switch:           'https://unpkg.com/lucide-static@latest/icons/network.svg',
  firewall:         'https://unpkg.com/lucide-static@latest/icons/shield.svg',
  load_balancer:    'https://unpkg.com/lucide-static@latest/icons/arrows-up-down.svg',
  
  // Servers & Compute
  physical_server:  'https://unpkg.com/lucide-static@latest/icons/server.svg',
  host:             'https://unpkg.com/lucide-static@latest/icons/server.svg',
  container:        'https://unpkg.com/lucide-static@latest/icons/container.svg',
  pod:              'https://unpkg.com/lucide-static@latest/icons/package.svg',
  
  // Data & Storage
  database:         'https://unpkg.com/lucide-static@latest/icons/database.svg',
  storage:          'https://unpkg.com/lucide-static@latest/icons/hard-drive.svg',
  cache:            'https://unpkg.com/lucide-static@latest/icons/database-zap.svg',
  message_queue:    'https://unpkg.com/lucide-static@latest/icons/mail.svg',
  
  // Application
  api_gateway:      'https://unpkg.com/lucide-static@latest/icons/globe.svg',
  microservice:     'https://unpkg.com/lucide-static@latest/icons/layers.svg',
};
```

**Cytoscape.js Styling:**
```typescript
{
  selector: 'node',
  style: {
    'background-image': (ele) => getIconForType(ele.data('type')),
    'background-width': '60%',
    'background-height': '60%',
    'background-fit': 'contain',
    'background-color': '#1e293b',
    'border-width': 2.5,
    'border-color': (ele) => NODE_COLORS[ele.data('type')],
    'label': 'data(label)',
    'text-wrap': 'wrap',
    'text-max-width': '110px',
    'color': '#e2e8f0',
    'font-size': '10px',
    'text-outline-color': '#0f172a',
    'text-outline-width': 1.5,
    'text-valign': 'bottom',
    'text-margin-y': -5,
    width: 56,
    height: 56,
  }
}
```

**Performance Optimizations:**
- Memoize SVG data URI generation
- Use URL-encoding (not Base64) for inline SVGs
- Cache icon lookups per node type

**File:** `ui/src/components/TopologyGraph.tsx`

---

## Task 5: System Health Monitoring Tab

### Sub-Agent: System Health Agent
**Type:** `general`
**Purpose:** Create new System Health page with system flow diagram and component health

**Responsibilities:**
- Create SystemHealth page component
- Build SystemFlowDiagram component
- Create ComponentHealthCard component
- Add navigation item and route

**New Files:**
- `ui/src/pages/SystemHealth.tsx` - Main page
- `ui/src/components/SystemFlowDiagram.tsx` - System architecture visualization
- `ui/src/components/ComponentHealthCard.tsx` - Individual component health

**Files to Modify:**
- `ui/src/components/Sidebar.tsx` - Add "System Health" nav item
- `ui/src/App.tsx` - Add route `/system-health`

**System Architecture to Display:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AIOps System Architecture                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  Data Sources │    │   Ingestion  │    │  Processing  │                  │
│  │  ──────────── │    │  ─────────── │    │  ─────────── │                  │
│  │  OTel Agents  │───▶│    Kafka     │───▶│    Spark     │                  │
│  │  Log Shippers │    │  Event Hub   │    │   Flink      │                  │
│  │  SNMP Traps   │    │   Webhooks   │    │  ML Pipeline │                  │
│  │  API Polling  │    │              │    │ Alert Engine │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                               │                             │
│                                               ▼                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │Visualization │◀───│   Storage    │◀───│   Analytics  │                  │
│  │  ─────────── │    │  ─────────── │    │  ─────────── │                  │
│  │   React UI   │    │  PostgreSQL  │    │   Grafana    │                  │
│  │  API Gateway │    │    Redis     │    │  Prometheus  │                  │
│  │  WebSocket   │    │Elasticsearch │    │   Jaeger     │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Component Health Display:**
Each component shows:
- Name and description
- Status badge (healthy/degraded/down)
- Uptime percentage
- Latency (ms)
- Throughput (req/s or events/s)
- Error rate (%)
- Last checked timestamp

**Real-time Updates:**
- WebSocket connection for live health data
- Auto-refresh every 30 seconds
- Visual indicators for state changes

**Backend Endpoints (if needed):**
```
GET /api/v1/system/health      - Overall system health
GET /api/v1/system/flow        - Data flow status
GET /api/v1/system/components  - Individual component health
```

---

## Task 6: Skills Integration

### Sub-Agent: Skills Coordinator Agent
**Type:** `general`
**Purpose:** Load and apply relevant skills during implementation

**Skills to Use:**
1. **aiops-architect** - Review topology design and data model changes
2. **fullstack-api** - Implement backend API endpoints and repository methods
3. **devops-observability** - Design system health monitoring approach
4. **qa-test-engineer** - Create tests for new topology features
5. **docs-writer** - Document new API endpoints and topology features

**Usage Pattern:**
- Load skill at start of relevant task
- Follow skill guidance for implementation
- Apply best practices from skill

---

## Implementation Order with Sub-Agents

### Phase 1: Data Model & Seed Data (Parallel)

**Sub-Agent 1: Backend Data Model Agent**
- Task: Update CI model with site fields
- Output: Modified model, schemas, repository, API

**Sub-Agent 2: Seed Data Agent**
- Task: Create 5 realistic site topologies
- Output: Updated seed.py with complete site data

**Dependencies:** Sub-Agent 2 depends on Sub-Agent 1 (needs updated model)

### Phase 2: Topology Visualization (Parallel)

**Sub-Agent 3: Icons Integration Agent**
- Task: Integrate Lucide SVG icons into TopologyGraph
- Output: Updated TopologyGraph with device icons

**Sub-Agent 4: Frontend Topology Agent**
- Task: Add site filtering and toggle to CMDBExplorer
- Output: Updated CMDBExplorer with site selector

**Dependencies:** Sub-Agent 3 and 4 can run in parallel

### Phase 3: System Health Tab (Independent)

**Sub-Agent 5: System Health Agent**
- Task: Create SystemHealth page and components
- Output: New page, components, navigation update

**Dependencies:** None (can run in parallel with Phase 2)

### Phase 4: Testing & Integration (Sequential)

**Sub-Agent 6: QA Test Agent**
- Task: Write tests for all new features
- Output: Test files for site topology, icons, system health

**Dependencies:** Depends on Phases 1-3 completion

---

## Sub-Agent Task Assignments

### Sub-Agent 1: Backend Data Model Agent
```
Type: general
Prompt: "Update the CI data model to support site/location. 
1. Add site, site_type, network_layer, topology_type fields to aiops_shared/models/ci.py
2. Update core_platform/cmdb/schemas.py with new fields
3. Add get_site_topology(), get_inter_site_connections(), get_all_sites() to repository
4. Add GET /sites, GET /topology/site/{site}, GET /topology/inter-site endpoints
5. Follow existing code patterns and conventions"
```

### Sub-Agent 2: Seed Data Agent
```
Type: general
Prompt: "Create realistic network topology seed data with 5 sites:
1. Global HQ - Three-tier hierarchical (2 core, 4 dist, 8 access)
2. Regional DC - Hub-and-spoke hub
3. Metro Ring - ERPS ring topology (6 switches)
4. Large Branch - Collapsed core
5. Small Branch - Simple setup
Add inter-site connections (MPLS, SD-WAN, VPN).
Update db/seed.py with complete CI and relationship data."
```

### Sub-Agent 3: Icons Integration Agent
```
Type: general
Prompt: "Integrate Lucide SVG icons into TopologyGraph.tsx:
1. Create DEVICE_ICONS mapping using Lucide CDN URLs
2. Update Cytoscape stylesheet to use background-image with SVGs
3. Add memoization for performance
4. Maintain existing color/shape differentiation
5. Test that icons load and display correctly"
```

### Sub-Agent 4: Frontend Topology Agent
```
Type: general
Prompt: "Add site filtering and toggle to CMDBExplorer:
1. Add site selector dropdown
2. Implement toggle between detailed and aggregated views
3. Add site boundary visualization
4. Style inter-site connections with metrics
5. Update API client with site endpoints"
```

### Sub-Agent 5: System Health Agent
```
Type: general
Prompt: "Create System Health monitoring page:
1. Create SystemHealth.tsx page with system flow diagram
2. Create SystemFlowDiagram.tsx component
3. Create ComponentHealthCard.tsx component
4. Add 'System Health' to Sidebar navigation
5. Add route /system-health to App.tsx
6. Display all system components with real-time health status"
```

### Sub-Agent 6: QA Test Agent
```
Type: general
Prompt: "Write tests for new topology features:
1. Test site filtering in TopologyGraph
2. Test site selector in CMDBExplorer
3. Test device icon rendering
4. Test SystemHealth page rendering
5. Test API endpoints for site topology"
```

---

## File Changes Summary

### Backend Files
- `aiops_shared/models/ci.py` - Add site fields
- `core_platform/cmdb/schemas.py` - Update schemas
- `core_platform/cmdb/repository.py` - Add site methods
- `core_platform/routers/cmdb.py` - Add site endpoints
- `db/seed.py` - Add realistic topology data

### Frontend Files
- `ui/src/types/index.ts` - Add site types
- `ui/src/api/client.ts` - Add site API methods
- `ui/src/components/TopologyGraph.tsx` - Icons + site filtering
- `ui/src/pages/CMDBExplorer.tsx` - Site selector + toggle
- `ui/src/pages/SystemHealth.tsx` - New page
- `ui/src/components/SystemFlowDiagram.tsx` - New component
- `ui/src/components/ComponentHealthCard.tsx` - New component
- `ui/src/components/Sidebar.tsx` - Add nav item
- `ui/src/App.tsx` - Add route

---

## Success Criteria

1. ✅ CMDB displays 5 realistic sites with proper network topologies
2. ✅ Each site shows correct topology (ring, hierarchical, hub-and-spoke)
3. ✅ Toggle between detailed view and aggregated site-as-node view
4. ✅ Device icons use Lucide SVGs (ServiceNow ITOM style)
5. ✅ New System Health tab shows system flow and component health
6. ✅ All existing tests pass
7. ✅ No TypeScript errors
8. ✅ Sub-agents execute tasks in parallel where possible

---

## Estimated Timeline

| Phase | Duration | Sub-Agents |
|-------|----------|------------|
| Phase 1: Data Model & Seed | 15 min | 2 agents (sequential) |
| Phase 2: Topology Viz | 20 min | 2 agents (parallel) |
| Phase 3: System Health | 15 min | 1 agent |
| Phase 4: Testing | 10 min | 1 agent |
| **Total** | **60 min** | **6 agents** |
