import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { SiteLocation, InterSiteConnection, SiteFlow, SiteOverview, Topology } from '../types';
import { cmdbAPI } from '../api/client';
import TopologyGraph from './TopologyGraph';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const SITE_TYPE_COLORS: Record<string, string> = {
  hq: '#3b82f6', dc: '#8b5cf6', large_branch: '#22c55e', small_branch: '#f97316',
};

const SITE_TYPE_LABELS: Record<string, string> = {
  hq: 'Headquarters', dc: 'Data Center', large_branch: 'Large Branch', small_branch: 'Small Branch',
};

const CONN_COLORS: Record<string, string> = {
  mpls: '#3b82f6', sdwan: '#22c55e', vpn: '#f97316', routes_to: '#3b82f6',
};

const STATUS_COLORS: Record<string, string> = {
  healthy: '#22c55e', degraded: '#eab308', critical: '#ef4444',
};

const SITE_RADIUS_METERS = 800;

function createSiteMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:28px;height:28px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -18],
  });
}

interface OverlayPos {
  x: number;
  y: number;
  radius: number;
}

interface Props {
  sites: SiteLocation[];
  connections?: InterSiteConnection[];
  flows?: SiteFlow[];
  height?: string;
  showFlows?: boolean;
  onToggleFlows?: () => void;
}

