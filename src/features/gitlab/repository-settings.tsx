'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import type { GitlabProjectOption, ProjectDetail, RepositoryLink } from '@/lib/types';
import { repositoryOf } from './access';
import { useGitlabProjects, useGitlabStatus, useLinkRepository, useUnlinkRepository } from './api';
import { normalizeFolder, testsFolderError } from './paths';

type ChosenProject = Pick<RepositoryLink, 'gitlabProjectId' | 'gitlabPath' | 'gitlabWebUrl'>;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Project Settings → Repository (admins only, GitLab spec §5). Renders nothing while GitLab is disabled. */
export function RepositorySettings({ project }: { project: ProjectDetail }) {
  const status = useGitlabStatus();
  const unlink = useUnlinkRepository(project.id);
  const [unlinkOpen, setUnlinkOpen] = useState(false);

  if (!status.data?.enabled) return null;
  const repo = repositoryOf(project);
  const connection = status.data.connection;

  async function confirmUnlink() {
    try {
      await unlink.mutateAsync();
      toast.success('Repository unlinked');
      setUnlinkOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not unlink the repository');
    }
  }

  return (
    <section aria-labelledby="repository-heading" className="max-w-xl space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h3 id="repository-heading" className="font-medium">
          Repository
        </h3>
        <p className="text-sm text-muted-foreground">
          Link this project to its GitLab repository. Its automated tests then appear on an Automation tab, and testers can run them in GitLab CI.
        </p>
      </div>
      {repo && (
        <p className="text-sm">
          Linked to{' '}
          <a href={repo.gitlabWebUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-primary hover:underline">
            {repo.gitlabPath}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </p>
      )}
      {connection?.state === 'ACTIVE' ? (
        <RepositoryForm project={project} repo={repo} />
      ) : (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {connection ? 'Your GitLab connection needs to be renewed before you can change the link.' : 'Connect your GitLab account to search repositories.'}{' '}
          <Link href="/profile" className="text-primary underline-offset-4 hover:underline">
            Go to Profile
          </Link>
        </p>
      )}
      {repo && (
        <div className="border-t pt-4">
          <Button variant="outline" onClick={() => setUnlinkOpen(true)}>
            Unlink repository
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={unlinkOpen}
        onOpenChange={setUnlinkOpen}
        title={`Unlink ${repo?.gitlabPath ?? 'the repository'}?`}
        description="The Automation tab goes away. Existing runs keep their history, and nothing changes in GitLab."
        confirmLabel="Unlink"
        destructive
        pending={unlink.isPending}
        onConfirm={() => void confirmUnlink()}
      />
    </section>
  );
}

function RepositoryForm({ project, repo }: { project: ProjectDetail; repo: RepositoryLink | null }) {
  const link = useLinkRepository(project.id);
  const [chosen, setChosen] = useState<ChosenProject | null>(
    repo ? { gitlabProjectId: repo.gitlabProjectId, gitlabPath: repo.gitlabPath, gitlabWebUrl: repo.gitlabWebUrl } : null,
  );
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 300);
  const results = useGitlabProjects(chosen ? '' : term);
  const [defaultBranch, setDefaultBranch] = useState(repo?.defaultBranch ?? '');
  const [testsPath, setTestsPath] = useState(repo?.testsPath ?? '');
  const [configPath, setConfigPath] = useState(repo?.playwrightConfigPath ?? 'playwright.config.ts');

  const folderError = testsPath.trim() ? testsFolderError(testsPath) : null;
  const configError = configPath.split('/').includes('..') ? 'Use a path inside the repository (no "..")' : null;
  const canSave =
    !!chosen && !!defaultBranch.trim() && !!testsPath.trim() && !folderError && !!configPath.trim() && !configError && !link.isPending;

  function choose(option: GitlabProjectOption) {
    setChosen({ gitlabProjectId: option.id, gitlabPath: option.pathWithNamespace, gitlabWebUrl: option.webUrl });
    setDefaultBranch(option.defaultBranch ?? 'main');
    setSearch('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen || !canSave) return;
    try {
      await link.mutateAsync({
        gitlabProjectId: chosen.gitlabProjectId,
        defaultBranch: defaultBranch.trim(),
        testsPath: normalizeFolder(testsPath),
        playwrightConfigPath: configPath.trim(),
      });
      toast.success(repo ? 'Repository settings saved' : 'Repository linked');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not link the repository');
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {chosen ? (
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <span className="min-w-0 truncate font-mono text-sm">{chosen.gitlabPath}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setChosen(null)}>
            Change
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="repo-search">GitLab project</Label>
          <Input
            id="repo-search"
            type="search"
            placeholder="Search your GitLab projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {term.length >= 2 &&
            (results.isPending ? (
              <p className="text-xs text-muted-foreground">Searching…</p>
            ) : results.isError ? (
              <p className="text-xs text-destructive">{results.error.message}</p>
            ) : results.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">No projects match “{term}”.</p>
            ) : (
              <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
                {results.data.map((option) => (
                  <li key={option.id}>
                    <button type="button" className="w-full px-3 py-2 text-left hover:bg-muted" onClick={() => choose(option)}>
                      <span className="block font-mono text-sm">{option.pathWithNamespace}</span>
                      <span className="block text-xs text-muted-foreground">
                        {option.name}
                        {option.defaultBranch && ` · default branch ${option.defaultBranch}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="repo-branch">Default branch</Label>
          <Input id="repo-branch" className="font-mono" placeholder="main" value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="repo-tests">Tests folder</Label>
          <Input
            id="repo-tests"
            className="font-mono"
            placeholder="e2e"
            value={testsPath}
            aria-invalid={!!folderError}
            onChange={(e) => setTestsPath(e.target.value)}
          />
          {folderError && <p className="text-xs text-destructive">{folderError}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="repo-config">Playwright config</Label>
        <Input id="repo-config" className="font-mono" value={configPath} aria-invalid={!!configError} onChange={(e) => setConfigPath(e.target.value)} />
        {configError && <p className="text-xs text-destructive">{configError}</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        Testers can edit files only inside the tests folder. Every save goes to their own branch with a merge request, never to the default branch.
      </p>
      <Button type="submit" disabled={!canSave}>
        {link.isPending ? 'Saving…' : repo ? 'Save repository settings' : 'Link repository'}
      </Button>
    </form>
  );
}
