import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {initLibrary,imagePath,usage} from './library.mjs';
import {sourcePath} from './framing.mjs';
import {purgeRejectedFiles,removeProviderCopies,rememberReview} from './library-cleanup.mjs';
import {duplicateOf,pendingCapacity,eligible} from './automation.mjs';
import {defaults} from './core.mjs';

test('rejected files are removed but ratings and fingerprints persist; three recent and active wallpapers survive',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-rejected-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));await initLibrary(dir);
 const items=Array.from({length:6},(_,i)=>({id:'x'+i,provider:'p',vote:i===5?'like':i%2?'dislike':'ban',rating:'safe',tags:[],downloaded:true,hasOriginal:true,hash:'hash'+i,embedding:[i]}));
 for(const x of items)for(const file of [imagePath(dir,x),sourcePath(dir,x),path.join(dir,'thumbnails',x.id+'.jpg')])await fs.writeFile(file,'image');
 const db={items,current:'x0',recentReviews:[{id:'x1',time:Date.now()},{id:'x2',time:Date.now()},{id:'x3',time:Date.now()}]};assert.equal(await purgeRejectedFiles(dir,db),1);assert.equal(items[4].vote,'ban');assert.equal(items[4].downloaded,false);assert.equal(items[4].hash,'hash4');assert.deepEqual(items[4].embedding,[4]);
 await assert.rejects(fs.access(sourcePath(dir,items[4])));for(const x of items.filter(x=>x.id!=='x4'))await fs.access(imagePath(dir,x));
 assert.equal(duplicateOf({id:'copy',hash:'hash4'},items)?.id,'x4');
});
test('removing a source clears only its unreviewed library copies; source originals and favorites remain',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-source-removal-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));await initLibrary(dir);const personal=path.join(dir,'personal.png');await fs.writeFile(personal,'personal');
 const items=[{id:'unrated',provider:'p',downloaded:true,localSource:personal},{id:'favorite',provider:'p',downloaded:true,vote:'like'},{id:'other',provider:'q',downloaded:true}];
 for(const x of items)await fs.writeFile(imagePath(dir,x),'cached');await removeProviderCopies(dir,{items},'p');
 await assert.rejects(fs.access(imagePath(dir,items[0])));await fs.access(personal);await fs.access(imagePath(dir,items[1]));await fs.access(imagePath(dir,items[2]));assert(items[0].sourceRemoved);
});
test('review history follows click time and is limited to three unique images',()=>{
 const db={};const now=Date.now();rememberReview(db,'a',now-1000);rememberReview(db,'b',now);rememberReview(db,'c',now);rememberReview(db,'d',now);assert.equal(db.recentReviews.length,3);assert(!db.recentReviews.some(x=>x.id==='a'));rememberReview(db,'b');assert.equal(db.recentReviews.filter(x=>x.id==='b').length,1);
});
test('disabled source copies do not fill the unreviewed pool or rotate; explicitly rated favorites remain usable',()=>{
 const db={settings:defaults,providers:[{id:'off',enabled:false},{id:'on',enabled:true}],items:[{id:'a',provider:'off',downloaded:true,rating:'safe',tags:[]},{id:'b',provider:'off',downloaded:true,rating:'safe',tags:[],vote:'like'},{id:'c',provider:'on',downloaded:true,rating:'safe',tags:[]}]};
 assert.equal(pendingCapacity(db),29);assert.deepEqual(eligible(db).map(x=>x.id),['b','c']);
});
test('disk usage tolerates an atomic-save temporary file disappearing between listing and stat',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-usage-race-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));await fs.writeFile(path.join(dir,'moving.tmp'),'temporary');await fs.writeFile(path.join(dir,'stable.txt'),'hello');
 const stat=fs.stat.bind(fs);t.mock.method(fs,'stat',async file=>{if(String(file).endsWith('moving.tmp'))throw Object.assign(Error('renamed concurrently'),{code:'ENOENT'});return stat(file);});assert.equal(await usage(dir),5);
});
