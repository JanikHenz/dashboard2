import { ArrowRightIcon, ArrowUpRightIcon, LockIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { Led } from '@/components/Led';
import { DEPLOYMENT_STATE_LABELS, DEPLOYMENT_STATE_SHORT, deploymentState } from '@/lib/k8s';
import type { App, Deployment } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICON_SIZE_PX = 96;

function initialsOf(name: string) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function AppIcon({ app }: { app: App }) {
  const [failed, setFailed] = useState(false);
  if (!app.icon || failed) {
    return (
      <span aria-hidden="true" className="font-wide text-xl font-semibold tracking-tight text-muted-foreground">
        {initialsOf(app.name)}
      </span>
    );
  }
  return (
    <img
      src={app.icon}
      alt=""
      width={ICON_SIZE_PX}
      height={ICON_SIZE_PX}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="size-10 object-contain transition-transform duration-300 ease-snap group-hover/open:scale-110"
    />
  );
}

type AppModuleProps = { app: App; deployment: Deployment | undefined; locked: boolean; onOpenDetails: (app: App) => void };

/**
 * Eine Taste pro App. Die obere Fläche öffnet die App, die Leiste unten führt zur Detailseite.
 */
export const AppModule = memo(function AppModule({ app, deployment, locked, onOpenDetails }: AppModuleProps) {
  const state = deploymentState(deployment);
  const ready = deployment?.readyReplicas ?? 0;
  const total = deployment?.replicas ?? 0;

  const face = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Led state={state} />
          <span className="label-micro text-muted-foreground">{DEPLOYMENT_STATE_SHORT[state]}</span>
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {ready}/{total}
        </span>
      </span>
      <span className="my-4 grid size-16 place-items-center self-center rounded-md border border-border bg-well shadow-[inset_0_1px_3px_rgb(0_0_0/0.12)]">
        <AppIcon app={app} />
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="min-w-0 truncate text-base leading-tight font-semibold">{app.name}</span>
        {app.url ? (
          <ArrowUpRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-[color,transform] duration-200 group-hover/open:translate-x-0.5 group-hover/open:-translate-y-0.5 group-hover/open:text-signal"
          />
        ) : (
          <span className="label-micro shrink-0 rounded border border-border/70 bg-well px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Service
          </span>
        )}
      </span>
    </>
  );

  return (
    <li className="group relative flex flex-col rounded-md border border-border bg-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[0_14px_30px_-18px_rgb(0_0_0/0.45)]">
      {app.url ? (
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${app.name} öffnen`}
          className="group/open flex flex-1 flex-col rounded-t-md p-3 outline-offset-[-2px]"
        >
          {face}
        </a>
      ) : (
        <button
          type="button"
          onClick={() => onOpenDetails(app)}
          aria-label={`${app.name} Details öffnen`}
          className="group/open flex flex-1 flex-col rounded-t-md p-3 text-left outline-offset-[-2px] transition-colors hover:bg-muted/30"
        >
          {face}
        </button>
      )}
      <button
        type="button"
        onClick={() => onOpenDetails(app)}
        className="flex h-11 items-center justify-between gap-2 rounded-b-md border-t border-border px-3 text-muted-foreground transition-colors outline-offset-[-2px] hover:bg-muted hover:text-foreground"
      >
        <span className="label-micro flex items-center gap-1.5">
          {locked && <LockIcon aria-hidden="true" className="size-3.5" />}
          Details
        </span>
        <ArrowRightIcon aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
        <span className="sr-only">
          {app.name}, Status {DEPLOYMENT_STATE_LABELS[state]}, Details öffnen{locked ? ', gesperrt' : ''}
        </span>
      </button>
    </li>
  );
});

export function AppModuleSkeleton({ className }: { className?: string }) {
  return (
    <li aria-hidden="true" className={cn('flex h-[11.75rem] flex-col rounded-md border border-dashed border-border p-3', className)}>
      <span className="h-3 w-16 rounded-sm bg-muted" />
      <span className="my-auto size-16 self-center rounded-md bg-muted" />
      <span className="h-4 w-24 rounded-sm bg-muted" />
    </li>
  );
}
