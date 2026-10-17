import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fork} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {defaults,sharpModule} from './core.mjs';
import {searchProvider} from './providers.mjs';
import {initLibrary,downloadImage,usage} from './library.mjs';

const picture=id=>({id,path:'https://example.com/'+id,url:'https://example.com/source',thumbs:{small:'https://example.com/'+id},purity:'sfw',dimension_x:800,dimension_y:600});
const ratings=()=>Array.from({length:5},(_,i)=>[{id:'positive'+i,vote:'like',embeddingVersion:2,embedding:[1,0,...Array(510).fill(0)],tags:[],rating:'safe'},{id:'negative'+i,vote:'dislike',embeddingVersion:2,embedding:[0,1,...Array(510).fill(0)],tags:[],rating:'safe'}]).flat();
async function fixture(t,config,{items=[],settings={},searchState,providers,providerCooldowns}={}){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-refresh-')),data=path.join(temp,'data'),file=path.join(temp,'fixture.json');await fs.mkdir(data);
 config={delay:0,...config};await fs.writeFile(file,JSON.stringify(config));
 const sharp=await sharpModule();
 for(const [id,color] of [['red','#ff3344'],['green','#33ee77'],['blue','#3344ff'],['yellow','#ffdd11']])await sharp({create:{width:800,height:600,channels:3,background:color}}).png().toFile(file+'.'+id+'.png');
 await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings:{...defaults,ai:'off',batch:2,diversity:0,tags:['nature'],...settings},providers:providers||[{id:'wallhaven',type:'wallhaven',name:'Wallhaven',enabled:true}],items,pages:{},searchState,providerCooldowns}));
 const child=fork(new URL('./server.mjs',import.meta.url),[],{execArgv:['--import',new URL('./tools/test-native-loader.mjs',import.meta.url).href,'--import',new URL('./tools/test-download-loader.mjs',import.meta.url).href,'--import',new URL('./tools/test-ai-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_PORT:'0',WALLBLOOM_DATA_DIR:data,WALLBLOOM_NATIVE_FIXTURE:file},silent:true,windowsHide:true});
 child.stdout.resume();let errors='';child.stderr.on('data',b=>errors+=b);
 t.after(async()=>{if(child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await end;}await fs.rm(temp,{recursive:true,force:true});});
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.once('exit',()=>reject(Error(errors)));});
 const base='http://127.0.0.1:'+port,get=async()=>await(await fetch(base+'/api/state')).json();let state=await get();
 return {file,data,get,base,async refresh(){const r=await fetch(base+'/api/refresh',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':state.token},body:'{}'});assert.equal(r.status,200,await r.text());const deadline=Date.now()+50000;while(Date.now()<deadline){state=await get();if(!state.job)return state;await new Promise(r=>setTimeout(r,25));}throw Error('refresh timeout');},async searches(){return (await fs.readFile(file+'.searches','utf8')).trim().split('\n').map(Number);}};
}

test('one click fills batch after AI rejects a whole page; remaining page items survive next click',{timeout:25000},async t=>{
 const bad=Array.from({length:9},(_,i)=>picture('bad'+i));
 const f=await fixture(t,{pages:{1:bad,2:['good1','good2','good3'].map(picture),3:[picture('good4')]},imageAliases:{...Object.fromEntries(bad.map(x=>[x.id,'blue'])),good1:'red',good2:'green',good3:'yellow',good4:'blue'}},{items:ratings(),settings:{ai:'eco'}});
 let s=await f.refresh();assert.equal(s.refreshDownloaded,2);assert.equal(s.refreshOutcome,'poolUpdated');assert.equal(s.aiRejectedCount,9);assert.deepEqual(await f.searches(),[1,2]);assert.equal(s.lastError,null);
 s=await f.refresh();assert.equal(s.refreshDownloaded,2);assert.equal(s.refreshOutcome,'poolUpdated');assert.equal(s.items.filter(x=>x.downloaded).length,4);assert.deepEqual(await f.searches(),[1,2,2,3]);
 const requests=(await fs.readFile(f.file+'.requests','utf8')).trim().split('\n').map(JSON.parse);assert.equal(requests.filter(x=>x.url.endsWith('/good1')).length,2,'preview and original are fetched only once each');assert.equal(requests.filter(x=>x.url.includes('/bad')).length,9,'rejected originals are never fetched');
});

test('cached pages beyond the old four-page limit do not require more clicks',{timeout:20000},async t=>{
 const known=Array.from({length:6},(_,i)=>({id:'wallhaven-old'+i,provider:'wallhaven',rating:'safe',tags:[],vote:'ban'}));
 const pages=Object.fromEntries(known.map((x,i)=>[i+1,[picture('old'+i)]]));pages[7]=['good1','good2'].map(picture);
 const f=await fixture(t,{pages,imageAliases:{good1:'red',good2:'green'}},{items:known});const s=await f.refresh();assert.equal(s.refreshDownloaded,2);assert.deepEqual(await f.searches(),[1,2,3,4,5,6,7]);
});

test('stale cursor wraps to the beginning within the same click',{timeout:20000},async t=>{
 const signature=JSON.stringify(['wallhaven',null,null,null,['nature'],[],'100','1M','ru']);
 const f=await fixture(t,{pages:{1:['good1','good2'].map(picture)},imageAliases:{good1:'red',good2:'green'}},{searchState:{wallhaven:{signature,page:50}}});const s=await f.refresh();assert.equal(s.refreshDownloaded,2);assert.deepEqual(await f.searches(),[51,1]);
});

test('failed image does not stop a batch or leave a false global error after recovery',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{1:['failed','good1','good2'].map(picture)},imageAliases:{good1:'red',good2:'green'}});const s=await f.refresh();assert.equal(s.refreshDownloaded,2);assert.equal(s.refreshOutcome,'poolUpdated');assert.equal(s.lastError,null);assert(s.events.some(x=>x.code==='networkError'));
});

test('limited source reports partial count; source errors are not reported as empty results',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{1:[picture('good1')]},imageAliases:{good1:'red'}});let s=await f.refresh();assert.equal(s.refreshDownloaded,1);assert.equal(s.refreshTarget,2);assert.equal(s.refreshOutcome,'poolPartial');
 await fs.writeFile(f.file,JSON.stringify({pages:{},searchError:'rateLimited',delay:0}));s=await f.refresh();assert.equal(s.refreshOutcome,'rateLimited');assert.equal(s.lastError.code,'rateLimited');
});

