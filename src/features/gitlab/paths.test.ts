import { describe, expect, it } from 'vitest';
import { mainBranch, mergeRequest, workBranch } from '@/test/fixtures';
import {
  byteLength,
  initialBranch,
  joinPath,
  languageFor,
  newFilePathError,
  normalizeFolder,
  reportUrlFromArtifacts,
  slugFromWorkBranch,
  slugify,
  testsFolderError,
  workBranchName,
} from './paths';

describe('gitlab paths', () => {
  it('turns a work name into a short branch slug', () => {
    expect(slugify('Login fixes')).toBe('login-fixes');
    expect(slugify('  Checkout: 3DS / retry!! ')).toBe('checkout-3ds-retry');
    expect(slugify('Café crème')).toBe('cafe-creme');
    expect(slugify('تجربة')).toBe('');
    expect(slugify(`${'x'.repeat(39)} yz`)).toBe('x'.repeat(39));
  });

  it('names work branches and recognises the user’s own', () => {
    expect(workBranchName('amina', 'login-fixes')).toBe('tests/amina/login-fixes');
    expect(workBranchName('Tess.Dev', 'x')).toBe('tests/tess.dev/x');
    expect(slugFromWorkBranch('tests/tess.dev/x', 'Tess.Dev')).toBe('x');
    expect(slugFromWorkBranch('tests/amina/login-fixes', 'amina')).toBe('login-fixes');
    expect(slugFromWorkBranch('tests/omar/login-fixes', 'amina')).toBeNull();
    expect(slugFromWorkBranch('tests/amina/', 'amina')).toBeNull();
    expect(slugFromWorkBranch('main', 'amina')).toBeNull();
    // "tess" must not be treated as a prefix of "tess-dev": the "/" after the username is the real boundary.
    expect(slugFromWorkBranch('tests/tess-dev/foo', 'tess')).toBeNull();
  });

  it('opens the user’s work branch first, else the default branch', () => {
    const closed = { ...workBranch, name: 'tests/amina/old', mergeRequest: { ...mergeRequest, state: 'merged' as const } };
    expect(initialBranch([mainBranch, closed, workBranch], 'amina', 'main')).toBe('tests/amina/login-fixes');
    expect(initialBranch([mainBranch, closed], 'amina', 'main')).toBe('tests/amina/old');
    expect(initialBranch([mainBranch, workBranch], 'omar', 'main')).toBe('main');
    expect(initialBranch([], 'amina', 'develop')).toBe('develop');
  });

  it('accepts only test files inside the tests folder', () => {
    expect(newFilePathError('auth/login.spec.ts')).toBeNull();
    expect(newFilePathError('helpers/api.ts')).toBeNull();
    expect(newFilePathError('fixtures.js')).toBeNull();
    expect(newFilePathError('')).toBe('Enter a file name, e.g. auth/login.spec.ts');
    expect(newFilePathError('../secrets.spec.ts')).toBe('The path can’t contain empty, "." or ".." parts');
    expect(newFilePathError('a/../b.ts')).toBe('The path can’t contain empty, "." or ".." parts');
    expect(newFilePathError('a//b.ts')).toBe('The path can’t contain empty, "." or ".." parts');
    expect(newFilePathError('/abs.spec.ts')).toBe('Use a path relative to the tests folder, with forward slashes');
    expect(newFilePathError('a\\b.ts')).toBe('Use a path relative to the tests folder, with forward slashes');
    expect(newFilePathError('bad name.ts')).toBe('Use letters, numbers, ".", "-", "_" and "/" only');
    expect(newFilePathError('notes.md')).toBe('The file must end in .spec.ts, .test.ts, .ts or .js');
  });

  it('normalizes and validates the tests folder', () => {
    expect(normalizeFolder('/e2e/')).toBe('e2e');
    expect(normalizeFolder('./e2e')).toBe('e2e');
    expect(normalizeFolder('e2e\\smoke')).toBe('e2e/smoke');
    expect(testsFolderError('e2e')).toBeNull();
    expect(testsFolderError('  ')).toBe('Enter the tests folder, e.g. e2e');
    expect(testsFolderError('../other')).toBe('Use a folder inside the repository (no "..")');
    expect(joinPath('e2e/', 'auth/login.spec.ts')).toBe('e2e/auth/login.spec.ts');
    expect(joinPath('', 'login.spec.ts')).toBe('login.spec.ts');
  });

  it('picks the editor language from the extension', () => {
    expect(languageFor('e2e/login.spec.ts')).toBe('typescript');
    expect(languageFor('e2e/helpers.mjs')).toBe('javascript');
    expect(languageFor('e2e/data.json')).toBe('json');
    expect(languageFor('.gitlab-ci.yml')).toBe('yaml');
    expect(languageFor('e2e/README')).toBe('plaintext');
  });

  it('derives the Playwright report link from a job artifacts URL', () => {
    const browse = 'https://git.ejad.net/mobile/ninja-store/-/jobs/55/artifacts/browse';
    const report = 'https://git.ejad.net/mobile/ninja-store/-/jobs/55/artifacts/file/playwright-report/index.html';
    expect(reportUrlFromArtifacts(browse)).toBe(report);
    expect(reportUrlFromArtifacts(`${browse}/test-results`)).toBe(report);
    expect(reportUrlFromArtifacts('https://example.com/other')).toBeNull();
    expect(byteLength('é')).toBe(2);
  });
});
