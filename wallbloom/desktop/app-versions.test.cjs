const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {staleVersions, pruneVersions} = require('./app-versions.cjs');

test('only older versions beyond the kept ones are stale', () => {
  const names = ['0.5.9', '0.5.10', '0.6.9', '0.7.0', '0.7.1', '0.8.0', '.stage-0.7.1-5', 'notes'];
  assert.deepEqual(staleVersions(names, '0.7.1').sort(), ['0.5.10', '0.5.9']);
  assert.deepEqual(staleVersions(['0.7.0', '0.7.1'], '0.7.1'), []);
});

async function install({ini = 'Product=app.wallbloom.desktop\r\nVersion=0.7.1\r\n', encoding = 'utf8'} = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wallwave-versions-'));
  for (const name of ['0.5.0', '0.6.0', '0.6.9', '0.7.0', '0.7.1', '0.8.0', '.stage-0.7.1-5', 'keep-me']) {
    await fs.mkdir(path.join(root, 'app', name), {recursive: true});
    await fs.writeFile(path.join(root, 'app', name, 'file.txt'), name);
  }
  if (ini !== null) await fs.writeFile(path.join(root, 'installation.ini'), encoding === 'utf16le' ? Buffer.concat([Buffer.from([255, 254]), Buffer.from(ini, 'utf16le')]) : ini);
  return {root, execPath: path.join(root, 'app', '0.7.1', 'WallWave.exe')};
}
const left = async root => (await fs.readdir(path.join(root, 'app'))).sort();

test('old versions are removed, other folders and newer versions stay', async t => {
  const {root, execPath} = await install({encoding: 'utf16le'});
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  assert.deepEqual((await pruneVersions({execPath, version: '0.7.1', fs})).sort(), ['0.5.0', '0.6.0']);
  assert.deepEqual(await left(root), ['.stage-0.7.1-5', '0.6.9', '0.7.0', '0.7.1', '0.8.0', 'keep-me']);
});

test('nothing is removed outside a matching WallWave installation', async t => {
  const all = ['.stage-0.7.1-5', '0.5.0', '0.6.0', '0.6.9', '0.7.0', '0.7.1', '0.8.0', 'keep-me'];
  for (const options of [{ini: null}, {ini: 'Product=other.app\r\nVersion=0.7.1\r\n'}, {ini: 'Product=app.wallbloom.desktop\r\nVersion=0.8.0\r\n'}]) {
    const {root, execPath} = await install(options);
    t.after(() => fs.rm(root, {recursive: true, force: true}));
    assert.deepEqual(await pruneVersions({execPath, version: '0.7.1', fs}), []);
    assert.deepEqual(await left(root), all);
  }
  const {root} = await install();
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  assert.deepEqual(await pruneVersions({execPath: path.join(root, 'elsewhere', '0.7.1', 'WallWave.exe'), version: '0.7.1', fs}), []);
  assert.deepEqual(await pruneVersions({execPath: path.join(root, 'app', '0.7.0', 'WallWave.exe'), version: '0.7.1', fs}), []);
  assert.deepEqual(await left(root), all);
});
