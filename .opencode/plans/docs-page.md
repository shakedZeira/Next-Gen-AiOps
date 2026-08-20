# Plan: Documentation Page

## Goal
Add a comprehensive `/docs` page explaining every feature, how to use it, the architecture, and the API.

---

## Current State
- No documentation page exists
- No `/docs` route in `App.tsx`
- No nav item in `Sidebar.tsx`
- The only docs are the GitHub CI config and docker-compose.yml

## Target State
- Full `/docs` page with sidebar navigation
- 13 sections covering all features
- Dark theme consistent with the app
- Code examples with syntax highlighting

---

## Files to Create/Modify

### NEW: `ui/src/pages/Docs.tsx`

The main documentation page component. Uses a left sidebar for section navigation and a main content area.

### Modify: `ui/src/App.tsx`

Add route:
```tsx
<Route path="docs" element={<Docs />} />
```

### Modify: `ui/src/components/Sidebar.tsx`

Add nav item:
```tsx
{ to: '/docs', label: 'Documentation', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
```

---

## Documentation Structure

### Section 1: Overview
```
# Next-Gen AiOps Platform

A full-stack AI-powered operations platform for monitoring, managing, and 
automating infrastructure across multi-site environments.

## Architecture
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  React UI   │────▶│  API Gateway │────▶│  PostgreSQL  │
│  (Port 80)  │     │  (Port 8000) │     │  (Port 5432) │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼────┐ ┌────▼─────┐
        │  Chatbot  │ │ Alert  │ │   RCA    │
        │  (8004)   │ │  NOC   │ │  Engine  │
        └───────────┘ │ (8005) │ └──────────┘
                      └────────┘

## Tech Stack
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Cytoscape.js, Leaflet.js
- Backend: Python 3.11+, FastAPI, SQLAlchemy (async), Pydantic v2
- Database: PostgreSQL 16, Redis 7
- AI/ML: LangGraph, Ollama (local LLM)
- Observability: OpenTelemetry, Grafana LGTM
- Deployment: Docker Compose
```

### Section 2: Getting Started
```
## Login
1. Navigate to http://localhost
2. Default credentials:
   - Email: admin@aiops.local
   - Password: admin123
3. Click "Sign in"

## First Steps
- Dashboard shows your infrastructure at a glance
- Use the sidebar to navigate between features
- Start with CMDB Explorer to understand your topology
```

### Section 3: Dashboard
```
## Dashboard
The landing page showing system-wide health.

### Stat Cards
- Total Sites: Number of monitored sites
- Total CIs: Configuration items in the CMDB
- Active Alerts: Currently active alerts
- System Health: Overall health percentage

### Site Topology
Interactive map showing all 5 sites as nodes. Click a site to drill into CMDB Explorer.
- Node colors indicate topology type (hierarchical, hub-and-spoke, ring)
- Node size indicates device count
```

### Section 4: CMDB Explorer
```
## CMDB Explorer
The core topology visualization tool with 3 view modes.

### View Modes

#### Detailed View
Shows all CIs and relationships as an interactive graph.
- Nodes colored by type (switch, router, firewall, etc.)
- Edges show relationship types
- Click any node for details
- Filter by site and service flow

#### Site Overview
High-level view of all 5 sites with aggregate topology.
- Click a site to see its summary (devices, racks, teams)
- "View Full Topology" button to drill into detailed view

#### Geo Map
Geographic visualization of all sites on a world map.
- Colored markers by site type
- Connection lines between sites
- Click markers for site details
- Click "View Site Map" for indoor visualization
```

