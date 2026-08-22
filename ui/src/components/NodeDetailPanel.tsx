import { useState, useEffect, useCallback } from 'react';
import { cmdbAPI, alertsAPI, networkSimAPI } from '../api/client';
import { CIDetails, Alert } from '../types';

interface DeviceInterface {
  name: string;
  ip: string;
  mac: string;
  up: boolean;
  subnet: string;
}

interface Route {
  prefix: string;
  next_hop_ip: string;
  out_iface: string;
  metric: number;
  proto: string;
  state: string;
}

interface ArpEntry {
  ip: string;
  mac: string;
  interface: string;
  state: string;
}

interface MacEntry {
  vlan: number;
  mac: string;
  interface: string;
  type: string;
}

interface PingResult {
  reachable: boolean;
  hops: { hop: number; ip: string; hostname: string; rtt_ms: number | null }[];
  avg_rtt_ms: number | null;
  packet_loss: number;
}

interface TracerouteResult {
  reachable: boolean;
  hops: { hop: number; ip: string; hostname: string; rtt_ms: number | null; interface: string }[];
  loop_detected: boolean;
  blackhole_detected: boolean;
}

interface Props {
  ciId: string | null;
  onClose: () => void;
  onViewConnections: (ciId: string, ciName: string, neighbors: CIDetails['neighbors']) => void;
  onTraceroute?: (deviceNames: string[]) => void;
  onClearTraceroute?: () => void;
  onFailureInjected?: () => void;
  onRecovered?: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const STATUS_ICONS: Record<string, string> = {
  active: '⚠',
  resolved: '✓',
  acknowledged: '⏳',
};

const DIRECTION_COLORS: Record<string, string> = {
  upstream: 'text-blue-400',
  downstream: 'text-green-400',
};

const TYPE_ICONS: Record<string, string> = {
  switch: '🔀',
  router: '🔀',
  firewall: '🛡',
  host: '💻',
  physical_server: '🖥',
  database: '🗄',
  cache: '⚡',
  container: '📦',
  pod: '📦',
  load_balancer: '⚡',
  api_gateway: '🔓',
  microservice: '⚙',
  message_queue: '📨',
  storage: '📁',
};

type Tab = 'details' | 'network' | 'trace' | 'actions';

export default function NodeDetailPanel({ ciId, onClose, onViewConnections, onTraceroute, onClearTraceroute, onFailureInjected, onRecovered }: Props) {
  const [details, setDetails] = useState<CIDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [tab, setTab] = useState<Tab>('details');

  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [arpEntries, setArpEntries] = useState<ArpEntry[]>([]);
  const [arpLoading, setArpLoading] = useState(false);
  const [macEntries, setMacEntries] = useState<MacEntry[]>([]);
  const [macLoading, setMacLoading] = useState(false);

  const [pingTarget, setPingTarget] = useState('');
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [pingLoading, setPingLoading] = useState(false);

  const [traceTarget, setTraceTarget] = useState('');
  const [traceResult, setTraceResult] = useState<TracerouteResult | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  const [failureType, setFailureType] = useState('link');
  const [selectedInterface, setSelectedInterface] = useState<string>('');
  const [interfaces, setInterfaces] = useState<DeviceInterface[]>([]);
  const [interfacesLoading, setInterfacesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  useEffect(() => {
    if (!ciId) {
      setDetails(null);
      setAlerts([]);
      setTab('details');
      setRoutes([]);
      setArpEntries([]);
      setMacEntries([]);
      setPingResult(null);
      setTraceResult(null);
      setActionResult(null);
      onClearTraceroute?.();
      return;
    }
    setLoading(true);
    setTab('details');
    setPingResult(null);
    setTraceResult(null);
    setActionResult(null);
    onClearTraceroute?.();
    cmdbAPI.getCIDetails(ciId)
      .then((r) => setDetails(r.data))
      .catch(() => setDetails(null))
      .finally(() => setLoading(false));
  }, [ciId]);

  useEffect(() => {
    if (ciId && details?.ci) {
      const ciName = details.ci.name.toLowerCase();
      alertsAPI.list('active')
        .then((r) => {
          const filtered = r.data.filter((a: any) =>
            a.service?.toLowerCase().includes(ciName) ||
            a.name?.toLowerCase().includes(ciName)
          );
          setAlerts(filtered);
        })
        .catch(() => setAlerts([]));
    }
  }, [ciId, details?.ci]);

  const loadRoutes = useCallback(async () => {
    if (!ciId) return;
    setRoutesLoading(true);
    try {
      const r = await networkSimAPI.getRoutes(ciId);
      const raw = r.data.routes || {};
      setRoutes(Array.isArray(raw) ? raw : Object.values(raw));
    } catch {
      setRoutes([]);
    } finally {
      setRoutesLoading(false);
    }
  }, [ciId]);

  const loadArp = useCallback(async () => {
    if (!ciId) return;
    setArpLoading(true);
    try {
      const r = await networkSimAPI.getArp(ciId);
      const raw = r.data.arp_cache || {};
      const entries = Array.isArray(raw) ? raw : Object.entries(raw).map(([ip, val]: [string, any]) => ({
        ip,
        mac: val.mac || '—',
        interface: val.interface || val.iface || '—',
        state: val.state || 'REACHABLE',
      }));
      setArpEntries(entries);
    } catch {
      setArpEntries([]);
    } finally {
      setArpLoading(false);
    }
  }, [ciId]);

  const loadMacTable = useCallback(async () => {
    if (!ciId) return;
    setMacLoading(true);
    try {
      const r = await networkSimAPI.getMacTable(ciId);
      const raw = r.data.mac_table || {};
      const entries = Array.isArray(raw) ? raw : Object.entries(raw).map(([mac, val]: [string, any]) => ({
        vlan: val.vlan || 1,
        mac,
        interface: val.interface || val.iface || '—',
        type: val.type || 'DYNAMIC',
      }));
      setMacEntries(entries);
    } catch {
      setMacEntries([]);
    } finally {
      setMacLoading(false);
    }
  }, [ciId]);

  const loadInterfaces = useCallback(async () => {
    if (!ciId) return;
    setInterfacesLoading(true);
    try {
      const r = await networkSimAPI.getInterfaces(ciId);
      setInterfaces(r.data.interfaces || []);
    } catch {
      setInterfaces([]);
    } finally {
      setInterfacesLoading(false);
    }
  }, [ciId]);

  useEffect(() => {
    if (tab === 'network' && ciId) {
      loadRoutes();
      loadArp();
      loadMacTable();
    }
    if (tab === 'actions' && ciId) {
      loadInterfaces();
    }
  }, [tab, ciId, loadRoutes, loadArp, loadMacTable, loadInterfaces]);

  const handlePing = async () => {
    if (!ciId || !pingTarget) return;
    setPingLoading(true);
    setPingResult(null);
    try {
      const r = await networkSimAPI.ping(ciId, pingTarget);
      const d = r.data;
      setPingResult({
        reachable: d.success,
        hops: (d.hops || []).map((h: any, i: number) => ({
          hop: i + 1,
          ip: h.ip || '—',
          hostname: h.device || '—',
          rtt_ms: h.latency_ms ?? null,
        })),
        avg_rtt_ms: d.rtt_ms ?? null,
        packet_loss: d.success ? 0 : 100,
      });
    } catch {
      setPingResult(null);
    } finally {
      setPingLoading(false);
    }
  };

  const handleTraceroute = async () => {
    if (!ciId || !traceTarget) return;
    setTraceLoading(true);
    setTraceResult(null);
    onClearTraceroute?.();
    try {
      const r = await networkSimAPI.traceroute(ciId, traceTarget);
      const d = r.data;
      const hops = (d.hops || []).map((h: any, i: number) => ({
        hop: i + 1,
        ip: h.ip || '—',
        hostname: h.device || '—',
        rtt_ms: h.latency_ms ?? null,
        interface: h.interface || h.iface || '—',
      }));
      setTraceResult({
        reachable: d.success,
        hops,
        loop_detected: d.error?.includes?.('loop') || false,
        blackhole_detected: d.error?.includes?.('No route') || false,
      });
      if (hops.length > 0) {
        const path = hops.map((h: any) => h.hostname).filter((name: string) => name && name !== '—');
        onTraceroute?.(path);
      }
    } catch {
      setTraceResult(null);
    } finally {
      setTraceLoading(false);
    }
  };

  const handleFailure = async () => {
    if (!ciId) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      const r = await networkSimAPI.injectFailure(ciId, failureType, selectedInterface || undefined);
      const data = r.data;
      setActionResult(data.detail || `Failure injected on ${data.device_name}`);

      // Create alert via alert-noc
      try {
        const deviceName = data.device_name || ciId;
        const ifaceLabel = selectedInterface || 'all interfaces';
        await alertsAPI.create({
          name: `Network Failure: ${deviceName} - ${ifaceLabel}`,
          service: deviceName,
          severity: 'critical',
          description: `Simulated ${failureType} failure on ${deviceName} (${ifaceLabel})`,
          team: 'network',
          labels: { source: 'network-sim', device_id: ciId, interface: ifaceLabel, failure_type: failureType },
        });
      } catch {
        // Alert creation is best-effort
      }

      onFailureInjected?.();
    } catch (e: any) {
      setActionResult(e.response?.data?.detail || 'Failed to inject failure');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!ciId) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      const r = await networkSimAPI.recover(ciId, failureType, selectedInterface || undefined);
      setActionResult(r.data.detail || `Recovery initiated for ${r.data.recovered}`);
      onRecovered?.();
    } catch (e: any) {
      setActionResult(e.response?.data?.detail || 'Failed to recover');
    } finally {
      setActionLoading(false);
    }
  };

