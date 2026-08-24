import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, RadioTower, AlertTriangle, Server, Activity, BarChart3 } from 'lucide-react';
import { snmpAPI } from '../api/client';

interface SNMPTrap {
  timestamp: string;
  source_ip: string;
  source_port: number;
  snmp_version: string;
  trap_oid: string;
  trap_name: string;
  severity: string;
  uptime_ticks: number | null;
  uptime_seconds: number | null;
  device_name: string;
  device_type: string;
  ci_matched: boolean;
  alert_published: boolean;
  description: string;
}

interface SNMPStats {
  traps_received: number;
  alerts_published: number;
  ci_resolved: number;
  unmapped_oids: number;
  processing_errors: number;
  listener_running: boolean;
  history_size: number;
  by_severity: Record<string, number>;
  by_source: Record<string, number>;
  by_trap: Record<string, number>;
  uptime_seconds: number;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-blue-100 text-blue-800 border-blue-300',
  info: 'bg-gray-100 dark:bg-gray-800 dark:bg-gray-800 text-gray-800 border-gray-300 dark:border-gray-600 dark:border-gray-600',
};

const severityDotColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-400',
  low: 'bg-blue-500',
  info: 'bg-gray-400',
};

const KNOWN_TRAP_NAMES = [
  'linkDown',
  'linkUp',
  'authFailure',
  'cpmCPUHighThreshold',
  'cpmMemoryThreshold',
  'ciscoEnvMonTemperatureState',
  'ospfNbrStateChange',
  'rootBridgeChange',
  'snmpTrap',
];

const REFRESH_INTERVAL_MS = 5000;

