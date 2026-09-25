import { cn } from '@/lib/utils';

/** Zeigt, ob der Live-Kanal zum Dashboard-Server steht. Orange heisst: Daten fliessen. */
export function ConnectionBadge({ connected, className }: { connected: boolean; className?: string }) {
  return (
    <span className={cn('label-micro inline-flex items-center gap-2', connected ? 'text-foreground' : 'text-bad', className)}>
      <span className="relative inline-flex size-2" aria-hidden="true">
        {connected && <span className="absolute inset-0 rounded-full bg-signal animate-ping-soft" />}
        <span className={cn('relative inline-flex size-2 rounded-full', connected ? 'bg-signal' : 'bg-bad')} />
      </span>
      {connected ? 'Live' : 'Offline'}
    </span>
  );
}
