import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { SiteMapData } from '../types';

const PIN_COLORS: Record<string, string> = {
  room: '#8b5cf6', router: '#3b82f6', firewall: '#ef4444', load_balancer: '#f97316',
  switch: '#22c55e', physical_server: '#64748b', host: '#64748b', container: '#06b6d4',
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
    if (mapInstanceRef.current) mapInstanceRef.current.remove();

    const map = L.map(mapRef.current, { center: [mapData.center.lat, mapData.center.lng], zoom: mapData.zoom, zoomControl: true });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO', subdomains: 'abcd',
    }).addTo(map);

    // Site boundary circle
    L.circle([mapData.center.lat, mapData.center.lng], {
      radius: 300, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.05, weight: 1, dashArray: '5, 5',
    }).addTo(map);

    // Pins
    mapData.pins.forEach((pin) => {
      const color = PIN_COLORS[pin.type] || '#64748b';
      const icon = L.divIcon({
        className: 'site-pin',
        html: `<div style="width:28px;height:28px;background:${color};border:2px solid white;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.4);">${PIN_ICONS[pin.type] || '📍'}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16],
      });

      const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
      const detailsHtml = pin.details
        ? Object.entries(pin.details).map(([k, v]) => v ? `<div style="font-size:11px;color:#374151;">${k}: <strong>${v}</strong></div>` : '').join('')
        : '';

      marker.bindPopup(`
        <div style="font-family:system-ui;min-width:180px;">
          <div style="font-weight:bold;font-size:13px;margin-bottom:4px;">${PIN_ICONS[pin.type] || '📍'} ${pin.name}</div>
          <div style="font-size:11px;color:#666;margin-bottom:6px;">Type: ${pin.type}</div>
          ${detailsHtml}
          ${pin.type === 'room' ? `<button onclick="window.__siteRoomClick('${pin.id}')" style="margin-top:6px;width:100%;padding:4px;background:#8b5cf6;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">View in DC Explorer</button>` : ''}
        </div>
      `);
    });

    mapInstanceRef.current = map;
    return () => { map.remove(); };
  }, [mapData]);

  useEffect(() => {
    (window as any).__siteRoomClick = (roomId: string) => onRoomClick?.(roomId);
    return () => { delete (window as any).__siteRoomClick; };
  }, [onRoomClick]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">← Back to Global Map</button>
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
