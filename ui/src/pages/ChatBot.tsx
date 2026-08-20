import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [threads, setThreads] = useState<Thread[]>(() => {
    const existing = loadThreads();
    if (existing.length > 0) return existing;
    const first = createThread();
    return [first];
  });
  const [activeThreadId, setActiveThreadId] = useState<string>(() => threads[0]?.id || '');
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = loadMessages(activeThreadId);
    return saved.length > 0 ? saved : [WELCOME_MSG];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
            <button
              key={thread.id}
              onClick={() => switchThread(thread.id)}
              className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                thread.id === activeThreadId ? 'bg-primary-50 border-l-2 border-l-primary-600 text-primary-700 font-medium' : 'text-gray-700'
              }`}
            >
              <p className="truncate">{thread.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{new Date(thread.timestamp).toLocaleString()}</p>
            </button>
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
