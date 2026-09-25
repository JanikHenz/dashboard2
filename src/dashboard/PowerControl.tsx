import { PowerIcon } from 'lucide-react';
import { Led } from '@/components/Led';
import type { LedState } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { PowerState } from './usePower';

const LED: Record<PowerState, LedState> = {
  unknown: 'idle',
  online: 'online',
  offline: 'offline',
  pending: 'pending',
  disconnected: 'offline'
};

const SHORT: Record<PowerState, string> = {
  unknown: 'Unbekannt',
  online: 'Läuft',
  offline: 'Aus',
  pending: 'Wartet …',
  disconnected: 'Getrennt'
};

const FULL: Record<PowerState, string> = {
  unknown: 'Serverstatus unbekannt',
  online: 'Server läuft',
  offline: 'Server ist aus',
  pending: 'Befehl gesendet, warte auf den Server',
  disconnected: 'Keine Verbindung zum Dashboard-Server'
};

const RING: Record<PowerState, string> = {
  unknown: 'before:border-idle/50',
  online: 'before:border-ok before:shadow-[0_0_14px_-2px_var(--ok)]',
  offline: 'before:border-bad/70',
  pending: 'before:border-warn before:animate-blink',
  disconnected: 'before:border-bad/70'
};

export function PowerControl({ state, onPress, className }: { state: PowerState; onPress: () => void; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex min-w-0 flex-col items-end gap-1" role="status">
        <span className="label-micro text-muted-foreground" aria-hidden="true">Power</span>
        <span className="flex items-center gap-2 font-mono text-sm font-medium">
          <Led state={LED[state]} blink={state === 'unknown'} />
          <span aria-hidden="true" className="truncate">{SHORT[state]}</span>
          <span className="sr-only">{FULL[state]}</span>
        </span>
      </div>
      <button
        type="button"
        aria-label="Server ein- oder ausschalten"
        onClick={onPress}
        className={cn(
          'group relative grid size-14 shrink-0 place-items-center rounded-full border border-input bg-well p-1 transition-transform active:translate-y-px',
          'before:absolute before:inset-[3px] before:rounded-full before:border-2 before:transition-colors',
          RING[state]
        )}
      >
        <span className="grid size-full place-items-center rounded-full bg-primary text-signal shadow-[inset_0_-3px_0_rgb(0_0_0/0.35),0_3px_8px_-3px_rgb(0_0_0/0.5)] transition-shadow group-active:shadow-[inset_0_2px_4px_rgb(0_0_0/0.45)]">
          <PowerIcon className="size-5" strokeWidth={2.5} aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}
