// Reproduce the submitted report in a browser with mocked Windows wallpaper calls.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {createRequire} from 'node:module';
import {defaults,sharpModule} from '../core.mjs';

const require=createRequire(path.resolve(process.argv[2],'package.json')),{chromium}=require('playwright');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-monitor-content-')),data=path.join(temp,'library'),fixture=path.join(temp,'native.json');
await fs.mkdir(path.join(data,'pending'),{recursive:true});await fs.mkdir(path.join(data,'thumbnails'));
const bytes=await(await sharpModule())({create:{width:800,height:600,channels:3,background:'#438978'}}).jpeg().toBuffer();
const items=['first','second'].map(id=>({id,provider:'local',title:id,downloaded:true,thumbnailVersion:2,rating:'suggestive',tags:[],width:800,height:600}));
for(const item of items)for(const folder of ['pending','thumbnails'])await fs.writeFile(path.join(data,folder,item.id+'.jpg'),bytes);
const monitor={rotation:false,rotationMinutes:60,purity:'100',tags:[]};
await fs.writeFile(fixture,'{}');await fs.writeFile(path.join(data,'state.json'),JSON.stringify({paused:true,settings:{...defaults,purity:'011',monitors:{'screen-a':monitor,'screen-b':monitor}},providers:[{id:'local',type:'local',folder:temp,enabled:true}],items,pages:{}}));
const child=fork(new URL('../server.mjs',import.meta.url),[],{execArgv:['--import',new URL('./test-native-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_DATA_DIR:data,WALLBLOOM_PORT:'0',WALLBLOOM_NATIVE_FIXTURE:fixture},silent:true,windowsHide:true});
child.stdout.resume();let output='',browser;child.stderr.on('data',b=>output+=b);
try{
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.once('exit',()=>reject(Error(output)));}),base='http://127.0.0.1:'+port;
 const state=async()=>await(await fetch(base+'/api/state')).json();
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#monitorContentWarning').waitFor();assert.match(await page.locator('#monitorContentWarning').textContent(),/1, 2/);
 await page.locator('#grid .card').first().getByRole('button',{name:'Установить',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('jobItem').textContent.includes('конфликтует'));
 assert.equal((await state()).wallpaperResult.code,'monitorContentConflict');
 await page.locator('#useGlobalMonitorContent').click();await page.locator('#monitorContentWarning').waitFor({state:'hidden'});
 assert(Object.values((await state()).settings.monitors).every(m=>m.inheritPurity));
 await page.locator('#grid .card').first().getByRole('button',{name:'Установить',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.current-wallpaper'));
 assert.equal((await state()).wallpaperResult.code,'wallpaperChanged');
 await page.locator('[data-view="settings"]').click();await page.locator('[data-settings-tab="monitors"]').click();
 const form=page.locator('#monitorSettings form').first();assert(await form.locator('[name="inheritPurity"]').isChecked());assert(await form.locator('[name="purity"]').isDisabled());
 await form.locator('[name="inheritPurity"]').uncheck();await form.getByRole('button',{name:'Сохранить',exact:true}).click();
 await page.locator('[data-view="library"]').click();await page.locator('#monitorContentWarning').waitFor();
 await page.locator('[data-view="settings"]').click();await page.locator('[data-settings-tab="interests"]').click();await page.locator('#language').selectOption('en');
 await page.waitForFunction(()=>document.documentElement.lang==='en');await page.locator('[data-view="library"]').click();assert.match(await page.locator('#monitorContentWarning').textContent(),/no allowed categories/);
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.deepEqual(errors,[]);console.log('PASS: 011/100 conflict is visible; explicit repair restores application; monitor inheritance can be disabled; RU/EN and 390/1280 layouts.');
}finally{await browser?.close();if(child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await ended;}await fs.rm(temp,{recursive:true,force:true});}
