// Real UI/API checks against an isolated library and a mocked Windows desktop.
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
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-cleanup-ui-')),data=path.join(dir,'library'),fixture=path.join(dir,'fixture.json'),personal=path.join(dir,'personal');await initLibrary(data);await fs.mkdir(personal);await fs.writeFile(path.join(personal,'original.png'),'personal original');await fs.writeFile(fixture,JSON.stringify({monitors:[{id:'screen-a',width:800,height:600}]}));
const items=[],sharp=await sharpModule();for(let i=0;i<5;i++){
 const x={id:'cleanup'+i,provider:i<2?'own':'on',tags:i===2?['Artist, Sample']:i===3?['automatic']:['nature'],rating:'safe',vote:i===0?'like':null,downloaded:true,hasOriginal:true,width:800,height:600};
 const bytes=await sharp({create:{width:800,height:600,channels:3,background:{r:20+i*30,g:100+i*20,b:80}}}).jpeg().toBuffer();Object.assign(x,await visualFingerprint(bytes),{bytes:bytes.length});for(const file of [imagePath(data,x),sourcePath(data,x),path.join(data,'thumbnails',x.id+'.jpg')])await fs.writeFile(file,bytes);items.push(x);
}
await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings:{...defaults,ai:'off',rotation:false,autoRefresh:false,tags:[]},providers:[{id:'on',type:'local',name:'On source',enabled:true,folder:personal},{id:'own',type:'local',name:'Own source',enabled:true,folder:personal}],items,pages:{}}));
const child=fork(new URL('../server.mjs',import.meta.url),[],{execArgv:['--import',new URL('./test-native-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_DATA_DIR:data,WALLBLOOM_NATIVE_FIXTURE:fixture,WALLBLOOM_PORT:'0'},silent:true,windowsHide:true});child.stdout.resume();let stderr='';child.stderr.on('data',b=>stderr+=b);let browser;
try{
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.once('exit',()=>reject(Error(stderr)));}),base='http://127.0.0.1:'+port,get=async()=>await(await fetch(base+'/api/state')).json();let state=await get();
 const request=async(route,value)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':state.token},body:JSON.stringify(value)});return {status:r.status,...await r.json()};};
 const post=async(route,value)=>{const result=await request(route,value);assert.equal(result.status,200,JSON.stringify(result));return result;};
 assert.equal((await request('cleanup-preview',{kind:'provider',providerId:'own'})).error,'cleanupSourceEnabled');
 await post('apply',{id:'cleanup0'});for(let i=0;i<100&&(await get()).job;i++)await new Promise(r=>setTimeout(r,50));
 await post('provider',{id:'own',enabled:false});const ticket=await post('cleanup-preview',{kind:'provider',providerId:'own'});assert.equal(ticket.count,2);assert.equal((await request('cleanup',{ticket:ticket.ticket})).error,'cleanupWait');
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1680,height:1040}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#grid .card').first().waitFor();await page.locator('[data-view="sources"]').click();
 const clear=page.locator('[data-cleanup-provider="own"]'),dialog=page.locator('#cleanupDialog'),yes=dialog.locator('[data-cleanup-answer="yes"]'),no=dialog.locator('[data-cleanup-answer="no"]');
 await clear.click();await dialog.waitFor({state:'visible'});await dialog.waitFor({state:'visible'});assert(await yes.isDisabled());assert(await no.isEnabled());assert.equal(await no.evaluate(el=>document.activeElement===el),true);await page.keyboard.press('Enter');await dialog.waitFor({state:'hidden'});await fs.access(imagePath(data,items[0]));
 await clear.click();await dialog.waitFor({state:'visible'});assert(await yes.isDisabled());await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 await clear.click();await dialog.waitFor({state:'visible'});assert(await yes.isDisabled());await yes.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-cleanup-answer="yes"]').disabled);await yes.click();await dialog.waitFor({state:'hidden'});
 state=await get();assert(!state.items.some(x=>x.id==='cleanup0'||x.id==='cleanup1'));assert.equal(state.current,'cleanup0');await fs.access(path.join(personal,'original.png'));for(const x of items.slice(0,2))await assert.rejects(fs.access(imagePath(data,x)));
 const raw=JSON.parse(await fs.readFile(path.join(data,'state.json'),'utf8'));assert.equal(raw.items[0].vote,'like');await fs.access(path.join(data,'rendered',raw.renderedCurrent['screen-a']));
 await page.locator('[data-view="settings"]').click();await page.locator('[data-settings-tab="interests"]').click();await page.locator('#settingsForm [name="excludedTags"]').fill('"artist, sample"');await page.locator('#settingsForm button.primary').click();await page.waitForFunction(async()=>(await(await fetch('/api/state')).json()).tagCleanup.count===1);
 await page.locator('#cleanupTags').click();assert(await yes.isDisabled());await page.waitForFunction(()=>!document.querySelector('[data-cleanup-answer="yes"]').disabled);await yes.click();await dialog.waitFor({state:'hidden'});assert(!(await get()).items.some(x=>x.id==='cleanup2'));
 state=await get();await post('settings',{...state.settings,excludedTags:['automatic']});state=await get();const due=state.tagCleanup.dueAt;assert(due>Date.now()+55000);await post('settings',{...state.settings,excludedTags:[]});assert.equal((await get()).tagCleanup.dueAt,null);await fs.access(imagePath(data,items[3]));
 await page.locator('#language').selectOption('en');await page.waitForFunction(()=>document.documentElement.lang==='en');await page.locator('[data-view="sources"]').click();await clear.click();await dialog.waitFor({state:'visible'});assert.equal(await no.textContent(),'No');assert((await dialog.textContent()).includes('irreversible'));await no.click();
 await page.setViewportSize({width:390,height:844});await clear.click();await dialog.waitFor({state:'visible'});assert(await dialog.evaluate(el=>el.getBoundingClientRect().width<=innerWidth));await no.click();assert.deepEqual(errors,[]);
 state=await get();await post('settings',{...state.settings,excludedTags:['automatic']});assert((await get()).paused);await fs.access(imagePath(data,items[3]));await post('pause',{paused:false});
 const deadline=Date.now()+85000;while(Date.now()<deadline){state=await get();if(!state.tagCleanup.count&&!state.job)break;await new Promise(r=>setTimeout(r,500));}
 assert.equal(state.tagCleanup.count,0,'automatic cleanup must run after the grace period');assert(!state.items.some(x=>x.id==='cleanup3'));await assert.rejects(fs.access(imagePath(data,items[3])));await fs.access(imagePath(data,items[4]));await fs.access(path.join(personal,'original.png'));assert.deepEqual(errors,[]);
 console.log('PASS: disabled-source and exact-tag cleanup, server-enforced confirmation delay, immediate No/Enter/Escape cancellation, timer reset, RU/EN and mobile dialog, personal originals and rendered desktop preservation, cancellation of exclusions, and automatic cleanup after one minute.');
}finally{await browser?.close();if(child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await ended;}await fs.rm(dir,{recursive:true,force:true});}