test('local catalogue continues after 500 files without repeating the first page',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-local-pages-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await Promise.all(Array.from({length:503},(_,i)=>fs.writeFile(path.join(dir,String(i).padStart(4,'0')+'.jpg'),'')));
 const p={id:'local',type:'local',folder:dir};const signal=new AbortController().signal;
 const first=await searchProvider(p,defaults,null,signal,1),second=await searchProvider(p,defaults,null,signal,2),end=await searchProvider(p,defaults,null,signal,3);
 assert.equal(first.length,500);assert.equal(second.length,3);assert.equal(end.length,0);assert(!second.some(x=>first.some(y=>x.id===y.id)));
});

test('one click continues past a hundred duplicate originals to fill the requested batch',{timeout:60000},async t=>{
 const copies=Array.from({length:100},(_,i)=>'copy'+i),ids=['original',...copies,'next'];
 const f=await fixture(t,{pages:{1:ids.map(picture)},imageAliases:{...Object.fromEntries(ids.map(id=>[id,'red'])),next:'green'}},{settings:{batch:1}});
 let s=await f.refresh();assert.equal(s.refreshDownloaded,1);
 s=await f.refresh();assert.equal(s.refreshDownloaded,1);assert.equal(s.refreshOutcome,'poolUpdated');
 const requests=(await fs.readFile(f.file+'.requests','utf8')).trim().split('\n').map(JSON.parse);assert.equal(requests.filter(x=>x.url.endsWith('/copy0')).length,1);
});

test('unreviewed pool capacity remains a hard limit',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{1:['good1','good2'].map(picture)},imageAliases:{good1:'red',good2:'green'}},{settings:{pendingTarget:1}});
 let s=await f.refresh();assert.equal(s.refreshDownloaded,1);assert.equal(s.refreshTarget,1);
 const calls=await f.searches();s=await f.refresh();assert.equal(s.refreshOutcome,'poolReady');assert.deepEqual(await f.searches(),calls);assert.equal(s.items.filter(x=>x.downloaded).length,1);
});

