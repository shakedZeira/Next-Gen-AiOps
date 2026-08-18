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

// Auth API
export const authAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

// CMDB API
export const cmdbAPI = {
  listCI: () => api.get('/cmdb/ci'),
  getCI: (id: string) => api.get(`/cmdb/ci/${id}`),
  createCI: (data: any) => api.post('/cmdb/ci', data),
  getTopology: (serviceId: string) => api.get(`/cmdb/topology/${serviceId}`),
  getImpact: (ciId: string) => api.get(`/cmdb/impact/${ciId}`),
};

// Alerts API
export const alertsAPI = {
  list: (status?: string) => api.get('/alerts', { params: { status } }),
  groups: () => api.get('/alerts/groups'),
  acknowledge: (id: string, user: string) => api.post(`/alerts/${id}/acknowledge`, { acknowledged_by: user }),
  resolve: (id: string) => api.post(`/alerts/${id}/resolve`),
};

// Agent Monitor API
export const agentMonitorAPI = {
  stats: () => api.get('/agent-monitor/stats'),
  modelHealth: () => api.get('/agent-monitor/health/models'),
};

// ChatBot API
export const chatbotAPI = {
  chat: (message: string, threadId?: string) => api.post('/chatbot/chat', { message, thread_id: threadId }),
  pendingApprovals: () => api.get('/chatbot/approvals/pending'),
  approve: (id: string, user: string) => api.post(`/chatbot/approvals/${id}`, { approved: true, decided_by: user }),
  reject: (id: string, user: string) => api.post(`/chatbot/approvals/${id}`, { approved: false, decided_by: user }),
};

// RCA API
export const rcaAPI = {
  analyze: (data: any) => api.post('/rca/analyze', data),
};
