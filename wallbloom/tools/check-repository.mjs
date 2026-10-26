// Refuse private runtime files even when somebody uses git add --force.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,...args],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
const icons=new Set(['desktop/icons/app.ico','desktop/icons/error.png','desktop/icons/paused.png','desktop/icons/waiting.png','desktop/icons/working.png']);
export function privatePath(file){
 const name=file.replaceAll('\\','/').toLowerCase().replace(/^wallbloom\//,'');
 if(icons.has(name))return false;
 return /(^|\/)(wallwave|data|library|pending|liked|disliked|blocked|thumbnails|originals|rendered|models|diagnostic-events|[^/]*\.diagnostic-events|node_modules|\.pnpm-store|dist|work|archive)(\/|$)/.test(name)
  || /(^|\/)(library\.before-restore-|wallwave-export-)/.test(name)
  || /(^|\/)(state|credentials|settings|preferences|provider-cache|diagnostic-history|wallwave-diagnostics)\.json($|\.)/.test(name)
  || /(^|\/)(installation\.ini|layout-rollback\.json|desktop-before-[^/]+\.json|\.env[^/]*)$/.test(name)
  || /\.(jpg|jpeg|png|webp|avif|gif|bmp|tiff?|heic|ico|mp4|webm|mov|exe|dll|zip|7z|rar|onnx|safetensors|bin|source|backup|log|jsonl|lnk)$/i.test(name);
}
if(process.argv.includes('--self-test')){
 const blocked=['library.diagnostic-events/service.0.jsonl','diagnostic-history.json','WallWave-diagnostics.json','provider-cache.json','state.json','data/notes.txt','prefs/preferences.json.backup','library/photo.jpg','installation.ini','export/photo.png','models/model.onnx','photo.SOURCE','archive/code.mjs','docs/screen.png','WallWave/app/installation.ini','wallbloom/data/state.json','wallbloom/work/history.bundle'];
 const allowed=['README.md','package.json','archive.mjs','desktop/storage.cjs','desktop/icons/app.ico','desktop/icons/working.png','wallbloom/desktop/icons/app.ico','wallbloom/desktop/icons/working.png'];
 if(blocked.some(x=>!privatePath(x))||allowed.some(privatePath))throw Error('Repository privacy check self-test failed');
 console.log('Privacy rules self-test: OK');
}else{
 const files=process.argv.includes('--history')?git('log','--all','--format=','--name-only').split(/\r?\n/):git('ls-files','-z').split('\0');
 const bad=[...new Set(files.filter(Boolean))].filter(privatePath);
 if(bad.length){console.error('Private data or wallpaper files are forbidden in this repository:\n'+bad.join('\n'));process.exitCode=1;}
 else console.log(`Repository privacy check: OK (${new Set(files.filter(Boolean)).size} paths${process.argv.includes('--history')?' in history':''})`);
}
