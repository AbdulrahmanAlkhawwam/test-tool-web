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
  | { state: 'hidden' }
  | { state: 'connect' | 'reconnect'; repo: RepositoryLink }
  | { state: 'ready'; repo: RepositoryLink; username: string };

/**
 * What the GitLab UI may show for a project: nothing (GitLab disabled, status still loading, or no linked
 * repository), a connect/reconnect prompt, or everything (spec §4, §10).
 */
export function automationAccess(status: GitlabStatus | undefined, project: ProjectDetail): AutomationAccess {
  const repo = repositoryOf(project);
  if (!status?.enabled || !repo) return { state: 'hidden' };
  const connection = status.connection;
  if (!connection) return { state: 'connect', repo };
  if (connection.state === 'NEEDS_RECONNECT') return { state: 'reconnect', repo };
  return { state: 'ready', repo, username: connection.username };
}
