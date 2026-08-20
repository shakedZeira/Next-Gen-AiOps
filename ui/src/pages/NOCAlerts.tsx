import { useState, useEffect, useCallback } from 'react';
import AlertTable from '../components/AlertTable';
import IncidentDetail from '../components/IncidentDetail';
import { alertsAPI, simulateAPI } from '../api/client';
import { Alert, IncidentGroup, Scenario } from '../types';

const DEMO_ALERTS: Alert[] = [
  { id: '1', name: 'High Latency P99', service: 'Payment Gateway', severity: 'critical', description: 'P99 latency exceeded 2s threshold', status: 'active', team: 'payments', created_at: new Date().toISOString() },
  { id: '2', name: 'Error Rate Spike', service: 'E-Commerce Platform', severity: 'high', description: 'Error rate above 5% for 5 minutes', status: 'acknowledged', team: 'backend', created_at: new Date(Date.now() - 300000).toISOString(), acknowledged_by: 'operator@aiops.local' },
  { id: '3', name: 'Disk Space Low', service: 'Inventory Service', severity: 'medium', description: 'Disk usage above 85%', status: 'active', team: 'data', created_at: new Date(Date.now() - 600000).toISOString() },
  { id: '4', name: 'SSL Certificate Expiry', service: 'Notification Service', severity: 'low', description: 'Certificate expires in 7 days', status: 'active', team: 'platform', created_at: new Date(Date.now() - 900000).toISOString() },
];

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-blue-100 text-blue-800 border-blue-300',
  info: 'bg-gray-100 text-gray-800 border-gray-300',
};

