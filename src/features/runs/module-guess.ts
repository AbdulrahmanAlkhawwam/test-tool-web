import type { ModuleRef } from '@/lib/types';

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Pre-selects a module for "Create test case from this": the module whose code or name matches a folder or the
 * file name of the test (most specific first), e.g. e2e/checkout/pay.spec.ts → Checkout. Falls back to the first module.
 */
export function guessModuleId(file: string | null | undefined, modules: ModuleRef[]): string {
  const parts = (file ?? '')
    .split('/')
    .map((part) => normalize(part.replace(/(\.(spec|test))?\.[a-z]+$/i, '')))
    .filter(Boolean)
    .reverse();
  for (const part of parts) {
    const match = modules.find((m) => normalize(m.code) === part || normalize(m.name) === part);
    if (match) return match.id;
  }
  return modules[0]?.id ?? '';
}

/** Test case name max length, matching the create-case-from-result form (spec: create-case name). */
export const CASE_NAME_MAX_LENGTH = 300;

/**
 * A readable case name from an automated test title: Playwright joins nested `describe`/`test` titles with
 * " › ", so only the last segment (the test itself) is kept, then @tags and extra spaces are dropped, and
 * the result is capped at CASE_NAME_MAX_LENGTH characters.
 */
export function caseNameFromTitle(title: string | null | undefined): string {
  const own = (title ?? '').split(' › ').pop() ?? '';
  return own
    .replace(/@[\w-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CASE_NAME_MAX_LENGTH);
}
