# Plan: Traceroute Flow on Map + Failure Injection with Interface Selection + Alert Generation

## Context

The network simulation is integrated into CMDB Explorer, but three key gaps remain:

1. **Traceroute path on map**: Currently, traceroute highlights source/destination but not intermediate hops because (a) the path is passed as IPs but the mapping is weak, and (b) edge ordering uses Set insertion order instead of actual hop sequence.

2. **Failure injection**: No interface selection (fails ALL links on device), no visual feedback on the topology (edges don't turn red), and no alert is generated.

3. **Recovery**: No visual feedback — edges don't turn back to green (they just revert when the component re-renders, but no immediate visual cue).

## Changes

### 1. Backend: New endpoints + interface-aware failure

**File: `plugins/network_sim/engine.py`**
- Add `get_interfaces(device_id)` method → returns list of {name, ip, mac, up}
- Add `get_link_states()` method → returns list of {a_id, b_id, a_port, b_port, state}
- Modify `inject_failure()`: add optional `interface_name` param — if provided, only fail the specific link matching that interface port (instead of all links)
- Modify `recover()`: add optional `interface_name` param — same logic for recovery
- Modify return values to include `affected_link` info: `{a_id, b_id}` so frontend knows which edge to color

**File: `plugins/network_sim/main.py`**
- Add `GET /api/v1/network-sim/devices/{device_id}/interfaces`
- Add `GET /api/v1/network-sim/link-states`
- Update `FailureRequest` model: add optional `interface_name: str | None = None`
- Update `RecoveryRequest` model: add optional `interface_name: str | None = None`
- Update inject_failure/recover endpoints to pass interface_name

### 2. Frontend: Traceroute flow on map

**File: `ui/src/components/NodeDetailPanel.tsx`**
- Change `onTraceroute` callback to pass **device names** (not IPs), preserving hop order as an array: `string[]`
- Each hop already has `hostname` (device name from API's `device` field) — pass `hops.map(h => h.hostname)` in order

**File: `ui/src/components/TopologyGraph.tsx`**
- Change traceroute path matching: instead of matching IPs to management_ip/loopback_ip, match **device names** to node `label`
- Use the ordered array directly (not a Set) to preserve hop sequence for edge matching
- Keep the purple styling for traceroute nodes and edges

### 3. Frontend: Failed links state + visual feedback

**File: `ui/src/api/client.ts`**
- Add `alertsAPI.create(data)` → POST `/alerts` with {name, service, severity, description, team, labels}
- Add `networkSimAPI.getInterfaces(deviceId)` → GET `/network-sim/devices/{deviceId}/interfaces`
- Add `networkSimAPI.getLinkStates()` → GET `/network-sim/link-states`
- Update `networkSimAPI.injectFailure()` to accept optional `interface_name`
- Update `networkSimAPI.recover()` to accept optional `interface_name`

**File: `ui/src/components/TopologyGraph.tsx`**
- Add `failedLinks` prop: `Array<{a_id: string, b_id: string}>`
- Add Cytoscape style for `.failed-link` class: red color, solid line, wider
- In `buildGraph`, after creating elements, find edges where both source and target match any failed link pair → add `failed-link` class
- Add `.recovered-link` class for when links come back up (green pulse, then normal)

**File: `ui/src/pages/CMDBExplorer.tsx`**
- Add `failedLinks` state: `Array<{a_id: string, b_id: string}>`
- Add `refreshLinkStates()` function that calls `networkSimAPI.getLinkStates()` and updates state
- Pass `failedLinks` to TopologyGraph
- Pass `onFailureInjected` callback to NodeDetailPanel → triggers `refreshLinkStates()`
- Pass `onRecovered` callback to NodeDetailPanel → triggers `refreshLinkStates()`

**File: `ui/src/components/NodeDetailPanel.tsx`**
- Add `onFailureInjected?: () => void` and `onRecovered?: () => void` props
- Fetch interfaces when Actions tab is selected
- Show interface list with radio buttons (including "All Interfaces" option)
- Pass selected interface name to injectFailure/recover API calls
- After successful failure: call `alertsAPI.create()` with a critical alert, then call `onFailureInjected?.()`
- After successful recovery: call `onRecovered?.()`

### 4. Alert creation on failure

After a failure is injected, the frontend creates an alert via the existing `POST /api/v1/alerts` endpoint:
```
{
  name: "Network Failure: {device_name} - {interface_name}",
  service: "{device_name}",
  severity: "critical",
  description: "Simulated {failure_type} failure on {device_name} ({interface_name})",
  team: "network",
  labels: { source: "network-sim", device_id, interface: interface_name, failure_type }
}
```

## File Change Summary

| File | Change |
|------|--------|
| `plugins/network_sim/engine.py` | Add `get_interfaces()`, `get_link_states()`, update `inject_failure()`/`recover()` with interface_name |
| `plugins/network_sim/main.py` | Add 2 endpoints, update request models |
| `ui/src/api/client.ts` | Add 3 API methods, update 2 existing |
| `ui/src/components/TopologyGraph.tsx` | Add `failedLinks` prop + `.failed-link`/`.recovered-link` styles, fix traceroute matching to use device names |
| `ui/src/components/NodeDetailPanel.tsx` | Interface selection UI, alert creation on failure, callbacks for state refresh |
| `ui/src/pages/CMDBExplorer.tsx` | `failedLinks` state, `refreshLinkStates()`, pass new props |

## Verification

1. **Traceroute**: Click a switch → Ping/Trace tab → enter destination IP → Trace → all intermediate hops should light up purple on the map with edges between them
2. **Failure injection**: Click a switch → Actions tab → see interface list → select an interface → Inject Failure → the specific edge turns red on the map → a critical alert appears in NOC Alerts
3. **Recovery**: Same interface → Recover → edge turns back to green → alert can be resolved
4. **All links failure**: Select "All Interfaces" → Inject Failure → all edges connected to that device turn red
