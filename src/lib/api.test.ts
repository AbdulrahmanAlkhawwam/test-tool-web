import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, download, setAccessToken, setSessionExpiredHandler } from './api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const unauthorized = () => json(401, { statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired access token' });

describe('api client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken(null);
    setSessionExpiredHandler(null);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('sends the bearer token, JSON body and credentials', async () => {
    setAccessToken('tok');
    fetchMock.mockResolvedValueOnce(json(201, { id: '1' }));
    await expect(api('/projects', { method: 'POST', body: { name: 'X' } })).resolves.toEqual({ id: '1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/projects');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', body: '{"name":"X"}' });
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'Content-Type': 'application/json' });
  });

  it('adds only non-empty query params', async () => {
    fetchMock.mockResolvedValueOnce(json(200, []));
    await api('/x', { query: { q: 'login', moduleId: undefined, page: 2, status: '' } });
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/api/x?q=login&page=2');
  });

  it('sends FormData without a JSON content type', async () => {
    fetchMock.mockResolvedValueOnce(json(201, {}));
    const form = new FormData();
    form.append('file', new Blob(['x']), 'a.csv');
    await api('/upload', { method: 'POST', body: form });
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe(form);
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('returns undefined for 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api('/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('returns undefined for a 200 with an empty body, instead of throwing on res.json()', async () => {
    // This is what Nest actually sends for a handler that returns `null` (e.g. "no pending suggestion") —
    // no body at all, not the text "null". Plain `res.json()` throws a SyntaxError on that, which isn't an
    // ApiError, so callers (and React Query's retry) can't tell it apart from a real failure.
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(api('/x')).resolves.toBeUndefined();
  });

  it('still parses a real 200 JSON body, including an explicit `null`', async () => {
    fetchMock.mockResolvedValueOnce(json(200, null));
    await expect(api('/x')).resolves.toBeNull();
  });

  it('throws ApiError with the server message and details', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, { statusCode: 400, error: 'Bad Request', message: 'Validation failed', details: ['name should not be empty'] }),
    );
    const err = await api('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).message).toBe('Validation failed');
    expect((err as ApiError).details).toEqual(['name should not be empty']);
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    setAccessToken('old');
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(json(200, { accessToken: 'new', user: { id: 'u' } }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    await expect(api('/projects')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3000/api/auth/refresh');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer new');
  });

  it('shares one refresh between concurrent requests', async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'new', user: { id: 'u' } });
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer new' ? json(200, { ok: true }) : unauthorized();
    });
    await Promise.all([api('/a'), api('/b')]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('reports an expired session when refresh fails', async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized());
    await expect(api('/projects')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  });

  it('reports an expired session when refresh is forbidden', async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(json(403, { statusCode: 403, error: 'Forbidden', message: 'Account disabled' }));
    await expect(api('/projects')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  });

  it('keeps the session when refresh fails with a server error', async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(json(500, { statusCode: 500, error: 'Internal Server Error', message: 'Boom' }));
    const err = await api('/projects').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ApiError);
    expect(expired).not.toHaveBeenCalled();
  });

  it('keeps the session when the refresh request cannot reach the server', async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    fetchMock.mockResolvedValueOnce(unauthorized()).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api('/projects')).rejects.toThrow('Could not renew your session');
    expect(expired).not.toHaveBeenCalled();
  });

  it('revokes a downloaded file URL only after the download has started', async () => {
    const urlStatics = URL as unknown as Record<string, unknown>;
    const original = { create: urlStatics.createObjectURL, revoke: urlStatics.revokeObjectURL };
    const revokeObjectURL = vi.fn();
    urlStatics.createObjectURL = vi.fn(() => 'blob:export');
    urlStatics.revokeObjectURL = revokeObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(
      new Response('xlsx', { status: 200, headers: { 'Content-Disposition': 'attachment; filename="NINJA.xlsx"' } }),
    );
    try {
      vi.useFakeTimers();
      await download('/projects/p1/export', 'fallback.xlsx');
      expect(click).toHaveBeenCalledOnce();
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
    } finally {
      vi.useRealTimers();
      click.mockRestore();
      urlStatics.createObjectURL = original.create;
      urlStatics.revokeObjectURL = original.revoke;
    }
  });

  it('never refreshes for auth endpoints', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401, error: 'Unauthorized', message: 'Invalid email or password' }));
    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toThrow('Invalid email or password');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
