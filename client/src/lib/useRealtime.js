import { useEffect, useRef, useState } from 'react';
import { tokens } from './api.js';

/**
 * Conexión WebSocket con reconexión automática.
 * onMessage({ type, data }) recibe 'access' y 'device_status'.
 */
export function useRealtime(onMessage) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    let ws;
    let retry;
    let closed = false;
    const connect = () => {
      const token = tokens.admin;
      if (!token) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => { try { handler.current?.(JSON.parse(e.data)); } catch { /* */ } };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { closed = true; clearTimeout(retry); ws?.close(); };
  }, []);

  return connected;
}
