# Plan: Geo Map Enhancements

## Goal
Enhance the Leaflet geo map with animated traffic flows between sites and a zoomed-in site-level map showing indoor assets.

---

## Part A: Inter-Site Flow Animation

### Current State
- `GeoMap.tsx` renders dashed polylines between sites using `L.polyline` with `dashArray: '8, 6'`
- Lines are static, colored by connection type (MPLS=blue, SD-WAN=green, VPN=orange)
- No traffic data, no animation, no utilization info

### Target State
- Animated dashed lines showing flow direction (CSS `stroke-dashoffset` animation)
- Line thickness varies by utilization (1px = low, 6px = high)
- Line color reflects health status (green=healthy, yellow=degraded, red=critical)
- Hover tooltip shows: connection type, bandwidth, utilization %, latency, status
- Toggle button to show/hide flow overlay
- Flow legend in the map corner

### Backend Changes

**File: `core_platform/routers/cmdb.py`**

Add endpoint `GET /api/v1/cmdb/topology/inter-site/flows`:

```python
@router.get("/topology/inter-site/flows")
async def get_inter_site_flows(_user=Depends(get_current_user)):
    # Realistic mock traffic data for 5 inter-site connections
    return [
        {
            "source_site": "global-hq",
            "target_site": "regional-dc-1",
            "connection_type": "mpls",
            "bandwidth_mbps": 10000,
            "utilization_pct": 67,
            "latency_ms": 12,
            "status": "healthy",
            "packets_per_sec": 145000,
            "errors_per_sec": 2
        },
        {
            "source_site": "global-hq",
            "target_site": "metro-ring-1",
            "connection_type": "mpls",
            "bandwidth_mbps": 5000,
            "utilization_pct": 43,
            "latency_ms": 28,
            "status": "healthy",
            "packets_per_sec": 87000,
            "errors_per_sec": 0
        },
        {
            "source_site": "regional-dc-1",
            "target_site": "branch-nyc",
            "connection_type": "sdwan",
            "bandwidth_mbps": 2000,
            "utilization_pct": 82,
            "latency_ms": 35,
            "status": "degraded",
            "packets_per_sec": 42000,
            "errors_per_sec": 15
        },
        {
            "source_site": "regional-dc-1",
            "target_site": "branch-london",
            "connection_type": "sdwan",
            "bandwidth_mbps": 1000,
            "utilization_pct": 29,
            "latency_ms": 89,
            "status": "healthy",
            "packets_per_sec": 12000,
            "errors_per_sec": 1
        },
        {
            "source_site": "global-hq",
            "target_site": "branch-nyc",
            "connection_type": "vpn",
            "bandwidth_mbps": 500,
            "utilization_pct": 11,
            "latency_ms": 45,
            "status": "healthy",
            "packets_per_sec": 3200,
            "errors_per_sec": 0
        }
    ]
```

**File: `ui/src/types/index.ts`**

Add interface:
```typescript
export interface SiteFlow {
  source_site: string;
  target_site: string;
  connection_type: string;
  bandwidth_mbps: number;
  utilization_pct: number;
  latency_ms: number;
  status: 'healthy' | 'degraded' | 'critical';
  packets_per_sec: number;
  errors_per_sec: number;
}
```

**File: `ui/src/api/client.ts`**

Add method:
```typescript
getInterSiteFlows: () => api.get('/cmdb/topology/inter-site/flows'),
```

### Frontend Changes

**File: `ui/src/components/GeoMap.tsx`**

Major rewrite of the connection rendering:

1. Add `flows` prop to interface:
```typescript
interface Props {
  sites: SiteLocation[];
  connections?: InterSiteConnection[];
  flows?: SiteFlow[];
  onSiteClick?: (siteName: string) => void;
  height?: string;
  showFlows?: boolean;
  onToggleFlows?: () => void;
}
```

2. Replace static `L.polyline` connections with animated flow lines:
   - Use `L.divIcon` with SVG polylines for CSS animation control
   - Each flow line is an SVG `<line>` with `stroke-dasharray` and CSS `@keyframes`
   - Line `stroke-width` mapped from utilization: `1 + (utilization / 100) * 5` (1-6px)
   - Line `stroke` mapped from status: healthy=#22c55e, degraded=#eab308, critical=#ef4444
   - Add animated direction markers (small triangles moving along the path)

3. Add SVG flow animation CSS (injected via `<style>` tag in the divIcon):
```css
@keyframes flowAnimation {
  from { stroke-dashoffset: 20; }
  to { stroke-dashoffset: 0; }
}
.flow-animated {
  stroke-dasharray: 10 10;
  animation: flowAnimation 0.8s linear infinite;
}
```

