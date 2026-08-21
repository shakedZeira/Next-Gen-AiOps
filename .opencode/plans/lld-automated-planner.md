# Plan: LLD Automated Planner

**Impact: HIGH | Effort: HIGH (3-4 days)**
**Dependencies: IP Address Assignment (Plan 2) and Manual Device (Plan 4) should be completed first**

---

## Problem

No automated way to plan where to place a new device, which sites/racks it belongs in, what it should connect to, or what IPs/VLANs to assign. LLD creation is manual and error-prone, requiring deep knowledge of the existing infrastructure.

---

## Goal

Build an automated Low-Level Design (LLD) planner that takes a device intent (name, role, type, site preference) and produces a complete placement plan with rationale — site selection, rack position, connection points, IP/VLAN assignments, and a generated LLD document.

---

## Research Summary

### Commercial References

| Tool | Approach |
|------|----------|
| ZTE iDevise | Inputs (room, networking, hardware, data plans) -> analysis modules -> LLD/HLD docs |
| NetDesign AI | Plain language intent -> AI product scoring -> auto topology + configs + BOM |
| Cisco WAE/Crosswork | Capacity planning optimizer: candidate nodes + max new adjacencies constraint |
| ServiceNow Discovery | Router-seeded network discovery, automated seed-router selection |

### Algorithm: Weighted Facility Location (simplified ConFL)

Full Connected Facility Location is NP-hard. At 5 sites, **weighted multi-criteria scoring with hard-constraint filtering** is optimal:

```
score(site) = w1 * capacity_fit + w2 * role_affinity + w3 * redundancy_gain
            - w4 * utilization_penalty - w5 * cost
```

### Graph Algorithms

- **Site selection:** Weighted scoring (capacity, role fit, redundancy, utilization)
- **Connection planning:** NetworkX graph from CMDB relationships; candidate filtering by layer/role; min-cut safety check
- **Rack placement:** Best-fit bin packing with power/thermal awareness
- **IP/VLAN allocation:** Worst-fit prefix allocation (grows better than first-fit per Zappala et al.)

---

## Architecture

### New Plugin: `plugins/lld_planner/`

```
plugins/lld_planner/
  main.py              # FastAPI app, lifespan, health
  config.py            # pydantic-settings: thresholds, weights
  schemas.py           # Pydantic models: DeviceIntent, PlacementPlan, RationaleStep
  site_selector.py     # Decision 1: scoring + hard filters
  connection_planner.py# Decision 2: NetworkX graph ops + candidate scoring
  rack_placer.py       # Decision 3: bin packing + power/thermal
  port_allocator.py    # Decision 4: free port matching
  ip_vlan_allocator.py # Decision 5: ipaddress module prefix math
  lld_renderer.py      # Jinja2 -> Markdown/PDF LLD document
  graph_builder.py     # CMDB relationships -> nx.Graph cache
  router.py            # REST endpoints
  Dockerfile
```

### Data Models

```python
class DeviceIntent(BaseModel):
    name: str
    device_role: str          # leaf | spine | border-leaf | access | wan-edge | firewall
    device_type: str          # vendor/model SKU
    purpose: str | None       # free-text description
    preferred_site: str | None
    tenant_team: str | None
    power_draw_w: float
    u_height: int = 1
    required_downlinks: int = 0
    ha_pair: bool = False

class PlacementPlan(BaseModel):
    decision_id: UUID
    status: Literal["proposed", "approved", "deployed", "rejected"]
    site: str
    dc_room_id: UUID | None
    rack_id: UUID | None
    u_position: int | None
    connections: list[PlannedLink]
    ip_assignments: list[IpAssignment]
    vlans: list[VlanAssignment]
    rationale: list[RationaleStep]     # explainability for every decision
    confidence: float
    validation_results: list[Validation]

class PlannedLink(BaseModel):
    local_port: str
    peer_ci_id: UUID
    peer_port: str
    link_type: Literal["access", "uplink", "peer", "cross-connect", "wan"]
    speed_gbps: int
    vlan_tagged: list[int] | None
    ptp_subnet: str | None             # /31 for routed links

class RationaleStep(BaseModel):
    stage: str                         # site-selection | connection-plan | rack-place | ip-alloc
    rule: str                          # "power_headroom >= draw*1.2"
    considered: list[dict]             # candidates + scores (for UI display)
    chosen: str
    score: float
```

