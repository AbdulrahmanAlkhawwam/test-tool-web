/**
 * Returns `url` unchanged only if it parses as an absolute `http:` or `https:` URL; otherwise
 * `undefined`. Use this before putting any GitLab- or API-sourced URL (a repository link, merge
 * request, pipeline, job artifacts, avatar, …) into an `href` or `src` — the API echoes back
 * whatever GitLab (or a compromised/misconfigured integration) gives it, so a `javascript:` or
 * other non-http(s) value must never reach the DOM as a clickable link or an image source.
 */
export function safeExternalHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}
