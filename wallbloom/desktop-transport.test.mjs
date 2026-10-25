import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fork} from 'node:child_process';
import {defaults,sharpModule} from './core.mjs';
import {createServiceClient} from './desktop/local-transport.cjs';

test('desktop state, images and content settings work through IPC without an HTTP listener', {timeout:30000},async t=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-ipc-'));
 const data=path.join(temp,'library'),fixture=path.join(temp,'native.json');
 await fs.mkdir(path.join(data,'pending'),{recursive:true});await fs.mkdir(path.join(data,'thumbnails'));
 const image=await(await sharpModule())({create:{width:800,height:600,channels:3,background:'#438978'}}).jpeg().toBuffer();
 for(const folder of ['pending','thumbnails'])await fs.writeFile(path.join(data,folder,'local-image.jpg'),image);
 await fs.writeFile(fixture,JSON.stringify({activity:{fullscreen:true},monitors:[]}));
 await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings:defaults,providers:[{id:'local',type:'local',folder:temp,enabled:true}],items:[{id:'local-image',provider:'local',downloaded:true,thumbnailVersion:2,rating:'safe',tags:['nature']}],pages:{}}));
 const child=fork(new URL('./server.mjs',import.meta.url),[],{execArgv:['--import',new URL('./tools/test-native-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_DATA_DIR:data,WALLBLOOM_DESKTOP_IPC:'1',WALLBLOOM_TEST_HTTP:'0',WALLBLOOM_NATIVE_FIXTURE:fixture},silent:true,windowsHide:true,serialization:'advanced'});
 const request=createServiceClient(child);let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 t.after(async()=>{if(child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await ended;}await fs.rm(temp,{recursive:true,force:true});});
 const ready=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m));child.once('exit',()=>reject(Error(output)));});
 assert.equal(ready.ipc,true);assert.equal(ready.port,undefined);
 const json=async route=>{const r=await request({path:route});assert.equal(r.status,200);return JSON.parse(r.body);};
 const state=await json('/api/state');assert.equal(state.items.length,1);
 const thumb=await request({path:'/image/local-image?v=2'});assert.equal(thumb.status,200);assert(thumb.body.equals(image),'binary images must survive the process channel unchanged');
 const asset=await request({path:'/app.js'});assert.equal(asset.status,200);assert.match(asset.headers['content-type'],/javascript/);
 const forbidden=await request({path:'/api/settings',method:'POST',body:Buffer.from('{}')});assert.equal(forbidden.status,403);
 for(const purity of ['110','111','100']){
  const response=await request({path:'/api/settings',method:'POST',headers:{'x-wallbloom-token':state.token,'x-wallwave-profile':state.activeProfile},body:Buffer.from(JSON.stringify({...state.settings,purity}))});
  assert.equal(response.status,200);assert.equal((await json('/api/state')).settings.purity,purity);
 }
 await assert.rejects(request({path:'//invalid'},25),/timed out/);
 assert.equal((await json('/api/state')).items.length,1,'a timed out request must not break the channel');
});
