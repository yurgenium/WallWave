import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fork} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {defaults,sharpModule} from '../core.mjs';

const require=createRequire(path.resolve(process.argv[2],'package.json')),{chromium}=require('playwright');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-review-nav-')),data=path.join(temp,'library');
const qa=new URL('../data/qa/review-navigation/',import.meta.url);await fs.mkdir(qa,{recursive:true});
await fs.mkdir(path.join(data,'pending'),{recursive:true});await fs.mkdir(path.join(data,'thumbnails'));
const bytes=await(await sharpModule())({create:{width:800,height:600,channels:3,background:'#438978'}}).jpeg().toBuffer();
const items=[];for(let i=0;i<24;i++){const id='review-'+i;for(const folder of ['pending','thumbnails'])await fs.writeFile(path.join(data,folder,id+'.jpg'),bytes);items.push({id,provider:'fixture',downloaded:true,thumbnailVersion:2,size:bytes.length,rating:'safe',tags:['nature'],width:800,height:600,...i<18?{vote:'deferred'}:{}});}
await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings:{...defaults,rotation:false},providers:[{id:'fixture',type:'feed',name:'Fixture',url:'https://fixture.example/feed',enabled:true}],items,collections:[{id:'fixture-folder',name:'Nature',items:items.map(x=>x.id),created:Date.now()}],pages:{}}));
const child=fork(new URL('../server.mjs',import.meta.url),[],{execArgv:['--import',new URL('test-native-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_DATA_DIR:data,WALLBLOOM_PORT:'0'},silent:true,windowsHide:true});
child.stdout.resume();let stderr='';child.stderr.on('data',b=>stderr+=b);let browser,releaseVotes;
try{
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.on('exit',()=>reject(Error(stderr)));});
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const votes=[],gate=new Promise(resolve=>releaseVotes=resolve);let block=true;
 await page.route('**/api/vote',async route=>{votes.push(route.request().postDataJSON());if(block)await gate;await route.continue();});
 await page.goto('http://127.0.0.1:'+port);await page.locator('#grid .card').last().waitFor();await page.locator('#filters [data-filter="deferred"]').click();
 assert.equal(await page.locator('#grid .card').count(),18);await page.locator('#grid .card').first().locator('.preview-trigger').click();
 // Slow saves must not close a later preview or switch folders after a rapid batch.
 for(let i=0;i<6;i++)await page.keyboard.press('Digit5');
 await page.waitForFunction(()=>document.querySelector('.full-preview-image').getAttribute('src')==='/full-preview/review-6');
 assert.equal(await page.locator('#filters [data-filter="deferred"]').getAttribute('aria-pressed'),'true');
 // Mutations are serialized: holding the first save also holds the remaining five.
 for(let i=0;i<100&&votes.length<1;i++)await page.waitForTimeout(20);assert.equal(votes.length,1);
 block=false;releaseVotes();await page.waitForFunction(async()=>{const s=await(await fetch('/api/state')).json();return Array.from({length:6},(_,i)=>s.items.find(x=>x.id==='review-'+i)).every(x=>x?.vote===null);});await page.waitForTimeout(300);
 assert(await page.locator('#fullPreviewDialog').isVisible());assert.equal(await page.locator('#filters [data-filter="deferred"]').getAttribute('aria-pressed'),'true');
 for(let i=0;i<200&&votes.length<6;i++)await page.waitForTimeout(20);
 assert.deepEqual(votes.slice(0,6).map(x=>x.id),items.slice(0,6).map(x=>x.id));assert(votes.slice(0,6).every(x=>x.vote===null));
 for(let i=6;i<18;i++)await page.keyboard.press('Digit5');
 await page.waitForFunction(()=>!document.querySelector('#fullPreviewDialog').open);
 await page.waitForFunction(async()=>{const s=await(await fetch('/api/state')).json();return s.items.every(x=>!x.vote);});
 assert.equal(await page.locator('#filters [data-filter="deferred"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#grid .card').count(),0);
 await page.locator('#filters [data-filter="pending"]').click();await page.waitForFunction(()=>document.querySelectorAll('#grid .card').length===24);
 for(const width of [1280,900,390]){
  await page.setViewportSize({width,height:900});await page.mouse.move(5,200);await page.evaluate(()=>document.activeElement?.blur());await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight-850));
  await page.waitForFunction(()=>document.querySelector('.library-toolbar').dataset.stuck==='true');await page.waitForTimeout(300);
  const toolbar=page.locator('.library-toolbar'),rect=await toolbar.boundingBox();assert(Math.abs(rect.y-8)<2,'Folder bar stays at the top at '+width);assert(Number(await toolbar.evaluate(e=>getComputedStyle(e).opacity))<.8,'Folder bar is translucent');
  const selected=page.locator('#filters [aria-pressed="true"]');await selected.hover();await page.waitForTimeout(250);assert.equal(await toolbar.evaluate(e=>getComputedStyle(e).opacity),'1');
  await selected.click();await page.waitForFunction(()=>Math.abs(document.getElementById('library').getBoundingClientRect().top)<3);assert.equal(await page.locator('#filters [data-filter="pending"]').getAttribute('aria-pressed'),'true');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:new URL('folders-'+width+'.png',qa).pathname.slice(1)});
 }
 await page.locator('#filters [data-filter="collection:fixture-folder"]').click();await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight-850));await page.waitForFunction(()=>document.querySelector('.library-toolbar').dataset.stuck==='true');await page.locator('#filters [data-filter="collection:fixture-folder"]').click();await page.waitForFunction(()=>Math.abs(document.getElementById('library').getBoundingClientRect().top)<3);
 assert.deepEqual(errors,[]);console.log('PASS: 18 rapid deferred-to-unreviewed actions including delayed saves, stable preview/folder, empty-folder completion; sticky translucent folders, hover and selected-folder scroll-to-top at 1280/900/390; custom folder; no page errors.');
}catch(error){await browser?.contexts()[0]?.pages()[0]?.screenshot({path:new URL('failure.png',qa).pathname.slice(1)}).catch(()=>{});throw error;}
finally{releaseVotes?.();await browser?.close();if(child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await ended;}assert(temp.startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(temp,{recursive:true,force:true});}
