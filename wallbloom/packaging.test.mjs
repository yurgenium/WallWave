import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Every local module the app loads must be listed in build.files, otherwise the
// installed app fails to start while tests from the source folder still pass.
test('all modules reachable from the entry points are packaged', () => {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const patterns = pkg.build.files.filter(f => !f.startsWith('!'));
  const packaged = f => patterns.some(p => p === f || (p.endsWith('/**') && f.startsWith(p.slice(0, -2))));
  const seen = new Set(), queue = [pkg.main, 'server.mjs', 'ai-worker.mjs'], missing = [];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of source.matchAll(/(?:from\s*|import\(\s*|require\(\s*|new URL\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]));
      if (!packaged(target)) missing.push(`${target} (from ${file})`);
      if (/\.[mc]?js$/.test(target)) queue.push(target);
    }
  }
  assert.deepEqual(missing, []);
  assert.ok(seen.size > 20);
});