export default function NOCAlerts({ user }: { user: any }) {
  const [allAlerts, setAllAlerts] = useState<Alert[]>(DEMO_ALERTS);
  const [alerts, setAlerts] = useState<Alert[]>(DEMO_ALERTS);
  const [filter, setFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [teams, setTeams] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [viewMode, setViewMode] = useState<'alerts' | 'incidents'>('alerts');
  const [incidents, setIncidents] = useState<IncidentGroup[]>([]);
  const [stats, setStats] = useState<{ total_created: number; deduplicated: number } | null>(null);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [simulating, setSimulating] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const resp = await alertsAPI.list(filter === 'all' ? undefined : filter, teamFilter === 'all' ? undefined : teamFilter);
      if (resp.data && resp.data.length > 0) {
        setAllAlerts(resp.data);
      }
    } catch {
      // API may be down, keep demo data
    }
  }, [filter, teamFilter]);

  const fetchIncidents = useCallback(async () => {
    try {
      const resp = await alertsAPI.incidents(filter === 'all' ? undefined : filter);
      setIncidents(resp.data || []);
    } catch {
      // ignore
    }
  }, [filter]);

  const fetchStats = useCallback(async () => {
    try {
      const resp = await alertsAPI.stats();
      setStats(resp.data);
    } catch {
      // ignore
    }
  }, []);

  const fetchScenarios = useCallback(async () => {
    try {
      const resp = await simulateAPI.scenarios();
      setScenarios(resp.data || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    fetchIncidents();
    fetchStats();
    fetchScenarios();
  }, [fetchAlerts, fetchIncidents, fetchStats, fetchScenarios]);

  useEffect(() => {
    const filtered = allAlerts.filter((a) => {
      const matchStatus = filter === 'all' || a.status === filter;
      const matchTeam = teamFilter === 'all' || a.team === teamFilter;
      return matchStatus && matchTeam;
    });
    setAlerts(filtered);
  }, [allAlerts, filter, teamFilter]);

  useEffect(() => {
    const allTeams = [...new Set(allAlerts.map((a) => a.team).filter(Boolean))];
    setTeams(allTeams.sort());
  }, [allAlerts]);

  useEffect(() => {
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [refreshInterval]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await alertsAPI.acknowledge(id, user?.email || 'operator');
    } catch {
      // API may be down, proceed with local update
    }
    setAllAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'acknowledged' as const, acknowledged_by: user?.email } : a)));
    showToast('Alert acknowledged', 'success');
  };

  const handleResolve = async (id: string) => {
    try {
      await alertsAPI.resolve(id);
    } catch {
      // API may be down, proceed with local update
    }
    setAllAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'resolved' as const } : a)));
    showToast('Alert resolved', 'success');
  };

  const handleRunScenario = async () => {
    if (!selectedScenario) {
      showToast('Select a scenario first', 'error');
      return;
    }
    setSimulating(true);
    try {
      await simulateAPI.run(selectedScenario);
      const scenario = scenarios.find(s => s.id === selectedScenario);
      showToast(`Scenario started: ${scenario?.name || selectedScenario}`, 'success');

      const interval = setInterval(async () => {
        await fetchAlerts();
        await fetchIncidents();
        await fetchStats();
      }, 2000);
      setRefreshInterval(interval);

      setTimeout(() => {
        clearInterval(interval);
        setRefreshInterval(null);
        setSimulating(false);
        fetchAlerts();
        fetchIncidents();
        fetchStats();
      }, 60000);
    } catch {
      showToast('Failed to start scenario', 'error');
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium transition-opacity ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">NOC Alert Console</h1>
          {stats && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="bg-gray-100 px-2 py-1 rounded">Created: {stats.total_created}</span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Deduped: {stats.deduplicated}</span>
              {stats.total_created > 0 && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {Math.round((stats.deduplicated / stats.total_created) * 100)}% reduced
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
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

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['alerts', 'incidents'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  viewMode === mode ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
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

          <div className="flex items-center gap-2 border-l pl-2 ml-1">
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="px-3 py-1 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-red-500"
            >
              <option value="">Simulate scenario...</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.alert_count} alerts)</option>
              ))}
            </select>
            <button
              onClick={handleRunScenario}
              disabled={!selectedScenario || simulating}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                simulating
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {simulating ? 'Running...' : 'Run'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {selectedIncidentId ? (
          <IncidentDetail
            incidentId={selectedIncidentId}
            onClose={() => setSelectedIncidentId(null)}
            onAcknowledge={handleAcknowledge}
            onResolve={handleResolve}
          />
        ) : viewMode === 'alerts' ? (
          <AlertTable alerts={alerts} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
        ) : (
          <div className="divide-y divide-gray-200">
            {incidents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No incidents found</div>
            ) : (
              incidents.map((inc) => (
                <div
                  key={inc.incident_id}
                  onClick={() => setSelectedIncidentId(inc.incident_id)}
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${severityColors[inc.severity] || ''}`}>
                        {inc.severity}
                      </span>
                      <span className="font-medium text-gray-900 text-sm">{inc.title}</span>
                      <span className="text-xs text-gray-500">{inc.service}</span>
                      <span className="text-xs text-gray-400">→</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="bg-gray-100 px-2 py-0.5 rounded">{inc.alert_count} alerts</span>
                      {inc.first_seen && <span>First: {new Date(inc.first_seen).toLocaleTimeString()}</span>}
                      {inc.last_seen && <span>Last: {new Date(inc.last_seen).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                  <div className="ml-4 space-y-1">
                    {inc.alerts.slice(0, 3).map((a) => (
                      <div key={a.id} className="flex items-center gap-3 text-xs">
                        <span className="text-gray-400 w-16">{new Date(a.created_at).toLocaleTimeString()}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${severityColors[a.severity] || ''}`}>
                          {a.severity}
                        </span>
                        <span className="text-gray-700">{a.name}</span>
                        {(a.repeat_count ?? 1) > 1 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                            x{a.repeat_count}
                          </span>
                        )}
                        <span className="text-gray-400">{a.status}</span>
                      </div>
                    ))}
                    {inc.alerts.length > 3 && (
                      <div className="text-xs text-gray-400">+{inc.alerts.length - 3} more alerts</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
