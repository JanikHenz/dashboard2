import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export type View = 'apps' | 'system';

type ViewSwitchProps = {
  view: View;
  onChange: (view: View) => void;
  appsCount: number | null;
  cpuPercent: number | null;
  className?: string;
};

const ITEM_CLASS =
  'h-11 flex-1 gap-2 rounded-sm px-3 font-mono text-xs font-medium tracking-[0.12em] uppercase text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_0_var(--input),0_4px_10px_-6px_rgb(0_0_0/0.4)]';

/** Umschalter zwischen Apps und System. Jede Seite zeigt einen Live-Wert als Vorschau. */
export function ViewSwitch({ view, onChange, appsCount, cpuPercent, className }: ViewSwitchProps) {
  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(value) => value && onChange(value as View)}
      spacing={1}
      aria-label="Ansicht wählen"
      className={cn('rounded-md border border-input bg-well p-1', className)}
    >
      <ToggleGroupItem value="apps" aria-controls="view-panel" className={ITEM_CLASS}>
        <span aria-hidden="true" className="text-muted-foreground/70">01</span>
        Apps
        <span className="tabular-nums text-muted-foreground">{appsCount ?? '·'}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="system" aria-controls="view-panel" className={ITEM_CLASS}>
        <span aria-hidden="true" className="text-muted-foreground/70">02</span>
        System
        <span className="tabular-nums text-muted-foreground">{cpuPercent === null ? '·' : `${Math.round(cpuPercent)}%`}</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
