import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {defaults} from './core.mjs';
import {initLibrary} from './library.mjs';

test('the desktop preview has the screen size and framing of the real wallpaper', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wallwave-desktop-preview-')), port = 47000 + Math.floor(Math.random() * 1000), url = `http://127.0.0.1:${port}`;
  await initLibrary(dir);
  const original = await sharp({create: {width: 1000, height: 1000, channels: 3, background: '#ff0000'}}).png().toBuffer();
  const item = (id, frames, vote = null) => ({id, title: id, provider: 'local', tags: ['nature'], rating: 'safe', vote, downloaded: true, hasOriginal: true, width: 1000, height: 1000, bytes: 1, ...frames && {frames}});
  for (const id of ['contain', 'cover', 'banned']) {
    await fs.writeFile(path.join(dir, 'originals', id + '.source'), original);
    await fs.writeFile(path.join(dir, 'pending', id + '.jpg'), await sharp(original).jpeg().toBuffer());
  }
  const frame = fit => ({'*': {fit, x: .5, y: .5, flip: false}});
  const settings = {...defaults, width: 800, height: 400, paused: true};
  await fs.writeFile(path.join(dir, 'state.json'), JSON.stringify({settings, providers: [{id: 'local', name: 'Local', type: 'local', enabled: true, folder: dir}], items: [item('contain', frame('contain')), item('cover', frame('cover')), item('banned', null, 'ban')], pages: {}, current: null, lastRefresh: 0, lastRotation: 0, paused: true}));
  const child = spawn(process.execPath, ['server.mjs'], {cwd: import.meta.dirname, env: {...process.env, WALLWAVE_DATA_DIR: dir, WALLWAVE_PORT: String(port)}, windowsHide: true, stdio: 'ignore'});
  t.after(async () => { child.kill(); await new Promise(resolve => setTimeout(resolve, 300)); await fs.rm(dir, {recursive: true, force: true, maxRetries: 10, retryDelay: 200}); });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(url + '/api/state')).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  const picture = async id => { const response = await fetch(`${url}/desktop-preview/${id}`); assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/jpeg'); return sharp(Buffer.from(await response.arrayBuffer())); };
  const pixel = async (image, x, y) => { const {data} = await image.clone().extract({left: x, top: y, width: 1, height: 1}).raw().toBuffer({resolveWithObject: true}); return data[0]; };
  const contain = await picture('contain'), cover = await picture('cover');
  assert.deepEqual([(await contain.metadata()).width, (await contain.metadata()).height], [800, 400]);
  assert.deepEqual([(await cover.metadata()).width, (await cover.metadata()).height], [800, 400]);
  assert.ok(await pixel(contain, 20, 200) < 80, 'contain leaves bars at the sides');
  assert.ok(await pixel(cover, 20, 200) > 200, 'cover fills the screen');
  assert.notEqual((await fetch(`${url}/desktop-preview/banned`)).status, 200);
  assert.notEqual((await fetch(`${url}/desktop-preview/missing`)).status, 200);
  assert.notEqual((await fetch(`${url}/desktop-preview/contain?monitorId=gone`)).status, 200);
});
