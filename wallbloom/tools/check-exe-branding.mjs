import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const own=createRequire(import.meta.url),builder=createRequire(own.resolve('electron-builder/package.json')),lib=createRequire(builder.resolve('app-builder-lib/package.json'));
const {NtExecutable,NtExecutableResource,Resource}=lib('resedit');
const file=process.argv[2]||'dist/win-unpacked/WallWave.exe',bytes=fs.readFileSync(file);
const resources=NtExecutableResource.from(NtExecutable.from(bytes));
const versions=Resource.VersionInfo.fromEntries(resources.entries);assert(versions.length>0);
for(const version of versions)for(const language of version.getAllLanguagesForStringValues()){
 if(process.argv.includes('--installer'))continue;
 const strings=version.getStringValues(language);assert.equal(strings.FileDescription,'WallWave');assert.equal(strings.ProductName,'WallWave');
}
const ico=fs.readFileSync(path.resolve(import.meta.dirname,'../desktop/icons/app.ico'));
const count=ico.readUInt16LE(4);assert.equal(count,9,'all Windows icon sizes must be present');
const images=Array.from({length:count},(_,i)=>{const p=6+16*i;return {size:ico[p]||256,bytes:ico.subarray(ico.readUInt32LE(p+12),ico.readUInt32LE(p+12)+ico.readUInt32LE(p+8))};});
const groups=Resource.IconGroupEntry.fromEntries(resources.entries).sort((a,b)=>Number(a.id)-Number(b.id));assert(groups.length>0);
const primary=groups[0];
for(const image of images)assert(primary.icons.some(icon=>resources.entries.some(entry=>entry.type===3&&entry.id===icon.iconID&&entry.lang===primary.lang&&Buffer.from(entry.bin).equals(image.bytes))),`primary Windows icon must match app.ico at ${image.size}px`);
console.log(`PASS: ${process.argv.includes('--installer')?'installer':'WallWave runtime'} EXE contains the selected icon at ${images.map(x=>x.size).join(', ')} px.`);