4. Add flow tooltip on hover:
```typescript
const flowTooltip = L.tooltip({ permanent: false, direction: 'top' })
  .setContent(`
    <div style="font-family:system-ui;min-width:180px;">
      <div style="font-weight:bold;margin-bottom:4px;">${flow.source_site} → ${flow.target_site}</div>
      <div>Type: ${flow.connection_type.toUpperCase()}</div>
      <div>Bandwidth: ${flow.bandwidth_mbps} Mbps</div>
      <div>Utilization: ${flow.utilization_pct}%</div>
      <div>Latency: ${flow.latency_ms}ms</div>
      <div>Status: <span style="color:${statusColor}">${flow.status}</span></div>
    </div>
  `);
```

5. Add flow legend overlay (bottom-right corner of map):
```typescript
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function() {
  const div = L.DomUtil.create('div', 'flow-legend');
  div.innerHTML = `
    <div style="background:rgba(0,0,0,0.8);padding:8px 12px;border-radius:8px;font-size:11px;color:white;">
      <div style="font-weight:bold;margin-bottom:4px;">Traffic Flow</div>
      <div><span style="display:inline-block;width:20px;height:3px;background:#22c55e;vertical-align:middle;"></span> Healthy</div>
      <div><span style="display:inline-block;width:20px;height:3px;background:#eab308;vertical-align:middle;"></span> Degraded</div>
      <div><span style="display:inline-block;width:20px;height:3px;background:#ef4444;vertical-align:middle;"></span> Critical</div>
      <div style="margin-top:4px;border-top:1px solid #374151;padding-top:4px;">
        <div>Thickness = Utilization</div>
      </div>
    </div>
  `;
  return div;
};
legend.addTo(map);
```

6. Add flow toggle button (top-right corner):
```typescript
const toggleControl = L.control({ position: 'topright' });
toggleControl.onAdd = function() {
  const btn = L.DomUtil.create('button', 'flow-toggle');
  btn.innerHTML = showFlows ? '🔌 Hide Flows' : '📡 Show Flows';
  btn.style.cssText = 'background:white;padding:6px 12px;border-radius:6px;border:none;cursor:pointer;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.2);';
  L.DomEvent.disableClickPropagation(btn);
  btn.onclick = () => onToggleFlows?.();
  return btn;
};
```

**File: `ui/src/pages/CMDBExplorer.tsx`**

1. Add state for flows and toggle:
```typescript
const [siteFlows, setSiteFlows] = useState<SiteFlow[]>([]);
const [showFlows, setShowFlows] = useState(true);
```

2. Fetch flows on mount:
```typescript
cmdbAPI.getInterSiteFlows().then((r) => setSiteFlows(r.data)).catch(() => {});
```

3. Pass flows to GeoMap:
```tsx
<GeoMap
  sites={siteLocations}
  connections={interSiteConns}
  flows={siteFlows}
  showFlows={showFlows}
  onToggleFlows={() => setShowFlows(!showFlows)}
  onSiteClick={(site) => { setSelectedSite(site); setViewMode('aggregated'); }}
  height="h-[500px]"
/>
```

---

## Part B: Zoomed-In Site Geo Map

### Current State
- Clicking a site on the global geo map navigates to CMDB aggregated view
- No indoor/building-level map exists
- DC Explorer shows rooms/racks as card grids, not on a map

### Target State
- New `SiteGeoMap` component shows a single site at street/building zoom level
- Custom markers for DC rooms (building icons) and key CIs (device icons)
- Clicking a room marker navigates to DC Explorer with that room pre-selected
- Clicking a CI marker shows a detail popup
- Breadcrumb navigation: Global Map > Site Name
- "Back to Global Map" button

### Backend Changes

**File: `core_platform/routers/cmdb.py`**

Add endpoint `GET /api/v1/cmdb/sites/{site_name}/map-data`:

