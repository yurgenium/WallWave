// Real browser regression for large libraries, thumbnail caching and card updates.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fork} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {defaults,sharpModule} from '../core.mjs';

const require=createRequire(path.resolve(process.argv[2],'package.json'));
const {chromium}=require('playwright');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-gallery-'));
const data=path.join(temp,'library'),fixture=path.join(temp,'native.json');
await fs.mkdir(path.join(data,'pending'),{recursive:true});
await fs.mkdir(path.join(data,'thumbnails'));
const bytes=await(await sharpModule())({create:{width:800,height:600,channels:3,background:'#438978'}}).jpeg().toBuffer();
const items=Array.from({length:821},(_,i)=>({id:'gallery-'+i,provider:'local',title:'Image '+i,downloaded:true,thumbnailVersion:2,width:800,height:600,rating:'safe',tags:['nature'],colors:[67,137,120]}));
await Promise.all(items.flatMap(x=>['thumbnails','pending'].map(folder=>fs.writeFile(path.join(data,folder,x.id+'.jpg'),bytes))));
await fs.writeFile(fixture,JSON.stringify({activity:{fullscreen:true},monitors:[]}));
await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings:{...defaults,ai:'off',rotation:false},providers:[{id:'local',name:'Fixture',type:'local',folder:temp,enabled:true}],items,pages:{}}));
const child=fork(new URL('../server.mjs',import.meta.url),[],{execArgv:['--import',new URL('test-native-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_DATA_DIR:data,WALLBLOOM_PORT:'0',WALLBLOOM_NATIVE_FIXTURE:fixture},silent:true,windowsHide:true});
child.stdout.resume();let stderr='',browser;
child.stderr.on('data',b=>stderr+=b);
try{
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.on('exit',()=>reject(Error(stderr)));});
 const base='http://127.0.0.1:'+port;
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1680,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const started=performance.now();await page.goto(base);
 await page.waitForFunction(()=>document.querySelectorAll('#grid .card').length===821);
 const firstRenderMs=Math.round(performance.now()-started);
 const imagesLoaded=()=>[...document.querySelectorAll('#grid .card img')].slice(0,6).every(img=>img.complete&&img.naturalWidth>0);
 await page.waitForFunction(imagesLoaded);
 await page.evaluate(()=>{
  window.galleryImages=[...document.querySelectorAll('#grid .card img')];
  window.galleryMoves=[];
  new MutationObserver(records=>{for(const r of records)for(const n of r.removedNodes)if(n.matches?.('.card'))window.galleryMoves.push(n.dataset.itemId);}).observe(document.getElementById('grid'),{childList:true});
 });
 const state=await(await fetch(base+'/api/state')).json();
 const response=await fetch(base+'/api/vote',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':state.token},body:JSON.stringify({id:'gallery-5',vote:'neutral'})});
 assert.equal(response.status,200);
 await page.waitForFunction(()=>document.querySelector('[data-item-id="gallery-5"] [data-vote="neutral"]').classList.contains('selected'));
 await page.waitForFunction(imagesLoaded);
 await page.evaluate(async()=>{const img=document.querySelector('[data-item-id="gallery-5"] img');await(await fetch(img.src)).arrayBuffer();});
 const result=await page.evaluate(()=>({
  unchangedImages:window.galleryImages.every((img,i)=>i===5||img===document.querySelectorAll('#grid .card img')[i]),
  moved:window.galleryMoves,
  cached:performance.getEntriesByType('resource').filter(r=>r.name.includes('/image/gallery-5?')).map(r=>({transfer:r.transferSize,decoded:r.decodedBodySize}))
 }));
 assert(result.unchangedImages,'Updating one rating must preserve other image elements');
 assert.deepEqual(result.moved,['gallery-5'],'Updating one card must not detach the rest of the library');
 assert(result.cached.length>=2&&result.cached.at(-1).transfer===0&&result.cached.at(-1).decoded>0,'Replacement image must use the browser cache: '+JSON.stringify(result.cached));
 await page.locator('[data-view="settings"]').click();assert(!await page.locator('#status').isVisible());
 await page.locator('[data-view="library"]').click();assert(await page.locator('#status').isVisible());
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,cards:821,firstRenderMs,updatedCards:result.moved.length,thumbnailFromCache:true}));
}finally{
 await browser?.close();
 if(child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await ended;}
 await fs.rm(temp,{recursive:true,force:true});
}
