# Plan: SNMP Trap Receiver

**Impact: HIGH | Effort: MEDIUM (3-4 days)**
**Status: COMPLETED**
**Dependencies: None**

---

## Goal
Receive and process SNMP traps from network devices (switches, routers, firewalls, servers) as real-time alert sources.

## Current State
- 105 network devices in CMDB with management IPs
- No SNMP trap receiver exists
- Alerts only from synthetic generators
- No real device monitoring capability

## Design

### SNMP Trap Receiver
- Listen on UDP port 162 (mapped to 1162 in Docker to avoid privileged port)
- Parse SNMPv1 traps, SNMPv2c traps, SNMPv3 traps
- Map OIDs to human-readable alert names
- Correlate with CMDB CIs by source IP

### OID Mapping (MIB-II + Cisco/Juniper standard traps)
- linkDown (1.3.6.1.6.3.1.1.5.3) -> critical
- linkUp (1.3.6.1.6.3.1.1.5.4) -> info
- cpmCPUHighThreshold -> high
- cpmMemoryThreshold -> high
- ciscoEnvMonTemperatureState -> critical
- ospfNbrStateChange -> medium
- rootBridgeChange -> medium
- authFailure -> high

### Trap Processing Pipeline
SNMP Trap received -> Parse with pysnmp -> Normalize to AlertCreate -> Map source IP to CI via CMDB -> Store in Redis -> Publish via WebSocket

## Implementation

### Backend (new plugin: plugins/snmp_receiver/)

1. **server.py** - pysnmp-based UDP trap receiver, SNMPv1/v2c/v3 support
2. **oid_mapper.py** - OID string to alert metadata dict, Cisco/Juniper/generic OIDs
3. **trap_parser.py** - Parse varbinds, extract source IP, OID, uptime, specific trap info
4. **ci_mapper.py** - Query PostgreSQL for CI by management_ip, cache in Redis (TTL 5min)
5. **main.py** - FastAPI app with health, stats, and trap history endpoints
6. **config.py** - Community string, Redis URL, DB URL settings
7. **Dockerfile** - pysnmp + fastapi + uvicorn

### Docker
- Add snmp-receiver service to docker-compose.yml
- Port mapping: 1162:162/udp

### Frontend
- SNMPTrapLog.tsx - Real-time trap stream with filters
- NOCAlerts.tsx - SNMP source indicator on SNMP-derived alerts

## Verification
1. Send test trap via snmptrap command
2. Alert appears in NOC with correct severity
3. CI auto-mapped from source IP
4. Multiple traps from same device -> dedup works
5. linkDown trap -> critical alert ->ack/resolve cycle works
