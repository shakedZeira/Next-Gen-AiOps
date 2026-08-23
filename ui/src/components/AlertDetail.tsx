import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../types';
import { RecentChanges } from './RecentChanges';
import { snmpAPI } from '../api/client';

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-blue-100 text-blue-800 border-blue-300',
  info: 'bg-gray-100 text-gray-800 border-gray-300',
};

const statusColors: Record<string, string> = {
  active: 'bg-red-50 text-red-700',
  acknowledged: 'bg-yellow-50 text-yellow-700',
  resolved: 'bg-green-50 text-green-700',
};

interface Props {
  alert: Alert;
  onClose: () => void;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

export default function AlertDetail({ alert, onClose, onAcknowledge, onResolve }: Props) {
  const navigate = useNavigate();
  const [snmpTraps, setSnmpTraps] = useState<any[]>([]);
  const [loadingTraps, setLoadingTraps] = useState(false);

  useEffect(() => {
    if (alert.labels?.source === 'snmp-trap' && alert.labels?.['source.ip']) {
      setLoadingTraps(true);
      snmpAPI.getTraps({ source_ip: alert.labels['source.ip'], limit: 10 })
        .then((resp) => setSnmpTraps(resp.data || []))
        .catch(() => setSnmpTraps([]))
        .finally(() => setLoadingTraps(false));
    }
  }, [alert]);

  const handleSuggestFix = () => {
    const prompt =
      `I need help resolving an alert.\n\n` +
      `Alert: ${alert.name}\n` +
      `Service: ${alert.service}\n` +
      `Severity: ${alert.severity}\n` +
      `Description: ${alert.description || 'N/A'}\n` +
      `Status: ${alert.status}\n` +
      `Team: ${alert.team || 'unassigned'}\n\n` +
      `Please analyze the topology and suggest steps to resolve this alert.`;
    navigate('/chatbot', {
      state: { prefillMessage: prompt, threadId: `alert-${alert.id}`, title: `Fix: ${alert.name.slice(0, 30)}` },
    });
  };

  return (
    <div className="bg-white rounded-xl border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
          <h2 className="text-lg font-semibold text-gray-900">Alert Details</h2>
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${severityColors[alert.severity] || ''}`}>
            {alert.severity}
          </span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[alert.status] || ''}`}>
            {alert.status}
          </span>
          {(alert.repeat_count ?? 1) > 1 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
              Repeated ×{alert.repeat_count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSuggestFix}
            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors">
            Suggest Fix
          </button>
          {alert.status === 'active' && (
            <button onClick={() => onAcknowledge(alert.id)}
              className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs font-medium hover:bg-yellow-600 transition-colors">
              Acknowledge
            </button>
          )}
          {alert.status !== 'resolved' && (
            <button onClick={() => onResolve(alert.id)}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
              Resolve
            </button>
          )}
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Alert Name</p>
          <p className="text-sm font-medium text-gray-900">{alert.name}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Service</p>
          <p className="text-sm font-medium text-gray-900">{alert.service}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Team</p>
          <p className="text-sm font-medium text-gray-900">{alert.team || 'unassigned'}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">First Seen</p>
          <p className="text-sm font-medium text-gray-900">
            {alert.first_seen ? new Date(alert.first_seen).toLocaleString() :
             alert.created_at ? new Date(alert.created_at).toLocaleString() : '—'}
          </p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Last Seen</p>
          <p className="text-sm font-medium text-gray-900">
            {alert.last_seen ? new Date(alert.last_seen).toLocaleString() : '—'}
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{alert.description || 'No description provided.'}</p>
      </div>

      {/* Source Details (SNMP/Syslog) */}
      {(alert.labels?.source === 'snmp-trap' || alert.labels?.source === 'syslog') && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Source Details</h3>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Source Type</p>
                <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  {alert.labels?.source === 'snmp-trap' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      SNMP Trap
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      Syslog
                    </>
                  )}
                </p>
              </div>
              {alert.labels?.['source.ip'] && (
                <div>
                  <p className="text-xs text-gray-500">Source IP</p>
                  <p className="text-sm font-medium text-gray-900 font-mono">{alert.labels['source.ip']}</p>
                </div>
              )}
              {alert.labels?.oid && (
                <div>
                  <p className="text-xs text-gray-500">Trap OID</p>
                  <p className="text-sm font-medium text-gray-900 font-mono truncate" title={alert.labels.oid}>{alert.labels.oid}</p>
                </div>
              )}
              {alert.labels?.hostname && (
                <div>
                  <p className="text-xs text-gray-500">Hostname</p>
                  <p className="text-sm font-medium text-gray-900">{alert.labels.hostname}</p>
                </div>
              )}
              {alert.labels?.['device.name'] && (
                <div>
                  <p className="text-xs text-gray-500">Device</p>
                  <p className="text-sm font-medium text-gray-900">{alert.labels['device.name']}</p>
                </div>
              )}
              {alert.labels?.['device.type'] && (
                <div>
                  <p className="text-xs text-gray-500">Device Type</p>
                  <p className="text-sm font-medium text-gray-900">{alert.labels['device.type']}</p>
                </div>
              )}
              {alert.labels?.['alert.trigger'] && (
                <div>
                  <p className="text-xs text-gray-500">Trigger</p>
                  <p className="text-sm font-medium text-gray-900">{alert.labels['alert.trigger']}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Changes */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Change Correlation</h3>
        <RecentChanges service={alert.service} />
      </div>

      {/* SNMP Trap History */}
      {alert.labels?.source === 'snmp-trap' && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Recent Traps from This Source</h3>
          {loadingTraps ? (
            <div className="text-sm text-gray-500">Loading trap history...</div>
          ) : snmpTraps.length === 0 ? (
            <div className="text-sm text-gray-500">No recent traps from this source IP</div>
          ) : (
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Time</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Trap</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Severity</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {snmpTraps.map((trap, idx) => (
                    <tr key={idx} className="hover:bg-gray-100">
                      <td className="px-3 py-2 text-gray-600">{new Date(trap.timestamp).toLocaleTimeString()}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{trap.trap_name}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${severityColors[trap.severity] || ''}`}>
                          {trap.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 font-mono text-xs">{trap.snmp_version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={() => navigate('/snmp')}
            className="mt-2 text-xs text-violet-600 hover:text-violet-800 font-medium"
          >
            View all SNMP traps →
          </button>
        </div>
      )}

      {/* Timeline */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Timeline</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-32">
              {alert.created_at ? new Date(alert.created_at).toLocaleString() : '—'}
            </span>
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Alert created</span>
          </div>
          {alert.acknowledged_at && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-32">
                {new Date(alert.acknowledged_at).toLocaleString()}
              </span>
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Acknowledged by {alert.acknowledged_by || 'operator'}</span>
            </div>
          )}
          {alert.resolved_at && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-32">
                {new Date(alert.resolved_at).toLocaleString()}
              </span>
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>Resolved</span>
            </div>
          )}
          {(alert.repeat_count ?? 1) > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-32">
                {alert.last_seen ? new Date(alert.last_seen).toLocaleString() : '—'}
              </span>
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span>Last repeat (×{alert.repeat_count})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
