import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {defaults} from '../core.mjs';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(path.resolve(process.argv[2],'package.json')),{chromium}=require('playwright');
const sharp=createRequire(path.join(root,'package.json'))('sharp');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-redesign-')),port=47000+Math.floor(Math.random()*1000),url=`http://127.0.0.1:${port}`;
await fs.mkdir(path.join(dir,'thumbnails'));await fs.mkdir(path.join(dir,'pending'));
const titles=['Горное отражение','Утренний лес','Далёкие миры','Цветовой поток','Вечерний океан','Современная архитектура','Туманный рассвет','Заснеженные вершины'];
const colors=['#69828d','#3b765c','#303962','#745675','#477184','#6e8599','#557374','#8298ac'];
const items=[];for(let i=0;i<8;i++){const id='demo-'+i;const svg=`<svg width="960" height="600"><defs><linearGradient id="g" x2="0.7" y2="1"><stop stop-color="${colors[i]}"/><stop offset="1" stop-color="#172830"/></linearGradient></defs><rect width="960" height="600" fill="url(#g)"/><circle cx="740" cy="130" r="65" fill="#eedbb6" opacity=".65"/><path d="M0 480 230 170 430 420 650 240 960 510V600H0Z" fill="#122e38"/><path d="m230 170 65 90-67-22-48 29Z" fill="#bdcfd2"/><path d="M0 520Q300 470 960 550V600H0Z" fill="#739f9f" opacity=".3"/></svg>`;const bytes=await sharp(Buffer.from(svg)).jpeg().toBuffer();await fs.writeFile(path.join(dir,'thumbnails',id+'.jpg'),bytes);await fs.writeFile(path.join(dir,'pending',id+'.jpg'),bytes);items.push({id,title:titles[i],provider:'local',tags:['nature','space','mountains','abstract'],rating:'safe',vote:null,downloaded:true,width:3840,height:2160,bytes:bytes.length,file:id+'.jpg'});}
await fs.writeFile(path.join(dir,'state.json'),JSON.stringify({settings:{...defaults,autoRefresh:false,rotation:false},providers:[{id:'local',name:'Local',type:'local',enabled:true,folder:dir}],items,current:'demo-3',pages:{},lastRefresh:0,lastRotation:0}));
const child=spawn(process.execPath,[path.join(root,'server.mjs')],{env:{...process.env,WALLBLOOM_DATA_DIR:dir,WALLBLOOM_PORT:String(port)},windowsHide:true,stdio:'pipe'});let logs='';child.stderr.on('data',b=>logs+=b);let browser;
try{
 for(let i=0;i<150;i++){try{if((await fetch(url+'/api/state')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1680,height:1040}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.locator('.card').first().waitFor();
 assert.equal(await page.locator('.card').count(),8);assert.equal(await page.locator('.card').first().getAttribute('data-item-id'),'demo-3');assert.equal(await page.locator('.current-badge').count(),1);assert.equal(await page.locator('#filters button').count(),4);
 assert.equal(await page.locator('#navigation').evaluate(e=>Math.round(e.getBoundingClientRect().width)),64);await page.locator('#navToggle').click();assert.equal(await page.locator('#navToggle').getAttribute('aria-expanded'),'true');await page.locator('#navToggle').click();
 await page.locator('#statusToggle').click();assert.equal(await page.locator('#statusDetails').isVisible(),true);assert.equal(await page.locator('.automation-card').count(),3);await page.locator('#statusToggle').click();
 await page.locator('#preferencesShortcut').click();assert.equal(await page.locator('[data-settings-pane="interests"]').isVisible(),true);await page.locator('#language').selectOption('en');assert.equal(await page.locator('#refresh').getAttribute('aria-label'),'Find wallpapers');await page.locator('[data-settings-tab="images"]').click();await page.locator('[name="width"]').fill('1280');await page.locator('#settingsForm button.primary').click();await page.waitForFunction(()=>document.getElementById('message').textContent==='Saved');assert.equal((await(await fetch(url+'/api/state')).json()).settings.width,1280);
 await page.locator('#preferencesShortcut').click();await page.locator('#language').selectOption('ru');await page.locator('[data-view="library"]').click();
 await page.locator('.desktop-menu summary').click();assert.equal(await page.locator('#nextWallpaper').isVisible(),true);await page.keyboard.press('Escape');
 const card=page.locator('.card').first();await card.locator('.preview-trigger').click();assert.equal(await page.locator('#fullPreviewDialog').isVisible(),true);await page.locator('#fullPreviewDialog button').click();
 await card.locator('.card-more summary').click();assert.equal(await card.locator('.frame-action').isVisible(),true);await card.locator('.card-more summary').click();
 await card.getByRole('button',{name:'Нравится',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.card .votes button.selected'));await page.locator('#filters button').nth(2).click();assert.equal(await page.locator('.card').count(),1);await page.locator('#filters button').first().click();
 const ban=page.locator('.card').first().getByRole('button',{name:'Исключить',exact:true});await ban.hover();assert.equal(await page.locator('#vote-help-demo-3-ban').isVisible(),true);
 await page.keyboard.press('F2');await page.waitForFunction(()=>document.querySelectorAll('#purity button')[1].getAttribute('aria-pressed')==='true');
 await fs.mkdir(path.join(root,'data','qa'),{recursive:true});await page.mouse.move(600,20);await page.screenshot({path:path.join(root,'data','qa','redesign-desktop.png'),fullPage:true});
 for(const width of [1280,900,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow at ${width}`);}
 await page.screenshot({path:path.join(root,'data','qa','redesign-mobile.png'),fullPage:true});assert.deepEqual(errors,[]);console.log('PASS: current wallpaper first, 4 folders, navigation, statuses, preferences RU/EN, settings persistence, desktop menu, preview, secondary actions, voting, shortcuts, 1680/1280/900/390 layouts; no JS errors.');
}finally{await browser?.close();if(child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}await fs.rm(dir,{recursive:true,force:true});if(logs)console.log(logs.slice(-800));}