test('alternating interest and discovery searches resume their own pages',{timeout:25000},async t=>{
 const f=await fixture(t,{pages:{1:[picture('old')],2:[picture('good1')],3:[picture('good2')],4:[picture('good3')]},imageAliases:{good1:'red',good2:'green',good3:'blue'}},{items:[{id:'wallhaven-old',provider:'wallhaven',rating:'safe',tags:[],vote:'ban'}],settings:{batch:1}});
 assert.equal((await f.refresh()).refreshDownloaded,1);
 for(const diversity of [100,0]){const state=await f.get();const r=await fetch(f.base+'/api/settings',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':state.token},body:JSON.stringify({...state.settings,diversity})});assert(r.ok);assert.equal((await f.refresh()).refreshDownloaded,1);}
 assert.deepEqual(await f.searches(),[1,2,1,2,3,3,4]);
});

test('Wallhaven quota failure schedules retry instead of treating the source as empty',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{},searchError:'rateLimited',retryAfter:3600000},{settings:{autoRefresh:true}});
 const started=Date.now(),s=await f.refresh();assert.equal(s.refreshOutcome,'rateLimited');assert.equal(s.refreshDownloaded,0);assert(s.automation.refresh.nextAt>=started+3600000);assert.deepEqual(await f.searches(),[1]);
});

test('a missing Konachan tag does not stop other interests from filling the batch',{timeout:20000},async t=>{
 const images=['good1','good2'].map((id,i)=>({id:i+1,rating:'s',tags:'nature',file_url:'https://example.com/'+id,preview_url:'https://example.com/'+id,width:800,height:600}));
 const f=await fixture(t,{konachanPages:{nature:images},imageAliases:{good1:'red',good2:'green'}},{providers:[{id:'konachan',type:'konachan',name:'Konachan',enabled:true}],settings:{tags:['missing','nature']}});
 const s=await f.refresh();assert.equal(s.refreshDownloaded,2);assert.equal(s.refreshOutcome,'poolUpdated');assert.deepEqual(await f.searches(),[1,1]);
});

async function begin(f){const s=await f.get();const r=await fetch(f.base+'/api/refresh',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':s.token},body:'{}'});assert.equal(r.status,200);}
async function until(f,predicate){const deadline=Date.now()+15000;while(Date.now()<deadline){const s=await f.get();if(predicate(s))return s;await new Promise(resolve=>setTimeout(resolve,20));}assert.fail('State condition timed out');}

test('prepared counters exclude AI rejections and reflect two overlapping original transfers',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{1:['bad1','bad2','good1','good2','good3'].map(picture)},imageAliases:{bad1:'blue',bad2:'blue',good1:'red',good2:'green',good3:'yellow'},downloadDelay:600,previewDelay:0},{items:ratings(),settings:{ai:'eco',batch:3}});
 await begin(f);const running=await until(f,s=>s.job?.ready===3&&s.job.downloaded===0);
 assert.equal(running.job.target,3);assert.equal(running.job.active,2);assert.equal(running.job.total,5);assert.equal(running.job.done,5);
 const result=await until(f,s=>!s.job);assert.equal(result.refreshDownloaded,3);assert.equal(result.refreshOutcome,'poolUpdated');
 const details=(await fs.readFile(f.file+'.details','utf8')).trim().split('\n');assert(!details.some(id=>id.startsWith('bad')),'Rejected previews must not request full metadata');
 const transfers=(await fs.readFile(f.file+'.starts','utf8')).trim().split('\n').map(JSON.parse).filter(x=>x.original);assert.equal(transfers.length,3);assert(transfers[1].time-transfers[0].time<500);assert(transfers[2].time-transfers[0].time>=500);
});

test('cancelling a batch records saved files and settles queued and active downloads',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{1:['good1','good2','good3','good4'].map(picture)},imageAliases:{good1:'red',good2:'green',good3:'yellow',good4:'blue'},downloadDelay:2000,originalDelays:{good1:100,good2:100},previewDelay:0},{settings:{batch:4}});
 await begin(f);const running=await until(f,s=>s.job?.downloaded>=2);const r=await fetch(f.base+'/api/cancel',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':running.token},body:'{}'});assert.equal(r.status,200);
 const s=await until(f,s=>!s.job);assert.equal(s.refreshTarget,4);assert.equal(s.refreshDownloaded,s.items.filter(x=>x.downloaded).length);assert.equal(s.refreshDownloaded,2);assert.equal(s.refreshOutcome,'poolPartial');assert.equal(s.refreshReason,'cancelled');
});

