import { describe, expect, it } from 'vitest';
import { claudeCodeCommand, DEFAULT_EXPIRY_DAYS, EXPIRY_OPTIONS, expiryOptionLabel, mcpEndpoint, mcpJsonConfig, TOKEN_PLACEHOLDER } from './mcp-setup';

describe('mcpEndpoint', () => {
  it('appends /mcp when the API URL already ends in /api', () => {
    expect(mcpEndpoint('https://api.tests.ejad.example/api')).toBe('https://api.tests.ejad.example/api/mcp');
    expect(mcpEndpoint('https://api.tests.ejad.example/api/')).toBe('https://api.tests.ejad.example/api/mcp');
  });

  it('appends /api/mcp when the API URL is a bare origin', () => {
    expect(mcpEndpoint('http://localhost:3000')).toBe('http://localhost:3000/api/mcp');
  });
});

describe('setup snippets', () => {
  it('builds the Claude Code command with the real endpoint and the token', () => {
    expect(claudeCodeCommand('ejad_pat_abc', 'http://localhost:3000/api')).toBe(
      'claude mcp add --transport http ejad-tests http://localhost:3000/api/mcp --header "Authorization: Bearer ejad_pat_abc"',
    );
  });

  it('falls back to a placeholder when no token is on screen, and never invents one', () => {
    const command = claudeCodeCommand(null, 'http://localhost:3000/api');
    expect(command).toContain(`Bearer ${TOKEN_PLACEHOLDER}`);
    expect(command).not.toContain('ejad_pat_');
    expect(JSON.parse(mcpJsonConfig(null, 'http://localhost:3000/api'))).toEqual({
      mcpServers: {
        'ejad-tests': {
          type: 'http',
          url: 'http://localhost:3000/api/mcp',
          headers: { Authorization: `Bearer ${TOKEN_PLACEHOLDER}` },
        },
      },
    });
  });

  it('offers 30 / 90 / 180 day expiries with 90 as the default', () => {
    expect(EXPIRY_OPTIONS).toEqual([30, 90, 180]);
    expect(DEFAULT_EXPIRY_DAYS).toBe(90);
    expect(EXPIRY_OPTIONS.map(expiryOptionLabel)).toEqual(['30 days', '90 days', '180 days']);
  });
});
