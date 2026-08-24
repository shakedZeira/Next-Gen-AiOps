import { useState, useEffect } from 'react';
import { maintenanceAPI } from '../api/client';
import { MaintenanceWindow } from '../types';

const SERVICES = [
  'payment-gateway', 'ecommerce-web', 'api-gateway', 'database',
  'analytics-pipeline', 'order-processing', 'notification-service', 'search-engine'
];

interface Props {
  onClose: () => void;
}

export default function MaintenancePanel({ onClose }: Props) {
  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    service: SERVICES[0],
    start_time: '',
    end_time: '',
    reason: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchWindows = async () => {
    try {
      const resp = await maintenanceAPI.list();
      setWindows(resp.data);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWindows();
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.start_time || !form.end_time) return;
    setCreating(true);
    try {
      await maintenanceAPI.create({
        name: form.name,
        service: form.service,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        reason: form.reason,
      });
      setForm({ name: '', service: SERVICES[0], start_time: '', end_time: '', reason: '' });
      setShowCreate(false);
      await fetchWindows();
    } catch {} finally {
      setCreating(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await maintenanceAPI.cancel(id);
      await fetchWindows();
    } catch {}
  };

  const now = new Date();
  const isActive = (w: MaintenanceWindow) => {
    const start = new Date(w.start_time);
    const end = new Date(w.end_time);
    return start <= now && now <= end && w.status === 'active';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Maintenance Windows</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Mute alerts during planned maintenance</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              {showCreate ? 'Cancel' : '+ New Window'}
            </button>
            <button onClick={onClose} className="text-gray-400 __DM_HTX600__">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="p-6 bg-gray-50 dark:bg-gray-900 dark:bg-gray-900 border-b">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Payment Gateway Upgrade"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service</label>
                <select
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg text-sm"
                >
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g., v2.3.1 rolling upgrade"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !form.name || !form.start_time || !form.end_time}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Window'}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">Loading...</div>
          ) : windows.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">No maintenance windows</div>
          ) : (
            <div className="space-y-3">
              {windows.map((w) => {
                const active = isActive(w);
                return (
                  <div
                    key={w.id}
                    className={`p-4 rounded-xl border-2 ${
                      active
                        ? 'bg-amber-50 border-amber-300'
                        : w.status === 'cancelled'
                        ? 'bg-gray-50 dark:bg-gray-900 dark:bg-gray-900 border-gray-200 dark:border-gray-700 dark:border-gray-700 opacity-60'
                        : 'bg-gray-50 dark:bg-gray-900 dark:bg-gray-900 border-gray-200 dark:border-gray-700 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{w.name}</h3>
                          {active && (
                            <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full animate-pulse">
                              ACTIVE
                            </span>
                          )}
                          {w.status === 'cancelled' && (
                            <span className="px-2 py-0.5 bg-gray-400 text-white text-xs font-bold rounded-full">
                              CANCELLED
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Service: <span className="font-medium">{w.service}</span>
                          {w.reason && <> — {w.reason}</>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {new Date(w.start_time).toLocaleString()} → {new Date(w.end_time).toLocaleString()}
                        </p>
                      </div>
                      {w.status === 'active' && (
                        <button
                          onClick={() => handleCancel(w.id)}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
