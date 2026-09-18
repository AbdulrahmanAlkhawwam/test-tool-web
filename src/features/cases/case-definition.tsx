import type { TestCase } from '@/lib/types';

const FIELDS: { key: keyof TestCase; label: string }[] = [
  { key: 'description', label: 'Description' },
  { key: 'preconditions', label: 'Preconditions' },
  { key: 'steps', label: 'Test steps' },
  { key: 'testData', label: 'Test data' },
  { key: 'expectedResult', label: 'Expected result' },
  { key: 'notes', label: 'Notes' },
];

export function CaseDefinition({ testCase }: { testCase: TestCase }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-[10rem_1fr]">
      {FIELDS.map(({ key, label }) => {
        const value = testCase[key] as string | null;
        return (
          <div key={key} className="contents">
            <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
            <dd className="whitespace-pre-wrap text-sm">{value?.trim() ? value : '—'}</dd>
          </div>
        );
      })}
    </dl>
  );
}
