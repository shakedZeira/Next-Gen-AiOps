import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const authAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

export const cmdbAPI = {
  listCI: (ip?: string) => api.get('/cmdb/ci', { params: ip ? { ip } : {} }),
  getCI: (id: string) => api.get(`/cmdb/ci/${id}`),
  createCI: (data: any) => api.post('/cmdb/ci', data),
  resolveIp: (ip: string) => api.get(`/cmdb/resolve-ip/${ip}`),
  listServices: () => api.get('/cmdb/service'),
  getTopology: (serviceId: string) => api.get(`/cmdb/topology/${serviceId}`),
  getGlobalTopology: () => api.get('/cmdb/topology/all'),
  getImpact: (ciId: string) => api.get(`/cmdb/impact/${ciId}`),
  getSites: () => api.get('/cmdb/sites'),
  getSiteTopology: (siteName: string, view: string = "detailed", serviceId?: string) => {
    const params: Record<string, string> = { view };
    if (serviceId) params.service = serviceId;
    return api.get(`/cmdb/topology/site/${siteName}`, { params });
  },
  getInterSiteConnections: () => api.get('/cmdb/topology/inter-site'),
  getSiteAggregateTopology: () => api.get('/cmdb/topology/site-aggregate'),
  getCIDetails: (ciId: string) => api.get(`/cmdb/ci/${ciId}/details`),
  getSiteLocations: () => api.get('/cmdb/sites/locations'),
  getInterSiteFlows: () => api.get('/cmdb/topology/inter-site/flows'),
  getSiteMapData: (siteName: string) => api.get(`/cmdb/sites/${siteName}/map-data`),
  getSiteOverview: (siteName: string) => api.get(`/cmdb/sites/${siteName}/overview`),
  getSiteServices: (siteName: string) => api.get(`/cmdb/sites/${siteName}/services`),
  getAllServices: () => api.get('/cmdb/services'),
};

export const alertsAPI = {
  list: (status?: string, team?: string) => {
    const params: Record<string, string> = {};
    if (status && status !== 'all') params.status = status;
    if (team && team !== 'all') params.team = team;
    return api.get('/alerts', { params });
  },
  create: (data: { name: string; service: string; severity: string; description: string; team?: string; labels?: Record<string, string> }) =>
    api.post('/alerts', data),
  groups: () => api.get('/alerts/groups'),
  incidents: (status?: string) => api.get('/alerts/incidents', { params: status ? { status } : {} }),
  incident: (id: string) => api.get(`/alerts/incidents/${id}`),
  acknowledgeIncident: (id: string, user: string) => api.post(`/alerts/incidents/${id}/acknowledge`, { acknowledged_by: user }),
  resolveIncident: (id: string) => api.post(`/alerts/incidents/${id}/resolve`),
  stats: () => api.get('/alerts/stats'),
  acknowledge: (id: string, user: string) => api.post(`/alerts/${id}/acknowledge`, { acknowledged_by: user }),
  resolve: (id: string) => api.post(`/alerts/${id}/resolve`),
};

export const stormAPI = {
  active: () => api.get('/alerts/storms/active'),
  list: (limit?: number) => api.get('/alerts/storms', { params: limit ? { limit } : {} }),
  clear: (id: string) => api.post(`/alerts/storms/${id}/clear`),
};

export const maintenanceAPI = {
  list: (status?: string) => api.get('/alerts/maintenance', { params: status ? { status } : {} }),
  active: () => api.get('/alerts/maintenance/active'),
  create: (data: { name: string; service: string; start_time: string; end_time: string; created_by?: string; reason?: string }) =>
    api.post('/alerts/maintenance', data),
  cancel: (id: string) => api.delete(`/alerts/maintenance/${id}`),
  cleanup: () => api.post('/alerts/maintenance/cleanup'),
};

export const simulateAPI = {
  scenarios: () => api.get('/simulate/scenarios'),
  run: (scenario: string) => api.post('/simulate/scenario', { scenario }),
};

export const agentMonitorAPI = {
  stats: () => api.get('/agent-monitor/stats'),
  modelHealth: () => api.get('/agent-monitor/health/models'),
};

