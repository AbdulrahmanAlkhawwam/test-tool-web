import type { ApiErrorBody, AuthUser } from './types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.message);
    this.name = 'ApiError';
  }

  get details(): string[] {
    return Array.isArray(this.body.details) ? this.body.details.map(String) : [];
  }
}

type Query = Record<string, string | number | undefined | null>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
}

let accessToken: string | null = null;
let refreshing: Promise<AuthUser> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(API_URL + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) {
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  return fetch(buildUrl(path, opts.query), { method: opts.method ?? 'GET', headers, body, credentials: 'include' });
}

async function toError(res: Response): Promise<ApiError> {
  try {
    return new ApiError(res.status, (await res.json()) as ApiErrorBody);
  } catch {
    return new ApiError(res.status, { statusCode: res.status, error: res.statusText, message: `Request failed (${res.status})` });
  }
}

/** Exchanges the httpOnly refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<AuthUser> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        accessToken = null;
        throw await toError(res);
      }
      const data = (await res.json()) as { accessToken: string; user: AuthUser };
      accessToken = data.accessToken;
      return data.user;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function authorizedFetch(path: string, opts: RequestOptions): Promise<Response> {
  let res = await send(path, opts);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
    } catch (e) {
      // Only a rejected refresh token means the session is over. A network error or 5xx while
      // refreshing is transient: fail this call like any other so callers keep their state
      // (e.g. unsaved result text) and can retry.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        onSessionExpired?.();
        throw await toError(res);
      }
      throw new Error('Could not renew your session. Check your connection and try again.');
    }
    res = await send(path, opts);
  }
  if (!res.ok) throw await toError(res);
  return res;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await authorizedFetch(path, opts);
  if (res.status === 204) return undefined as T;
  // Nest sends no body at all for a handler that returns `null` (e.g. "no pending suggestion"), not the
  // text "null" — plain `res.json()` throws a SyntaxError on that empty body, which isn't an ApiError, so
  // callers (and React Query's retry) can't tell it apart from a real failure. Read as text first and treat
  // an empty body as `undefined`, the same as a 204; a real JSON payload (including the literal `null`)
  // parses normally.
  const text = await res.text();
  if (text === '') return undefined as T;
  return JSON.parse(text) as T;
}

/** Downloads an authorized file (e.g. an .xlsx export) and saves it in the browser. */
export async function download(path: string, fallbackName: string): Promise<void> {
  const res = await authorizedFetch(path, {});
  const blob = await res.blob();
  const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match?.[1] ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking synchronously can cancel the download in some browsers before it has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
