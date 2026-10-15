// Real browser and API regression checks; Windows integration uses a fixture.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fork} from 'node:child_process';
import {defaults,sharpModule} from '../core.mjs';
import {initLibrary,imagePath,visualFingerprint} from '../library.mjs';
import {sourcePath} from '../framing.mjs';
const require=createRequire(path.resolve(process.argv[2],'package.json')),{chromium}=require('playwright');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-review-ui-')),data=path.join(dir,'library'),fixture=path.join(dir,'fixture.json'),personal=path.join(dir,'personal');await initLibrary(data);await fs.mkdir(personal);await fs.writeFile(path.join(personal,'own.png'),'personal original');await fs.writeFile(fixture,JSON.stringify({monitors:[{id:'screen-a',width:800,height:600}]}));
const items=[],sharp=await sharpModule();for(let i=0;i<10;i++){
 const x={id:'item'+i,title:'Fixture '+i,provider:i>=8?'own':'local',tags:['artist, sample','nature'],rating:'safe',vote:i===8?'like':null,downloaded:true,hasOriginal:true,thumbnailVersion:2,width:800,height:600};
 const bytes=await sharp({create:{width:800,height:600,channels:3,background:{r:20+i*20,g:220-i*18,b:40+i*17}}}).jpeg().toBuffer();Object.assign(x,await visualFingerprint(bytes),{bytes:bytes.length});for(const file of [imagePath(data,x),sourcePath(data,x),path.join(data,'thumbnails',x.id+'.jpg')])await fs.writeFile(file,bytes);items.push(x);
}
await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings:{...defaults,diversity:0,tags:[]},providers:[{id:'local',type:'local',name:'Local',enabled:true,folder:personal},{id:'own',type:'local',name:'Own source',enabled:true,folder:personal}],items,pages:{}}));
const child=fork(new URL('../server.mjs',import.meta.url),[],{execArgv:['--import',new URL('./test-native-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_DATA_DIR:data,WALLBLOOM_NATIVE_FIXTURE:fixture,WALLBLOOM_PORT:'0'},silent:true,windowsHide:true});child.stdout.resume();let errorsText='';child.stderr.on('data',b=>errorsText+=b);let browser;
try{
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.once('exit',()=>reject(Error(errorsText)));}),base='http://127.0.0.1:'+port;
 const get=async()=>await(await fetch(base+'/api/state')).json();let state=await get();
 const post=async(route,value)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':state.token},body:JSON.stringify(value)});assert.equal(r.status,200,await r.text());};
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1680,height:1040}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#grid .card').first().waitFor();
 // A polling tick must not replace the pressed Apply button before mouse-up.
 const apply=page.locator('[data-item-id="item0"] .actions button');await apply.scrollIntoViewIfNeeded();const bounds=await apply.boundingBox();await apply.evaluate(el=>window.__pressedApply=el);await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.waitForTimeout(1700);assert(await page.evaluate(()=>window.__pressedApply.isConnected));await page.mouse.up();await page.waitForFunction(async()=>(await(await fetch('/api/state')).json()).current==='item0');
 await page.locator('[data-item-id="item0"] [data-wallpaper-tag="artist, sample"]').click();await page.waitForFunction(async()=>(await(await fetch('/api/state')).json()).settings.tags.includes('artist, sample'));
 assert((await page.locator('#settingsForm [name="tags"]').inputValue()).includes('"artist, sample"'));
 await page.locator('button[data-view="settings"]').click();await page.locator('[data-settings-tab="interests"]').click();await page.locator('#settingsForm [name="excludedTags"]').fill('"other, tag", unwanted');await page.locator('#settingsForm button.primary').click();await page.waitForFunction(async()=>(await(await fetch('/api/state')).json()).settings.excludedTags.includes('other, tag'));
 state=await get();assert.deepEqual(state.settings.tags,['artist, sample']);assert.deepEqual(state.settings.excludedTags,['other, tag','unwanted']);
 await page.locator('button[data-view="library"]').click();await page.locator('[data-item-id="item0"] .preview-trigger').click();const previewId=async()=>decodeURIComponent((await page.locator('.full-preview-image').getAttribute('src')).split('/').at(-1));
 let inFlight=0,maxInFlight=0;await page.route('**/api/vote',async route=>{inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);try{const response=await route.fetch();await new Promise(r=>setTimeout(r,250));await route.fulfill({response});}finally{inFlight--;}});
 await page.keyboard.press('2');assert.equal(await page.locator('.preview-panel .pending-review').count(),1);await page.keyboard.press('ArrowRight');const b=await previewId();await page.keyboard.press('4');await page.locator('.preview-panel [data-vote="neutral"].vote-saving').waitFor();
 await page.keyboard.press('ArrowRight');const c=await previewId();await page.keyboard.press('5');assert.equal(await page.locator('.preview-panel .pending-review').count(),0);await page.waitForFunction(async id=>(await(await fetch('/api/state')).json()).items.find(x=>x.id===id)?.vote==='deferred',c);
 const d=await previewId();assert.notEqual(d,c);await page.keyboard.press('1');await page.waitForFunction(async id=>(await(await fetch('/api/state')).json()).items.find(x=>x.id===id)?.vote==='like',d);
 await page.waitForFunction(async()=>(await(await fetch('/api/state')).json()).items.find(x=>x.id==='item0')?.vote==='dislike');
 await page.waitForFunction(async ids=>JSON.stringify((await(await fetch('/api/state')).json()).recentReviews.map(x=>x.id))===JSON.stringify(ids),[d,c,b]);for(let i=0;i<150;i++){state=await get();if(!state.job&&inFlight===0&&!state.items.find(x=>x.id==='item0').downloaded)break;await new Promise(r=>setTimeout(r,30));}assert.equal(state.job,null);assert.equal(maxInFlight,1,'all mutation requests must be serialized');
 assert.deepEqual(state.recentReviews.map(x=>x.id),[d,c,b]);assert.equal(state.items.find(x=>x.id==='item0').downloaded,false);await assert.rejects(fs.access(sourcePath(data,items[0])));
 const visited=[];for(const key of ['q','ArrowUp','q']){await page.keyboard.press(key);visited.push(await previewId());}assert.deepEqual(visited,[c,b,d]);assert.equal(new Set(visited).size,3);assert((await page.locator('#previewRecent').getAttribute('aria-keyshortcuts')).includes('Q'));await page.keyboard.press('Escape');
 await page.unroute('**/api/vote');await post('apply',{id:'item7'});for(let i=0;i<100;i++){state=await get();if(!state.job)break;await new Promise(r=>setTimeout(r,30));}await post('provider',{id:'own',enabled:false});await page.reload();await page.locator('#grid .card').first().waitFor();assert.equal(await page.locator('[data-item-id="item9"]').count(),0);assert.equal(await page.locator('[data-item-id="item8"]').count(),1);
 await post('provider',{id:'own',remove:true});state=await get();assert.equal(state.items.find(x=>x.id==='item8').providerName,'Own source');assert(!state.items.some(x=>x.id==='item9'));await assert.rejects(fs.access(imagePath(data,items[9])));await fs.access(path.join(personal,'own.png'));
 await page.reload();await page.locator('[data-item-id="item8"] h3').waitFor();assert.equal(await page.locator('[data-item-id="item8"] h3').textContent(),'Own source');assert.deepEqual(errors,[]);
 console.log('PASS: Apply survives polling and changes the fixture desktop; comma tags round-trip; ratings remain responsive through another image’s timer; saving highlight, immediate Later, recent three navigation, file cleanup and source removal work.');
}finally{
 await browser?.close();if(child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await ended;}await fs.rm(dir,{recursive:true,force:true});
}
