import type { ReactNode } from 'react';
import { Gauge } from '@/components/Gauge';
import { LineChart, Sparkline } from '@/components/charts';
import { clockFormat, formatMetric, formatNumber, latestValue, toChartPoints } from '@/lib/format';
import type { MetricKey, MonitoringMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FingerprintScanner } from './FingerprintScanner';
import { SafetySwitch } from './SafetySwitch';

type TileConfig = { key: MetricKey; label: string; unit: string; digits: number; wide?: boolean };

const STAT_TILES: TileConfig[] = [
  { key: 'cpu', label: 'CPU', unit: '%', digits: 0 },
  { key: 'memory', label: 'RAM', unit: '%', digits: 0 },
  { key: 'gpu', label: 'GPU', unit: '%', digits: 0 },
  { key: 'gpuTemp', label: 'GPU-Temp', unit: '°C', digits: 0 },
  { key: 'diskUsage', label: 'Disk', unit: '%', digits: 0 },
  { key: 'nodesUp', label: 'Nodes', unit: '', digits: 0 },
  { key: 'networkRx', label: 'Netzwerk', unit: 'Mbit/s', digits: 1, wide: true }
];

const CHARTS: { key: MetricKey; title: string; unit: string; digits: number }[] = [
  { key: 'cpu', title: 'CPU-Auslastung', unit: '%', digits: 0 },
  { key: 'memory', title: 'RAM-Auslastung', unit: '%', digits: 0 },
  { key: 'networkRx', title: 'Netzwerk (Empfang)', unit: 'Mbit/s', digits: 1 },
  { key: 'powerW', title: 'Stromverbrauch', unit: 'W', digits: 0 }
];

const GAUGE_SERIES_KEY: MetricKey = 'cpu';
const ERROR_MESSAGE = 'Monitoring ist gerade nicht erreichbar';
const WAITING_MESSAGE = 'Warte auf Daten …';
const EMPTY_MESSAGE = 'Keine Daten im Zeitraum';

function levelClass(value: number | null) {
  if (value === null) return 'bg-transparent';
  if (value >= 85) return 'bg-bad';
  if (value >= 70) return 'bg-warn';
  return 'bg-foreground';
}

function Module({ index, title, children, className }: { index: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn('flex flex-col rounded-md border border-border bg-card', className)}>
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="label-micro text-muted-foreground">{index}</span>
        <h3 className="label-micro">{title}</h3>
      </header>
      <div className="flex flex-1 items-center justify-center p-4">{children}</div>
    </section>
  );
}

type SystemViewProps = {
  monitoring: MonitoringMessage | null;
  unlocked: boolean;
  scannerCalling: boolean;
  onScannerCallingDone: () => void;
  onUnlocked: () => void;
  onRequestRefresh: () => void;
};

export function SystemView({ monitoring, unlocked, scannerCalling, onScannerCallingDone, onUnlocked, onRequestRefresh }: SystemViewProps) {
  const hasError = Boolean(monitoring?.error);
  const series = !hasError && monitoring?.series && typeof monitoring.series === 'object' ? monitoring.series : {};
  const gaugeValue = hasError ? null : latestValue(series[GAUGE_SERIES_KEY]);
  const updatedAt = hasError ? undefined : (monitoring?.end ?? series.cpu?.at(-1)?.timestamp);

  return (
    <section aria-labelledby="system-title" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="label-micro text-muted-foreground">02 / Boring Stuff</p>
          <h2 id="system-title" className="font-wide text-4xl leading-none font-semibold tracking-tight md:text-5xl">
            System
          </h2>
        </div>
        <p className="label-micro text-muted-foreground" aria-live="polite">
          {hasError ? (
            <span className="text-bad">{ERROR_MESSAGE}</span>
          ) : updatedAt ? (
            <>Letzte Stunde · Stand {clockFormat.format(updatedAt)}</>
          ) : (
            WAITING_MESSAGE
          )}
        </p>
      </div>

      <dl className="grid grid-cols-2 overflow-hidden rounded-md border-t border-l border-border bg-card/70 sm:grid-cols-4 xl:grid-cols-7">
        {STAT_TILES.map((tile) => {
          const value = latestValue(series[tile.key]);
          const isPercent = tile.unit === '%';
          return (
            <div key={tile.key} className={cn('flex min-w-0 flex-col gap-2 border-r border-b border-border p-4', tile.wide && 'col-span-2 xl:col-span-1')}>
              <dt className="label-micro flex justify-between gap-2 text-muted-foreground">
                {tile.label}
                {tile.unit && <span aria-hidden="true">{tile.unit}</span>}
              </dt>
              <dd className="flex flex-col gap-2">
                <span className="font-wide text-3xl leading-none font-semibold tracking-tight tabular-nums">
                  {formatNumber(value, tile.digits)}
                  <span className="sr-only"> {tile.unit}</span>
                </span>
                <Sparkline points={toChartPoints(series[tile.key])} />
                <span aria-hidden="true" className={cn('block h-1 rounded-full bg-well', !isPercent && 'invisible')}>
                  <span
                    className={cn('block h-full rounded-full transition-[width] duration-700 ease-snap', levelClass(value))}
                    style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
                  />
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid grid-cols-2 content-start gap-3 lg:col-span-4">
          <Module index="01" title="CPU-Last" className="col-span-2">
            <Gauge value={gaugeValue} />
          </Module>
          <Module index="02" title="Zugang">
            <FingerprintScanner unlocked={unlocked} calling={scannerCalling} onCallingDone={onScannerCallingDone} onUnlocked={onUnlocked} />
          </Module>
          <Module index="03" title="Hard-Shutdown">
            <SafetySwitch onRequestRefresh={onRequestRefresh} />
          </Module>
        </div>

        <section aria-label="Verlauf der letzten Stunde" className="grid content-start gap-x-6 gap-y-8 sm:grid-cols-2 lg:col-span-8">
          {CHARTS.map((chart) => {
            const points = toChartPoints(series[chart.key]);
            const message = hasError ? ERROR_MESSAGE : !monitoring ? WAITING_MESSAGE : points.length < 2 ? EMPTY_MESSAGE : null;
            return (
              <figure key={chart.key} className="flex min-w-0 flex-col border-t-2 border-foreground pt-3">
                <figcaption className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{chart.title}</span>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    {formatMetric(latestValue(series[chart.key]), { unit: chart.unit, digits: chart.digits })}
                  </span>
                </figcaption>
                <div className="mt-3 h-48 md:h-56" data-no-swipe>
                  {message ? (
                    <p className="grid h-full place-items-center rounded-md border border-dashed border-border font-mono text-sm text-muted-foreground">
                      {message}
                    </p>
                  ) : (
                    <LineChart points={points} unit={chart.unit} digits={chart.digits} label={chart.title} />
                  )}
                </div>
              </figure>
            );
          })}
        </section>
      </div>
    </section>
  );
}
