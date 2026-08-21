import { useState, useRef } from 'react';

const SECTIONS = [
  { id: 'overview', title: 'Overview' },
  { id: 'getting-started', title: 'Getting Started' },
  { id: 'dashboard', title: 'Dashboard' },
  { id: 'cmdb-explorer', title: 'CMDB Explorer' },
  { id: 'geo-map', title: 'Geographic Map' },
  { id: 'noc-alerts', title: 'NOC Alerts' },
  { id: 'ai-chatbot', title: 'AI Chatbot' },
  { id: 'dc-explorer', title: 'DC Explorer' },
  { id: 'agent-monitor', title: 'Agent Monitor' },
  { id: 'system-health', title: 'System Health' },
  { id: 'architecture', title: 'Architecture' },
  { id: 'api-reference', title: 'API Reference' },
  { id: 'deployment', title: 'Deployment' },
];

export default function Docs() {
  const [activeSection, setActiveSection] = useState('overview');
  const mainRef = useRef<HTMLDivElement>(null);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <nav className="w-64 bg-gray-950 border-r border-gray-800 p-4 overflow-y-auto flex-shrink-0">
        <h2 className="text-lg font-bold text-white mb-4">Documentation</h2>
        <div className="space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSection === s.id
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main ref={mainRef} className="flex-1 overflow-y-auto p-8 bg-gray-950">
        <div className="max-w-4xl mx-auto space-y-16">
          {/* === Section 1: Overview === */}
          <section id="overview">
            <h1 className="text-3xl font-bold text-white mb-4">Next-Gen AiOps Platform</h1>
            <p className="text-gray-200 text-lg mb-6">
              A full-stack AI-powered operations platform for monitoring, managing, and 
              automating infrastructure across multi-site environments.
            </p>
            <h3 className="text-xl font-semibold text-white mb-3">Architecture</h3>
            <pre className="bg-gray-800 p-4 rounded-xl text-sm text-gray-200 overflow-x-auto mb-6">{`
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
            `}</pre>
            <h3 className="text-xl font-semibold text-white mb-3">Tech Stack</h3>
            <ul className="text-gray-200 space-y-2">
              <li><span className="font-medium text-white">Frontend:</span> React 18, TypeScript, Vite, Tailwind CSS, Cytoscape.js, Leaflet.js</li>
              <li><span className="font-medium text-white">Backend:</span> Python 3.11+, FastAPI, SQLAlchemy (async), Pydantic v2</li>
              <li><span className="font-medium text-white">Database:</span> PostgreSQL 16, Redis 7</li>
              <li><span className="font-medium text-white">AI/ML:</span> LangGraph, Ollama (local LLM)</li>
              <li><span className="font-medium text-white">Observability:</span> OpenTelemetry, Grafana LGTM</li>
              <li><span className="font-medium text-white">Deployment:</span> Docker Compose (12 services)</li>
            </ul>
          </section>

          {/* === Section 2: Getting Started === */}
          <section id="getting-started">
            <h2 className="text-2xl font-bold text-white mb-4">Getting Started</h2>
            <h3 className="text-lg font-semibold text-white mb-2">Login</h3>
            <ol className="text-gray-200 space-y-2 list-decimal list-inside mb-6">
              <li>Navigate to <code className="bg-gray-800 px-2 py-1 rounded text-primary-400">http://localhost</code></li>
              <li>Default credentials: <code className="bg-gray-800 px-2 py-1 rounded text-primary-400">admin@aiops.local</code> / <code className="bg-gray-800 px-2 py-1 rounded text-primary-400">admin123</code></li>
              <li>Click "Sign in"</li>
            </ol>
            <h3 className="text-lg font-semibold text-white mb-2">First Steps</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside">
              <li>Dashboard shows your infrastructure at a glance</li>
              <li>Use the sidebar to navigate between features</li>
              <li>Start with CMDB Explorer to understand your topology</li>
            </ul>
          </section>

          {/* === Section 3: Dashboard === */}
          <section id="dashboard">
            <h2 className="text-2xl font-bold text-white mb-4">Dashboard</h2>
            <p className="text-gray-200 mb-4">The landing page showing system-wide health.</p>
            <h3 className="text-lg font-semibold text-white mb-2">Stat Cards</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li><span className="font-medium text-white">Total Sites:</span> Number of monitored sites</li>
              <li><span className="font-medium text-white">Total CIs:</span> Configuration items in the CMDB</li>
              <li><span className="font-medium text-white">Active Alerts:</span> Currently active alerts</li>
              <li><span className="font-medium text-white">System Health:</span> Overall health percentage</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Site Topology</h3>
            <p className="text-gray-200">
              Interactive map showing all 5 sites as nodes. Click a site to drill into CMDB Explorer.
              Node colors indicate topology type (hierarchical, hub-and-spoke, ring). Node size indicates device count.
            </p>
          </section>

          {/* === Section 4: CMDB Explorer === */}
          <section id="cmdb-explorer">
            <h2 className="text-2xl font-bold text-white mb-4">CMDB Explorer</h2>
            <p className="text-gray-200 mb-4">The core topology visualization tool with 4 view modes.</p>
            <h3 className="text-lg font-semibold text-white mb-2">Detailed View</h3>
            <p className="text-gray-200 mb-4">
              Shows all CIs and relationships as an interactive graph. Nodes colored by type (switch, router, firewall, etc.).
              Edges show relationship types. Click any node for details. Filter by site, service, and flow.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Service Filtering</h3>
            <p className="text-gray-200 mb-4">
              When viewing a specific site, a Service dropdown appears showing all services that have CIs
              in that site. Select a service to filter the topology to only show CIs belonging to that
              service. The CI count for each service is displayed in the dropdown. The filter works in
              both Detailed and Site Overview view modes.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">CI Search</h3>
            <p className="text-gray-200 mb-4">
              Real-time text search for filtering CIs by name, type, team, site, or provider.
              Type in the search box in the toolbar to instantly filter the CI list and highlight
              matching nodes in the topology graph with a gold border. Non-matching nodes are dimmed.
              The search is case-insensitive and resets when you change the selected site. The CI list
              shows a "X of Y" count when a search is active.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">IP Address Search</h3>
            <p className="text-gray-200 mb-4">
              Search CIs by IP address using the dedicated IP search input (cyan border, mono font).
              Enter an IP to find CIs by management IP, loopback IP, or subnet containment. Matching
              nodes are highlighted with a cyan border in the topology graph. Non-matching nodes are
              dimmed. IP search is also available as a query parameter on the CI list API.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Site Overview</h3>
            <p className="text-gray-200 mb-4">
              High-level view of all 5 sites with aggregate topology. Each site shows key device type
              counts (routers, switches, firewalls, servers, databases). Click a site for an expandable
              topology view showing only principal devices (routers, switches, firewalls, load balancers).
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Expandable Topology</h3>
            <p className="text-gray-200 mb-4">
              Click any principal device node to expand and reveal its connected child devices
              (servers, databases, etc.) with animated fade-in. Expanded nodes show a "+N" label
              indicating how many children they have. Click again to collapse. Non-principal nodes
              (servers, databases) appear with a cyan border when expanded.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">IP Address Assignment</h3>
            <p className="text-gray-200 mb-4">
              All 105 CIs are automatically assigned IP addresses during seeding using a structured
              scheme per site: 10.site.x.0/24 where x varies by device type (routers=0,
              switches=1, firewalls=2, load_balancers=3, servers=10, databases=20, caches=30,
              message_queues=40, storage=50). Each site gets its own /24 subnet per device type.
              Routers get both management and loopback IPs. Databases get management and loopback IPs. The IP details panel shows management_ip,
              loopback_ip, and subnet in cyan mono font.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Geo Map</h3>
            <p className="text-gray-200 mb-4">
              Geographic visualization of all sites on a world map. Colored markers by site type.
              Connection lines between sites. Click markers for site details. Toggle animated traffic flows showing utilization and health.
              Click "View Site Map" for indoor building-level visualization.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Site Map</h3>
            <p className="text-gray-200">
              Street-level view of a single site. Building markers for DC rooms. Device markers for key CIs.
              Click room → navigate to DC Explorer. Click CI → popup with device details.
            </p>
          </section>

          {/* === Section 5: Geo Map === */}
          <section id="geo-map">
            <h2 className="text-2xl font-bold text-white mb-4">Geographic Map</h2>
            <p className="text-gray-200 mb-4">Leaflet-based dark-theme map showing infrastructure geographically.</p>
            <h3 className="text-lg font-semibold text-white mb-2">Global Map</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li>5 site markers colored by type (HQ=blue, DC=purple, Large Branch=green, Small Branch=orange)</li>
              <li>Dashed connection lines colored by type (MPLS=blue, SD-WAN=green, VPN=orange)</li>
              <li>Hover for site details, click for popup with full info</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Traffic Flows</h3>
            <p className="text-gray-200 mb-4">
              Toggle animated flow lines showing real-time traffic. Line color = health status (green/yellow/red).
              Line thickness = utilization level. Animated dashes show flow direction. Hover for bandwidth, latency, utilization details.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Site Map</h3>
            <p className="text-gray-200">
              Click any site marker to zoom into a street-level view. Building markers for DC rooms.
              Device markers for key CIs (routers, firewalls, switches). Click room → navigate to DC Explorer.
              Click CI → popup with device details.
            </p>
          </section>

          {/* === Section 6: NOC Alerts === */}
          <section id="noc-alerts">
            <h2 className="text-2xl font-bold text-white mb-4">NOC Alert Console</h2>
            <p className="text-gray-200 mb-4">Real-time alert management with deduplication and incident grouping.</p>
            <h3 className="text-lg font-semibold text-white mb-2">Alerts vs Incidents</h3>
            <p className="text-gray-200 mb-4">
              Toggle between individual alerts and grouped incidents. Incidents group related alerts
              by normalized name, service, and severity. Each incident shows the first seen time,
              repeat count, and affected device count.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Alert Deduplication</h3>
            <p className="text-gray-200 mb-4">
              Alerts with the same normalized name (case-punctuated, whitespace-collapsed) within a
              60-second window are deduplicated. The repeat count badge (e.g. "x3") shows how many
              times the alert has recurred since first seen.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Filtering</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li><span className="font-medium text-white">By status:</span> All, Active, Acknowledged, Resolved</li>
              <li><span className="font-medium text-white">By team:</span> All, Frontend, Backend, Payments, Data, Platform, Security, SRE, Network</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Simulate Button</h3>
            <p className="text-gray-200 mb-4">
              Run pre-built failure scenarios to test alert handling. Select a scenario from the
              dropdown (payment-outage, network-failure, disk-exhaustion, cascading-microservice,
              database-failover) and click "Run" to generate a burst of realistic alerts.
              Auto-refreshes every 2 seconds during simulation.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Incidents View</h3>
            <p className="text-gray-200 mb-4">
              Toggle to "Incidents" to see alerts grouped by incident. Each incident shows severity,
              service, alert count, and time range. Click any incident to drill into the detail view
              with a visual timeline showing alert cascade, time deltas between alerts, and individual
              alert status. Bulk acknowledge or resolve all alerts in an incident from the detail view.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Alert Actions</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li><span className="font-medium text-white">Acknowledge:</span> Mark alert as seen by an operator</li>
              <li><span className="font-medium text-white">Resolve:</span> Mark alert as fixed</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Resolve IP Address</h3>
            <p className="text-gray-200">
              The "Resolve IP" button in the toolbar opens a modal to look up which CI owns a given
              IP address. Enter any IP (e.g. 10.0.1.2) and the system checks management_ip, loopback_ip,
              and subnet containment. Results show the matching CI with its type, team, and site. A
              "View in CMDB Explorer" link navigates directly to that CI's topology view.
            </p>
          </section>

          {/* === Section 7: AI Chatbot === */}
          <section id="ai-chatbot">
            <h2 className="text-2xl font-bold text-white mb-4">AiOps Chat</h2>
            <p className="text-gray-200 mb-4">AI-powered assistant for infrastructure queries.</p>
            <h3 className="text-lg font-semibold text-white mb-2">How to Use</h3>
            <p className="text-gray-200 mb-2">Type natural language questions about your infrastructure:</p>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li>"Show me current alerts" → Alert summary</li>
              <li>"What's the system health status?" → Health overview</li>
              <li>"Check the network topology" → Topology info</li>
              <li>"Run diagnostics on Payment Gateway" → Diagnostic report</li>
              <li>"Show me the CMDB overview" → Service/CI inventory</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Suggestion Chips</h3>
            <p className="text-gray-200 mb-4">Quick-start buttons for common queries. Click any to auto-send.</p>
            <h3 className="text-lg font-semibold text-white mb-2">Thread Management</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li>Chat history persists in localStorage</li>
              <li>Create new threads from the sidebar</li>
              <li>Previous conversations are listed for easy access</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Approval Queue</h3>
            <p className="text-gray-200">
              When the AI suggests a fix, it appears in the approval queue. Review the proposed change.
              Approve to execute, or Reject to cancel. All actions require human confirmation.
            </p>
          </section>

          {/* === Section 8: DC Explorer === */}
          <section id="dc-explorer">
            <h2 className="text-2xl font-bold text-white mb-4">Data Center Explorer</h2>
            <p className="text-gray-200 mb-4">Physical infrastructure visualization across 6 DC rooms.</p>
            <h3 className="text-lg font-semibold text-white mb-2">Room View</h3>
            <p className="text-gray-200 mb-4">
              Grid of DC rooms showing room type (Data Center, Wiring Closet, Meet-Me Room), tier rating (1-3),
              number of racks, power capacity (kW), cooling type, and PUE target.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Rack View</h3>
            <p className="text-gray-200 mb-4">
              Visual grid of racks within a room, organized by row. Color-coded fill level
              (green &lt; 60%, yellow 60-85%, red &gt; 85%). Temperature display per rack. Click any rack for detailed view.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">42U Elevation</h3>
            <p className="text-gray-200">
              Interactive rack diagram showing equipment by U-position (1-42). Equipment type, manufacturer, model.
              Power consumption per device. Management IP addresses. Status indicators.
            </p>
          </section>

          {/* === Section 9: Agent Monitor === */}
          <section id="agent-monitor">
            <h2 className="text-2xl font-bold text-white mb-4">Agent Monitor</h2>
            <p className="text-gray-200 mb-4">LLM usage and model health tracking.</p>
            <h3 className="text-lg font-semibold text-white mb-2">Request Statistics</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li>Total requests processed</li>
              <li>Input/output token counts</li>
              <li>Total cost in USD</li>
              <li>Average latency</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Model Health</h3>
            <p className="text-gray-200">Per-model metrics: request count, error rate, P50/P99 latency, tokens per minute, cost per hour, status (healthy/degraded/down).</p>
          </section>

          {/* === Section 10: System Health === */}
          <section id="system-health">
            <h2 className="text-2xl font-bold text-white mb-4">System Health</h2>
            <p className="text-gray-200 mb-4">Infrastructure component monitoring.</p>
            <h3 className="text-lg font-semibold text-white mb-2">Components Tracked</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li>Network devices (routers, switches, firewalls)</li>
              <li>Compute (servers, containers, pods)</li>
              <li>Storage (SAN, NAS, object storage)</li>
              <li>Database (PostgreSQL, Redis)</li>
              <li>Application services (all 8 microservices)</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Status Indicators</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside">
              <li><span className="text-green-400 font-medium">Green:</span> Healthy, responding within thresholds</li>
              <li><span className="text-yellow-400 font-medium">Yellow:</span> Degraded, elevated latency or error rate</li>
              <li><span className="text-gray-200 font-medium">Gray:</span> No data available</li>
            </ul>
          </section>

          {/* === Section 11: Architecture === */}
          <section id="architecture">
            <h2 className="text-2xl font-bold text-white mb-4">Architecture Deep Dive</h2>
            <h3 className="text-lg font-semibold text-white mb-2">Database Schema</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li><code className="bg-gray-800 px-2 py-1 rounded">ci</code>: 105 CIs with JSONB labels, management_ip (INET), loopback_ip (INET), subnet (CIDR)</li>
              <li><code className="bg-gray-800 px-2 py-1 rounded">relationship</code>: 123 CI-to-CI relationships with recursive CTE traversal</li>
              <li><code className="bg-gray-800 px-2 py-1 rounded">service</code>: 8 services with SLA tiers</li>
              <li><code className="bg-gray-800 px-2 py-1 rounded">alert</code>: Alert management with severity/status lifecycle</li>
              <li><code className="bg-gray-800 px-2 py-1 rounded">dc_room/dc_rack/dc_rack_equipment</code>: Physical DC hierarchy</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Microservices</h3>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-800 text-white">
                  <tr><th className="px-4 py-2">Service</th><th className="px-4 py-2">Port</th><th className="px-4 py-2">Purpose</th></tr>
                </thead>
                <tbody className="text-gray-200">
                  <tr className="border-b border-gray-800"><td className="px-4 py-2">api-gateway</td><td className="px-4 py-2">8000</td><td className="px-4 py-2">Core API, auth, CMDB CRUD</td></tr>
                  <tr className="border-b border-gray-800 bg-gray-900/50"><td className="px-4 py-2">chatbot</td><td className="px-4 py-2">8004</td><td className="px-4 py-2">LangGraph AI agent</td></tr>
                  <tr className="border-b border-gray-800"><td className="px-4 py-2">alert-noc</td><td className="px-4 py-2">8005</td><td className="px-4 py-2">Alert management</td></tr>
                  <tr className="border-b border-gray-800 bg-gray-900/50"><td className="px-4 py-2">rca-engine</td><td className="px-4 py-2">-</td><td className="px-4 py-2">Root cause analysis</td></tr>
                  <tr className="border-b border-gray-800"><td className="px-4 py-2">agent-monitor</td><td className="px-4 py-2">-</td><td className="px-4 py-2">LLM usage tracking</td></tr>
                  <tr className="border-b border-gray-800 bg-gray-900/50"><td className="px-4 py-2">generator</td><td className="px-4 py-2">-</td><td className="px-4 py-2">Synthetic data generation</td></tr>
                  <tr><td className="px-4 py-2">infra-simulator</td><td className="px-4 py-2">-</td><td className="px-4 py-2">Infrastructure simulation</td></tr>
                </tbody>
              </table>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Key Patterns</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside">
              <li>Repository Pattern for DB access</li>
              <li>API Gateway with reverse proxy for microservices</li>
              <li>Human-in-the-loop approval workflow</li>
              <li>Recursive CTE for graph traversal</li>
              <li>JWT authentication with refresh tokens</li>
            </ul>
          </section>

          {/* === Section 12: API Reference === */}
          <section id="api-reference">
            <h2 className="text-2xl font-bold text-white mb-4">API Reference</h2>
            <h3 className="text-lg font-semibold text-white mb-2">Authentication</h3>
            <pre className="bg-gray-800 p-3 rounded-xl text-sm text-gray-200 mb-4">{`POST /auth/login          - Get JWT token
POST /auth/refresh        - Refresh token
GET  /auth/me             - Current user info`}</pre>
            
            <h3 className="text-lg font-semibold text-white mb-2">CMDB</h3>
            <pre className="bg-gray-800 p-3 rounded-xl text-sm text-gray-200 mb-4">{`GET    /api/v1/cmdb/ci                     - List CIs (?ip= search)
GET    /api/v1/cmdb/ci/{id}                - Get CI by ID
GET    /api/v1/cmdb/ci/{id}/details        - Get CI with neighbors
POST   /api/v1/cmdb/ci                     - Create CI
GET    /api/v1/cmdb/resolve-ip/{ip}        - Resolve IP to CI
GET    /api/v1/cmdb/sites                  - List sites with counts
GET    /api/v1/cmdb/sites/locations        - Site coordinates
GET    /api/v1/cmdb/sites/{name}/map-data  - Site indoor map data
GET    /api/v1/cmdb/sites/{name}/overview  - Site overview stats
GET    /api/v1/cmdb/sites/{name}/services  - Services with CIs in site
GET    /api/v1/cmdb/services               - All services with CI counts
GET    /api/v1/cmdb/topology/all           - Full global topology
GET    /api/v1/cmdb/topology/site/{name}   - Site topology (?view=&service=)
GET    /api/v1/cmdb/topology/site-aggregate - 5-node aggregate view
GET    /api/v1/cmdb/topology/inter-site    - Inter-site connections
GET    /api/v1/cmdb/topology/inter-site/flows - Traffic flow data
GET    /api/v1/cmdb/impact/{ci_id}         - Downstream impact analysis`}</pre>
            
            <h3 className="text-lg font-semibold text-white mb-2">DC Explorer</h3>
            <pre className="bg-gray-800 p-3 rounded-xl text-sm text-gray-200 mb-4">{`GET    /api/v1/cmdb/dc/rooms              - List rooms
GET    /api/v1/cmdb/dc/rooms/{id}         - Get room details
GET    /api/v1/cmdb/dc/rooms/{id}/racks   - Get racks in room
GET    /api/v1/cmdb/dc/racks/{id}/equipment - Get equipment in rack`}</pre>
            
            <h3 className="text-lg font-semibold text-white mb-2">Alerts</h3>
            <pre className="bg-gray-800 p-3 rounded-xl text-sm text-gray-200 mb-4">{`GET    /api/v1/alerts                     - List alerts (deduplicated)
GET    /api/v1/alerts/incidents            - List incident groups
GET    /api/v1/alerts/incidents/{id}       - Get incident detail with alerts
POST   /api/v1/alerts/incidents/{id}/ack   - Bulk acknowledge incident
POST   /api/v1/alerts/incidents/{id}/res   - Bulk resolve incident
GET    /api/v1/alerts/stats                - Alert statistics
POST   /api/v1/alerts                     - Create alert
POST   /api/v1/alerts/{id}/acknowledge    - Acknowledge single alert
POST   /api/v1/alerts/{id}/resolve        - Resolve single alert`}</pre>

            <h3 className="text-lg font-semibold text-white mb-2">Simulation</h3>
            <pre className="bg-gray-800 p-3 rounded-xl text-sm text-gray-200 mb-4">{`GET    /api/v1/simulate/scenarios           - List available scenarios
POST   /api/v1/simulate/scenario            - Run a failure scenario`}</pre>
            
            <h3 className="text-lg font-semibold text-white mb-2">Chatbot</h3>
            <pre className="bg-gray-800 p-3 rounded-xl text-sm text-gray-200">{`POST   /api/v1/chatbot/chat               - Send message
GET    /api/v1/chatbot/history/{thread}   - Get chat history
GET    /api/v1/chatbot/approvals/pending  - List pending approvals
POST   /api/v1/chatbot/approvals/{id}     - Approve/reject`}</pre>
          </section>

          {/* === Section 13: Deployment === */}
          <section id="deployment">
            <h2 className="text-2xl font-bold text-white mb-4">Deployment</h2>
            <h3 className="text-lg font-semibold text-white mb-2">Prerequisites</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li>Docker and Docker Compose v2+</li>
              <li>8GB RAM minimum (16GB recommended for Ollama)</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Quick Start</h3>
            <pre className="bg-gray-800 p-3 rounded-xl text-sm text-gray-200 mb-4">docker compose up -d</pre>
            <h3 className="text-lg font-semibold text-white mb-2">Services (12 containers)</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li>postgres (16), redis (7), ollama (latest)</li>
              <li>api-gateway, chatbot, alert-noc, rca-engine</li>
              <li>agent-monitor, generator, infra-simulator</li>
              <li>ui (nginx), otel-lgtm (grafana)</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Environment Variables</h3>
            <pre className="bg-gray-800 p-3 rounded-xl text-sm text-gray-200 mb-4">JWT_SECRET_KEY=your-secret-key
POSTGRES_PASSWORD=your-password
REDIS_PASSWORD=your-redis-password</pre>
            <h3 className="text-lg font-semibold text-white mb-2">Data Persistence</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li><code className="bg-gray-800 px-2 py-1 rounded">postgres_data</code>: PostgreSQL data volume</li>
              <li><code className="bg-gray-800 px-2 py-1 rounded">ollama_data</code>: Ollama model storage</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Troubleshooting</h3>
            <pre className="bg-gray-800 p-3 rounded-xl text-sm text-gray-200">{`Check logs:    docker compose logs -f [service]
Rebuild:       docker compose build --no-cache [service]
Reset DB:      docker compose down -v && docker compose up -d`}</pre>
          </section>
        </div>
      </main>
    </div>
  );
}
