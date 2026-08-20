# Plan: Geo Map Site Drill-Down

## Goal
When clicking a site on the geo map, zoom into that site and show its internal connections geographically (device pins + connection lines), with a compact info overlay and a "View Full Topology" button.

## Current State
- `GeoMap.tsx` shows all 5 sites with colored markers, inter-site connection lines, and animated flow overlays
- Clicking a site navigates away to the Cytoscape aggregated topology view (`setViewMode('aggregated')`)
- `SiteGeoMap.tsx` exists but is orphaned (never imported anywhere)
- `/sites/{name}/map-data` returns pins with synthetic coordinates around site center
- `/topology/site/{name}` returns nodes + edges for a site's internal topology
- `__setSiteOverview` window function exists but is never triggered

## Approach: Modify GeoMap to support focused site mode

### Step 1: Add focused site state to GeoMap
- Add `focusedSite: string | null` state
- Add `sitePins: SiteMapPin[]` state
- Add `siteTopology: { nodes: any[], edges: any[] } | null` state
- Add `siteOverview: SiteOverview | null` state
- Add `loadingSite: boolean` state

### Step 2: Handle site click → zoom into site
- When a site marker is clicked (popup button or direct click):
  1. Set `focusedSite` to the site name
  2. Fetch `/sites/{name}/map-data` and `/topology/site/{name}` and `/sites/{name}/overview` in parallel
  3. Zoom the map to the site center with `map.flyTo(center, 15)`
  4. Hide inter-site connection lines and flow overlays when focused

### Step 3: Render site internals on the map
- **Device pins**: Render each pin from `sitePins` as a colored marker (reuse the colored square icons from SiteGeoMap)
- **Connection lines**: Match topology edges to pin coordinates, draw polylines between connected devices
  - Color by connection type (routes_to=blue, contains=gray, etc.)
  - Thicker lines for more important connections
- **Site boundary**: Draw a dashed circle at the site center (300m radius) to indicate site perimeter

### Step 4: Compact info overlay on the map
- Show a small panel (top-left) with:
  - Site name + type badge
  - Device count, room count, racks
  - Teams as tags
  - "View Full Topology" button → calls `onSiteClick` to navigate to Cytoscape view
  - "← Back to Global" button → resets `focusedSite` to null, zooms back out

### Step 5: Back to global view
- "Back to Global" button:
  1. Set `focusedSite = null`
  2. Clear site pins, topology, overview
  3. `map.flyTo([39.5, -98.5], 4)` to zoom back to global
  4. Re-show inter-site connections and flows

### Step 6: Cleanup
- Delete `SiteGeoMap.tsx` (orphaned, no longer needed)
- Remove unused `SiteGeoMap` import from CMDBExplorer (already removed)
- Remove `window.__setSiteOverview` from GeoMap (replaced by internal state)

## Files to modify
- `ui/src/components/GeoMap.tsx` — main changes (add focused site mode)
- `ui/src/components/SiteGeoMap.tsx` — delete (orphaned)
- `ui/src/types/index.ts` — no changes needed (types already exist)
- `ui/src/api/client.ts` — no changes needed (methods already exist)

## Backend: No changes needed
- `/sites/{name}/map-data` already returns pins with coordinates
- `/topology/site/{name}` already returns nodes + edges
- `/sites/{name}/overview` already returns site overview data

## Verification
1. `cd ui && npx tsc --noEmit` — TypeScript compiles
2. `docker compose build api-gateway ui && docker compose up -d` — builds and runs
3. Open http://localhost:3000 → CMDB Explorer → Geo Map tab
4. Click a site marker → map zooms in, shows device pins and connections
5. Click "View Full Topology" → navigates to Cytoscape view
6. Click "Back to Global" → zooms back out to global view
