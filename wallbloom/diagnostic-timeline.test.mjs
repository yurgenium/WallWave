import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fork} from 'node:child_process';
import {defaults,sharpModule} from './core.mjs';
import {diagnosticsReport,diagnosticContext} from './diagnostics.mjs';

async function fixture(t){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-timeline-')),data=path.join(temp,'library'),native=path.join(temp,'native.json');
 await fs.mkdir(path.join(data,'pending'),{recursive:true});await fs.mkdir(path.join(data,'thumbnails'));
 const image=await(await sharpModule())({create:{width:100,height:80,channels:3,background:'#437860'}}).jpeg().toBuffer();
 const monitor={rotation:false,rotationMinutes:60,purity:'100',tags:['SECRET_MONITOR_INTEREST']};
 const monitors=Array.from({length:4},(_,i)=>({id:'PRIVATE_MONITOR_'+i,width:800+i*100,height:600,left:i*800,top:0,wallpaper:''}));
 const settings={...defaults,purity:'111',tags:['SECRET_INTEREST'],excludedTags:['SECRET_EXCLUSION'],monitors:Object.fromEntries(monitors.map(m=>[m.id,monitor]))};
 for(const folder of ['pending','thumbnails'])await fs.writeFile(path.join(data,folder,'PRIVATE_IMAGE_ID.jpg'),image);
 await fs.writeFile(native,JSON.stringify({monitors}));await fs.writeFile(path.join(data,'credentials.json'),JSON.stringify({personal:'SECRET_API_KEY'}));
 await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings,providers:[{id:'personal',type:'feed',name:'PRIVATE_SOURCE_NAME',url:'https://private.example/feed?token=SECRET_API_KEY',enabled:true}],items:[{id:'PRIVATE_IMAGE_ID',title:'PRIVATE_IMAGE_TITLE',tags:['SECRET_IMAGE_TAG'],provider:'personal',rating:'safe',downloaded:true,thumbnailVersion:2,vote:'like'}],pages:{}}));
 let child,base,stderr='';
 async function start(){
  child=fork(new URL('./server.mjs',import.meta.url),[],{execArgv:['--import',new URL('./tools/test-native-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_DATA_DIR:data,WALLBLOOM_PORT:'0',WALLBLOOM_NATIVE_FIXTURE:native},silent:true,windowsHide:true});
  child.stdout.resume();child.stderr.on('data',bytes=>stderr+=bytes);
  const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.once('exit',()=>reject(Error(stderr)));});base='http://127.0.0.1:'+port;
 }
 async function stop(){if(child&&child.exitCode===null){const ended=new Promise(resolve=>child.once('exit',resolve));child.send({type:'shutdown'});await ended;}}
 await start();t.after(async()=>{await stop();await fs.rm(temp,{recursive:true,force:true});});
 const state=async()=>await(await fetch(base+'/api/state')).json();
 return {data,temp,state,report:async()=>await(await fetch(base+'/api/diagnostics')).json(),async restart(){await stop();await start();},async post(route,body,trace,origin='library'){
  const s=await state(),response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':s.token,'X-Wallwave-Trace':trace,'X-Wallwave-Origin':origin},body:JSON.stringify(body)});
  assert.equal(response.status,200,await response.text());
 },async wait(){for(let i=0;i<100;i++){const s=await state();if(!s.wallpaperAction&&!s.job)return s;await new Promise(r=>setTimeout(r,20));}throw Error('Operation timeout');},async missingThumbnail(){await fs.rm(path.join(data,'thumbnails','PRIVATE_IMAGE_ID.jpg'));const r=await fetch(base+'/image/PRIVATE_IMAGE_ID');assert.equal(r.status,404);}};
}

test('report reconstructs a global control change, effects on every monitor, failure and restart without private preferences',async t=>{
 const f=await fixture(t),before=await f.state(),settingsTrace='a'.repeat(32),applyTrace='b'.repeat(32);
 await f.post('settings',{...before.settings,purity:'011'},settingsTrace,'library.contentCategories');
 await f.post('apply',{id:'PRIVATE_IMAGE_ID'},applyTrace);await f.wait();
 let report=await f.report();assert.equal(report.schemaVersion,3);
 const events=report.journal.events,change=events.find(x=>x.event==='configuration.changed');
 assert.equal(change.traceId,settingsTrace);assert.equal(change.attributes.origin,'library.contentCategories');assert.equal(change.attributes.before.enabledCount,3);assert.equal(change.attributes.after.enabledCount,2);
 assert(change.attributes.fields.includes('contentCategories'));assert.equal(change.attributes.categorySetChanged,true);
 const monitors=events.filter(x=>x.event==='configuration.monitor_changed'&&x.traceId===settingsTrace);
 assert.equal(monitors.length,4);assert(monitors.every(x=>x.attributes.before.effectiveCount===1&&x.attributes.after.effectiveCount===0&&x.attributes.after.conflict));
 assert.equal(report.reproduction.lastFailure.traceId,applyTrace);assert.equal(report.reproduction.expectedOutcome,'wallpaperChanged');
 assert(report.reproduction.observedSteps.some(x=>x.event==='configuration.changed'));
 assert(report.journal.events.every(x=>Number.isFinite(x.timestamp)&&Number.isFinite(x.observedTimestamp)&&x.component&&x.event));
 const checkPrivacy=value=>{const json=JSON.stringify(value);for(const secret of ['PRIVATE_','SECRET_','private.example',f.temp,'"purity"','"configuredPurity"','"rating"','"vote"','"tags"','"byRating"','"aiFilter"'])assert(!json.includes(secret),secret);};
 checkPrivacy(report);
 await f.restart();report=await f.report();checkPrivacy(report);assert(report.journal.events.some(x=>x.traceId===settingsTrace));assert(report.journal.events.filter(x=>x.event==='session.started').length>=2);
 assert(report.journal.events.some(x=>x.event==='session.ended'&&x.attributes.clean));
 const visible=await f.state();await f.post('settings',{...visible.settings,purity:'111'},'c'.repeat(32),'library.contentCategories');
 await f.missingThumbnail();report=await f.report();assert(report.journal.events.some(x=>x.event==='request.failed'&&x.attributes.category==='thumbnail'&&x.attributes.error?.code==='ENOENT'));checkPrivacy(report);
 // Export remains available when the usual local report-cache location is broken.
 await fs.rm(path.join(f.data,'diagnostics'),{recursive:true,force:true});await fs.writeFile(path.join(f.data,'diagnostics'),'blocked cache');
 report=await f.report();assert.equal(report.localCopy.saved,false);assert(report.localCopy.error.systemCode);checkPrivacy(report);
});

test('all monitors are retained without a 64-display truncation and preferences are projected away',()=>{
 const monitors=Array.from({length:96},(_,i)=>({id:'PRIVATE_'+i,width:800,height:600,left:i*800,top:0}));
 const db={settings:{...defaults,purity:'011',tags:['SECRET_TAG'],excludedTags:[],monitors:Object.fromEntries(monitors.map(m=>[m.id,{purity:'100'}]))},providers:[],items:[],monitorCurrent:{}};
 const context=diagnosticContext(db,{monitors,monitorSettings:()=>({...db.settings,purity:'000'})});
 const report=diagnosticsReport(db,{guard:{code:'idle'},events:[],network:{},version:'0.6.12',context});
 assert.equal(report.displayTopology.physicalMonitors.length,96);assert(report.displayTopology.physicalMonitors.every(m=>m.filterConflict));
 assert(!JSON.stringify(report).includes('PRIVATE_'));assert(!JSON.stringify(report).includes('SECRET_TAG'));assert(!JSON.stringify(report).includes('"011"'));
});