```python
@router.get("/sites/{site_name}/map-data")
async def get_site_map_data(site_name: str, session=Depends(get_session), _user=Depends(get_current_user)):
    repo = CMDBRepository(session)
    
    SITE_COORDS = {
        "global-hq": {"lat": 40.7128, "lng": -74.0060},
        "regional-dc-1": {"lat": 41.8781, "lng": -87.6298},
        "metro-ring-1": {"lat": 32.7767, "lng": -96.7970},
        "branch-nyc": {"lat": 40.7580, "lng": -73.9855},
        "branch-london": {"lat": 51.5074, "lng": -0.1278},
    }
    
    center = SITE_COORDS.get(site_name, {"lat": 0, "lng": 0})
    
    # Get rooms for this site
    rooms_result = await session.execute(
        select(DCRoom).where(DCRoom.site == site_name)
    )
    rooms = rooms_result.scalars().all()
    
    # Get CIs for this site
    cis = await repo.get_cis_by_site(site_name)
    
    pins = []
    
    # Add room pins with synthetic offsets from center
    import math
    for i, room in enumerate(rooms):
        angle = (2 * math.pi * i) / max(len(rooms), 1)
        offset_lat = 0.002 * math.cos(angle)
        offset_lng = 0.002 * math.sin(angle)
        pins.append({
            "id": str(room.id),
            "name": room.name,
            "type": "room",
            "lat": center["lat"] + offset_lat,
            "lng": center["lng"] + offset_lng,
            "details": {
                "room_type": room.room_type,
                "tier_rating": room.tier_rating,
                "total_racks": room.total_racks,
                "power_capacity_kw": room.power_capacity_kw,
                "cooling_type": room.cooling_type,
            }
        })
    
    # Add key CI pins (routers, firewalls, load balancers — the "interesting" devices)
    key_types = {"router", "firewall", "load_balancer", "switch", "physical_server"}
    key_cis = [ci for ci in cis if ci.get("type") in key_types]
    
    for i, ci in enumerate(key_cis[:20]):  # Limit to 20 pins
        angle = (2 * math.pi * i) / min(len(key_cis), 20)
        radius = 0.001 + (i % 3) * 0.0005  # Vary radius for visual spread
        offset_lat = radius * math.cos(angle)
        offset_lng = radius * math.sin(angle)
        pins.append({
            "id": ci["id"],
            "name": ci["name"],
            "type": ci["type"],
            "lat": center["lat"] + offset_lat,
            "lng": center["lng"] + offset_lng,
            "details": {
                "provider": ci.get("provider"),
                "team": ci.get("team"),
                "network_layer": ci.get("network_layer"),
            }
        })
    
    return {
        "center": center,
        "zoom": 15,
        "pins": pins
    }
```

**File: `core_platform/cmdb/repository.py`**

Add method:
```python
async def get_cis_by_site(self, site: str) -> list[dict]:
    result = await self.session.execute(
        select(CI).where(CI.site == site)
    )
    cis = result.scalars().all()
    return [
        {
            "id": str(ci.id), "name": ci.name, "type": ci.type,
            "provider": ci.provider, "team": ci.team,
            "network_layer": ci.network_layer,
        }
        for ci in cis
    ]
```

### Frontend Changes

**File: `ui/src/types/index.ts`**

Add interface:
```typescript
export interface SiteMapPin {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  details: Record<string, any>;
}

export interface SiteMapData {
  center: { lat: number; lng: number };
  zoom: number;
  pins: SiteMapPin[];
}
```

**File: `ui/src/api/client.ts`**

Add method:
```typescript
getSiteMapData: (siteName: string) => api.get(`/cmdb/sites/${siteName}/map-data`),
```

**File: `ui/src/components/SiteGeoMap.tsx`** — NEW FILE

Create a Leaflet map component for a single site:

