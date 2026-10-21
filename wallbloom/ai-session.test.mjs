import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {EventEmitter} from 'node:events';
import {AISession} from './ai-session.mjs';
test('an active inference is terminated when resources become busy and profiles share only the model cache',async t=>{
 let options,killed=false,allowed=true;const child=new EventEmitter();child.pid=2147483647;child.stdout={resume(){}};child.stderr=new EventEmitter();child.send=()=>{};child.kill=()=>{killed=true;};
 t.mock.method(childProcess,'fork',(_,args,config)=>{options=config;return child;});syncBuiltinESMExports();t.after(()=>{t.mock.restoreAll();syncBuiltinESMExports();});
 const events=[],session=new AISession('/fixture/profile',{modelsDir:'/fixture/shared-models',allowed:()=>allowed,onEvent:code=>events.push(code)});t.after(()=>session.close());child.emit('message',{ready:true});const result=assert.rejects(session.request({id:'image'}),{code:'aiPaused'});allowed=false;await result;assert(killed);assert(session.closed);assert.equal(options.env.WALLWAVE_MODEL_CACHE,'/fixture/shared-models');assert.equal(options.env.WALLBLOOM_AI,'eco');child.emit('message',{code:'modelDownloading',network:{loaded:1,total:10}});assert.deepEqual(events,[]);
});
