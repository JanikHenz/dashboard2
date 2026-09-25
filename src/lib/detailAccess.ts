// Die Freigabe gilt nur für die aktuelle Browser-Sitzung und ist bewusst kein echter Schutz.
const UNLOCK_STORAGE_KEY = 'dashboard-fingerprint-detail-unlock';
const UNLOCKED_VALUE = '1';

export function isDetailPageUnlocked() {
  try {
    return window.sessionStorage.getItem(UNLOCK_STORAGE_KEY) === UNLOCKED_VALUE;
  } catch {
    return false;
  }
}

export function unlockDetailPage() {
  try {
    window.sessionStorage.setItem(UNLOCK_STORAGE_KEY, UNLOCKED_VALUE);
  } catch {
    // Ohne sessionStorage bleibt die Detailseite einfach gesperrt.
  }
}

export function lockDetailPage() {
  try {
    window.sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
  } catch {
    // Ohne sessionStorage gibt es nichts zu sperren.
  }
}

export function detailPageUrl({ namespace, deployment }: { namespace: string; deployment: string }) {
  const url = new URL('/app-detail.html', window.location.href);
  url.search = new URLSearchParams({ namespace, deployment }).toString();
  return url.href;
}

export function dashboardUrl() {
  return new URL('/', window.location.href).href;
}
