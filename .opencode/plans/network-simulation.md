# Plan: Network Simulation Engine ✅ COMPLETED

**Impact: HIGH | Effort: HIGH (3-5 days)**
**Dependencies: IP Address Assignment (Plan 2) must be completed first**

---

## Problem

Topology edges are static JSON (`connects_to` relationships with no interface/port/subnet metadata). No way to simulate routing decisions, ARP resolution, traceroute paths, or packet flow. The system cannot answer "how does traffic get from A to B?" or "what happens if this link fails?"

---

## Goal

Replace static adjacency with a dynamic network simulation engine that computes routing tables, resolves ARP, traces packet paths, and simulates failure reconvergence — all visualized in the existing Cytoscape.js topology.

---

## Architecture

### New Plugin: `plugins/network_sim/`

```
plugins/network_sim/
  models.py          # Device, Interface(ip/mac/port/state), Link(bw,cost,state),
                     # Route(prefix, nexthop_ip, iface, metric, proto, ad)
  addressing.py      # Subnet allocation from CIDR plan using Python ipaddress module
  routing.py         # Dijkstra SPF per router -> RIB/FIB; longest-prefix match;
                     # recompute on topology event
  l2.py              # ARP caches, MAC learning, flooding domains (per VLAN/segment)
  trace.py           # Simulated ping/traceroute walking FIBs; loop/blackhole detection
  events.py          # Canonical event log: HOP, ARP_REQ, ARP_REPLY, ROUTE_CHANGE,
                     # LINK_DOWN, TTL_EXPIRED, DEST_UNREACHABLE
  engine.py          # Ties it together; pure Python, no FastAPI imports (testable)
  main.py            # FastAPI plugin: REST + WebSocket
  config.py          # pydantic-settings config
  Dockerfile
```

### How Each Mechanism Works

#### 1. Routing Tables (computed from topology)