### Section 5: Geo Map
```
## Geographic Map
Leaflet-based dark-theme map showing infrastructure geographically.

### Global Map
- 5 site markers colored by type (HQ=blue, DC=purple, Large Branch=green, Small Branch=orange)
- Dashed connection lines colored by type (MPLS=blue, SD-WAN=green, VPN=orange)
- Hover for site details, click for popup with full info

### Traffic Flows
Toggle animated flow lines showing real-time traffic:
- Line color = health status (green/yellow/red)
- Line thickness = utilization level
- Animated dashes show flow direction
- Hover for bandwidth, latency, utilization details

### Site Map
Click any site marker to zoom into a street-level view:
- Building markers for DC rooms
- Device markers for key CIs (routers, firewalls, switches)
- Click room → navigate to DC Explorer
- Click CI → popup with device details
```

### Section 6: NOC Alerts
```
## NOC Alert Console
Real-time alert management interface.

### Filtering
- By status: All, Active, Acknowledged, Resolved
- By team: All, Frontend, Backend, Payments, Data, Platform, Security, SRE, Network

### Alert Actions
- Acknowledge: Mark alert as seen by an operator
- Resolve: Mark alert as fixed

### Alert Groups
Alerts are grouped by service and severity for easier triage.
```

### Section 7: AI Chatbot
```
## AiOps Chat
AI-powered assistant for infrastructure queries.

### How to Use
Type natural language questions about your infrastructure:
- "Show me current alerts" → Alert summary
- "What's the system health status?" → Health overview
- "Check the network topology" → Topology info
- "Run diagnostics on Payment Gateway" → Diagnostic report
- "Show me the CMDB overview" → Service/CI inventory

### Suggestion Chips
Quick-start buttons for common queries. Click any to auto-send.

### Thread Management
- Chat history persists in localStorage
- Create new threads from the sidebar
- Previous conversations are listed for easy access

### Approval Queue
When the AI suggests a fix, it appears in the approval queue:
- Review the proposed change
- Approve to execute, or Reject to cancel
- All actions require human confirmation
```

### Section 8: DC Explorer
```
## Data Center Explorer
Physical infrastructure visualization.

### Room View
Grid of DC rooms showing:
- Room type (Data Center, Wiring Closet, Meet-Me Room)
- Tier rating (1-3)
- Number of racks
- Power capacity (kW)
- Cooling type
- PUE target

### Rack View
Visual grid of racks within a room, organized by row:
- Color-coded fill level (green < 60%, yellow 60-85%, red > 85%)
- Temperature display per rack
- Click any rack for detailed view

### 42U Elevation
Interactive rack diagram showing:
- Equipment by U-position (1-42)
- Equipment type, manufacturer, model
- Power consumption per device
- Management IP addresses
- Status indicators
```

### Section 9: Agent Monitor
```
## Agent Monitor
LLM usage and model health tracking.

### Request Statistics
- Total requests processed
- Input/output token counts
- Total cost in USD
- Average latency

### Model Health
Per-model metrics:
- Request count
- Error rate
- P50/P99 latency
- Tokens per minute
- Cost per hour
- Status (healthy/degraded/down)
```

### Section 10: System Health
```
## System Health
Infrastructure component monitoring.

### Components Tracked
- Network devices (routers, switches, firewalls)
- Compute (servers, containers, pods)
- Storage (SAN, NAS, object storage)
- Database (PostgreSQL, Redis)
- Application services (all 8 microservices)

### Status Indicators
- Green: Healthy, responding within thresholds
- Yellow: Degraded, elevated latency or error rate
- Gray: No data available
```

### Section 11: Architecture
```
## Architecture Deep Dive

### Database Schema
- ci: 105 configuration items with JSONB labels
- relationship: 123 CI-to-CI relationships with recursive CTE traversal
- service: 8 services with SLA tiers
- alert: Alert management with severity/status lifecycle
- dc_room/dc_rack/dc_rack_equipment: Physical DC hierarchy

### Microservices
| Service | Port | Purpose |
|---------|------|---------|
| api-gateway | 8000 | Core API, auth, CMDB CRUD |
| chatbot | 8004 | LangGraph AI agent |
| alert-noc | 8005 | Alert management |
| rca-engine | - | Root cause analysis |
| agent-monitor | - | LLM usage tracking |
| generator | - | Synthetic data generation |
| infra-simulator | - | Infrastructure simulation |

### Key Patterns
- Repository Pattern for DB access
- API Gateway with reverse proxy for microservices
- Human-in-the-loop approval workflow
- Recursive CTE for graph traversal
- JWT authentication with refresh tokens
```

