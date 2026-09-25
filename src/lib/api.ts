export class ApiError extends Error {
  constructor(message: string, detail = '') {
    super(detail ? `${message} (${detail})` : message);
    this.name = 'ApiError';
  }
}

function messageForStatus(status: number) {
  if (status === 0) return 'Der Server ist nicht erreichbar.';
  if (status === 503) return 'Der Dienst ist gerade nicht verfügbar.';
  if (status >= 500) return 'Der Server hat einen Fehler gemeldet.';
  return 'Die Anfrage wurde abgelehnt.';
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Einheitlicher Fetch-Helfer. Wirft bei Netzwerk- und HTTP-Fehlern einen ApiError
 * mit deutscher Meldung, die Meldung des Servers steht in Klammern dahinter.
 */
export async function requestJson<T = unknown>(url: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = body !== undefined;
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(messageForStatus(0));
  }

  const data = await readJson(response);
  if (!response.ok) {
    const serverError = (data as { error?: unknown } | null)?.error;
    throw new ApiError(messageForStatus(response.status), typeof serverError === 'string' ? serverError : '');
  }
  return data as T;
}
