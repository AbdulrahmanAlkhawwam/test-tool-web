import type { AutomationBranch } from '@/lib/types';

/** Files larger than this open read-only (GitLab spec §6). */
export const MAX_EDITABLE_BYTES = 1024 * 1024;

/** A short work name ("Login fixes") → a branch slug ("login-fixes"): a–z, 0–9 and dashes, at most 40 characters. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

/** `tests/<username>-`, with the username normalized exactly like the API's workBranchPrefix. */
export function workBranchPrefix(username: string): string {
  return `tests/${username.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}-`;
}

export function workBranchName(username: string, slug: string): string {
  return `${workBranchPrefix(username)}${slug}`;
}

/** The slug of one of the user's work branches (`tests/<username>-<slug>`), or null for any other branch. */
export function slugFromWorkBranch(branch: string, username: string): string | null {
  const prefix = workBranchPrefix(username);
  return branch.startsWith(prefix) && branch.length > prefix.length ? branch.slice(prefix.length) : null;
}

/** The branch the Automation tab opens on: the user's work branch (one with an open MR first), else the default. */
export function initialBranch(branches: AutomationBranch[], username: string, defaultBranch: string): string {
  const own = branches.filter((b) => !b.isDefault && slugFromWorkBranch(b.name, username));
  const preferred = own.find((b) => b.mergeRequest?.state === 'opened') ?? own[0];
  return preferred?.name ?? branches.find((b) => b.isDefault)?.name ?? defaultBranch;
}

/** "e2e/", "/e2e", "./e2e" and "e2e\" all mean "e2e". */
export function normalizeFolder(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+|\/+$/g, '');
}

export function testsFolderError(path: string): string | null {
  const folder = normalizeFolder(path);
  if (!folder) return 'Enter the tests folder, e.g. e2e';
  if (folder.split('/').some((s) => s === '' || s === '.' || s === '..')) return 'Use a folder inside the repository (no "..")';
  return null;
}

const NEW_FILE_EXTENSIONS = ['.spec.ts', '.test.ts', '.ts', '.js'];

/** Validates a new file path typed relative to the tests folder (spec §6). The API validates it again. */
export function newFilePathError(relative: string): string | null {
  const path = relative.trim();
  if (!path) return 'Enter a file name, e.g. auth/login.spec.ts';
  if (path.startsWith('/') || path.includes('\\')) return 'Use a path relative to the tests folder, with forward slashes';
  if (path.split('/').some((s) => s === '' || s === '.' || s === '..')) return 'The path can’t contain empty, "." or ".." parts';
  if (!/^[A-Za-z0-9._\-/]+$/.test(path)) return 'Use letters, numbers, ".", "-", "_" and "/" only';
  if (!NEW_FILE_EXTENSIONS.some((ext) => path.endsWith(ext))) return 'The file must end in .spec.ts, .test.ts, .ts or .js';
  return null;
}

export function joinPath(folder: string, relative: string): string {
  const base = normalizeFolder(folder);
  const rest = relative.trim().replace(/^\/+/, '');
  return base ? `${base}/${rest}` : rest;
}

export function languageFor(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'mts':
    case 'cts':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'md':
      return 'markdown';
    default:
      return 'plaintext';
  }
}

/** The Playwright HTML report inside a job's artifacts, from that job's artifacts-browser URL (spec §7). */
export function reportUrlFromArtifacts(artifactsUrl: string): string | null {
  const match = /^(.*\/-\/jobs\/\d+\/artifacts)\/browse(?:\/.*)?$/.exec(artifactsUrl);
  return match ? `${match[1]}/file/playwright-report/index.html` : null;
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
