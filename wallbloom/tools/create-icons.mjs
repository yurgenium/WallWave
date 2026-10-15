import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../desktop/icons');
await fs.mkdir(dir,{recursive:true});

// Vector master of the selected mint ribbon W, rendered at each Windows size.
function svg(status=''){
 const badge={waiting:'#a8b8cf',paused:'#e8c579',error:'#ee9bbb'}[status];
 const symbol=status==='paused'?'<path d="M400 392v38m22-38v38" stroke="#101c27" stroke-width="13"/>':status==='error'?'<path d="m397 397 28 28m0-28-28 28" stroke="#101c27" stroke-width="12" stroke-linecap="round"/>':'<circle cx="411" cy="411" r="10" fill="#101c27"/>';
 return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
 <defs>
  <linearGradient id="tile" x2="1" y2="1"><stop stop-color="#15232e"/><stop offset="1" stop-color="#091219"/></linearGradient>
  <linearGradient id="back" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#08788a"/><stop offset=".48" stop-color="#074760"/><stop offset="1" stop-color="#4bd2c4"/></linearGradient>
  <linearGradient id="tail" x1=".3" y1="1" x2=".7" y2="0"><stop stop-color="#06445d"/><stop offset=".45" stop-color="#168b9a"/><stop offset="1" stop-color="#aaffd8"/></linearGradient>
  <linearGradient id="left" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#c0ffe0"/><stop offset=".5" stop-color="#88f4d1"/><stop offset="1" stop-color="#43c8c1"/></linearGradient>
  <linearGradient id="right" x1=".35" y1="0" x2=".85" y2="1"><stop stop-color="#aaffd8"/><stop offset=".6" stop-color="#7de9ca"/><stop offset="1" stop-color="#40c6c3"/></linearGradient>
 </defs>
 <rect x="8" y="8" width="496" height="496" rx="116" fill="url(#tile)"/>
 <path d="M151 312c25-30 43-104 78-125 25-16 44 7 60 34l-36 66c-25 35-42 94-73 103-36 11-45-45-29-78Z" fill="url(#back)"/>
 <path d="M316 274c38-8 62-78 94-114 19-22 43-34 63-34 10 0 3 18-4 41l-49 138c-16 46-38 79-61 77-29-2-55-58-43-108Z" fill="url(#tail)"/>
 <path d="M42 175c23-28 54-28 76-3 23 27 28 90 47 139 12 33 24 47 42 38-15 25-30 46-53 47-42 3-62-35-77-91-13-48-18-88-35-112-5-7-5-11 0-18Z" fill="url(#left)"/>
 <path d="M183 253c18-41 37-75 62-78 36-6 56 31 78 78 24 53 33 89 53 80 16-6 30-25 44-51-23 77-43 114-72 114-36 0-56-44-80-93-25-52-42-95-63-74-8 7-15 16-22 24Z" fill="url(#right)"/>
 ${badge?`<circle cx="411" cy="411" r="63" fill="${badge}" stroke="#101c27" stroke-width="14"/>${symbol}`:''}
 </svg>`);
}

for(const name of ['working','waiting','paused','error']){
 await sharp(svg(name)).resize(64,64).png().toFile(path.join(dir,name+'.png'));
}
const sizes=[16,20,24,32,40,48,64,128,256];
const images=await Promise.all(sizes.map(size=>sharp(svg()).resize(size,size).png().toBuffer()));
const header=Buffer.alloc(6+16*sizes.length);
header.writeUInt16LE(1,2);
header.writeUInt16LE(sizes.length,4);
let offset=header.length;
for(let i=0;i<sizes.length;i++){
 const entry=6+16*i,size=sizes[i];
 header[entry]=size===256?0:size;
 header[entry+1]=size===256?0:size;
 header.writeUInt16LE(1,entry+4);
 header.writeUInt16LE(32,entry+6);
 header.writeUInt32LE(images[i].length,entry+8);
 header.writeUInt32LE(offset,entry+12);
 offset+=images[i].length;
}
await fs.writeFile(path.join(dir,'app.ico'),Buffer.concat([header,...images]));
console.log(`Created ribbon W icons: ${sizes.join(', ')} px and four tray states.`);
