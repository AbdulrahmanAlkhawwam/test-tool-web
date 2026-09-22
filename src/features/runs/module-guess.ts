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

/** A readable case name from an automated test title: drops @tags and extra spaces. */
export function caseNameFromTitle(title: string | null | undefined): string {
  return (title ?? '')
    .replace(/@[\w-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
