import { useState, useEffect } from 'react';
import { stormAPI } from '../api/client';
import { StormEvent } from '../types';

interface Props {
  onClear?: () => void;
}

export default function StormSummary({ onClear }: Props) {
  const [storm, setStorm] = useState<StormEvent | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const fetchStorm = async () => {
      try {
        const resp = await stormAPI.active();
        setStorm(resp.data);
      } catch {
        setStorm(null);
      }
    };
    fetchStorm();
    const interval = setInterval(fetchStorm, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!storm || storm.status !== 'active') return null;

  const elapsed = Math.floor((Date.now() - new Date(storm.detected_at).getTime()) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  const handleClear = async () => {
    setClearing(true);
    try {
      await stormAPI.clear(storm.id);
      setStorm(null);
      onClear?.();
    } catch {
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl p-4 mb-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-white dark:bg-gray-900/20 rounded-lg">
            <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-lg">Alert Storm Active</h3>
            <p className="text-sm text-white/80">
              {storm.alert_count} alerts across {storm.affected_services.length} services
              {minutes > 0 || seconds > 0 ? ` — ${minutes}m ${seconds}s ago` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-white/60">Affected Services</p>
            <div className="flex flex-wrap gap-1 mt-1 justify-end">
              {storm.affected_services.map((svc) => (
                <span key={svc} className="px-2 py-0.5 bg-white dark:bg-gray-900/20 rounded text-xs font-medium">
                  {svc}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={handleClear}
            disabled={clearing}
            className="px-3 py-1.5 bg-white dark:bg-gray-900/20 hover:bg-white dark:bg-gray-900/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {clearing ? 'Clearing...' : 'Clear Storm'}
          </button>
        </div>
      </div>

      {storm.root_cause_alert_id && (
        <div className="mt-2 text-xs text-white/60">
          Root cause alert: <span className="font-mono">{storm.root_cause_alert_id.slice(0, 8)}</span>
        </div>
      )}
    </div>
  );
}
