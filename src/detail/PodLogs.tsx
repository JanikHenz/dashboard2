import { useEffect, useId, useRef } from 'react';
import type { PodLog } from '@/lib/types';
import { cn } from '@/lib/utils';

function lineTone(line: string) {
  if (/\b(ERROR|ERR|FATAL|PANIC)\b/i.test(line)) return 'text-bad';
  if (/\b(WARN|WARNING)\b/i.test(line)) return 'text-warn';
  return undefined;
}

function LogScreen({ pod }: { pod: PodLog }) {
  const titleId = useId();
  const outputRef = useRef<HTMLPreElement>(null);
  const text = pod.logs === null || pod.logs === undefined ? '' : String(pod.logs);
  const lines = text.trim() ? text.replace(/\n$/, '').split('\n') : [];

  useEffect(() => {
    const output = outputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [text]);

  return (
    <article className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-screen lg:flex-1">
      <h3 id={titleId} className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <span className="truncate font-mono text-sm text-screen-foreground">{pod.name || 'Pod'}</span>
        <span className={cn('label-micro shrink-0', pod.error ? 'text-bad' : 'text-screen-muted')}>
          {pod.error ? 'Fehler' : `${lines.length} Zeilen`}
        </span>
      </h3>
      <pre
        ref={outputRef}
        tabIndex={0}
        aria-labelledby={titleId}
        className="scrollbar-thin max-h-96 min-h-32 overflow-auto p-3 font-mono text-xs leading-relaxed text-screen-foreground/90 outline-offset-[-2px] lg:max-h-none lg:flex-1"
      >
        {pod.error ? (
          <span className="text-bad">Die Logs sind nicht lesbar. {pod.error}</span>
        ) : lines.length === 0 ? (
          <span className="text-screen-muted">Keine Logzeilen in diesem Ausschnitt.</span>
        ) : (
          lines.map((line, index) => (
            <span key={index} className={cn('block whitespace-pre-wrap break-all', lineTone(line))}>
              {line}
            </span>
          ))
        )}
      </pre>
    </article>
  );
}

/** Pro Pod ein Log-Bildschirm. Die neuesten Zeilen stehen unten und sind direkt sichtbar. */
export function PodLogs({ pods, message }: { pods: PodLog[] | null; message: { text: string; tone?: 'error' } | null }) {
  if (message || !pods) {
    return (
      <p className={cn('p-4 font-mono text-sm', message?.tone === 'error' ? 'text-bad' : 'text-muted-foreground')}>
        {message?.text ?? 'Lade Logs …'}
      </p>
    );
  }
  if (pods.length === 0) {
    return <p className="p-4 font-mono text-sm text-muted-foreground">Keine Pods für dieses Deployment gefunden.</p>;
  }
  return (
    <div className="flex flex-col gap-3 p-3 lg:h-full lg:min-h-0">
      {pods.map((pod, index) => (
        <LogScreen key={pod.name || index} pod={pod} />
      ))}
    </div>
  );
}
