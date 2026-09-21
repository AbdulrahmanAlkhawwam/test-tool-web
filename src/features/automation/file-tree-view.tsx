'use client';

import { ChevronRight, FileCode2, Folder, FolderOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ancestorFolders, type TreeNode } from './file-tree';

interface FileTreeViewProps {
  nodes: TreeNode[];
  testsPath: string;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  /** How many test cases each file covers (by repository path), shown as a small count. */
  caseCounts?: Record<string, number>;
}

interface TreeListProps extends Omit<FileTreeViewProps, 'nodes' | 'testsPath'> {
  nodes: TreeNode[];
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}

function TreeList({ nodes, depth, expanded, onToggle, selectedPath, onSelect, caseCounts }: TreeListProps) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => {
        const indent = { paddingLeft: `${depth * 0.875 + 0.25}rem` };
        if (node.type === 'tree') {
          const open = expanded.has(node.path);
          return (
            <li key={node.path}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onToggle(node.path)}
                style={indent}
                className="flex w-full items-center gap-1.5 rounded py-1 pr-1 text-left text-sm hover:bg-muted"
              >
                <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} aria-hidden />
                {open ? (
                  <FolderOpen className="h-4 w-4 shrink-0 text-brand-deep" aria-hidden />
                ) : (
                  <Folder className="h-4 w-4 shrink-0 text-brand-deep" aria-hidden />
                )}
                <span className="truncate">{node.name}</span>
              </button>
              {open && node.children.length > 0 && (
                <TreeList
                  nodes={node.children}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                  caseCounts={caseCounts}
                />
              )}
            </li>
          );
        }
        const selected = node.path === selectedPath;
        const count = caseCounts?.[node.path] ?? 0;
        return (
          <li key={node.path}>
            <button
              type="button"
              aria-current={selected ? 'true' : undefined}
              onClick={() => onSelect(node.path)}
              style={indent}
              className={cn(
                'flex w-full items-center gap-1.5 rounded py-1 pr-1 text-left text-sm hover:bg-muted',
                selected && 'bg-primary/10 font-medium text-primary hover:bg-primary/15',
              )}
            >
              <span className="w-3.5 shrink-0" aria-hidden />
              <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{node.name}</span>
              {count > 0 && (
                <span className="ml-auto rounded-full bg-accent px-1.5 text-xs text-accent-foreground" title={`Covers ${count} test case${count === 1 ? '' : 's'}`}>
                  <span className="sr-only">covers </span>
                  {count}
                  <span className="sr-only"> test cases</span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function FileTreeView({ nodes, testsPath, selectedPath, onSelect, caseCounts }: FileTreeViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(nodes.filter((n) => n.type === 'tree').map((n) => n.path)));

  // Keep the selected file visible, e.g. after opening it from the coverage list.
  useEffect(() => {
    if (!selectedPath) return;
    const needed = ancestorFolders(selectedPath, testsPath);
    setExpanded((prev) => {
      if (needed.every((p) => prev.has(p))) return prev;
      const next = new Set(prev);
      needed.forEach((p) => next.add(p));
      return next;
    });
  }, [selectedPath, testsPath]);

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <nav aria-label="Test files">
      <TreeList nodes={nodes} depth={0} expanded={expanded} onToggle={toggle} selectedPath={selectedPath} onSelect={onSelect} caseCounts={caseCounts} />
    </nav>
  );
}
