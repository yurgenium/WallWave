import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {AppError,sharpModule,defaultFrame,validateFrame} from './core.mjs';

export {defaultFrame,validateFrame};
export function sourcePath(dir,item){return path.join(dir,'originals',item.id+'.source');}
export async function frameSource(dir,item){if(item.hasOriginal){try{await fs.access(sourcePath(dir,item));return sourcePath(dir,item);}catch{}}const {imagePath}=await import('./library.mjs');return imagePath(dir,item);}
export function effectiveFrame(item,settings,monitorId){return validateFrame(item.frames?.[monitorId]||item.frames?.['*']||settings.frame||defaultFrame);}
export async function renderFrame(file,width,height,input,quality=88){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>16384||height>16384||width*height>64000000)throw new AppError('invalidFrame');
 const frame=validateFrame(input),sharp=await sharpModule(),base=sharp(file,{limitInputPixels:64000000,animated:false}),meta=await base.metadata();let sw=meta.width,sh=meta.height;if([5,6,7,8].includes(meta.orientation))[sw,sh]=[sh,sw];
 let pixels,iw=width,ih=height,left=0,top=0;
 if(frame.fit==='cover'){
  const ratio=width/height;let cw=sw,ch=sh;if(sw/sh>ratio)cw=Math.max(1,Math.floor(sh*ratio));else ch=Math.max(1,Math.floor(sw/ratio));
  const crop={left:Math.round((sw-cw)*(frame.flip?1-frame.x:frame.x)),top:Math.round((sh-ch)*frame.y),width:cw,height:ch};
  pixels=await base.rotate().extract(crop).flatten({background:'#10141a'}).resize(width,height,{fit:'fill'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 }else{
  const scale=Math.min(width/sw,height/sh);iw=Math.max(1,Math.min(width,Math.round(sw*scale)));ih=Math.max(1,Math.min(height,Math.round(sh*scale)));left=Math.round((width-iw)*frame.x);top=Math.round((height-ih)*frame.y);
  pixels=await base.rotate().flatten({background:'#10141a'}).resize(iw,ih,{fit:'fill'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 }
 const image=sharp(pixels.data,{raw:{width:iw,height:ih,channels:pixels.info.channels}}).flop(frame.flip);
 if(frame.fit==='cover')return image.jpeg({quality}).toBuffer();
 const layer=await image.png().toBuffer();return sharp({create:{width,height,channels:3,background:'#10141a'}}).composite([{input:layer,left,top}]).jpeg({quality}).toBuffer();
}
export async function renderDesktop(dir,item,settings,monitorId,width,height){const bytes=await renderFrame(await frameSource(dir,item),width,height,effectiveFrame(item,settings,monitorId),settings.quality);const {usage}=await import('./library.mjs');if(await usage(dir)+bytes.length>settings.maxTotalGB*1024**3)throw new AppError('diskLimit');const name=createHash('sha256').update(monitorId||'desktop').digest('hex').slice(0,16)+'-'+randomUUID()+'.jpg',file=path.join(dir,'rendered',name);await fs.writeFile(file,bytes);return file;}
