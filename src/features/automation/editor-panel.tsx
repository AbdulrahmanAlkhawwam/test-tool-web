'use client';

import { Copy, RefreshCw, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useAutomationFile, useSaveAutomationFile } from '@/features/gitlab/api';
import { byteLength, languageFor, MAX_EDITABLE_BYTES, slugFromWorkBranch } from '@/features/gitlab/paths';
import { ApiError } from '@/lib/api';
import type { AutomationFile, SaveFileResult } from '@/lib/types';
import { CodeEditor } from './code-editor';
import { WorkNameDialog } from './work-name-dialog';

const STALE_MESSAGE = 'This file changed on the branch – reload it before saving';

export const NEW_FILE_TEMPLATE = `import { expect, test } from '@playwright/test';

// Tag each test with the test case it covers, e.g. @TC-AUTH-001, so automated runs fill in that case's result.
test('describe what the test checks @TC-XXX-000', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});
`;

interface Edit {
  /** The version the edit started from. Its lastCommitId is sent with the save for the conflict check. */
  base: AutomationFile;
  draft: string;
}

interface EditorPanelProps {
  projectId: string;
  branch: string;
  /** Repository-relative path inside the tests folder. */
  path: string;
  /** A file made with "New file" that doesn't exist in GitLab yet. */
  isNew: boolean;
  /** The user's GitLab username: their work branches are tests/<username>/<slug>. */
  username: string;
  onSaved: (result: SaveFileResult) => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function EditorPanel({ projectId, branch, path, isNew, username, onSaved, onDirtyChange }: EditorPanelProps) {
  const file = useAutomationFile(projectId, branch, isNew ? null : path);
  const save = useSaveAutomationFile(projectId);
  // null = no local changes, so show the latest loaded version. Once the user types, the edit pins its base
  // and later refetches no longer replace the text. Only "Reload" does that.
  const [edit, setEdit] = useState<Edit | null>(() =>
    isNew
      ? { base: { path, ref: branch, content: '', lastCommitId: '', size: 0, readOnly: false }, draft: NEW_FILE_TEMPLATE }
      : null,
  );
  const [conflict, setConflict] = useState<string | null>(null);
  const [askWorkName, setAskWorkName] = useState(false);

  const current = edit ?? (file.data ? { base: file.data, draft: file.data.content } : null);
  // The API flags files over 1 MB; the size check covers a response without the flag.
  const readOnly = !!current && (current.base.readOnly || current.base.size > MAX_EDITABLE_BYTES);
  const dirty = !!edit && !readOnly && (isNew || edit.draft !== edit.base.content);
  const workSlug = slugFromWorkBranch(branch, username);
  // Lock the editor while the save is in flight: handleSaved switches the branch/isNew right after it resolves,
  // which remounts this panel from the query cache holding only the just-posted content. Blocking edits during
  // the request removes the window where a keystroke could land after that snapshot and be lost.
  const editorReadOnly = readOnly || save.isPending;

  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current(dirty);
  }, [dirty]);
  useEffect(() => () => onDirtyChangeRef.current(false), []);

  async function commit(branchSlug: string) {
    if (!current) return;
    const content = current.draft;
    try {
      const result = await save.mutateAsync({
        path,
        content,
        lastCommitId: isNew ? undefined : current.base.lastCommitId,
        branchSlug,
      });
      setAskWorkName(false);
      // The editor is locked for the duration of the request (see editorReadOnly above), so the draft can't
      // have changed underneath it. The saved text becomes the new base.
      setEdit({
        base: { path, ref: result.branch, content, lastCommitId: result.commitId, size: byteLength(content), readOnly: false },
        draft: content,
      });
      toast.success(
        result.mergeRequest
          ? `Saved to ${result.branch}`
          : `Saved to ${result.branch}. The merge request couldn't be updated – it will be retried on your next save.`,
      );
      onSaved(result);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setAskWorkName(false);
        setConflict(e.message || STALE_MESSAGE);
      } else {
        toast.error(e instanceof ApiError ? e.message : 'Could not save the file');
      }
    }
  }

  function requestSave() {
    if (workSlug) void commit(workSlug);
    else setAskWorkName(true);
  }

  async function reload() {
    const fresh = await file.refetch();
    if (fresh.data) {
      setEdit(null);
      setConflict(null);
    }
  }

  async function copyDraft() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.draft);
      toast.success('Your changes are copied');
    } catch {
      toast.error('Could not copy. Select the text in the editor and copy it by hand.');
    }
  }

  if (!current) {
    if (file.isError) {
      // 413: the file is too large to open here at all (spec §6), distinct from the >1 MB read-only case
      // (which still opens, just not editable). Show it inline instead of the generic error/retry state.
      if (file.error instanceof ApiError && file.error.status === 413) {
        return (
          <div className="space-y-3">
            <p className="min-w-0 flex-1 truncate font-mono text-sm" title={path}>
              {path}
            </p>
            <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {file.error.message}
            </p>
          </div>
        );
      }
      return <ErrorState error={file.error} onRetry={() => file.refetch()} />;
    }
    return <LoadingState label="Opening file…" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 truncate font-mono text-sm" title={path}>
          {path}
          {isNew && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 font-sans text-xs text-accent-foreground">New file</span>}
        </p>
        {save.isPending ? (
          <span className="text-xs text-muted-foreground">Saving…</span>
        ) : (
          dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>
        )}
        <Button onClick={requestSave} disabled={!dirty || !!conflict || save.isPending}>
          <Save className="mr-1.5 h-4 w-4" aria-hidden />
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {!workSlug && !readOnly && (
        <p className="text-xs text-muted-foreground">
          Saving puts your changes on your own work branch with a merge request. Nothing is committed to{' '}
          <span className="font-mono">{branch}</span>.
        </p>
      )}
      {readOnly && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          This file is read-only here (larger than 1 MB, not a .ts/.js file, or not UTF-8 text). Edit it in GitLab.
        </p>
      )}
      {conflict && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-status-blocked/40 bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked-fg"
        >
          <span className="min-w-0 flex-1">
            {conflict.replace(/\.$/, '')}. Reloading replaces your changes, so copy them first if you need them.
          </span>
          <Button size="sm" variant="outline" onClick={() => void copyDraft()}>
            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Copy my changes
          </Button>
          {!isNew && (
            <Button size="sm" onClick={() => void reload()} disabled={file.isFetching}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Reload
            </Button>
          )}
        </div>
      )}
      <CodeEditor
        value={current.draft}
        language={languageFor(path)}
        readOnly={editorReadOnly}
        onChange={(value) => setEdit({ base: current.base, draft: value })}
      />
      <WorkNameDialog
        open={askWorkName}
        onOpenChange={setAskWorkName}
        username={username}
        pending={save.isPending}
        onConfirm={(slug) => void commit(slug)}
      />
    </div>
  );
}