export default function SNMPTrapLog() {
  const [traps, setTraps] = useState<SNMPTrap[]>([]);
  const [stats, setStats] = useState<SNMPStats | null>(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [sourceIpFilter, setSourceIpFilter] = useState('');
  const [oidFilter, setOidFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refreshRef = useRef<number | null>(null);

  const fetchTraps = useCallback(async () => {
    try {
      const resp = await snmpAPI.getTraps({
        severity: severityFilter || undefined,
        source_ip: sourceIpFilter || undefined,
        limit: 200,
      });
      setTraps(resp.data || []);
      setError('');
    } catch {
      setError('Failed to fetch traps - check that snmp-receiver is running');
    } finally {
      setLoading(false);
    }
  }, [severityFilter, sourceIpFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const resp = await snmpAPI.getStats();
      setStats(resp.data);
    } catch {
      // ignore - stats are non-critical
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchTraps();
    fetchStats();
  }, [fetchTraps, fetchStats]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (autoRefresh) {
      refreshRef.current = window.setInterval(refreshAll, REFRESH_INTERVAL_MS);
    }
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [autoRefresh, refreshAll]);

  const visibleTraps = oidFilter
    ? traps.filter((t) => t.trap_name === oidFilter || t.trap_oid === oidFilter)
    : traps;

  const oidOptions = Array.from(
    new Set([...KNOWN_TRAP_NAMES, ...Object.keys(stats?.by_trap || {})])
  );

  const topSources = Object.entries(stats?.by_source || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const shortOid = (oid: string) => {
    if (!oid) return '-';
    const parts = oid.split('.');
    return parts.length > 8 ? `${parts.slice(0, 6).join('.')}...` : oid;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 flex items-center gap-2">
            <RadioTower className="w-6 h-6 text-primary-600" />
            SNMP Trap Log
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time SNMP trap stream from network devices (v1 / v2c / v3)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <span className="flex items-center gap-1.5 text-sm">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  stats.listener_running ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className="text-gray-500 dark:text-gray-400">
                Listener {stats.listener_running ? 'running' : 'down'}
              </span>
            </span>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 dark:border-gray-600"
            />
            Auto-refresh ({REFRESH_INTERVAL_MS / 1000}s)
          </label>
          <button
            onClick={refreshAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Traps</div>
              <Activity className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mt-1">
              {stats.traps_received.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Buffer: {stats.history_size} stored</div>
          </div>
          <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Alerts Published</div>
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-orange-600 mt-1">
              {stats.alerts_published.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              CI resolved: {stats.ci_resolved.toLocaleString()} | Unmapped OIDs:{' '}
              {stats.unmapped_oids.toLocaleString()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">By Severity</div>
              <BarChart3 className="w-4 h-4 text-purple-500" />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.keys(severityColors).map((sev) => (
                <span
                  key={sev}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border ${
                    severityColors[sev]
                  } ${(stats.by_severity[sev] || 0) === 0 ? 'opacity-40' : ''}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${severityDotColors[sev]}`} />
                  {sev}: {stats.by_severity[sev] || 0}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Top Sources</div>
              <Server className="w-4 h-4 text-teal-500" />
            </div>
            {topSources.length > 0 ? (
              <div className="mt-2 space-y-1">
                {topSources.map(([ip, count]) => (
                  <div key={ip} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-blue-600 truncate">{ip}</span>
                    <span className="text-gray-700 dark:text-gray-300 font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 mt-2">No traps yet</div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">Source IP:</label>
          <input
            type="text"
            value={sourceIpFilter}
            onChange={(e) => setSourceIpFilter(e.target.value)}
            placeholder="e.g. 10.0.1.2"
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 text-sm font-mono focus:ring-2 focus:ring-primary-500 w-44"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">Severity:</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">OID Type:</label>
          <select
            value={oidFilter}
            onChange={(e) => setOidFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All</option>
            {oidOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={refreshAll} className="ml-auto underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      <TrapTable traps={visibleTraps} loading={loading} formatTime={formatTime} shortOid={shortOid} />

      <div className="text-xs text-gray-400 text-center">
        Listening on UDP port 162 (host port 1162) | Buffer: 1000 traps | SNMP v1 / v2c / v3
      </div>
    </div>
  );
}

function TrapTable({
  traps,
  loading,
  formatTime,
  shortOid,
}: {
  traps: SNMPTrap[];
  loading: boolean;
  formatTime: (ts: string) => string;
  shortOid: (oid: string) => string;
}) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border overflow-hidden">
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading SNMP traps...</div>
      </div>
    );
  }

  if (traps.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border overflow-hidden">
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <RadioTower className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <div className="font-medium mb-1">No SNMP traps received yet</div>
          <div className="text-sm mb-2">
            Send a test trap with:{' '}
            <code className="bg-gray-100 dark:bg-gray-800 dark:bg-gray-800 px-2 py-0.5 rounded text-xs font-mono">
              snmptrap -v 2c -c public localhost:1162 '' 1.3.6.1.6.3.1.1.5.3
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border overflow-hidden">
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900 dark:bg-gray-900 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Timestamp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Source IP
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Device
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                OID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Alert Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Severity
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {traps.map((trap, idx) => (
              <tr
                key={`${trap.timestamp}-${idx}`}
                className={`font-mono text-xs __DM_HBG50__ transition-colors ${
                  trap.severity === 'critical' ? 'bg-red-50/50' : ''
                } ${trap.alert_published ? 'border-l-2 border-red-400' : ''}`}
              >
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {formatTime(trap.timestamp)}
                </td>
                <td className="px-4 py-2.5 text-blue-600 whitespace-nowrap">{trap.source_ip}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-900 dark:text-gray-100 dark:text-gray-100 font-semibold">{trap.device_name}</span>
                    {trap.ci_matched && (
                      <span
                        className="px-1 py-0.5 rounded bg-green-100 text-green-700 text-[10px]"
                        title="Matched CMDB CI"
                      >
                        CI
                      </span>
                    )}
                    <span className="text-gray-400">({trap.snmp_version})</span>
                  </div>
                </td>
                <td
                  className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap"
                  title={`${trap.trap_oid} - ${trap.description}`}
                >
                  {shortOid(trap.trap_oid)}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="text-gray-900 dark:text-gray-100 dark:text-gray-100 font-semibold">{trap.trap_name}</span>
                  {trap.alert_published && (
                    <span
                      className="ml-1.5 px-1 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold"
                      title="Alert published to NOC"
                    >
                      ALERT
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium border ${
                      severityColors[trap.severity] || severityColors.info
                    }`}
                  >
                    {trap.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
