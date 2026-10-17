import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Only generated, public runtime files belong in the deployable directory.
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const name of ['index.html', 'app.js', 'sw.js', 'styles.css', 'styles-activities.css', 'styles-features.css', 'manifest.webmanifest', '.nojekyll', 'icons', 'fonts']) {
  await cp(path.join(root, name), path.join(output, name), { recursive: true });
}
const html = await readFile(path.join(output, 'index.html'), 'utf8');
if (/https?:\/\//.test(html)) throw new Error('Unexpected absolute network dependency in index.html');
console.log('GitHub Pages artifact prepared in dist/ (relative paths; no server required).');
