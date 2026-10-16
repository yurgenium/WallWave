import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {cleanupCandidates,syncTagCleanup,purgeCopies,CleanupConfirmations,matchesExcludedTags} from './library-cleanup.mjs';
import {initLibrary,imagePath} from './library.mjs';
import {sourcePath} from './framing.mjs';
import {duplicateOf} from './automation.mjs';

const database=()=>({settings:{excludedTags:['artist, sample']},providers:[{id:'off',enabled:false},{id:'on',enabled:true}],items:[{id:'a',provider:'off',downloaded:true,tags:['Artist, Sample'],vote:'like'},{id:'b',provider:'off',hasOriginal:true,tags:['nature'],vote:'neutral'},{id:'c',provider:'on',downloaded:true,tags:['sample']}],recentReviews:[{id:'a'},{id:'c'}]});
test('source cleanup includes every rating but requires a disabled existing source',()=>{
 const db=database();assert.deepEqual(cleanupCandidates(db,{kind:'provider',providerId:'off'}).map(x=>x.id),['a','b']);
 for(const providerId of ['on','missing'])assert.throws(()=>cleanupCandidates(db,{kind:'provider',providerId}),/cleanupSourceEnabled/);
 assert.throws(()=>cleanupCandidates(db,{kind:'all'}),/invalidRequest/);
});
test('excluded tags match whole names without splitting commas and ignore letter case',()=>{
 const db=database();assert.deepEqual(cleanupCandidates(db,{kind:'tags'}).map(x=>x.id),['a']);
 assert.equal(matchesExcludedTags(db.items[0],['artist']),false);assert.equal(matchesExcludedTags(db.items[2],['artist, sample']),false);
});
test('cleanup also clears gallery entries whose old rejected files were already purged',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-cleanup-metadata-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));await initLibrary(dir);
 const db=database();Object.assign(db.items[0],{downloaded:false,hasOriginal:false,cachePurged:true,vote:'ban'});
 const candidates=cleanupCandidates(db,{kind:'tags'});assert.equal(candidates.length,1);assert.equal((await purgeCopies(dir,db,candidates)).removed,1);assert.equal(db.items[0].vote,'ban');assert.equal(cleanupCandidates(db,{kind:'tags'}).length,0);
});
test('automatic cleanup waits a minute, survives restart, cancels after removing a tag and resets for changed tags',()=>{
 const db=database();assert.deepEqual(syncTagCleanup(db,1000),{count:1,dueAt:61000});
 assert.equal(syncTagCleanup(JSON.parse(JSON.stringify(db)),5000).dueAt,61000);
 db.settings.excludedTags=['ARTIST, SAMPLE'];assert.equal(syncTagCleanup(db,6000).dueAt,61000);
 db.settings.excludedTags=[];assert.deepEqual(syncTagCleanup(db,7000),{count:0,dueAt:null});
 db.settings.excludedTags=['nature'];assert.equal(syncTagCleanup(db,8000).dueAt,68000);
});
test('confirmation cannot run early or twice; scope is fixed and reenabled sources are refused',()=>{
 const db=database(),tickets=new CleanupConfirmations(),scope={kind:'provider',providerId:'off'};
 assert.equal(tickets.prepare(db,scope,'token',1000).count,2);assert.throws(()=>tickets.consume(db,'token',3999),/cleanupWait/);
 db.items.push({id:'new',provider:'off',downloaded:true,tags:[]});assert.deepEqual(tickets.consume(db,'token',4000).map(x=>x.id),['a','b']);assert.throws(()=>tickets.consume(db,'token',4001),/cleanupExpired/);
 tickets.prepare(db,scope,'second',5000);db.providers[0].enabled=true;assert.throws(()=>tickets.consume(db,'second',8000),/cleanupSourceEnabled/);
});
test('tag confirmation expires if exclusions change; expired confirmations cannot delete',()=>{
 const db=database(),tickets=new CleanupConfirmations();tickets.prepare(db,{kind:'tags'},'token',1000);db.settings.excludedTags=['nature'];assert.throws(()=>tickets.consume(db,'token',4000),/cleanupExpired/);
 tickets.prepare(db,{kind:'tags'},'new',5000);assert.throws(()=>tickets.consume(db,'new',305001),/cleanupExpired/);
});
test('cleanup removes cache and recent entries, keeps personal originals, ratings, fingerprints and current rendered desktop',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-cleanup-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));await initLibrary(dir);
 const db=database(),item=db.items[0];item.hasOriginal=true;item.hash='fingerprint';item.embedding=[1,2];item.bytes=8;item.originalBytes=8;item.localSource=path.join(dir,'personal.jpg');db.current=item.id;db.monitorCurrent={screen:item.id};db.renderedCurrent={screen:'screen-desktop.jpg'};
 const rendered=path.join(dir,'rendered','screen-desktop.jpg');for(const file of [imagePath(dir,item),sourcePath(dir,item),path.join(dir,'thumbnails',item.id+'.jpg'),item.localSource,rendered])await fs.writeFile(file,'original');
 assert.deepEqual(await purgeCopies(dir,db,[item]),{removed:1,bytes:16});
 for(const file of [imagePath(dir,item),sourcePath(dir,item),path.join(dir,'thumbnails',item.id+'.jpg')])await assert.rejects(fs.access(file));
 await fs.access(item.localSource);await fs.access(rendered);assert.equal(item.vote,'like');assert.equal(item.hash,'fingerprint');assert.deepEqual(item.embedding,[1,2]);assert.equal(item.downloaded,false);assert.equal(item.cleanupRemoved,true);assert.equal(db.current,'a');assert.deepEqual(db.recentReviews,[{id:'c'}]);assert.equal(duplicateOf({id:'copy',hash:'fingerprint'},db.items).id,'a');assert.equal((await purgeCopies(dir,db,[item])).removed,0);
});
