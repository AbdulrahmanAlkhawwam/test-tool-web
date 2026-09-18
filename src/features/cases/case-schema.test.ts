import { describe, expect, it } from 'vitest';
import type { TestCase } from '@/lib/types';
import { caseSchema, toCaseInput, toFormValues } from './case-schema';

const valid = {
  moduleId: 'm1',
  name: '  Login with valid email ',
  description: '',
  preconditions: 'User has a registered account',
  steps: '1. Open Login\n2. Enter credentials\n3. Tap Login',
  testData: '',
  expectedResult: 'User reaches organization screen',
  priority: 'HIGH' as const,
  notes: '   ',
};

describe('case schema', () => {
  it('requires a module and a name', () => {
    const result = caseSchema.safeParse({ ...valid, moduleId: '', name: '   ' });
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((i) => i.message);
    expect(messages).toEqual(expect.arrayContaining(['Choose a module', 'Test case name is required']));
  });

  it('converts form values to API input: trims, keeps line breaks, empty → null', () => {
    const values = caseSchema.parse(valid);
    expect(toCaseInput(values)).toEqual({
      moduleId: 'm1',
      name: 'Login with valid email',
      description: null,
      preconditions: 'User has a registered account',
      steps: '1. Open Login\n2. Enter credentials\n3. Tap Login',
      testData: null,
      expectedResult: 'User reaches organization screen',
      priority: 'HIGH',
      notes: null,
    });
  });

  it('builds form defaults from a case or a default module', () => {
    expect(toFormValues(undefined, 'm9')).toMatchObject({ moduleId: 'm9', name: '', priority: 'MEDIUM', steps: '' });
    const tc = { moduleId: 'm1', name: 'X', description: null, preconditions: null, steps: 'a\nb', testData: null, expectedResult: 'Y', priority: 'LOW', notes: null } as TestCase;
    expect(toFormValues(tc)).toEqual({
      moduleId: 'm1', name: 'X', description: '', preconditions: '', steps: 'a\nb', testData: '', expectedResult: 'Y', priority: 'LOW', notes: '',
    });
  });
});
