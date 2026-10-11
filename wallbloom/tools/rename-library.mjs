import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {listMonitors,desktopInfo,applyMonitor,applyWallpaper} from '../windows.mjs';
const home=await fs.realpath(process.env.USERPROFILE),oldBase=path.join(home,'Wallbloom'),newBase=path.join(home,'WallWave');
assert.equal(path.dirname(oldBase),home);assert.equal(path.dirname(newBase),home);
assert.equal(execFileSync('powershell.exe',['-NoProfile','-Command',"@(Get-CimInstance Win32_Process -Filter \"Name = 'WallWave.exe'\").Count"],{encoding:'utf8',windowsHide:true}).trim(),'0','Close WallWave first');
assert(!(await fs.lstat(oldBase)).isSymbolicLink());await assert.rejects(fs.access(newBase),{code:'ENOENT'});
const oldLibrary=path.join(oldBase,'library'),newLibrary=path.join(newBase,'library');
const rewrite=value=>{if(typeof value==='string'&&value.toLowerCase().startsWith((oldBase+path.sep).toLowerCase()))return newBase+value.slice(oldBase.length);if(Array.isArray(value))return value.map(rewrite);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)]));return value;};
const before=JSON.parse(await fs.readFile(path.join(oldLibrary,'state.json'),'utf8'));
const screens=await listMonitors(),desktop=await desktopInfo();
const backup=path.resolve(import.meta.dirname,'../../archive/library-backups/library-rename-'+new Date().toISOString().replace(/[:.]/g,'-'));await fs.mkdir(backup,{recursive:true});
const metadata=[];
for(const name of ['state.json','state.json.backup','desktop-before-wallbloom.json']){try{const bytes=await fs.readFile(path.join(oldLibrary,name));await fs.writeFile(path.join(backup,name),bytes);metadata.push([name,JSON.parse(bytes)]);}catch(e){if(e.code!=='ENOENT')throw e;}}
// Both targets are verified direct children of the same home directory.
await fs.rename(oldBase,newBase);
for(const [name,value] of metadata)await fs.writeFile(path.join(newLibrary,name),JSON.stringify(rewrite(value),null,2));
// Keep Windows pointing at the same wallpaper after its file changes location.
let updated=0;
for(const screen of screens){const target=rewrite(screen.wallpaper);if(target!==screen.wallpaper){await fs.access(target);await applyMonitor(target,screen.id);updated++;}}
if(!screens.length&&desktop?.wallpaper){const target=rewrite(desktop.wallpaper);if(target!==desktop.wallpaper){await fs.access(target);await applyWallpaper(target);updated++;}}
const after=JSON.parse(await fs.readFile(path.join(newLibrary,'state.json'),'utf8'));assert.deepEqual(after,rewrite(before));await assert.rejects(fs.access(oldBase),{code:'ENOENT'});
console.log(JSON.stringify({library:newLibrary,items:after.items.length,wallpaperPathsUpdated:updated,backup}));
