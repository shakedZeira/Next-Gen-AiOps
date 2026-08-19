import { useState } from 'react';
import AlertTable from '../components/AlertTable';
import { Alert } from '../types';

const DEMO_ALERTS: Alert[] = [
  { id: '1', name: 'High Latency P99', service: 'Payment Gateway', severity: 'critical', description: 'P99 latency exceeded 2s threshold', status: 'active', created_at: new Date().toISOString() },
  { id: '2', name: 'Error Rate Spike', service: 'E-Commerce Platform', severity: 'high', description: 'Error rate above 5% for 5 minutes', status: 'acknowledged', created_at: new Date(Date.now() - 300000).toISOString(), acknowledged_by: 'operator@aiops.local' },
  { id: '3', name: 'Disk Space Low', service: 'Inventory Service', severity: 'medium', description: 'Disk usage above 85%', status: 'active', created_at: new Date(Date.now() - 600000).toISOString() },
  { id: '4', name: 'SSL Certificate Expiry', service: 'Notification Service', severity: 'low', description: 'Certificate expires in 7 days', status: 'active', created_at: new Date(Date.now() - 900000).toISOString() },
];

export default function NOCAlerts({ user }: { user: any }) {
  const [alerts, setAlerts] = useState<Alert[]>(DEMO_ALERTS);
  const [filter, setFilter] = useState<string>('all');

  const handleAcknowledge = async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' as const, acknowledged_by: user?.email } : a));
  };

  const handleResolve = async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' as const } : a));
  };

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">NOC Alert Console</h1>
        <div className="flex gap-2">
          {['all', 'active', 'acknowledged', 'resolved'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-sm ${filter === f ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <AlertTable alerts={filtered} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
      </div>
    </div>
  );
}
