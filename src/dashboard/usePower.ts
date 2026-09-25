import { useCallback, useRef, useState } from 'react';
import { useDialogs } from '@/components/DialogProvider';
import { requestJson } from '@/lib/api';
import type { StatusMessage } from '@/lib/types';

const STATUS_REFRESH_DELAY_MS = 1500;

export type PowerState = 'unknown' | 'online' | 'offline' | 'pending' | 'disconnected';

/**
 * Status, Uptime und Power-Knopf.
 * Nach einem Knopfdruck bleibt der Zustand auf "pending", bis der Server seinen Zustand wirklich ändert.
 */
export function usePower({ onRequestRefresh }: { onRequestRefresh: () => void }) {
  const dialogs = useDialogs();
  const [isOn, setIsOn] = useState<boolean | null>(null);
  const [uptimeMs, setUptimeMs] = useState(0);
  const [pendingFrom, setPendingFrom] = useState<boolean | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const pendingRef = useRef<boolean | null>(null);
  const isOnRef = useRef(false);

  const applyStatus = useCallback((message: StatusMessage) => {
    if (typeof message.is_on !== 'boolean') return;
    isOnRef.current = message.is_on;
    setDisconnected(false);
    setIsOn(message.is_on);
    if (pendingRef.current !== null && message.is_on !== pendingRef.current) {
      pendingRef.current = null;
      setPendingFrom(null);
    }
    setUptimeMs(Number(message.uptime_ms));
  }, []);

  const markDisconnected = useCallback(() => setDisconnected(true), []);

  const press = useCallback(async () => {
    const serverIsOn = isOnRef.current;
    const confirmed = await dialogs.confirm({
      title: serverIsOn ? 'Server ausschalten?' : 'Server einschalten?',
      message: serverIsOn
        ? 'Der Server wird über den Power-Knopf hart ausgeschaltet. Nicht gespeicherte Arbeit geht verloren.'
        : 'Der Power-Knopf des Servers wird gedrückt und der Server startet.',
      confirmLabel: serverIsOn ? 'Ausschalten' : 'Einschalten',
      tone: serverIsOn ? 'danger' : 'default'
    });
    if (!confirmed) return;

    try {
      await requestJson('/api/press-button');
      pendingRef.current = serverIsOn;
      setPendingFrom(serverIsOn);
      window.setTimeout(onRequestRefresh, STATUS_REFRESH_DELAY_MS);
    } catch (error) {
      pendingRef.current = null;
      setPendingFrom(null);
      await dialogs.notice({ title: 'Befehl fehlgeschlagen', message: (error as Error).message, tone: 'danger' });
    }
  }, [dialogs, onRequestRefresh]);

  let state: PowerState;
  if (disconnected) state = 'disconnected';
  else if (isOn === null) state = 'unknown';
  else if (pendingFrom !== null && isOn === pendingFrom) state = 'pending';
  else state = isOn ? 'online' : 'offline';

  return { state, isOn, uptimeMs, applyStatus, markDisconnected, press };
}
