import { ArrowLeftIcon, RefreshCwIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDialogs } from '@/components/DialogProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button, buttonVariants } from '@/components/ui/button';
import { requestJson } from '@/lib/api';
import { dashboardUrl } from '@/lib/detailAccess';
import { clockFormat } from '@/lib/format';
import { deploymentKey } from '@/lib/k8s';
import { formatCpu, formatMemory, formatPair, parseCpuMillicores, parseMemoryMi } from '@/lib/resources';
import type { App, Deployment, PodLog } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FaderChannel } from './FaderChannel';
import { PodList } from './PodList';
import { PodLogs } from './PodLogs';

const LOG_TAIL_LINES = 200;
const REFRESH_AFTER_CHANGE_MS = 1400;
const AUTO_REFRESH_MS = 10_000;
const MIN_REPLICA_SLIDER_MAX = 12;
const REPLICA_HEADROOM = 4;
const EMPTY_READING = '-- / --';

type Target = { namespace: string; deployment: string };
type Status = { text: string; tone?: 'error' };

function DetailHeader({ title, subtitle, status }: { title: string; subtitle: string; status: Status | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 md:px-6 lg:px-8">
        <a href={dashboardUrl()} className={buttonVariants({ variant: 'outline' })}>
          <ArrowLeftIcon aria-hidden="true" />
          Zurück
        </a>
        <div className="order-last flex w-full min-w-0 flex-col md:order-none md:w-auto md:flex-1">
          <p className="label-micro text-muted-foreground">Deployment</p>
          <h1 className="truncate font-wide text-2xl leading-tight font-semibold tracking-tight md:text-3xl">{title}</h1>
          {subtitle && <p className="truncate font-mono text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <p role="status" className={cn('label-micro ml-auto md:ml-0', status?.tone === 'error' ? 'text-bad' : 'text-muted-foreground')}>
          {status?.text}
        </p>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function MissingTarget() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DetailHeader title="Keine App gewählt" subtitle="Öffne die Detailseite über eine App im Dashboard." status={null} />
    </div>
  );
}

/**
 * Steuert ein Deployment mit Fadern für CPU, Memory und Replicas,
 * der Pod-Liste und den Pod-Logs.
 */
export function DetailApp({ target }: { target: Target }) {
  const dialogs = useDialogs();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Status | null>({ text: 'Lade Daten …' });
  const [appName, setAppName] = useState(target.deployment);
  const [logs, setLogs] = useState<PodLog[] | null>(null);
  const [logMessage, setLogMessage] = useState<Status | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const loadingLogsRef = useRef(false);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const deployments = await requestJson<Record<string, Deployment>>('/api/k8s/deployments');
      const next = deployments?.[deploymentKey(target.namespace, target.deployment)] ?? null;
      if (!next || next.error) {
        setUnavailable(true);
        setStatus({ text: 'Deployment nicht gefunden', tone: 'error' });
        return;
      }
      setUnavailable(false);
      setDeployment(next);
      if (!busyRef.current) setStatus({ text: `Stand ${clockFormat.format(new Date())}` });
    } catch (error) {
      setUnavailable(true);
      setStatus({ text: (error as Error).message, tone: 'error' });
    } finally {
      setLoaded(true);
    }
  }, [target]);

  const loadLogs = useCallback(async () => {
    if (loadingLogsRef.current) return;
    loadingLogsRef.current = true;
    setLoadingLogs(true);
    try {
      const query = new URLSearchParams({ ...target, tailLines: String(LOG_TAIL_LINES) });
      const payload = await requestJson<{ pods?: PodLog[] }>(`/api/k8s/pod-logs?${query}`);
      setLogs(Array.isArray(payload?.pods) ? payload.pods : []);
      setLogMessage(null);
    } catch (error) {
      setLogMessage({ text: `Die Logs konnten nicht geladen werden. ${(error as Error).message}`, tone: 'error' });
    } finally {
      loadingLogsRef.current = false;
      setLoadingLogs(false);
    }
  }, [target]);

  useEffect(() => {
    document.title = `${target.deployment} · Rack`;
    requestJson<App[]>('/api/apps')
      .then((apps) => {
        const name = Array.isArray(apps)
          ? apps.find((app) => app.namespace === target.namespace && app.deployment === target.deployment)?.name
          : null;
        if (!name) return;
        setAppName(name);
        document.title = `${name} · Rack`;
      })
      .catch(() => {
        // Ohne Anzeigenamen bleibt der Deployment-Name stehen.
      });
    refresh();
    loadLogs();
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [target, refresh, loadLogs]);

  const saveChange = useCallback(
    async (request: () => Promise<unknown>, successText: string) => {
      busyRef.current = true;
      setStatus({ text: 'Speichere …' });
      try {
        await request();
        setStatus({ text: successText });
        window.setTimeout(refresh, REFRESH_AFTER_CHANGE_MS);
        return true;
      } catch (error) {
        setStatus({ text: 'Speichern fehlgeschlagen', tone: 'error' });
        await dialogs.notice({ title: 'Speichern fehlgeschlagen', message: (error as Error).message, tone: 'danger' });
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [dialogs, refresh]
  );

  const updateRequests = useCallback(
    (requests: { cpuRequest?: string; memoryRequest?: string }) =>
      requestJson('/api/k8s/resources', { method: 'POST', body: { ...target, ...requests } }),
    [target]
  );

  const commitCpu = useCallback(
    (value: number) => saveChange(() => updateRequests({ cpuRequest: formatCpu(value) }), 'CPU-Request gespeichert'),
    [saveChange, updateRequests]
  );
  const commitMemory = useCallback(
    (value: number) => saveChange(() => updateRequests({ memoryRequest: formatMemory(value) }), 'Memory-Request gespeichert'),
    [saveChange, updateRequests]
  );
  const commitReplicas = useCallback(
    async (replicas: number) => {
      if (replicas === 0) {
        const confirmed = await dialogs.confirm({
          title: 'App stoppen?',
          message: `Mit 0 Replicas läuft ${appName} nicht mehr, bis du wieder hochskalierst.`,
          confirmLabel: 'Stoppen',
          tone: 'danger'
        });
        if (!confirmed) return false;
      }
      return saveChange(
        () => requestJson('/api/k8s/scale', { method: 'POST', body: { ...target, replicas } }),
        `Auf ${replicas} Replicas skaliert`
      );
    },
    [appName, dialogs, saveChange, target]
  );

  const live = deployment && !unavailable ? deployment : null;
  const ready = live?.readyReplicas ?? 0;
  const total = live?.replicas ?? 0;
  const desired = live?.desiredReplicas ?? total;
  const replicaMax = Math.max(MIN_REPLICA_SLIDER_MAX, desired + REPLICA_HEADROOM, total + 2);
  const podMessage = unavailable ? 'Keine Pod-Daten verfügbar.' : null;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <DetailHeader title={appName} subtitle={`${target.namespace} / ${target.deployment}`} status={status} />

      <main
        aria-busy={!loaded}
        className="mx-auto grid w-full max-w-[1600px] flex-1 gap-6 px-4 py-6 md:px-6 lg:min-h-0 lg:grid-cols-12 lg:px-8"
      >
        <section aria-labelledby="controls-title" className="flex min-h-0 flex-col gap-6 lg:col-span-5">
          <h2 id="controls-title" className="sr-only">
            Ressourcen und Replicas
          </h2>
          <div className="grid grid-cols-3 rounded-md border border-border bg-card">
            <FaderChannel
              index="CH 1"
              title="CPU"
              min={50}
              max={8000}
              step={50}
              serverValue={live ? parseCpuMillicores(live.cpuRequest) : null}
              reading={live ? formatPair(live.cpuRequest, live.cpuLimit) : EMPTY_READING}
              readingUnit="Req / Limit"
              format={formatCpu}
              onCommit={commitCpu}
            />
            <FaderChannel
              index="CH 2"
              title="Memory"
              min={64}
              max={16384}
              step={64}
              serverValue={live ? parseMemoryMi(live.memoryRequest) : null}
              reading={live ? formatPair(live.memoryRequest, live.memoryLimit) : EMPTY_READING}
              readingUnit="Req / Limit"
              format={formatMemory}
              onCommit={commitMemory}
            />
            <FaderChannel
              index="CH 3"
              title="Replicas"
              min={0}
              max={replicaMax}
              step={1}
              serverValue={live ? desired : null}
              reading={live ? formatPair(ready, total) : EMPTY_READING}
              readingUnit="Bereit / Ges."
              format={String}
              onCommit={commitReplicas}
            />
          </div>

          <section aria-labelledby="pods-title" className="flex min-h-0 flex-col rounded-md border border-border bg-card lg:flex-1">
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 id="pods-title" className="label-micro">
                Pods und Nodes
              </h2>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {live?.podPlacements ? String(live.podPlacements.length).padStart(2, '0') : '--'}
              </span>
            </header>
            <div className="scrollbar-thin min-h-0 overflow-auto lg:flex-1">
              <PodList pods={live ? (live.podPlacements ?? []) : null} message={podMessage} />
            </div>
          </section>
        </section>

        <section aria-labelledby="logs-title" className="flex min-h-0 flex-col rounded-md border border-border bg-card lg:col-span-7">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <div className="flex items-baseline gap-3">
              <h2 id="logs-title" className="font-wide text-lg font-semibold tracking-tight">
                Pod-Logs
              </h2>
              <span className="label-micro text-muted-foreground">Letzte {LOG_TAIL_LINES} Zeilen</span>
            </div>
            <Button variant="outline" size="sm" onClick={loadLogs} disabled={loadingLogs}>
              <RefreshCwIcon aria-hidden="true" className={cn(loadingLogs && 'animate-spin')} />
              {loadingLogs ? 'Lädt …' : 'Aktualisieren'}
            </Button>
          </header>
          <div aria-busy={loadingLogs} className="scrollbar-thin min-h-0 overflow-auto lg:flex-1">
            <PodLogs pods={logs} message={logMessage} />
          </div>
        </section>
      </main>
    </div>
  );
}
