# Plan: Fix GeoMap Site Drill-Down — Topology Inside Circle with Fade-In

## Root Cause Analysis

The topology overlay is **not appearing** because of two bugs:

1. **`topoOverlayRef` is never assigned** — it's declared as `useRef<L.DivOverlay>(null)` but never connected to anything. `updateOverlayPosition` calls `overlay.setLatLng()` on `null`, so `overlayStyle` never gets updated.

2. **Positioning is wrong** — The overlay uses `left: 50%, top: 50%` which puts it at the center of the map container, but after `flyTo`, the site center may not be exactly at the container center (flyTo animates and may overshoot). There's no tracking of the actual pixel position.

## Approach: Pixel-position the topology div using `latLngToContainerPoint`

Instead of the broken Leaflet DivOverlay approach, use Leaflet's built-in coordinate→pixel conversion to position a React div exactly over the site's geographic center.

### Changes to `ui/src/components/GeoMap.tsx`:

**1. Replace state/refs:**
- Remove `topoOverlayRef` (unused Leaflet DivOverlay ref)
- Remove `overlayStyle` state
- Add `overlayPos` state: `{ x: number; y: number; radius: number; visible: boolean }`

**2. Rewrite `updateOverlayPosition`:**
```ts
const updateOverlayPosition = useCallback(() => {
  const map = mapInstanceRef.current;
  if (!map || !focusedSite) return;
  const siteData = sites.find(s => s.site === focusedSite);
  if (!siteData) return;

  const point = map.latLngToContainerPoint([siteData.lat, siteData.lng]);
  const zoom = map.getZoom();
  const metersPerPixel = 156543.03392 * Math.cos((siteData.lat * Math.PI) / 180) / Math.pow(2, zoom);
  const pixelRadius = SITE_RADIUS_METERS / metersPerPixel;

  setOverlayPos({ x: point.x, y: point.y, radius: pixelRadius, visible: true });
}, [focusedSite, sites]);
```

**3. Trigger fade-in after flyTo completes:**
- `flyTo` fires a `moveend` event when animation finishes
- Listen for `moveend` once after `focusOnSite`, then call `updateOverlayPosition` with a small delay for the topology to render
- Also call `updateOverlayPosition` on every `zoomend`/`moveend` to keep position synced

**4. Add fade-in animation:**
- Topology overlay div starts with `opacity: 0` and `transition: opacity 0.6s ease-in-out`
- After data loads and position is set, set `visible: true` → opacity becomes 1
- Remove the div entirely when not focused (instant disappearance)

**5. Fix the render positioning:**
```tsx
{focusedSite && siteTopology && overlayPos.visible && (
  <div
    className="absolute z-[999] rounded-full overflow-hidden border-2 border-blue-500/50 pointer-events-auto transition-opacity duration-700"
    style={{
      left: overlayPos.x - overlayPos.radius,
      top: overlayPos.y - overlayPos.radius,
      width: overlayPos.radius * 2,
      height: overlayPos.radius * 2,
      opacity: 1,
    }}
  >
    <div className="w-full h-full bg-gray-900">
      <TopologyGraph topology={siteTopology} selectedSite={focusedSite} height="h-full" />
    </div>
  </div>
)}
```

**6. Handle the loading→loaded transition:**
- When `focusOnSite` is called: set `overlayPos.visible = false` (topology hidden)
- After topology data loads + flyTo finishes: call `updateOverlayPosition()` which sets `visible: true`
- This creates the fade-in effect: circle appears first (Leaflet layer), then topology fades in on top

**7. Sync on zoom/pan:**
```ts
useEffect(() => {
  const map = mapInstanceRef.current;
  if (!map || !focusedSite) return;
  const handler = () => updateOverlayPosition();
  map.on('zoomend moveend', handler);
  return () => { map.off('zoomend moveend', handler); };
}, [updateOverlayPosition, focusedSite]);
```

### Changes to TopologyGraph (minor):
- The TopologyGraph renders a Cytoscape graph inside a `div` with `w-full ${height}`. When `height="h-full"`, Cytoscape should fill the circular container.
- No changes needed — Cytoscape auto-resizes to its container.

### Files to modify:
- `ui/src/components/GeoMap.tsx` — main changes (positioning, fade-in, cleanup)

### Verification:
1. `cd ui && npx tsc --noEmit` — TypeScript compiles
2. `docker compose build api-gateway ui && docker compose up -d`
3. Open http://localhost:3000 → CMDB Explorer → Geo Map
4. Click site → "Zoom In" → map flies to site, blue circle appears, topology fades in inside the circle
5. Zoom in/out → topology resizes and stays centered on the circle
6. Click "← Global" → topology fades out, map zooms back
