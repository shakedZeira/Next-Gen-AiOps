import { useState, useEffect } from 'react';
import SystemFlowDiagram from '../components/SystemFlowDiagram';

interface ComponentHealth {
  id: string;
  name: string;
  category: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  latency_ms: number;
  throughput: number;
  error_rate: number;
  last_checked: string;
  description: string;
}

const MOCK_COMPONENTS: ComponentHealth[] = [
  // Data Sources
  { id: 'otel-collector', name: 'OTel Collector', category: 'data_sources', status: 'healthy', uptime: 99.99, latency_ms: 2, throughput: 15000, error_rate: 0.01, last_checked: new Date().toISOString(), description: 'OpenTelemetry metric collection' },
  { id: 'log-shipper', name: 'Log Shipper', category: 'data_sources', status: 'healthy', uptime: 99.95, latency_ms: 5, throughput: 8500, error_rate: 0.02, last_checked: new Date().toISOString(), description: 'Filebeat/Fluentd log forwarding' },
  { id: 'snmp-poller', name: 'SNMP Poller', category: 'data_sources', status: 'degraded', uptime: 99.2, latency_ms: 150, throughput: 2000, error_rate: 1.2, last_checked: new Date().toISOString(), description: 'Network device SNMP polling' },
  { id: 'api-poller', name: 'API Poller', category: 'data_sources', status: 'healthy', uptime: 99.98, latency_ms: 25, throughput: 500, error_rate: 0.05, last_checked: new Date().toISOString(), description: 'REST API health checks' },
  
  // Ingestion
  { id: 'kafka', name: 'Apache Kafka', category: 'ingestion', status: 'healthy', uptime: 99.99, latency_ms: 3, throughput: 50000, error_rate: 0.001, last_checked: new Date().toISOString(), description: 'Event streaming platform' },
  { id: 'event-hub', name: 'Event Hub', category: 'ingestion', status: 'healthy', uptime: 99.97, latency_ms: 8, throughput: 30000, error_rate: 0.01, last_checked: new Date().toISOString(), description: 'Azure Event Hubs ingestion' },
  { id: 'webhook-receiver', name: 'Webhook Receiver', category: 'ingestion', status: 'healthy', uptime: 99.99, latency_ms: 5, throughput: 1000, error_rate: 0.02, last_checked: new Date().toISOString(), description: 'Inbound webhook processing' },
  
  // Processing
  { id: 'spark-processor', name: 'Spark Processor', category: 'processing', status: 'healthy', uptime: 99.95, latency_ms: 500, throughput: 10000, error_rate: 0.1, last_checked: new Date().toISOString(), description: 'Batch stream processing' },
  { id: 'flink-processor', name: 'Flink Processor', category: 'processing', status: 'healthy', uptime: 99.98, latency_ms: 15, throughput: 25000, error_rate: 0.02, last_checked: new Date().toISOString(), description: 'Real-time stream processing' },
  { id: 'ml-pipeline', name: 'ML Pipeline', category: 'processing', status: 'degraded', uptime: 98.5, latency_ms: 2500, throughput: 500, error_rate: 2.5, last_checked: new Date().toISOString(), description: 'Anomaly detection & forecasting' },
  { id: 'alert-engine', name: 'Alert Engine', category: 'processing', status: 'healthy', uptime: 99.99, latency_ms: 10, throughput: 5000, error_rate: 0.01, last_checked: new Date().toISOString(), description: 'Alert correlation & dedup' },
  
  // Storage
  { id: 'postgresql', name: 'PostgreSQL', category: 'storage', status: 'healthy', uptime: 99.99, latency_ms: 5, throughput: 3000, error_rate: 0.001, last_checked: new Date().toISOString(), description: 'Primary relational database' },
  { id: 'redis', name: 'Redis Cache', category: 'storage', status: 'healthy', uptime: 99.99, latency_ms: 1, throughput: 50000, error_rate: 0.001, last_checked: new Date().toISOString(), description: 'In-memory caching layer' },
  { id: 'elasticsearch', name: 'Elasticsearch', category: 'storage', status: 'healthy', uptime: 99.95, latency_ms: 20, throughput: 8000, error_rate: 0.05, last_checked: new Date().toISOString(), description: 'Log search & analytics' },
  { id: 'clickhouse', name: 'ClickHouse', category: 'storage', status: 'healthy', uptime: 99.97, latency_ms: 15, throughput: 5000, error_rate: 0.02, last_checked: new Date().toISOString(), description: 'Time-series analytics DB' },
  
  // Visualization
  { id: 'react-ui', name: 'React UI', category: 'visualization', status: 'healthy', uptime: 99.99, latency_ms: 50, throughput: 200, error_rate: 0.1, last_checked: new Date().toISOString(), description: 'Frontend web application' },
  { id: 'api-gateway', name: 'API Gateway', category: 'visualization', status: 'healthy', uptime: 99.99, latency_ms: 10, throughput: 5000, error_rate: 0.01, last_checked: new Date().toISOString(), description: 'FastAPI REST endpoints' },
  { id: 'websocket', name: 'WebSocket Server', category: 'visualization', status: 'healthy', uptime: 99.98, latency_ms: 5, throughput: 1000, error_rate: 0.02, last_checked: new Date().toISOString(), description: 'Real-time push notifications' },
  
  // External Services
  { id: 'llm-api', name: 'LLM API', category: 'external', status: 'healthy', uptime: 99.5, latency_ms: 1500, throughput: 100, error_rate: 0.5, last_checked: new Date().toISOString(), description: 'OpenAI/Azure OpenAI inference' },
  { id: 'grafana', name: 'Grafana', category: 'external', status: 'healthy', uptime: 99.99, latency_ms: 100, throughput: 50, error_rate: 0.01, last_checked: new Date().toISOString(), description: 'Monitoring dashboards' },
  { id: 'prometheus', name: 'Prometheus', category: 'external', status: 'healthy', uptime: 99.99, latency_ms: 5, throughput: 10000, error_rate: 0.001, last_checked: new Date().toISOString(), description: 'Metrics collection & storage' },
];

