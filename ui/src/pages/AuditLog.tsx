import { useState, useEffect } from 'react';
import api from '../api/client';

interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  ip_address: string;
}

interface AuditStats {
  total: number;
  top_actions: Array<{ action: string; count: number }>;
  top_users: Array<{ user: string; count: number }>;
}

const actionColors: Record<string, string> = {
  'alert.acknowledge': 'bg-yellow-100 text-yellow-800',
  'alert.resolve': 'bg-green-100 text-green-800',
  'chat.message': 'bg-blue-100 text-blue-800',
  'chat.approve': 'bg-emerald-100 text-emerald-800',
  'chat.reject': 'bg-red-100 text-red-800',
  'scenario.run': 'bg-purple-100 text-purple-800',
  'ci.create': 'bg-cyan-100 text-cyan-800',
  'ci.update': 'bg-cyan-100 text-cyan-800',
  'impact.show': 'bg-indigo-100 text-indigo-800',
};

export default function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [page, setPage] = useState(0);
  const limit = 50;

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { limit, offset: page * limit };
      if (userFilter) params.user = userFilter;
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resource_type = resourceFilter;

      const [logsResp, statsResp] = await Promise.all([
        api.get('/audit', { params }),
        api.get('/audit/stats'),
      ]);
      setEvents(logsResp.data.events || []);
      setTotal(logsResp.data.total || 0);
      setStats(statsResp.data);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [page, userFilter, actionFilter, resourceFilter]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
          <p className="text-sm text-gray-500">Track all user actions across the platform</p>
        </div>
        <div className="text-sm text-gray-500">
          {total.toLocaleString()} events
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">Total Events</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500 mb-2">Top Actions</p>
            {stats.top_actions.slice(0, 3).map((a) => (
              <div key={a.action} className="flex justify-between text-sm">
                <span className="text-gray-700">{a.action}</span>
                <span className="font-medium text-gray-900">{a.count}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500 mb-2">Top Users</p>
            {stats.top_users.slice(0, 3).map((u) => (
              <div key={u.user} className="flex justify-between text-sm">
                <span className="text-gray-700">{u.user}</span>
                <span className="font-medium text-gray-900">{u.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">User</label>
            <input
              type="text"
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); setPage(0); }}
              placeholder="Filter by user..."
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All actions</option>
              <option value="alert.acknowledge">Alert Acknowledge</option>
              <option value="alert.resolve">Alert Resolve</option>
              <option value="chat.message">Chat Message</option>
              <option value="chat.approve">Chat Approve</option>
              <option value="chat.reject">Chat Reject</option>
              <option value="scenario.run">Scenario Run</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Resource</label>
            <select
              value={resourceFilter}
              onChange={(e) => { setResourceFilter(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All resources</option>
              <option value="alert">Alert</option>
              <option value="chat">Chat</option>
              <option value="approval">Approval</option>
              <option value="scenario">Scenario</option>
              <option value="ci">CI</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setUserFilter(''); setActionFilter(''); setResourceFilter(''); setPage(0); }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No audit events found</div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{event.user}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${actionColors[event.action] || 'bg-gray-100 text-gray-800'}`}>
                      {event.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {event.resource_type}
                    {event.resource_id && (
                      <span className="ml-1 text-gray-400 font-mono text-xs">
                        {event.resource_id.substring(0, 8)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    {JSON.stringify(event.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page + 1} of {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
