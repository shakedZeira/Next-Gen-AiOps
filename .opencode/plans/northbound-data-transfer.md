# Plan: Northbound Data Transfer

**Impact: LOW-MEDIUM | Effort: LOW (1-2 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Forward alerts and events to external higher-level systems (SIEM, ticketing, dashboards) via webhooks or REST APIs.

## Current State
- Alerts stay within the platform
- No outbound event forwarding
- No webhook support

## Design

### Forwarding Destinations
- Configurable webhook URLs (JSON POST)
- Filter by severity, service, team
- Async delivery with retry

### Event Format
```json
{
  "source": "nextgen-aiops",
  "event_type": "alert.created",
  "timestamp": "2026-08-23T12:00:00Z",
  "alert": { ... },
  "service": "Payment Gateway",
  "severity": "critical"
}
```

## Implementation

### Backend
1. `plugins/northbound/forwarder.py` (NEW) - async webhook delivery
   - `forward(event, destinations)` - fan-out to webhooks
   - Retry with exponential backoff (3 attempts)
   - Dead letter queue for failed deliveries
2. `plugins/northbound/config.py` (NEW) - destination config
   - `GET/POST /api/v1/northbound/config` - manage destinations
   - Stored in Redis hash
3. Wire into alert-noc store.py: forward on every alert event

### Frontend
4. `ui/src/components/NorthboundConfig.tsx` (NEW) - webhook config UI
   - Add/edit/delete webhook URLs
   - Filter rules (severity, service)
   - Test button
5. `ui/src/api/client.ts` - northboundAPI

## Verification
1. Configure webhook URL -> critical alert -> POST received
2. Filter by severity -> only critical forwarded
3. Webhook down -> retry, then dead letter
4. Test button -> sends test event
