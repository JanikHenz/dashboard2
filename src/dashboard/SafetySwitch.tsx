import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useDialogs } from '@/components/DialogProvider';
import { requestJson } from '@/lib/api';
import { cn } from '@/lib/utils';

const AUTO_CLOSE_MS = 5000;
const LEVER_RESET_MS = 340;
const STATUS_REFRESH_DELAY_MS = 1500;

/**
 * Schutzkappe und Kippschalter für den Hard-Shutdown.
 * Die Kappe schliesst sich nach kurzer Zeit von selbst, damit der Schalter nie offen herumliegt.
 */
export function SafetySwitch({ onRequestRefresh }: { onRequestRefresh: () => void }) {
  const dialogs = useDialogs();
  const inputId = useId();
  const coverRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoCloseTimer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.clearTimeout(autoCloseTimer.current);
    if (open && !armed) autoCloseTimer.current = window.setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
    return () => window.clearTimeout(autoCloseTimer.current);
  }, [open, armed]);

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  function resetLever() {
    setArmed(false);
    window.setTimeout(() => {
      setOpen(false);
      coverRef.current?.focus({ preventScroll: true });
    }, LEVER_RESET_MS);
  }

  async function triggerHardShutdown() {
    const confirmed = await dialogs.confirm({
      title: 'Hard-Shutdown auslösen?',
      message: 'Der Server wird sofort und ohne sauberes Herunterfahren ausgeschaltet.',
      confirmLabel: 'Hard-Shutdown',
      tone: 'danger'
    });
    if (!confirmed) {
      resetLever();
      return;
    }

    setBusy(true);
    try {
      await requestJson('/api/hard-shutdown', { method: 'POST' });
      window.setTimeout(onRequestRefresh, STATUS_REFRESH_DELAY_MS);
      await dialogs.notice({ title: 'Hard-Shutdown ausgelöst', message: 'Der Server wird jetzt ausgeschaltet.' });
    } catch (error) {
      await dialogs.notice({ title: 'Hard-Shutdown fehlgeschlagen', message: (error as Error).message, tone: 'danger' });
    } finally {
      setBusy(false);
      resetLever();
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="relative aspect-square w-full max-w-36 [perspective:600px]">
        <div className="absolute inset-0 grid place-items-center rounded-md border border-border bg-well">
          <span aria-hidden="true" className="hatch absolute inset-0 rounded-md text-bad/25" />
          <span aria-hidden="true" className="absolute inset-3 rounded-sm bg-card shadow-[inset_0_1px_3px_rgb(0_0_0/0.25)]" />
          <label htmlFor={inputId} className={cn('relative flex flex-col items-center gap-1', !open && 'pointer-events-none')}>
            <input
              ref={inputRef}
              id={inputId}
              type="checkbox"
              role="switch"
              aria-label="Hard-Shutdown auslösen"
              disabled={!open || busy}
              checked={armed}
              onChange={(event) => {
                if (!open || busy || !event.target.checked) return;
                setArmed(true);
                triggerHardShutdown();
              }}
              className="peer sr-only"
            />
            <span aria-hidden="true" className="label-micro text-bad">Ein</span>
            <span
              aria-hidden="true"
              className="relative h-16 w-8 rounded-full border border-input bg-screen shadow-[inset_0_2px_5px_rgb(0_0_0/0.6)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
            >
              <span
                className={cn(
                  'absolute left-1/2 h-7 w-6 -translate-x-1/2 rounded-full border border-input bg-[linear-gradient(to_bottom,var(--card),var(--muted))] shadow-[0_3px_6px_-2px_rgb(0_0_0/0.6)] transition-[top] duration-300 ease-snap',
                  armed ? 'top-1' : 'top-[calc(100%-2rem)]'
                )}
              />
            </span>
            <span aria-hidden="true" className="label-micro text-muted-foreground">Aus</span>
          </label>
        </div>

        <button
          ref={coverRef}
          type="button"
          aria-label="Schutzkappe des Hard-Shutdown-Schalters"
          aria-expanded={open}
          aria-controls={inputId}
          disabled={busy}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            'absolute inset-0 origin-top rounded-md border border-bad/70 bg-bad/85 text-white shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)] backdrop-blur-[1px] transition-transform duration-500 ease-snap [transform-style:preserve-3d]',
            open ? '[transform:rotateX(-108deg)]' : '[transform:rotateX(0deg)]'
          )}
        >
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-2.5 rounded-t-md bg-black/30" />
          <span aria-hidden="true" className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
            <span className="font-wide text-sm font-bold tracking-wide uppercase">Shutdown</span>
            <span className="label-micro opacity-80">Kappe heben</span>
          </span>
        </button>

        {open && !armed && (
          <span
            aria-hidden="true"
            style={{ '--drain-duration': `${AUTO_CLOSE_MS}ms` } as CSSProperties}
            className="absolute inset-x-3 -bottom-2 h-0.5 origin-left animate-drain rounded-full bg-bad"
          />
        )}
      </div>
      <p className="label-micro flex items-center gap-2 text-muted-foreground" aria-live="polite">
        <span aria-hidden="true" className={cn('size-1.5 rounded-full', open ? 'bg-bad animate-blink' : 'bg-idle')} />
        {busy ? 'Sendet …' : open ? 'Scharf' : 'Gesichert'}
      </p>
    </div>
  );
}
