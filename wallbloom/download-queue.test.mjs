import test from 'node:test';
import assert from 'node:assert/strict';
import {DownloadQueue} from './download-queue.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('approved downloads overlap, obey the queue bound, and release reservations after failures',async()=>{
 const releases=new Map(),started=[],states=[];let downloaded=0;
 const queue=new DownloadQueue({capacity:3,changed:s=>states.push({...s}),run:async id=>{started.push(id);await new Promise(resolve=>releases.set(id,resolve));if(id!=='failed')downloaded++;}});
 for(const id of ['first','failed','third']){assert(await queue.room(()=>3-downloaded));queue.push(id);}
 await tick();assert.deepEqual(started,['first','failed']);assert.equal(queue.size,3);assert.equal(queue.active,2);
 let available=false;const room=queue.room(()=>3-downloaded).then(value=>available=value);await tick();assert.equal(available,false);
 releases.get('failed')();await room;await tick();assert.equal(available,true);queue.push('replacement');
 releases.get('first')();await tick();assert.deepEqual(started,['first','failed','third','replacement']);
 releases.get('third')();releases.get('replacement')();await queue.drain();assert.equal(downloaded,3);assert.equal(queue.size,0);assert.equal(await queue.room(()=>0),false);assert(states.every(s=>s.ready<=3&&s.active<=2));queue.close();
});
test('cancelling stops queued tasks, wakes a waiting producer and settles active transfers',async()=>{
 const controller=new AbortController(),started=[];
 const queue=new DownloadQueue({signal:controller.signal,run:async(id,signal)=>{started.push(id);await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
 for(let i=0;i<4;i++)queue.push(i);await tick();const room=queue.room(()=>10);const rejected=assert.rejects(room,/cancel/);
 controller.abort(Error('cancel'));await rejected;await assert.rejects(queue.drain(),/cancel/);assert.deepEqual(started,[0,1]);assert.equal(queue.size,0);queue.close();
});
test('a fatal transfer failure cancels its peer and does not leave work in the background',async()=>{
 const started=[];const queue=new DownloadQueue({run:async(id,signal)=>{started.push(id);if(id===0)throw Error('persist failed');await new Promise((resolve,reject)=>{if(signal.aborted)reject(signal.reason);else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});}});
 for(let i=0;i<4;i++)queue.push(i);await assert.rejects(queue.drain(),/persist failed/);assert.deepEqual(started,[0,1]);assert.equal(queue.size,0);queue.close();
});
test('cancelling before the first microtask never starts a transfer',async()=>{
 const controller=new AbortController();let calls=0;
 const queue=new DownloadQueue({signal:controller.signal,run:async()=>{calls++;}});queue.push(1);controller.abort(Error('cancel'));
 await assert.rejects(queue.drain(),/cancel/);assert.equal(calls,0);assert.equal(queue.size,0);queue.close();
});
