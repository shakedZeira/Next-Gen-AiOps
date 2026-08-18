import { useState, useEffect } from 'react';
import ServiceHealthCard from '../components/ServiceHealthCard';
import TopologyGraph from '../components/TopologyGraph';
import { cmdbAPI } from '../api/client';
import { Topology } from '../types';

const SERVICES = [
  { name: 'E-Commerce Platform', status: 'healthy' as const, latency: 120, errorRate: 1.2, throughput: 850 },
  { name: 'Payment Gateway', status: 'degraded' as const, latency: 340, errorRate: 3.8, throughput: 420 },
  { name: 'Inventory Service', status: 'healthy' as const, latency: 85, errorRate: 0.5, throughput: 620 },
  { name: 'Notification Service', status: 'healthy' as const, latency: 45, errorRate: 0.2, throughput: 1200 },
];

export default function Dashboard() {
  const [topology, setTopology] = useState<Topology | null>(null);

  useEffect(() => {
    cmdbAPI.listCI().then(() => {
      setTopology({
        nodes: [
          { id: '1', name: 'nginx-lb', type: 'load_balancer' },
          { id: '2', name: 'web-server', type: 'host' },
          { id: '3', name: 'api-gateway', type: 'api_gateway' },
          { id: '4', name: 'payments-api', type: 'microservice' },
          { id: '5', name: 'postgres', type: 'database' },
          { id: '6', name: 'redis', type: 'cache' },
          { id: '7', name: 'kafka', type: 'queue' },
        ],
        edges: [
          { source: '1', target: '2', type: 'routes_to' },
          { source: '2', target: '3', type: 'calls' },
          { source: '3', target: '4', type: 'depends_on' },
          { source: '3', target: '5', type: 'depends_on' },
          { source: '3', target: '6', type: 'depends_on' },
          { source: '4', target: '5', type: 'depends_on' },
          { source: '4', target: '7', type: 'publishes_to' },
        ],
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Service Health Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SERVICES.map(svc => (
          <ServiceHealthCard key={svc.name} {...svc} />
        ))}
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Service Topology</h2>
        <TopologyGraph topology={topology} />
      </div>
    </div>
  );
}
