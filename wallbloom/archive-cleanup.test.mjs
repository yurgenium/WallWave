import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {defaults} from './core.mjs';
import {initLibrary} from './library.mjs';
import {exportLibrary, restoreLibrary} from './archive.mjs';

test('new WallWave export name and legacy Wallbloom exports both restore',async t=>{
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-export-names-'));t.after(()=>fs.rm(parent,{recursive:true,force:true}));
 for(const legacy of [false,true]){
  const dir=path.join(parent,'library-'+legacy);await initLibrary(dir);
  const state={settings:defaults,providers:[],items:[]};await fs.writeFile(path.join(dir,'state.json'),JSON.stringify(state));
  const exported=await exportLibrary(dir,state,parent);await fs.access(path.join(exported,'wallwave-export.json'));
  if(legacy)await fs.rename(path.join(exported,'wallwave-export.json'),path.join(exported,'wallbloom-export.json'));
  const result=await restoreLibrary(dir,exported);assert.equal(result.state.paused,true);assert.deepEqual(result.state.items,[]);
 }
});

test('failed archive operations remove partial copies and preserve the live library', async t => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'wallwave-archive-cleanup-'));
  t.after(() => fs.rm(parent, {recursive: true, force: true}));
  const dir = path.join(parent, 'library');
  await initLibrary(dir);
  const state = {settings: defaults, providers: [{id: 'local', name: 'Local', type: 'local', folder: parent, enabled: true}], items: [{id: 'missing', provider: 'local', title: 'Missing file', tags: [], rating: 'safe', vote: null, downloaded: true}]};
  const live = JSON.stringify(state);
  await fs.writeFile(path.join(dir, 'state.json'), live);
  await assert.rejects(exportLibrary(dir, state, parent));
  assert.equal((await fs.readdir(parent)).some(name => name.startsWith('WallWave-export-')), false);
  const source = path.join(parent, 'invalid-export');
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'wallbloom-export.json'), JSON.stringify({format: 'wallbloom-library', version: 2, state}));
  await assert.rejects(restoreLibrary(dir, source));
  assert.equal((await fs.readdir(parent)).some(name => name.startsWith('library.restore-')), false);
  assert.equal(await fs.readFile(path.join(dir, 'state.json'), 'utf8'), live);
});
