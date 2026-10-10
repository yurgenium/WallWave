// Manual diagnostic; analyzes one cached thumbnail using one CPU thread.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),dir=path.join(root,'data');
if(os.freemem()<3*1024**3)throw Error('Need at least 3 GiB free RAM for this diagnostic.');
const s=await(await fetch('http://127.0.0.1:43198/api/state')).json();if(s.job)throw Error('Wait for the current job.');const x=s.items.find(x=>x.downloaded);assert.ok(x,'Download an image first.');await fs.writeFile(path.join(dir,'ai-input.json'),JSON.stringify([{id:x.id}]));
const child=fork(path.join(root,'ai-worker.mjs'),[dir],{env:{...process.env,WALLBLOOM_AI:'eco'},silent:true,windowsHide:true});try{os.setPriority(child.pid,os.constants.priority.PRIORITY_BELOW_NORMAL);}catch{}let tail='',embedding;child.stdout.resume();child.stderr.on('data',b=>tail=(tail+b).slice(-2000));const timer=setTimeout(()=>child.kill(),180000);child.on('message',m=>{if(m.embedding)embedding=m.embedding;else if(m.code)console.log(m.code);});await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(tail));});});assert.equal(embedding.length,512);assert.ok(embedding.every(Number.isFinite));console.log('PASS: real quantized CLIP inference; 512 finite image features; CPU, one thread.');
