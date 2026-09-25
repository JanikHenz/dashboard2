import { useCallback, useState } from 'react';

const STORAGE_KEY = 'theme';
export type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Der Startmodus wird schon im Inline-Skript im head gesetzt. Hier wird nur umgeschaltet. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ohne localStorage gilt der Modus nur bis zum Neuladen.
    }
    setTheme(next);
  }, []);

  return { theme, toggle };
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
