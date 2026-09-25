import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Led } from '@/components/Led';
import { deploymentKey, deploymentState } from '@/lib/k8s';
import type { App, AppsStateMessage, LedState } from '@/lib/types';
import { AppModule, AppModuleSkeleton } from './AppModule';

const SKELETON_COUNT = 8;
const SUMMARY: { state: LedState; label: string }[] = [
  { state: 'online', label: 'bereit' },
  { state: 'pending', label: 'startet' },
  { state: 'idle', label: 'gestoppt' },
  { state: 'offline', label: 'Fehler' }
];

type AppsViewProps = { appsState: AppsStateMessage | null; locked: boolean; onOpenDetails: (app: App) => void };

function Message({ children, tone }: { children: string; tone?: 'error' }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={`rounded-md border border-dashed px-4 py-10 text-center font-mono text-sm ${tone === 'error' ? 'border-bad/60 text-bad' : 'border-border text-muted-foreground'}`}
    >
      {children}
    </p>
  );
}

export function AppsView({ appsState, locked, onOpenDetails }: AppsViewProps) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const apps = useMemo(() => (Array.isArray(appsState?.apps) ? appsState.apps : []), [appsState]);
  const deployments = appsState?.deployments ?? {};

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key !== '/' || target.closest('input, textarea, [contenteditable]')) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => {
    const result: Record<LedState, number> = { online: 0, pending: 0, idle: 0, offline: 0 };
    apps.forEach((app) => {
      result[deploymentState(deployments[deploymentKey(app.namespace, app.deployment)])] += 1;
    });
    return result;
  }, [apps, deployments]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? apps.filter((app) => [app.name, app.namespace, app.deployment].some((value) => value.toLowerCase().includes(needle)))
      : apps;
    const byNamespace = new Map<string, App[]>();
    filtered.forEach((app) => {
      const list = byNamespace.get(app.namespace) ?? [];
      list.push(app);
      byNamespace.set(app.namespace, list);
    });
    return [...byNamespace.entries()];
  }, [apps, query]);

  let body;
  if (!appsState) {
    body = (
      <ul aria-busy="true" aria-label="Apps werden geladen" className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <AppModuleSkeleton key={index} />
        ))}
      </ul>
    );
  } else if (apps.length === 0) {
    if (appsState.k8sUnavailable) body = <Message tone="error">Kubernetes ist nicht erreichbar.</Message>;
    else if (appsState.error) body = <Message tone="error">Die Apps konnten nicht geladen werden.</Message>;
    else body = <Message>Noch keine Apps eingetragen.</Message>;
  } else if (groups.length === 0) {
    body = <Message>{`Keine App passt zu „${query.trim()}“.`}</Message>;
  } else {
    body = (
      <div className="flex flex-col gap-8">
        {groups.map(([namespace, list]) => (
          <section key={namespace} aria-labelledby={`ns-${namespace}`}>
            <h3 id={`ns-${namespace}`} className="mb-3 flex items-center gap-3">
              <span className="label-micro text-muted-foreground">NS</span>
              <span className="font-mono text-sm font-semibold">{namespace}</span>
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {String(list.length).padStart(2, '0')}
                <span className="sr-only"> Apps</span>
              </span>
            </h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
              {list.map((app) => (
                <AppModule
                  key={deploymentKey(app.namespace, app.deployment)}
                  app={app}
                  deployment={deployments[deploymentKey(app.namespace, app.deployment)]}
                  locked={locked}
                  onOpenDetails={onOpenDetails}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <section aria-labelledby="apps-title" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="label-micro text-muted-foreground">01 / Anwendungen</p>
          <h2 id="apps-title" className="font-wide text-4xl leading-none font-semibold tracking-tight md:text-5xl">
            Apps
            <span className="ml-2 align-top font-mono text-base font-normal text-muted-foreground tabular-nums">
              {apps.length ? String(apps.length).padStart(2, '0') : ''}
            </span>
          </h2>
        </div>

        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-3 sm:w-auto">
          {apps.length > 0 && (
            <ul aria-label="Zustände" className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
              {SUMMARY.map(({ state, label }) => (
                <li key={state} className="flex items-center gap-1.5">
                  <Led state={state} className="size-2" />
                  <span className="text-foreground tabular-nums">{counts[state]}</span> {label}
                </li>
              ))}
            </ul>
          )}
          <label className="relative flex w-full items-center sm:w-64">
            <span className="sr-only">Apps filtern</span>
            <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && setQuery('')}
              placeholder="Filtern"
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full rounded-md border border-input bg-card pr-10 pl-9 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  searchRef.current?.focus();
                }}
                aria-label="Filter leeren"
                className="absolute right-0 grid size-11 place-items-center text-muted-foreground hover:text-foreground"
              >
                <XIcon aria-hidden="true" className="size-4" />
              </button>
            ) : (
              <kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 hidden rounded-sm border border-border px-1.5 font-mono text-xs text-muted-foreground md:block">
                /
              </kbd>
            )}
          </label>
        </div>
      </div>
      {body}
    </section>
  );
}
