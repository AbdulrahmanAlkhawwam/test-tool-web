import { describe, expect, it } from 'vitest';
import { buildSelection, defaultRunName, selectionError, SelectionState } from './run-selection';

const base: SelectionState = { mode: 'ALL', moduleIds: ['m1'], priorities: ['HIGH'], caseIds: ['c1'] };

describe('run selection', () => {
  it('sends only the field that belongs to the mode', () => {
    expect(buildSelection(base)).toEqual({ mode: 'ALL' });
    expect(buildSelection({ ...base, mode: 'MODULES' })).toEqual({ mode: 'MODULES', moduleIds: ['m1'] });
    expect(buildSelection({ ...base, mode: 'PRIORITIES' })).toEqual({ mode: 'PRIORITIES', priorities: ['HIGH'] });
    expect(buildSelection({ ...base, mode: 'CASES' })).toEqual({ mode: 'CASES', caseIds: ['c1'] });
  });

  it('explains what is missing', () => {
    expect(selectionError(base)).toBeNull();
    expect(selectionError({ ...base, mode: 'MODULES', moduleIds: [] })).toBe('Choose at least one module');
    expect(selectionError({ ...base, mode: 'PRIORITIES', priorities: [] })).toBe('Choose at least one priority');
    expect(selectionError({ ...base, mode: 'CASES', caseIds: [] })).toBe('Choose at least one test case');
  });

  it('suggests a dated run name', () => {
    expect(defaultRunName(new Date(2026, 8, 18))).toBe('Run 18 Sep 2026');
  });
});
