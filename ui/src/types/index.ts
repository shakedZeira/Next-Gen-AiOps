export interface User {
  id: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
}

export interface Alert {
  id: string;
  name: string;
  service: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  team: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'escalated';
  created_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  runbook_url?: string;
}

export interface AlertGroup {
  service: string;
  severity: string;
  count: number;
  alerts: Alert[];
}

export interface CI {
  id: string;
  name: string;
  type: string;
  provider?: string;
  environment?: string;
  team?: string;
  labels: Record<string, string>;
}

export interface Topology {
  nodes: Array<{ id: string; name: string; type: string; team?: string }>;
  edges: Array<{ source: string; target: string; type: string }>;
}

export interface Service {
  id: string;
  name: string;
  owner_team?: string;
  sla_tier: string;
  operational_status: string;
}

export interface AgentStats {
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  error_rate: number;
  models: Array<{ model: string; requests: number }>;
}

export interface ModelHealth {
  model: string;
  requests: number;
  errors: number;
  avg_latency_ms: number;
  p99_latency_ms: number;
  tokens_per_minute: number;
  cost_per_hour: number;
  status: 'healthy' | 'degraded' | 'down';
}

export interface ApprovalRequest {
  id: string;
  tool_name: string;
  arguments: Record<string, any>;
  context: string;
  created_at: number;
}
