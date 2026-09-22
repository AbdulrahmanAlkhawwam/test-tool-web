import { describe, expect, it } from 'vitest';
import { caseNameFromTitle, guessModuleId } from './module-guess';

const modules = [
  { id: 'm1', name: 'Authentication', code: 'AUTH' },
  { id: 'm2', name: 'Checkout', code: 'CHK' },
  { id: 'm3', name: 'User Profile', code: 'PROFILE' },
];

describe('module guess', () => {
  it("guesses the module from the test file's folders and name", () => {
    expect(guessModuleId('e2e/checkout/pay.spec.ts', modules)).toBe('m2');
    expect(guessModuleId('e2e/auth/login.spec.ts', modules)).toBe('m1');
    expect(guessModuleId('e2e/user-profile.spec.ts', modules)).toBe('m3');
    expect(guessModuleId('e2e/misc/other.spec.ts', modules)).toBe('m1');
    expect(guessModuleId(null, modules)).toBe('m1');
    expect(guessModuleId('e2e/x.spec.ts', [])).toBe('');
  });

  it('turns a test title into a case name', () => {
    expect(caseNameFromTitle('checkout pays with card @smoke @TC-CHK-9')).toBe('checkout pays with card');
    expect(caseNameFromTitle('  Login   works  ')).toBe('Login works');
    expect(caseNameFromTitle(null)).toBe('');
  });
});
