import { Alert } from '../types';

interface Props {
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onAlertClick?: (alert: Alert) => void;
  showSuppressed?: boolean;
  onToggleSuppressed?: () => void;
  suppressedCount?: number;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
  info: 'bg-gray-100 text-gray-800',
};

const statusColors: Record<string, string> = {
  active: 'bg-red-50 border-red-200',
  acknowledged: 'bg-yellow-50 border-yellow-200',
  resolved: 'bg-green-50 border-green-200',
  escalated: 'bg-purple-50 border-purple-200',
};

const teamColors: Record<string, string> = {
  frontend: 'bg-blue-100 text-blue-800',
  backend: 'bg-cyan-100 text-cyan-800',
  payments: 'bg-yellow-100 text-yellow-800',
  data: 'bg-green-100 text-green-800',
  platform: 'bg-purple-100 text-purple-800',
  security: 'bg-red-100 text-red-800',
  sre: 'bg-indigo-100 text-indigo-800',
  unassigned: 'bg-gray-100 text-gray-600',
};

export default function AlertTable({ alerts, onAcknowledge, onResolve, onAlertClick, showSuppressed, onToggleSuppressed, suppressedCount }: Props) {
  return (
    <div className="overflow-x-auto">
      {onToggleSuppressed && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
          <button
            onClick={onToggleSuppressed}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showSuppressed
                ? 'bg-violet-100 text-violet-700 border border-violet-300'
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showSuppressed ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
            </svg>
            {showSuppressed ? 'Hide Suppressed' : 'Show Suppressed'}
            {(suppressedCount ?? 0) > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-violet-500 text-white">
                {suppressedCount}
              </span>
            )}
          </button>
        </div>
      )}
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alert</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {alerts.map((alert) => (
            <tr key={alert.id}
              className={`border-l-4 ${statusColors[alert.status] || ''} ${
                onAlertClick ? 'cursor-pointer hover:bg-blue-50 transition-colors' : ''
              }`}
              onClick={() => onAlertClick?.(alert)}
            >
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityColors[alert.severity] || ''}`}>
                  {alert.severity}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                <span className="flex items-center gap-2">
                  {alert.name}
                  {alert.suppressed && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200" title={`Suppressed by alert ${alert.suppressed_by?.slice(0, 8) || 'unknown'}`}>
                      SUPPRESSED
                    </span>
                  )}
                  {alert.throttled && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200" title="Throttled during alert storm">
                      THROTTLED
                    </span>
                  )}
                  {alert.muted && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200" title="Muted during maintenance window">
                      MUTED
                    </span>
                  )}
                  {alert.labels?.source === 'syslog' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700 border border-teal-200" title={`Syslog from ${alert.labels?.hostname || 'device'}`}>
                      SYSLOG
                    </span>
                  )}
                  {alert.labels?.source === 'snmp-trap' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200" title={`SNMP trap ${alert.labels?.oid || ''} from ${alert.labels?.['source.ip'] || 'device'}`}>
                      SNMP
                    </span>
                  )}
                  {(alert.repeat_count ?? 1) > 1 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                      x{alert.repeat_count}
                    </span>
                  )}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{alert.service}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${teamColors[alert.team || 'unassigned'] || teamColors.unassigned}`}>
                  {alert.team || 'unassigned'}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{alert.status}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{new Date(alert.created_at).toLocaleTimeString()}</td>
              <td className="px-4 py-3 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                {alert.status === 'active' && (
                  <button onClick={() => onAcknowledge(alert.id)} className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-xs hover:bg-yellow-600">
                    Ack
                  </button>
                )}
                {alert.status !== 'resolved' && (
                  <button onClick={() => onResolve(alert.id)} className="px-3 py-1 bg-green-500 text-white rounded-lg text-xs hover:bg-green-600">
                    Resolve
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
