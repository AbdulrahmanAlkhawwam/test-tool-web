import type { AutomationBranch } from '@/lib/types';

interface BranchSelectProps {
  id?: string;
  branches: AutomationBranch[];
  value: string;
  onChange: (branch: string) => void;
  disabled?: boolean;
}

/** A native select (simple to use and to test). The current value stays listed until the branch list catches up. */
export function BranchSelect({ id = 'automation-branch', branches, value, onChange, disabled }: BranchSelectProps) {
  const options = !value || branches.some((b) => b.name === value) ? branches : [...branches, { name: value, isDefault: false, mergeRequest: null }];
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        Branch
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-0 max-w-[20rem] rounded-md border border-input bg-background px-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {options.map((b) => (
          <option key={b.name} value={b.name}>
            {b.name}
            {b.isDefault ? ' (default)' : ''}
            {b.mergeRequest ? ` · MR !${b.mergeRequest.iid}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
