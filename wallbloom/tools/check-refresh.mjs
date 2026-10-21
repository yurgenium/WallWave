import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fork} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {defaults} from '../core.mjs';
const require=createRequire(path.resolve(process.argv[2],'package.json')),{chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'..'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-progress-')),data=path.join(dir,'library'),fixture=path.join(dir,'fixture.json'),qa=path.resolve(process.argv[3]||path.join(root,'data/qa/refresh'));await fs.mkdir(data);await fs.mkdir(qa,{recursive:true});
const picture=id=>({id,path:'https://example.com/'+id,url:'https://example.com/source',thumbs:{small:'https://example.com/'+id},purity:'sfw',dimension_x:800,dimension_y:600});
const ratings=Array.from({length:5},(_,i)=>[{id:'positive'+i,vote:'like',embeddingVersion:2,embedding:[1,0,...Array(510).fill(0)],tags:[],rating:'safe'},{id:'negative'+i,vote:'dislike',embeddingVersion:2,embedding:[0,1,...Array(510).fill(0)],tags:[],rating:'safe'}]).flat();
const ids=Array.from({length:8},(_,i)=>'good'+(i+1)),bad=Array.from({length:6},(_,i)=>'bad'+i),aliases=Object.fromEntries([...ids,...bad].map(id=>[id,id]));
for(const [i,id]of [...ids,...bad].entries())await sharp({create:{width:800,height:600,channels:3,background:{r:40+(i%3)*90,g:40+(Math.floor(i/3)%3)*90,b:40+(Math.floor(i/9)%3)*90}}}).png().toFile(fixture+'.'+id+'.png');
await fs.writeFile(fixture,JSON.stringify({delay:0,downloadDelay:5000,previewDelay:5,pages:{1:[...bad,...ids.slice(0,4)].map(picture),2:ids.slice(4).map(picture)},imageAliases:aliases}));
await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings:{...defaults,ai:'eco',batch:4,pendingTarget:100,diversity:0,tags:['nature']},providers:[{id:'wallhaven',type:'wallhaven',name:'Wallhaven',enabled:true}],items:ratings}));
const child=fork(path.join(root,'server.mjs'),[],{execArgv:['test-native-loader.mjs','test-download-loader.mjs','test-ai-loader.mjs'].flatMap(name=>['--import',new URL('./'+name,import.meta.url).href]),env:{...process.env,WALLBLOOM_DATA_DIR:data,WALLBLOOM_PORT:'0',WALLBLOOM_NATIVE_FIXTURE:fixture},silent:true,windowsHide:true});child.stdout.resume();child.stderr.resume();let browser;
try{
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.once('exit',()=>reject(Error('Service exited')));}),base='http://127.0.0.1:'+port,get=async()=>await(await fetch(base+'/api/state')).json();
 const until=async predicate=>{const deadline=Date.now()+25000;while(Date.now()<deadline){const state=await get();if(predicate(state))return state;await new Promise(resolve=>setTimeout(resolve,50));}assert.fail('State timed out');};
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#statusToggle').click();await page.locator('#refresh').click();
 await page.waitForFunction(()=>document.getElementById('preparedText').textContent==='Подготовлено: 4 из 4');
 assert.equal(await page.locator('#jobText').textContent(),'Подбор и загрузка обоев');assert.equal(await page.locator('#progress').isVisible(),false);
 assert.equal(await page.locator('#preparedProgress').getAttribute('max'),'4');assert.equal(await page.locator('#preparedProgress').getAttribute('value'),'4');assert(Number(await page.locator('#downloadedProgress').getAttribute('value'))<4);
 assert((await page.locator('#downloadQueueInfo').textContent()).includes('Загружаются: 2'));await page.screenshot({path:path.join(qa,'progress-ru.png')});
 await until(s=>!s.job);await page.waitForFunction(()=>document.getElementById('jobText').textContent.includes('Скачано: 4 из 4'));assert.equal(await page.locator('#downloadProgress').isVisible(),false);
 await page.locator('button[data-view="settings"]').click();await page.locator('[data-settings-tab="interests"]').click();await page.locator('#language').selectOption('en');await until(s=>s.settings.language==='en');await page.locator('#refresh').click();
 await page.waitForFunction(()=>document.getElementById('preparedText').textContent==='Prepared: 4 of 4');assert((await page.locator('#downloadedText').textContent()).startsWith('Downloaded: '));
 for(const width of [1680,1280,900,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Overflow at '+width);if(width===390)await page.screenshot({path:path.join(qa,'progress-en-390.png')});}
 await until(s=>!s.job);const final=await get();assert.equal(final.items.filter(x=>x.downloaded).length,8);assert.equal(final.aiRejectedCount,6);
 const requests=(await fs.readFile(fixture+'.starts','utf8')).trim().split('\n').map(JSON.parse);assert(!requests.some(x=>x.original&&x.id.startsWith('bad')));assert.deepEqual(errors,[]);
 console.log('PASS: visible RU/EN prepared/downloaded counters; fixed wallpaper goals; candidates and byte counts excluded; two transfers and queue status; correct final result; 1680/1280/900/390 layouts; rejected originals never fetched.');
}finally{await browser?.close();if(child.exitCode===null){const ended=new Promise(resolve=>child.once('exit',resolve));child.send({type:'shutdown'});await ended;}await fs.rm(dir,{recursive:true,force:true});}
