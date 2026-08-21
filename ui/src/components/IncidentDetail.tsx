import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { alertsAPI, chatbotAPI } from '../api/client';
import { IncidentGroup } from '../types';

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
  incidentId: string;
  onClose: () => void;
  onAcknowledge: (alertId: string) => void;
  onResolve: (alertId: string) => void;
}

export default function IncidentDetail({ incidentId, onClose, onAcknowledge, onResolve }: Props) {
  const [incident, setIncident] = useState<IncidentGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    alertsAPI.incident(incidentId)
      .then((r) => setIncident(r.data))
      .catch(() => setIncident(null))
      .finally(() => setLoading(false));
  }, [incidentId]);

  const handleBulkAcknowledge = async () => {
    if (!incident) return;
    try {
      await alertsAPI.acknowledgeIncident(incidentId, 'operator@aiops.local');
      for (const alert of incident.alerts) {
        if (alert.status === 'active') {
          onAcknowledge(alert.id);
        }
      }
      const resp = await alertsAPI.incident(incidentId);
      setIncident(resp.data);
    } catch {
      // ignore
    }
  };

  const handleBulkResolve = async () => {
    if (!incident) return;
    try {
      await alertsAPI.resolveIncident(incidentId);
      for (const alert of incident.alerts) {
        if (alert.status !== 'resolved') {
          onResolve(alert.id);
        }
      }
      const resp = await alertsAPI.incident(incidentId);
      setIncident(resp.data);
    } catch {
      // ignore
    }
  };

  const handleSuggestFix = async () => {
    if (!incident) return;
    setSuggesting(true);
    const threadId = `incident-${incident.incident_id}`;
    const title = `Fix: ${incident.title.slice(0, 30)}`;
    try {
      await chatbotAPI.suggestFix({
        incident_id: incident.incident_id,
        title: incident.title,
        service: incident.service,
        severity: incident.severity,
        alert_count: incident.alert_count,
        alerts: incident.alerts,
        teams: (incident as any).teams,
      });
    } catch {
      // navigate anyway
    }
    setSuggesting(false);
    navigate('/chatbot', { state: { threadId, title } });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Loading incident...</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Incident not found</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      </div>
    );
  }

  const activeAlerts = incident.alerts.filter((a) => a.status === 'active');
  const hasActive = activeAlerts.length > 0;

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
          <h2 className="text-lg font-semibold text-gray-900">Incident Details</h2>
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${severityColors[incident.severity] || ''}`}>
            {incident.severity}
          </span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[incident.status || 'active'] || ''}`}>
            {incident.status || 'active'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSuggestFix}
            disabled={suggesting}
            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {suggesting ? 'Analyzing...' : 'Suggest Fix'}
          </button>
          {hasActive && (
            <button
              onClick={handleBulkAcknowledge}
              className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs font-medium hover:bg-yellow-600 transition-colors"
            >
              Acknowledge All ({activeAlerts.length})
            </button>
          )}
          <button
            onClick={handleBulkResolve}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
          >
            Resolve All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Service(s)</p>
          <p className="text-sm font-medium text-gray-900">{(incident as any).services?.join(', ') || incident.service}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Total Alerts</p>
          <p className="text-sm font-medium text-gray-900">{incident.alert_count}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Teams</p>
          <p className="text-sm font-medium text-gray-900">{(incident as any).teams?.join(', ') || '—'}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">First Seen</p>
          <p className="text-sm font-medium text-gray-900">
            {incident.first_seen ? new Date(incident.first_seen).toLocaleString() : '—'}
          </p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Last Seen</p>
          <p className="text-sm font-medium text-gray-900">
            {incident.last_seen ? new Date(incident.last_seen).toLocaleString() : '—'}
          </p>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-3">Alert Timeline</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200"></div>
        <div className="space-y-3">
          {incident.alerts.map((alert, idx) => (
            <div key={alert.id} className="relative flex items-start gap-4 pl-10">
              <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 ${
                alert.status === 'resolved' ? 'bg-green-500 border-green-600' :
                alert.status === 'acknowledged' ? 'bg-yellow-500 border-yellow-600' :
                'bg-red-500 border-red-600'
              }`}></div>
              <div className="flex-1 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${severityColors[alert.severity] || ''}`}>
                      {alert.severity}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{alert.name}</span>
                    {(alert.repeat_count ?? 1) > 1 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                        x{alert.repeat_count}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[alert.status] || ''}`}>
                      {alert.status}
                    </span>
                    {alert.status === 'active' && (
                      <>
                        <button
                          onClick={() => onAcknowledge(alert.id)}
                          className="px-2 py-0.5 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
                        >
                          Ack
                        </button>
                        <button
                          onClick={() => onResolve(alert.id)}
                          className="px-2 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          Resolve
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-1">{alert.description}</p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{new Date(alert.created_at).toLocaleString()}</span>
                  {alert.acknowledged_at && <span>Acked: {new Date(alert.acknowledged_at).toLocaleString()}</span>}
                  {alert.resolved_at && <span>Resolved: {new Date(alert.resolved_at).toLocaleString()}</span>}
                  {alert.acknowledged_by && <span>By: {alert.acknowledged_by}</span>}
                </div>
                {idx < incident.alerts.length - 1 && (
                  <div className="mt-2 text-xs text-gray-400">
                    {(() => {
                      const next = incident.alerts[idx + 1];
                      const diff = new Date(next.created_at).getTime() - new Date(alert.created_at).getTime();
                      const secs = Math.round(diff / 1000);
                      if (secs < 60) return <span>↓ {secs}s later</span>;
                      if (secs < 3600) return <span>↓ {Math.round(secs / 60)}m later</span>;
                      return <span>↓ {Math.round(secs / 3600)}h later</span>;
                    })()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
