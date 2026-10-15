import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const pending = new Map();
function enqueue(file, action) {
  const key = path.resolve(file);
  const task = (pending.get(key) || Promise.resolve()).catch(() => {}).then(action);
  pending.set(key, task);
  const done = () => { if (pending.get(key) === task) pending.delete(key); };
  task.then(done, done);
  return task;
}

// Windows cannot reliably replace the same file from concurrent rename calls.
export function atomic(file, value) {
  const bytes = JSON.stringify(value);
  return enqueue(file, () => writeAtomic(file, bytes));
}

async function writeAtomic(file, bytes) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  let handle;
  try {
    handle = await fs.open(temporary, 'wx');
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temporary, file);
  } finally {
    await handle?.close();
    await fs.rm(temporary, {force: true});
  }
}

export function persist(file, value) {
  const bytes = JSON.stringify(value);
  return enqueue(file, async () => {
    await writeAtomic(file, bytes);
    await writeAtomic(file + '.backup', bytes);
  });
}

export async function readPersistent(file, fallback) {
  let original;
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    original = error;
  }
  try {
    const value = JSON.parse(await fs.readFile(file + '.backup', 'utf8'));
    console.log('Restored saved data from backup: ' + path.basename(file));
    return value;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (original.code !== 'ENOENT') throw original;
    return fallback;
  }
}