```typescript
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { SiteMapData, SiteMapPin } from '../types';

const PIN_COLORS: Record<string, string> = {
  room: '#8b5cf6',
  router: '#3b82f6',
  firewall: '#ef4444',
  load_balancer: '#f97316',
  switch: '#22c55e',
  physical_server: '#64748b',
  host: '#64748b',
  container: '#06b6d4',
};

const PIN_ICONS: Record<string, string> = {
  room: '🏢', router: '🔌', firewall: '🛡️', load_balancer: '⚡',
  switch: '🔗', physical_server: '🖥️', host: '💻', container: '📦',
};

interface Props {
  siteName: string;
  mapData: SiteMapData;
  onBack: () => void;
  onRoomClick?: (roomId: string) => void;
  height?: string;
}

export default function SiteGeoMap({ siteName, mapData, onBack, onRoomClick, height = 'h-[500px]' }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !mapData) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapRef.current, {
      center: [mapData.center.lat, mapData.center.lng],
      zoom: mapData.zoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
    }).addTo(map);

    // Add site boundary circle
    L.circle([mapData.center.lat, mapData.center.lng], {
      radius: 300, // ~300m radius
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.05,
      weight: 1,
      dashArray: '5, 5',
    }).addTo(map);

    // Add pins
    mapData.pins.forEach((pin) => {
      const color = PIN_COLORS[pin.type] || '#64748b';
      const icon = L.divIcon({
        className: 'site-pin',
        html: `<div style="
          width:28px;height:28px;background:${color};
          border:2px solid white;border-radius:6px;
          display:flex;align-items:center;justify-content:center;
          font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.4);
        ">${PIN_ICONS[pin.type] || '📍'}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16],
      });

      const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
      
      const popupContent = `
        <div style="font-family:system-ui;min-width:180px;">
          <div style="font-weight:bold;font-size:13px;margin-bottom:4px;">${PIN_ICONS[pin.type] || '📍'} ${pin.name}</div>
          <div style="font-size:11px;color:#666;margin-bottom:6px;">Type: ${pin.type}</div>
          ${pin.details ? Object.entries(pin.details).map(([k, v]) => 
            v ? `<div style="font-size:11px;color:#374151;">${k}: <strong>${v}</strong></div>` : ''
          ).join('') : ''}
          ${pin.type === 'room' ? `<button onclick="window.__siteRoomClick('${pin.id}')" style="margin-top:6px;width:100%;padding:4px;background:#8b5cf6;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">View in DC Explorer</button>` : ''}
        </div>
      `;
      marker.bindPopup(popupContent);
    });

    mapInstanceRef.current = map;
    return () => { map.remove(); };
  }, [mapData]);

  // Expose room click handler
  useEffect(() => {
    (window as any).__siteRoomClick = (roomId: string) => {
      onRoomClick?.(roomId);
    };
    return () => { delete (window as any).__siteRoomClick; };
  }, [onRoomClick]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
          ← Back to Global Map
        </button>
        <span className="text-sm text-gray-400">/</span>
        <span className="text-sm font-semibold text-gray-900">{siteName}</span>
      </div>
      <div ref={mapRef} className={`w-full ${height} rounded-xl border border-gray-700`} />
      <div className="flex gap-3 text-xs text-gray-500">
        {Object.entries(PIN_COLORS).slice(0, 6).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1">
            <span style={{ background: color }} className="w-3 h-3 rounded"></span>
            {type.replace('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}
```

**File: `ui/src/pages/CMDBExplorer.tsx`**

1. Add state for site map data:
```typescript
const [siteMapData, setSiteMapData] = useState<SiteMapData | null>(null);
const [viewingSiteMap, setViewingSiteMap] = useState<string | null>(null);
```

2. Add new view mode value:
```typescript
const [viewMode, setViewMode] = useState<'detailed' | 'aggregated' | 'geo' | 'site-map'>('aggregated');
```

3. Fetch site map data when entering site-map mode:
```typescript
useEffect(() => {
  if (viewMode === 'site-map' && viewingSiteMap) {
    cmdbAPI.getSiteMapData(viewingSiteMap).then((r) => setSiteMapData(r.data));
  }
}, [viewMode, viewingSiteMap]);
```

4. Modify GeoMap onSiteClick to enter site-map mode:
```tsx
onSiteClick={(site) => {
  setViewingSiteMap(site);
  setViewMode('site-map');
}}
```

5. Add site-map rendering block in the conditional:
```tsx
{viewMode === 'site-map' && siteMapData && (
  <SiteGeoMap
    siteName={viewingSiteMap!}
    mapData={siteMapData}
    onBack={() => { setViewMode('geo'); setViewingSiteMap(null); setSiteMapData(null); }}
    onRoomClick={(roomId) => { window.location.href = `/dc-explorer?room=${roomId}`; }}
    height="h-[600px]"
  />
)}
```

---

## Execution Order

### Step 1: Backend endpoints
1. Add `GET /cmdb/topology/inter-site/flows` endpoint
2. Add `GET /cmdb/sites/{site_name}/map-data` endpoint
3. Add `get_cis_by_site()` repository method

### Step 2: Frontend types & API
4. Add `SiteFlow`, `SiteMapPin`, `SiteMapData` types
5. Add `getInterSiteFlows()`, `getSiteMapData()` API methods

### Step 3: Components
6. Create `SiteGeoMap.tsx` component
7. Rewrite `GeoMap.tsx` with flow animation support

### Step 4: Integration
8. Update `CMDBExplorer.tsx` with site-map mode and flow state
9. Rebuild and test

### Step 5: Verify
10. Docker rebuild api-gateway and ui
11. Verify flow animation renders on geo map
12. Verify site map opens on marker click
13. Verify room click navigates to DC Explorer
