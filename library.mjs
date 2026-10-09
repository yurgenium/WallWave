import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {folders,sharpModule,AppError} from './core.mjs';
import {fetchBytes} from './network.mjs';
import {duplicateOf} from './automation.mjs';
import {sourcePath} from './framing.mjs';
export async function atomic(file,value){const handle=await fs.open(file+'.tmp','w');try{await handle.writeFile(JSON.stringify(value,null,2));await handle.sync();}finally{await handle.close();}await fs.rename(file+'.tmp',file);}
export async function persist(file,value){await atomic(file,value);await atomic(file+'.backup',value);}
export async function readPersistent(file,fallback){
 let original;try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;original=e;}
 try{const value=JSON.parse(await fs.readFile(file+'.backup','utf8'));console.log('Restored saved data from backup: '+path.basename(file));return value;}catch(e){if(e.code!=='ENOENT')throw e;if(original.code!=='ENOENT')throw original;return fallback;}
}
export async function initLibrary(dir){for(const folder of ['liked','disliked','blocked','pending','thumbnails','originals','rendered'])await fs.mkdir(path.join(dir,folder),{recursive:true});}
export function imagePath(dir,item){return path.join(dir,folders[item.vote]||'pending',item.id+'.jpg');}
export async function usage(dir){let n=0;for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue;const f=path.join(dir,e.name);n+=e.isDirectory()?await usage(f):(await fs.stat(f)).size;}return n;}
export async function downloadImage(dir,x,s,signal,onProgress,items=[]){
 const limit=s.maxItemMB*1024**2;let bytes;if(x.localSource){const stat=await fs.stat(x.localSource);if(stat.size>limit)throw new AppError('itemLimit');bytes=await fs.readFile(x.localSource);}else bytes=await fetchBytes(x.url,{limit,signal,onProgress});signal.throwIfAborted();
 const sharp=await sharpModule();sharp.concurrency(1);sharp.cache(false);const image=sharp(bytes,{limitInputPixels:64000000,animated:false});const meta=await image.metadata();if(!['jpeg','png','webp','avif'].includes(meta.format))throw new AppError('invalidImage');
 const output=await image.rotate().flatten({background:'#10141a'}).resize(s.width,s.height,{fit:s.fit,withoutEnlargement:true,kernel:'lanczos3',background:'#10141a'}).jpeg({quality:s.quality}).toBuffer({resolveWithObject:true});signal.throwIfAborted();
 const fingerprint=await visualFingerprint(bytes);const {hash,colors}=fingerprint;const copy=duplicateOf({...x,...fingerprint},items);if(copy)throw new AppError('duplicateImage');const thumb=await sharp(output.data).resize(360,220,{fit:'inside',withoutEnlargement:true}).jpeg({quality:75}).toBuffer();
 if(await usage(dir)+bytes.length+output.data.length+thumb.length+16384>s.maxTotalGB*1024**3)throw new AppError('diskLimit');
 const target=imagePath(dir,x);await fs.writeFile(target+'.part',output.data);await fs.rename(target+'.part',target);await fs.writeFile(path.join(dir,'thumbnails',x.id+'.jpg'),thumb);await fs.writeFile(sourcePath(dir,x)+'.part',bytes);await fs.rename(sourcePath(dir,x)+'.part',sourcePath(dir,x));return {...fingerprint,hasOriginal:true,originalBytes:bytes.length,bytes:output.data.length,width:output.info.width,height:output.info.height,originalWidth:meta.width,originalHeight:meta.height,downloaded:true,downloadedAt:Date.now()};
}
export async function visualFingerprint(bytes){const sharp=await sharpModule(),base=sharp(bytes,{limitInputPixels:64000000}).rotate().flatten({background:'#10141a'});const meta=await base.metadata(),sample=await base.clone().resize(16,16,{fit:'fill'}).removeAlpha().raw().toBuffer(),pixels=await base.clone().resize(9,8,{fit:'fill'}).greyscale().raw().toBuffer();let bits=0n;for(let y=0;y<8;y++)for(let x=0;x<8;x++)bits=(bits<<1n)|(pixels[y*9+x]>pixels[y*9+x+1]?1n:0n);return {hash:createHash('sha256').update(bytes).digest('hex'),pixelHash:createHash('sha256').update(sample).digest('hex'),visualHash:bits.toString(16).padStart(16,'0'),visualSample:sample.toString('hex'),visualAspect:meta.width/meta.height,colors:Array.from(await base.clone().resize(1,1).removeAlpha().raw().toBuffer())};}
export async function removeCached(dir,x){await fs.rm(imagePath(dir,x),{force:true});await fs.rm(path.join(dir,'thumbnails',x.id+'.jpg'),{force:true});await fs.rm(sourcePath(dir,x),{force:true});}
export async function changeVote(dir,x,vote){const previous=x.vote;x.vote=vote;if(x.downloaded){try{await fs.rename(path.join(dir,folders[previous]||'pending',x.id+'.jpg'),imagePath(dir,x));}catch(e){x.vote=previous;throw e;}}}
export async function writeIndexes(dir,items){for(const folder of Object.values(folders)){const list=items.filter(x=>(folders[x.vote]||'pending')===folder).map(({embedding,localSource,...x})=>x);await atomic(path.join(dir,folder,'index.json'),list);}}
