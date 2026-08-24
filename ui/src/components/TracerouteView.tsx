interface Hop {
  device: string;
  ip: string;
  latency_ms: number;
  reached: boolean;
  error?: string;
}

interface Props {
  result: {
    success: boolean;
    hops: Hop[];
    error?: string;
    rtt_ms?: number;
  } | null;
  onClose: () => void;
}

export default function TracerouteView({ result, onClose }: Props) {
  if (!result) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t shadow-2xl z-50 max-h-80 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            {result.success ? (
              <span className="text-green-600">✓ Ping/Traceroute Complete</span>
            ) : (
              <span className="text-red-600">✗ {result.error || 'Failed'}</span>
            )}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-400 text-xl">&times;</button>
        </div>

        <div className="space-y-1">
          {result.hops.map((hop, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-2 rounded text-sm ${
                hop.reached ? 'bg-green-50' : hop.error ? 'bg-red-50' : 'bg-gray-50 dark:bg-gray-900'
              }`}
            >
              <span className="text-gray-400 w-6 text-right text-xs">{i + 1}</span>
              <span className="font-mono text-gray-900 dark:text-gray-100 w-40 truncate">{hop.device}</span>
              <span className="font-mono text-gray-500 dark:text-gray-400 w-32">{hop.ip}</span>
              <span className="text-gray-500 dark:text-gray-400 w-20 text-right">{hop.latency_ms.toFixed(1)} ms</span>
              {hop.reached && <span className="text-green-600 text-xs font-medium">✓</span>}
              {hop.error && <span className="text-red-600 text-xs">{hop.error}</span>}
            </div>
          ))}
        </div>

        {result.rtt_ms && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">RTT: {result.rtt_ms} ms</p>
        )}
      </div>
    </div>
  );
}
