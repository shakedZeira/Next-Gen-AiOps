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
  listCI: () => api.get('/cmdb/ci'),
  getCI: (id: string) => api.get(`/cmdb/ci/${id}`),
  createCI: (data: any) => api.post('/cmdb/ci', data),
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
  groups: () => api.get('/alerts/groups'),
  incidents: (status?: string) => api.get('/alerts/incidents', { params: status ? { status } : {} }),
  incident: (id: string) => api.get(`/alerts/incidents/${id}`),
  acknowledgeIncident: (id: string, user: string) => api.post(`/alerts/incidents/${id}/acknowledge`, { acknowledged_by: user }),
  resolveIncident: (id: string) => api.post(`/alerts/incidents/${id}/resolve`),
  stats: () => api.get('/alerts/stats'),
  acknowledge: (id: string, user: string) => api.post(`/alerts/${id}/acknowledge`, { acknowledged_by: user }),
  resolve: (id: string) => api.post(`/alerts/${id}/resolve`),
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
