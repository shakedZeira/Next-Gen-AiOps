# Plan: IP Address Search

**Impact: MEDIUM | Effort: LOW (0.25 day)**
**Status: COMPLETED**
**Dependencies: IP Address Assignment (Plan 2) must be completed first**

---

## Problem

No way to find a CI by its IP address. Operators often know an IP (from alerts, logs, or traceroute output) but not the device name. Requires IP fields on CIs (Plan 2).

---

## Goal

Add IP-based search to CMDB Explorer and a quick IP resolution endpoint, enabling operators to paste an IP and instantly find the owning CI.

---

## Design

### Backend Changes

#### 1. IP Search on CI List: `GET /api/v1/cmdb/ci?ip=10.0.1.5`

Add `ip` query parameter to the existing CI list endpoint. Searches `management_ip` and `loopback_ip` using exact match and subnet containment:

```sql
SELECT * FROM ci
WHERE management_ip = :ip::inet
   OR loopback_ip = :ip::inet
   OR subnet >>= :ip::cidr;
```

The `>>=` operator checks if an IP is contained within a CIDR subnet.

#### 2. IP Resolution Endpoint: `GET /api/v1/cmdb/resolve-ip/{ip}`

Dedicated endpoint for IP-to-CI lookup. Returns the CI that "owns" this IP:
- Exact match on `management_ip` or `loopback_ip` (highest priority)
- Subnet containment match via `subnet >>= :ip::cidr` (fallback)
- Returns 404 if no CI found

Response:
```json
{
  "ip": "10.0.1.5",
  "match_type": "management_ip",
  "ci": { "id": "...", "name": "dc1-core-sw-1", "type": "switch", ... }
}
```

#### 3. Repository Method: `resolve_ip(ip: str)`

New method in `CMDBRepository`:
```python
async def resolve_ip(self, ip: str) -> dict | None:
    # 1. Exact match management_ip
    # 2. Exact match loopback_ip
    # 3. Subnet containment
    # Return first match with match_type
```

### Frontend Changes

#### 1. IP Search Field in CMDBExplorer

Add a dedicated IP search input in the toolbar (next to existing text search):
- Placeholder: "Search by IP..."
- Validates input is a valid IP address (client-side with `ipaddr` or regex)
- Calls `GET /api/v1/cmdb/ci?ip={ip}` when IP is entered
- Filters CI list to show only matching CIs
- Highlights matching node(s) in topology with cyan border

#### 2. IP Search in TopologyGraph

When IP search is active, topology highlights matching nodes:
- Matching node gets cyan border (distinct from gold search highlight and yellow service highlight)
- Non-matching nodes dimmed
- Intersects with existing site/service/text search filters

#### 3. Quick IP Resolution in NOC Alerts

Add "Resolve IP" button in NOC Alerts page:
- Modal with IP input field
- Calls `GET /api/v1/cmdb/resolve-ip/{ip}`
- Shows CI name, type, site, and link to CMDB Explorer
- Useful when alerts contain source IPs

### Search Composition

All filters compose together (AND logic):

| Filter | Field | Highlight Color |
|--------|-------|-----------------|
| Text search | name, type, team, site, provider | Gold border |
| Service filter | service membership | Gold border |
| IP search | management_ip, loopback_ip, subnet | Cyan border |

When multiple filters are active, only CIs matching ALL filters are shown/highlighted.

---

## Implementation Steps

1. Add `resolve_ip()` method to `core_platform/cmdb/repository.py`
2. Add `GET /api/v1/cmdb/resolve-ip/{ip}` endpoint to `core_platform/routers/cmdb.py`
3. Add `ip` query parameter to `GET /api/v1/cmdb/ci` endpoint
4. Add `resolveIp()` and `searchByIp()` methods to `ui/src/api/client.ts`
5. Add IP search input to CMDBExplorer toolbar
6. Update `filteredCIs` to include IP search
7. Update TopologyGraph to accept and highlight by IP
8. Add "Resolve IP" modal in NOCAlerts
9. Build + verify

---

## Verification

1. Type `10.0.1.5` in IP search -> CI list shows only the matching CI
2. Topology highlights the matching node with cyan border
3. `GET /api/v1/cmdb/resolve-ip/10.0.1.5` returns the correct CI
4. IP search composes with text search and service filter
5. "Resolve IP" in NOC Alerts returns CI details
6. Invalid IP input shows validation error
7. npm build + ruff + mypy pass

---

## Files to Modify

| File | Change |
|------|--------|
| `core_platform/cmdb/repository.py` | Add `resolve_ip()` method |
| `core_platform/routers/cmdb.py` | Add `/resolve-ip/{ip}` endpoint, `ip` param on `/ci` |
| `ui/src/api/client.ts` | Add `resolveIp()`, `searchByIp()` methods |
| `ui/src/pages/CMDBExplorer.tsx` | IP search input, filter composition |
| `ui/src/components/TopologyGraph.tsx` | IP-based highlighting |
| `ui/src/pages/NOCAlerts.tsx` | "Resolve IP" modal |
