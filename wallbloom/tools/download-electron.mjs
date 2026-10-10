// Fallback for a stalled npm downloader. Verifies the official package checksum.
import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),dir=path.dirname(require.resolve('electron/package.json'));
const pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8')),name=`electron-v${pkg.version}-win32-x64.zip`;
const checksums=JSON.parse(await fs.readFile(path.join(dir,'checksums.json'),'utf8')),expected=checksums[name];if(typeof expected!=='string')throw Error('No official checksum');
const target=path.resolve('data',name);const response=await fetch(`https://github.com/electron/electron/releases/download/v${pkg.version}/${name}`,{signal:AbortSignal.timeout(300000)});if(!response.ok)throw Error('Electron HTTP '+response.status);
const hash=createHash('sha256'),stream=Readable.fromWeb(response.body);let bytes=0,reported=0;stream.on('data',chunk=>{bytes+=chunk.length;hash.update(chunk);if(bytes>220*1024**2)stream.destroy(Error('Unexpected download size'));if(bytes-reported>25*1024**2){reported=bytes;console.log(Math.round(bytes/1024**2)+' MiB downloaded');}});await pipeline(stream,createWriteStream(target));if(hash.digest('hex')!==expected)throw Error('Electron checksum mismatch');
const electronRequire=createRequire(path.join(dir,'package.json')),{extract}=electronRequire('@electron-internal/extract-zip');await extract(target,{dir:path.join(dir,'dist')});await fs.writeFile(path.join(dir,'path.txt'),'electron.exe');console.log('Official Electron binary extracted; SHA-256 verified.');
