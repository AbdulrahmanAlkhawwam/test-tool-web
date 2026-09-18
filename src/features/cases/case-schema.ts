import { z } from 'zod';
import type { Priority, TestCase } from '@/lib/types';

const text = (max: number) => z.string().max(max, `Keep it under ${max} characters`);

export const caseSchema = z.object({
  moduleId: z.string().min(1, 'Choose a module'),
  name: z.string().trim().min(1, 'Test case name is required').max(300),
  description: text(5000),
  preconditions: text(5000),
  steps: text(10000),
  testData: text(5000),
  expectedResult: text(5000),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  notes: text(5000),
});

export type CaseFormValues = z.infer<typeof caseSchema>;

export interface CaseInput {
  moduleId: string;
  name: string;
  description: string | null;
  preconditions: string | null;
  steps: string | null;
  testData: string | null;
  expectedResult: string | null;
  priority: Priority;
  notes: string | null;
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

export function toCaseInput(values: CaseFormValues): CaseInput {
  return {
    moduleId: values.moduleId,
    name: values.name.trim(),
    description: orNull(values.description),
    preconditions: orNull(values.preconditions),
    steps: orNull(values.steps),
    testData: orNull(values.testData),
    expectedResult: orNull(values.expectedResult),
    priority: values.priority,
    notes: orNull(values.notes),
  };
}

export function toFormValues(testCase?: TestCase, defaultModuleId = ''): CaseFormValues {
  return {
    moduleId: testCase?.moduleId ?? defaultModuleId,
    name: testCase?.name ?? '',
    description: testCase?.description ?? '',
    preconditions: testCase?.preconditions ?? '',
    steps: testCase?.steps ?? '',
    testData: testCase?.testData ?? '',
    expectedResult: testCase?.expectedResult ?? '',
    priority: testCase?.priority ?? 'MEDIUM',
    notes: testCase?.notes ?? '',
  };
}
