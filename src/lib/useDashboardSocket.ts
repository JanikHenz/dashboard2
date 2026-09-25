import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppsStateMessage, MonitoringMessage, StatusMessage } from './types';

const RECONNECT_DELAY_MS = 3000;

export const SCOPES = {
  STATUS: 'status',
  MONITORING: 'monitoring',
  APPS: 'apps',
  ALL: 'all'
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

type Handlers = {
  onStatus: (message: StatusMessage) => void;
  onMonitoring: (message: MonitoringMessage) => void;
  onApps: (message: AppsStateMessage) => void;
  onDisconnected: () => void;
};

/** WebSocket mit automatischem Reconnect. Die Handler dürfen sich bei jedem Rendern ändern. */
export function useDashboardSocket(handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let reconnectTimer: number | undefined;
    let disposed = false;

    function handleMessage(event: MessageEvent) {
      let message: { type?: string } | null = null;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        console.error('WebSocket-Nachricht nicht lesbar', error);
        return;
      }
      if (!message || typeof message !== 'object') return;
      const current = handlersRef.current;
      if (message.type === 'status') current.onStatus(message as StatusMessage);
      else if (message.type === 'monitoring') current.onMonitoring(message as MonitoringMessage);
      else if (message.type === 'appsState') current.onApps(message as AppsStateMessage);
    }

    function connect() {
      window.clearTimeout(reconnectTimer);
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socketRef.current = socket;
      socket.addEventListener('open', () => setConnected(true));
      socket.addEventListener('message', handleMessage);
      socket.addEventListener('close', () => {
        socketRef.current = null;
        setConnected(false);
        if (disposed) return;
        handlersRef.current.onDisconnected();
        reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
      });
    }

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, []);

  const sendRefresh = useCallback((scope: Scope = SCOPES.STATUS) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(scope === SCOPES.STATUS ? { type: 'refresh' } : { type: 'refresh', scope }));
  }, []);

  return { connected, sendRefresh };
}
