import type { CodeEditorProps } from '@/features/automation/code-editor';

/** Stand-in for Monaco in component tests: `vi.mock('./code-editor', () => import('@/test/code-editor-mock'))`. */
export function CodeEditor({ value, readOnly, onChange }: CodeEditorProps) {
  return <textarea aria-label="Code editor" value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />;
}
