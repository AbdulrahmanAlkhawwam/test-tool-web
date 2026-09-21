import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TreeNode } from './file-tree';
import { FileTreeView } from './file-tree-view';

const nodes: TreeNode[] = [
  { name: 'login.spec.ts', path: 'e2e/login.spec.ts', type: 'blob', children: [] },
  { name: 'home.spec.ts', path: 'e2e/home.spec.ts', type: 'blob', children: [] },
];

describe('FileTreeView', () => {
  it('shows how many test cases a file covers, and hides the badge for files that cover none', () => {
    render(
      <FileTreeView nodes={nodes} testsPath="e2e" selectedPath={null} onSelect={vi.fn()} caseCounts={{ 'e2e/login.spec.ts': 2 }} />,
    );

    expect(screen.getByTitle('Covers 2 test cases')).toHaveTextContent('2');
    expect(screen.queryAllByTitle(/Covers/)).toHaveLength(1);
  });

  it('uses the singular "test case" for a count of one', () => {
    render(
      <FileTreeView nodes={nodes} testsPath="e2e" selectedPath={null} onSelect={vi.fn()} caseCounts={{ 'e2e/login.spec.ts': 1 }} />,
    );

    expect(screen.getByTitle('Covers 1 test case')).toBeInTheDocument();
  });
});
