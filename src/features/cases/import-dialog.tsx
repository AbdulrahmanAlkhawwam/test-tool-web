'use client';

import { FileUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import type { ImportPreview, ProjectDetail } from '@/lib/types';
import { useConfirmImport, usePreviewImport } from './api';
import { ImportPreviewTable } from './import-preview-table';

export function ImportDialog({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [createImportedRun, setCreateImportedRun] = useState(false);
  const [runName, setRunName] = useState('');
  const previewMutation = usePreviewImport(project.id);
  const confirmMutation = useConfirmImport(project.id);

  function reset() {
    setPreview(null);
    setDuplicateStrategy('skip');
    setCreateImportedRun(false);
    setRunName('');
    previewMutation.reset();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setPreview(await previewMutation.mutateAsync(file));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not read the file');
    }
  }

  async function confirm() {
    if (!preview) return;
    try {
      const result = await confirmMutation.mutateAsync({
        importId: preview.importId,
        duplicateStrategy,
        createImportedRun,
        runName: createImportedRun && runName.trim() ? runName.trim() : undefined,
      });
      toast.success(`Imported: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
      setOpen(false);
      reset();
      if (result.runId) router.push(`/projects/${project.key}/runs/${result.runId}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Import failed');
      if (e instanceof ApiError && e.status === 404) reset(); // preview expired – start over
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp className="mr-1.5 h-4 w-4" aria-hidden />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import test cases</DialogTitle>
          <DialogDescription>
            Upload an .xlsx or .csv file in the Ejad template (ID, Module, Test Case Name, … , Status, Notes). Nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-2">
            <Label htmlFor="import-file">File</Label>
            <Input
              id="import-file"
              type="file"
              accept=".xlsx,.csv"
              disabled={previewMutation.isPending}
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            {previewMutation.isPending && <p className="text-sm text-muted-foreground">Reading file…</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <ImportPreviewTable preview={preview} />
            {preview.summary.duplicates > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Rows whose ID already exists</legend>
                {(['skip', 'update'] as const).map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="duplicates"
                      value={value}
                      checked={duplicateStrategy === value}
                      onChange={() => setDuplicateStrategy(value)}
                      className="accent-[hsl(var(--primary))]"
                    />
                    {value === 'skip' ? 'Skip them (keep the existing test cases)' : 'Update the existing test cases from the file'}
                  </label>
                ))}
              </fieldset>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="imported-run" checked={createImportedRun} onCheckedChange={(v) => setCreateImportedRun(v === true)} />
                <Label htmlFor="imported-run" className="font-normal">
                  Also create a completed run from the Status and Actual Result columns
                </Label>
              </div>
              {createImportedRun && (
                <Input aria-label="Run name" placeholder={`Imported ${new Date().toISOString().slice(0, 10)}`} value={runName} onChange={(e) => setRunName(e.target.value)} />
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {preview && (
            <Button variant="ghost" onClick={reset}>
              Choose another file
            </Button>
          )}
          <Button disabled={!preview || preview.summary.valid === 0 || confirmMutation.isPending} onClick={() => void confirm()}>
            {confirmMutation.isPending ? 'Importing…' : `Import ${preview?.summary.valid ?? ''} rows`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
