import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The README download button must point at the version being released.
test('README download links match package.json version', () => {
  const {version} = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const linked = [...readme.matchAll(/releases\/(?:download|tag)\/v(\d+\.\d+\.\d+)/g)].map(m => m[1]);
  assert.ok(linked.length > 0, 'README has release links');
  assert.deepEqual([...new Set(linked)], [version]);
  assert.ok(readme.includes(`· ${version} ·`), 'README badge shows current version');
});
