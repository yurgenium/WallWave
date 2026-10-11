import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const own=createRequire(import.meta.url),builder=createRequire(own.resolve('electron-builder/package.json')),lib=createRequire(builder.resolve('app-builder-lib/package.json'));
const asar=lib('@electron/asar'),list=asar.listPackage(process.argv[2]||'dist/win-unpacked/resources/app.asar').map(x=>x.replaceAll('\\','/'));
assert.ok(!list.some(x=>x.startsWith('/data/')||x==='/data'));
assert.ok(list.some(x=>x.endsWith('/desktop/main.cjs')));
for(const file of ['automation.mjs','archive.mjs','monitor-native.cs','framing.mjs','orientation.mjs'])assert.ok(list.includes('/'+file),file+' must be packaged');
assert.ok(!list.some(x=>x.endsWith('/credentials.json')||x.endsWith('/desktop-test-ready.json')));
for(const file of ['server.mjs','core.mjs','library.mjs','windows.mjs','automation.mjs','archive.mjs','monitor-native.cs','desktop/main.cjs','desktop/storage.cjs','public/app.js','public/wallpaper-titles.js','public/i18n.js','public/index.html','public/style.css','framing.mjs','public/frame-editor.js','public/redesign.js','public/redesign.css','resources.mjs'])assert.ok(asar.extractFile(process.argv[2]||'dist/win-unpacked/resources/app.asar',file).equals(fs.readFileSync(file)),'packaged source differs: '+file);
console.log('PASS: desktop code is packaged; user library and API-key files are excluded.');

const sharpFiles=list.filter(x=>x.endsWith('/node_modules/sharp/package.json')),formatterFiles=list.filter(x=>x.endsWith('/node_modules/sprintf-js/src/sprintf.js'));
assert.ok(sharpFiles.length);assert.ok(formatterFiles.length);
const extract=file=>asar.extractFile(process.argv[2]||'dist/win-unpacked/resources/app.asar',file.replace(/^\//,'').replaceAll('/',path.sep));
for(const file of sharpFiles)assert.equal(JSON.parse(extract(file)).version,'0.35.5','packaged image decoder must be patched');
for(const file of formatterFiles)assert.ok(extract(file).toString().includes('Bound numeric precision'),'packaged formatter must include security patch');
console.log('PASS: packaged dependencies include the decoder update and formatter security patch.');
