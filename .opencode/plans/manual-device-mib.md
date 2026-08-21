# Plan: Manual Device + MIB Loading

**Impact: HIGH | Effort: MEDIUM (2-3 days)**
**Dependencies: None — standalone**

---

## Problem

All devices are pre-seeded. No way to add new devices manually or import their management capabilities via MIB files. Operators cannot onboard real devices discovered outside the platform.

---

## Goal

Enable manual device onboarding with a wizard form, and MIB file upload/parsing to auto-discover device interfaces, IPs, and capabilities via SNMP.

---

## Research Summary

### What MIB Files Contain

MIB files are plain-text ASN.1 documents describing managed objects a device exposes. They contain **no runtime values**, only schema definitions:

| Element | Purpose |
|---------|---------|
| `OBJECT-TYPE` | Managed object: OID position, SYNTAX type, MAX-ACCESS, DESCRIPTION |
| Tables (`SEQUENCE OF`) | Multi-instance data (e.g., one row per interface) with INDEX clause |
| `TRAP-TYPE` / `NOTIFICATION-TYPE` | Async events (link down, threshold exceeded) |
| `MODULE-COMPLIANCE` | Which subsets a device implements |

### Key MIBs for Auto-Discovery

| MIB | OIDs | CI Properties Discovered |
|-----|------|-------------------------|
| SNMPv2-MIB | sysDescr, sysObjectID, sysName, sysLocation, sysUpTime | OS, vendor/model, hostname, location, uptime |
| IF-MIB | ifTable, ifXTable | Interface names, types, MACs, speed, status, MTU |
| IP-MIB | ipAddrTable, ipNetToPhysical | IP addresses, ARP table |
| ENTITY-MIB | entPhysicalTable | Serial numbers, model names, vendor types |
| LLDP-MIB | lldpRemSysName, lldpRemPortId | Neighbor relationships (auto-topology!) |

### Libraries

