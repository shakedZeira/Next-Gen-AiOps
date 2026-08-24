import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sloAPI } from '../api/client';
import { ServiceSLO } from '../types';

const tierColors: Record<string, string> = {
  gold: 'bg-amber-100 text-amber-800 border-amber-300',
  silver: 'bg-gray-100 dark:bg-gray-800 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 dark:border-gray-600',
  bronze: 'bg-orange-100 text-orange-800 border-orange-300',
};

const budgetColors: Record<string, string> = {
  healthy: 'bg-green-500',
  warning: 'bg-yellow-500',
  critical: 'bg-orange-500',
  exhausted: 'bg-red-500',
};

const budgetBg: Record<string, string> = {
  healthy: 'bg-green-50 border-green-200',
  warning: 'bg-yellow-50 border-yellow-200',
  critical: 'bg-orange-50 border-orange-200',
  exhausted: 'bg-red-50 border-red-200',
};

function SLIGauge({ sli }: { sli: { name: string; value: number; target: number; unit: string; met: boolean } }) {
  const pct = sli.unit === '%'
    ? (sli.name === 'Error Rate'
        ? Math.max(0, Math.min(100, (1 - sli.value / Math.max(sli.target * 5, 1)) * 100))
        : Math.min(100, (sli.value / Math.max(sli.target, 1)) * 100))
    : Math.max(0, Math.min(100, (1 - (sli.value - sli.target * 0.2) / (sli.target * 1.8)) * 100));

  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{sli.name}</p>
      <div className="relative w-16 h-16 mx-auto mb-1">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={sli.met ? '#22c55e' : '#ef4444'}
            strokeWidth="3"
            strokeDasharray={`${pct}, 100`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
            {sli.unit === 'ms' ? `${Math.round(sli.value)}` : sli.value.toFixed(sli.unit === '%' && sli.name === 'Error Rate' ? 2 : 1)}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-gray-400">
        {sli.unit === 'ms' ? '≤' : sli.name === 'Error Rate' ? '≤' : '≥'}{sli.target}{sli.unit}
      </p>
    </div>
  );
}

function ServiceSLOCard({ slo, highlighted }: { slo: ServiceSLO; highlighted: boolean }) {
  const budget = slo.error_budget;
  return (
    <div className={`p-5 rounded-xl border-2 transition-all hover:shadow-lg ${
      highlighted ? 'border-primary-400 ring-2 ring-primary-200' : 'border-gray-200 dark:border-gray-700 dark:border-gray-700'
    } ${budgetBg[budget.status]}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{slo.service}</h3>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${tierColors[slo.tier] || ''}`}>
            {slo.tier}
          </span>
        </div>
        {slo.active_alerts > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
            {slo.active_alerts} alert{slo.active_alerts > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex justify-around mb-4">
        <SLIGauge sli={slo.slis.availability} />
        <SLIGauge sli={slo.slis.latency_p99} />
        <SLIGauge sli={slo.slis.error_rate} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Error Budget</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {Math.round(budget.remaining_minutes)}m / {Math.round(budget.total_minutes)}m
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${budgetColors[budget.status]}`}
            style={{ width: `${budget.remaining_pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className={`font-medium ${
            budget.status === 'healthy' ? 'text-green-600' :
            budget.status === 'warning' ? 'text-yellow-600' :
            budget.status === 'critical' ? 'text-orange-600' : 'text-red-600'
          }`}>
            {budget.remaining_pct.toFixed(1)}% remaining
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
            budget.status === 'healthy' ? 'bg-green-100 text-green-700' :
            budget.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
            budget.status === 'critical' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
          }`}>
            {budget.status}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SLODashboard() {
  const [slos, setSlos] = useState<ServiceSLO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const highlightService = searchParams.get('service') || '';

  useEffect(() => {
    sloAPI.list()
      .then(r => setSlos(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const highlightedSlo = highlightService
    ? slos.find(s => s.service.toLowerCase().includes(highlightService.toLowerCase()))
    : null;

  const healthyCount = slos.filter(s => s.error_budget.status === 'healthy').length;
  const warningCount = slos.filter(s => s.error_budget.status === 'warning').length;
  const criticalCount = slos.filter(s => s.error_budget.status === 'critical' || s.error_budget.status === 'exhausted').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SLI / SLO Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Service Level Indicators and Error Budget tracking</p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="font-medium text-green-700">{healthyCount} Healthy</span>
          </span>
          {warningCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-50 border border-yellow-200">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="font-medium text-yellow-700">{warningCount} Warning</span>
            </span>
          )}
          {criticalCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="font-medium text-red-700">{criticalCount} Critical</span>
            </span>
          )}
        </div>
      </div>

      {highlightedSlo && (
        <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-700">
          Showing SLO for <span className="font-semibold">{highlightedSlo.service}</span> (drilled down from Dashboard)
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-56 bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(highlightedSlo ? [highlightedSlo] : slos).map(slo => (
            <ServiceSLOCard key={slo.service} slo={slo} highlighted={slo.service === highlightedSlo?.service} />
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">SLI Definitions</h2>
        <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="p-3 bg-gray-50 dark:bg-gray-900 dark:bg-gray-900 rounded-lg">
            <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">Availability</p>
            <p>Uptime percentage over 30-day window. Measured as 1 - (downtime minutes / total minutes).</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-900 dark:bg-gray-900 rounded-lg">
            <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">Latency P99</p>
            <p>99th percentile request latency. Lower is better. Target varies by SLA tier.</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-900 dark:bg-gray-900 rounded-lg">
            <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">Error Rate</p>
            <p>Percentage of failed requests. Calculated from active alerts affecting the service.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
