import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sharpModule} from './core.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
test('local import, real resize, folders, ratings, content filter, keys and restart', {timeout:60000},async t=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallbloom-test-'));const data=path.join(temp,'data'),source=path.join(temp,'source');await fs.mkdir(source);const sharp=await sharpModule();await sharp({create:{width:1200,height:800,channels:3,background:'#2277cc'}}).png().toFile(path.join(source,'landscape.png'));await sharp({create:{width:320,height:240,channels:3,background:'#ff5577'}}).jpeg().toFile(path.join(source,'small.jpg'));await fs.writeFile(path.join(source,'broken.jpg'),'broken');
 const fixture=path.join(temp,'native.json');await fs.writeFile(fixture,JSON.stringify({activity:{fullscreen:true},monitors:[]}));
 let child,url;
 async function start(){
  let output='';child=fork(path.join(root,'server.mjs'),[],{execArgv:['--import',new URL('./tools/test-native-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_PORT:'0',WALLBLOOM_DATA_DIR:data,WALLBLOOM_NATIVE_FIXTURE:fixture},silent:true,windowsHide:true});
  child.stderr.on('data',b=>output+=b);child.stdout.on('data',b=>output+=b);
  const port=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{cleanup();reject(Error('Server startup timed out: '+output));},15000);
   const cleanup=()=>{clearTimeout(timer);child.off('message',ready);child.off('exit',exited);child.off('error',failed);};
   const ready=m=>{if(m.type==='ready'){cleanup();resolve(m.port);}},exited=()=>{cleanup();reject(Error(output||'Server exited before startup'));},failed=e=>{cleanup();reject(e);};
   child.on('message',ready);child.once('exit',exited);child.once('error',failed);
  });
  url=`http://127.0.0.1:${port}`;return await(await fetch(url+'/api/state')).json();
 }
 async function stop(){if(!child||child.exitCode!==null||child.signalCode!==null)return;const ended=new Promise(r=>child.once('exit',r));if(child.connected)child.send({type:'shutdown'});else child.kill();await ended;}
 t.after(async()=>{await stop();await fs.rm(temp,{recursive:true,force:true});});let s=await start();
 const post=async(route,body)=>{const r=await fetch(url+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':s.token},body:JSON.stringify(body)});assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return r.json();};
 await post('provider',{id:'wallhaven',enabled:false,apiKey:'TEST-KEY-DO-NOT-EXPOSE'});s=await(await fetch(url+'/api/state')).json();assert.ok(!JSON.stringify(s).includes('TEST-KEY'));await post('provider',{id:'local',name:'Test local',type:'local',enabled:true,folder:source});await post('settings',{...s.settings,width:640,height:480,fit:'inside',batch:4});await post('refresh',{});
 for(let i=0;i<150;i++){s=await(await fetch(url+'/api/state')).json();if(!s.job)break;await new Promise(r=>setTimeout(r,100));}assert.equal(s.job,null);assert.equal(s.items.filter(x=>x.downloaded).length,2);const large=s.items.find(x=>x.title==='landscape.png'),small=s.items.find(x=>x.title==='small.jpg');assert.equal(large.width,640);assert.equal(large.height,427);assert.equal(small.width,320);assert.ok(s.items.find(x=>x.title==='broken.jpg').error);assert.ok(s.events.some(x=>x.code==='downloaded'));
 const image=await fetch(url+'/image/'+large.id);assert.equal(image.status,200);const meta=await sharp(Buffer.from(await image.arrayBuffer())).metadata();assert.equal(meta.width,1200);assert.equal(meta.height,800);await post('vote',{id:large.id,vote:'like'});await fs.access(path.join(data,'liked',large.id+'.jpg'));assert.equal(JSON.parse(await fs.readFile(path.join(data,'liked','index.json'),'utf8'))[0].vote,'like');await post('vote',{id:large.id,vote:'ban'});await fs.access(path.join(data,'blocked',large.id+'.jpg'));await post('vote',{id:large.id,vote:null});await fs.access(path.join(data,'pending',large.id+'.jpg'));
 const forbidden=await fetch(url+'/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(forbidden.status,403);assert.equal((await fetch(url+'/../server.mjs')).status,404);
 for(const route of ['/api/state','/api/desktop-state','/image/'+large.id,'/full-preview/'+large.id,'/frame-preview/'+large.id]){
  for(const headers of [{'Sec-Fetch-Site':'cross-site'},{'Sec-Fetch-Site':'same-site',Origin:'http://127.0.0.1:12345'},{Origin:'https://untrusted.example'}]){
   const response=await fetch(url+route,{headers});assert.equal(response.status,403,route+' rejects '+JSON.stringify(headers));
  }
 }
 assert.equal(image.headers.get('cross-origin-resource-policy'),'same-origin');
 const wrongHost=await new Promise((resolve,reject)=>http.get(url+'/api/state',{headers:{Host:'untrusted.example'}},response=>{response.resume();response.once('end',()=>resolve(response.statusCode));}).once('error',reject));assert.equal(wrongHost,403);
 assert.equal((await fetch(url+'/api/settings',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':s.token,Origin:'https://untrusted.example'},body:'{}'})).status,403);
 await post('provider',{id:'local',enabled:false});await post('provider',{name:'Adult test folder',type:'local',enabled:true,folder:source,rating:'adult'});await post('refresh',{});for(let i=0;i<100;i++){s=await(await fetch(url+'/api/state')).json();if(!s.job)break;await new Promise(r=>setTimeout(r,100));}assert.equal(s.items.length,0);await post('provider',{id:'local',enabled:true});assert.ok(Object.values(s.providerStatus).some(p=>p.code==='noNew'));
 await stop();s=await start();assert.equal(s.items.filter(x=>x.downloaded).length,2);await fs.access(path.join(source,'landscape.png'));await post('settings',{...s.settings,language:'en'});assert.equal((await(await fetch(url+'/api/state')).json()).settings.language,'en');
 s=await(await fetch(url+'/api/state')).json();await post('settings',{...s.settings,ai:'eco'});await post('ai',{});assert.equal((await(await fetch(url+'/api/state')).json()).aiRequested,true);await post('cancel',{});assert.equal((await(await fetch(url+'/api/state')).json()).aiRequested,false);await post('settings',{...s.settings,ai:'off'});
 await post('pause',{paused:true});assert.equal((await(await fetch(url+'/api/state')).json()).paused,true);const blocked=await fetch(url+'/api/refresh',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':s.token},body:'{}'});assert.equal(blocked.status,200);await fetch(url+'/api/cancel',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':s.token},body:'{}'});for(let i=0;i<100;i++){if(!(await(await fetch(url+'/api/state')).json()).job)break;await new Promise(r=>setTimeout(r,30));}const summary=await(await fetch(url+'/api/desktop-state')).json();assert.equal(summary.paused,true);assert.equal(summary.items,undefined);await post('pause',{paused:false});
 await stop();await fs.writeFile(path.join(data,'state.json'),'{interrupted');await fs.rename(path.join(data,'credentials.json'),path.join(data,'credentials.test-missing'));
 s=await start();assert.equal(s.items.filter(x=>x.downloaded).length,2);assert.equal(s.settings.language,'en');assert.equal(s.settings.width,640);assert.equal(s.providers.find(x=>x.id==='wallhaven').hasKey,true);assert.ok(!JSON.stringify(s).includes('TEST-KEY'));
 await post('provider',{id:'wallhaven',clearKey:true});await stop();await fs.rename(path.join(data,'state.json'),path.join(data,'state.test-missing'));await fs.rename(path.join(data,'credentials.json'),path.join(data,'credentials.test-cleared'));
 s=await start();assert.equal(s.items.filter(x=>x.downloaded).length,2);assert.equal(s.settings.language,'en');assert.equal(s.providers.find(x=>x.id==='wallhaven').hasKey,false);
});
