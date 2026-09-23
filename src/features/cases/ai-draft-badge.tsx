import { Bot } from 'lucide-react';

/** Marks a case the AI wrote and nobody has approved yet (spec §6, §8). */
export function AiDraftBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
      title="Written by AI. It stays out of runs, reports and exports until someone approves it."
    >
      <Bot className="h-3 w-3" aria-hidden />
      AI draft
    </span>
  );
}
