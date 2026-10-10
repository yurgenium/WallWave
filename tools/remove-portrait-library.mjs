// One-off offline library cleanup. Run without --apply to inspect first.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {sharpModule} from '../core.mjs';
import {persist,writeIndexes} from '../library.mjs';
import {sourceDimensions} from '../orientation.mjs';
const root=await fs.realpath(path.resolve(process.argv[2]));
const apply=process.argv.includes('--apply'),stateFile=path.join(root,'state.json');
const raw=await fs.readFile(stateFile),db=JSON.parse(raw),sharp=await sharpModule();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const within=(base,file)=>{assert(file.startsWith(base+path.sep),'path outside expected directory');return file;};
const fileFor=(folder,name)=>within(root,path.join(root,folder,name));
const classifications=[];
for(const item of db.items){
 assert(/^[a-zA-Z0-9_-]+$/.test(item.id),'unsafe item ID');
 let width,height;
 for(const file of [fileFor('originals',item.id+'.source'),...(item.thumbnailVersion===2?[fileFor('thumbnails',item.id+'.jpg')]:[])]){
  try{const stat=await fs.lstat(file);assert(!stat.isSymbolicLink());const dimensions=sourceDimensions(await sharp(file,{limitInputPixels:64000000}).metadata());width=dimensions.sourceWidth;height=dimensions.sourceHeight;if(width>0&&height>0)break;}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 if(!(width>0&&height>0)){width=Number(item.sourceWidth||item.originalWidth);height=Number(item.sourceHeight||item.originalHeight);}
 if(!(width>0&&height>0)&&!item.downloaded){width=Number(item.width);height=Number(item.height);}
 classifications.push({item,width,height,kind:width>0&&height>0?(height>width?'portrait':height===width?'square':'landscape'):'unknown'});
}
const removed=classifications.filter(x=>x.kind==='portrait'),ids=new Set(removed.map(x=>x.item.id));
const summary={before:db.items.length,portraits:removed.length,squares:classifications.filter(x=>x.kind==='square').length,landscape:classifications.filter(x=>x.kind==='landscape').length,unknown:classifications.filter(x=>x.kind==='unknown').length};
if(!apply){console.log(JSON.stringify(summary));process.exit(0);}
const running=execFileSync('powershell.exe',['-NoProfile','-Command',"@(Get-CimInstance Win32_Process -Filter \"Name = 'WallWave.exe'\").Count"],{encoding:'utf8',windowsHide:true}).trim();assert.equal(running,'0','Close WallWave from the tray before cleanup');
const backupBase=await fs.realpath(path.resolve(import.meta.dirname,'../../archive'));
const backup=within(backupBase,path.join(backupBase,'library-backups','portrait-cleanup-'+new Date().toISOString().replace(/[:.]/g,'-')));
const files=[];
for(const {item} of removed)for(const folder of ['pending','liked','disliked','blocked','thumbnails','originals'])for(const suffix of [folder==='originals'?'.source':'.jpg',folder==='originals'?'.source.part':'.jpg.part']){
 const file=fileFor(folder,item.id+suffix);try{const stat=await fs.lstat(file);assert(stat.isFile()&&!stat.isSymbolicLink());assert.equal(await fs.realpath(file),file);files.push({file,relative:path.relative(root,file)});}catch(error){if(error.code!=='ENOENT')throw error;}
}
await fs.mkdir(backup,{recursive:true});await fs.writeFile(path.join(backup,'state-before.json'),raw);
for(const entry of files){const bytes=await fs.readFile(entry.file),target=within(backup,path.join(backup,'files',entry.relative));await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);assert.equal(hash(await fs.readFile(target)),hash(bytes));}
await fs.writeFile(path.join(backup,'manifest.json'),JSON.stringify({library:root,summary,removed:removed.map(({item,width,height})=>({id:item.id,width,height})),files:files.map(x=>x.relative)},null,2));
assert.equal(hash(await fs.readFile(stateFile)),hash(raw),'Library changed during cleanup');
db.items=db.items.filter(x=>!ids.has(x.id));if(ids.has(db.current))db.current=null;
for(const [monitor,id] of Object.entries(db.monitorCurrent||{}))if(ids.has(id))delete db.monitorCurrent[monitor];
for(const [monitor,exposure] of Object.entries(db.exposures||{}))if(ids.has(exposure.id))delete db.exposures[monitor];
await persist(stateFile,db);await writeIndexes(root,db.items);
for(const entry of files)await fs.unlink(entry.file);
const after=JSON.parse(await fs.readFile(stateFile));assert.equal(after.items.length,summary.before-summary.portraits);assert(after.items.every(x=>!ids.has(x.id)));
for(const {item,kind} of classifications.filter(x=>x.kind!=='portrait'))assert.deepEqual(after.items.find(x=>x.id===item.id),item,kind+' item changed');
for(const folder of ['pending','liked','disliked','blocked']){const index=JSON.parse(await fs.readFile(fileFor(folder,'index.json'),'utf8'));assert(index.every(x=>!ids.has(x.id)));}
for(const entry of files)await assert.rejects(fs.access(entry.file),{code:'ENOENT'});
console.log(JSON.stringify({...summary,after:after.items.length,removedFiles:files.length,backup}));
