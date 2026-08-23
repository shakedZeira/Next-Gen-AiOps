import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AlertTable from '../components/AlertTable';
import AlertDetail from '../components/AlertDetail';
import IncidentDetail from '../components/IncidentDetail';
import { alertsAPI, simulateAPI, cmdbAPI } from '../api/client';
import { useAlertsWebSocket } from '../hooks/useAlertsWebSocket';
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
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showSuppressed, setShowSuppressed] = useState(false);
  const [teams, setTeams] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [viewMode, setViewMode] = useState<'alerts' | 'incidents'>('alerts');
  const [incidents, setIncidents] = useState<IncidentGroup[]>([]);
  const [stats, setStats] = useState<{ total_created: number; deduplicated: number } | null>(null);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [simulating, setSimulating] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showResolveIp, setShowResolveIp] = useState(false);
  const [resolveIpInput, setResolveIpInput] = useState('');
  const [resolveIpResult, setResolveIpResult] = useState<any>(null);
  const [resolveIpLoading, setResolveIpLoading] = useState(false);
  const navigate = useNavigate();

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

  const handleAlertEvent = useCallback((event: { type: string; alert: Alert }) => {
    const { type, alert } = event;
    setAllAlerts((prev) => {
      if (type === 'alert.created') {
        if (prev.some((a) => a.id === alert.id)) return prev;
        fetchStats();
        return [alert, ...prev];
      }
      if (type === 'alert.repeat') {
        return prev.map((a) => a.id === alert.id ? { ...a, repeat_count: alert.repeat_count, last_seen: alert.last_seen } : a);
      }
      if (type === 'alert.acknowledged') {
        return prev.map((a) => a.id === alert.id ? { ...a, status: 'acknowledged' as const, acknowledged_by: alert.acknowledged_by } : a);
      }
      if (type === 'alert.resolved') {
        return prev.map((a) => a.id === alert.id ? { ...a, status: 'resolved' as const } : a);
      }
      return prev;
    });
  }, [fetchStats]);

  const { connected } = useAlertsWebSocket(handleAlertEvent);

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
      const matchSource = sourceFilter === 'all' || a.labels?.source === sourceFilter;
      const matchSuppressed = showSuppressed || !a.suppressed;
      return matchStatus && matchTeam && matchSource && matchSuppressed;
    });
    setAlerts(filtered);
  }, [allAlerts, filter, teamFilter, sourceFilter, showSuppressed]);

  useEffect(() => {
    const allTeams = [...new Set(allAlerts.map((a) => a.team).filter(Boolean))];
    setTeams(allTeams.sort());
  }, [allAlerts]);

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
      setTimeout(() => setSimulating(false), 5000);
    } catch {
      showToast('Failed to start scenario', 'error');
      setSimulating(false);
    }
  };

  const handleSuggestFix = async (inc: IncidentGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    const alertLines = inc.alerts.slice(0, 10).map(
      (a) => `- [${a.severity}] ${a.name} — ${a.description?.slice(0, 100) || ''}`
    ).join('\n');
    const prompt =
      `I need help resolving an incident.\n\n` +
      `Incident: ${inc.title}\n` +
      `Service: ${inc.service}\n` +
      `Severity: ${inc.severity}\n` +
      `Alerts (${inc.alert_count}):\n${alertLines}\n\n` +
      `Please analyze the topology and alerts for ${inc.service} and suggest steps to resolve this incident. ` +
      `Consider service dependencies, related CIs, and common root causes.`;
    navigate('/chatbot', {
      state: {
        prefillMessage: prompt,
        threadId: `incident-${inc.incident_id}`,
        title: `Fix: ${inc.title.slice(0, 30)}`,
      },
    });
  };

  const handleResolveIp = async () => {
    const ip = resolveIpInput.trim();
    if (!ip) return;
    setResolveIpLoading(true);
    setResolveIpResult(null);
    try {
      const resp = await cmdbAPI.resolveIp(ip);
      setResolveIpResult(resp.data);
    } catch {
      setResolveIpResult({ error: `No CI found for IP ${ip}` });
    } finally {
      setResolveIpLoading(false);
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
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}
            title={connected ? 'WebSocket connected' : 'WebSocket disconnected'} />
          {stats && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="bg-gray-100 px-2 py-1 rounded">Created: {stats.total_created}</span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Deduped: {stats.deduplicated}</span>
              {(stats.suppressed ?? 0) > 0 && (
                <span className="bg-violet-100 text-violet-700 px-2 py-1 rounded">Suppressed: {stats.suppressed}</span>
              )}
              {stats.total_created > 0 && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {Math.round(((stats.deduplicated + (stats.suppressed ?? 0)) / stats.total_created) * 100)}% reduced
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

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Source:</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-1 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Sources</option>
              <option value="snmp-trap">SNMP Traps</option>
              <option value="syslog">Syslog</option>
              <option value="synthetic-generator">Synthetic</option>
              <option value="infra-simulator">Infra Simulator</option>
              <option value="scenario-simulator">Scenario</option>
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

          <button
            onClick={() => { setShowResolveIp(true); setResolveIpResult(null); setResolveIpInput(''); }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
          >
            Resolve IP
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {selectedAlert ? (
          <AlertDetail
            alert={selectedAlert}
            onClose={() => setSelectedAlert(null)}
            onAcknowledge={handleAcknowledge}
            onResolve={handleResolve}
          />
        ) : selectedIncidentId ? (
          <IncidentDetail
            incidentId={selectedIncidentId}
            onClose={() => setSelectedIncidentId(null)}
            onAcknowledge={handleAcknowledge}
            onResolve={handleResolve}
          />
        ) : viewMode === 'alerts' ? (
          <AlertTable
            alerts={alerts}
            onAcknowledge={handleAcknowledge}
            onResolve={handleResolve}
            onAlertClick={setSelectedAlert}
            showSuppressed={showSuppressed}
            onToggleSuppressed={() => setShowSuppressed(!showSuppressed)}
            suppressedCount={stats?.suppressed}
          />
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
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="bg-gray-100 px-2 py-0.5 rounded">{inc.alert_count} alerts</span>
                      {inc.first_seen && <span>First: {new Date(inc.first_seen).toLocaleTimeString()}</span>}
                      {inc.last_seen && <span>Last: {new Date(inc.last_seen).toLocaleTimeString()}</span>}
                      <button
                        onClick={(e) => handleSuggestFix(inc, e)}
                        className="ml-2 px-2 py-1 bg-purple-600 text-white rounded-md text-xs font-medium hover:bg-purple-700 transition-colors whitespace-nowrap"
                        title="Get AI suggestions for this incident"
                      >
                        Suggest Fix
                      </button>
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

      {showResolveIp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Resolve IP Address</h3>
              <button onClick={() => setShowResolveIp(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={resolveIpInput}
                onChange={(e) => setResolveIpInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleResolveIp()}
                placeholder="e.g. 10.0.1.5"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:ring-2 focus:ring-cyan-500"
              />
              <button
                onClick={handleResolveIp}
                disabled={resolveIpLoading}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50"
              >
                {resolveIpLoading ? '...' : 'Lookup'}
              </button>
            </div>
            {resolveIpResult && (
              resolveIpResult.error ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{resolveIpResult.error}</div>
              ) : (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm font-medium text-green-800 mb-1">Found CI</div>
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">{resolveIpResult.ci?.name}</span>
                    <span className="text-gray-400 mx-1">&middot;</span>
                    <span>{resolveIpResult.ci?.type}</span>
                    <span className="text-gray-400 mx-1">&middot;</span>
                    <span>{resolveIpResult.ci?.site}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Match: {resolveIpResult.match_type}
                    {resolveIpResult.ci?.management_ip && <span className="ml-2">Mgmt: {resolveIpResult.ci.management_ip}</span>}
                  </div>
                  <button
                    onClick={() => {
                      setShowResolveIp(false);
                      navigate(`/cmdb?site=${resolveIpResult.ci?.site || 'all'}`);
                    }}
                    className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                  >
                    View in CMDB Explorer
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
