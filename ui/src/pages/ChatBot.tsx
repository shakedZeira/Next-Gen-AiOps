import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import ApprovalQueue from '../components/ApprovalQueue';
import { chatbotAPI } from '../api/client';
import { ApprovalRequest } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Thread {
  id: string;
  title: string;
  timestamp: string;
}

const WELCOME_MSG: Message = {
  role: 'assistant',
  content: 'Hello! I\'m your AiOps assistant. I can help you investigate alerts, check metrics, logs, traces, and topology. What would you like to know?',
  timestamp: new Date(),
};

const SUGGESTION_CHIPS = [
  'Show me current alerts',
  'What\'s the system health status?',
  'Check the network topology',
  'Run diagnostics on Payment Gateway',
  'Show me the CMDB overview',
];

const STORAGE_PREFIX = 'aiops_chat_';
const MESSAGES_KEY = `${STORAGE_PREFIX}messages`;
const THREADS_KEY = `${STORAGE_PREFIX}threads`;

function loadMessages(threadId: string): Message[] {
  try {
    const raw = localStorage.getItem(`${MESSAGES_KEY}_${threadId}`);
    if (!raw) return [];
    return JSON.parse(raw).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveMessages(threadId: string, messages: Message[]) {
  localStorage.setItem(`${MESSAGES_KEY}_${threadId}`, JSON.stringify(messages));
}

function loadThreads(): Thread[] {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function createThread(): Thread {
  return { id: Date.now().toString(), title: 'New Chat', timestamp: new Date().toISOString() };
}

export default function ChatBot({ user }: { user: any }) {
  const location = useLocation();
  const prefillMessage = (location.state as any)?.prefillMessage as string | undefined;
  const prefillThreadId = (location.state as any)?.threadId as string | undefined;
  const prefillTitle = (location.state as any)?.title as string | undefined;

  const [threads, setThreads] = useState<Thread[]>(() => {
    const existing = loadThreads();
    if (existing.length > 0) return existing;
    const first = createThread();
    return [first];
  });
  const [activeThreadId, setActiveThreadId] = useState<string>(() => prefillThreadId || threads[0]?.id || '');
  const [messages, setMessages] = useState<Message[]>(() => {
    if (prefillThreadId) {
      const saved = loadMessages(prefillThreadId);
      return saved.length > 0 ? saved : [WELCOME_MSG];
    }
    const saved = loadMessages(threads[0]?.id || '');
    return saved.length > 0 ? saved : [WELCOME_MSG];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasSentPrefill = useRef(false);

  // Scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (activeThreadId) saveMessages(activeThreadId, messages);
  }, [messages, activeThreadId]);

  // Persist thread list to localStorage whenever it changes
  useEffect(() => {
    if (threads.length > 0) {
      localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
    }
  }, [threads]);

  // Poll approvals every 10s
  useEffect(() => {
    const fetchApprovals = async () => {
      try {
        const resp = await chatbotAPI.pendingApprovals();
        setApprovals(resp.data);
      } catch {
        // silently ignore API errors during polling
      }
    };
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handle navigation from NOC Alerts (suggest-fix thread switch)
  useEffect(() => {
    if (!prefillThreadId) return;
    // Ensure the thread exists in the sidebar
    setThreads(prev => {
      const exists = prev.find(t => t.id === prefillThreadId);
      if (exists) return prev;
      return [{ id: prefillThreadId, title: prefillTitle || 'Incident Analysis', timestamp: new Date().toISOString() }, ...prev];
    });
    setActiveThreadId(prefillThreadId);

    // Try localStorage first, fall back to backend Redis
    const saved = loadMessages(prefillThreadId);
    if (saved.length > 0) {
      setMessages(saved);
    } else {
      chatbotAPI.getHistory(prefillThreadId)
        .then((resp) => {
          const backendMsgs = (resp.data?.messages || []).map((m: any) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(),
          }));
          if (backendMsgs.length > 0) {
            setMessages(backendMsgs);
            saveMessages(prefillThreadId, backendMsgs);
          } else {
            setMessages([WELCOME_MSG]);
          }
        })
        .catch(() => setMessages([WELCOME_MSG]));
    }
  }, [prefillThreadId, prefillTitle]);

  // Handle prefill message (auto-send a message on mount)
  useEffect(() => {
    if (!prefillMessage || hasSentPrefill.current) return;
    hasSentPrefill.current = true;
    setTimeout(() => sendMessage(prefillMessage), 300);
  }, [prefillMessage]);

  const switchThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    const saved = loadMessages(threadId);
    setMessages(saved.length > 0 ? saved : [WELCOME_MSG]);
  }, []);

  const startNewChat = useCallback(() => {
    const thread = createThread();
    setThreads(prev => [thread, ...prev]);
    setActiveThreadId(thread.id);
    setMessages([WELCOME_MSG]);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([WELCOME_MSG]);
    localStorage.removeItem(`${MESSAGES_KEY}_${activeThreadId}`);
  }, [activeThreadId]);

  const deleteThread = useCallback(async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await chatbotAPI.deleteThread(threadId); } catch { /* ignore */ }
    localStorage.removeItem(`${MESSAGES_KEY}_${threadId}`);
    setThreads(prev => {
      const next = prev.filter(t => t.id !== threadId);
      if (next.length === 0) {
        const fresh = createThread();
        next.push(fresh);
        setActiveThreadId(fresh.id);
        setMessages([WELCOME_MSG]);
      } else if (threadId === activeThreadId) {
        setActiveThreadId(next[0].id);
        const saved = loadMessages(next[0].id);
        setMessages(saved.length > 0 ? saved : [WELCOME_MSG]);
      }
      return next;
    });
  }, [activeThreadId]);

  const sendMessage = async (text?: string) => {
    const msgText = text || input;
    if (!msgText.trim()) return;
    const userMsg: Message = { role: 'user', content: msgText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Update thread title from first user message
    setThreads(prev => {
      const updated = [...prev];
      const thread = updated.find(t => t.id === activeThreadId);
      if (thread && thread.title === 'New Chat') {
        thread.title = msgText.slice(0, 40) + (msgText.length > 40 ? '...' : '');
      }
      return updated;
    });

    try {
      const resp = await chatbotAPI.chat(msgText, activeThreadId);
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

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Thread sidebar */}
      <div className="w-64 flex flex-col bg-white rounded-xl border overflow-hidden shrink-0">
        <div className="p-3 border-b">
          <button onClick={startNewChat} className="w-full px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">
            + New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.map(thread => (
            <div
              key={thread.id}
              onClick={() => switchThread(thread.id)}
              className={`group flex items-center justify-between w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                thread.id === activeThreadId ? 'bg-primary-50 border-l-2 border-l-primary-600 text-primary-700 font-medium' : 'text-gray-700'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate">{thread.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(thread.timestamp).toLocaleString()}</p>
              </div>
              <button
                onClick={(e) => deleteThread(thread.id, e)}
                className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-red-500 transition-all shrink-0"
                title="Delete chat"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">AiOps Assistant</h2>
          <button onClick={clearChat} className="text-sm text-gray-500 hover:text-red-600 transition-colors">
            Clear Chat
          </button>
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
          {/* Suggestion chips — only on last assistant message */}
          {!loading && lastAssistantIdx >= 0 && messages.length > 0 && lastAssistantIdx === messages.length - 1 && (
            <div className="flex flex-wrap gap-2 pl-1">
              {SUGGESTION_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="px-3 py-1.5 text-xs bg-primary-50 text-primary-700 rounded-full border border-primary-200 hover:bg-primary-100 transition-colors"
                >
                  {chip}
                </button>
              ))}
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
            <button onClick={() => sendMessage()} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Approval Queue sidebar */}
      <div className="w-80">
        <ApprovalQueue approvals={approvals} onApprove={handleApprove} onReject={handleReject} />
      </div>
    </div>
  );
}
