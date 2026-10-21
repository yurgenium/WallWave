import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fork} from 'node:child_process';
import {defaults,sharpModule} from './core.mjs';

async function fixture(t,{settings={},config={}}={}){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-features-')),data=path.join(temp,'library'),file=path.join(temp,'fixture.json');await fs.mkdir(path.join(data,'pending'),{recursive:true});await fs.mkdir(path.join(data,'thumbnails'));await fs.writeFile(file,JSON.stringify(config));
 const sharp=await sharpModule();for(const [id,color]of [['a','#774411'],['b','#225577']]){const bytes=await sharp({create:{width:800,height:600,channels:3,background:color}}).jpeg().toBuffer();await fs.writeFile(path.join(data,'pending',id+'.jpg'),bytes);await fs.writeFile(path.join(data,'thumbnails',id+'.jpg'),bytes);}
 await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings:{...defaults,tags:['mountains'],...settings},providers:[{id:'personal',type:'feed',name:'Personal fixture',url:'https://example.com/feed',enabled:true}],items:['a','b'].map(id=>({id,provider:'personal',title:id,tags:['mountains'],rating:'safe',downloaded:true,thumbnailVersion:2})),current:'a',monitorCurrent:{'screen-a':'a'},pages:{},lastRefresh:Date.now(),lastRotation:Date.now()}));
 await fs.writeFile(path.join(data,'credentials.json'),JSON.stringify({personal:'FIXTURE_SECRET_ONLY'}));
 const child=fork(new URL('./server.mjs',import.meta.url),[],{execArgv:['test-native-loader.mjs','test-download-loader.mjs','test-ai-loader.mjs'].flatMap(n=>['--import',new URL('./tools/'+n,import.meta.url).href]),env:{...process.env,WALLBLOOM_DATA_DIR:data,WALLBLOOM_PORT:'0',WALLBLOOM_NATIVE_FIXTURE:file},silent:true,windowsHide:true});child.stdout.resume();let errors='';child.stderr.on('data',b=>errors+=b);
 t.after(async()=>{if(child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await ended;}await fs.rm(temp,{recursive:true,force:true});});
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.once('exit',()=>reject(Error(errors)));}),base='http://127.0.0.1:'+port,get=async()=>await(await fetch(base+'/api/state')).json();
 return {data,file,base,get,async post(route,body={},profile){const s=await get(),r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':s.token,'X-Wallwave-Profile':profile||s.activeProfile},body:JSON.stringify(body)});assert.equal(r.status,200,await r.text());return get();},async wait(predicate){for(let i=0;i<600;i++){const s=await get();if(predicate(s))return s;await new Promise(r=>setTimeout(r,30));}throw Error('State timeout');}};
}
test('profile switching isolates preferences, credentials, sources and ratings without moving the main library',async t=>{
 const f=await fixture(t);let s=await f.get();assert.equal(s.activeProfile,'main');assert.equal(s.items.length,2);const bing=s.providers.find(p=>p.type==='bing');assert(bing);s=await f.post('provider',{...bing,remove:true});
 s=await f.post('profiles',{action:'create',name:'Second',copySettings:true});const p=s.profiles.find(p=>p.name==='Second');assert(p);assert.equal(s.activeProfile,'main');
 s=await f.post('profiles',{action:'switch',id:p.id});assert.equal(s.activeProfile,p.id);assert.equal(s.items.length,0);assert.deepEqual(s.settings.tags,['mountains']);assert(!s.providers.some(p=>p.id==='personal'));assert(s.providers.every(p=>!p.hasKey));
 const mismatch=await fetch(f.base+'/api/next',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':s.token,'X-Wallwave-Profile':'main'},body:'{}'});assert.equal(mismatch.status,400);assert.equal((await mismatch.json()).error,'profileChanged');
 await f.post('settings',{...s.settings,tags:['flowers']});s=await f.post('profiles',{action:'switch',id:'main'});assert.equal(s.items.length,2);assert.deepEqual(s.settings.tags,['mountains']);assert(s.providers.find(p=>p.id==='personal').hasKey);assert(!s.providers.some(p=>p.type==='bing'));assert.equal(s.current,'a');assert((await fs.readFile(f.file+'.calls','utf8')).includes('rendered'));await fs.access(path.join(f.data,'pending','a.jpg'));
 await f.post('profiles',{action:'rename',id:p.id,name:'Renamed'});s=await f.post('profiles',{action:'remove',id:p.id,confirm:true});assert(!s.profiles.some(x=>x.id===p.id));assert.equal(s.activeProfile,'main');
});
test('custom folder assignment keeps the current wallpaper and ratings; playlist, history and holds work together',async t=>{
 const f=await fixture(t);let s=await f.post('collection',{name:'Only B'}),folder=s.collections[0];s=await f.post('collection-membership',{itemId:'b',collectionIds:[folder.id]});assert.equal(s.current,'a');assert.equal(s.items.find(x=>x.id==='b').vote,undefined);
 await f.post('collection-play',{id:folder.id});s=await f.wait(s=>!s.wallpaperAction&&!s.job);assert.equal(s.rotationCollection,folder.id);assert.equal(s.current,'b');assert(s.canPrevious);
 await f.post('wallpaper-hold',{mode:'manual'});await f.post('previous');s=await f.wait(s=>!s.wallpaperAction&&!s.job);assert.equal(s.current,'a');assert.equal(s.wallpaperHold,null);
 await f.post('wallpaper-hold',{mode:'duration',minutes:360});s=await f.get();assert(s.wallpaperHold.until>Date.now()+359*60000);assert.equal(s.automation.rotation.code,'wallpaperHeld');
 s=await f.post('collection',{id:folder.id,remove:true,confirm:true});assert.equal(s.collections.length,0);assert.equal(s.rotationCollection,null);assert.equal(s.items.length,2);
});
test('diagnostic reports exclude private data and manual cancellation schedules the configured pause',async t=>{
 const f=await fixture(t,{settings:{autoRefresh:true,cancelRefreshMinutes:90},config:{downloadDelay:5000,items:[{id:'slow',url:'https://example.com/slow',width:800,height:600,rating:'safe',tags:[]}]}});let s=await f.get();
 const r=await fetch(f.base+'/api/diagnostics'),report=await r.json(),serialized=JSON.stringify(report);assert(r.headers.get('Content-Disposition').includes('WallWave-diagnostics.json'));for(const value of ['FIXTURE_SECRET_ONLY','Personal fixture','example.com','mountains',f.data])assert(!serialized.includes(value));await fs.access(path.join(f.data,'diagnostics','WallWave-diagnostics.json'));
 // Cancellation while idle only stops the explicitly requested job, not automation settings.
 await f.post('refresh');await f.wait(s=>s.job?.active>0);await f.post('cancel');s=await f.wait(s=>!s.job);assert.equal(s.refreshReason,'cancelled');assert.equal(s.automation.refresh.code,'refreshCancelledPause');assert(s.automation.refresh.nextAt>Date.now()+89*60000);assert(s.settings.autoRefresh);assert.equal(s.lastError,null);
});
test('manual AI selection stops, including network transfers, when a game becomes fullscreen',async t=>{
 const config={aiDelay:7000,activity:{cpuLoad:5,gpuLoad:0},items:[{id:'new',url:'https://example.com/new',preview:'https://example.com/new',width:800,height:600,rating:'safe',tags:[]}]},f=await fixture(t,{settings:{ai:'eco'},config});await fs.copyFile(path.join(f.data,'pending','a.jpg'),f.file+'.new.png');
 await f.post('refresh');await f.wait(s=>s.events.some(e=>e.code==='aiScreening'));await fs.writeFile(f.file,JSON.stringify({...config,activity:{cpuLoad:5,gpuLoad:0,fullscreen:true}}));
 const s=await f.wait(s=>!s.job);assert.equal(s.guard.code,'fullscreen');assert.equal(s.refreshReason,'waitIdle');assert.equal(s.refreshDownloaded,0);const starts=(await fs.readFile(f.file+'.starts','utf8')).trim().split('\n').map(JSON.parse);assert(!starts.some(x=>x.original));
});
test('an expired hold changes once and leaves the user rotation setting unchanged',{timeout:25000},async t=>{
 const schedule=[new Date(),new Date(Date.now()+60000)].map(d=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'));const f=await fixture(t,{settings:{schedule}});let s=await f.post('wallpaper-hold',{mode:'until',until:Date.now()+1000});assert(s.wallpaperHold);await f.post('pause',{paused:false});s=await f.wait(s=>!s.wallpaperHold&&!s.job);assert.equal(s.settings.rotation,false);assert(s.wallpaperHistory?.length===undefined);assert(s.canPrevious);assert(s.items.some(x=>x.rotationCount>0));assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.data,'state.json'),'utf8')).rotationTriggers,[]);
});
test('next wallpaper acknowledges before slow native monitor changes complete',async t=>{
 const f=await fixture(t,{config:{applyDelay:400}});const s=await f.post('next');assert(s.wallpaperAction);assert.equal(s.job.kind,'apply');assert.equal(s.wallpaperAction.status,'changingWallpaper');const completed=await f.wait(x=>!x.wallpaperAction&&!x.job);assert.equal(completed.wallpaperResult.code,'wallpaperChanged');assert(completed.canPrevious);
});
test('pausing a running download reports a cancellation code without adding the manual-cancel cooldown',async t=>{
 const f=await fixture(t,{settings:{autoRefresh:true},config:{downloadDelay:5000,items:[{id:'slow',url:'https://example.com/slow',width:800,height:600,rating:'safe',tags:[]}]}});await f.post('refresh');await f.wait(s=>s.job?.active>0);await f.post('pause',{paused:true});const s=await f.wait(s=>!s.job);assert.equal(s.refreshReason,'cancelled');assert.equal(s.automation.refresh.code,'pausedByUser');assert.equal(s.refreshResumeAt,undefined);const raw=JSON.parse(await fs.readFile(path.join(f.data,'state.json'),'utf8'));assert.equal(raw.refreshCancelled,false);
});
test('setting the same wallpaper again succeeds and ends a manual hold',async t=>{
 const f=await fixture(t);await f.post('apply',{id:'a'});await f.wait(s=>!s.wallpaperAction);await f.post('wallpaper-hold',{mode:'manual'});await f.post('apply',{id:'a'});const s=await f.wait(s=>!s.wallpaperAction);assert.equal(s.wallpaperResult.code,'wallpaperChanged');assert.equal(s.wallpaperHold,null);assert.equal(s.lastError,null);
});
