import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {rejectedCleanupCandidates,rejectedCleanupDelay,purgeRejectedFiles} from './library-cleanup.mjs';
import {initLibrary,imagePath} from './library.mjs';
import {validate,defaults} from './core.mjs';
test('negative votes expire after five minutes regardless of review history and keep active desktops protected',()=>{
 const db={items:[{id:'ban',downloaded:true,vote:'ban',rejectedAt:1000},{id:'dislike',downloaded:true,vote:'dislike',rejectedAt:1000},{id:'like',downloaded:true,vote:'like',rejectedAt:1000}],recentReviews:[{id:'ban',time:1000}],monitorCurrent:{screen:'dislike'}};
 assert.deepEqual(rejectedCleanupCandidates(db,1000+rejectedCleanupDelay-1),[]);assert.deepEqual(rejectedCleanupCandidates(db,1000+rejectedCleanupDelay).map(x=>x.id),['ban']);db.monitorCurrent={};assert.equal(rejectedCleanupCandidates(db,1000+rejectedCleanupDelay).length,2);db.items[0].vote='neutral';assert.deepEqual(rejectedCleanupCandidates(db,1000+rejectedCleanupDelay).map(x=>x.id),['dislike']);
 for(const folder of ['ban','dislike'])assert.throws(()=>validate({...defaults,cleanupAfterShows:{[folder]:{enabled:true,shows:2}}}),{code:'invalidCleanupSettings'});
});
test('expired negative cache clears even from recent reviews; ratings and fingerprints persist',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-negative-timer-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));await initLibrary(dir);const item={id:'a',vote:'ban',downloaded:true,rejectedAt:1000,hash:'duplicate-key'},db={items:[item],recentReviews:[{id:'a',time:1000}]};await fs.writeFile(imagePath(dir,item),'cached');assert.equal(await purgeRejectedFiles(dir,db,300999),0);await fs.access(imagePath(dir,item));assert.equal(await purgeRejectedFiles(dir,db,301000),1);await assert.rejects(fs.access(imagePath(dir,item)));assert.equal(item.vote,'ban');assert.equal(item.hash,'duplicate-key');assert.equal(item.downloaded,false);assert.deepEqual(db.recentReviews,[]);
});
