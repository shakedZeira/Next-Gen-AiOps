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
  repeat_count?: number;
  first_seen?: string;
  last_seen?: string;
  incident_id?: string;
}

export interface AlertGroup {
  service: string;
  severity: string;
  count: number;
  alerts: Alert[];
}

export interface IncidentGroup {
  incident_id: string;
  title: string;
  service: string;
  severity: string;
  alert_count: number;
  alerts: Alert[];
  first_seen?: string;
  last_seen?: string;
}

export interface AlertStats {
  total_created: number;
  deduplicated: number;
  incidents_formed: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  alert_count: number;
}

export interface CI {
  id: string;
  name: string;
  type: string;
  provider?: string;
  environment?: string;
  team?: string;
  site?: string;
  site_type?: string;
  network_layer?: string;
  topology_type?: string;
  labels: Record<string, string>;
}

export interface Topology {
  nodes: Array<{ id: string; name: string; type: string; team?: string; site?: string }>;
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

export interface SiteInfo {
  name: string;
  site_type?: string;
  device_count: number;
  topology_type?: string;
}

export interface InterSiteConnection {
  source_site: string;
  target_site: string;
  connection_type: string;
  source_device: string;
  target_device: string;
  status: string;
}

export interface SiteLocation {
  site: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  site_type: string;
  device_count: number;
  topology_type: string;
}

export interface CIDetails {
  ci: CI;
  neighbors: CIDeviceNeighbor[];
}

export interface CIDeviceNeighbor {
  id: string;
  name: string;
  type: string;
  relationship: string;
  direction: string;
}

export interface DCRoom {
  id: string;
  name: string;
  site: string;
  room_type?: string;
  tier_rating?: number;
  total_racks: number;
  power_capacity_kw?: number;
  cooling_type?: string;
  pue_target?: number;
  labels: Record<string, string>;
}

export interface DCRack {
  id: string;
  name: string;
  room_id: string;
  site: string;
  row?: string;
  rack_number?: number;
  u_height: number;
  max_power_kw?: number;
  current_temp_c?: number;
  status: string;
  labels: Record<string, string>;
}

export interface DCRackEquipment {
  id: string;
  rack_id: string;
  ci_id?: string;
  name: string;
  equipment_type: string;
  u_start: number;
  u_height: number;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  power_consumption_w?: number;
  mgmt_ip?: string;
  status: string;
  labels: Record<string, string>;
}


export interface SiteFlow {
  source_site: string;
  target_site: string;
  connection_type: string;
  bandwidth_mbps: number;
  utilization_pct: number;
  latency_ms: number;
  status: 'healthy' | 'degraded' | 'critical';
  packets_per_sec: number;
  errors_per_sec: number;
}

export interface SiteMapPin {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  details: Record<string, any>;
}

export interface SiteMapData {
  center: { lat: number; lng: number };
  zoom: number;
  pins: SiteMapPin[];
}

export interface SiteOverview {
  site_name: string;
  site_type: string;
  topology_type: string;
  device_count: number;
  room_count: number;
  total_racks: number;
  teams: string[];
  device_types: Record<string, number>;
  key_devices: Array<{ id: string; name: string; type: string; provider?: string; team?: string }>;
}

export interface SiteService {
  id: string;
  name: string;
  owner_team?: string;
  sla_tier: string;
  ci_count: number;
}