const CATEGORY_LABELS: Record<string, string> = {
  data_sources: 'Data Sources',
  ingestion: 'Ingestion Layer',
  processing: 'Processing Layer',
  storage: 'Storage Layer',
  visualization: 'Visualization',
  external: 'External Services',
};

const CATEGORY_ORDER = ['data_sources', 'ingestion', 'processing', 'storage', 'visualization', 'external'];

const STATUS_COLORS = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
};

const STATUS_TEXT_COLORS = {
  healthy: 'text-green-700',
  degraded: 'text-yellow-700',
  down: 'text-red-700',
};

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export default function SystemHealth() {
  const [components, setComponents] = useState<ComponentHealth[]>(MOCK_COMPONENTS);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setComponents(prev => prev.map(c => ({
        ...c,
        latency_ms: c.latency_ms * (0.95 + Math.random() * 0.1),
        throughput: Math.round(c.throughput * (0.98 + Math.random() * 0.04)),
        error_rate: Math.max(0, c.error_rate * (0.9 + Math.random() * 0.2)),
        last_checked: new Date().toISOString(),
      })));
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const healthyCount = components.filter(c => c.status === 'healthy').length;
  const degradedCount = components.filter(c => c.status === 'degraded').length;
  const downCount = components.filter(c => c.status === 'down').length;
  const overallStatus = downCount > 0 ? 'down' : degradedCount > 0 ? 'degraded' : 'healthy';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last refreshed: {lastRefresh.toLocaleTimeString()} (auto-refreshes every 30s)
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${STATUS_COLORS[overallStatus]}`}></span>
            <span className={`text-sm font-medium ${STATUS_TEXT_COLORS[overallStatus]}`}>
              System {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-500">Total Components</div>
          <div className="text-2xl font-bold text-gray-900">{components.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-500">Healthy</div>
          <div className="text-2xl font-bold text-green-600">{healthyCount}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-500">Degraded</div>
          <div className="text-2xl font-bold text-yellow-600">{degradedCount}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-500">Down</div>
          <div className="text-2xl font-bold text-red-600">{downCount}</div>
        </div>
      </div>

      {/* System Flow Diagram */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">System Architecture Flow</h2>
        <SystemFlowDiagram components={components} />
      </div>

      {/* Component Health Grid by Category */}
      {CATEGORY_ORDER.map((category) => {
        const categoryComponents = components.filter(c => c.category === category);
        if (categoryComponents.length === 0) return null;
        return (
          <div key={category} className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">{CATEGORY_LABELS[category]}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {categoryComponents.map((comp) => (
                <div key={comp.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-gray-900">{comp.name}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[comp.status]}`}></span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{comp.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Uptime</span>
                      <div className="font-medium">{comp.uptime.toFixed(2)}%</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Latency</span>
                      <div className="font-medium">{comp.latency_ms.toFixed(0)}ms</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Throughput</span>
                      <div className="font-medium">{formatNumber(comp.throughput)}/s</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Error Rate</span>
                      <div className="font-medium">{comp.error_rate.toFixed(3)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
