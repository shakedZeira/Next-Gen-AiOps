interface Props {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  errorRate: number;
  throughput: number;
  onClick?: () => void;
}

const statusColors = {
  healthy: 'bg-green-100 text-green-800 border-green-200',
  degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  down: 'bg-red-100 text-red-800 border-red-200',
};

export default function ServiceHealthCard({ name, status, latency, errorRate, throughput, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border-2 ${statusColors[status]} transition-all hover:shadow-md ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{name}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
          {status}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-400">Latency</p>
          <p className="font-mono font-medium">{latency}ms</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-400">Errors</p>
          <p className="font-mono font-medium">{errorRate}%</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-400">RPM</p>
          <p className="font-mono font-medium">{throughput}</p>
        </div>
      </div>
    </div>
  );
}
