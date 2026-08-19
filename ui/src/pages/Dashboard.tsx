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
  { name: 'Order Processing', status: 'healthy' as const, latency: 90, errorRate: 0.8, throughput: 380 },
  { name: 'Analytics Pipeline', status: 'healthy' as const, latency: 150, errorRate: 0.3, throughput: 200 },
];

export default function Dashboard() {
  const [topology, setTopology] = useState<Topology | null>(null);

  useEffect(() => {
    cmdbAPI.getGlobalTopology().then((r) => setTopology(r.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Service Health Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SERVICES.map((svc) => (
          <ServiceHealthCard key={svc.name} {...svc} />
        ))}
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Service Topology</h2>
        <TopologyGraph topology={topology} height="h-[400px]" />
      </div>
    </div>
  );
}
