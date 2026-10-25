// Real Electron UI with the HTTP service disabled. Uses a private test library.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {defaults,sharpModule} from '../core.mjs';

const own=createRequire(import.meta.url),require=createRequire(path.resolve(process.argv[2],'package.json'));
const {_electron}=require('playwright'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-desktop-ipc-')),data=path.join(temp,'library');
await fs.mkdir(path.join(data,'pending'),{recursive:true});await fs.mkdir(path.join(data,'thumbnails'));
const image=await(await sharpModule())({create:{width:800,height:600,channels:3,background:'#438978'}}).jpeg().toBuffer();
const items=Array.from({length:821},(_,i)=>({id:'ipc-'+i,provider:'local',downloaded:true,thumbnailVersion:2,title:'Fixture '+i,rating:['safe','suggestive','adult'][i%3],width:800,height:600,tags:['nature',...Array.from({length:19},(_,n)=>'landscape '+n)],colors:[67,137,120]}));
await Promise.all(items.flatMap(x=>['pending','thumbnails'].map(folder=>fs.writeFile(path.join(data,folder,x.id+'.jpg'),image))));
await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings:{...defaults,purity:'111'},providers:[{id:'local',name:'Fixture',type:'local',folder:temp,enabled:true}],items,pages:{}}));
const executablePath=process.argv[3]?path.resolve(process.argv[3]):own('electron');let app;
try{
 app=await _electron.launch({executablePath,args:process.argv[3]?[]:[path.resolve(new URL('..',import.meta.url).pathname.slice(1))],env:{...process.env,WALLBLOOM_DESKTOP_TEST:'1',WALLBLOOM_DESKTOP_TEST_HOME:temp,WALLBLOOM_DATA_DIR:data,WALLBLOOM_DESKTOP_NO_HTTP:'1'},timeout:30000});
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('#grid .card').first().waitFor();assert.equal(page.url(),'wallwave://app/');
 const ready=JSON.parse(await fs.readFile(path.join(data,'desktop-test-ready.json'),'utf8'));assert.equal(ready.base,'wallwave://app');
 await page.waitForFunction(()=>[...document.querySelectorAll('#grid .card img')].slice(0,4).every(img=>img.complete&&img.naturalWidth>0));
 let networkRequests=0;page.on('request',request=>{if(/^https?:/.test(request.url()))networkRequests++;});
 const timings=[];
 for(const index of [0,1,0,2,1,2]){
  const start=performance.now();await page.locator('#purity button').nth(index).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#purity button')].every(b=>!b.disabled));timings.push(Math.round(performance.now()-start));
 }
 await page.locator('[data-view="settings"]').click();assert(!await page.locator('#status').isVisible());
 await page.locator('[data-view="library"]').click();assert(await page.locator('#status').isVisible());
 await page.reload();await page.locator('#grid .card').first().waitFor();
 // Exercise the downloadable report without applying any real desktop wallpaper.
 const report=await page.evaluate(async()=>{
  const state=await(await fetch('/api/state')).json();
  await fetch('/api/apply',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':state.token},body:JSON.stringify({id:'missing-diagnostic-fixture'})});
  for(let i=0;i<50;i++){const next=await(await fetch('/api/state')).json();if(!next.wallpaperAction)break;await new Promise(r=>setTimeout(r,20));}
  return(await fetch('/api/diagnostics')).json();
 });
 const version=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8')).version;
 assert.equal(report.version,version);assert.equal(report.schemaVersion,2);assert.equal(report.history.lastFailure.action,'apply');assert.equal(report.history.lastFailure.error.reason,'itemMissing');
 const downloadedReport=path.join(temp,'downloaded-diagnostics.json');
 await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},downloadedReport);
 await page.locator('[data-view="settings"]').click();await page.locator('[data-settings-tab="help"]').click();
 await page.locator('a[download="WallWave-diagnostics.json"]').click();await page.waitForFunction(()=>document.querySelector('a[download="WallWave-diagnostics.json"]').getAttribute('aria-busy')==='false');const downloaded=JSON.parse(await fs.readFile(downloadedReport,'utf8'));assert.equal(downloaded.version,version);assert.equal(downloaded.history.lastFailure.error.reason,'itemMissing');
 assert.equal(networkRequests,0,'local UI must never make HTTP/TCP requests');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,transport:'IPC',httpServer:false,networkRequests,ratingToggleMs:timings,diagnosticVersion:downloaded.version,diagnosticDownload:true}));
}catch(error){console.error(error);throw error;}finally{
 if(app){const proc=app.process(),exited=new Promise(resolve=>proc.exitCode!==null?resolve():proc.once('exit',resolve));const closed=app.waitForEvent('close',{timeout:15000});await app.evaluate(()=>globalThis.__wallbloomTest.beginQuit());await closed;await exited;}
 await fs.rm(temp,{recursive:true,force:true,maxRetries:30,retryDelay:100});
}
