import { API_URL } from '@/lib/api';
import type { TokenExpiryDays } from '@/lib/types';

/** Spec §4: expiry choices, 90 days by default. */
export const EXPIRY_OPTIONS: TokenExpiryDays[] = [30, 90, 180];
export const DEFAULT_EXPIRY_DAYS: TokenExpiryDays = 90;

/** Stands in for the real token in the snippets whenever no one-time token is on screen. */
export const TOKEN_PLACEHOLDER = 'YOUR_TOKEN';

export function expiryOptionLabel(days: TokenExpiryDays): string {
  return `${days} days`;
}

/**
 * The hosted MCP endpoint (spec §3: `POST/GET/DELETE /api/mcp`), derived from the API base URL the
 * bundle was built with. `NEXT_PUBLIC_API_URL` normally already ends in `/api`; a bare origin also works.
 */
export function mcpEndpoint(apiUrl: string = API_URL): string {
  const base = apiUrl.replace(/\/+$/, '');
  return /\/api$/.test(base) ? `${base}/mcp` : `${base}/api/mcp`;
}

/** Spec §3: the one command that connects Claude Code. */
export function claudeCodeCommand(token?: string | null, apiUrl?: string): string {
  return `claude mcp add --transport http ejad-tests ${mcpEndpoint(apiUrl)} --header "Authorization: Bearer ${token || TOKEN_PLACEHOLDER}"`;
}

/** Spec §3: the same URL and header in Claude Desktop's and Cursor's MCP config files. */
export function mcpJsonConfig(token?: string | null, apiUrl?: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        'ejad-tests': {
          type: 'http',
          url: mcpEndpoint(apiUrl),
          headers: { Authorization: `Bearer ${token || TOKEN_PLACEHOLDER}` },
        },
      },
    },
    null,
    2,
  );
}
