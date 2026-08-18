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