  if (!ciId) return null;

  const ci = details?.ci;
  const neighbors = details?.neighbors || [];

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'details', label: 'Details', icon: '📋' },
    { key: 'network', label: 'Network', icon: '🌐' },
    { key: 'trace', label: 'Ping / Trace', icon: '📡' },
    { key: 'actions', label: 'Actions', icon: '⚡' },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[440px] bg-gray-900 border-l border-gray-700 z-50 transform transition-transform duration-300 ease-in-out translate-x-0 overflow-y-auto shadow-2xl">
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg">{ci ? (TYPE_ICONS[ci.type] || '?') : '?'}</span>
              <h2 className="text-lg font-bold text-white truncate">{loading ? 'Loading...' : ci?.name || 'Unknown'}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {ci && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600">{ci.type}</span>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">✕</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  tab === t.key ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
              >
                <span className="mr-1">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <div className="animate-spin w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full mr-3" />
              Loading details...
            </div>
          ) : ci ? (
            <>
              {/* Details Tab */}
              {tab === 'details' && (
                <>
                  <div className="bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-700/50">
                    <div className="space-y-2.5 text-sm">
                      {[
                        ['Type', ci.type],
                        ['Provider', ci.provider],
                        ['Team', ci.team],
                        ['Site', ci.site],
                        ['Layer', ci.network_layer],
                        ['Environment', ci.environment],
                      ].map(([label, value]) =>
                        value ? (
                          <div key={label} className="flex justify-between">
                            <span className="text-gray-400">{label}:</span>
                            <span className="text-white font-medium">{value}</span>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>

                  {(ci as any).management_ip || (ci as any).loopback_ip || (ci as any).subnet ? (
                    <div className="bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-700/50">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">IP Addresses</h4>
                      <div className="space-y-2 text-sm">
                        {(ci as any).management_ip && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Management:</span>
                            <span className="text-cyan-400 font-mono font-medium">{(ci as any).management_ip}</span>
                          </div>
                        )}
                        {(ci as any).loopback_ip && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Loopback:</span>
                            <span className="text-cyan-400 font-mono font-medium">{(ci as any).loopback_ip}</span>
                          </div>
                        )}
                        {(ci as any).subnet && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Subnet:</span>
                            <span className="text-cyan-400 font-mono font-medium">{(ci as any).subnet}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {neighbors.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Connected Devices ({neighbors.length})</h3>
                      <div className="space-y-2">
                        {neighbors.map((n) => (
                          <div key={n.id} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 flex items-center gap-3">
                            <span className="text-base">{TYPE_ICONS[n.type] || '?'}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-white font-medium truncate">{n.name || n.id}</div>
                              <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                                <span className={DIRECTION_COLORS[n.direction] || 'text-gray-400'}>{n.direction}</span>
                                <span className="text-gray-500">·</span>
                                <span>{n.relationship}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Alerts</h3>
                    <div className="space-y-2">
                      {alerts.length > 0 ? (
                        alerts.map((alert) => (
                          <div key={alert.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm ${SEVERITY_COLORS[alert.severity] || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                            <span>{STATUS_ICONS[alert.status] || '•'}</span>
                            <span className="flex-1">{alert.name}</span>
                            <span className="text-xs text-gray-400 whitespace-nowrap">{alert.created_at}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500">No active alerts for this CI</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onViewConnections(ci.id, ci.name, neighbors)}
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      View Connections
                    </button>
                    <button className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors">
                      View Logs
                    </button>
                  </div>
                </>
              )}

              {/* Network Tab */}
              {tab === 'network' && (
                <div className="space-y-4">
                  {/* Routing Table */}
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Routing Table</h4>
                      {routesLoading && <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full" />}
                    </div>
                    {routes.length > 0 ? (
                      <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-700">
                            <th className="text-left py-1 pr-2">Prefix</th>
                            <th className="text-left py-1 pr-2">Next Hop</th>
                            <th className="text-left py-1 pr-2">Iface</th>
                            <th className="text-left py-1 pr-2">Proto</th>
                            <th className="text-right py-1">Metric</th>
                          </tr>
                        </thead>
                        <tbody>
                          {routes.map((r, i) => (
                            <tr key={i} className="border-b border-gray-700/50">
                              <td className="py-1 pr-2 font-mono text-cyan-400">{r.prefix}</td>
                              <td className="py-1 pr-2 font-mono text-gray-300">{r.next_hop_ip}</td>
                              <td className="py-1 pr-2 text-gray-400">{r.out_iface}</td>
                              <td className="py-1 pr-2 text-gray-400">{r.proto}</td>
                              <td className="py-1 text-right text-gray-400">{r.metric}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">{routesLoading ? 'Loading...' : 'No routes'}</p>
                    )}
                  </div>

                  {/* ARP Cache */}
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ARP Cache</h4>
                      {arpLoading && <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full" />}
                    </div>
                    {arpEntries.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-700">
                              <th className="text-left py-1 pr-2">IP</th>
                              <th className="text-left py-1 pr-2">MAC</th>
                              <th className="text-left py-1 pr-2">Iface</th>
                              <th className="text-left py-1">State</th>
                            </tr>
                          </thead>
                          <tbody>
                            {arpEntries.map((a, i) => (
                              <tr key={i} className="border-b border-gray-700/50">
                                <td className="py-1 pr-2 font-mono text-cyan-400">{a.ip}</td>
                                <td className="py-1 pr-2 font-mono text-gray-300">{a.mac}</td>
                                <td className="py-1 pr-2 text-gray-400">{a.interface}</td>
                                <td className="py-1">
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${a.state === 'REACHABLE' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                    {a.state}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">{arpLoading ? 'Loading...' : 'No ARP entries'}</p>
                    )}
                  </div>

                  {/* MAC Table */}
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">MAC Address Table</h4>
                      {macLoading && <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full" />}
                    </div>
                    {macEntries.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-700">
                              <th className="text-left py-1 pr-2">VLAN</th>
                              <th className="text-left py-1 pr-2">MAC</th>
                              <th className="text-left py-1 pr-2">Iface</th>
                              <th className="text-left py-1">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {macEntries.map((m, i) => (
                              <tr key={i} className="border-b border-gray-700/50">
                                <td className="py-1 pr-2 text-gray-300">{m.vlan}</td>
                                <td className="py-1 pr-2 font-mono text-gray-300">{m.mac}</td>
                                <td className="py-1 pr-2 text-gray-400">{m.interface}</td>
                                <td className="py-1 text-gray-400">{m.type}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">{macLoading ? 'Loading...' : 'No MAC entries'}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Ping / Traceroute Tab */}
              {tab === 'trace' && (
                <div className="space-y-4">
                  {/* Ping */}
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ping</h4>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={pingTarget}
                        onChange={(e) => setPingTarget(e.target.value)}
                        placeholder="Destination IP"
                        className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white font-mono placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                      <button
                        onClick={handlePing}
                        disabled={pingLoading || !pingTarget}
                        className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {pingLoading ? '...' : 'Ping'}
                      </button>
                    </div>
                    {pingResult && (
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={pingResult.reachable ? 'text-green-400' : 'text-red-400'}>
                            {pingResult.reachable ? '✓ Reachable' : '✗ Unreachable'}
                          </span>
                          {pingResult.avg_rtt_ms != null && (
                            <span className="text-gray-400">avg {Number(pingResult.avg_rtt_ms).toFixed(1)}ms</span>
                          )}
                          <span className="text-gray-400">{pingResult.packet_loss}% loss</span>
                        </div>
                        {pingResult.hops.map((h: { hop: number; ip: string; hostname: string; rtt_ms: number | null }, i: number) => (
                          <div key={i} className="flex items-center gap-3 text-gray-300">
                            <span className="text-gray-500 w-4">{h.hop}</span>
                            <span className="font-mono text-cyan-400">{h.ip}</span>
                            <span className="text-gray-400">{h.hostname}</span>
                            {h.rtt_ms != null && <span className="text-gray-400">{Number(h.rtt_ms).toFixed(1)}ms</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Traceroute */}
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Traceroute</h4>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={traceTarget}
                        onChange={(e) => setTraceTarget(e.target.value)}
                        placeholder="Destination IP"
                        className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white font-mono placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleTraceroute}
                        disabled={traceLoading || !traceTarget}
                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {traceLoading ? '...' : 'Trace'}
                      </button>
                    </div>
                    {traceResult && (
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={traceResult.reachable ? 'text-green-400' : 'text-red-400'}>
                            {traceResult.reachable ? '✓ Destination reachable' : '✗ Destination unreachable'}
                          </span>
                          {traceResult.loop_detected && <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded">LOOP DETECTED</span>}
                          {traceResult.blackhole_detected && <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded">BLACKHOLE</span>}
                        </div>
                        {traceResult.hops.map((h: { hop: number; ip: string; hostname: string; rtt_ms: number | null; interface: string }, i: number) => (
                          <div key={i} className="flex items-center gap-3 text-gray-300">
                            <span className="text-gray-500 w-4">{h.hop}</span>
                            <span className="font-mono text-cyan-400">{h.ip}</span>
                            <span className="text-gray-400">{h.hostname}</span>
                            <span className="text-gray-500 text-[10px]">{h.interface}</span>
                            {h.rtt_ms != null && <span className="text-gray-400 ml-auto">{Number(h.rtt_ms).toFixed(1)}ms</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions Tab */}
              {tab === 'actions' && (
                <div className="space-y-4">
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Interface Selection</h4>
                    {interfacesLoading ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full" />
                        Loading interfaces...
                      </div>
                    ) : interfaces.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        <label className="flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer hover:bg-gray-700">
                          <input
                            type="radio"
                            name="interface"
                            value=""
                            checked={selectedInterface === ''}
                            onChange={() => setSelectedInterface('')}
                            className="accent-red-500"
                          />
                          <span className="text-yellow-400 font-medium">All Interfaces</span>
                          <span className="text-gray-500">({interfaces.length})</span>
                        </label>
                        {interfaces.map((iface) => (
                          <label key={iface.name} className="flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer hover:bg-gray-700">
                            <input
                              type="radio"
                              name="interface"
                              value={iface.name}
                              checked={selectedInterface === iface.name}
                              onChange={() => setSelectedInterface(iface.name)}
                              className="accent-red-500"
                              disabled={!iface.up}
                            />
                            <span className="font-mono text-cyan-400">{iface.name}</span>
                            <span className="text-gray-500">{iface.ip}</span>
                            {!iface.up && <span className="text-red-400 text-[10px]">DOWN</span>}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">No interfaces available</p>
                    )}
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Failure Injection</h4>
                    <div className="flex items-center gap-2 mb-3">
                      <select
                        value={failureType}
                        onChange={(e) => setFailureType(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="link">Link Down</option>
                        <option value="device">Device Down</option>
                      </select>
                    </div>
                    <div className="text-xs text-gray-400 mb-3">
                      {selectedInterface ? `Target: ${selectedInterface}` : 'Target: all interfaces on device'}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleFailure}
                        disabled={actionLoading}
                        className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {actionLoading ? '...' : '⚠ Inject Failure'}
                      </button>
                      <button
                        onClick={handleRecover}
                        disabled={actionLoading}
                        className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {actionLoading ? '...' : '✓ Recover'}
                      </button>
                    </div>
                    {actionResult && (
                      <div className="mt-3 px-3 py-2 bg-gray-700/50 rounded-lg text-xs text-gray-300">{actionResult}</div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-400 py-12">No details available</div>
          )}
        </div>
      </div>
    </>
  );
}
