import { useCallback, useRef, useState, type TouchEvent } from 'react';
import { ConnectionBadge } from '@/components/ConnectionBadge';
import { useDialogs } from '@/components/DialogProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UptimeDisplay } from '@/components/UptimeDisplay';
import { detailPageUrl, isDetailPageUnlocked } from '@/lib/detailAccess';
import { latestValue } from '@/lib/format';
import type { App, AppsStateMessage, MonitoringMessage } from '@/lib/types';
import { SCOPES, useDashboardSocket } from '@/lib/useDashboardSocket';
import { cn } from '@/lib/utils';
import { AppsView } from './AppsView';
import { PowerControl } from './PowerControl';
import { SystemView } from './SystemView';
import { usePower } from './usePower';
import { ViewSwitch, type View } from './ViewSwitch';

const SWIPE_MIN_DISTANCE_PX = 72;
const SWIPE_DIRECTION_RATIO = 1.4;
const SWIPE_IGNORE_SELECTOR = 'input, textarea, select, [role="slider"], [role="dialog"], [data-no-swipe]';
const VIEW_ORDER: View[] = ['apps', 'system'];

export function DashboardApp() {
  const dialogs = useDialogs();
  const [view, setView] = useState<View>('apps');
  const [appsState, setAppsState] = useState<AppsStateMessage | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringMessage | null>(null);
  const [unlocked, setUnlocked] = useState(isDetailPageUnlocked);
  const [scannerCalling, setScannerCalling] = useState(false);
  const pendingDetailApp = useRef<App | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const refreshRef = useRef<() => void>(() => {});

  const requestStatusRefresh = useCallback(() => refreshRef.current(), []);
  const power = usePower({ onRequestRefresh: requestStatusRefresh });

  const { connected, sendRefresh } = useDashboardSocket({
    onStatus: power.applyStatus,
    onMonitoring: setMonitoring,
    onApps: setAppsState,
    onDisconnected: power.markDisconnected
  });
  refreshRef.current = () => sendRefresh(SCOPES.STATUS);

  const openDetails = useCallback(
    async (app: App) => {
      if (isDetailPageUnlocked()) {
        window.location.assign(detailPageUrl(app));
        return;
      }
      const choice = await dialogs.open({
        title: 'Detailseite gesperrt',
        message: `Scanne zuerst deinen Fingerabdruck im System-Bereich. Danach öffnet sich die Detailseite von ${app.name} automatisch.`,
        actions: [
          { label: 'Schliessen', value: 'close', variant: 'outline', dismiss: true },
          { label: 'Zum Scanner', value: 'scan', variant: 'signal' }
        ]
      });
      if (choice !== 'scan') return;
      pendingDetailApp.current = app;
      setView('system');
      setScannerCalling(true);
    },
    [dialogs]
  );

  const handleUnlocked = useCallback(() => {
    setUnlocked(true);
    const app = pendingDetailApp.current;
    if (app) window.location.assign(detailPageUrl(app));
  }, []);

  const stopCalling = useCallback(() => setScannerCalling(false), []);

  function handleTouchStart(event: TouchEvent) {
    const target = event.target as Element;
    touchStart.current =
      event.touches.length === 1 && !target.closest(SWIPE_IGNORE_SELECTOR)
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : null;
  }

  function handleTouchEnd(event: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_DIRECTION_RATIO) return;
    const index = VIEW_ORDER.indexOf(view) + (dx < 0 ? 1 : -1);
    if (index >= 0 && index < VIEW_ORDER.length) setView(VIEW_ORDER[index]);
  }

  const appsCount = Array.isArray(appsState?.apps) ? appsState.apps.length : null;
  const cpuPercent = monitoring?.error ? null : latestValue(monitoring?.series?.cpu);

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0">
      <h1 className="sr-only">Homelab-Dashboard</h1>

      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur-md supports-backdrop-filter:bg-card/75">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-stretch pt-[env(safe-area-inset-top)] lg:flex-nowrap">
          <div className="flex flex-1 items-center gap-3 px-4 py-3 lg:flex-none lg:border-r lg:border-border lg:px-5">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-sm bg-foreground font-wide text-sm font-bold text-background">
              R
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-wide text-base font-bold tracking-tight uppercase">Rack</span>
              <span className="label-micro text-muted-foreground">Homelab</span>
            </span>
          </div>

          <div className="flex items-center gap-3 px-4 lg:hidden">
            <ConnectionBadge connected={connected} />
            <ThemeToggle />
          </div>

          <div className="flex w-full items-center justify-between gap-4 border-t border-border px-4 py-3 lg:w-auto lg:flex-1 lg:justify-start lg:border-t-0 lg:px-5 lg:gap-6">
            <UptimeDisplay uptimeMs={power.uptimeMs} />
            <PowerControl state={power.state} onPress={power.press} />
          </div>

          <div className="hidden items-center gap-4 border-l border-border px-5 lg:flex">
            <ViewSwitch view={view} onChange={setView} appsCount={appsCount} cpuPercent={cpuPercent} className="w-[17rem]" />
          </div>
          <div className="hidden items-center gap-4 border-l border-border px-5 lg:flex">
            <ConnectionBadge connected={connected} className="hidden lg:inline-flex" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="view-panel"
        className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-8"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={view}
          className={cn(
            'animate-in duration-300 fade-in-0',
            view === 'system' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
          )}
        >
          {view === 'apps' ? (
            <AppsView appsState={appsState} locked={!unlocked} onOpenDetails={openDetails} />
          ) : (
            <SystemView
              monitoring={monitoring}
              unlocked={unlocked}
              scannerCalling={scannerCalling}
              onScannerCallingDone={stopCalling}
              onUnlocked={handleUnlocked}
              onRequestRefresh={requestStatusRefresh}
            />
          )}
        </div>
      </main>

      <nav
        aria-label="Ansicht"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/90 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
      >
        <ViewSwitch view={view} onChange={setView} appsCount={appsCount} cpuPercent={cpuPercent} className="w-full" />
      </nav>
    </div>
  );
}
