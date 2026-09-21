import { vi } from 'vitest';

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const apiError = (status: number, message: string) =>
  json(status, { statusCode: status, error: status === 409 ? 'Conflict' : 'Error', message });

export interface MockCall {
  method: string;
  /** Path without the `/api` prefix, e.g. `/projects/p1/automation/tree`. */
  path: string;
  query: Record<string, string>;
  body: unknown;
}

/** A plain value is sent as a 200 JSON body. A function receives the call and may return a Response. */
export type Route = ((call: MockCall) => unknown) | object | string | number | boolean | null;

/**
 * Stubs global fetch with a table of `"METHOD /path"` routes. Unknown routes answer 404 with an API error
 * body, so a missing mock shows up as a visible error state instead of a hang. Return a new Response from
 * a function each time (a Response body can only be read once).
 */
export function mockRoutes(routes: Record<string, Route>) {
  const calls: MockCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call: MockCall = {
      method: init.method ?? 'GET',
      path: url.pathname.replace(/^\/api/, ''),
      query: Object.fromEntries(url.searchParams),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const route = routes[`${call.method} ${call.path}`];
    if (route === undefined) return apiError(404, `No mock for ${call.method} ${call.path}`);
    const result = typeof route === 'function' ? await (route as (c: MockCall) => unknown)(call) : route;
    return result instanceof Response ? result : json(200, result);
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    calls,
    fetchMock,
    callsTo: (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path),
  };
}
