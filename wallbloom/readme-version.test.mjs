import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Download buttons follow the latest release, so a new version never needs them edited.
for (const name of ['README.md', 'README.en.md']) {
  test(`${name} links to the latest release, not a fixed version`, () => {
    const readme = fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.ok(readme.includes('releases/latest/download/WallWave.exe'));
    assert.deepEqual([...readme.matchAll(/releases\/(?:download|tag)\/v\d+\.\d+\.\d+/g)].map(m => m[0]), []);
  });
}
