import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validate} from './core.mjs';
import {cleanupFolders,defaultCleanupRules} from './public/show-cleanup.js';
import {confirmShows,eligible} from './automation.mjs';
import {shownCleanupCandidates,syncShownCleanup,syncTagCleanup,dueCleanupCandidates} from './library-cleanup.mjs';
const database=()=>({settings:validate(defaults),items:cleanupFolders.map((folder,i)=>({id:folder,downloaded:true,vote:folder==='pending'?null:folder,showCount:i+1,tags:[]})),monitorCurrent:{}});
test('show cleanup stays off for existing libraries until folders are explicitly selected',()=>{
 const db=database();assert.deepEqual(shownCleanupCandidates(db),[]);assert(Object.values(db.settings.cleanupAfterShows).every(rule=>!rule.enabled));
 for(const value of [0,1001,1.5,'3'])assert.throws(()=>validate({...defaults,cleanupAfterShows:{like:{enabled:true,shows:value}}}),{code:'invalidCleanupSettings'});
 assert.throws(()=>validate({...defaults,cleanupAfterShows:{unknown:{enabled:true,shows:3}}}),{code:'invalidCleanupSettings'});
});
test('each folder has an independent threshold and all current monitor images remain protected',()=>{
 const db=database();db.settings.cleanupAfterShows={...defaultCleanupRules(),pending:{enabled:true,shows:1},like:{enabled:true,shows:3},neutral:{enabled:true,shows:3},deferred:{enabled:true,shows:4}};db.current='pending';db.monitorCurrent={a:'pending',b:'deferred'};
 assert.deepEqual(shownCleanupCandidates(db).map(x=>x.id),['neutral']);db.monitorCurrent={};db.current=null;assert.deepEqual(shownCleanupCandidates(db).map(x=>x.id),['pending','neutral','deferred']);
 db.items[2].vote='like';assert(shownCleanupCandidates(db).some(x=>x.id==='neutral'));db.settings.cleanupAfterShows.like.enabled=false;assert(!shownCleanupCandidates(db).some(x=>x.id==='neutral'));
});
test('folder cleanup waits a minute, persists across restart and cancels when disabled or below the new threshold',()=>{
 const db=database();db.settings.cleanupAfterShows.pending={enabled:true,shows:1};assert.deepEqual(syncShownCleanup(db,1000),{count:1,dueAt:61000});assert.equal(syncShownCleanup(JSON.parse(JSON.stringify(db)),9000).dueAt,61000);assert.deepEqual(dueCleanupCandidates(db,60999),[]);assert.deepEqual(dueCleanupCandidates(db,61000).map(x=>x.id),['pending']);
 db.settings.cleanupAfterShows.pending.shows=2;assert.deepEqual(syncShownCleanup(db,10000),{count:0,dueAt:null});db.settings.cleanupAfterShows.pending={enabled:false,shows:1};assert.equal(syncShownCleanup(db,11000).dueAt,null);
});
test('wallpapers at their selected folder threshold stop rotating during the cleanup grace period',()=>{
 const db=database();for(const item of db.items){item.tags=[];item.rating='safe';item.provider='p';}db.providers=[{id:'p',enabled:true}];db.settings.cleanupAfterShows.pending={enabled:true,shows:1};assert(!eligible(db).some(item=>item.id==='pending'));db.settings.cleanupAfterShows.pending.enabled=false;assert(eligible(db).some(item=>item.id==='pending'));
});
test('displays on different monitors update the same persistent wallpaper counter once per confirmed display',()=>{
 const db=database(),item=db.items[0];item.showCount=0;db.exposures={a:{id:item.id,since:1000}};confirmShows(db,{code:'active'},31000);assert.equal(item.showCount,1);
 db.exposures.b={id:item.id,since:32000};confirmShows(db,{code:'active'},62000);assert.equal(item.showCount,2);confirmShows(db,{code:'active'},100000);assert.equal(item.showCount,2);assert.equal(JSON.parse(JSON.stringify(db)).items[0].showCount,2);
});
test('tag and folder cleanup share a single deletion selection without duplicate records',()=>{
 const db=database();db.settings.excludedTags=['nature'];db.items[0].tags=['Nature'];db.settings.cleanupAfterShows.pending={enabled:true,shows:1};syncTagCleanup(db,1000);syncShownCleanup(db,1000);assert.deepEqual(dueCleanupCandidates(db,61000).map(x=>x.id),['pending']);
});
