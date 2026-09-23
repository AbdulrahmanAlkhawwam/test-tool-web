'use client';

import { CopyButton } from './copy-button';
import { claudeCodeCommand, mcpJsonConfig } from './mcp-setup';

function Snippet({ title, hint, text, copyLabel }: { title: string; hint: React.ReactNode; text: string; copyLabel: string }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium">{title}</h4>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <CopyButton text={text} label={copyLabel} />
      </div>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
        <code>{text}</code>
      </pre>
    </div>
  );
}

/**
 * Setup for Claude Code, Claude Desktop and Cursor (spec §3, §8), built from the real API URL. While a
 * freshly created token is on screen the snippets carry it, so the tester can paste once; afterwards they
 * fall back to the `YOUR_TOKEN` placeholder.
 */
export function SetupSnippets({ token }: { token: string | null }) {
  const command = claudeCodeCommand(token);
  const config = mcpJsonConfig(token);
  return (
    <div className="space-y-5">
      <Snippet title="Claude Code" hint="Run this once in a terminal." text={command} copyLabel="Copy command" />
      <Snippet
        title="Claude Desktop"
        hint={
          <>
            Add to <code className="font-mono">claude_desktop_config.json</code>, then restart Claude Desktop.
          </>
        }
        text={config}
        copyLabel="Copy config"
      />
      <Snippet
        title="Cursor"
        hint={
          <>
            Add the same block to <code className="font-mono">.cursor/mcp.json</code> in your project (or the global one).
          </>
        }
        text={config}
        copyLabel="Copy Cursor config"
      />
    </div>
  );
}
