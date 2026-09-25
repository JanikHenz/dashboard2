import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const COMMIT_DELAY_MS = 500;
const SCALE_MARKS = 11;

type FaderChannelProps = {
  index: string;
  title: string;
  min: number;
  max: number;
  step: number;
  serverValue: number | null;
  reading: string;
  readingUnit: string;
  format: (value: number) => string;
  onCommit: (value: number, previous: number) => Promise<boolean>;
};

/**
 * Vertikaler Kanalzug im Mischpult-Stil.
 * Änderungen werden kurz gesammelt und dann einmal gespeichert, damit Pfeiltasten nicht
 * pro Schritt eine Anfrage auslösen. Während der Bedienung überschreiben Server-Updates nichts.
 */
export function FaderChannel({ index, title, min, max, step, serverValue, reading, readingUnit, format, onCommit }: FaderChannelProps) {
  const titleId = useId();
  const disabled = serverValue === null;
  const [value, setValue] = useState(serverValue ?? min);
  const [saving, setSaving] = useState(false);
  const committed = useRef(serverValue ?? min);
  const commitTimer = useRef<number | null>(null);
  const interacting = useRef(false);
  const savingRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (serverValue === null) return;
    if (interacting.current || savingRef.current || commitTimer.current !== null) return;
    committed.current = serverValue;
    setValue(serverValue);
  }, [serverValue]);

  useEffect(() => () => {
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
  }, []);

  const commit = useCallback(async () => {
    const next = valueRef.current;
    if (next === committed.current) return;
    savingRef.current = true;
    setSaving(true);
    const saved = await onCommit(next, committed.current);
    savingRef.current = false;
    setSaving(false);
    if (saved) committed.current = next;
    else setValue(committed.current);
  }, [onCommit]);

  const scheduleCommit = useCallback(() => {
    interacting.current = false;
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = null;
      commit();
    }, COMMIT_DELAY_MS);
  }, [commit]);

  const label = format(value);

  return (
    <section
      aria-labelledby={titleId}
      data-no-swipe
      className={cn('relative flex min-w-0 flex-col items-center gap-3 border-r border-border px-2 py-4 last:border-r-0 sm:px-4', saving && 'is-busy')}
    >
      <header className="flex w-full flex-col items-center gap-1">
        <span className="label-micro text-muted-foreground">{index}</span>
        <h3 id={titleId} className="font-wide text-base font-semibold tracking-tight uppercase">
          {title}
        </h3>
      </header>

      <p className="flex w-full flex-col items-center rounded-sm bg-screen px-2 py-2 text-center text-screen-foreground shadow-[inset_0_2px_5px_rgb(0_0_0/0.6)]">
        <span className="font-mono text-xs whitespace-nowrap tabular-nums sm:text-sm">{reading}</span>
        <span className="label-micro mt-0.5 text-screen-muted">{readingUnit}</span>
      </p>

      <div className="relative flex h-56 w-full justify-center md:h-64 lg:h-[min(38vh,20rem)]">
        <div aria-hidden="true" className="absolute inset-y-3.5 left-1/2 flex -translate-x-[3.25rem] flex-col justify-between">
          {Array.from({ length: SCALE_MARKS }, (_, mark) => (
            <span key={mark} className={cn('h-px bg-muted-foreground/60', mark % 5 === 0 ? 'w-3' : 'w-1.5')} />
          ))}
        </div>
        <div aria-hidden="true" className="absolute inset-y-3.5 left-1/2 flex translate-x-[2.5rem] flex-col items-end justify-between">
          {Array.from({ length: SCALE_MARKS }, (_, mark) => (
            <span key={mark} className={cn('h-px bg-muted-foreground/60', mark % 5 === 0 ? 'w-3' : 'w-1.5')} />
          ))}
        </div>
        <Slider
          orientation="vertical"
          min={min}
          max={max}
          step={step}
          value={[value]}
          disabled={disabled}
          thumbLabel={title}
          aria-labelledby={titleId}
          onPointerDown={() => {
            interacting.current = true;
          }}
          onValueChange={([next]) => {
            interacting.current = true;
            setValue(next);
          }}
          onValueCommit={scheduleCommit}
          className="h-full"
        />
      </div>

      <output
        aria-live="polite"
        className={cn('font-wide text-2xl leading-none font-semibold tabular-nums transition-colors', saving && 'text-signal')}
      >
        {disabled ? '--' : label}
      </output>
      <span className="label-micro -mt-1 flex h-4 items-center gap-1.5 text-signal" aria-hidden={!saving}>
        {saving && (
          <>
            <span className="size-1.5 animate-blink rounded-full bg-signal" /> Speichert
          </>
        )}
      </span>
    </section>
  );
}