The `rationale` list is critical — every commercial tool that succeeds shows its work.

### API Surface

Mounted at `/api/v1/lld-planner`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/plan` | POST | `DeviceIntent` -> `PlacementPlan` (dry-run, nothing written) |
| `/plan/{id}` | GET | Retrieve plan + rationale |
| `/plan/{id}/approve` | POST | Write to CMDB: CI + relationships + equipment |
| `/plan/{id}/document` | GET | Rendered LLD (Markdown/HTML) |
| `/validate/{id}` | POST | Re-run validations against live CMDB state |
| `/sites/{site}/capacity` | GET | Utilization report feeding the selector |

### Placement Algorithm

#### Step 1: Site Selection

For each site, compute a score:

```python
def score_site(site, intent):
    # Hard filters (must pass)
    if site.free_rack_u < intent.u_height:
        return None  # no space
    if site.free_power_kw < intent.power_draw_w * 1.2 / 1000:
        return None  # insufficient power
    if intent.device_role not in site.valid_roles:
        return None  # role doesn't fit topology type
    
    # Soft scoring
    capacity_fit = site.free_rack_u / site.total_rack_u  # more space = better
    role_affinity = len([ci for ci in site.cis if ci.type == intent.device_type]) / max(len(site.cis), 1)
    redundancy_gain = compute_redundancy_improvement(site, intent)
    utilization_penalty = site.avg_link_utilization
    
    return (capacity_fit * 0.3 + role_affinity * 0.2 + redundancy_gain * 0.3
            - utilization_penalty * 0.2)
