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

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          Checking recent changes...
        </div>
      </div>
    );
  }

  if (!data || !data.has_recent_changes) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <span className="text-green-500 text-lg">✓</span>
          No recent changes for {service} — not change-related
        </div>
      </div>
    );
  }

  const isHighRisk = data.overall_risk_score > 70;
  const isMedRisk = data.overall_risk_score > 40;

  return (
    <div className={`rounded-lg border-2 p-4 ${
      isHighRisk ? 'border-red-500 bg-red-950/40' :
      isMedRisk ? 'border-amber-500 bg-amber-950/40' :
      'border-green-500 bg-green-950/40'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white uppercase tracking-wide">
            🔍 Recent Changes
          </span>
          <span className="text-xs text-gray-300">
            ({data.change_count} change{data.change_count !== 1 ? 's' : ''} in last 30 min)
          </span>
        </div>
        <div className="flex items-center gap-3">
          {data.likely_cause && (
            <span className="text-xs font-bold bg-red-600 text-white px-3 py-1 rounded-lg border border-red-400">
              ⚠ LIKELY ROOT CAUSE
            </span>
          )}
          <span className={`text-sm font-bold px-2 py-1 rounded ${
            isHighRisk ? 'bg-red-600 text-white' :
            isMedRisk ? 'bg-amber-600 text-white' :
            'bg-green-600 text-white'
          }`}>
            Risk: {data.overall_risk_score}%
          </span>
        </div>
      </div>

      {/* Explanation */}
      <div className="text-xs text-gray-300 mb-3">
        {data.likely_cause
          ? `A change was made ${data.changes[0]?.minutes_ago} minutes ago — this is the most likely root cause of the incident.`
          : `Changes were detected but none are recent enough to be the likely cause.`}
      </div>

      {/* Changes list */}
      <div className="space-y-2">
        {data.changes.slice(0, compact ? 3 : 5).map((c, idx) => {
          const typeIcon = c.type === 'deployment' ? '🚀' : c.type === 'config' ? '⚙️' : '🏗️';
          const typeLabel = c.type === 'deployment' ? 'Deployment' : c.type === 'config' ? 'Config' : 'Infra';
          const statusColor = c.status === 'failed' ? 'bg-red-600 text-white' :
                              c.status === 'rolled_back' ? 'bg-amber-600 text-white' :
                              'bg-green-600 text-white';
          const isTopCause = data.likely_cause && idx === 0;
          return (
            <div key={c.id} className={`flex items-start gap-3 p-2 rounded-lg ${
              isTopCause ? 'bg-red-900/30 border border-red-700/50' : 'bg-gray-800/30'
            }`}>
              <span className="text-lg mt-0.5">{typeIcon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{typeLabel}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusColor}`}>
                    {c.status}
                  </span>
                  {isTopCause && (
                    <span className="text-[10px] font-bold text-red-400">← Most recent</span>
                  )}
                </div>
                <div className="text-sm text-white font-medium">{c.description}</div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                  <span className="font-medium text-gray-300">{c.minutes_ago} min ago</span>
                  <span>by {c.author}</span>
                </div>
              </div>
              <div className={`text-xs font-bold px-2 py-1 rounded ${
                c.risk_score > 70 ? 'bg-red-600 text-white' :
                c.risk_score > 40 ? 'bg-amber-600 text-white' :
                'bg-gray-600 text-white'
              }`}>
                {c.risk_score}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