for(const code of ['rateLimited','sourceQuotaReached'])test('a '+code+' metadata source does not block a healthy source',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{1:[picture('limited')]},detailErrors:{limited:code},konachanPages:{nature:[{id:1,rating:'s',tags:'unrelated',file_url:'https://example.com/good',preview_url:'https://example.com/good',width:800,height:600}]},imageAliases:{good:'green'}},{settings:{batch:1},providers:[{id:'wallhaven',type:'wallhaven',name:'Wallhaven',enabled:true},{id:'konachan',type:'konachan',name:'Konachan',enabled:true}]});
 const s=await f.refresh();assert.equal(s.refreshDownloaded,1);assert.equal(s.refreshOutcome,'poolUpdated');assert.equal(s.items.find(x=>x.downloaded).provider,'konachan');assert.equal(s.lastError,null);
});

test('slow originals are deferred and replaced during the same click',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{1:['slow','good1','good2'].map(picture)},slowIds:['slow'],imageAliases:{good1:'red',good2:'green'}},{settings:{batch:2}});
 const s=await f.refresh();assert.equal(s.refreshDownloaded,2);assert.equal(s.refreshOutcome,'poolUpdated');assert.equal(s.refreshReason,'');const slow=s.items.find(x=>x.id==='wallhaven-slow');assert.equal(slow.error,'downloadSlow');assert(slow.downloadRetryAt>Date.now());
});

