import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from '@/lib/useTheme';
import { cn } from '@/lib/utils';

/** Kleiner Wippschalter. Die Kerbe zeigt auf den aktiven Modus. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      aria-label="Dunkelmodus"
      aria-pressed={isDark}
      onClick={toggle}
      className={cn(
        'group relative grid h-11 w-[4.5rem] shrink-0 grid-cols-2 items-center rounded-md border border-input bg-well p-1 transition-colors hover:border-foreground/40',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-sm border border-input bg-card shadow-[0_1px_0_var(--input),0_4px_10px_-4px_rgb(0_0_0/0.35)] transition-transform duration-300 ease-snap',
          isDark && 'translate-x-full'
        )}
      />
      <SunIcon aria-hidden="true" className={cn('relative mx-auto size-4 transition-colors', isDark ? 'text-muted-foreground' : 'text-foreground')} />
      <MoonIcon aria-hidden="true" className={cn('relative mx-auto size-4 transition-colors', isDark ? 'text-signal' : 'text-muted-foreground')} />
    </button>
  );
}
