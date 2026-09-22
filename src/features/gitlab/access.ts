import type { GitlabStatus, ProjectDetail, RepositoryLink } from '@/lib/types';

export function repositoryOf(project: ProjectDetail): RepositoryLink | null {
  const { gitlabProjectId, gitlabPath, gitlabWebUrl, defaultBranch, testsPath } = project;
  if (gitlabProjectId == null || !gitlabPath || !gitlabWebUrl || !defaultBranch || !testsPath) return null;
  return {
    gitlabProjectId,
    gitlabPath,
    gitlabWebUrl,
    defaultBranch,
    testsPath,
    playwrightConfigPath: project.playwrightConfigPath || 'playwright.config.ts',
  };
}

export type AutomationAccess =
  // "disabled": GitLab isn't configured on this server at all (or status hasn't loaded yet).
  // "unlinked": GitLab is enabled, but this project has no linked repository.
  | { state: 'hidden'; reason: 'disabled' | 'unlinked' }
  | { state: 'connect' | 'reconnect'; repo: RepositoryLink }
  | { state: 'ready'; repo: RepositoryLink; username: string };

/**
 * What the GitLab UI may show for a project: nothing (GitLab disabled, status still loading, or no linked
 * repository), a connect/reconnect prompt, or everything (spec §4, §10).
 */
export function automationAccess(status: GitlabStatus | undefined, project: ProjectDetail): AutomationAccess {
  if (!status?.enabled) return { state: 'hidden', reason: 'disabled' };
  const repo = repositoryOf(project);
  if (!repo) return { state: 'hidden', reason: 'unlinked' };
  const connection = status.connection;
  if (!connection) return { state: 'connect', repo };
  if (connection.state === 'NEEDS_RECONNECT') return { state: 'reconnect', repo };
  return { state: 'ready', repo, username: connection.username };
}
