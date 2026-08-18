import { Alert } from '../types';

interface Props {
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

const severityColors = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
  info: 'bg-gray-100 text-gray-800',
};

const statusColors = {
  active: 'bg-red-50 border-red-200',
  acknowledged: 'bg-yellow-50 border-yellow-200',
  resolved: 'bg-green-50 border-green-200',
  escalated: 'bg-purple-50 border-purple-200',
};

export default function AlertTable({ alerts, onAcknowledge, onResolve }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alert</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {alerts.map(alert => (
            <tr key={alert.id} className={`border-l-4 ${statusColors[alert.status]}`}>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityColors[alert.severity]}`}>
                  {alert.severity}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{alert.name}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{alert.service}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{alert.status}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{new Date(alert.created_at).toLocaleTimeString()}</td>
              <td className="px-4 py-3 text-right space-x-2">
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
