import { useState } from 'react';
import { DCRack, DCRackEquipment } from '../types';

const EQUIPMENT_COLORS: Record<string, string> = {
  switch: '#14b8a6',
  server: '#3b82f6',
  pdu: '#f59e0b',
  patch_panel: '#64748b',
  blank: '#1e293b',
};

const EQUIPMENT_LABELS: Record<string, string> = {
  switch: 'Switch',
  server: 'Server',
  pdu: 'PDU',
  patch_panel: 'Patch Panel',
  blank: 'Empty',
};

interface Props {
  rack: DCRack;
  equipment: DCRackEquipment[];
  onBack: () => void;
}

export default function RackVisualization({ rack, equipment, onBack }: Props) {
  const [hoveredEq, setHoveredEq] = useState<DCRackEquipment | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const totalPower = equipment.reduce((sum, e) => sum + (e.power_consumption_w || 0), 0);
  const occupiedUs = new Set<number>();
  equipment.forEach(e => {
    for (let i = e.u_start; i < e.u_start + e.u_height; i++) {
      occupiedUs.add(i);
    }
  });
  const fillPercent = Math.round((occupiedUs.size / rack.u_height) * 100);

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX + 12, y: e.clientY - 8 });
  };

  const uPositions = Array.from({ length: rack.u_height }, (_, i) => rack.u_height - i);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">Rack {rack.name}</h2>
          <p className="text-xs text-gray-400">{rack.site} &middot; Row {rack.row || '-'} &middot; {rack.u_height}U</p>
        </div>
      </div>

      <div className="flex gap-6 mb-4 text-sm">
        <div className="bg-gray-800 rounded-lg px-4 py-2">
          <span className="text-gray-400">Fill: </span>
          <span className={`font-semibold ${fillPercent > 85 ? 'text-red-400' : fillPercent > 60 ? 'text-yellow-400' : 'text-green-400'}`}>
            {fillPercent}%
          </span>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2">
          <span className="text-gray-400">Power: </span>
          <span className="font-semibold text-white">{totalPower > 0 ? `${(totalPower / 1000).toFixed(1)} kW` : '-'}</span>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2">
          <span className="text-gray-400">Temp: </span>
          <span className="font-semibold text-white">{rack.current_temp_c ? `${rack.current_temp_c}°C` : '-'}</span>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2">
          <span className="text-gray-400">Status: </span>
          <span className={`font-semibold ${rack.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>{rack.status}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative" onMouseMove={handleMouseMove}>
        <div className="flex gap-0">
          <div className="flex flex-col" style={{ width: 36 }}>
            {uPositions.map(u => (
              <div key={u} className="flex items-center justify-end pr-1 text-[10px] text-gray-500 dark:text-gray-400 font-mono" style={{ height: 20 }}>
                {u}
              </div>
            ))}
          </div>
          <div className="flex flex-col border border-gray-600 rounded" style={{ width: 280 }}>
            {uPositions.map(u => {
              const eq = equipment.find(e => u >= e.u_start && u < e.u_start + e.u_height);
              const isTopOfBlock = eq && u === eq.u_start;
              const color = eq ? (EQUIPMENT_COLORS[eq.equipment_type] || '#64748b') : '#1e293b';

              return (
                <div
                  key={u}
                  className="flex items-center border-b border-gray-700/50 transition-all duration-150"
                  style={{
                    height: 20,
                    backgroundColor: eq ? color : '#0f172a',
                    opacity: eq ? 0.9 : 0.3,
                    cursor: eq ? 'pointer' : 'default',
                  }}
                  onMouseEnter={() => eq && setHoveredEq(eq)}
                  onMouseLeave={() => setHoveredEq(null)}
                >
                  {isTopOfBlock && (
                    <span className="text-[9px] text-white font-medium px-1 truncate" style={{ maxWidth: 276 }}>
                      {eq.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-col ml-4 gap-1 justify-start pt-1" style={{ minWidth: 120 }}>
            {Object.entries(EQUIPMENT_COLORS).filter(([k]) => k !== 'blank').map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-400">{EQUIPMENT_LABELS[type]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {hoveredEq && (
        <div
          className="fixed z-50 bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-xl pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <p className="text-sm font-bold text-white">{hoveredEq.name}</p>
          <p className="text-xs text-gray-400 mt-1">{EQUIPMENT_LABELS[hoveredEq.equipment_type] || hoveredEq.equipment_type}</p>
          {hoveredEq.manufacturer && <p className="text-xs text-gray-300">{hoveredEq.manufacturer} {hoveredEq.model}</p>}
          {hoveredEq.power_consumption_w && <p className="text-xs text-gray-300">Power: {hoveredEq.power_consumption_w}W</p>}
          {hoveredEq.mgmt_ip && <p className="text-xs text-gray-300">IP: {hoveredEq.mgmt_ip}</p>}
          <p className="text-xs text-gray-400 mt-1">U{hoveredEq.u_start} - U{hoveredEq.u_start + hoveredEq.u_height - 1}</p>
        </div>
      )}
    </div>
  );
}
