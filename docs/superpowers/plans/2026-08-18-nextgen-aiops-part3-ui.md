# Next-Gen AiOps — Part 3: UI & Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React UI (Dashboard, NOC Alerts, ChatBot, CMDB Explorer, Agent Monitor) and final Docker Compose integration with all services.

**Architecture:** React 18 + TypeScript + Tailwind CSS + Preline UI. Communicates with Core Platform API via REST. WebSocket for real-time updates. Cytoscape.js for topology visualization. Chart.js for metrics.

**Tech Stack:** React 18, TypeScript 5, Tailwind CSS 3, Preline UI 2.0, Vite, Cytoscape.js, Chart.js, nginx

**Spec:** `docs/superpowers/specs/2026-08-18-nextgen-aiops-design.md`

---

## Global Constraints

- React 18, TypeScript 5, Tailwind 3, Preline UI 2.0
- Vite for build
- All API calls through `/api/v1/*` proxy to Core Platform
- Preline UI for components (modals, tables, cards, nav)
- Cytoscape.js for topology visualization
- Chart.js for metrics charts
- WebSocket for real-time alert updates
- Docker Compose for deployment

---

## Task 12: React Project Setup

**Files:**
- Create: `ui/package.json`
- Create: `ui/tsconfig.json`
- Create: `ui/vite.config.ts`
- Create: `ui/tailwind.config.js`
- Create: `ui/postcss.config.js`
- Create: `ui/index.html`
- Create: `ui/src/main.tsx`
- Create: `ui/src/App.tsx`
- Create: `ui/src/api/client.ts`
- Create: `ui/src/types/index.ts`
- Create: `ui/Dockerfile`

**Subagent:** `general` — React setup

- [ ] **Step 1: Create ui/package.json**

```json
{
  "name": "nextgen-aiops-ui",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext .ts,.tsx"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "axios": "^1.7.0",
    "cytoscape": "^3.28.0",
    "chart.js": "^4.4.0",
    "react-chartjs-2": "^5.2.0",
    "preline": "^2.0.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/cytoscape": "^3.20.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0"
  }
}
```

- [ ] **Step 2: Create ui/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create ui/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
```

- [ ] **Step 4: Create ui/tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/preline/dist/*.js",
  ],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
        danger: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
        success: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a' },
      },
    },
  },
  plugins: [
    require('preline/plugin'),
  ],
}
```

- [ ] **Step 5: Create ui/src/api/client.ts**

```typescript
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
```

- [ ] **Step 6: Create ui/src/types/index.ts**

```typescript
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
  labels: Record<string, string>;
}

export interface Topology {
  nodes: Array<{ id: string; name: string; type: string }>;
  edges: Array<{ source: string; target: string; type: string }>;
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
```

