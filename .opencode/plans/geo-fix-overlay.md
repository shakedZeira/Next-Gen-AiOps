# Plan: Geo Map Site Drill-Down — Topology Inside Circle with Fade-In ✅ COMPLETED

## Root Cause Analysis (was)

1. **`topoOverlayRef` was never assigned** — always null, so `overlayStyle` never updated
2. **Positioning was wrong** — `left: 50%, top: 50%` didn't track geographic position

## Solution Implemented

Use Leaflet's `latLngToContainerPoint()` to position the topology div exactly over the site's geographic center.

### Changes Made to `ui/src/components/GeoMap.tsx`:

1. **Replaced refs/state:**
   - Removed `topoOverlayRef` (unused Leaflet DivOverlay ref)
   - Removed `overlayStyle` state
   - Added `overlayPos` state: `{ x: number; y: number; radius: number }`
   - Added `overlayVisible` state for fade-in animation

2. **`calcOverlayPos()` function:**
   - Uses `map.latLngToContainerPoint([lat, lng])` for pixel coordinates
   - Calculates pixel radius from zoom level: `SITE_RADIUS_METERS / metersPerPixel`
   - Returns `{ x, y, radius }`

3. **Fade-in animation:**
   - Overlay starts with `opacity: 0`
   - After flyTo completes (1.6s) + 200ms delay, `overlayVisible = true`
   - CSS `transition: opacity 0.8s ease-in-out` creates smooth fade

4. **Position sync:**
   - `zoomend`/`moveend` listeners call `calcOverlayPos()`
   - Overlay stays locked to the circle during pan/zoom

5. **Render positioning:**
   ```
   left: x - radius, top: y - radius
   width: radius * 2, height: radius * 2
   ```
   With `rounded-full overflow-hidden` for circular clip.

## Result
- Click site → "Zoom In" → map flies to site
- Blue dashed circle appears
- Topology graph fades in inside the circle
- Position stays synced on zoom/pan
- "← Global" button zooms back out
