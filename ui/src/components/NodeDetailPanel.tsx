import { useState, useEffect } from 'react';
import { cmdbAPI, alertsAPI } from '../api/client';
import { CIDetails, Alert } from '../types';

interface Props {
  ciId: string | null;
  onClose: () => void;
  onViewConnections: (ciId: string, ciName: string, neighbors: CIDetails['neighbors']) => void;
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

export default function NodeDetailPanel({ ciId, onClose, onViewConnections }: Props) {
  const [details, setDetails] = useState<CIDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (!ciId) {
      setDetails(null);
      setAlerts([]);
      return;
    }
    setLoading(true);
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

  if (!ciId) return null;

  const ci = details?.ci;
  const neighbors = details?.neighbors || [];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-gray-900 border-l border-gray-700 z-50
          transform transition-transform duration-300 ease-in-out
          ${ciId ? 'translate-x-0' : 'translate-x-full'}
          overflow-y-auto shadow-2xl`}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg">{ci ? (TYPE_ICONS[ci.type] || '\u2753') : '\u2753'}</span>
              <h2 className="text-lg font-bold text-white truncate">
                {loading ? 'Loading...' : ci?.name || 'Unknown'}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {ci && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600">
                  {ci.type}
                </span>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                ✕
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <div className="animate-spin w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full mr-3" />
              Loading details...
            </div>
          ) : ci ? (
            <>
              {/* Properties */}
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

              {/* Connected Devices */}
              {neighbors.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">
                    Connected Devices ({neighbors.length})
                  </h3>
                  <div className="space-y-2">
                    {neighbors.map((n) => (
                      <div
                        key={n.id}
                        className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 flex items-center gap-3"
                      >
                        <span className="text-base">{TYPE_ICONS[n.type] || '\u2753'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white font-medium truncate">{n.name || n.id}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                            <span className={DIRECTION_COLORS[n.direction] || 'text-gray-400'}>
                              {n.direction}
                            </span>
                            <span className="text-gray-500">·</span>
                            <span>{n.relationship}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alerts */}
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Alerts</h3>
                <div className="space-y-2">
                  {alerts.length > 0 ? (
                    alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm ${
                          SEVERITY_COLORS[alert.severity] || 'bg-gray-800 text-gray-300 border-gray-700'
                        }`}
                      >
                        <span>{STATUS_ICONS[alert.status] || '\u2022'}</span>
                        <span className="flex-1">{alert.name}</span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{alert.created_at}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">No active alerts for this CI</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => onViewConnections(ci.id, ci.name, neighbors)}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  View Connections
                </button>
                <button
                  className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  View Logs
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-12">No details available</div>
          )}
        </div>
      </div>
    </>
  );
}
