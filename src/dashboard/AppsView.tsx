import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Led } from '@/components/Led';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { deploymentKey, deploymentState } from '@/lib/k8s';
import type { App, AppsStateMessage, LedState } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AppModule, AppModuleSkeleton } from './AppModule';

const SKELETON_COUNT = 8;
const SUMMARY: { state: LedState; label: string }[] = [
  { state: 'online', label: 'bereit' },
  { state: 'pending', label: 'startet' },
  { state: 'idle', label: 'gestoppt' },
  { state: 'offline', label: 'Fehler' }
];

export type TypeFilter = 'gui' | 'headless' | 'all';

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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('gui');
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');
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

  const namespaces = useMemo(() => {
    const set = new Set<string>();
    apps.forEach((a) => {
      if (a.namespace) set.add(a.namespace);
    });
    return [...set].sort();
  }, [apps]);

  const countsByType = useMemo(() => {
    let gui = 0;
    let headless = 0;
    apps.forEach((a) => {
      if (a.url) gui += 1;
      else headless += 1;
    });
    return { gui, headless, all: apps.length };
  }, [apps]);

  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      // 1. Typ-Filter: Mit GUI (Standard) / Ohne GUI / Alle
      if (typeFilter === 'gui' && !app.url) return false;
      if (typeFilter === 'headless' && app.url) return false;

      // 2. Namespace-Filter
      if (namespaceFilter !== 'all' && app.namespace !== namespaceFilter) return false;

      // 3. Text-Suche
      const needle = query.trim().toLowerCase();
      if (needle) {
        const matches = [app.name, app.namespace, app.deployment].some((value) =>
          value.toLowerCase().includes(needle)
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [apps, typeFilter, namespaceFilter, query]);

  const counts = useMemo(() => {
    const result: Record<LedState, number> = { online: 0, pending: 0, idle: 0, offline: 0 };
    filteredApps.forEach((app) => {
      result[deploymentState(deployments[deploymentKey(app.namespace, app.deployment)])] += 1;
    });
    return result;
  }, [filteredApps, deployments]);

  const groups = useMemo(() => {
    const byNamespace = new Map<string, App[]>();
    filteredApps.forEach((app) => {
      const list = byNamespace.get(app.namespace) ?? [];
      list.push(app);
      byNamespace.set(app.namespace, list);
    });
    return [...byNamespace.entries()];
  }, [filteredApps]);

  const otherTypeSuggestion = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || filteredApps.length > 0) return null;
    const allMatches = apps.filter((app) =>
      [app.name, app.namespace, app.deployment].some((val) => val.toLowerCase().includes(needle))
    );
    if (allMatches.length === 0) return null;
    const inGui = allMatches.filter((a) => a.url).length;
    const inHeadless = allMatches.filter((a) => !a.url).length;
    if (typeFilter === 'gui' && inHeadless > 0) {
      return { target: 'headless' as TypeFilter, label: 'Ohne GUI', count: inHeadless };
    }
    if (typeFilter === 'headless' && inGui > 0) {
      return { target: 'gui' as TypeFilter, label: 'Mit GUI', count: inGui };
    }
    return null;
  }, [apps, query, filteredApps.length, typeFilter]);

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
    if (otherTypeSuggestion) {
      body = (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-4 py-10 text-center font-mono text-sm text-muted-foreground">
          <p>{`Keine App im Filter „${typeFilter === 'gui' ? 'Mit GUI' : 'Ohne GUI'}“ passt zu „${query.trim()}“.`}</p>
          <button
            type="button"
            onClick={() => setTypeFilter(otherTypeSuggestion.target)}
            className="label-micro rounded border border-signal bg-signal/10 px-3 py-1.5 text-xs text-signal transition-colors hover:bg-signal/20"
          >
            {`${otherTypeSuggestion.count} Treffer in „${otherTypeSuggestion.label}“ anzeigen`}
          </button>
        </div>
      );
    } else {
      body = (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-4 py-10 text-center font-mono text-sm text-muted-foreground">
          <p>{query.trim() ? `Keine App passt zu „${query.trim()}“.` : 'Keine App passt zu den aktuellen Filtern.'}</p>
          {(typeFilter !== 'gui' || namespaceFilter !== 'all' || query) && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter('gui');
                setNamespaceFilter('all');
                setQuery('');
              }}
              className="label-micro rounded border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      );
    }
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

  const isFiltered = typeFilter !== 'gui' || namespaceFilter !== 'all' || Boolean(query);

  return (
    <section aria-labelledby="apps-title" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="label-micro text-muted-foreground">01 / Anwendungen</p>
          <h2 id="apps-title" className="font-wide text-4xl leading-none font-semibold tracking-tight md:text-5xl">
            Apps
            <span className="ml-2 align-top font-mono text-base font-normal text-muted-foreground tabular-nums">
              {filteredApps.length !== apps.length
                ? `${filteredApps.length}/${apps.length}`
                : apps.length
                  ? String(apps.length).padStart(2, '0')
                  : ''}
            </span>
          </h2>
        </div>

        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-3 sm:w-auto">
          {filteredApps.length > 0 && (
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
              placeholder="Suchen …"
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

      {/* Filterleiste: Typ (Mit GUI / Ohne GUI / Alle) und Namespaces */}
      {apps.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-md border border-border/80 bg-well p-2.5 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-micro text-muted-foreground">Ansicht:</span>
              <ToggleGroup
                type="single"
                value={typeFilter}
                onValueChange={(val) => val && setTypeFilter(val as TypeFilter)}
                spacing={1}
                aria-label="App-Typ filtern"
                className="rounded-sm border border-input bg-card p-0.5"
              >
                <ToggleGroupItem
                  value="gui"
                  className="h-7 gap-1.5 rounded-xs px-2.5 font-mono text-xs uppercase text-muted-foreground hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  Mit GUI
                  <span className="tabular-nums text-[10px] opacity-80">({countsByType.gui})</span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="headless"
                  className="h-7 gap-1.5 rounded-xs px-2.5 font-mono text-xs uppercase text-muted-foreground hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  Ohne GUI
                  <span className="tabular-nums text-[10px] opacity-80">({countsByType.headless})</span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="all"
                  className="h-7 gap-1.5 rounded-xs px-2.5 font-mono text-xs uppercase text-muted-foreground hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  Alle
                  <span className="tabular-nums text-[10px] opacity-80">({countsByType.all})</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {isFiltered && (
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('gui');
                  setNamespaceFilter('all');
                  setQuery('');
                }}
                className="label-micro text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>

          {namespaces.length > 1 && (
            <div className="scrollbar-thin flex items-center gap-1.5 overflow-x-auto pt-1">
              <span className="label-micro mr-1 shrink-0 text-muted-foreground">Namespace:</span>
              <button
                type="button"
                onClick={() => setNamespaceFilter('all')}
                className={cn(
                  'label-micro shrink-0 rounded border px-2 py-0.5 text-[11px] transition-colors',
                  namespaceFilter === 'all'
                    ? 'border-foreground/50 bg-card font-semibold text-foreground shadow-xs'
                    : 'border-border/60 bg-card/40 text-muted-foreground hover:bg-card hover:text-foreground'
                )}
              >
                Alle
              </button>
              {namespaces.map((ns) => {
                const countInNs = apps.filter(
                  (a) => a.namespace === ns && (typeFilter === 'all' || (typeFilter === 'gui' ? Boolean(a.url) : !a.url))
                ).length;
                return (
                  <button
                    key={ns}
                    type="button"
                    onClick={() => setNamespaceFilter(namespaceFilter === ns ? 'all' : ns)}
                    className={cn(
                      'label-micro shrink-0 rounded border px-2 py-0.5 text-[11px] transition-colors',
                      namespaceFilter === ns
                        ? 'border-signal bg-card font-semibold text-signal shadow-xs'
                        : 'border-border/60 bg-card/40 text-muted-foreground hover:bg-card hover:text-foreground',
                      countInNs === 0 && 'opacity-35'
                    )}
                  >
                    {ns}
                    <span className="ml-1 text-[10px] tabular-nums opacity-75">({countInNs})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {body}
    </section>
  );
}
