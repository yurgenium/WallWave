import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');

// With mismatched names a deployment check would run against the user's real installation.
test('launcher, application and deployment check use the same test variables', () => {
  const launcher = read('./desktop/deploy.nsi');
  const used = text => [...text.matchAll(/\b(WALL\w+_DESKTOP_TEST(?:_HOME)?)\b/g)].map(match => match[1]);
  assert.deepEqual([...new Set(used(launcher))].sort(), ['WALLWAVE_DESKTOP_TEST', 'WALLWAVE_DESKTOP_TEST_HOME']);
  for (const name of ['WALLWAVE_DESKTOP_TEST', 'WALLWAVE_DESKTOP_TEST_HOME']) {
    assert.ok(used(read('./tools/check-deployment.mjs')).includes(name), name + ' is missing from the check');
    assert.ok(used(read('./desktop/main.cjs')).includes(name), name + ' is missing from the application');
  }
});
