import test from 'node:test';
import assert from 'node:assert/strict';
import {createStatePoller} from './public/state-poll.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('slow periodic reads share one request and still apply its result',async()=>{
 const request=deferred(),values=[];let reads=0;
 const poll=createStatePoller({read:()=>{reads++;return request.promise;},apply:x=>values.push(x),failed:assert.fail});
 const pending=poll();for(let i=0;i<20;i++)assert.equal(poll(),pending);assert.equal(reads,1);
 request.resolve('loaded');await pending;assert.deepEqual(values,['loaded']);
});
test('mutations queue a fresh read and cannot apply an older snapshot',async()=>{
 const requests=[deferred(),deferred()],values=[];let reads=0;
 const poll=createStatePoller({read:()=>requests[reads++].promise,apply:x=>values.push(x),failed:assert.fail});
 const pending=poll();assert.equal(poll(true),pending);poll(true);requests[0].resolve('before vote');await Promise.resolve();assert.equal(reads,2);assert.deepEqual(values,[]);
 requests[1].resolve('after vote');await pending;assert.deepEqual(values,['after vote']);assert.equal(reads,2);
});
test('a failed connection can recover on the next periodic read',async()=>{
 const values=[],errors=[];let reads=0;
 const poll=createStatePoller({read:async()=>{if(!reads++)throw Error('offline');return 'online';},apply:x=>values.push(x),failed:e=>errors.push(e.message)});
 await poll();await poll();assert.deepEqual(errors,['offline']);assert.deepEqual(values,['online']);
});
