import { useState } from 'react';
import TokenUsageChart from '../components/TokenUsageChart';
import { ModelHealth } from '../types';

const DEMO_MODELS: ModelHealth[] = [
  { model: 'llama3.1:8b', requests: 1247, errors: 3, avg_latency_ms: 180, p99_latency_ms: 450, tokens_per_minute: 12500, cost_per_hour: 0, status: 'healthy' },
  { model: 'qwen2.5:7b', requests: 892, errors: 1, avg_latency_ms: 150, p99_latency_ms: 380, tokens_per_minute: 9200, cost_per_hour: 0, status: 'healthy' },
];

const statusColors = { healthy: 'bg-green-100 text-green-800', degraded: 'bg-yellow-100 text-yellow-800', down: 'bg-red-100 text-red-800' };

export default function AgentMonitor() {
  const [models] = useState<ModelHealth[]>(DEMO_MODELS);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Agent & Model Monitor</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">Total Requests</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">2,139</p>
        </div>
        <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">Total Tokens</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">3.2M</p>
        </div>
        <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">Avg Latency</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">168ms</p>
        </div>
        <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">Error Rate</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">0.19%</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Token Usage Over Time</h2>
        <TokenUsageChart />
      </div>

      <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-xl border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Model Health</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-400 uppercase">Model</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-400 uppercase">Requests</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-400 uppercase">Errors</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-400 uppercase">Avg Latency</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-400 uppercase">P99 Latency</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-400 uppercase">TPM</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-400 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {models.map(model => (
              <tr key={model.model} className="__DM_HBG50__">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 font-mono">{model.model}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{model.requests.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{model.errors}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{model.avg_latency_ms}ms</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{model.p99_latency_ms}ms</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{model.tokens_per_minute.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[model.status]}`}>{model.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
