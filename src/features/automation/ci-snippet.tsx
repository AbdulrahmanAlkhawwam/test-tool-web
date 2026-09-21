'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useCiSnippet } from '@/features/gitlab/api';

/** The provided `.gitlab-ci.yml` job (spec §7), with a copy button. */
export function CiSnippet({ projectId }: { projectId: string }) {
  const snippet = useCiSnippet(projectId);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    if (!snippet.data) return;
    try {
      await navigator.clipboard.writeText(snippet.data);
      setCopied(true);
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.');
    }
  }

  return (
    <section aria-labelledby="ci-heading" className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 id="ci-heading" className="font-medium">
            CI job for GitLab
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add this job to the repository&apos;s <code className="font-mono">.gitlab-ci.yml</code> once. &quot;Run tests&quot; starts it with the run&apos;s
            scope. Set the image tag to match the repository&apos;s <code className="font-mono">@playwright/test</code> version.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void copy()} disabled={!snippet.data}>
          {copied ? <Check className="mr-1.5 h-4 w-4" aria-hidden /> : <Copy className="mr-1.5 h-4 w-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {snippet.isPending ? (
        <LoadingState />
      ) : snippet.isError ? (
        <ErrorState error={snippet.error} onRetry={() => snippet.refetch()} />
      ) : (
        <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
          <code>{snippet.data}</code>
        </pre>
      )}
    </section>
  );
}
