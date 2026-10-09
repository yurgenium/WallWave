import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../desktop/icons');await fs.mkdir(dir,{recursive:true});
const svg=color=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="15" fill="${color}"/><path d="M14 19 L21 45 L32 25 L43 45 L50 19" fill="none" stroke="#142016" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
for(const [name,color]of Object.entries({working:'#b9e88e',waiting:'#a8b8cf',paused:'#e8c579',error:'#ee9bbb'}))await sharp(svg(color)).resize(64,64).png().toFile(path.join(dir,name+'.png'));
const png=await sharp(svg('#b9e88e')).png().toBuffer(),header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);await fs.writeFile(path.join(dir,'app.ico'),Buffer.concat([header,png]));
console.log('Created WallWave app and tray icons.');
