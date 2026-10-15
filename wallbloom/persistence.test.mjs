import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {atomic, persist, readPersistent} from './persistence.mjs';

test('concurrent atomic writes preserve whole JSON and remove temporary files', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wallwave-persistence-'));
  t.after(() => fs.rm(dir, {recursive: true, force: true}));
  const file = path.join(dir, 'state.json');
  await Promise.all(Array.from({length: 20}, (_, index) => atomic(file, {index, data: 'x'.repeat(10000)})));
  const saved = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.ok(Number.isInteger(saved.index));
  assert.equal(saved.data.length, 10000);
  assert.deepEqual(await fs.readdir(dir), ['state.json']);
  await persist(file, {restored: true});
  await fs.writeFile(file, '{interrupted');
  assert.deepEqual(await readPersistent(file), {restored: true});
});
