import { normalizeFolder } from '@/features/gitlab/paths';
import type { AutomationTreeEntry } from '@/lib/types';

export interface TreeNode {
  name: string;
  /** Repository-relative path (what the file and coverage endpoints use). */
  path: string;
  type: 'tree' | 'blob';
  children: TreeNode[];
}

const parentOf = (path: string) => {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? '' : path.slice(0, cut);
};

function sortNodes(nodes: TreeNode[]): void {
  nodes.sort((a, b) =>
    a.type !== b.type ? (a.type === 'tree' ? -1 : 1) : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
  nodes.forEach((n) => sortNodes(n.children));
}

/** Nests GitLab's flat recursive tree under `testsPath`. Folders come first, then natural-sorted names. */
export function buildFileTree(entries: AutomationTreeEntry[], testsPath: string): TreeNode[] {
  const root = normalizeFolder(testsPath);
  const prefix = root ? `${root}/` : '';
  const top: TreeNode[] = [];
  const folders = new Map<string, TreeNode>();

  // Returns the children list of the folder at `path`, creating it (and its parents) when missing.
  function childrenOf(path: string): TreeNode[] {
    if (path === root) return top;
    const existing = folders.get(path);
    if (existing) return existing.children;
    const node: TreeNode = { name: path.slice(path.lastIndexOf('/') + 1), path, type: 'tree', children: [] };
    folders.set(path, node);
    childrenOf(parentOf(path)).push(node);
    return node.children;
  }

  for (const entry of entries) {
    const path = normalizeFolder(entry.path);
    if (path === root || !path.startsWith(prefix)) continue;
    if (entry.type === 'tree') {
      childrenOf(path);
    } else {
      childrenOf(parentOf(path)).push({ name: path.slice(path.lastIndexOf('/') + 1), path, type: 'blob', children: [] });
    }
  }
  sortNodes(top);
  return top;
}

/** The folders between the tests folder and `path` that must be open to show it. */
export function ancestorFolders(path: string, testsPath: string): string[] {
  const root = normalizeFolder(testsPath);
  const parts = normalizeFolder(path).split('/');
  const folders: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    const folder = parts.slice(0, i).join('/');
    if (root && (folder === root || !folder.startsWith(`${root}/`))) continue;
    folders.push(folder);
  }
  return folders;
}
