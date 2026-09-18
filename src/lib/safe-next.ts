/**
 * Returns a same-origin path to continue to after login, or '/' for anything that could leave the site.
 * Browsers strip tabs/newlines and treat `\` like `/` when resolving URLs, so prefix checks alone are
 * not enough (e.g. `/\evil.com` and `/\t/evil.com` both resolve to `//evil.com`): the value is also
 * resolved against the current origin and only kept if it stays there.
 */
export function safeNext(next: string | null | undefined, origin: string = window.location.origin): string {
  if (!next) return '/';
  const normalized = next.replace(/[\t\n\r]/g, '');
  if (!normalized.startsWith('/') || /^\/[/\\]/.test(normalized)) return '/';
  try {
    const url = new URL(next, origin);
    if (url.origin !== new URL(origin).origin) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
