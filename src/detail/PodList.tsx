import { Led } from '@/components/Led';
import { podPhaseState } from '@/lib/k8s';
import type { PodPlacement } from '@/lib/types';

export function PodList({ pods, message }: { pods: PodPlacement[] | null; message: string | null }) {
  if (message || !pods) {
    return <p className="px-4 py-6 font-mono text-sm text-muted-foreground">{message ?? 'Lade Pods …'}</p>;
  }
  if (pods.length === 0) {
    return <p className="px-4 py-6 font-mono text-sm text-muted-foreground">Keine Pods für dieses Deployment gefunden.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {pods.map(({ pod, node, phase }) => (
        <li key={pod || node || phase} className="flex items-start gap-3 px-4 py-3">
          <Led state={podPhaseState(phase)} className="mt-1.5" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-mono text-sm font-medium">{pod || 'Unbekannter Pod'}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="label-micro text-muted-foreground">Node</span>
              <span className="font-mono text-muted-foreground">{node || 'noch nicht zugewiesen'}</span>
              {phase && phase !== 'Running' && (
                <span className="label-micro rounded-sm border border-border px-1.5 text-foreground">{phase}</span>
              )}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
