import type { LedState } from '@/lib/types';
import { cn } from '@/lib/utils';

const COLORS: Record<LedState, string> = {
  online: 'bg-ok shadow-[0_0_0_3px_color-mix(in_oklab,var(--ok)_22%,transparent),0_0_10px_var(--ok)]',
  pending: 'bg-warn shadow-[0_0_0_3px_color-mix(in_oklab,var(--warn)_22%,transparent)] animate-blink',
  offline: 'bg-bad shadow-[0_0_0_3px_color-mix(in_oklab,var(--bad)_22%,transparent)]',
  idle: 'bg-idle'
};

export function Led({ state, className, blink = false }: { state: LedState; className?: string; blink?: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-state={state}
      className={cn('inline-block size-2.5 shrink-0 rounded-full', COLORS[state], blink && 'animate-blink', className)}
    />
  );
}
