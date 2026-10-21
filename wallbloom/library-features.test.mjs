import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from './core.mjs';
import {chooseNext,automationState} from './automation.mjs';
import {shownCleanupCandidates} from './library-cleanup.mjs';
import {editCollection,setCollectionItem,setWallpaperHold,holdActive,cancelRefresh,busyForAI,rememberWallpaper,wallpaperSnapshot} from './library-features.mjs';
test('custom folders keep ratings and focus, select a long nonrepeating cycle and protect display cleanup',()=>{
 const items=['a','b','c'].map(id=>({id,provider:'local',downloaded:true,vote:null,rating:'safe',tags:[],showCount:20})),db={settings:{...defaults,diversity:0,cleanupAfterShows:{pending:{enabled:true,shows:3}}},items,current:'a',monitorCurrent:{screen:'a'},providers:[{id:'local',enabled:true}]};
 const folder=editCollection(db,{name:'Nature'});setCollectionItem(db,{collectionId:folder.id,itemId:'a'});setCollectionItem(db,{collectionId:folder.id,itemId:'b'});assert.equal(db.current,'a');assert(items.every(x=>x.vote===null));db.rotationCollection=folder.id;
 const next=chooseNext(db);assert.equal(next.id,'b');next.rotationCount=1;db.current='b';assert.equal(chooseNext(db).id,'a');assert.deepEqual(shownCleanupCandidates(db).map(x=>x.id),['c']);
 editCollection(db,{id:folder.id,remove:true});assert.equal(db.rotationCollection,null);assert.equal(db.items.length,3);assert.equal(db.current,'b');
});
test('hold times, cancellation cooldown and previous wallpaper metadata survive without changing rotation settings',()=>{
 const db={settings:{...defaults,rotation:true,cancelRefreshMinutes:90},current:'a',monitorCurrent:{one:'a'}};setWallpaperHold(db,{mode:'duration',minutes:60},1000);assert(holdActive(db,2000));assert(!holdActive(db,3601001));setWallpaperHold(db,{mode:'manual'},1000);assert(holdActive(db,1e12));assert(db.settings.rotation);assert.throws(()=>setWallpaperHold(db,{mode:'duration',minutes:0}),{code:'invalidHoldTime'});
 cancelRefresh(db,1000);assert.equal(db.refreshResumeAt,5401000);const a=automationState({...db,items:[],providers:[],lastRefresh:0,lastRotation:0}, {code:'idle'},{},2000);assert.equal(a.refresh.code,'refreshCancelledPause');assert.equal(a.rotation.code,'wallpaperHeldManual');
 const before=wallpaperSnapshot(db);db.current='b';db.monitorCurrent.one='b';rememberWallpaper(db,before);assert.deepEqual(db.wallpaperHistory,[before]);
});
test('all CPU, GPU, fullscreen, render, lock and unknown guard states prevent AI',()=>{
 for(const code of ['systemBusy','fullscreen','blockedProcess','screenLocked','guardUnavailable','windowsUnavailable'])assert(busyForAI({code}));for(const code of ['idle','active'])assert(!busyForAI({code}));
});
test('folder playback uses its own least-recently-shown cycle even for old favorites or newly added files',()=>{
 const items=['a','b','c'].map((id,i)=>({id,downloaded:true,rating:'safe',tags:[],vote:'like',rotationCount:i===0?100:0})),db={settings:{...defaults,diversity:0},items,current:'c',collections:[{id:'folder',items:['a','b','c'],lastShown:{b:1,c:2},sequence:2}],rotationCollection:'folder'};
 assert.equal(chooseNext(db).id,'a');db.collections[0].lastShown.a=3;db.current='a';assert.equal(chooseNext(db).id,'b');items.push({id:'d',downloaded:true,rating:'safe',tags:[],vote:'like'});db.collections[0].items.push('d');assert.equal(chooseNext(db).id,'d');db.collections[0].lastShown.d=4;db.current='d';assert.equal(chooseNext(db).id,'b');
});
