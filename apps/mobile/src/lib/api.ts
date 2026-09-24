import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './storage';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://localhost:3000/api/v1';

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
  tokenType?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  tenantId: string;
  tenantCode: string;
  roles: string[];
  mfaEnabled: boolean;
};

type ApiErrorBody = { message?: string | string[]; statusCode?: number };

async function parseError(res: Response) {
  try {
    const body = (await res.json()) as ApiErrorBody;
    const msg = body.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  } catch {
    /* ignore */
  }
  return res.statusText || 'Request failed';
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearTokens();
    return false;
  }
  const tokens = (await res.json()) as Tokens;
  await setTokens(tokens.accessToken, tokens.refreshToken);
  return true;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const access = await getAccessToken();
  if (access) headers.set('Authorization', `Bearer ${access}`);

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { ...init, headers });

  if (res.status === 401 && retry && !path.includes('/auth/login')) {
    if (!refreshPromise) {
      refreshPromise = tryRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    const ok = await refreshPromise;
    if (ok) return apiFetch<T>(path, init, false);
  }

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(email: string, password: string) {
  const tokens = await apiFetch<Tokens>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    false,
  );
  await setTokens(tokens.accessToken, tokens.refreshToken);
  return tokens;
}

export async function logout() {
  const refreshToken = await getRefreshToken();
  try {
    if (refreshToken) {
      await apiFetch(
        '/auth/logout',
        {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        },
        false,
      );
    }
  } finally {
    await clearTokens();
  }
}

export async function fetchMe() {
  return apiFetch<AuthUser>('/auth/me');
}

export async function fetchHealth() {
  return apiFetch<{ status: string; service: string }>('/health', {}, false);
}

export { API_BASE };
