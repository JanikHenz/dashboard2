import { FingerprintIcon } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { unlockDetailPage } from '@/lib/detailAccess';
import { prefersReducedMotion } from '@/lib/useTheme';
import { cn } from '@/lib/utils';

const SCAN_MS = 2400;
const CLOSE_AFTER_SUCCESS_MS = 700;
const CALL_ATTENTION_MS = 8000;
// Nur eine Spielerei im Frontend und kein echtes Geheimnis.
const FUN_PASSWORD = 'unernst';

type ScannerProps = {
  unlocked: boolean;
  calling: boolean;
  onCallingDone: () => void;
  onUnlocked: () => void;
};

/**
 * Scanner-Knopf mit Passwortdialog. Nach dem richtigen Passwort sind die Detailseiten
 * für die Sitzung frei und onUnlocked wird aufgerufen.
 */
export function FingerprintScanner({ unlocked, calling, onCallingDone, onUnlocked }: ScannerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanTimer = useRef<number | undefined>(undefined);
  const justUnlocked = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; tone?: 'error' } | null>(null);

  useEffect(() => {
    if (!calling) return;
    buttonRef.current?.focus({ preventScroll: false });
    buttonRef.current?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    const timer = window.setTimeout(onCallingDone, CALL_ATTENTION_MS);
    return () => window.clearTimeout(timer);
  }, [calling, onCallingDone]);

  useEffect(() => () => window.clearTimeout(scanTimer.current), []);

  function startScan() {
    if (scanning) return;
    onCallingDone();
    setScanning(true);
    scanTimer.current = window.setTimeout(() => {
      setScanning(false);
      setPassword('');
      setFeedback(null);
      setOpen(true);
    }, prefersReducedMotion() ? 0 : SCAN_MS);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.trim() !== FUN_PASSWORD) {
      setFeedback({ text: 'Das ist nicht das richtige Passwort.', tone: 'error' });
      inputRef.current?.select();
      return;
    }
    unlockDetailPage();
    justUnlocked.current = true;
    setFeedback({ text: 'Stimmt. Willkommen!' });
    window.setTimeout(() => handleOpenChange(false), CLOSE_AFTER_SUCCESS_MS);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) return;
    setPassword('');
    setFeedback(null);
    if (justUnlocked.current) {
      justUnlocked.current = false;
      onUnlocked();
    }
  }

  const status = scanning ? 'Scanne …' : unlocked ? 'Frei' : 'Gesperrt';

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <button
        ref={buttonRef}
        type="button"
        onClick={startScan}
        aria-label="Fingerabdruck scannen"
        aria-haspopup="dialog"
        aria-busy={scanning}
        style={{ '--scan-duration': `${SCAN_MS}ms` } as React.CSSProperties}
        className="group relative grid aspect-square w-full max-w-36 place-items-center overflow-visible rounded-md bg-screen shadow-[inset_0_2px_8px_rgb(0_0_0/0.7)] transition-transform active:scale-[0.98]"
      >
        {calling && (
          <>
            <span aria-hidden="true" className="absolute -inset-1.5 rounded-lg border-2 border-signal animate-ping-soft" />
            <span aria-hidden="true" className="absolute -inset-1.5 rounded-lg border-2 border-signal" />
          </>
        )}
        <span aria-hidden="true" className="absolute inset-2 overflow-hidden rounded-sm">
          <span className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgb(255_255_255/0.025)_50%)] bg-[length:100%_4px]" />
          {scanning && (
            <span className="absolute inset-x-1 h-0.5 animate-scan rounded-full bg-signal shadow-[0_0_12px_2px_var(--signal)]" />
          )}
        </span>
        <FingerprintIcon aria-hidden="true" strokeWidth={1.25} className="relative size-[58%] text-screen-muted transition-colors group-hover:text-screen-foreground/70" />
        <FingerprintIcon
          aria-hidden="true"
          strokeWidth={1.25}
          className={cn(
            'absolute size-[58%] text-signal drop-shadow-[0_0_6px_var(--signal)]',
            scanning ? 'animate-reveal' : unlocked ? 'opacity-100' : 'opacity-0'
          )}
        />
      </button>
      <p className="label-micro flex items-center gap-2 text-muted-foreground" aria-live="polite">
        <span aria-hidden="true" className={cn('size-1.5 rounded-full', unlocked ? 'bg-ok' : scanning ? 'bg-signal animate-blink' : 'bg-idle')} />
        {status}
      </p>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            buttonRef.current?.focus({ preventScroll: true });
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <DialogHeader>
              <p className="label-micro flex items-center gap-2 text-signal">
                <FingerprintIcon aria-hidden="true" className="size-4" /> Scan abgeschlossen
              </p>
              <DialogTitle>Spass-Zugang</DialogTitle>
              <DialogDescription className="text-base text-pretty">
                Mit dem Passwort schaltest du die Detailseiten für diese Sitzung frei. Das ist nur eine Spielerei im Browser.
              </DialogDescription>
            </DialogHeader>
            <label className="flex flex-col gap-2">
              <span className="label-micro text-muted-foreground">Passwort</span>
              <Input
                ref={inputRef}
                type="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
                maxLength={64}
                spellCheck={false}
                required
                aria-invalid={feedback?.tone === 'error' || undefined}
                aria-describedby="fingerprint-feedback"
              />
            </label>
            <p
              id="fingerprint-feedback"
              role="status"
              className={cn('-mt-2 min-h-5 font-mono text-sm', feedback?.tone === 'error' ? 'text-bad' : 'text-ok')}
            >
              {feedback?.text}
            </p>
            <DialogFooter className="sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Schliessen
              </Button>
              <Button type="submit" variant="signal">
                Prüfen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
