import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { formatMetric, timeFormat, type ChartPoint } from '@/lib/format';
import { cn } from '@/lib/utils';

const PADDING = { top: 10, right: 12, bottom: 24, left: 40 };
const Y_TICKS = 4;
const X_TICKS = 4;

function niceStep(raw: number) {
  if (raw <= 0 || !Number.isFinite(raw)) return 1;
  const exponent = Math.floor(Math.log10(raw));
  const fraction = raw / 10 ** exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}

function yDomain(points: ChartPoint[], unit: string) {
  const values = points.map(([, value]) => value);
  const max = Math.max(...values);
  if (unit === '%') return { min: 0, max: 100, step: 25 };
  const step = niceStep((max * 1.15 || 1) / Y_TICKS);
  return { min: 0, max: step * Y_TICKS, step };
}

function nearestIndex(points: ChartPoint[], timestamp: number) {
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (points[mid][0] < timestamp) low = mid;
    else high = mid;
  }
  return Math.abs(points[low][0] - timestamp) <= Math.abs(points[high][0] - timestamp) ? low : high;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

type LineChartProps = { points: ChartPoint[]; unit: string; digits: number; label: string; className?: string };

/** Liniendiagramm mit schraffierter Fläche, Fadenkreuz und Live-Punkt am Ende der Linie. */
export function LineChart({ points, unit, digits, label, className }: LineChartProps) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const patternId = `hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const geometry = useMemo(() => {
    if (points.length < 2 || width === 0 || height === 0) return null;
    const innerWidth = width - PADDING.left - PADDING.right;
    const innerHeight = height - PADDING.top - PADDING.bottom;
    const t0 = points[0][0];
    const t1 = points.at(-1)![0];
    const domain = yDomain(points, unit);
    const x = (timestamp: number) => PADDING.left + ((timestamp - t0) / (t1 - t0 || 1)) * innerWidth;
    const y = (value: number) =>
      PADDING.top + innerHeight - ((Math.min(domain.max, Math.max(domain.min, value)) - domain.min) / (domain.max - domain.min)) * innerHeight;

    const line = points.map(([timestamp, value], index) => `${index ? 'L' : 'M'}${x(timestamp).toFixed(1)},${y(value).toFixed(1)}`).join('');
    const bottom = PADDING.top + innerHeight;
    const area = `${line}L${x(t1).toFixed(1)},${bottom}L${x(t0).toFixed(1)},${bottom}Z`;
    const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, index) => domain.min + index * domain.step);
    const xTicks = Array.from({ length: X_TICKS }, (_, index) => t0 + ((index + 0.5) / X_TICKS) * (t1 - t0));

    return { x, y, line, area, yTicks, xTicks, t0, t1, bottom, innerWidth };
  }, [points, width, height, unit]);

  const values = points.map(([, value]) => value);
  const summary = points.length
    ? `${label}, aktuell ${formatMetric(values.at(-1), { unit, digits })}, Minimum ${formatMetric(Math.min(...values), { unit, digits })}, Maximum ${formatMetric(Math.max(...values), { unit, digits })}`
    : `${label}, keine Daten`;

  function handlePointer(event: PointerEvent<SVGSVGElement>) {
    if (!geometry) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - PADDING.left) / geometry.innerWidth;
    const timestamp = geometry.t0 + Math.min(1, Math.max(0, ratio)) * (geometry.t1 - geometry.t0);
    setHover(nearestIndex(points, timestamp));
  }

  const hovered = hover !== null && geometry ? points[hover] : null;
  const last = points.at(-1);

  return (
    <div ref={ref} className={cn('relative h-full min-h-40 w-full', className)}>
      {geometry && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={summary}
          className="block touch-pan-y select-none"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <line x1="0" y1="0" x2="0" y2="6" className="stroke-foreground/25" strokeWidth="1" />
            </pattern>
          </defs>
          {geometry.yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={geometry.y(tick)}
                y2={geometry.y(tick)}
                className="stroke-border"
                strokeDasharray={tick === 0 ? undefined : '2 4'}
              />
              <text x={PADDING.left - 8} y={geometry.y(tick)} textAnchor="end" dominantBaseline="central" className="fill-muted-foreground font-mono text-xs">
                {formatMetric(tick, { digits: 0 })}
              </text>
            </g>
          ))}
          {geometry.xTicks.map((tick) => (
            <text key={tick} x={geometry.x(tick)} y={height - 6} textAnchor="middle" className="fill-muted-foreground font-mono text-xs">
              {timeFormat.format(tick)}
            </text>
          ))}
          <path d={geometry.area} fill={`url(#${patternId})`} />
          <path d={geometry.line} className="fill-none stroke-foreground" strokeWidth={1.6} strokeLinejoin="round" />
          {last && !hovered && (
            <g>
              <circle cx={geometry.x(last[0])} cy={geometry.y(last[1])} r={6} className="animate-ping-soft fill-signal/40 [transform-box:fill-box] [transform-origin:center]" />
              <circle cx={geometry.x(last[0])} cy={geometry.y(last[1])} r={3.5} className="fill-signal" />
            </g>
          )}
          {hovered && (
            <g>
              <line x1={geometry.x(hovered[0])} x2={geometry.x(hovered[0])} y1={PADDING.top} y2={geometry.bottom} className="stroke-foreground" strokeWidth={1} />
              <circle cx={geometry.x(hovered[0])} cy={geometry.y(hovered[1])} r={4} className="fill-card stroke-foreground" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {hovered && geometry && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-sm bg-foreground px-2 py-1 font-mono text-xs whitespace-nowrap text-background tabular-nums"
          style={{ left: Math.min(width - 60, Math.max(60, geometry.x(hovered[0]))) }}
        >
          {timeFormat.format(hovered[0])} · {formatMetric(hovered[1], { unit, digits })}
        </div>
      )}
    </div>
  );
}

/** Mini-Verlauf ohne Achsen für die Kennzahlen. */
export function Sparkline({ points, className }: { points: ChartPoint[]; className?: string }) {
  const path = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map(([, value]) => value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const t0 = points[0][0];
    const t1 = points.at(-1)![0];
    return points
      .map(([timestamp, value], index) => {
        const x = ((timestamp - t0) / (t1 - t0 || 1)) * 100;
        const y = 22 - ((value - min) / range) * 20;
        return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join('');
  }, [points]);

  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" className={cn('h-6 w-full overflow-visible', className)}>
      {path ? (
        <path d={path} className="fill-none stroke-foreground/70" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
      ) : (
        <line x1="0" x2="100" y1="12" y2="12" className="stroke-border" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}