- **pysmi** ([lextudio/pysmi](https://github.com/lextudio/pysmi)) — MIB compiler: parses ASN.1 MIBs → JSON node trees. Handles SMIv1/v2 + broken vendor dialects.
- **pysnmp** v7 ([pysnmp/pysnmp](https://github.com/pysnmp/pysnmp)) — Async SNMP walker. Uses pysmi under the hood for OID name resolution.

### References

- [leezii/MIBFileParser](https://github.com/leezii/MIBFileParser) — pysmi + Flask + drag-drop upload + tree viewer
- [shmuto/mib-browser](https://github.com/shmuto/mib-browser) — React 18 + TypeScript MIB browser (same stack)

---

## Architecture

### New Plugin: `plugins/snmp_mib/`

```
plugins/snmp_mib/
  main.py              # FastAPI app, lifespan, health
  config.py            # pydantic-settings: MIB dirs, SNMP defaults
  schemas.py           # Pydantic models: DeviceCreate, MibModule, MibNode, etc.
  mib_compiler.py      # pysmi MibCompiler wrapper — compile MIBs to JSON
  mib_store.py         # PostgreSQL: mib_module, mib_node tables
  device_onboard.py    # Manual device creation CI + relationships + equipment
  snmp_discover.py     # pysnmp v7 asyncio walks: system -> IF-MIB -> IP-MIB -> LLDP
  router.py            # REST endpoints
  Dockerfile
```

### Database Tables

```sql
-- MIB modules (one row per uploaded .mib file)
CREATE TABLE mib_module (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES ci(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,        -- e.g., "IF-MIB"
    oid_root VARCHAR(100),             -- e.g., "1.3.6.1.2.1.31"
    organization TEXT,
    description TEXT,
    last_updated DATE,
    status VARCHAR(50),                -- current, deprecated, obsolete
    imports JSONB,                     -- dependency list
    raw_file BYTEA,                   -- original MIB file bytes
    parsed_json JSONB,                -- full pysmi JSON output
    compile_log TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- MIB nodes (individual OIDs within a module)
CREATE TABLE mib_node (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES mib_module(id) ON DELETE CASCADE,
    oid VARCHAR(100) NOT NULL,
    parent_oid VARCHAR(100),
    name VARCHAR(255) NOT NULL,        -- e.g., "ifTable"
    nodetype VARCHAR(50),              -- scalar, column, table, notification, identity
    syntax JSONB,                      -- {type: "Integer32", range: [0,100]}
    max_access VARCHAR(50),            -- read-only, read-write, not-accessible
    description TEXT,
    INDEX_clause JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mib_node_oid ON mib_node (oid);
CREATE INDEX idx_mib_node_name ON mib_node USING GIN (name gin_trgm_ops);
CREATE INDEX idx_mib_node_module ON mib_node (module_id);
```

### API Surface

Mounted at `/api/v1/snmp-mib`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/devices` | POST | Add device manually (name, type, site, IPs, credentials) |
| `/devices` | GET | List manually added devices |
| `/devices/{id}` | GET | Device details + discovered interfaces/IPs |
| `/devices/{id}/mibs` | POST | Upload MIB files (.mib/.txt/.zip multipart) |
| `/devices/{id}/discover` | POST | SNMP walk to auto-populate interfaces, IPs, serials |
| `/mibs` | GET | List all loaded MIB modules |
| `/mibs/{name}` | GET | MIB module details + node count |
| `/mibs/{name}/tree` | GET | OID tree for browser (nested children) |
| `/mibs/search` | GET | Search MIB nodes by name or OID (`?q=` or `?oid=`) |

### Frontend Pages

#### 1. Add Device Wizard (`AddDeviceWizard.tsx`)

Multi-step form:
1. **Identity:** name, type (dropdown), vendor, model
2. **Location:** site (dropdown), DC room, rack, U-position
3. **Network:** management IP, loopback IP, subnet
4. **SNMP:** community string (v2c) or USM credentials (v3) — optional, enables discovery
5. **Review:** summary before creation

On submit: creates CI + DCRackEquipment + relationships (connects_to uplink device).

#### 2. MIB Management Page (`MibManagement.tsx`)

- **Upload zone:** drag-drop MIB files, upload progress, compilation status
- **Per-device MIB list:** shows loaded modules, compile errors/warnings
- **OID tree browser:** recursive expandable tree, search/filter, click for details (syntax, access, description)
- **Conflict detection:** warn when two modules define the same OID

#### 3. Discovery Results Review (`DiscoveryResults.tsx`)

After SNMP walk:
- Table of discovered interfaces (name, type, MAC, speed, status)
- Table of discovered IP addresses (IP, interface, subnet)
- Table of discovered neighbors (LLDP: remote device, port)
- Checkbox to select which to commit to CMDB
- "Commit" button creates interfaces as child CIs, adds IPs, creates neighbor relationships

---

## Implementation Steps

### Phase 1: Manual Device Onboarding (0.5 day)
1. Create migration for `mib_module` and `mib_node` tables
2. Add ORM models to `aiops_shared/models/`
3. `plugins/snmp_mib/device_onboard.py` — CI + equipment creation
4. `POST /devices` endpoint
5. Frontend: AddDeviceWizard component

### Phase 2: MIB Upload + Compilation (1 day)
1. `plugins/snmp_mib/mib_compiler.py` — pysmi wrapper
2. `plugins/snmp_mib/mib_store.py` — store parsed modules and nodes
3. `POST /devices/{id}/mibs` endpoint
4. `GET /mibs`, `GET /mibs/{name}/tree`, `GET /mibs/search` endpoints
5. Frontend: MibManagement page with upload + tree browser

### Phase 3: SNMP Discovery (1 day)
1. `plugins/snmp_mib/snmp_discover.py` — pysnmp v7 asyncio walks
2. Walk sequence: system group -> IF-MIB -> IP-MIB -> ENTITY-MIB -> LLDP-MIB
3. OID name resolution through loaded MIBs
4. `POST /devices/{id}/discover` endpoint
5. Frontend: DiscoveryResults review page

---

## Verification

1. Add a device manually via wizard -> CI + equipment created in CMDB
2. Upload a MIB file -> compilation succeeds, tree browser shows OID hierarchy
3. Search MIB nodes by name -> results appear
4. SNMP discovery on a simulated device -> interfaces/IPs/neighbors populated
5. Discovery results review shows correct data before commit
6. No duplicate CIs created on re-discovery (idempotent)
7. npm build + ruff + mypy pass

---

## Key References

- [lextudio/pysmi](https://github.com/lextudio/pysmi) — MIB compiler
- [pysnmp/pysnmp](https://github.com/pysnmp/pysnmp) — SNMP library v7
- [leezii/MIBFileParser](https://github.com/leezii/MIBFileParser) — Reference implementation
- [shmuto/mib-browser](https://github.com/shmuto/mib-browser) — React MIB browser
- [IANA Enterprise Numbers](https://www.iana.org/assignments/enterprise-numbers/enterprise-numbers) — Vendor PEN registry
