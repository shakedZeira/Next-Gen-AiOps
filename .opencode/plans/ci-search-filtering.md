# Plan: CI Search & Text Filtering

## Goal
Add real-time text search to CMDB Explorer for filtering CIs by name, type, team, site, and provider.

---

## Problem
Currently, CIs in the CMDB Explorer are only filterable by site (via dropdown) and service (via dropdown). There is no way to search for a specific CI by name or filter by type/team/provider without scrolling through the full list.

---

## Design

### Backend
No backend changes needed. The existing `GET /api/v1/cmdb/ci` endpoint returns all CIs. The search will be client-side since we only have 105 CIs — no need for server-side pagination or full-text search.

### Frontend

#### 1. Search Input in CMDBExplorer
Add a text search input in the toolbar (next to the existing Site/Flow/Service/View dropdowns):
- Placeholder: "Search CIs..."
- Real-time filtering as user types (debounced 200ms)
- Searches across: `name`, `type`, `team`, `site`, `provider`
- Case-insensitive substring match

#### 2. Filtered CI List
The existing CI list panel (right sidebar in detailed view) will be filtered by the search term:
- `filteredCIs` computation already exists for site filtering
- Extend it to also apply the search filter
- Show match count: "CIs (12 of 105)"

#### 3. Topology Graph Highlight
When a search term is entered:
- Highlight matching nodes in the topology graph (gold border)
- Dim non-matching nodes
- This reuses the existing `selectedService` visual filtering mechanism in TopologyGraph

---

## Files to Modify

| File | Change |
|------|--------|
| `ui/src/pages/CMDBExplorer.tsx` | Add `searchQuery` state, search input in toolbar, filter `filteredCIs` by search, pass search to TopologyGraph |
| `ui/src/components/TopologyGraph.tsx` | Add optional `searchQuery` prop, highlight matching nodes when search is active |
| `ui/src/pages/Docs.tsx` | Document the search feature |

---

## Implementation Steps

### Step 1: Add search state and input
1. Add `const [searchQuery, setSearchQuery] = useState('')` to CMDBExplorer
2. Add search input in the toolbar, between the Site dropdown and Flow dropdown
3. Style: `px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm` with search icon

### Step 2: Filter CIs by search
4. Update `filteredCIs` computation:
   ```typescript
   const filteredCIs = (selectedSite === 'all' ? cis : cis.filter((ci) => ci.site === selectedSite))
     .filter((ci) => {
       if (!searchQuery) return true;
       const q = searchQuery.toLowerCase();
       return ci.name.toLowerCase().includes(q) ||
              ci.type.toLowerCase().includes(q) ||
              (ci.team || '').toLowerCase().includes(q) ||
              (ci.site || '').toLowerCase().includes(q) ||
              (ci.provider || '').toLowerCase().includes(q);
     });
   ```

### Step 3: Highlight in topology graph
5. Add `searchQuery?: string` prop to TopologyGraph
6. In the filtering logic (after site/service filtering), add search highlighting:
   - Find nodes where name, type, team, or site matches the search query
   - Highlight those nodes with a distinct style (e.g., gold border)
   - If search is active, dim non-matching nodes

### Step 4: Reset on site change
7. Reset `searchQuery` to '' when `selectedSite` changes (alongside the existing `selectedService` and `selectedFlow` resets)

---

## Verification
1. Type "payment" in search → CI list shows only CIs with "payment" in name/type/team
2. Topology graph highlights matching nodes
3. Clear search → all CIs shown again
4. Change site → search resets
5. Search works in both Detailed and Site Overview view modes
6. ruff + mypy + npm build pass

---

## Effort
**LOW (0.5-1 day)** — Client-side filtering only, no backend changes, reuses existing visual filtering mechanism.
