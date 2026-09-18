'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/labels';
import type { ModuleRef, TestCase } from '@/lib/types';
import { useCreateCase, useUpdateCase } from './api';
import { caseSchema, CaseFormValues, toCaseInput, toFormValues } from './case-schema';

interface CaseFormDialogProps {
  projectId: string;
  modules: ModuleRef[];
  testCase?: TestCase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TEXT_FIELDS: { name: keyof CaseFormValues; label: string; rows: number; placeholder?: string }[] = [
  { name: 'description', label: 'Description', rows: 2 },
  { name: 'preconditions', label: 'Preconditions', rows: 2 },
  { name: 'steps', label: 'Test steps', rows: 5, placeholder: '1. Open Login\n2. Enter credentials\n3. Tap Login' },
  { name: 'testData', label: 'Test data', rows: 2 },
  { name: 'expectedResult', label: 'Expected result', rows: 2 },
  { name: 'notes', label: 'Notes', rows: 2 },
];

export function CaseFormDialog({ projectId, modules, testCase, open, onOpenChange }: CaseFormDialogProps) {
  const create = useCreateCase(projectId);
  const update = useUpdateCase(projectId);
  const form = useForm<CaseFormValues>({ resolver: zodResolver(caseSchema), defaultValues: toFormValues(testCase, modules[0]?.id) });
  const { errors, isSubmitting } = form.formState;

  // Reset only when the dialog opens or switches to another case: background refetches
  // hand us new `testCase`/`modules` objects and must not wipe what the user is typing.
  useEffect(() => {
    if (open) form.reset(toFormValues(testCase, modules[0]?.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, testCase?.id]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const input = toCaseInput(values);
      if (testCase) await update.mutateAsync({ id: testCase.id, input });
      else await create.mutateAsync(input);
      toast.success(testCase ? 'Test case updated' : 'Test case created');
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save the test case');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{testCase ? `Edit ${testCase.code}` : 'New test case'}</DialogTitle>
        </DialogHeader>
        <form id="case-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="case-module">Module</Label>
            <Controller
              control={form.control}
              name="moduleId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="case-module" aria-invalid={!!errors.moduleId}>
                    <SelectValue placeholder="Choose a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.moduleId && <p className="text-xs text-destructive">{errors.moduleId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="case-priority">Priority</Label>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="case-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="case-name">Test case name</Label>
            <Input id="case-name" aria-invalid={!!errors.name} {...form.register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          {TEXT_FIELDS.map((f) => (
            <div key={f.name} className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`case-${f.name}`}>{f.label}</Label>
              <Textarea id={`case-${f.name}`} rows={f.rows} placeholder={f.placeholder} {...form.register(f.name)} />
              {errors[f.name] && <p className="text-xs text-destructive">{errors[f.name]?.message}</p>}
            </div>
          ))}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="case-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : testCase ? 'Save changes' : 'Create test case'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
