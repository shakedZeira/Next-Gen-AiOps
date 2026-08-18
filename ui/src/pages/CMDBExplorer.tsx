import { useState, useEffect } from 'react';
import TopologyGraph from '../components/TopologyGraph';
import { cmdbAPI } from '../api/client';
import { CI, Topology } from '../types';

export default function CMDBExplorer() {
  const [cis, setCIs] = useState<CI[]>([]);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [selectedCI, setSelectedCI] = useState<CI | null>(null);

  useEffect(() => {
    cmdbAPI.listCI().then(() => {
      const demoCIs: CI[] = [
        { id: '1', name: 'nginx-lb-1', type: 'load_balancer', provider: 'aws', environment: 'prod', labels: { app: 'nginx', tier: 'frontend' } },
        { id: '2', name: 'web-server-1', type: 'host', provider: 'aws', environment: 'prod', labels: { app: 'ecommerce', tier: 'frontend' } },
        { id: '3', name: 'api-gateway', type: 'api_gateway', provider: 'aws', environment: 'prod', labels: { app: 'api-gateway', tier: 'backend' } },
        { id: '4', name: 'postgres-payments', type: 'database', provider: 'aws', environment: 'prod', labels: { app: 'payments', tier: 'data' } },
        { id: '5', name: 'redis-cache', type: 'cache', provider: 'aws', environment: 'prod', labels: { app: 'redis', tier: 'data' } },
      ];
      setCIs(demoCIs);
      setTopology({
        nodes: demoCIs.map(c => ({ id: c.id, name: c.name, type: c.type })),
        edges: [
          { source: '1', target: '2', type: 'routes_to' },
          { source: '2', target: '3', type: 'calls' },
          { source: '3', target: '4', type: 'depends_on' },
          { source: '3', target: '5', type: 'depends_on' },
        ],
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">CMDB Explorer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Service Topology</h2>
          <TopologyGraph topology={topology} />
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Configuration Items</h2>
          <div className="space-y-2">
            {cis.map(ci => (
              <div
                key={ci.id}
                onClick={() => setSelectedCI(ci)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedCI?.id === ci.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900">{ci.name}</span>
                  <span className="text-xs text-gray-500">{ci.type}</span>
                </div>
                <div className="flex gap-1 mt-1">
                  {Object.entries(ci.labels).map(([k, v]) => (
                    <span key={k} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{k}: {v}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedCI && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">CI Details: {selectedCI.name}</h2>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500">Type:</span> <span className="font-medium">{selectedCI.type}</span></div>
            <div><span className="text-gray-500">Provider:</span> <span className="font-medium">{selectedCI.provider}</span></div>
            <div><span className="text-gray-500">Environment:</span> <span className="font-medium">{selectedCI.environment}</span></div>
            <div><span className="text-gray-500">ID:</span> <span className="font-mono text-xs">{selectedCI.id}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
