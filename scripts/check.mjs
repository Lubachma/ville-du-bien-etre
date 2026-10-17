import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const name of ['app.js', 'sw.js', ...(await readdir(path.join(root, 'src'))).filter(n => n.endsWith('.js')).map(n => 'src/' + n)]) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, name)], { encoding: 'utf8' });
  if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(1); }
}
JSON.parse(await readFile(path.join(root, 'manifest.webmanifest'), 'utf8'));
console.log('JavaScript syntax and manifest valid.');
