import test from 'node:test';
import assert from 'node:assert/strict';
import {tasteSearchTags} from './search-profile.mjs';
import {defaults,allowed} from './core.mjs';
import {matchesExcludedTags} from './library-cleanup.mjs';
import {tasteProfile,assessTaste,embeddingVersion} from './visual-ai.mjs';

test('search tags learn from likes across sources without rewriting saved preferences',()=>{
 const db={settings:{...defaults,tags:['manual interest'],excludedTags:['bad tag']},items:[{provider:'deviantart',vote:'like',tags:['landscape','mountain_lake','bad_tag']},{provider:'wallhaven',vote:'like',tags:['forest','landscape']},{provider:'local',vote:'dislike',tags:['cars']},{provider:'konachan',vote:'ban',tags:['never learn']}]} ,before=structuredClone(db);
 const tags=tasteSearchTags(db);for(const tag of ['manual interest','landscape','mountain lake','forest'])assert(tags.includes(tag));for(const tag of ['bad tag','bad_tag','cars','never learn'])assert(!tags.includes(tag));assert.deepEqual(db,before);
 assert.equal(allowed({rating:'safe',tags:['bad_tag']},db.settings),false);assert.equal(matchesExcludedTags({tags:['bad_tag']},['bad tag']),true);
});

test('CLIP taste samples from different platforms screen a third platform with one profile',()=>{
 const embedding=(a,b)=>[a,b,...Array(510).fill(0)],items=Array.from({length:5},(_,i)=>[{id:'like'+i,provider:'deviantart',vote:'like',embeddingVersion,embedding:embedding(1,0)},{id:'dislike'+i,provider:'konachan',vote:'dislike',embeddingVersion,embedding:embedding(0,1)}]).flat();
 const profile=tasteProfile(items);assert.equal(assessTaste(embedding(1,0),profile).rejected,false);assert.equal(assessTaste(embedding(0,1),profile).rejected,true);
});
