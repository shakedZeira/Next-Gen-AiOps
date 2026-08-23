# Plan: External Systems Integration (DCIM, SolarWinds, SCOM, Splunk, LiveAction, FNT)

**Impact: MEDIUM | Effort: MEDIUM (2-3 days per system)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Bidirectional integration with external monitoring and management systems to enrich topology, alerts, and operational context.

## Current State
- Standalone platform
- No external system connections
- Manual data entry for cross-system correlation

## Design

### Supported Systems
| System | Type | Direction |
|--------|------|-----------|
| SolarWinds | Network monitoring | Import alerts + metrics |
| SCOM | Windows monitoring | Import alerts |
| Splunk | Log analytics | Export alerts, import logs |
| LiveAction | Network analytics | Import flow data |
| DCIM | Data center infra | Import power/environment |
| FNT | Network management | Import topologies |

### Integration Pattern
Each system -> Plugin adapter -> Normalize to internal format -> Store/enrich

## Implementation

### Backend (per system)
1. `plugins/integrations/solarwinds.py` (NEW) - SolarWinds SWIS API
2. `plugins/integrations/scom.py` (NEW) - SCOM REST API
3. `plugins/integrations/splunk.py` (NEW) - Splunk HEC + REST
4. `plugins/integrations/liveaction.py` (NEW) - LiveAction API
5. `plugins/integrations/dcim.py` (NEW) - DCIM API
6. `plugins/integrations/fnt.py` (NEW) - FNT API
7. `plugins/integrations/adapter.py` (NEW) - base adapter class

### Frontend
8. `ui/src/pages/IntegrationsDashboard.tsx` (NEW) - connected systems status
9. `ui/src/components/SystemStatusBadge.tsx` (NEW) - connection health indicator

## Verification
1. Connect SolarWinds -> alerts imported
2. Connect Splunk -> logs correlated with alerts
3. System disconnect -> status shows red
4. Reconnect -> data sync resumes
