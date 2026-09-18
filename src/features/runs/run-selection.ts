import { format } from 'date-fns';
import type { Priority, RunSelection, SelectionMode } from '@/lib/types';

export interface SelectionState {
  mode: SelectionMode;
  moduleIds: string[];
  priorities: Priority[];
  caseIds: string[];
}

export function buildSelection(state: SelectionState): RunSelection {
  switch (state.mode) {
    case 'MODULES':
      return { mode: 'MODULES', moduleIds: state.moduleIds };
    case 'PRIORITIES':
      return { mode: 'PRIORITIES', priorities: state.priorities };
    case 'CASES':
      return { mode: 'CASES', caseIds: state.caseIds };
    default:
      return { mode: 'ALL' };
  }
}

export function selectionError(state: SelectionState): string | null {
  if (state.mode === 'MODULES' && !state.moduleIds.length) return 'Choose at least one module';
  if (state.mode === 'PRIORITIES' && !state.priorities.length) return 'Choose at least one priority';
  if (state.mode === 'CASES' && !state.caseIds.length) return 'Choose at least one test case';
  return null;
}

export function defaultRunName(date = new Date()): string {
  return `Run ${format(date, 'd MMM yyyy')}`;
}
