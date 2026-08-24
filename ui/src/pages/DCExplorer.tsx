import { useState, useEffect } from 'react';
import { dcAPI } from '../api/client';
import { DCRoom, DCRack, DCRackEquipment } from '../types';
import RackVisualization from '../components/RackVisualization';

type View = 'rooms' | 'racks' | 'rack_detail';

const ROOM_TYPE_LABELS: Record<string, string> = {
  data_center: 'Data Center',
  wiring_closet: 'Wiring Closet',
  meet_me_room: 'Meet-Me Room',
};

const COOLING_LABELS: Record<string, string> = {
  crac: 'CRAC',
  crah: 'CRAH',
  in_row: 'In-Row',
  split: 'Split System',
};

export default function DCExplorer() {
  const [view, setView] = useState<View>('rooms');
  const [sites, setSites] = useState<string[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [rooms, setRooms] = useState<DCRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<DCRoom | null>(null);
  const [racks, setRacks] = useState<DCRack[]>([]);
  const [selectedRack, setSelectedRack] = useState<DCRack | null>(null);
  const [rackEquipment, setRackEquipment] = useState<DCRackEquipment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    dcAPI.getRooms().then(res => {
      const uniqueSites = [...new Set((res.data as DCRoom[]).map(r => r.site))];
      setSites(uniqueSites);
      if (uniqueSites.length > 0) setSelectedSite(uniqueSites[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedSite) return;
    setLoading(true);
    dcAPI.getRooms(selectedSite).then(res => {
      setRooms(res.data);
      setLoading(false);
    });
  }, [selectedSite]);

  const handleRoomClick = async (room: DCRoom) => {
    setSelectedRoom(room);
    setLoading(true);
    const res = await dcAPI.getRacks(room.id);
    setRacks(res.data);
    setView('racks');
    setLoading(false);
  };

  const handleRackClick = async (rack: DCRack) => {
    setSelectedRack(rack);
    setLoading(true);
    const res = await dcAPI.getRackEquipment(rack.id);
    setRackEquipment(res.data);
    setView('rack_detail');
    setLoading(false);
  };

  const handleBackToRooms = () => {
    setView('rooms');
    setSelectedRoom(null);
    setRacks([]);
  };

  const handleBackToRacks = () => {
    setView('racks');
    setSelectedRack(null);
    setRackEquipment([]);
  };

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">DC Explorer</h1>
            <p className="text-xs text-gray-400 mt-0.5">Physical data center layout visualization</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400">Site:</label>
            <select
              value={selectedSite}
              onChange={e => setSelectedSite(e.target.value)}
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {sites.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-400 text-sm">Loading...</div>
          </div>
        )}

        {!loading && view === 'rooms' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => handleRoomClick(room)}
                className="bg-gray-900 border border-gray-700 rounded-xl p-5 text-left hover:border-primary-500 hover:bg-gray-800/50 transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-600/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{room.name}</h3>
                    <p className="text-[11px] text-gray-400">{room.site}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-400">Type</span>
                    <p className="text-gray-300">{ROOM_TYPE_LABELS[room.room_type || ''] || room.room_type || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-400">Tier</span>
                    <p className="text-gray-300">{room.tier_rating ? `Tier ${room.tier_rating}` : '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-400">Racks</span>
                    <p className="text-gray-300">{room.total_racks}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-400">Power</span>
                    <p className="text-gray-300">{room.power_capacity_kw ? `${room.power_capacity_kw} kW` : '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-400">Cooling</span>
                    <p className="text-gray-300">{COOLING_LABELS[room.cooling_type || ''] || room.cooling_type || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-400">PUE</span>
                    <p className="text-gray-300">{room.pue_target || '-'}</p>
                  </div>
                </div>
              </button>
            ))}
            {rooms.length === 0 && (
              <div className="col-span-full text-center text-gray-500 dark:text-gray-400 dark:text-gray-400 py-12">No rooms found for this site</div>
            )}
          </div>
        )}

        {!loading && view === 'racks' && selectedRoom && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={handleBackToRooms} className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-lg font-bold">{selectedRoom.name}</h2>
                <p className="text-xs text-gray-400">{selectedRoom.site} &middot; {selectedRoom.total_racks} racks</p>
              </div>
            </div>

            {(() => {
              const rows = new Map<string, DCRack[]>();
              racks.forEach(r => {
                const rowKey = r.row || 'default';
                if (!rows.has(rowKey)) rows.set(rowKey, []);
                rows.get(rowKey)!.push(r);
              });

              return Array.from(rows.entries()).map(([rowKey, rowRacks]) => (
                <div key={rowKey} className="mb-6">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Row {rowKey}</h3>
                  <div className="flex gap-3 flex-wrap">
                    {rowRacks.map(rack => {
                      const fillPercent = Math.round(
                        (rack.max_power_kw && selectedRoom.power_capacity_kw
                          ? (rack.max_power_kw / selectedRoom.power_capacity_kw) * 100 * 3
                          : 50)
                      );
                      const displayFill = Math.min(fillPercent, 100);
                      const fillColor = displayFill > 85 ? '#ef4444' : displayFill > 60 ? '#eab308' : '#22c55e';

                      return (
                        <button
                          key={rack.id}
                          onClick={() => handleRackClick(rack)}
                          className="bg-gray-900 border border-gray-700 rounded-lg p-3 hover:border-primary-500 transition-all flex flex-col items-center group"
                          style={{ width: 100 }}
                        >
                          <div
                            className="w-full rounded border border-gray-600 mb-2 transition-all"
                            style={{
                              height: 120,
                              background: `linear-gradient(to top, ${fillColor}44 ${displayFill}%, #0f172a ${displayFill}%)`,
                            }}
                          >
                            <div className="w-full h-full flex flex-col justify-between p-1.5">
                              <div className="flex gap-0.5">
                                {[0, 1, 2].map(i => (
                                  <div key={i} className="h-1 flex-1 rounded-sm bg-gray-600/50" />
                                ))}
                              </div>
                              <div className="text-center">
                                <span className="text-[10px] font-bold text-white">{displayFill}%</span>
                              </div>
                              <div className="flex gap-0.5">
                                {[0, 1, 2].map(i => (
                                  <div key={i} className="h-1 flex-1 rounded-sm bg-gray-600/50" />
                                ))}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-white">{rack.name}</span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-400">{rack.u_height}U</span>
                          {rack.current_temp_c && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-400">{rack.current_temp_c}°C</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {!loading && view === 'rack_detail' && selectedRack && (
          <RackVisualization
            rack={selectedRack}
            equipment={rackEquipment}
            onBack={handleBackToRacks}
          />
        )}
      </div>
    </div>
  );
}
