# Plan: Impact Analysis Visualization

**Impact: MEDIUM | Effort: LOW (0.5 day)**
**Status: NOT STARTED**
**Dependencies: None — backend endpoint already exists**

---

## Goal
Highlight downstream blast radius on topology when a CI fails.

## Current State
- Backend endpoint exists: `GET /api/v1/cmdb/impact/{ci_id}` returns affected CIs with depth levels
- Frontend has no UI to trigger or display impact analysis
- TopologyGraph component supports node highlighting via `highlightedNodes` prop

## Implementation

### Backend (No changes needed)
The `/impact/{ci_id}` endpoint already returns:
```json
{
  "ci_id": "...",
  "impact_depth": 3,
  "affected_cis": [
    {"id": "...", "name": "...", "type": "...", "depth": 1},
    ...
  ]
}
```

### Frontend

#### 1. Add "Show Impact" button to NodeDetailPanel
- File: `ui/src/components/NodeDetailPanel.tsx`
- Add a purple "Show Impact" button below the CI name
- On click: call `cmdbAPI.getImpact(ci.id)`
- Store result in `impactData` state

#### 2. Pass impact data to TopologyGraph
- File: `ui/src/components/TopologyGraph.tsx`
- Add `highlightedNodes?: string[]` prop (already exists)
- Add `highlightColor?: string` prop (default: red)
- When impact data loaded: pass affected CI IDs as `highlightedNodes`
- Highlight affected nodes with red border + pulse animation

#### 3. Show impact summary
- File: `ui/src/components/NodeDetailPanel.tsx`
- After loading impact data, show:
  - "Impact Depth: N levels"
  - "Affected CIs: N devices"
  - List of affected CIs with depth (clickable to navigate)

#### 4. Clear impact on node deselect
- When user clicks different node or closes panel, clear `impactData` and `highlightedNodes`

## Files to Modify
- `ui/src/components/NodeDetailPanel.tsx` — add impact button + summary
- `ui/src/components/TopologyGraph.tsx` — ensure highlightedNodes works (may already work)

## Verification
1. Click a router node in topology
2. Click "Show Impact" button
3. Downstream CIs highlight in red
4. Summary shows depth and affected count
5. Click affected CI in list → navigates to that node