```

Role affinity rules per topology type:
- **Hierarchical:** new access switch -> attach to 2 distribution switches (dual-homing)
- **Hub-and-spoke:** any new device -> connects to hub
- **Ring:** insert into segment with lowest utilization

#### Step 2: Connection Planning

1. Build NetworkX graph from CMDB `Relationship` table
2. Filter candidate peers by layer/role (e.g., leaf-switch candidates = distribution switches with >=2 free ports)
3. Score candidates: `free_ports * alpha + (1/link_utilization) * beta + diversity * gamma`
4. Safety check: `nx.minimum_cut` confirms no single link becomes a cut edge; for ring sites verify 2-edge-connectivity

#### Step 3: Rack Placement

Best-fit bin packing:
1. Filter racks: enough contiguous free U, power headroom >= device draw * 1.2
2. Score racks: prefer same-rack-as-peers (short DAC cables), lower fill %, lower temp
3. U position: bottom-up for heavy devices, keep 1U gap above switches for cable management

#### Step 4: IP/VLAN Allocation

- Per-site prefix plan: `10.{site_id}.0.0/16`, carved into role containers
- VLAN ID: per-site ranges (global-hq: 100-199, branches: 200-299)
- Subnet: worst-fit within role container (better for growing blocks)
- Point-to-point links: `/31` pairs (RFC 5309)
- Management: next-free from management subnet

#### Step 5: LLD Document Generation

Jinja2 template producing Markdown with sections:
1. Device Summary (name, role, type, vendor, model)
2. Site & Rack Placement (room, rack, U-position, power budget)
3. Connection Schedule (local port -> peer device -> peer port -> link type -> speed)
4. IP Address Plan (management, loopback, subnets)
5. VLAN Matrix (VLAN ID, name, purpose, ports)
6. Rationale (step-by-step explanation of every decision)

### Frontend: `LldPlanner.tsx` Page

1. **Wizard form** (device intent input):
   - Name, role dropdown, type/vendor, site preference (optional)
   - Team, power draw, U-height, downlink requirements
   - HA pair option

2. **Plan review view:**
   - Left panel: step-by-step rationale accordion (from `rationale[]`), showing candidate scores as bar charts
   - Center: mini topology preview highlighting proposed peers (reuse TopologyGraph)
   - Right: rack elevation preview with proposed U highlighted (reuse RackVisualization logic)

3. **Diff view:**
   - Planned links vs current state
   - Planned IPs vs allocated IPs
   - Planned VLANs vs used VLANs

4. **Approve button:**
   - POST approve -> creates CIs + relationships + equipment records
   - Toast notification + link to generated LLD document
   - Optionally wire into existing ApprovalQueue

---

## Integration Points

### With Chatbot (Plan 5)

"add a ToR switch to branch-london" -> LLM parses intent -> calls `POST /plan` -> returns plan for approval.

### With IP Address Assignment (Plan 2)

IP/VLAN allocation reads existing allocations to avoid conflicts.

### With Manual Device + MIB (Plan 4)

After discovery, discovered device properties feed into the planner.

### With CMDB

Approved plans create:
- New CI record
- Relationship records (connects_to)
- DCRackEquipment record
- Service membership (if applicable)

---

## Implementation Steps

### Phase 1: Core Planning Engine (1.5 days)
1. Create `plugins/lld_planner/` with schemas, config
2. Implement `graph_builder.py` — NetworkX from CMDB
3. Implement `site_selector.py` — scoring + hard filters
4. Implement `connection_planner.py` — candidate selection + min-cut
5. Implement `rack_placer.py` — bin packing
6. Implement `ip_vlan_allocator.py` — prefix math
7. `POST /plan` endpoint (dry-run)

### Phase 2: LLD Document + Approval (0.5 day)
1. Implement `lld_renderer.py` — Jinja2 template
2. `GET /plan/{id}/document` endpoint
3. `POST /plan/{id}/approve` endpoint — write to CMDB
4. Validation endpoint

### Phase 3: Frontend (1 day)
1. `LldPlanner.tsx` page with wizard + review
2. Rationale accordion with score visualization
3. Topology preview highlighting proposed peers
4. Rack elevation preview
5. Approve flow

### Phase 4: Chatbot Integration (0.5 day)
1. Intent parsing in chatbot for "add device" requests
2. Auto-trigger planner from chat
3. Return plan summary in chat

---

## Verification

1. Submit device intent -> plan returned with site, rack, connections, IPs, VLANs
2. Rationale shows why each choice was made (scores, candidates considered)
3. Plan shows topology preview with proposed peers highlighted
4. Plan shows rack elevation with proposed U position
5. Approve plan -> CI + relationships + equipment created in CMDB
6. Generated LLD document contains all sections
7. Validation catches conflicts (duplicate IPs, insufficient power)
8. Chatbot "add a firewall to branch-london" triggers planner
9. npm build + ruff + mypy pass

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `plugins/lld_planner/` (new) | Entire new plugin (9 modules + Dockerfile) |
| `core_platform/main.py` | Add proxy route for `/api/v1/lld-planner` |
| `docker-compose.yml` | Add lld-planner service |
| `ui/src/pages/LldPlanner.tsx` (new) | Planner page |
| `ui/src/api/client.ts` | Add planner API methods |
| `ui/src/App.tsx` | Add route for `/planner` |
| `plugins/chatbot/tools.py` | Add `plan_device_placement` tool |

---

## Key References

- [ConFL MIP survey](https://pmc.ncbi.nlm.nih.gov/articles/PMC4076107/) — Connected Facility Location
- [Zappala et al.](https://www.cs.du.edu/~chrisg/publications/zappala-gis02s.pdf) — Worst-fit outperforms first-fit for growing blocks
- [Cisco WAE Capacity Planning](https://www.cisco.com/c/en/us/td/docs/net_mgmt/wae/7-6-0/design_user_guide/) — Candidate nodes + constraints
- [pynetbox](https://github.com/netbox-community/pynetbox) — Optional NetBox integration
- [Nautobot Design Builder](https://docs.nautobot.com/projects/design-builder/) — Lifecycle-managed designs
- [arXiv 2607.00292](https://arxiv.org/html/2607.00292) — LLM intent-driven topology design
- [CEGS GNN+LLM](https://github.com/jianmin-Liu/CEGS) — Graph embeddings for similarity-based placement