Pattern from [routesim2](https://github.com/bkmulusew/routesim2) and [pyOSPF](https://github.com/ahodieb/pyOSPF):

1. Build a graph where routers are nodes and links are weighted edges (weight = OSPF cost: `ref_bw / bw`)
2. **Link-State (OSPF/IS-IS):** skip LSA flooding in centralized sim — run **Dijkstra from every router** over the shared graph (identical result once converged)
3. Store per-router: destination prefix -> {next-hop interface, next-hop IP, metric, protocol, admin distance}
4. **Longest-prefix match:** FIB lookup groups routes by prefix, picks most specific (`/24` beats `/16`), tie-breaks by admin distance (connected=0, static=1, eBGP=20, OSPF=110)
5. **Recompute triggers:** link up/down, cost change, router failure -> re-run SPF

Python implementation: NetworkX `nx.single_source_dijkstra` or hand-rolled heapq Dijkstra (~40 lines) returning both distance and first-hop.

#### 2. ARP Resolution

Modeled from [joxorsayan/netsim](https://github.com/joxorsayan/netsim):

- Data: per-interface `{ip, mac}`, per-device **ARP cache** `{ip -> mac, age, state}`, per-switch **MAC address table** `{mac -> port}`
- Same-subnet `host A -> IP_B`: if IP_B in cache -> attach dest MAC; else emit broadcast frame (`ff:ff:ff:ff:ff:ff`) flooding within L2 segment; owner replies unicast; cache populated
- Cross-subnet: ARP only for default gateway's MAC; gateway re-ARPs on egress interface, decrements TTL
- Switches learn source MAC on every frame (MAC learning), flood unknown unicasts

#### 3. Traceroute

Two approaches (use #1, implement #2 as optimization):

1. **TTL-walk (faithful):** send probe with TTL=n; router where TTL hits 0 returns ICMP Time Exceeded; stop at destination
2. **Path-lookup (cheap):** compute L3 path via routing tables (lookup next-hop until destination), interleave L2 hops (host->switch->router). Detect loops (visited-set), black holes (no route), unreachable (no matching route -> ICMP Network Unreachable)

#### 4. Packet Flow Simulation

- **Control-plane tier (deterministic):** given src/dst, compute hop list from FIBs + ARP/MAC state; emit timed event list. Sub-millisecond for hundreds of nodes.
- **Data-plane tier (optional, SimPy-based):** link bandwidth, transmission delay (`size*8/rate`), propagation delay, queues and drops. Use only for congestion/queue-depth metrics.

### API Surface

Mounted at `/api/v1/network-sim`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ping` | POST | Simulated ping: `{src, dst}` -> hop list with per-hop L2/L3 detail |
| `/traceroute` | POST | Traceroute: `{src, dst}` -> hop-by-hop path with latency estimates |
| `/devices/{id}/routes` | GET | Routing table for a device |
| `/devices/{id}/arp` | GET | ARP cache for a device |
| `/devices/{id}/mac-table` | GET | MAC address table (switches only) |
| `/stream` | WS | Packet-flow events for Cytoscape animation (batched 10-30 events/frame) |
| `/failure` | POST | Inject link/device down -> recompute routes -> return diff |
| `/recovery` | POST | Restore failed component -> recompute |

### Frontend Changes

**TopologyGraph.tsx:**
- Animated packet flow particles along edges (canvas overlay for performance)
- Path highlighting: active route gets gold border, non-matching nodes dimmed
- Edge labels show OSPF cost, bandwidth, utilization

**New component: `NetworkSimPanel.tsx`**
- Side panel with tabs: Routing Table | ARP Cache | MAC Table
- Shows per-device simulation state
- Appears when clicking a device node in topology

**New component: `TracerouteView.tsx`**
- Visual traceroute: hop-by-hop display with IP, hostname, latency per hop
- Click a hop to highlight that node in topology
- Detect and display loops/blackholes with warning icons

### Data Structures

```python
@dataclass
class Interface:
    name: str          # "Ethernet0/1"
    mac: str           # "aa:bb:cc:dd:ee:ff"
    ip: str            # "10.0.1.1"
    prefix_len: int    # 24
    up: bool = True

@dataclass
class Device:
    id: str
    type: str          # host | switch | router
    interfaces: list[Interface]
    arp_cache: dict    # {ip -> mac}
    mac_table: dict    # {mac -> port} (switches only)

@dataclass
class Link:
    a_id: str
    a_port: str
    b_id: str
    b_port: str
    cost: int          # OSPF cost
    bandwidth: int     # Mbps
    state: str         # up | down

@dataclass
class Route:
    prefix: str        # "10.0.2.0/24"
    next_hop_ip: str   # "10.0.1.1"
    out_iface: str     # "Ethernet0/1"
    metric: int
    proto: str         # connected | static | ospf | bgp
    admin_dist: int
```

---

## Implementation Phases

### Phase 1: Addressing + Routing Tables (1 day)
1. Create `plugins/network_sim/` with `models.py`, `addressing.py`, `routing.py`
2. Build NetworkX graph from CMDB relationships
3. Run Dijkstra SPF per router, populate RIB/FIB
4. `GET /devices/{id}/routes` endpoint
5. Frontend: routing table panel in topology view

### Phase 2: Traceroute + Ping (1 day)
1. Implement `trace.py` — TTL-walk traceroute, ping with hop tracking
2. `POST /ping`, `POST /traceroute` endpoints
3. Frontend: TracerouteView component with hop-by-hop display

### Phase 3: ARP + MAC Learning (1 day)
1. Implement `l2.py` — ARP cache simulation, MAC learning, broadcast flooding
2. `GET /devices/{id}/arp`, `GET /devices/{id}/mac-table` endpoints
3. Frontend: ARP/MAC table tabs in NetworkSimPanel

### Phase 4: Failure Injection + Reconvergence (0.5 day)
1. `POST /failure` endpoint — link/device down triggers route recomputation
2. Return route diff (added/removed/changed routes)
3. Frontend: failure injection controls, visual reconvergence animation

### Phase 5: WebSocket Packet Flow Animation (1 day)
1. `WS /stream` endpoint — batched event stream
2. Canvas overlay for packet particles in Cytoscape
3. Event types: ARP broadcast flood, unicast packet along route, TTL expired, unreachable

---

## Integration with Existing System

- Extend `SimulatedDevice.properties` in `plugins/infra_simulator/topology.py` with `interfaces: [{name, ip, mac, subnet}]`
- Replace string-list `dependencies` with typed `Link` objects carrying cost/state
- Existing OTel log/alert loop consumes engine events (link-down -> route-change log + alert)
- Topology edges in CMDB `Relationship` model become the source of truth for link state

---

## Performance

- **Scale:** ~21 devices is trivial. Full SPF recompute: microseconds. O(N * E log N) at 100-500 nodes: <10ms in pure Python.
- **Animation is the bottleneck:** hundreds of particles kill DOM/SVG. Batch WS events, use requestAnimationFrame, canvas overlay for particles.
- **Cache routing tables:** recompute only on topology change; push diffs, not full tables.

---

## Verification

1. Select two devices in topology -> traceroute shows correct hop path
2. Click a router -> routing table panel shows all prefixes with next-hops
3. Simulate link down -> routes recompute, UI updates within 100ms
4. ARP broadcast visible as animated flood in topology
5. Ping between same-subnet hosts shows ARP resolution then ICMP echo path
6. Ping across subnets shows routing through gateway with TTL decrement
7. No errors in browser console or backend logs
8. ruff + mypy + npm build pass

---

## Key References

- [joxorsayan/netsim](https://github.com/joxorsayan/netsim) — FastAPI + pure-Python engine, MIT
- [bkmulusew/routesim2](https://github.com/bkmulusew/routesim2) — Link-state vs distance-vector
- [ahodieb/pyOSPF](https://github.com/ahodieb/pyOSPF) — OSPF hello adjacency -> Dijkstra
- [EngineersUniverse Network Modeling Lab](https://engineersuniverse.com/webapps/network-modeling-lab) — OSPF/BGP/traceroute
- [NetSandbox](https://www.netsandbox.io/) — Browser sim with ARP/MAC/traceroute UX reference
- [TL-system/ns.py](https://github.com/TL-system/ns.py) — SimPy networking layer
- [ethp2p/netviz](https://github.com/ethp2p/netviz) — Cytoscape packet animation patterns
