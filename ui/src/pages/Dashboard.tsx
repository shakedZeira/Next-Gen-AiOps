import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ServiceHealthCard from '../components/ServiceHealthCard';
import TopologyGraph from '../components/TopologyGraph';
import { cmdbAPI, alertsAPI } from '../api/client';
import { Topology } from '../types';

const SERVICES_DEFAULT = [
  { name: 'E-Commerce Platform', status: 'healthy' as const, latency: 120, errorRate: 1.2, throughput: 850 },
  { name: 'Payment Gateway', status: 'degraded' as const, latency: 340, errorRate: 3.8, throughput: 420 },
  { name: 'Inventory Service', status: 'healthy' as const, latency: 85, errorRate: 0.5, throughput: 620 },
  { name: 'Notification Service', status: 'healthy' as const, latency: 45, errorRate: 0.2, throughput: 1200 },
  { name: 'Order Processing', status: 'healthy' as const, latency: 90, errorRate: 0.8, throughput: 380 },
  { name: 'Analytics Pipeline', status: 'healthy' as const, latency: 150, errorRate: 0.3, throughput: 200 },
];

export default function Dashboard() {
  const [topology, setTopology] = useState<Topology | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [totalCIs, setTotalCIs] = useState<number>(0);
  const [alertCount, setAlertCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      cmdbAPI.getSites().then(r => setSites(r.data)),
      cmdbAPI.listCI().then(r => setTotalCIs(r.data.length)),
      alertsAPI.list('active').then(r => setAlertCount(r.data.length)).catch(() => setAlertCount(0)),
      cmdbAPI.getSiteAggregateTopology().then(r => setTopology(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const siteCount = sites.length;
  const systemHealth = Math.max(0, Math.round(100 - Math.log2(alertCount + 1) * 5));

  const STATS = [
    { label: 'Total Sites', value: String(siteCount), color: 'text-blue-500', icon: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18ZM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2' },
    { label: 'Total CIs', value: String(totalCIs), color: 'text-green-500', icon: 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2ZM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' },
    { label: 'Active Alerts', value: String(alertCount), color: 'text-yellow-500', icon: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01' },
    { label: 'System Health', value: `${systemHealth}%`, color: 'text-emerald-500', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Service Health Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-gray-50 ${stat.color}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d={stat.icon} />
              </svg>
            </div>
            <div>
              <p className={`text-2xl font-bold ${stat.color}`}>{loading ? '...' : stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SERVICES_DEFAULT.map((svc) => (
          <ServiceHealthCard key={svc.name} {...svc} />
        ))}
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Network Topology Overview</h2>
        <TopologyGraph
          topology={topology}
          siteAggregate={true}
          height="h-[400px]"
          onNodeClick={(nodeId) => navigate(`/cmdb?site=${nodeId}`)}
        />
      </div>
    </div>
  );
}