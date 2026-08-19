import { useState, useEffect } from 'react';
import AlertTable from '../components/AlertTable';
import { alertsAPI } from '../api/client';
import { Alert } from '../types';

const DEMO_ALERTS: Alert[] = [
  { id: '1', name: 'High Latency P99', service: 'Payment Gateway', severity: 'critical', description: 'P99 latency exceeded 2s threshold', status: 'active', team: 'payments', created_at: new Date().toISOString() },
  { id: '2', name: 'Error Rate Spike', service: 'E-Commerce Platform', severity: 'high', description: 'Error rate above 5% for 5 minutes', status: 'acknowledged', team: 'backend', created_at: new Date(Date.now() - 300000).toISOString(), acknowledged_by: 'operator@aiops.local' },
  { id: '3', name: 'Disk Space Low', service: 'Inventory Service', severity: 'medium', description: 'Disk usage above 85%', status: 'active', team: 'data', created_at: new Date(Date.now() - 600000).toISOString() },
  { id: '4', name: 'SSL Certificate Expiry', service: 'Notification Service', severity: 'low', description: 'Certificate expires in 7 days', status: 'active', team: 'platform', created_at: new Date(Date.now() - 900000).toISOString() },
];

export default function NOCAlerts({ user }: { user: any }) {
  const [alerts, setAlerts] = useState<Alert[]>(DEMO_ALERTS);
  const [filter, setFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [teams, setTeams] = useState<string[]>([]);

  const fetchAlerts = async () => {
    try {
      const resp = await alertsAPI.list(filter === 'all' ? undefined : filter, teamFilter === 'all' ? undefined : teamFilter);
      if (resp.data && resp.data.length > 0) {
        setAlerts(resp.data);
      }
    } catch {
      // API may be down, keep demo data
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [filter, teamFilter]);

  useEffect(() => {
    const allTeams = [...new Set(alerts.map((a) => a.team).filter(Boolean))];
    setTeams(allTeams.sort());
  }, [alerts]);

  const handleAcknowledge = async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'acknowledged' as const, acknowledged_by: user?.email } : a)));
  };

  const handleResolve = async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'resolved' as const } : a)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">NOC Alert Console</h1>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {['all', 'active', 'acknowledged', 'resolved'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  filter === f ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Team:</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-1 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <AlertTable alerts={alerts} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
      </div>
    </div>
  );
}
