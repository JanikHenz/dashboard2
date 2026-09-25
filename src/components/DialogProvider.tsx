import { TriangleAlertIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'danger';
type ActionVariant = 'default' | 'signal' | 'destructive' | 'outline';

export type DialogAction = { label: string; value: string; variant?: ActionVariant; dismiss?: boolean };

type DialogOptions = { title: string; message: string; tone?: Tone; actions: DialogAction[] };
type QueuedDialog = DialogOptions & { id: number; resolve: (value: string | null) => void };

type DialogApi = {
  open: (options: DialogOptions) => Promise<string | null>;
  confirm: (options: { title: string; message: string; confirmLabel: string; cancelLabel?: string; tone?: Tone }) => Promise<boolean>;
  notice: (options: { title: string; message: string; tone?: Tone }) => Promise<string | null>;
};

const DialogContext = createContext<DialogApi | null>(null);

/**
 * Modale Hinweise und Bestätigungen. Mehrere Aufrufe werden nacheinander angezeigt.
 * Escape oder Schliessen ohne Auswahl liefert null.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedDialog[]>([]);
  const nextId = useRef(0);
  const settled = useRef(new Set<number>());
  const current = queue[0];

  const settle = useCallback((dialog: QueuedDialog, value: string | null) => {
    if (settled.current.has(dialog.id)) return;
    settled.current.add(dialog.id);
    dialog.resolve(value);
    setQueue((items) => items.filter((item) => item.id !== dialog.id));
  }, []);

  const api = useMemo<DialogApi>(() => {
    const open = (options: DialogOptions) =>
      new Promise<string | null>((resolve) => {
        nextId.current += 1;
        setQueue((items) => [...items, { ...options, id: nextId.current, resolve }]);
      });

    return {
      open,
      async confirm({ title, message, confirmLabel, cancelLabel = 'Abbrechen', tone = 'default' }) {
        const choice = await open({
          title,
          message,
          tone,
          actions: [
            { label: cancelLabel, value: 'cancel', variant: 'outline', dismiss: true },
            { label: confirmLabel, value: 'confirm', variant: tone === 'danger' ? 'destructive' : 'default' }
          ]
        });
        return choice === 'confirm';
      },
      notice: ({ title, message, tone = 'default' }) =>
        open({ title, message, tone, actions: [{ label: 'OK', value: 'ok', variant: tone === 'danger' ? 'destructive' : 'default' }] })
    };
  }, []);

  const isDanger = current?.tone === 'danger';

  return (
    <DialogContext.Provider value={api}>
      {children}
      <AlertDialog
        open={Boolean(current)}
        onOpenChange={(open) => {
          if (!open && current) settle(current, null);
        }}
      >
        {current && (
          <AlertDialogContent
            key={current.id}
            onEscapeKeyDown={() => settle(current, null)}
            className="overflow-hidden pt-0"
          >
            <div
              aria-hidden="true"
              className={cn('-mx-5 mb-1 h-2', isDanger ? 'hatch text-bad' : 'bg-foreground')}
            />
            <AlertDialogHeader className="place-items-start text-left">
              <p className={cn('label-micro flex items-center gap-2', isDanger ? 'text-bad' : 'text-muted-foreground')}>
                {isDanger && <TriangleAlertIcon className="size-4" aria-hidden="true" />}
                {isDanger ? 'Achtung' : 'Hinweis'}
              </p>
              <AlertDialogTitle>{current.title}</AlertDialogTitle>
              <AlertDialogDescription className="text-left text-base text-pretty">{current.message}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:flex-row sm:justify-end">
              {current.actions.map((action) =>
                action.dismiss ? (
                  <AlertDialogCancel key={action.value} variant={action.variant ?? 'outline'} onClick={() => settle(current, action.value)}>
                    {action.label}
                  </AlertDialogCancel>
                ) : (
                  <Button key={action.value} variant={action.variant ?? 'default'} onClick={() => settle(current, action.value)}>
                    {action.label}
                  </Button>
                )
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </DialogContext.Provider>
  );
}

export function useDialogs() {
  const api = useContext(DialogContext);
  if (!api) throw new Error('useDialogs braucht einen DialogProvider');
  return api;
}
