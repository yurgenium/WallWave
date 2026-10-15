import test from 'node:test';
import assert from 'node:assert/strict';
import {ReviewState} from './public/review-state.js';
import {parseTags,formatTags} from './public/tag-input.js';

test('tag names containing commas and quotes survive editing, chip insertion and saving',()=>{
 const tags=['nature','character, game','Artist "Name"','обычный тег'];assert.deepEqual(parseTags(formatTags(tags)),tags);
 assert.deepEqual(parseTags(' nature, "character, game", nature\nspace'),['nature','character, game','space']);
 assert.throws(()=>parseTags('"unfinished, tag'),/invalidTagList/);assert.throws(()=>parseTags('"tag" trailing'),/invalidTagList/);
});
test('only dislikes have an undo timer; ratings of other images remain independent',async()=>{
 const timers=[],sent=[],changes=[];let finish;
 const reviews=new ReviewState({send:async value=>{sent.push(value);if(value.id==='c')await new Promise(r=>finish=r);},changed:id=>changes.push(id),setTimer:fn=>(timers.push(fn),timers.length),clearTimer:()=>{}});
 await reviews.vote({id:'a',vote:'dislike'});assert.equal(timers.length,1);assert.equal(sent.length,0);
 await reviews.vote({id:'b',vote:'like'});assert.equal(sent[0].id,'b');assert(reviews.pending.has('a'));
 const saving=reviews.vote({id:'c',vote:'deferred'});assert(reviews.saving.has('c'));assert.equal(timers.length,1);assert.equal(sent[1].id,'c');finish();await saving;
 await reviews.vote({id:'d',vote:'neutral'});assert.deepEqual(reviews.recent,['d','c','b']);
 await timers[0]();assert.equal(sent.at(-1).id,'a');assert(!reviews.pending.size);assert(!reviews.saving.size);assert(reviews.version('b')>0);
});
test('a pending dislike can be undone or replaced without leaking a second timer',async()=>{
 let cancelled=0;const sent=[];const reviews=new ReviewState({send:async v=>sent.push(v),setTimer:()=>1,clearTimer:()=>cancelled++});
 await reviews.vote({id:'a',vote:'dislike'});await reviews.vote({id:'a',vote:'like'});assert.equal(cancelled,1);assert.equal(sent[0].vote,'like');assert(!reviews.pending.size);
 await reviews.vote({id:'b',vote:'dislike'});assert(reviews.cancel('b'));assert(!reviews.pending.size);assert.equal(sent.length,1);
});
test('a correction on the same image is accepted while the previous save is in flight',async()=>{
 const waits=[],sent=[];const reviews=new ReviewState({send:async v=>{sent.push(v);await new Promise(r=>waits.push(r));}});
 const first=reviews.vote({id:'a',vote:'neutral'}),second=reviews.vote({id:'a',vote:null});assert.equal(sent.length,2);assert.equal(reviews.saving.get('a').vote,null);
 waits[0]();await first;assert(reviews.saving.has('a'));waits[1]();await second;assert(!reviews.saving.size);
});
