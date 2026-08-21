import { useState, useEffect } from 'react';
import { changesAPI } from '../api/client';

interface ChangeRecord {
  id: string;
  type: string;
  description: string;
  author: string;
  status: string;
  timestamp: string;
  minutes_ago: number;
  risk_score: number;
}

interface CorrelationResult {
  service: string;
  has_recent_changes: boolean;
  overall_risk_score: number;
  likely_cause: boolean;
  change_count: number;
  changes: ChangeRecord[];
}

export function RecentChanges({ service, compact = false }: { service: string; compact?: boolean }) {
  const [data, setData] = useState<CorrelationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!service) return;
    setLoading(true);
    changesAPI.correlate(service)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [service]);

  if (loading) return <div className="text-gray-500 text-xs">Checking recent changes...</div>;
  if (!data || !data.has_recent_changes) return null;

  const riskColor = data.overall_risk_score > 70 ? 'text-red-400' : data.overall_risk_score > 40 ? 'text-amber-400' : 'text-green-400';
  const riskBg = data.overall_risk_score > 70 ? 'bg-red-950/30 border-red-900/50' : data.overall_risk_score > 40 ? 'bg-amber-950/30 border-amber-900/50' : 'bg-green-950/30 border-green-900/50';

  return (
    <div className={`rounded-lg border p-3 ${riskBg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
          Recent Changes ({data.change_count})
        </span>
        <div className="flex items-center gap-2">
          {data.likely_cause && (
            <span className="text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded">
              LIKELY CAUSE
            </span>
          )}
          <span className={`text-xs font-bold ${riskColor}`}>
            Risk: {data.overall_risk_score}%
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.changes.slice(0, compact ? 3 : 5).map(c => {
          const typeIcon = c.type === 'deployment' ? '🚀' : c.type === 'config' ? '⚙️' : '🏗️';
          const statusColor = c.status === 'failed' ? 'text-red-400' : c.status === 'rolled_back' ? 'text-amber-400' : 'text-green-400';
          return (
            <div key={c.id} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5">{typeIcon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-gray-200 truncate">{c.description}</div>
                <div className="flex items-center gap-2 text-gray-500">
                  <span>{c.minutes_ago}m ago</span>
                  <span>·</span>
                  <span>{c.author}</span>
                  <span className={statusColor}>· {c.status}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
