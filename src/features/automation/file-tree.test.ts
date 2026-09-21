import { describe, expect, it } from 'vitest';
import type { AutomationTreeEntry } from '@/lib/types';
import { ancestorFolders, buildFileTree, type TreeNode } from './file-tree';

type Shape = string | { [folder: string]: Shape[] };
const shape = (nodes: TreeNode[]): Shape[] => nodes.map((n) => (n.type === 'tree' ? { [n.name]: shape(n.children) } : n.name));
const blob = (path: string): AutomationTreeEntry => ({ path, name: path.slice(path.lastIndexOf('/') + 1), type: 'blob' });
const tree = (path: string): AutomationTreeEntry => ({ path, name: path.slice(path.lastIndexOf('/') + 1), type: 'tree' });

describe('buildFileTree', () => {
  it('nests entries under the tests folder, folders first, in natural order', () => {
    const nodes = buildFileTree(
      [
        tree('e2e'),
        blob('e2e/home.spec.ts'),
        tree('e2e/auth'),
        blob('e2e/auth/login.spec.ts'),
        blob('e2e/auth/2fa.spec.ts'),
        blob('e2e/auth/10-reset.spec.ts'),
      ],
      'e2e/',
    );
    expect(shape(nodes)).toEqual([{ auth: ['2fa.spec.ts', '10-reset.spec.ts', 'login.spec.ts'] }, 'home.spec.ts']);
    expect(nodes[0].path).toBe('e2e/auth');
    expect(nodes[0].children[2].path).toBe('e2e/auth/login.spec.ts');
  });

  it('adds missing parent folders and ignores files outside the tests folder', () => {
    const nodes = buildFileTree([blob('e2e/checkout/pay.spec.ts'), blob('e2e2/other.spec.ts'), blob('README.md')], 'e2e');
    expect(shape(nodes)).toEqual([{ checkout: ['pay.spec.ts'] }]);
    expect(buildFileTree([], 'e2e')).toEqual([]);
  });

  it('lists the folders to open for a nested file', () => {
    expect(ancestorFolders('e2e/auth/flows/login.spec.ts', 'e2e')).toEqual(['e2e/auth', 'e2e/auth/flows']);
    expect(ancestorFolders('e2e/home.spec.ts', 'e2e')).toEqual([]);
    expect(ancestorFolders('auth/login.spec.ts', '')).toEqual(['auth']);
  });
});
