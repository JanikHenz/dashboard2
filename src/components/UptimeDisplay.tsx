import { Fragment } from 'react';
import { cn } from '@/lib/utils';

type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

const DIGIT_PATTERNS: Record<number, Segment[]> = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'd', 'e', 'g'],
  3: ['a', 'b', 'c', 'd', 'g'],
  4: ['b', 'c', 'f', 'g'],
  5: ['a', 'c', 'd', 'f', 'g'],
  6: ['a', 'c', 'd', 'e', 'f', 'g'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g']
};

const THICKNESS = 3.6;
const GAP = 0.9;
const X_LEFT = 3;
const X_RIGHT = 17;
const Y_TOP = 3;
const Y_MID = 19;
const Y_BOTTOM = 35;

function horizontal(cy: number) {
  const x1 = X_LEFT + GAP;
  const x2 = X_RIGHT - GAP;
  const h = THICKNESS / 2;
  return `${x1},${cy} ${x1 + h},${cy - h} ${x2 - h},${cy - h} ${x2},${cy} ${x2 - h},${cy + h} ${x1 + h},${cy + h}`;
}

function vertical(cx: number, y1: number, y2: number) {
  const top = y1 + GAP;
  const bottom = y2 - GAP;
  const h = THICKNESS / 2;
  return `${cx},${top} ${cx + h},${top + h} ${cx + h},${bottom - h} ${cx},${bottom} ${cx - h},${bottom - h} ${cx - h},${top + h}`;
}

const SEGMENTS: Record<Segment, string> = {
  a: horizontal(Y_TOP),
  g: horizontal(Y_MID),
  d: horizontal(Y_BOTTOM),
  f: vertical(X_LEFT, Y_TOP, Y_MID),
  b: vertical(X_RIGHT, Y_TOP, Y_MID),
  e: vertical(X_LEFT, Y_MID, Y_BOTTOM),
  c: vertical(X_RIGHT, Y_MID, Y_BOTTOM)
};

function Digit({ value }: { value: number }) {
  const lit = DIGIT_PATTERNS[value] ?? DIGIT_PATTERNS[0];
  return (
    <svg viewBox="0 0 20 38" className="h-full w-auto -skew-x-6 overflow-visible" aria-hidden="true">
      {(Object.keys(SEGMENTS) as Segment[]).map((segment) => (
        <polygon
          key={segment}
          points={SEGMENTS[segment]}
          className={cn(
            'transition-[fill,opacity] duration-300',
            lit.includes(segment) ? 'fill-signal drop-shadow-[0_0_3px_var(--signal)]' : 'fill-screen-foreground opacity-[0.07]'
          )}
        />
      ))}
    </svg>
  );
}

const MAX_DAYS = 99;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

function splitUptime(uptimeMs: number) {
  const totalMinutes = Math.max(0, Math.floor(uptimeMs / MS_PER_MINUTE));
  return {
    days: Math.min(MAX_DAYS, Math.floor(totalMinutes / MINUTES_PER_DAY)),
    hours: Math.floor((totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR),
    minutes: totalMinutes % MINUTES_PER_HOUR
  };
}

const GROUPS = [
  { key: 'days', label: 'Tage' },
  { key: 'hours', label: 'Std' },
  { key: 'minutes', label: 'Min' }
] as const;

/** Siebensegment-Anzeige für Tage, Stunden und Minuten. Nicht leuchtende Segmente bleiben schwach sichtbar. */
export function UptimeDisplay({ uptimeMs, className }: { uptimeMs: number; className?: string }) {
  const parts = splitUptime(Number.isFinite(uptimeMs) ? uptimeMs : 0);

  return (
    <div className={cn('flex items-center rounded-md bg-screen px-3 py-2 text-screen-foreground shadow-[inset_0_2px_6px_rgb(0_0_0/0.6)]', className)}>
      <span className="sr-only">
        Uptime {parts.days} Tage, {parts.hours} Stunden, {parts.minutes} Minuten
      </span>
      <div className="flex items-end gap-1.5" aria-hidden="true">
        {GROUPS.map((group, index) => {
          const [tens, ones] = String(parts[group.key]).padStart(2, '0');
          return (
            <Fragment key={group.key}>
              {index > 0 && (
                <span className="mb-5 flex h-6 flex-col justify-around">
                  <span className="size-1 rounded-full bg-signal/80" />
                  <span className="size-1 rounded-full bg-signal/80" />
                </span>
              )}
              <span className="flex flex-col items-center gap-1">
                <span className="flex h-8 gap-0.5">
                  <Digit value={Number(tens)} />
                  <Digit value={Number(ones)} />
                </span>
                <span className="label-micro text-screen-muted">{group.label}</span>
              </span>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
