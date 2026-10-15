import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let count = 0;
async function check(directory) {
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['desktop', 'public', 'tools'].includes(entry.name)) await check(file);
    } else if (/\.(mjs|cjs|js)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', file], {encoding: 'utf8', windowsHide: true});
      if (result.status !== 0) throw result.error || Error(result.stderr);
      count++;
    }
  }
}
await check(root);
console.log(`Syntax OK: ${count} source, test and tool files.`);
