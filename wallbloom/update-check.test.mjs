import test from 'node:test';
import assert from 'node:assert/strict';
import {checkForUpdate, isNewerVersion, parseRelease} from './update-check.mjs';

test('versions compare numerically, not as text', () => {
  assert.equal(isNewerVersion('0.7.10', '0.7.9'), true);
  assert.equal(isNewerVersion('0.10.0', '0.9.9'), true);
  assert.equal(isNewerVersion('1.0.0', '0.99.99'), true);
  assert.equal(isNewerVersion('0.7.1', '0.7.1'), false);
  assert.equal(isNewerVersion('0.7.0', '0.7.1'), false);
});

test('a release link is built locally and unexpected releases are ignored', () => {
  assert.deepEqual(parseRelease({tag_name: 'v0.8.0', html_url: 'https://evil.example/x'}), {version: '0.8.0', url: 'https://github.com/yurgenium/WallWave/releases/tag/v0.8.0'});
  for (const release of [null, {}, {tag_name: 'latest'}, {tag_name: '0.8.0'}, {tag_name: 'v0.8.0/../x'}, {tag_name: 'v0.8.0', draft: true}, {tag_name: 'v0.8.0', prerelease: true}]) assert.equal(parseRelease(release), null);
});

test('an update is reported only when the published release is newer', async () => {
  const load = tag => async () => ({tag_name: tag});
  assert.equal((await checkForUpdate('0.7.1', {load: load('v0.8.0')})).version, '0.8.0');
  assert.equal(await checkForUpdate('0.7.1', {load: load('v0.7.1')}), null);
  assert.equal(await checkForUpdate('0.7.1', {load: load('v0.7.0')}), null);
});

test('a failed check rejects so the caller can ignore it', async () => {
  await assert.rejects(checkForUpdate('0.7.1', {load: async () => { throw Error('offline'); }}), /offline/);
});
