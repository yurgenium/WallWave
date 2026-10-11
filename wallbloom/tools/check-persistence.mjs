// Full Electron exit/relaunch, using the default library path (no DATA_DIR override).
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {defaults} from '../core.mjs';
const require=createRequire(path.resolve(process.argv[2],'package.json')),{_electron}=require('playwright');
const home=await fs.mkdtemp(path.join(os.tmpdir(),'wallbloom-persistence-')),data=path.join(home,'library');
const exe=path.resolve(process.argv[3]||'dist/win-unpacked/WallWave.exe');
const env={...process.env,WALLBLOOM_DESKTOP_TEST:'1',WALLBLOOM_DESKTOP_TEST_HOME:home};
delete env.WALLBLOOM_DATA_DIR;delete env.WALLBLOOM_IMPORT_DATA_DIR;
await fs.mkdir(data);await fs.writeFile(path.join(data,'state.json'),JSON.stringify({settings:defaults,providers:[{id:'wallhaven',name:'Wallhaven',type:'wallhaven',enabled:false}],items:[{id:'saved',title:'Saved wallpaper',rating:'safe',tags:['nature'],vote:'like',downloaded:false}],pages:{},current:null,lastRefresh:0,lastRotation:0}));
// Seed the legacy default location, then verify automatic migration and restart.
const legacy=path.join(home,'Wallbloom','library');await fs.mkdir(path.dirname(legacy),{recursive:true});await fs.rename(data,legacy);await fs.mkdir(path.join(legacy,'originals'));await fs.writeFile(path.join(legacy,'originals','saved.source'),'SAVED-ASSET');await fs.writeFile(path.join(legacy,'desktop-before-wallbloom.json'),JSON.stringify({wallpaper:path.join(legacy,'original-wallpaper.jpg'),monitors:[{id:'test',wallpaper:path.join(legacy,'original-wallpaper-0.jpg')}]}));
let app,proc;
async function launch(){app=await _electron.launch({executablePath:exe,env,timeout:30000});proc=app.process();const page=await app.firstWindow();await page.locator('button[data-view="library"]').waitFor();const ready=JSON.parse(await fs.readFile(path.join(data,'desktop-test-ready.json'),'utf8'));return {url:ready.base,s:await(await fetch(ready.base+'/api/state')).json()};}
async function quit(){const exited=new Promise(resolve=>proc.exitCode!==null?resolve():proc.once('exit',resolve));const closed=app.waitForEvent('close',{timeout:15000});await app.evaluate(()=>{void globalThis.__wallbloomTest.beginQuit();});await closed;await exited;app=null;}
try{
 let {url,s}=await launch();assert.equal(s.items.length,1);assert.equal(s.library,data);assert.equal(await fs.readFile(path.join(data,'originals','saved.source'),'utf8'),'SAVED-ASSET');const restored=JSON.parse(await fs.readFile(path.join(data,'desktop-before-wallbloom.json'),'utf8'));assert.equal(restored.wallpaper,path.join(data,'original-wallpaper.jpg'));assert.equal(restored.monitors[0].wallpaper,path.join(data,'original-wallpaper-0.jpg'));assert.equal((await fs.stat(legacy)).isDirectory(),true);
 const post=async(route,body)=>{const r=await fetch(url+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':s.token},body:JSON.stringify(body)});assert.equal(r.status,200);};
 await post('settings',{...s.settings,width:1440,tags:['forest']});await post('provider',{id:'wallhaven',apiKey:'LOCAL-RESTART-TEST'});await post('pause',{paused:true});await quit();
 for(let i=0;i<2;i++){({url,s}=await launch());assert.equal(s.items.length,1);assert.equal(s.items[0].vote,'like');assert.equal(s.settings.width,1440);assert.deepEqual(s.settings.tags,['forest']);assert.equal(s.paused,true);assert.equal(s.providers[0].hasKey,true);assert.ok(!JSON.stringify(s).includes('LOCAL-RESTART-TEST'));await quit();}
 console.log('PASS: legacy library migrates with source assets and corrected restore paths; two complete Electron exits/relaunches preserve library, ratings, settings, key and pause.');
}finally{if(app&&proc?.exitCode===null)await quit();await fs.rm(home,{recursive:true,force:true});}
