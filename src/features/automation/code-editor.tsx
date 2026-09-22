'use client';

import type { Monaco } from '@monaco-editor/react';
import dynamic from 'next/dynamic';
import { LoadingState } from '@/components/page-state';

export interface CodeEditorProps {
  value: string;
  language: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}

// Monaco needs `window`, so it loads only in the browser. It is served from /monaco/vs (see scripts/copy-monaco.mjs).
const MonacoEditor = dynamic(
  async () => {
    const { default: Editor, loader } = await import('@monaco-editor/react');
    loader.config({ paths: { vs: '/monaco/vs' } });
    return Editor;
  },
  { ssr: false, loading: () => <LoadingState label="Loading editor…" /> },
);

// The repository's own types (e.g. @playwright/test) aren't available in the browser, so show syntax errors only.
function configureTypeScript(monaco: Monaco) {
  const options = { noSemanticValidation: true, noSyntaxValidation: false };
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(options);
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(options);
}

export function CodeEditor({ value, language, readOnly, onChange }: CodeEditorProps) {
  return (
    <div className="h-[60vh] min-h-[320px] overflow-hidden rounded-md border">
      <MonacoEditor
        height="100%"
        value={value}
        language={language}
        theme="vs"
        beforeMount={configureTypeScript}
        onChange={(next) => onChange(next ?? '')}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
          fontSize: 13,
          tabSize: 2,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}
