import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

interface SyslogMessage {
  timestamp: string;
  hostname: string;
  app_name: string;
  facility: string;
  severity: string;
  message: string;
  transport: string;
  source_ip: string;
  alert_generated: boolean;
  alert_name: string | null;
}

interface SyslogStats {
  messages_received: number;
  alerts_generated: number;
  parse_errors: number;
  uptime_seconds: number;
  recent_messages_count: number;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-blue-100 text-blue-800 border-blue-300',
  info: 'bg-gray-100 text-gray-800 border-gray-300',
  debug: 'bg-purple-100 text-purple-800 border-purple-300',
};

const facilityColors: Record<string, string> = {
  local0: 'bg-teal-100 text-teal-800',
  local1: 'bg-cyan-100 text-cyan-800',
  local2: 'bg-sky-100 text-sky-800',
  local3: 'bg-indigo-100 text-indigo-800',
  auth: 'bg-amber-100 text-amber-800',
  daemon: 'bg-emerald-100 text-emerald-800',
  kernel: 'bg-rose-100 text-rose-800',
};

export default function SyslogViewer() {
  const [messages, setMessages] = useState<SyslogMessage[]>([]);
  const [stats, setStats] = useState<SyslogStats | null>(null);
  const [hostnameFilter, setHostnameFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef<number | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (hostnameFilter) params.hostname = hostnameFilter;
      if (severityFilter) params.severity = severityFilter;
      const resp = await api.get('/syslog/messages', { params });
      setMessages(resp.data || []);
    } catch {
      // keep existing messages
    } finally {
      setLoading(false);
    }
  }, [hostnameFilter, severityFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const resp = await api.get('/syslog/stats');
      setStats(resp.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    fetchStats();
  }, [fetchMessages, fetchStats]);

  useEffect(() => {
    if (autoRefresh) {
      refreshRef.current = window.setInterval(() => {
        fetchMessages();
        fetchStats();
      }, 3000);
    }
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [autoRefresh, fetchMessages, fetchStats]);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return ts;
    }
  };

  const highlightMessage = (msg: SyslogMessage) => {
    if (msg.alert_generated) return 'bg-red-50 border-l-2 border-red-400';
    if (msg.severity === 'critical') return 'bg-red-50/50';
    if (msg.severity === 'high') return 'bg-orange-50/30';
    return '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Syslog Viewer</h1>
          <p className="text-sm text-gray-500">Real-time syslog message stream from network devices</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Messages Received</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.messages_received.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Alerts Generated</div>
            <div className="text-2xl font-bold text-orange-600 mt-1">{stats.alerts_generated.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Parse Errors</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats.parse_errors.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Recent Buffer</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.recent_messages_count}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Uptime</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {stats.uptime_seconds > 0 ? `${Math.floor(stats.uptime_seconds / 60)}m` : '--'}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Hostname:</label>
          <input
            type="text"
            value={hostnameFilter}
            onChange={(e) => setHostnameFilter(e.target.value)}
            placeholder="e.g. hq-core-sw-1"
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-mono focus:ring-2 focus:ring-primary-500 w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Severity:</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <button
          onClick={() => { fetchMessages(); fetchStats(); }}
          className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading syslog messages...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-3">📭</div>
            <div className="font-medium mb-1">No syslog messages yet</div>
            <div className="text-sm">
              Send test messages with: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">
                echo "&lt;13&gt;Aug 23 12:00:00 hq-core-sw-1 %LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to up" | nc -u localhost 1514
              </code>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`px-4 py-2.5 font-mono text-xs leading-relaxed hover:bg-gray-50 transition-colors ${highlightMessage(msg)}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-gray-400 shrink-0 w-20">{formatTime(msg.timestamp)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium border shrink-0 ${severityColors[msg.severity] || 'bg-gray-100'}`}>
                    {msg.severity}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-xs shrink-0 ${facilityColors[msg.facility] || 'bg-gray-100 text-gray-600'}`}>
                    {msg.facility}
                  </span>
                  <span className="text-blue-600 font-semibold shrink-0 w-36 truncate" title={msg.hostname}>
                    {msg.hostname}
                  </span>
                  <span className="text-gray-400 shrink-0 w-16 truncate" title={msg.app_name}>
                    {msg.app_name}
                  </span>
                  <span className="text-gray-700 flex-1 break-all">{msg.message}</span>
                  {msg.alert_generated && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-500 text-white text-xs font-bold" title={msg.alert_name || ''}>
                      ALERT
                    </span>
                  )}
                  <span className="text-gray-300 shrink-0">{msg.transport.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 text-center">
        Listening on UDP port 1514, TCP port 1515 | Buffer: {MAX_RECENT} messages
      </div>
    </div>
  );
}

const MAX_RECENT = 200;
