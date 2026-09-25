import { cn } from '@/lib/utils';

const START_DEG = -130;
const SWEEP_DEG = 260;
const CX = 100;
const CY = 100;
const TICK_OUTER = 86;
const WARN_FROM = 70;
const BAD_FROM = 85;

function polar(radius: number, percent: number) {
  const angle = ((START_DEG + (percent / 100) * SWEEP_DEG) * Math.PI) / 180;
  return { x: CX + radius * Math.sin(angle), y: CY - radius * Math.cos(angle) };
}

function arc(radius: number, from: number, to: number) {
  const start = polar(radius, from);
  const end = polar(radius, to);
  const large = ((to - from) / 100) * SWEEP_DEG > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
}

const TICKS = Array.from({ length: 51 }, (_, index) => index * 2);

/** Rundinstrument für die CPU-Last. Die Nadel ist die einzige Signalfarbe. */
export function Gauge({ value, label = 'CPU', className }: { value: number | null; label?: string; className?: string }) {
  const clamped = value === null || !Number.isFinite(value) ? null : Math.min(100, Math.max(0, value));
  const rounded = clamped === null ? null : Math.round(clamped);
  const angle = START_DEG + ((clamped ?? 0) / 100) * SWEEP_DEG;

  return (
    <div
      role="meter"
      aria-label={`${label}-Auslastung`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rounded ?? 0}
      aria-valuetext={rounded === null ? 'keine Daten' : `${rounded} Prozent`}
      className={cn('relative w-full max-w-60', className)}
    >
      <svg viewBox="0 0 200 172" className="w-full overflow-visible" aria-hidden="true">
        <path d={arc(TICK_OUTER + 5, 0, 100)} className="fill-none stroke-border" strokeWidth={1} />
        <path d={arc(TICK_OUTER + 5, WARN_FROM, BAD_FROM)} className="fill-none stroke-warn" strokeWidth={4} />
        <path d={arc(TICK_OUTER + 5, BAD_FROM, 100)} className="fill-none stroke-bad" strokeWidth={4} />
        {TICKS.map((tick) => {
          const major = tick % 10 === 0;
          const outer = polar(TICK_OUTER, tick);
          const inner = polar(TICK_OUTER - (major ? 10 : 5), tick);
          return (
            <line
              key={tick}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className={cn(major ? 'stroke-foreground' : 'stroke-muted-foreground/60')}
              strokeWidth={major ? 1.6 : 0.8}
            />
          );
        })}
        {[0, 20, 40, 60, 80, 100].map((tick) => {
          const position = polar(TICK_OUTER - 20, tick);
          return (
            <text
              key={tick}
              x={position.x}
              y={position.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {tick}
            </text>
          );
        })}
        <g
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${CY}px` }}
          className="transition-transform duration-700 ease-snap"
        >
          <line x1={CX} y1={CY + 12} x2={CX} y2={CY - 78} className="stroke-signal" strokeWidth={2.5} strokeLinecap="round" />
        </g>
        <circle cx={CX} cy={CY} r={7} className="fill-foreground" />
        <circle cx={CX} cy={CY} r={2.5} className="fill-signal" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center" aria-hidden="true">
        <span className="font-wide text-3xl leading-none font-semibold tabular-nums">
          {rounded ?? '--'}
          <span className="ml-0.5 text-base text-muted-foreground">%</span>
        </span>
        <span className="label-micro mt-1 text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
