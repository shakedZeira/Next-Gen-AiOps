# Plan: Syslog Collection

**Impact: HIGH | Effort: LOW-MEDIUM (2-3 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Receive and process syslog messages (RFC 3164 / RFC 5424) from network devices, servers, and applications as alert sources.

## Current State
- Alerts only come from REST API (synthetic generators, infra_simulator)
- No real device log ingestion
- No syslog server capability
- Network devices (105 in CMDB) have no log pipeline

## Design

### Syslog Server
- TCP + UDP listener on port 514 (mapped to 1514 in Docker)
- Parse RFC 3164 (BSD) and RFC 5424 (new) formats
- Normalize into unified event model
- Store in Redis (same store as alerts)

### Normalization
| Field | Source |
|-------|--------|
| `name` | Extracted from message (pattern matching) |
| `service` | Inferred from hostname → CI mapping |
| `severity` | Syslog priority → severity mapping |
| `description` | Full syslog message |
| `team` | Inferred from service owner |
| `labels` | Facility, host, app-name |

### Severity Mapping
| Syslog Level | Alert Severity |
|-------------|---------------|
| 0-2 (Emergency, Alert, Critical) | critical |
| 3-4 (Error, Warning) | high |
| 5-6 (Notice, Info) | medium |
| 7 (Debug) | low |

### Alert Patterns
| Pattern | Alert Name |
|---------|------------|
| `%UP` / `%LINK-UP` | Interface Up |
| `%DOWN` / `%LINK-DOWN` | Interface Down |
| `%STP` | Spanning Tree Change |
| `%OSPF` | OSPF Neighbor Change |
| `%CPU` | High CPU Usage |
| `%MEMORY` | High Memory Usage |
| `%Disk` | Disk Space Alert |
| `%auth` / `%login` | Authentication Failure |
| `%TEMP` | Temperature Alert |
| `%POWER` | Power Supply Alert |

## Implementation

### Backend

#### 1. Syslog receiver plugin
- File: `plugins/syslog_receiver/server.py` (NEW)
- Async UDP server (asyncio protocol)
- Async TCP server (asyncio protocol)
- Parse both RFC 3164 and RFC 5424
- Normalize into AlertCreate model

#### 2. Pattern matcher
- File: `plugins/syslog_receiver/patterns.py` (NEW)
- Regex patterns for common network/device alerts
- Map matched patterns to alert names and severities

#### 3. Hostname → CI mapper
- File: `plugins/syslog_receiver/mapper.py` (NEW)
- Query CMDB for CI by hostname/management_ip
- Cache mappings in Redis

#### 4. FastAPI app
- File: `plugins/syslog_receiver/main.py` (NEW)
- Health endpoint
- Syslog stats endpoint (messages received, alerts generated)
- Start UDP/TCP servers in lifespan

#### 5. Docker service
- File: `plugins/syslog_receiver/Dockerfile` (NEW)
- Expose ports 514 (UDP/TCP) → mapped to 1514/1515 on host
- Connect to Redis and PostgreSQL

#### 6. Docker Compose
- File: `docker-compose.yml`
- Add `syslog-receiver` service
- Port mapping: 1514:514/udp, 1515:514/tcp

### Frontend

#### 7. Syslog viewer (optional)
- File: `ui/src/pages/SyslogViewer.tsx` (NEW)
- Raw syslog message stream (like `tail -f`)
- Filter by facility, severity, host
- Click message → navigate to related CI/Alert

#### 8. NOC integration
- File: `ui/src/pages/NOCAlerts.tsx`
- Show "Syslog" as alert source in alert table

## Files to Create/Modify
- `plugins/syslog_receiver/server.py` — NEW: UDP/TCP syslog server
- `plugins/syslog_receiver/patterns.py` — NEW: alert pattern matching
- `plugins/syslog_receiver/mapper.py` — NEW: hostname → CI mapping
- `plugins/syslog_receiver/main.py` — NEW: FastAPI app
- `plugins/syslog_receiver/config.py` — NEW: configuration
- `plugins/syslog_receiver/Dockerfile` — NEW: container build
- `docker-compose.yml` — add syslog-receiver service
- `ui/src/pages/NOCAlerts.tsx` — syslog source indicator
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. `echo "<13>Aug 23 12:00:00 hq-core-sw-1 %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up" | nc -u localhost 1514`
2. Alert appears in NOC: "Interface Up" on hq-core-sw-1
3. CI auto-mapped from hostname
4. Severity correctly mapped from syslog priority
5. Multiple messages → dedup works
