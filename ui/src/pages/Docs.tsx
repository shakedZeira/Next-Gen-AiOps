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
  { id: 'slo-dashboard', title: 'SLI / SLO Dashboard' },
  { id: 'network-sim', title: 'Network Simulation' },
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
            <h3 className="text-lg font-semibold text-white mb-2">WebSocket Real-Time Push</h3>
            <p className="text-gray-200 mb-4">
              Alerts are pushed in real-time via WebSocket — no more polling. A persistent WebSocket
              connection to <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-300 text-sm">/api/v1/alerts/ws</code> delivers
              events instantly: <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-300 text-sm">alert.created</code>,
              <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-300 text-sm">alert.repeat</code>,
              <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-300 text-sm">alert.acknowledged</code>, and
              <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-300 text-sm">alert.resolved</code>. The connection
              auto-reconnects with exponential backoff on disconnect. A green/red dot in the header shows connection status.
              Backend: Redis pub/sub in <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-300 text-sm">store.py</code> publishes
              to <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-300 text-sm">alerts:events</code> channel on every
              mutation. Nginx proxies WebSocket with upgrade headers directly to alert-noc:8005.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Incidents View</h3>
            <p className="text-gray-200 mb-4">
              Toggle to "Incidents" to see alerts grouped by incident. Incidents are smart-grouped
              using multiple correlation signals: same service + keyword overlap, cascade timing
              (alerts within 10 minutes), and normalized name patterns. The Union-Find algorithm
              transitively merges related groups. Each incident shows severity, affected services,
              alert count, and time range. Multi-service incidents display a "+N" indicator.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Suggest Fix (AI-Powered)</h3>
            <p className="text-gray-200 mb-4">
              Each incident card and the detail view have a purple "Suggest Fix" button. Clicking it
              sends the full incident context (alerts, service, severity, teams) to the AI chatbot,
              which analyzes the topology and alert patterns to suggest remediation steps. The chatbot
              opens in a new thread pre-loaded with the analysis for seamless investigation.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Change-Aware Correlation</h3>
            <p className="text-gray-200 mb-4">
              When viewing an incident, the system automatically checks for recent deployments,
              config changes, and infrastructure changes within the last 30 minutes for the affected
              service. A "Recent Changes" panel appears with a risk score (0-100%) based on timing
              proximity — the closer the change, the higher the risk. Changes marked as "Likely Cause"
              (risk &gt; 70%) are flagged prominently. The Suggest Fix button includes change context
              in the AI prompt, helping the chatbot consider recent deployments as potential root causes.
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
            <p className="text-gray-200 mb-4">
              LLM-powered SRE assistant backed by Ollama (qwen2.5:1.5b) with real tool calling.
              The chatbot can query the NOC alert store, CMDB database, and topology data to answer
              natural language questions about your infrastructure.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">How to Use</h3>
            <p className="text-gray-200 mb-2">Type natural language questions about your infrastructure:</p>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li>"What alerts are currently active?" → Queries alert-noc, returns filtered alert list</li>
              <li>"Tell me about hq-core-sw-1" → Looks up CI details, IPs, and connections</li>
              <li>"Show me the topology of global-hq" → Queries CMDB for site-specific topology</li>
              <li>"What services are deployed?" → Lists all services with SLA tiers and CI counts</li>
              <li>"Search for anything on IP 10.0.1.x" → Searches CIs by IP address</li>
              <li>"What incidents are open?" → Groups related alerts into incidents</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Tool Calling</h3>
            <p className="text-gray-200 mb-4">
              The LLM uses 7 tools to answer queries: <code className="bg-gray-800 px-2 py-1 rounded text-primary-400">get_alerts</code>,{' '}
              <code className="bg-gray-800 px-2 py-1 rounded text-primary-400">get_incidents</code>,{' '}
              <code className="bg-gray-800 px-2 py-1 rounded text-primary-400">get_topology</code>,{' '}
              <code className="bg-gray-800 px-2 py-1 rounded text-primary-400">get_ci_info</code>,{' '}
              <code className="bg-gray-800 px-2 py-1 rounded text-primary-400">search_cis</code>,{' '}
              <code className="bg-gray-800 px-2 py-1 rounded text-primary-400">get_services</code>,{' '}
              <code className="bg-gray-800 px-2 py-1 rounded text-primary-400">get_site_overview</code>.
              The agent loops up to 5 rounds of tool calls per message to gather data before responding.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Conversation Memory</h3>
            <p className="text-gray-200 mb-4">
              Chat history is stored in Redis (1-hour TTL per thread). Thread sidebar shows all
              previous conversations. Hover over any thread to reveal the delete (trash) icon.
              Follow-up questions use conversation context automatically. Click "Clear Chat" to
              wipe the current thread's messages without deleting it.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Incident Suggestions</h3>
            <p className="text-gray-200 mb-4">
              Click "Suggest Fix" on any incident in the NOC Alerts page to send the full incident
              context to the chatbot. The AI analyzes the affected service's topology, related
              alerts, and recent changes (deployments, config updates) to propose step-by-step
              remediation. Recent changes with high risk scores are highlighted as potential root
              causes. The suggestion opens in its own chat thread for follow-up investigation.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Approval Queue</h3>
            <p className="text-gray-200 mb-4">
              When the AI proposes a remediation action (propose_fix or execute_fix), it creates an
              approval request. The request appears in the Approval Queue panel on the right.
              Review the proposed change, then Approve or Reject. All destructive actions require
              human confirmation.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Backend</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside">
              <li><span className="font-medium text-white">Model:</span> qwen2.5:1.5b via Ollama (runs locally in Docker)</li>
              <li><span className="font-medium text-white">Framework:</span> LangGraph state machine with tool-calling loop</li>
              <li><span className="font-medium text-white">Data Sources:</span> alert-noc HTTP API, PostgreSQL CMDB (direct queries)</li>
              <li><span className="font-medium text-white">Conversation Store:</span> Redis with TTL-based expiration</li>
            </ul>
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

          {/* === Section 11: SLI/SLO Dashboard === */}
          <section id="slo-dashboard">
            <h2 className="text-2xl font-bold text-white mb-4">SLI / SLO Dashboard</h2>
            <p className="text-gray-300 mb-4">
              Service Level Indicators (SLIs) and Service Level Objectives (SLOs) for all 8 services, with real-time error budget tracking computed from live alert data.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">SLI Metrics</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li><span className="font-medium text-white">Availability:</span> Uptime percentage over 30-day window. Target varies by tier (gold: 99.95%, silver: 99.9%, bronze: 99.5%)</li>
              <li><span className="font-medium text-white">Latency P99:</span> 99th percentile request latency in milliseconds. Lower is better</li>
              <li><span className="font-medium text-white">Error Rate:</span> Percentage of failed requests. Calculated from active alerts affecting the service</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Error Budget</h3>
            <p className="text-gray-300 mb-4">
              Monthly error budget = (1 - SLO target) × 30 days in minutes. Active alerts consume budget at 2.5 minutes per alert.
              Status: <span className="text-green-400">healthy</span> (&gt;50%), <span className="text-yellow-400">warning</span> (25-50%), <span className="text-orange-400">critical</span> (&lt;25%), <span className="text-red-400">exhausted</span> (0%).
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Dashboard Integration</h3>
            <p className="text-gray-300 mb-4">
              Each service card on the Dashboard is clickable — clicking navigates to the SLO Dashboard filtered to that service with a highlighted card and drill-down banner.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">API Endpoints</h3>
            <table className="w-full text-sm text-gray-300 mb-4">
              <thead><tr className="border-b border-gray-700 text-left"><th className="px-4 py-2">Endpoint</th><th className="px-4 py-2">Method</th><th className="px-4 py-2">Description</th></tr></thead>
              <tbody>
                <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/api/v1/slo</code></td><td className="px-4 py-2">GET</td><td className="px-4 py-2">All service SLOs with SLI values and error budgets</td></tr>
                <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/api/v1/slo/{'{service}'}</code></td><td className="px-4 py-2">GET</td><td className="px-4 py-2">SLO for a specific service</td></tr>
              </tbody>
            </table>
          </section>

          {/* === Section 12: Network Simulation === */}
          <section id="network-sim">
            <h2 className="text-2xl font-bold text-white mb-4">Network Simulation Engine</h2>
            <p className="text-gray-300 mb-4">
              A pure-Python network simulation plugin built on NetworkX graph algorithms, fully integrated into the CMDB Explorer page. Models the entire CMDB topology as a packet-switched network with IP addressing, Dijkstra shortest-path routing, ARP resolution, and ping/traceroute simulation.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Integration with CMDB Explorer</h3>
            <p className="text-gray-300 mb-4">
              All network simulation features are accessed by clicking any device in the CMDB topology map. The device detail panel includes four tabs:
            </p>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li><span className="text-blue-400 font-medium">Details:</span> CI properties, IP addresses, connected devices, and alerts</li>
              <li><span className="text-green-400 font-medium">Network:</span> Routing table (Dijkstra SPF), ARP cache, and MAC address table — auto-loaded when selected</li>
              <li><span className="text-purple-400 font-medium">Ping / Trace:</span> Simulate ICMP ping or traceroute to any destination IP. Traceroute hops are highlighted on the topology map in purple</li>
              <li><span className="text-red-400 font-medium">Actions:</span> Inject failures (link-down, interface-down, packet-loss, high-latency) or recover — generates correlated alerts on the NOC Alerts page</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">Simulation Features</h3>
            <ul className="text-gray-200 space-y-2 list-disc list-inside mb-4">
              <li><span className="text-blue-400 font-medium">Dijkstra SPF Routing:</span> Computes shortest-path routing tables for all 105 devices. 81 links with simulated cost metrics.</li>
              <li><span className="text-green-400 font-medium">IP Addressing:</span> Assigns /31 transit links, loopback addresses, and management subnets from CMDB data.</li>
              <li><span className="text-yellow-400 font-medium">ARP &amp; MAC Tables:</span> Simulates ARP resolution across L2 flooding domains. Switch MAC learning from frame inspection.</li>
              <li><span className="text-purple-400 font-medium">Ping / Traceroute:</span> Hop-by-hop packet simulation with TTL decrement, latency modeling, loop detection, and blackhole detection.</li>
              <li><span className="text-red-400 font-medium">Failure Injection:</span> Link-down and node-down failures with automatic routing reconvergence. Events logged and correlated with alerts.</li>
            </ul>
            <h3 className="text-lg font-semibold text-white mb-2">REST API (port 8013)</h3>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-800 text-white">
                  <tr><th className="px-4 py-2">Endpoint</th><th className="px-4 py-2">Method</th><th className="px-4 py-2">Description</th></tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/api/v1/network-sim/health</code></td><td className="px-4 py-2">GET</td><td className="px-4 py-2">Engine health, device/link count</td></tr>
                  <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/api/v1/network-sim/devices</code></td><td className="px-4 py-2">GET</td><td className="px-4 py-2">All device summaries (105 devices)</td></tr>
                  <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/devices/{'{id}'}/routes</code></td><td className="px-4 py-2">GET</td><td className="px-4 py-2">Dijkstra routing table for device</td></tr>
                  <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/devices/{'{id}'}/arp</code></td><td className="px-4 py-2">GET</td><td className="px-4 py-2">ARP cache entries</td></tr>
                  <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/devices/{'{id}'}/mac-table</code></td><td className="px-4 py-2">GET</td><td className="px-4 py-2">Switch MAC forwarding table</td></tr>
                  <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/api/v1/network-sim/ping</code></td><td className="px-4 py-2">POST</td><td className="px-4 py-2">Simulate ICMP ping (src_id, dst_ip)</td></tr>
                  <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/api/v1/network-sim/traceroute</code></td><td className="px-4 py-2">POST</td><td className="px-4 py-2">Simulate traceroute with hop details</td></tr>
                  <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/api/v1/network-sim/failure</code></td><td className="px-4 py-2">POST</td><td className="px-4 py-2">Inject link or node failure</td></tr>
                  <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/api/v1/network-sim/recovery</code></td><td className="px-4 py-2">POST</td><td className="px-4 py-2">Recover from failure</td></tr>
                  <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/api/v1/network-sim/events</code></td><td className="px-4 py-2">GET</td><td className="px-4 py-2">Recent simulation events</td></tr>
                  <tr className="border-b border-gray-800"><td className="px-4 py-2"><code>/api/v1/network-sim/stream</code></td><td className="px-4 py-2">WS</td><td className="px-4 py-2">WebSocket real-time event stream</td></tr>
                </tbody>
              </table>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Docker Service</h3>
            <p className="text-gray-300 mb-2">Runs as <code className="bg-gray-800 px-2 py-1 rounded">network-sim</code> container on port 8013. Reads CMDB directly from PostgreSQL (bypasses auth-gated API gateway for topology bootstrap). Proxied via API gateway at <code className="bg-gray-800 px-2 py-1 rounded">/api/v1/network-sim/*</code>.</p>
          </section>

          {/* === Section 12: Architecture === */}
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
                  <tr className="border-b border-gray-800"><td className="px-4 py-2">network-sim</td><td className="px-4 py-2">8013</td><td className="px-4 py-2">Network simulation engine</td></tr>
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

            <h3 className="text-lg font-semibold text-white mb-2">Change Tracking</h3>
            <pre className="bg-gray-800 p-3 rounded-xl text-sm text-gray-200 mb-4">{`GET    /api/v1/changes/                     - List changes (?service= filter)
POST   /api/v1/changes/                     - Create a change record
GET    /api/v1/changes/recent/{service}     - Recent changes (?minutes= lookback)
GET    /api/v1/changes/correlate/{service}  - Risk analysis for recent changes`}</pre>
            
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
