let accessToken: string | null = null;

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

export function hasAccessToken(): boolean {
  return !!accessToken;
}

export async function tryRestoreSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json() as { accessToken: string };
      setAccessToken(data.accessToken);
      return true;
    }
  } catch {
    // network error — not authenticated
  }
  return false;
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(path, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && accessToken) {
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json() as { accessToken: string };
      setAccessToken(data.accessToken);
      return apiFetch(path, options);
    }
    clearAccessToken();
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!res.ok) throw new Error(`API error ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
