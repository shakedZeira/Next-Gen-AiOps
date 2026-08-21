# Plan: IP Address Assignment

**Impact: MEDIUM | Effort: LOW (0.5 day)**
**Status: COMPLETED**
**Dependencies: None — standalone**

---

## Problem

CIs have no IP address fields. Only `DCRackEquipment.mgmt_ip` exists. No way to search by IP, use IPs for routing simulation, or display network addressing in the topology.

---

## Goal

Add IP address fields to all 105 CIs with realistic addressing per site, enabling IP-based search, routing simulation, and network visibility.

---

## Design

### Backend Changes

#### 1. Database Migration: `db/migrations/005_add_ci_ip_fields.sql`

```sql
ALTER TABLE ci ADD COLUMN management_ip INET;
ALTER TABLE ci ADD COLUMN loopback_ip INET;
ALTER TABLE ci ADD COLUMN subnet CIDR;

CREATE INDEX idx_ci_management_ip ON ci (management_ip);
CREATE INDEX idx_ci_loopback_ip ON ci (loopback_ip);
CREATE INDEX idx_ci_subnet ON ci USING GIST (subnet);
```

Using PostgreSQL `INET` and `CIDR` types for native IP operations (containment, overlap checks, range queries).

#### 2. ORM Model Update: `aiops_shared/models/ci.py`

Add three columns to `CI`:
```python
management_ip: Mapped[str | None] = mapped_column(String(45))  # IPv4 or IPv6
loopback_ip: Mapped[str | None] = mapped_column(String(45))
subnet: Mapped[str | None] = mapped_column(String(43))         # CIDR notation
```

Using String types for portability (INET/CIDR are PostgreSQL-specific at ORM level; app-level validation with `ipaddress` module).

#### 3. Schema Updates: `core_platform/cmdb/schemas.py`

Add IP fields to `CIResponse` and related DTOs.

#### 4. Repository Updates: `core_platform/cmdb/repository.py`

Include IP fields in topology node output:
```python
nodes = [{
    "id": str(ci.id), "name": ci.name, "type": ci.type,
    "team": ci.team, "site": ci.site,
    "management_ip": ci.management_ip,
    "loopback_ip": ci.loopback_ip,
}]
```

#### 5. Seed Data: `db/seed.py`

Assign realistic IPs following per-site addressing scheme:

| Site | Subnet | Addressing |
|------|--------|------------|
| global-hq | `10.0.0.0/16` | Routers: `10.0.{vlan}.{1-254}`, Servers: `10.0.10.{1-254}/24` |
| regional-dc-1 | `10.1.0.0/16` | Routers: `10.1.{vlan}.{1-254}`, Servers: `10.1.10.{1-254}/24` |
| metro-ring-1 | `10.2.0.0/16` | Ring nodes: `10.2.{vlan}.{1-254}` |
| branch-nyc | `10.3.0.0/16` | Hub: `10.3.0.1`, Spokes: `10.3.{vlan}.{1-254}` |
| branch-london | `10.4.0.0/16` | Hub: `10.4.0.1`, Spokes: `10.4.{vlan}.{1-254}` |

- Routers get loopback IPs (e.g., `10.{site}.{0}.{id}`)
- Switches get management IPs in management VLAN
- Servers/hosts get management IPs in their rack's management subnet
- Databases get loopback IPs for application connectivity

### Frontend Changes

#### 1. TopologyGraph.tsx
- Show IP in node tooltip on hover (title attribute or custom tooltip)
- When a node is selected, show IPs in the detail panel

#### 2. NodeDetailPanel.tsx
- Display management IP, loopback IP, subnet in the CI details section
- Format: copy-to-clipboard for each IP

#### 3. CMDBExplorer.tsx
- CI list items show primary IP address below the CI name
- Format: icon + name + "10.0.1.5" in gray text

---

## Implementation Steps

1. Create migration `005_add_ci_ip_fields.sql` and apply
2. Update ORM model `aiops_shared/models/ci.py`
3. Update schemas `core_platform/cmdb/schemas.py`
4. Update repository `core_platform/cmdb/repository.py` — topology node output
5. Update seed data `db/seed.py` — assign IPs to all CIs
6. Re-seed database (or run migration + IP update SQL directly)
7. Update frontend: TopologyGraph tooltip, NodeDetailPanel, CMDBExplorer CI list
8. Build + verify

---

## Verification

1. `GET /api/v1/cmdb/ci` returns IPs for all CIs
2. Topology nodes show IP on hover
3. Node detail panel displays all three IP fields
4. CI list in CMDB Explorer shows IP addresses
5. No IPs are duplicates within the same subnet
6. All IPs follow the per-site addressing scheme
7. npm build + ruff + mypy pass

---

## Files to Modify

| File | Change |
|------|--------|
| `db/migrations/005_add_ci_ip_fields.sql` | New migration |
| `aiops_shared/models/ci.py` | Add 3 IP columns |
| `core_platform/cmdb/schemas.py` | Add IP fields to DTOs |
| `core_platform/cmdb/repository.py` | Include IPs in topology output |
| `db/seed.py` | Assign IPs to all CIs |
| `ui/src/components/TopologyGraph.tsx` | IP tooltip on hover |
| `ui/src/components/NodeDetailPanel.tsx` | Display IP fields |
| `ui/src/pages/CMDBExplorer.tsx` | Show IP in CI list |
