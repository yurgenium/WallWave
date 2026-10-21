import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Profiles} from './profiles.mjs';
import {defaults} from './core.mjs';
test('profiles isolate libraries, copy only requested settings and preserve deleted data for recovery',async t=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-profiles-'));t.after(()=>fs.rm(temp,{recursive:true,force:true}));const root=path.join(temp,'library'),p=await new Profiles(root).open();
 assert.equal(p.active,'main');assert.equal(p.directory(),root);const settings={...defaults,tags:['mountains'],excludedTags:['city']};
 const first=await p.create('Travel',{copySettings:true,primarySettings:settings,providers:[]}),second=await p.create('Portraits');
 const data=JSON.parse(await fs.readFile(path.join(p.directory(first.id),'state.json'),'utf8'));assert.equal(data.items.length,0);assert.deepEqual(data.settings.tags,['mountains']);assert.deepEqual(data.settings.excludedTags,['city']);assert.deepEqual(data.providers,[]);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(p.directory(first.id),'credentials.json'),'utf8')),{});
 const fresh=JSON.parse(await fs.readFile(path.join(p.directory(second.id),'state.json'),'utf8'));assert.deepEqual(fresh.settings.tags,defaults.tags);
 await p.activate(first.id);await p.rename(first.id,'Landscape');assert.equal((await new Profiles(root).open()).active,first.id);
 await assert.rejects(p.remove(first.id),{code:'profileProtected'});await assert.rejects(p.remove('main'),{code:'profileProtected'});await assert.rejects(p.create('landscape'),{code:'profileNameExists'});
 await p.activate('main');await p.remove(first.id);assert(!p.list().some(x=>x.id===first.id));await fs.access(path.join(p.directory(first.id),'state.json'));
 assert.throws(()=>p.directory('../escape'),{code:'invalidProfiles'});assert.throws(()=>p.find(first.id),{code:'profileNotFound'});
});