test('known oversized files are skipped before metadata, AI and original transfers',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{1:[{...picture('oversized'),file_size:40*1024**2},picture('good')]},imageAliases:{good:'green'}},{settings:{batch:1}});
 const s=await f.refresh();assert.equal(s.refreshDownloaded,1);const starts=(await fs.readFile(f.file+'.starts','utf8')).trim().split('\n').map(JSON.parse);assert(!starts.some(x=>x.id==='oversized'));assert(!(await fs.readFile(f.file+'.details','utf8')).includes('oversized'));
});
test('batch replenishment does not restore rated or deliberately cleaned files',{timeout:20000},async t=>{
 const items=[{vote:'like'},{vote:'neutral'},{vote:'deferred'},{cleanupRemoved:true},{cachePurged:true}].map((extra,i)=>({id:'wallhaven-old'+i,provider:'wallhaven',url:'https://example.com/old'+i,rating:'safe',tags:[],...extra}));
 const f=await fixture(t,{pages:{1:[picture('good')]},imageAliases:{good:'green'}},{items,settings:{batch:1}});
 const s=await f.refresh();assert.equal(s.refreshDownloaded,1);const starts=(await fs.readFile(f.file+'.starts','utf8')).trim().split('\n').map(JSON.parse);assert(starts.every(x=>x.id==='good'));assert.equal(s.items.filter(x=>x.downloaded).length,1);
});
test('overlapping original transfers serialize storage commits and respect the disk quota',{timeout:25000},async t=>{
 const f=await fixture(t,{pages:{1:['good1','good2'].map(picture)},imageAliases:{good1:'red',good2:'green'}},{settings:{batch:2,maxTotalGB:.1}}),sharp=await sharpModule();
 for(const name of ['red','green'])await sharp(randomBytes(800*600*3),{raw:{width:800,height:600,channels:3}}).png().toFile(f.file+'.'+name+'.png');
 const probe=path.join(f.data,'size-probe');await initLibrary(probe);const state=await f.get();
 await downloadImage(probe,{id:'probe',localSource:f.file+'.red.png'},{...state.settings,maxTotalGB:1},new AbortController().signal);
 const delta=await usage(probe),limit=.1*1024**3,fill=Math.floor(limit-await usage(f.data)-delta*1.4-16384),handle=await fs.open(path.join(f.data,'filler.bin'),'w');try{await handle.truncate(fill);}finally{await handle.close();}
 const s=await f.refresh();assert.equal(s.refreshDownloaded,1);assert.equal(s.refreshReason,'diskLimit');assert(await usage(f.data)<=limit);
});
test('failed originals reuse cached metadata when retried instead of querying the API again',{timeout:20000},async t=>{
 const config={pages:{1:[picture('failed')]},imageAliases:{failed:'red'},delay:0};const f=await fixture(t,config,{settings:{batch:1}});
 let s=await f.refresh();assert.equal(s.refreshDownloaded,0);await fs.writeFile(f.file,JSON.stringify({...config,allowFailed:true}));
 s=await f.refresh();assert.equal(s.refreshDownloaded,1);assert.deepEqual((await fs.readFile(f.file+'.details','utf8')).trim().split('\n'),['failed']);
});
test('disabling a source prevents queued originals from starting and prevents active transfers from committing',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{1:['good1','good2','good3','good4'].map(picture)},imageAliases:{good1:'red',good2:'green',good3:'yellow',good4:'blue'},downloadDelay:500,previewDelay:0},{settings:{batch:4}});
 await begin(f);const running=await until(f,s=>s.job?.ready===4);const provider=running.providers.find(p=>p.id==='wallhaven');
 const r=await fetch(f.base+'/api/provider',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':running.token},body:JSON.stringify({...provider,enabled:false})});assert.equal(r.status,200);
 const s=await until(f,s=>!s.job);assert.equal(s.refreshDownloaded,0);assert.equal(s.items.filter(x=>x.downloaded).length,0);
 const starts=(await fs.readFile(f.file+'.starts','utf8')).trim().split('\n').map(JSON.parse).filter(x=>x.original);assert.equal(starts.length,2);
});
test('queued downloads respect a stricter AI filter selected during the transfer',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{1:['borderline','good1','good2'].map(picture)},imageAliases:{borderline:'blue',good1:'red',good2:'green'},downloadDelay:500,previewDelay:0,embeddings:{'wallhaven-borderline':[.69,.72,...Array(510).fill(0)]}},{items:ratings(),settings:{batch:2,ai:'eco',aiFilter:'cautious'}});
 await begin(f);const running=await until(f,s=>s.job?.ready===2);const response=await fetch(f.base+'/api/settings',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':running.token},body:JSON.stringify({...running.settings,aiFilter:'strict'})});assert.equal(response.status,200);
 const s=await until(f,s=>!s.job);assert.equal(s.refreshDownloaded,2);assert.equal(s.aiRejectedCount,1);assert(!s.items.some(x=>x.id==='wallhaven-borderline'&&x.downloaded));
});
test('source download cooldown survives restart and a credential change permits a fresh check',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{1:[picture('good')]},imageAliases:{good:'green'}},{settings:{batch:1},providerCooldowns:{wallhaven:{code:'sourceQuotaReached',retryAt:Date.now()+60000,time:Date.now()}}});
 let s=await f.refresh();assert.equal(s.lastError.code,'sourceQuotaReached');await assert.rejects(fs.access(f.file+'.searches'));
 const provider=s.providers.find(p=>p.id==='wallhaven'),r=await fetch(f.base+'/api/provider',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':s.token},body:JSON.stringify({...provider,apiKey:'FIXTURE_NEW_KEY'})});assert.equal(r.status,200);
 s=await f.refresh();assert.equal(s.refreshDownloaded,1);assert.equal(s.refreshOutcome,'poolUpdated');
});
test('repeated slow transfers stop retrying an unhealthy source instead of scanning it indefinitely',{timeout:20000},async t=>{
 const f=await fixture(t,{pages:{1:['slow1','slow2','slow3','good'].map(picture)},slowIds:['slow1','slow2','slow3'],imageAliases:{good:'green'}},{settings:{batch:1}});
 const s=await f.refresh();assert.equal(s.refreshDownloaded,0);assert.equal(s.providerStatus.wallhaven.code,'sourceTemporarilyUnavailable');assert(s.providerStatus.wallhaven.retryAt>Date.now());
 const starts=(await fs.readFile(f.file+'.starts','utf8')).trim().split('\n').map(JSON.parse).filter(x=>x.original);assert.deepEqual(starts.map(x=>x.id),['slow1','slow2','slow3']);
});

test('the overall time limit stops queued originals and keeps completed files and counts',async t=>{
 const f=await fixture(t,{pages:{1:['good1','good2','good3','good4'].map(picture)},imageAliases:{good1:'red',good2:'green',good3:'yellow',good4:'blue'},downloadDelay:200,previewDelay:0,advanceTimeAfterOriginal:8*60000+1},{settings:{batch:4}});
 const s=await f.refresh();assert.equal(s.refreshDownloaded,2);assert.equal(s.refreshTarget,4);assert.equal(s.refreshOutcome,'poolPartial');assert.equal(s.refreshReason,'searchTimeLimit');assert.equal(s.items.filter(x=>x.downloaded).length,2);
 const starts=(await fs.readFile(f.file+'.starts','utf8')).trim().split('\n').map(JSON.parse).filter(x=>x.original);assert.equal(starts.length,2);assert.deepEqual(await f.searches(),[1]);
});