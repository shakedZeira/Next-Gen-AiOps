import { useState, useEffect } from 'react';
import { networkSimAPI } from '../api/client';

interface Props {
  deviceId: string | null;
  onClose: () => void;
  onPing: (srcId: string, dstIp: string) => void;
  onTraceroute: (srcId: string, dstIp: string) => void;
  onInjectFailure: (targetId: string) => void;
  onRecover: (targetId: string) => void;
}

type Tab = 'routes' | 'arp' | 'mac' | 'actions';

export default function NetworkSimPanel({ deviceId, onClose, onPing, onTraceroute, onInjectFailure, onRecover }: Props) {
  const [tab, setTab] = useState<Tab>('routes');
  const [routes, setRoutes] = useState<any[]>([]);
  const [arp, setArp] = useState<Record<string, any>>({});
  const [macTable, setMacTable] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [pingDst, setPingDst] = useState('');
  const [traceDst, setTraceDst] = useState('');

  useEffect(() => {
    if (!deviceId) return;
    setLoading(true);
    Promise.all([
      networkSimAPI.getRoutes(deviceId),
      networkSimAPI.getArp(deviceId),
      networkSimAPI.getMacTable(deviceId),
    ]).then(([r, a, m]) => {
      setRoutes(r.data?.routes || []);
      setArp(a.data?.arp_cache || {});
      setMacTable(m.data?.mac_table || {});
      setDeviceName(r.data?.device_name || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [deviceId]);

  if (!deviceId) return null;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'routes', label: 'Routes', count: routes.length },
    { key: 'arp', label: 'ARP', count: Object.keys(arp).length },
    { key: 'mac', label: 'MAC Table', count: Object.keys(macTable).length },
    { key: 'actions', label: 'Actions' },
  ];

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl border-l z-50 flex flex-col">
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">{deviceName || deviceId}</h3>
          <p className="text-xs text-gray-500">Network Simulation</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
      </div>

      <div className="flex border-b">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1 text-[10px] bg-gray-200 px-1 rounded">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}

        {tab === 'routes' && !loading && (
          <div className="space-y-1">
            {routes.length === 0 && <p className="text-gray-400 text-sm">No routes</p>}
            {routes.map((r, i) => (
              <div key={i} className="p-2 bg-gray-50 rounded text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-900">{r.prefix}</span>
                  <span className={`px-1 rounded text-[10px] ${r.proto === 'connected' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {r.proto}
                  </span>
                </div>
                <div className="text-gray-500 mt-1">
                  via {r.next_hop_ip} → {r.out_iface} (metric: {r.metric})
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'arp' && !loading && (
          <div className="space-y-1">
            {Object.keys(arp).length === 0 && <p className="text-gray-400 text-sm">No ARP entries</p>}
            {Object.entries(arp).map(([ip, data]: [string, any]) => (
              <div key={ip} className="p-2 bg-gray-50 rounded text-xs flex justify-between">
                <span className="font-mono text-gray-900">{ip}</span>
                <span className="font-mono text-gray-500">{data.mac}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'mac' && !loading && (
          <div className="space-y-1">
            {Object.keys(macTable).length === 0 && <p className="text-gray-400 text-sm">No MAC entries</p>}
            {Object.entries(macTable).map(([mac, port]) => (
              <div key={mac} className="p-2 bg-gray-50 rounded text-xs flex justify-between">
                <span className="font-mono text-gray-900">{mac}</span>
                <span className="text-gray-500">{port}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'actions' && !loading && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ping</label>
              <div className="flex gap-2">
                <input
                  value={pingDst}
                  onChange={e => setPingDst(e.target.value)}
                  placeholder="Destination IP"
                  className="flex-1 px-2 py-1 border rounded text-xs"
                />
                <button
                  onClick={() => pingDst && onPing(deviceId, pingDst)}
                  className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                >
                  Ping
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Traceroute</label>
              <div className="flex gap-2">
                <input
                  value={traceDst}
                  onChange={e => setTraceDst(e.target.value)}
                  placeholder="Destination IP"
                  className="flex-1 px-2 py-1 border rounded text-xs"
                />
                <button
                  onClick={() => traceDst && onTraceroute(deviceId, traceDst)}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >
                  Trace
                </button>
              </div>
            </div>
            <hr />
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Failure Injection</label>
              <button
                onClick={() => onInjectFailure(deviceId)}
                className="w-full px-3 py-2 bg-red-500 text-white rounded text-xs hover:bg-red-600"
              >
                Take Device Offline
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Recovery</label>
              <button
                onClick={() => onRecover(deviceId)}
                className="w-full px-3 py-2 bg-emerald-500 text-white rounded text-xs hover:bg-emerald-600"
              >
                Restore Device
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
