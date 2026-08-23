import { useEffect, useRef, useState, useCallback } from 'react';
import { Alert } from '../types';

interface AlertEvent {
  type: 'alert.created' | 'alert.repeat' | 'alert.acknowledged' | 'alert.resolved';
  alert: Alert;
}

export function useAlertsWebSocket(onEvent: (event: AlertEvent) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const attemptRef = useRef(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/api/v1/alerts/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      attemptRef.current = 0;
    };

    ws.onmessage = (e) => {
      try {
        const event: AlertEvent = JSON.parse(e.data);
        onEventRef.current(event);
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      const delay = Math.min(1000 * 2 ** attemptRef.current, 30000);
      attemptRef.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
