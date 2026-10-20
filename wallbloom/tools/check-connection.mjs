// Reproduce delayed state responses and connection recovery without personal data.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fork} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {defaults,sharpModule} from '../core.mjs';
const require=createRequire(path.resolve(process.argv[2],'package.json')),{chromium}=require('playwright');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-connection-')),data=path.join(temp,'data'),fixture=path.join(temp,'fixture.json');
await fs.mkdir(path.join(data,'pending'),{recursive:true});await fs.writeFile(fixture,'{}');
await(await sharpModule())({create:{width:800,height:600,channels:3,background:'#345678'}}).jpeg().toFile(path.join(data,'pending','fixture.jpg'));
await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings:defaults,providers:[{id:'local',type:'local',enabled:true,name:'Fixture',folder:temp}],items:[{id:'fixture',provider:'local',title:'Test wallpaper',downloaded:true,rating:'safe',tags:['nature'],width:800,height:600}],pages:{}}));
const child=fork(new URL('../server.mjs',import.meta.url),[],{execArgv:['--import',new URL('./test-native-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_DATA_DIR:data,WALLBLOOM_PORT:'0',WALLBLOOM_NATIVE_FIXTURE:fixture},silent:true,windowsHide:true});child.stdout.resume();child.stderr.resume();let browser;
try{
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.once('exit',()=>reject(Error('Service exited')));}),base='http://127.0.0.1:'+port,state=await(await fetch(base+'/api/state')).json();
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const language of ['ru','en']){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let requests=0,active=0,maximum=0;
  await page.route('**/api/state',async route=>{const n=++requests;maximum=Math.max(maximum,++active);try{
   if(n===(language==='ru'?1:2)){await route.fulfill({status:503,body:'{}'});return;}
   await new Promise(r=>setTimeout(r,language==='ru'&&n===2?11000:2100));
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...state,settings:{...state.settings,language}})});
  }finally{active--;}});
  await page.goto(base);
  if(language==='en')await page.locator('.card').waitFor({timeout:15000});
  await page.waitForFunction(()=>document.getElementById('message').textContent.includes('автоматически')||document.getElementById('message').textContent.includes('automatically'),{},{timeout:15000});
  await page.waitForFunction(()=>document.getElementById('message').textContent===''&&document.querySelectorAll('.card').length===1,{},{timeout:20000});
  await page.waitForFunction(()=>document.documentElement.lang===document.getElementById('language').value);
  assert.equal(await page.locator('html').getAttribute('lang'),language);assert.equal(maximum,1,'state reads must not overlap');assert.deepEqual(errors,[]);
  await page.unrouteAll({behavior:'wait'});await page.close();
 }
 console.log('PASS: RU/EN automatic connection recovery; response slower than 10 seconds accepted; periodic reads slower than their interval still render; no overlapping requests or page errors.');
}finally{
 await browser?.close();if(child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await end;}await fs.rm(temp,{recursive:true,force:true});
}
