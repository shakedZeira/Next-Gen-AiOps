import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { SiteLocation, InterSiteConnection, SiteFlow, SiteOverview } from '../types';
import { cmdbAPI } from '../api/client';

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

function createColoredIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:24px;height:24px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -16],
  });
}

interface Props {
  sites: SiteLocation[];
  connections?: InterSiteConnection[];
  flows?: SiteFlow[];
  onSiteClick?: (siteName: string) => void;
  height?: string;
  showFlows?: boolean;
  onToggleFlows?: () => void;
}

export default function GeoMap({ sites, connections = [], flows, onSiteClick, height = 'h-[500px]', showFlows = true, onToggleFlows }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const flowLayerRef = useRef<L.LayerGroup | null>(null);
  const [selectedSiteOverview, setSelectedSiteOverview] = useState<SiteOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  useEffect(() => {
    if (!mapRef.current || sites.length === 0) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const map = L.map(mapRef.current, { center: [39.5, -98.5], zoom: 4, zoomControl: true, scrollWheelZoom: true });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO', subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);

    const bounds: L.LatLngTuple[] = [];
    const siteMap = new Map(sites.map(s => [s.site, s]));

    // Site markers
    sites.forEach((site) => {
      const color = SITE_TYPE_COLORS[site.site_type] || '#64748b';
      const marker = L.marker([site.lat, site.lng], { icon: createColoredIcon(color) }).addTo(map);
      marker.bindPopup(`
        <div style="font-family:system-ui;min-width:200px;">
          <div style="font-size:14px;font-weight:bold;margin-bottom:4px;">${site.name}</div>
          <div style="font-size:12px;color:#666;margin-bottom:8px;">${site.city}, ${site.country}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
            <span style="background:${color};color:white;padding:2px 8px;border-radius:12px;font-size:11px;">${SITE_TYPE_LABELS[site.site_type] || site.site_type}</span>
            <span style="background:#e5e7eb;padding:2px 8px;border-radius:12px;font-size:11px;">${site.topology_type.replace(/_/g, ' ')}</span>
          </div>
          <div style="font-size:12px;color:#374151;">Devices: <strong>${site.device_count}</strong></div>
          <button onclick="window.__geoSiteClick('${site.site}')" style="margin-top:8px;width:100%;padding:6px;background:${color};color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;">View Site Overview</button>
        </div>
      `);
      bounds.push([site.lat, site.lng]);
    });

    // Connection lines
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

    // Flow layer
    const flowLayer = L.layerGroup().addTo(map);
    flowLayerRef.current = flowLayer;

    // Toggle control
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

    // Legend control
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

    (window as any).__geoSiteClick = (siteName: string) => onSiteClick?.(siteName);

    return () => { map.remove(); mapInstanceRef.current = null; delete (window as any).__geoSiteClick; };
  }, [sites, connections]);

  // Update flows
  useEffect(() => {
    const map = mapInstanceRef.current;
    const flowLayer = flowLayerRef.current;
    if (!map || !flowLayer) return;
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

      const marker = L.marker([midLat, midLng], { icon, interactive: true }).addTo(flowLayer);
      marker.bindTooltip(`
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
  }, [flows, showFlows, sites]);

  // Handle site overview fetch
  useEffect(() => {
    if (selectedSiteOverview) {
      setLoadingOverview(false);
    }
  }, [selectedSiteOverview]);

  // Expose setOverview to window for the click handler
  useEffect(() => {
    (window as any).__setSiteOverview = (siteName: string) => {
      setLoadingOverview(true);
      setSelectedSiteOverview(null);
      cmdbAPI.getSiteOverview(siteName).then((r) => {
        setSelectedSiteOverview(r.data);
        setLoadingOverview(false);
      }).catch(() => setLoadingOverview(false));
    };
    return () => { delete (window as any).__setSiteOverview; };
  }, []);

  const SITE_TYPE_BADGE: Record<string, string> = {
    hq: 'bg-blue-500', dc: 'bg-purple-500', large_branch: 'bg-green-500', small_branch: 'bg-orange-500',
  };

  return (
    <div className="relative">
      <div ref={mapRef} className={`w-full ${height} rounded-xl border border-gray-700`} />
      
      {/* Site Overview Panel */}
      {(selectedSiteOverview || loadingOverview) && (
        <div className="absolute top-4 left-4 z-[1000] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          {loadingOverview ? (
            <div className="p-6 text-center text-gray-500">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              Loading overview...
            </div>
          ) : selectedSiteOverview && (
            <>
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedSiteOverview.site_name}</h3>
                    <p className="text-xs text-gray-500">{SITE_TYPE_LABELS[selectedSiteOverview.site_type] || selectedSiteOverview.site_type}</p>
                  </div>
                  <button
                    onClick={() => setSelectedSiteOverview(null)}
                    className="text-gray-400 hover:text-gray-600 text-lg"
                  >×</button>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${SITE_TYPE_BADGE[selectedSiteOverview.site_type] || 'bg-gray-500'}`}>
                    {selectedSiteOverview.site_type}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {selectedSiteOverview.topology_type.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              
              <div className="p-4 grid grid-cols-3 gap-3 border-b border-gray-100">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedSiteOverview.device_count}</p>
                  <p className="text-xs text-gray-500">Devices</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedSiteOverview.room_count}</p>
                  <p className="text-xs text-gray-500">Rooms</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedSiteOverview.total_racks}</p>
                  <p className="text-xs text-gray-500">Racks</p>
                </div>
              </div>

              <div className="p-4 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Teams</p>
                <div className="flex flex-wrap gap-1">
                  {selectedSiteOverview.teams.map((team) => (
                    <span key={team} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{team}</span>
                  ))}
                </div>
              </div>

              <div className="p-4 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Device Types</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(selectedSiteOverview.device_types).map(([type, count]) => (
                    <span key={type} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                      {type.replace(/_/g, ' ')}: {count}
                    </span>
                  ))}
                </div>
              </div>

              {selectedSiteOverview.key_devices.length > 0 && (
                <div className="p-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Key Devices</p>
                  <div className="space-y-1">
                    {selectedSiteOverview.key_devices.map((dev) => (
                      <div key={dev.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">{dev.name}</span>
                        <span className="text-gray-400">{dev.type.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-gray-50 border-t border-gray-100">
                <button
                  onClick={() => { onSiteClick?.(selectedSiteOverview.site_name); setSelectedSiteOverview(null); }}
                  className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  View Full Topology
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
