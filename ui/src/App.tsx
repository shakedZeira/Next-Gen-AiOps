import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
