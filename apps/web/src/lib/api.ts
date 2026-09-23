const ACCESS_KEY = 'peopleos_access';
const REFRESH_KEY = 'peopleos_refresh';

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

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: Tokens) {
  sessionStorage.setItem(ACCESS_KEY, tokens.accessToken);
  sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens() {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

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
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const tokens = (await res.json()) as Tokens;
  setTokens(tokens);
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
  const access = getAccessToken();
  if (access) headers.set('Authorization', `Bearer ${access}`);

  const res = await fetch(path, { ...init, headers });

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
  const tokens = await apiFetch<Tokens>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false);
  setTokens(tokens);
  return tokens;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await apiFetch('/api/v1/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }, false);
    }
  } finally {
    clearTokens();
  }
}

export async function fetchMe() {
  return apiFetch<AuthUser>('/api/v1/auth/me');
}

export type RoleItem = { id: string; code: string; name: string };

export type UserListItem = {
  id: string;
  email: string;
  status: string;
  roles: string[];
};

export async function fetchMyPermissions() {
  return apiFetch<{ permissions: string[] }>('/api/v1/rbac/me/permissions');
}

export async function fetchRoles() {
  return apiFetch<RoleItem[]>('/api/v1/roles');
}

export async function fetchUsers() {
  return apiFetch<UserListItem[]>('/api/v1/users');
}

export async function updateUserRoles(userId: string, roleCodes: string[]) {
  return apiFetch<UserListItem>(`/api/v1/users/${userId}/roles`, {
    method: 'PUT',
    body: JSON.stringify({ roleCodes }),
  });
}

export async function requestPasswordReset(email: string) {
  return apiFetch<{ message: string }>(
    '/api/v1/auth/password-reset/request',
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
    false,
  );
}

export async function verifyPasswordResetOtp(email: string, otp: string) {
  return apiFetch<{ resetToken: string; expiresIn: number }>(
    '/api/v1/auth/password-reset/verify',
    {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    },
    false,
  );
}

export async function confirmPasswordReset(
  resetToken: string,
  password: string,
) {
  return apiFetch<{ success: boolean }>(
    '/api/v1/auth/password-reset/confirm',
    {
      method: 'POST',
      body: JSON.stringify({ resetToken, password }),
    },
    false,
  );
}
