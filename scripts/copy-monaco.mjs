// Copies Monaco's AMD build into public/monaco/vs so the editor loads from this site (no CDN and no
// third-party script origin to allow in a Content-Security-Policy). Runs before `dev` and `build`.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'monaco-editor', 'min', 'vs');
const target = join(root, 'public', 'monaco', 'vs');

if (!existsSync(source)) {
  console.error('monaco-editor is not installed. Run npm install first.');
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log('Copied Monaco editor to public/monaco/vs');