export default function GeoMap({ sites, connections = [], flows, height = 'h-[500px]', showFlows = true, onToggleFlows }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const flowLayerRef = useRef<L.LayerGroup | null>(null);
  const siteLayerRef = useRef<L.LayerGroup | null>(null);

  const [focusedSite, setFocusedSite] = useState<string | null>(null);
  const [siteTopology, setSiteTopology] = useState<Topology | null>(null);
  const [siteOverview, setSiteOverview] = useState<SiteOverview | null>(null);
  const [loadingSite, setLoadingSite] = useState(false);
  const [overlayPos, setOverlayPos] = useState<OverlayPos | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);

  const calcOverlayPos = useCallback((): OverlayPos | null => {
    const map = mapInstanceRef.current;
    if (!map || !focusedSite) return null;
    const siteData = sites.find(s => s.site === focusedSite);
    if (!siteData) return null;

    const point = map.latLngToContainerPoint([siteData.lat, siteData.lng]);
    const zoom = map.getZoom();
    const metersPerPixel = 156543.03392 * Math.cos((siteData.lat * Math.PI) / 180) / Math.pow(2, zoom);
    const pixelRadius = SITE_RADIUS_METERS / metersPerPixel;

    return { x: point.x, y: point.y, radius: pixelRadius };
  }, [focusedSite, sites]);

  const focusOnSite = useCallback(async (siteName: string) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const siteData = sites.find(s => s.site === siteName);
    if (!siteData) return;

    setFocusedSite(siteName);
    setLoadingSite(true);
    setOverlayVisible(false);
    setOverlayPos(null);
    flowLayerRef.current?.clearLayers();

    map.flyTo([siteData.lat, siteData.lng], 14, { duration: 1.5 });

    const layer = siteLayerRef.current;
    if (layer) {
      layer.clearLayers();
      L.circle([siteData.lat, siteData.lng], {
        radius: SITE_RADIUS_METERS,
        color: '#3b82f6',
        fillColor: '#1e40af',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '8, 4',
      }).addTo(layer);
    }

    try {
      const [topoRes, overviewRes] = await Promise.all([
        cmdbAPI.getSiteTopology(siteName),
        cmdbAPI.getSiteOverview(siteName),
      ]);
      setSiteTopology(topoRes.data);
      setSiteOverview(overviewRes.data);
    } catch {
      // partial data is fine
    }
    setLoadingSite(false);
  }, [sites]);

  const resetToGlobal = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setFocusedSite(null);
    setSiteTopology(null);
    setSiteOverview(null);
    setOverlayPos(null);
    setOverlayVisible(false);
    siteLayerRef.current?.clearLayers();

    map.flyTo([39.5, -98.5], 4, { duration: 1.5 });

    if (showFlows && flows && flows.length > 0) {
      const siteMap = new Map(sites.map(s => [s.site, s]));
      const flowLayer = flowLayerRef.current;
      if (!flowLayer) return;
      flows.forEach((flow) => {
        const source = siteMap.get(flow.source_site);
        const target = siteMap.get(flow.target_site);
        if (!source || !target) return;
        const statusColor = STATUS_COLORS[flow.status] || '#6b7280';
        const strokeW = 1 + (flow.utilization_pct / 100) * 5;
        const midLat = (source.lat + target.lat) / 2;
        const midLng = (source.lng + target.lng) / 2;
        const svgHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40" style="overflow:visible;position:absolute;top:-20px;left:-100px;"><defs><style>@keyframes flowAnim{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}.flow-line{stroke-dasharray:10 10;animation:flowAnim .8s linear infinite;}</style></defs><line x1="0" y1="20" x2="200" y2="20" stroke="${statusColor}" stroke-width="${strokeW}" class="flow-line"/></svg>`;
        const icon = L.divIcon({ className: 'flow-overlay', html: svgHtml, iconSize: [200, 40], iconAnchor: [100, 20] });
        L.marker([midLat, midLng], { icon, interactive: true }).addTo(flowLayer).bindTooltip(
          `<div style="font-family:system-ui;min-width:180px;font-size:12px;"><div style="font-weight:bold;margin-bottom:4px;">${flow.source_site} → ${flow.target_site}</div><div>Type: ${flow.connection_type.toUpperCase()}</div><div>Bandwidth: ${flow.bandwidth_mbps} Mbps</div><div>Utilization: ${flow.utilization_pct}%</div><div>Latency: ${flow.latency_ms}ms</div><div>Status: <span style="color:${statusColor};font-weight:600;">${flow.status}</span></div></div>`,
          { direction: 'top', offset: [0, -10] }
        );
      });
    }
  }, [flows, showFlows, sites]);

  // Init map
  useEffect(() => {
    if (!mapRef.current || sites.length === 0) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const map = L.map(mapRef.current, { center: [39.5, -98.5], zoom: 4, zoomControl: true, scrollWheelZoom: true });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO', subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);

    const flowLayer = L.layerGroup().addTo(map);
    flowLayerRef.current = flowLayer;

    const siteLayer = L.layerGroup().addTo(map);
    siteLayerRef.current = siteLayer;

    const bounds: L.LatLngTuple[] = [];
    const siteMap = new Map(sites.map(s => [s.site, s]));

    sites.forEach((site) => {
      const color = SITE_TYPE_COLORS[site.site_type] || '#64748b';
      const marker = L.marker([site.lat, site.lng], { icon: createSiteMarkerIcon(color) }).addTo(map);
      marker.bindPopup(`
        <div style="font-family:system-ui;min-width:200px;">
          <div style="font-size:14px;font-weight:bold;margin-bottom:4px;">${site.name}</div>
          <div style="font-size:12px;color:#666;margin-bottom:8px;">${site.city}, ${site.country}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
            <span style="background:${color};color:white;padding:2px 8px;border-radius:12px;font-size:11px;">${SITE_TYPE_LABELS[site.site_type] || site.site_type}</span>
            <span style="background:#e5e7eb;padding:2px 8px;border-radius:12px;font-size:11px;">${site.topology_type.replace(/_/g, ' ')}</span>
          </div>
          <div style="font-size:12px;color:#374151;">Devices: <strong>${site.device_count}</strong></div>
          <button onclick="window.__geoSiteClick('${site.site}')" style="margin-top:8px;width:100%;padding:6px;background:${color};color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;">Zoom In</button>
        </div>
      `);
      bounds.push([site.lat, site.lng]);
    });

    connections.forEach((conn) => {
      const source = siteMap.get(conn.source_site);
      const target = siteMap.get(conn.target_site);
      if (source && target) {
        const color = CONN_COLORS[conn.connection_type] || '#64748b';
        L.polyline(
          [[source.lat, source.lng], [target.lat, target.lng]],
          { color, weight: 3, dashArray: '8, 6', opacity: 0.8 }
        ).addTo(map).bindPopup(`
          <div style="font-family:system-ui;">
            <div style="font-weight:bold;font-size:13px;">${conn.source_site} ↔ ${conn.target_site}</div>
            <div style="font-size:12px;color:#666;margin-top:4px;">
              Type: <strong>${conn.connection_type.toUpperCase()}</strong><br/>
              Source: ${conn.source_device}<br/>Target: ${conn.target_device}
            </div>
          </div>
        `);
      }
    });

    const ToggleControl = L.Control.extend({
      onAdd: function() {
        const btn = L.DomUtil.create('button');
        btn.innerHTML = showFlows ? '🔌 Hide Flows' : '📡 Show Flows';
        btn.style.cssText = 'background:white;padding:6px 12px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:500;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
        L.DomEvent.disableClickPropagation(btn);
        btn.onclick = () => onToggleFlows?.();
        return btn;
      }
    });
    new ToggleControl({ position: 'topright' }).addTo(map);

    const LegendControl = L.Control.extend({
      onAdd: function() {
        const div = L.DomUtil.create('div');
        div.innerHTML = `
          <div style="background:rgba(0,0,0,0.85);padding:10px 14px;border-radius:8px;font-size:11px;color:white;font-family:system-ui;">
            <div style="font-weight:bold;margin-bottom:6px;">Traffic Flow</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;"><span style="display:inline-block;width:20px;height:3px;background:#22c55e;"></span> Healthy</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;"><span style="display:inline-block;width:20px;height:3px;background:#eab308;"></span> Degraded</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span style="display:inline-block;width:20px;height:3px;background:#ef4444;"></span> Critical</div>
            <div style="border-top:1px solid #374151;padding-top:4px;font-size:10px;color:#9ca3af;">Thickness = Utilization</div>
          </div>
        `;
        return div;
      }
    });
    new LegendControl({ position: 'bottomright' }).addTo(map);

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [50, 50] });

    mapInstanceRef.current = map;

    (window as any).__geoSiteClick = (siteName: string) => focusOnSite(siteName);

    return () => { map.remove(); mapInstanceRef.current = null; delete (window as any).__geoSiteClick; };
  }, [sites, connections, focusOnSite, onToggleFlows, showFlows, flows]);

  // Sync overlay position on zoom/pan + show overlay after flyTo
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusedSite) return;

    const update = () => {
      const pos = calcOverlayPos();
      if (pos) setOverlayPos(pos);
    };

    const onMoveEnd = () => {
      update();
      // Fade in topology after flyTo completes
      if (!overlayVisible) {
        setTimeout(() => setOverlayVisible(true), 200);
      }
    };

    map.on('zoomend moveend', onMoveEnd);

    // Initial position after a short delay for flyTo to settle
    const timer = setTimeout(() => {
      update();
      setTimeout(() => setOverlayVisible(true), 300);
    }, 1600);

    return () => {
      map.off('zoomend moveend', onMoveEnd);
      clearTimeout(timer);
    };
  }, [focusedSite, calcOverlayPos, overlayVisible]);

  // Update flows (global mode only)
  useEffect(() => {
    if (focusedSite) return;
    const flowLayer = flowLayerRef.current;
    if (!flowLayer) return;
    flowLayer.clearLayers();
    if (!showFlows || !flows || flows.length === 0) return;

    const siteMap = new Map(sites.map(s => [s.site, s]));

    flows.forEach((flow) => {
      const source = siteMap.get(flow.source_site);
      const target = siteMap.get(flow.target_site);
      if (!source || !target) return;

      const statusColor = STATUS_COLORS[flow.status] || '#6b7280';
      const strokeW = 1 + (flow.utilization_pct / 100) * 5;
      const midLat = (source.lat + target.lat) / 2;
      const midLng = (source.lng + target.lng) / 2;

      const svgHtml = `
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="40" style="overflow:visible;position:absolute;top:-20px;left:-100px;">
          <defs>
            <style>@keyframes flowAnim{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}.flow-line{stroke-dasharray:10 10;animation:flowAnim .8s linear infinite;}</style>
          </defs>
          <line x1="0" y1="20" x2="200" y2="20" stroke="${statusColor}" stroke-width="${strokeW}" class="flow-line"/>
        </svg>
      `;

      const icon = L.divIcon({
        className: 'flow-overlay',
        html: svgHtml,
        iconSize: [200, 40],
        iconAnchor: [100, 20],
      });

      L.marker([midLat, midLng], { icon, interactive: true }).addTo(flowLayer).bindTooltip(`
        <div style="font-family:system-ui;min-width:180px;font-size:12px;">
          <div style="font-weight:bold;margin-bottom:4px;">${flow.source_site} → ${flow.target_site}</div>
          <div>Type: ${flow.connection_type.toUpperCase()}</div>
          <div>Bandwidth: ${flow.bandwidth_mbps} Mbps</div>
          <div>Utilization: ${flow.utilization_pct}%</div>
          <div>Latency: ${flow.latency_ms}ms</div>
          <div>Packets: ${(flow.packets_per_sec / 1000).toFixed(1)}K/s · Errors: ${flow.errors_per_sec}/s</div>
          <div>Status: <span style="color:${statusColor};font-weight:600;">${flow.status}</span></div>
        </div>
      `, { direction: 'top', offset: [0, -10] });
    });
  }, [flows, showFlows, sites, focusedSite]);

  return (
    <div className="relative">
      <div ref={mapRef} className={`w-full ${height} rounded-xl border border-gray-700`} />

      {/* Compact site info bar */}
      {focusedSite && (
        <div className="absolute top-4 left-4 z-[1000] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden transition-opacity duration-500">
          {loadingSite ? (
            <div className="p-4 flex items-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
              <span className="text-sm text-gray-500">Loading {focusedSite}...</span>
            </div>
          ) : siteOverview ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-sm">{siteOverview.site_name}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {siteOverview.topology_type.replace(/_/g, ' ')}
                  </span>
                </div>
                <button onClick={resetToGlobal} className="text-gray-400 hover:text-gray-600 text-lg leading-none" title="Back to Global">×</button>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span><strong className="text-gray-900">{siteOverview.device_count}</strong> devices</span>
                <span><strong className="text-gray-900">{siteOverview.room_count}</strong> rooms</span>
                <span><strong className="text-gray-900">{siteOverview.total_racks}</strong> racks</span>
              </div>
              <div className="flex gap-2">
                <button onClick={resetToGlobal} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
                  ← Global
                </button>
                <div className="flex-1"></div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {siteOverview.teams.slice(0, 4).map(team => (
                    <span key={team} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{team}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Topology fills the circle — pixel-positioned, fades in */}
      {focusedSite && siteTopology && overlayPos && (
        <div
          className="absolute z-[999] rounded-full overflow-hidden border-2 border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.4)] pointer-events-auto"
          style={{
            left: overlayPos.x - overlayPos.radius,
            top: overlayPos.y - overlayPos.radius,
            width: overlayPos.radius * 2,
            height: overlayPos.radius * 2,
            opacity: overlayVisible ? 1 : 0,
            transition: 'opacity 0.8s ease-in-out',
          }}
        >
          <div className="w-full h-full bg-gray-900">
            <TopologyGraph
              topology={siteTopology}
              selectedSite={focusedSite}
              height="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
