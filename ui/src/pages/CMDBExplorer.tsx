import { useState, useEffect } from 'react';
import TopologyGraph from '../components/TopologyGraph';
import { cmdbAPI } from '../api/client';
import { CI, Topology, Service } from '../types';

const TEAM_BADGE_COLORS: Record<string, string> = {
  frontend: 'bg-blue-100 text-blue-800',
  backend: 'bg-cyan-100 text-cyan-800',
  payments: 'bg-yellow-100 text-yellow-800',
  data: 'bg-green-100 text-green-800',
  platform: 'bg-purple-100 text-purple-800',
  security: 'bg-red-100 text-red-800',
  sre: 'bg-indigo-100 text-indigo-800',
  unassigned: 'bg-gray-100 text-gray-600',
};

const TYPE_ICONS: Record<string, string> = {
  load_balancer: '\u26A1',
  host: '\uD83D\uDCBB',
  api_gateway: '\uD83D\uDD10',
  microservice: '\u2699\uFE0F',
  database: '\uD83D\uDDC4\uFE0F',
  cache: '\u26A1',
  message_queue: '\uD83D\uDCE8',
  storage: '\uD83D\uDCC2',
};

export default function CMDBExplorer() {
  const [cis, setCIs] = useState<CI[]>([]);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedCI, setSelectedCI] = useState<CI | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      cmdbAPI.getGlobalTopology().then((r) => setTopology(r.data)),
      cmdbAPI.listCI().then((r) => setCIs(r.data)),
      cmdbAPI.listServices().then((r) => setServices(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  const flowOptions = [
    { value: 'all', label: 'All Services' },
    ...services.map((s) => ({ value: s.owner_team || s.name, label: `${s.name} (${s.owner_team || 'no team'})` })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">CMDB Explorer</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600">Flow:</label>
          <select
            value={selectedFlow}
            onChange={(e) => setSelectedFlow(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-primary-500"
          >
            {flowOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Service Topology</h2>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Healthy</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500"></span> Degraded</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400"></span> No Data</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-dashed border-gray-400 border-t"></span> Flow</span>
            </div>
          </div>
          {loading ? (
            <div className="h-[500px] bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">Loading topology...</div>
          ) : (
            <TopologyGraph topology={topology} selectedService={selectedFlow !== 'all' ? selectedFlow : undefined} />
          )}
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Configuration Items ({cis.length})</h2>
          <div className="space-y-2 max-h-[460px] overflow-y-auto">
            {cis.map((ci) => (
              <div
                key={ci.id}
                onClick={() => setSelectedCI(ci)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedCI?.id === ci.id
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-200'
                    : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900">
                    {TYPE_ICONS[ci.type] || '\u2753'} {ci.name}
                  </span>
                  <span className="text-xs text-gray-500">{ci.type}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {ci.team && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TEAM_BADGE_COLORS[ci.team] || TEAM_BADGE_COLORS.unassigned}`}>
                      {ci.team}
                    </span>
                  )}
                  {ci.provider && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{ci.provider}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedCI && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">CI Details: {selectedCI.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div><span className="text-gray-500">Type:</span> <span className="font-medium">{selectedCI.type}</span></div>
            <div><span className="text-gray-500">Provider:</span> <span className="font-medium">{selectedCI.provider || '-'}</span></div>
            <div><span className="text-gray-500">Environment:</span> <span className="font-medium">{selectedCI.environment || '-'}</span></div>
            <div><span className="text-gray-500">Team:</span>
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${TEAM_BADGE_COLORS[selectedCI.team || 'unassigned']}`}>
                {selectedCI.team || 'unassigned'}
              </span>
            </div>
            <div><span className="text-gray-500">ID:</span> <span className="font-mono text-xs">{selectedCI.id}</span></div>
          </div>
          {Object.keys(selectedCI.labels).length > 0 && (
            <div className="mt-4 flex gap-1 flex-wrap">
              {Object.entries(selectedCI.labels).map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{k}: {v}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