export const chatbotAPI = {
  chat: (message: string, threadId?: string) => api.post('/chatbot/chat', { message, thread_id: threadId }),
  deleteThread: (threadId: string) => api.delete(`/chatbot/history/${threadId}`),
  getHistory: (threadId: string) => api.get(`/chatbot/history/${threadId}`),
  suggestFix: (data: { incident_id: string; title: string; service: string; severity: string; alert_count: number; alerts: any[]; teams?: string[] }) =>
    api.post('/chatbot/suggest-fix', data),
  pendingApprovals: () => api.get('/chatbot/approvals/pending'),
  approve: (id: string, user: string) => api.post(`/chatbot/approvals/${id}`, { approved: true, decided_by: user }),
  reject: (id: string, user: string) => api.post(`/chatbot/approvals/${id}`, { approved: false, decided_by: user }),
};

export const rcaAPI = {
  analyze: (data: any) => api.post('/rca/analyze', data),
};

export const dcAPI = {
  getRooms: (site?: string) => api.get('/cmdb/dc/rooms', { params: site ? { site } : {} }),
  getRoom: (roomId: string) => api.get(`/cmdb/dc/rooms/${roomId}`),
  getRacks: (roomId: string) => api.get(`/cmdb/dc/rooms/${roomId}/racks`),
  getRackEquipment: (rackId: string) => api.get(`/cmdb/dc/racks/${rackId}/equipment`),
};

export const changesAPI = {
  list: (service?: string) => api.get('/changes', { params: service ? { service } : {} }),
  recent: (service: string, minutes?: number) => api.get(`/changes/recent/${service}`, { params: minutes ? { minutes } : {} }),
  correlate: (service: string) => api.get(`/changes/correlate/${service}`),
};

export const networkSimAPI = {
  health: () => api.get('/network-sim/health'),
  listDevices: () => api.get('/network-sim/devices'),
  getRoutes: (deviceId: string) => api.get(`/network-sim/devices/${deviceId}/routes`),
  getArp: (deviceId: string) => api.get(`/network-sim/devices/${deviceId}/arp`),
  getMacTable: (deviceId: string) => api.get(`/network-sim/devices/${deviceId}/mac-table`),
  getInterfaces: (deviceId: string) => api.get(`/network-sim/devices/${deviceId}/interfaces`),
  getLinkStates: () => api.get('/network-sim/link-states'),
  ping: (srcId: string, dstIp: string) => api.post('/network-sim/ping', { src_id: srcId, dst_ip: dstIp }),
  traceroute: (srcId: string, dstIp: string) => api.post('/network-sim/traceroute', { src_id: srcId, dst_ip: dstIp }),
  shortestPath: (srcId: string, dstIp: string) => api.get('/network-sim/shortest-path', { params: { src_id: srcId, dst_ip: dstIp } }),
  injectFailure: (targetId: string, failureType: string = 'link', interfaceName?: string) =>
    api.post('/network-sim/failure', { target_id: targetId, failure_type: failureType, interface_name: interfaceName || null }),
  recover: (targetId: string, recoveryType: string = 'link', interfaceName?: string) =>
    api.post('/network-sim/recovery', { target_id: targetId, recovery_type: recoveryType, interface_name: interfaceName || null }),
  getEvents: (count?: number) => api.get('/network-sim/events', { params: count ? { count } : {} }),
};

export const sloAPI = {
  list: () => api.get('/slo'),
  get: (service: string) => api.get(`/slo/${encodeURIComponent(service)}`),
};

export const syslogAPI = {
  stats: () => api.get('/syslog/stats'),
  messages: (hostname?: string, severity?: string) => {
    const params: Record<string, string> = {};
    if (hostname) params.hostname = hostname;
    if (severity) params.severity = severity;
    return api.get('/syslog/messages', { params });
  },
};

export const snmpAPI = {
  getStats: () => api.get('/snmp/stats'),
  getTraps: (params?: { limit?: number; severity?: string; source_ip?: string }) =>
    api.get('/snmp/traps', { params }),
  getHealth: () => api.get('/snmp/health'),
};
