import { useState, useEffect } from 'react';
import { networkSimAPI, cmdbAPI } from '../api/client';
import NetworkSimPanel from '../components/NetworkSimPanel';
import TracerouteView from '../components/TracerouteView';

interface DeviceSummary {
  id: string;
  name: string;
  type: string;
  site: string;
  up: boolean;
  interfaces: number;
  routes: number;
  arp_entries: number;
}

interface SimEvent {
  timestamp: number;
  event_type: string;
  device: string;
  detail: string;
}

export default function NetworkSimulation() {
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [tracerouteResult, setTracerouteResult] = useState<any>(null);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [devResp, , eventsResp] = await Promise.all([
        networkSimAPI.listDevices(),
        cmdbAPI.getGlobalTopology(),
        networkSimAPI.getEvents(20),
      ]);
      setDevices(devResp.data || []);
      setEvents(eventsResp.data?.events || []);
      setError('');
    } catch (e: any) {
      setError('Failed to load network simulation data');
    }
    setLoading(false);
  };

  const handlePing = async (srcId: string, dstIp: string) => {
    try {
      const resp = await networkSimAPI.ping(srcId, dstIp);
      setTracerouteResult(resp.data);
    } catch (e) {
      setTracerouteResult({ success: false, error: 'Ping failed', hops: [] });
    }
  };

  const handleTraceroute = async (srcId: string, dstIp: string) => {
    try {
      const resp = await networkSimAPI.traceroute(srcId, dstIp);
      setTracerouteResult(resp.data);
    } catch (e) {
      setTracerouteResult({ success: false, error: 'Traceroute failed', hops: [] });
    }
  };

  const handleInjectFailure = async (targetId: string) => {
    try {
      await networkSimAPI.injectFailure(targetId, 'device');
      loadData();
    } catch (e) {
      console.error('Failed to inject failure');
    }
  };

  const handleRecover = async (targetId: string) => {
    try {
      await networkSimAPI.recover(targetId, 'device');
      loadData();
    } catch (e) {
      console.error('Failed to recover');
    }
  };

  const eventColors: Record<string, string> = {
    LINK_DOWN: 'bg-red-100 text-red-800',
    DEVICE_DOWN: 'bg-red-100 text-red-800',
    LINK_UP: 'bg-green-100 text-green-800',
    DEVICE_UP: 'bg-green-100 text-green-800',
    HOP: 'bg-blue-100 text-blue-800',
    ARP_FAILED: 'bg-orange-100 text-orange-800',
    DEST_UNREACHABLE: 'bg-red-100 text-red-800',
    LOOP_DETECTED: 'bg-purple-100 text-purple-800',
    TTL_EXPIRED: 'bg-yellow-100 text-yellow-800',
  };

  const deviceTypeIcons: Record<string, string> = {
    router: '🔀',
    switch: '🔌',
    firewall: '🛡️',
    load_balancer: '⚖️',
    physical_server: '🖥️',
    host: '💻',
    database: '🗄️',
    container: '📦',
    pod: '☸️',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Network Simulation</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Routing tables, ARP resolution, traceroute, and failure injection</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {loading && (
        <div className="text-center py-12 text-gray-400">Loading network simulation...</div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border overflow-hidden">
              <div className="p-4 border-b bg-gray-50 dark:bg-gray-900 dark:bg-gray-900 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Devices ({devices.length})</h2>
                <button onClick={loadData} className="text-xs text-blue-600 hover:text-blue-800">Refresh</button>
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {devices.map(dev => (
                  <div
                    key={dev.id}
                    onClick={() => setSelectedDevice(dev.id)}
                    className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-blue-50 transition-colors ${
                      selectedDevice === dev.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <span className="text-xl">{deviceTypeIcons[dev.type] || '📡'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 text-sm">{dev.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          dev.up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {dev.up ? 'UP' : 'DOWN'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {dev.type} · {dev.site} · {dev.routes} routes · {dev.arp_entries} ARP
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border overflow-hidden">
              <div className="p-4 border-b bg-gray-50 dark:bg-gray-900 dark:bg-gray-900">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Events</h2>
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {events.length === 0 && (
                  <p className="p-4 text-gray-400 text-sm">No events yet. Use failure injection or ping/traceroute to generate events.</p>
                )}
                {events.map((ev, i) => (
                  <div key={i} className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${eventColors[ev.event_type] || 'bg-gray-100 dark:bg-gray-800 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                        {ev.event_type}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{ev.device}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{ev.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <NetworkSimPanel
        deviceId={selectedDevice}
        onClose={() => setSelectedDevice(null)}
        onPing={handlePing}
        onTraceroute={handleTraceroute}
        onInjectFailure={handleInjectFailure}
        onRecover={handleRecover}
      />

      <TracerouteView
        result={tracerouteResult}
        onClose={() => setTracerouteResult(null)}
      />
    </div>
  );
}
