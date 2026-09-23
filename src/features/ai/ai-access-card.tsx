'use client';

import { useState } from 'react';
import { NewTokenDialog } from './new-token-dialog';
import { SetupSnippets } from './setup-snippets';
import { TokenReveal } from './token-reveal';

/**
 * Profile → AI access (spec §8). The only place the full token exists is `created` below: it is set from
 * the create mutation's result, shown once, and dropped when the tester clicks Done.
 */
export function AiAccessCard() {
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);

  return (
    <section aria-labelledby="ai-access-heading" className="space-y-5 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 id="ai-access-heading" className="font-medium">
            AI access
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect Claude Code, Claude Desktop or Cursor to this tool with a personal token. The AI can read projects and write
            test cases as <strong className="font-medium">AI drafts</strong> for you to approve — it can never delete a case,
            approve a draft or record a result.
          </p>
        </div>
        <NewTokenDialog onCreated={setCreated} />
      </div>

      {created && <TokenReveal name={created.name} token={created.token} onDismiss={() => setCreated(null)} />}

      <SetupSnippets token={created?.token ?? null} />
    </section>
  );
}