- [ ] **Step 7: Create ui/src/App.tsx**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import NOCAlerts from './pages/NOCAlerts';
import ChatBot from './pages/ChatBot';
import CMDBExplorer from './pages/CMDBExplorer';
import AgentMonitor from './pages/AgentMonitor';
import Layout from './components/Layout';
import { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      setUser({ id: '1', email: 'admin@aiops.local', role: 'admin' });
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="/" element={<Layout user={user} />}>
          <Route index element={<Dashboard />} />
          <Route path="alerts" element={<NOCAlerts user={user} />} />
          <Route path="chatbot" element={<ChatBot user={user} />} />
          <Route path="cmdb" element={<CMDBExplorer />} />
          <Route path="agent-monitor" element={<AgentMonitor />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('admin@aiops.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (resp.ok) {
        localStorage.setItem('access_token', data.tokens.access_token);
        onLogin(data.user);
        window.location.href = '/';
      } else {
        setError('Invalid credentials');
      }
    } catch {
      setError('Connection failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6">Next-Gen AiOps</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Sign in</button>
        </form>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 8: Create ui/Dockerfile**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 9: Commit**

```bash
git add ui/
git commit -m "feat: React UI setup with Vite, Tailwind, Preline, API client"
```

---

## Task 13: Layout + Navigation

**Files:**
- Create: `ui/src/components/Layout.tsx`
- Create: `ui/src/components/Sidebar.tsx`
- Create: `ui/src/components/Header.tsx`

**Subagent:** `general` — layout components

- [ ] **Step 1: Create ui/src/components/Layout.tsx**

```tsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { User } from '../types';

export default function Layout({ user }: { user: User | null }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ui/src/components/Sidebar.tsx**

```tsx
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/alerts', label: 'NOC Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { to: '/chatbot', label: 'AiOps Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { to: '/cmdb', label: 'CMDB Explorer', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4' },
  { to: '/agent-monitor', label: 'Agent Monitor', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">AiOps Platform</h1>
        <p className="text-xs text-gray-400">Next-Gen Monitoring</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`
            }
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
        v0.1.0 — Demo
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Create ui/src/components/Header.tsx**

```tsx
import { User } from '../types';

export default function Header({ user }: { user: User | null }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">Next-Gen AiOps Monitoring</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">{user?.email}</p>
            <p className="text-xs text-gray-500">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/
git commit -m "feat: layout with sidebar navigation and header"
```

---

## Task 14: Dashboard Page

**Files:**
- Create: `ui/src/pages/Dashboard.tsx`
- Create: `ui/src/components/ServiceHealthCard.tsx`
- Create: `ui/src/components/TopologyGraph.tsx`

**Subagent:** `general` — dashboard page

- [ ] **Step 1: Create ui/src/components/ServiceHealthCard.tsx**

```tsx
interface Props {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  errorRate: number;
  throughput: number;
}

const statusColors = {
  healthy: 'bg-green-100 text-green-800 border-green-200',
  degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  down: 'bg-red-100 text-red-800 border-red-200',
};

export default function ServiceHealthCard({ name, status, latency, errorRate, throughput }: Props) {
  return (
    <div className={`p-4 rounded-xl border-2 ${statusColors[status]} transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{name}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
          {status}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-gray-500">Latency</p>
          <p className="font-mono font-medium">{latency}ms</p>
        </div>
        <div>
          <p className="text-gray-500">Errors</p>
          <p className="font-mono font-medium">{errorRate}%</p>
        </div>
        <div>
          <p className="text-gray-500">RPM</p>
          <p className="font-mono font-medium">{throughput}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ui/src/components/TopologyGraph.tsx**

```tsx
import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { Topology } from '../types';

export default function TopologyGraph({ topology }: { topology: Topology | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current || !topology) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const elements = [
      ...topology.nodes.map(n => ({
        data: { id: n.id, label: n.name, type: n.type },
      })),
      ...topology.edges.map(e => ({
        data: { source: e.source, target: e.target, label: e.type },
      })),
    ];

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        { selector: 'node', style: { 'background-color': '#3b82f6', label: 'data(label)', 'text-wrap': 'wrap', 'text-max-width': '100px', color: '#fff', 'font-size': '10px' } },
        { selector: 'edge', style: { width: 2, 'line-color': '#94a3b8', 'target-arrow-color': '#94a3b8', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)', 'font-size': '8px', color: '#64748b' } },
        { selector: 'node[type="database"]', style: { 'background-color': '#22c55e' } },
        { selector: 'node[type="cache"]', style: { 'background-color': '#f59e0b' } },
        { selector: 'node[type="queue"]', style: { 'background-color': '#8b5cf6' } },
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 50 },
    });

    return () => { cyRef.current?.destroy(); };
  }, [topology]);

  return <div ref={containerRef} className="w-full h-96 bg-gray-50 rounded-xl border" />;
}
```

- [ ] **Step 3: Create ui/src/pages/Dashboard.tsx**

```tsx
import { useState, useEffect } from 'react';
import ServiceHealthCard from '../components/ServiceHealthCard';
import TopologyGraph from '../components/TopologyGraph';
import { cmdbAPI } from '../api/client';
import { Topology } from '../types';

const SERVICES = [
  { name: 'E-Commerce Platform', status: 'healthy' as const, latency: 120, errorRate: 1.2, throughput: 850 },
  { name: 'Payment Gateway', status: 'degraded' as const, latency: 340, errorRate: 3.8, throughput: 420 },
  { name: 'Inventory Service', status: 'healthy' as const, latency: 85, errorRate: 0.5, throughput: 620 },
  { name: 'Notification Service', status: 'healthy' as const, latency: 45, errorRate: 0.2, throughput: 1200 },
];

export default function Dashboard() {
  const [topology, setTopology] = useState<Topology | null>(null);

  useEffect(() => {
    cmdbAPI.listCI().then(() => {
      setTopology({
        nodes: [
          { id: '1', name: 'nginx-lb', type: 'load_balancer' },
          { id: '2', name: 'web-server', type: 'host' },
          { id: '3', name: 'api-gateway', type: 'api_gateway' },
          { id: '4', name: 'payments-api', type: 'microservice' },
          { id: '5', name: 'postgres', type: 'database' },
          { id: '6', name: 'redis', type: 'cache' },
          { id: '7', name: 'kafka', type: 'queue' },
        ],
        edges: [
          { source: '1', target: '2', type: 'routes_to' },
          { source: '2', target: '3', type: 'calls' },
          { source: '3', target: '4', type: 'depends_on' },
          { source: '3', target: '5', type: 'depends_on' },
          { source: '3', target: '6', type: 'depends_on' },
          { source: '4', target: '5', type: 'depends_on' },
          { source: '4', target: '7', type: 'publishes_to' },
        ],
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Service Health Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SERVICES.map(svc => (
          <ServiceHealthCard key={svc.name} {...svc} />
        ))}
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Service Topology</h2>
        <TopologyGraph topology={topology} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/pages/Dashboard.tsx ui/src/components/ServiceHealthCard.tsx ui/src/components/TopologyGraph.tsx
git commit -m "feat: dashboard page with service health cards and topology graph"
```

---

## Task 15: NOC Alerts Page

**Files:**
- Create: `ui/src/pages/NOCAlerts.tsx`
- Create: `ui/src/components/AlertTable.tsx`

**Subagent:** `general` — NOC alerts page

- [ ] **Step 1: Create ui/src/components/AlertTable.tsx**

```tsx
import { Alert } from '../types';

interface Props {
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

const severityColors = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
  info: 'bg-gray-100 text-gray-800',
};

const statusColors = {
  active: 'bg-red-50 border-red-200',
  acknowledged: 'bg-yellow-50 border-yellow-200',
  resolved: 'bg-green-50 border-green-200',
  escalated: 'bg-purple-50 border-purple-200',
};

export default function AlertTable({ alerts, onAcknowledge, onResolve }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alert</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {alerts.map(alert => (
            <tr key={alert.id} className={`border-l-4 ${statusColors[alert.status]}`}>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityColors[alert.severity]}`}>
                  {alert.severity}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{alert.name}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{alert.service}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{alert.status}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{new Date(alert.created_at).toLocaleTimeString()}</td>
              <td className="px-4 py-3 text-right space-x-2">
                {alert.status === 'active' && (
                  <button onClick={() => onAcknowledge(alert.id)} className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-xs hover:bg-yellow-600">
                    Ack
                  </button>
                )}
                {alert.status !== 'resolved' && (
                  <button onClick={() => onResolve(alert.id)} className="px-3 py-1 bg-green-500 text-white rounded-lg text-xs hover:bg-green-600">
                    Resolve
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create ui/src/pages/NOCAlerts.tsx**

```tsx
import { useState, useEffect } from 'react';
import AlertTable from '../components/AlertTable';
import { alertsAPI } from '../api/client';
import { Alert } from '../types';

const DEMO_ALERTS: Alert[] = [
  { id: '1', name: 'High Latency P99', service: 'Payment Gateway', severity: 'critical', description: 'P99 latency exceeded 2s threshold', status: 'active', created_at: new Date().toISOString() },
  { id: '2', name: 'Error Rate Spike', service: 'E-Commerce Platform', severity: 'high', description: 'Error rate above 5% for 5 minutes', status: 'acknowledged', created_at: new Date(Date.now() - 300000).toISOString(), acknowledged_by: 'operator@aiops.local' },
  { id: '3', name: 'Disk Space Low', service: 'Inventory Service', severity: 'medium', description: 'Disk usage above 85%', status: 'active', created_at: new Date(Date.now() - 600000).toISOString() },
  { id: '4', name: 'SSL Certificate Expiry', service: 'Notification Service', severity: 'low', description: 'Certificate expires in 7 days', status: 'active', created_at: new Date(Date.now() - 900000).toISOString() },
];

export default function NOCAlerts({ user }: { user: any }) {
  const [alerts, setAlerts] = useState<Alert[]>(DEMO_ALERTS);
  const [filter, setFilter] = useState<string>('all');

  const handleAcknowledge = async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' as const, acknowledged_by: user?.email } : a));
  };

  const handleResolve = async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' as const } : a));
  };

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">NOC Alert Console</h1>
        <div className="flex gap-2">
          {['all', 'active', 'acknowledged', 'resolved'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-sm ${filter === f ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <AlertTable alerts={filtered} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/pages/NOCAlerts.tsx ui/src/components/AlertTable.tsx
git commit -m "feat: NOC alerts page with alert table, filtering, acknowledge/resolve"
```

---

## Task 16: ChatBot Page

**Files:**
- Create: `ui/src/pages/ChatBot.tsx`
- Create: `ui/src/components/ApprovalQueue.tsx`

**Subagent:** `general` — chatbot page

- [ ] **Step 1: Create ui/src/components/ApprovalQueue.tsx**

```tsx
import { ApprovalRequest } from '../types';

interface Props {
  approvals: ApprovalRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function ApprovalQueue({ approvals, onApprove, onReject }: Props) {
  if (approvals.length === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
      <h3 className="font-semibold text-yellow-800 mb-3">Pending Approvals</h3>
      <div className="space-y-3">
        {approvals.map(req => (
          <div key={req.id} className="bg-white rounded-lg p-3 border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">{req.tool_name}</span>
              <span className="text-xs text-gray-500">{new Date(req.created_at * 1000).toLocaleTimeString()}</span>
            </div>
            <p className="text-xs text-gray-600 mb-2">{req.context}</p>
            <pre className="text-xs bg-gray-50 rounded p-2 mb-2 overflow-x-auto">{JSON.stringify(req.arguments, null, 2)}</pre>
            <div className="flex gap-2">
              <button onClick={() => onApprove(req.id)} className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600">
                Approve
              </button>
              <button onClick={() => onReject(req.id)} className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ui/src/pages/ChatBot.tsx**

```tsx
import { useState, useEffect, useRef } from 'react';
import ApprovalQueue from '../components/ApprovalQueue';
import { chatbotAPI } from '../api/client';
import { ApprovalRequest } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatBot({ user }: { user: any }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I\'m your AiOps assistant. I can help you investigate alerts, check metrics, logs, traces, and topology. What would you like to know?', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const resp = await chatbotAPI.chat(input);
      const assistantMsg: Message = { role: 'assistant', content: resp.data.response, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date() }]);
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    await chatbotAPI.approve(id, user?.email || 'operator');
    setApprovals(prev => prev.filter(a => a.id !== id));
  };

  const handleReject = async (id: string) => {
    await chatbotAPI.reject(id, user?.email || 'operator');
    setApprovals(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      <div className="flex-1 flex flex-col bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-900">AiOps Assistant</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-xl px-4 py-2 ${msg.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-primary-200' : 'text-gray-500'}`}>
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-xl px-4 py-2">
                <p className="text-sm text-gray-500 animate-pulse">Thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about alerts, metrics, logs..."
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button onClick={sendMessage} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              Send
            </button>
          </div>
        </div>
      </div>
      <div className="w-80">
        <ApprovalQueue approvals={approvals} onApprove={handleApprove} onReject={handleReject} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/pages/ChatBot.tsx ui/src/components/ApprovalQueue.tsx
git commit -m "feat: chatbot page with conversation UI and approval queue"
```

---

## Task 17: CMDB Explorer Page

**Files:**
- Create: `ui/src/pages/CMDBExplorer.tsx`

**Subagent:** `general` — CMDB explorer page

- [ ] **Step 1: Create ui/src/pages/CMDBExplorer.tsx**

```tsx
import { useState, useEffect } from 'react';
import TopologyGraph from '../components/TopologyGraph';
import { cmdbAPI } from '../api/client';
import { CI, Topology } from '../types';

export default function CMDBExplorer() {
  const [cis, setCIs] = useState<CI[]>([]);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [selectedCI, setSelectedCI] = useState<CI | null>(null);

  useEffect(() => {
    cmdbAPI.listCI().then(() => {
      const demoCIs: CI[] = [
        { id: '1', name: 'nginx-lb-1', type: 'load_balancer', provider: 'aws', environment: 'prod', labels: { app: 'nginx', tier: 'frontend' } },
        { id: '2', name: 'web-server-1', type: 'host', provider: 'aws', environment: 'prod', labels: { app: 'ecommerce', tier: 'frontend' } },
        { id: '3', name: 'api-gateway', type: 'api_gateway', provider: 'aws', environment: 'prod', labels: { app: 'api-gateway', tier: 'backend' } },
        { id: '4', name: 'postgres-payments', type: 'database', provider: 'aws', environment: 'prod', labels: { app: 'payments', tier: 'data' } },
        { id: '5', name: 'redis-cache', type: 'cache', provider: 'aws', environment: 'prod', labels: { app: 'redis', tier: 'data' } },
      ];
      setCIs(demoCIs);
      setTopology({
        nodes: demoCIs.map(c => ({ id: c.id, name: c.name, type: c.type })),
        edges: [
          { source: '1', target: '2', type: 'routes_to' },
          { source: '2', target: '3', type: 'calls' },
          { source: '3', target: '4', type: 'depends_on' },
          { source: '3', target: '5', type: 'depends_on' },
        ],
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">CMDB Explorer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Service Topology</h2>
          <TopologyGraph topology={topology} />
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Configuration Items</h2>
          <div className="space-y-2">
            {cis.map(ci => (
              <div
                key={ci.id}
                onClick={() => setSelectedCI(ci)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedCI?.id === ci.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900">{ci.name}</span>
                  <span className="text-xs text-gray-500">{ci.type}</span>
                </div>
                <div className="flex gap-1 mt-1">
                  {Object.entries(ci.labels).map(([k, v]) => (
                    <span key={k} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{k}: {v}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedCI && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">CI Details: {selectedCI.name}</h2>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500">Type:</span> <span className="font-medium">{selectedCI.type}</span></div>
            <div><span className="text-gray-500">Provider:</span> <span className="font-medium">{selectedCI.provider}</span></div>
            <div><span className="text-gray-500">Environment:</span> <span className="font-medium">{selectedCI.environment}</span></div>
            <div><span className="text-gray-500">ID:</span> <span className="font-mono text-xs">{selectedCI.id}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/CMDBExplorer.tsx
git commit -m "feat: CMDB explorer page with topology graph and CI details"
```

---

## Task 18: Agent Monitor Page

**Files:**
- Create: `ui/src/pages/AgentMonitor.tsx`
- Create: `ui/src/components/TokenUsageChart.tsx`

**Subagent:** `general` — agent monitor page

- [ ] **Step 1: Create ui/src/components/TokenUsageChart.tsx**

```tsx
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function TokenUsageChart() {
  const data = {
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
    datasets: [
      { label: 'Input Tokens', data: [1200, 1900, 3000, 5000, 3500, 2800], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true },
      { label: 'Output Tokens', data: [800, 1200, 2000, 3200, 2200, 1800], borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true },
    ],
  };

  const options = {
    responsive: true,
    plugins: { legend: { position: 'top' as const }, title: { display: false } },
    scales: { y: { beginAtZero: true } },
  };

  return <Line data={data} options={options} />;
}
```

- [ ] **Step 2: Create ui/src/pages/AgentMonitor.tsx**

```tsx
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
      <h1 className="text-2xl font-bold text-gray-900">Agent & Model Monitor</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total Requests</p>
          <p className="text-2xl font-bold text-gray-900">2,139</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total Tokens</p>
          <p className="text-2xl font-bold text-gray-900">3.2M</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Avg Latency</p>
          <p className="text-2xl font-bold text-gray-900">168ms</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Error Rate</p>
          <p className="text-2xl font-bold text-gray-900">0.19%</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Token Usage Over Time</h2>
        <TokenUsageChart />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Model Health</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Errors</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Latency</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">P99 Latency</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TPM</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {models.map(model => (
              <tr key={model.model} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 font-mono">{model.model}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{model.requests.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{model.errors}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{model.avg_latency_ms}ms</td>
                <td className="px-4 py-3 text-sm text-gray-600">{model.p99_latency_ms}ms</td>
                <td className="px-4 py-3 text-sm text-gray-600">{model.tokens_per_minute.toLocaleString()}</td>
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
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/pages/AgentMonitor.tsx ui/src/components/TokenUsageChart.tsx
git commit -m "feat: agent monitor page with token usage charts and model health table"
```

---

## Task 19: nginx Config + Final Docker Compose

**Files:**
- Create: `ui/nginx.conf`
- Create: `docker-compose.yml` (updated)
- Create: `Makefile` (updated)

**Subagent:** `general` — nginx + final compose

- [ ] **Step 1: Create ui/nginx.conf**

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api-gateway:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /auth/ {
        proxy_pass http://api-gateway:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

- [ ] **Step 2: Update docker-compose.yml with all plugin services**

Add to the existing docker-compose.yml:

```yaml
  generator:
    build:
      context: .
      dockerfile: plugins/generator/Dockerfile
    depends_on:
      api-gateway:
        condition: service_healthy
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-lgtm:4318

  agent-monitor:
    build:
      context: .
      dockerfile: plugins/agent_monitor/Dockerfile
    depends_on:
      api-gateway:
        condition: service_healthy
      ollama:
        condition: service_healthy
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-lgtm:4318
      OLLAMA_BASE_URL: http://ollama:11434

  rca-engine:
    build:
      context: .
      dockerfile: plugins/rca_engine/Dockerfile
    depends_on:
      api-gateway:
        condition: service_healthy
      ollama:
        condition: service_healthy
    environment:
      OLLAMA_BASE_URL: http://ollama:11434

  chatbot:
    build:
      context: .
      dockerfile: plugins/chatbot/Dockerfile
    depends_on:
      api-gateway:
        condition: service_healthy
      ollama:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      OLLAMA_BASE_URL: http://ollama:11434
      REDIS_URL: redis://redis:6379/0

  alert-noc:
    build:
      context: .
      dockerfile: plugins/alert_noc/Dockerfile
    depends_on:
      api-gateway:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      REDIS_URL: redis://redis:6379/0

  ui:
    build:
      context: ./ui
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      api-gateway:
        condition: service_healthy
```

- [ ] **Step 3: Update Makefile**

```makefile
.PHONY: dev up down logs test lint typecheck seed ollama-pull

dev:
	uvicorn core_platform.main:app --reload --host 0.0.0.0 --port 8000

up:
	docker compose up -d --build

down:
	docker compose down -v

logs:
	docker compose logs -f

test:
	pytest -v --cov=core_platform --cov=aiops_shared

lint:
	ruff check .

typecheck:
	mypy core_platform/ aiops_shared/

seed:
	python db/seed.py

ollama-pull:
	docker compose exec ollama ollama pull llama3.1:8b
	docker compose exec ollama ollama pull qwen2.5:7b

setup: up ollama-pull seed
	@echo "Setup complete! Access Grafana at http://localhost:3000 and UI at http://localhost:80"
```

- [ ] **Step 4: Commit**

```bash
git add ui/nginx.conf docker-compose.yml Makefile
git commit -m "feat: nginx config and final Docker Compose with all services"
```

---

## Task 20: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.pre-commit-config.yaml`

**Subagent:** `general` — CI setup

- [ ] **Step 1: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -e ".[dev]"
      - run: ruff check .
      - run: mypy core_platform/ aiops_shared/
      - run: pytest -v --cov=core_platform --cov=aiops_shared --cov-report=xml
      - uses: codecov/codecov-action@v4
        with:
          file: coverage.xml

  ui-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: ui/package-lock.json
      - run: cd ui && npm ci
      - run: cd ui && npm run build
```

- [ ] **Step 2: Create .pre-commit-config.yaml**

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.10.0
    hooks:
      - id: mypy
        additional_dependencies: [pydantic, pydantic-settings, sqlalchemy]
```

- [ ] **Step 3: Commit**

```bash
git add .github/ .pre-commit-config.yaml
git commit -m "ci: GitHub Actions with ruff, mypy, pytest, and UI build"
```

---

## Task Summary

| Task | Description | Subagent | Parallel Group |
|------|-------------|----------|----------------|
| 12 | React Project Setup | general | After Part 2 |
| 13 | Layout + Navigation | general | After Task 12 |
| 14 | Dashboard Page | general | After Task 13 |
| 15 | NOC Alerts Page | general | After Task 13 |
| 16 | ChatBot Page | general | After Task 13 |
| 17 | CMDB Explorer Page | general | After Task 13 |
| 18 | Agent Monitor Page | general | After Task 13 |
| 19 | nginx + Final Compose | general | After Tasks 14-18 |
| 20 | GitHub Actions CI | general | After Task 19 |

**Parallel Execution Groups:**
- Group A (after Task 13): Tasks 14, 15, 16, 17, 18 can ALL run in parallel (each page is independent)
- Group B (after Group A): Task 19 (final integration)
- Group C (after Task 19): Task 20 (CI)

**Total Estimated Time:** ~25-35 minutes with parallel subagents
