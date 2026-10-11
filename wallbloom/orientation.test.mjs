import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {fork} from 'node:child_process';
import {defaults,sharpModule} from './core.mjs';import {hasPortraitScreen,portraitImage,sourceDimensions} from './orientation.mjs';
import {visualFingerprint} from './library.mjs';
import {duplicateOf} from './automation.mjs';

test('duplicate fingerprints use displayed dimensions after EXIF rotation',async()=>{
 const sharp=await sharpModule(),pixels=Buffer.alloc(240*160*3);
 for(let y=0;y<160;y++)for(let x=0;x<240;x++){const i=(y*240+x)*3;pixels[i]=x;pixels[i+1]=y;pixels[i+2]=x%60<30?40:200;}
 const original=await sharp(pixels,{raw:{width:240,height:160,channels:3}}).withMetadata({orientation:6}).jpeg({quality:95}).toBuffer();
 const rotated=await sharp(original).rotate().resize(80,120).jpeg({quality:75}).toBuffer();
 const a={id:'original',downloaded:true,...await visualFingerprint(original)},b={id:'rotated',...await visualFingerprint(rotated)};
 assert.equal(a.visualAspect,160/240);assert.equal(b.visualAspect,a.visualAspect);
 assert.notEqual(a.hash,b.hash);assert.notEqual(a.pixelHash,b.pixelHash);
 assert.equal(duplicateOf(b,[a]),a);
});
test('physical monitor orientation and EXIF determine whether portrait downloads are needed',()=>{assert.equal(hasPortraitScreen([{width:1920,height:1080}],{width:1080,height:1920}),false);assert.equal(hasPortraitScreen([{width:1920,height:1080},{width:1080,height:1920}]),true);assert.equal(portraitImage({width:1920,height:1080,sourceWidth:800,sourceHeight:1200}),true);assert.deepEqual(sourceDimensions({width:1920,height:1080,orientation:6}),{sourceWidth:1080,sourceHeight:1920});});
test('portrait originals are skipped before full transfer, retries respect current monitors, and likes can be removed',{timeout:20000},async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-orientation-')),data=path.join(dir,'data'),fixture=path.join(dir,'native.json');await fs.mkdir(data);
 const sharp=await sharpModule(),items=[{id:'new',width:800,height:600},{id:'portrait-known',width:600,height:800},{id:'portrait-unknown'}].map(x=>({...x,title:x.id,url:'https://example.com/'+x.id,rating:'safe',tags:[]}));
 for(const [id,w,h,color] of [['new',800,600,'#314589'],['portrait-known',600,800,'#986641'],['portrait-unknown',600,800,'#589063']])await sharp({create:{width:w,height:h,channels:3,background:color}}).png().toFile(fixture+'.'+id+'.png');
 const configuration={monitors:[{id:'horizontal',width:800,height:600}],items};await fs.writeFile(fixture,JSON.stringify(configuration));await fs.writeFile(path.join(data,'state.json'),JSON.stringify({settings:{...defaults,batch:3},providers:[{id:'feed',name:'Test',type:'feed',url:'https://example.com/feed',enabled:true}],items:[{id:'unfinished-portrait',provider:'feed',width:600,height:800,rating:'safe',tags:[],downloaded:false}],pages:{},current:null,lastRefresh:0,lastRotation:0}));
 const child=fork(new URL('./server.mjs',import.meta.url),[],{execArgv:['--import',new URL('./tools/test-native-loader.mjs',import.meta.url).href,'--import',new URL('./tools/test-download-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_PORT:'0',WALLBLOOM_DATA_DIR:data,WALLBLOOM_NATIVE_FIXTURE:fixture},silent:true,windowsHide:true});child.stdout.resume();let errors='';child.stderr.on('data',b=>errors+=b);t.after(async()=>{if(child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await exited;}await fs.rm(dir,{recursive:true,force:true});});
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.once('exit',()=>reject(Error(errors)));}),base='http://127.0.0.1:'+port;let state=await(await fetch(base+'/api/state')).json();
 const post=async(route,body={})=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':state.token},body:JSON.stringify(body)});assert.equal(r.status,200,await r.text());};
 const wait=async()=>{for(let i=0;i<200;i++){state=await(await fetch(base+'/api/state')).json();if(!state.job)return;await new Promise(r=>setTimeout(r,30));}throw Error('timeout');};
 await post('retry-pending');await wait();assert.equal(state.items.length,0);
 await post('refresh');await wait();assert.equal(state.items.length,1);const requests=(await fs.readFile(fixture+'.requests','utf8')).trim().split('\n').map(JSON.parse);assert.ok(!requests.some(x=>x.url.endsWith('portrait-known')));assert.ok(requests.filter(x=>x.url.endsWith('portrait-unknown')).every(x=>x.prefix>0));
 const id=state.items[0].id;await post('vote',{id,vote:'like'});await post('vote',{id,vote:null});state=await(await fetch(base+'/api/state')).json();assert.equal(state.items[0].vote,null);await fs.access(path.join(data,'pending',id+'.jpg'));await assert.rejects(fs.access(path.join(data,'liked',id+'.jpg')));
 configuration.monitors.push({id:'vertical',width:600,height:800});await fs.writeFile(fixture,JSON.stringify(configuration));await post('refresh');await wait();assert.equal(state.items.filter(x=>x.downloaded).length,3);
});