### Section 12: API Reference
```
## API Reference

### Authentication
POST /auth/login
POST /auth/refresh
GET /auth/me

### CMDB
GET    /api/v1/cmdb/ci                    - List all CIs
GET    /api/v1/cmdb/ci/{id}               - Get CI by ID
GET    /api/v1/cmdb/ci/{id}/details       - Get CI with neighbors
POST   /api/v1/cmdb/ci                    - Create CI
GET    /api/v1/cmdb/sites                 - List sites with counts
GET    /api/v1/cmdb/sites/locations       - Site coordinates
GET    /api/v1/cmdb/topology/all          - Full global topology
GET    /api/v1/cmdb/topology/site/{name}  - Site-specific topology
GET    /api/v1/cmdb/topology/site-aggregate - 5-node aggregate view
GET    /api/v1/cmdb/topology/inter-site   - Inter-site connections
GET    /api/v1/cmdb/impact/{ci_id}        - Downstream impact analysis

### DC Explorer
GET    /api/v1/cmdb/dc/rooms              - List rooms (filter by site)
GET    /api/v1/cmdb/dc/rooms/{id}         - Get room details
GET    /api/v1/cmdb/dc/rooms/{id}/racks   - Get racks in room
GET    /api/v1/cmdb/dc/racks/{id}/equipment - Get equipment in rack

### Alerts
GET    /api/v1/alerts                     - List alerts
POST   /api/v1/alerts                     - Create alert
POST   /api/v1/alerts/{id}/acknowledge    - Acknowledge alert
POST   /api/v1/alerts/{id}/resolve        - Resolve alert

### Chatbot
POST   /api/v1/chatbot/chat               - Send message
GET    /api/v1/chatbot/history/{thread}   - Get chat history
GET    /api/v1/chatbot/approvals/pending  - List pending approvals
POST   /api/v1/chatbot/approvals/{id}     - Approve/reject
```

### Section 13: Deployment
```
## Deployment

### Prerequisites
- Docker and Docker Compose v2+
- 8GB RAM minimum (16GB recommended for Ollama)

### Quick Start
docker compose up -d

### Services
12 containers total:
- postgres (16), redis (7), ollama (latest)
- api-gateway, chatbot, alert-noc, rca-engine
- agent-monitor, generator, infra-simulator
- ui (nginx), otel-lgtm (grafana)

### Environment Variables
JWT_SECRET_KEY, POSTGRES_PASSWORD, REDIS_PASSWORD

### Data Persistence
- postgres_data: PostgreSQL data volume
- ollama_data: Ollama model storage

### Troubleshooting
- Check logs: docker compose logs -f [service]
- Rebuild: docker compose build --no-cache [service]
- Reset DB: docker compose down -v && docker compose up -d
```

---

## Implementation Steps

### Step 1: Create component
1. Create `ui/src/pages/Docs.tsx` with all 13 sections
2. Use a `useState` for active section tracking
3. Implement sidebar nav with smooth scroll

### Step 2: Wire into app
4. Add `/docs` route to `App.tsx`
5. Add "Documentation" nav item to `Sidebar.tsx`

### Step 3: Build and verify
6. Rebuild UI container
7. Verify all sections render correctly
8. Verify navigation works

---

## Design Notes

- Dark theme (`bg-gray-950` background) to match the app
- Left sidebar with section links (sticky, scrollable)
- Main content area with max-width for readability
- Code blocks with `bg-gray-800` background and monospace font
- Tables with alternating row colors
- Architecture diagrams using ASCII art (rendered in `<pre>` tags)
- No external dependencies needed (pure React + Tailwind)
