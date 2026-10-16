import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fork} from 'node:child_process';
import {defaults,sharpModule} from './core.mjs';
import {searchProvider} from './providers.mjs';

const picture=id=>({id,path:'https://example.com/'+id,url:'https://example.com/source',thumbs:{small:'https://example.com/'+id},purity:'sfw',dimension_x:800,dimension_y:600});
const ratings=()=>Array.from({length:5},(_,i)=>[{id:'positive'+i,vote:'like',embeddingVersion:2,embedding:[1,0,...Array(510).fill(0)],tags:[],rating:'safe'},{id:'negative'+i,vote:'dislike',embeddingVersion:2,embedding:[0,1,...Array(510).fill(0)],tags:[],rating:'safe'}]).flat();
async function fixture(t,config,{items=[],settings={},searchState}={}){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-refresh-')),data=path.join(temp,'data'),file=path.join(temp,'fixture.json');await fs.mkdir(data);
 config={delay:0,...config};await fs.writeFile(file,JSON.stringify(config));
 const sharp=await sharpModule();
 for(const [id,color] of [['red','#ff3344'],['green','#33ee77'],['blue','#3344ff'],['yellow','#ffdd11']])await sharp({create:{width:800,height:600,channels:3,background:color}}).png().toFile(file+'.'+id+'.png');
 await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings:{...defaults,ai:'off',batch:2,diversity:0,tags:['nature'],...settings},providers:[{id:'wallhaven',type:'wallhaven',name:'Wallhaven',enabled:true}],items,pages:{},searchState}));
 const child=fork(new URL('./server.mjs',import.meta.url),[],{execArgv:['--import',new URL('./tools/test-native-loader.mjs',import.meta.url).href,'--import',new URL('./tools/test-download-loader.mjs',import.meta.url).href,'--import',new URL('./tools/test-ai-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_PORT:'0',WALLBLOOM_DATA_DIR:data,WALLBLOOM_NATIVE_FIXTURE:file},silent:true,windowsHide:true});
 child.stdout.resume();let errors='';child.stderr.on('data',b=>errors+=b);
 t.after(async()=>{if(child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await end;}await fs.rm(temp,{recursive:true,force:true});});
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.once('exit',()=>reject(Error(errors)));});
 const base='http://127.0.0.1:'+port,get=async()=>await(await fetch(base+'/api/state')).json();let state=await get();
 return {file,data,get,base,async refresh(){const r=await fetch(base+'/api/refresh',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':state.token},body:'{}'});assert.equal(r.status,200,await r.text());for(let i=0;i<1000;i++){state=await get();if(!state.job)return state;await new Promise(r=>setTimeout(r,15));}throw Error('refresh timeout');},async searches(){return (await fs.readFile(file+'.searches','utf8')).trim().split('\n').map(Number);}};
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

test('candidate budget is explicit and later clicks skip already identified duplicates',{timeout:60000},async t=>{
 const copies=Array.from({length:100},(_,i)=>'copy'+i),ids=['original',...copies,'next'];
 const f=await fixture(t,{pages:{1:ids.map(picture)},imageAliases:{...Object.fromEntries(ids.map(id=>[id,'red'])),next:'green'}},{settings:{batch:1}});
 let s=await f.refresh();assert.equal(s.refreshDownloaded,1);
 s=await f.refresh();assert.equal(s.refreshDownloaded,0);assert.equal(s.refreshOutcome,'searchLimited');
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
