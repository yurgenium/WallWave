import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DiagnosticLog,readDiagnosticBundle,safeError} from './desktop/diagnostic-log.cjs';

test('structured logging correlates operations, strips private data, rotates and retains the last failure',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-event-log-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const log=await new DiagnosticLog(dir,'service',{maxBytes:1200,segments:3}).open();
 await log.withTrace('a'.repeat(32),async()=>{
  log.record('request.started',{action:'settings',origin:'library.contentCategories',url:'https://SECRET_HOST',token:'SECRET_TOKEN',body:{tags:['SECRET_TAG']}});
  const error=Object.assign(new Error('PRIVATE_TITLE at C:\\PRIVATE_USER\\photo.jpg'),{code:'ENOENT',stack:'Error: SECRET_MESSAGE\n at apply (C:\\PRIVATE_USER\\app.asar\\server.mjs:123:4)\n at private (C:\\PRIVATE_USER\\PrivateFile.js:1:2)'});
  log.record('operation.failed',{action:'apply',error,monitor:{ref:75,width:2560,height:1600,id:'PRIVATE_HARDWARE_ID',wallpaper:'PRIVATE_PATH'}},'error');
 });
 for(let i=0;i<35;i++)log.record('operation.finished',{action:'next',durationMs:i});await log.close();
 const bundle=await readDiagnosticBundle(dir);assert(bundle.events.length<37);assert.equal(bundle.lastErrors[0].traceId,'a'.repeat(32));
 assert.deepEqual(bundle.lastErrors[0].attributes.error.frames,[{file:'server.mjs',line:123,column:4}]);assert.equal(bundle.lastErrors[0].attributes.monitor.ref,75);
 const serialized=JSON.stringify(bundle);for(const privateValue of ['SECRET','PRIVATE','photo.jpg','PrivateFile.js'])assert(!serialized.includes(privateValue),privateValue);
 for(const file of await fs.readdir(dir)){if(file.endsWith('.jsonl'))assert((await fs.stat(path.join(dir,file))).size<=1200);const text=await fs.readFile(path.join(dir,file),'utf8');for(const secret of ['PRIVATE','SECRET'])assert(!text.includes(secret),file);}
});

test('restart markers distinguish interrupted sessions and malformed records are reported without exporting their contents',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-event-restart-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const first=await new DiagnosticLog(dir,'service').open();await first.flush();
 const second=await new DiagnosticLog(dir,'service').open();await second.flush();
 await fs.appendFile(path.join(dir,'service.0.jsonl'),'PRIVATE_BROKEN_JSON\n');
 const bundle=await readDiagnosticBundle(dir);assert(bundle.events.some(x=>x.event==='session.interrupted'));assert.equal(bundle.coverage.invalidLines,1);
 assert(!JSON.stringify(bundle).includes('PRIVATE_BROKEN_JSON'));await first.close();await second.close();
 const clean=await new DiagnosticLog(dir,'service').open();await clean.flush();
 const next=await readDiagnosticBundle(dir);assert.equal(next.events.filter(x=>x.event==='session.interrupted').length,1);await clean.close();
});

test('unknown error messages, frames and attributes cannot become free text in a report',()=>{
 const value=safeError({name:'SECRET_NAME',code:'SECRET_KEY',message:'PRIVATE_TITLE',stack:'SECRET: PRIVATE\n at /home/PRIVATE_FILE.js:1:2'});
 assert.deepEqual(value.frames,[]);assert.equal(value.name,'unknown');assert.equal(value.code,'unknown');assert(!JSON.stringify(value).includes('SECRET'));
});

test('a process exception survives an abnormal exit and does not export its private message',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-event-crash-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const module=fileURLToPath(new URL('./desktop/diagnostic-log.cjs',import.meta.url));
 const code=`const {DiagnosticLog}=require(${JSON.stringify(module)});(async()=>{const log=await new DiagnosticLog(process.env.TEST_LOG_DIR,'service').open();log.installProcessMonitoring();await log.flush();setTimeout(()=>{throw Object.assign(new Error('PRIVATE_NAME SECRET_TOKEN'),{code:'ENOENT'});},0);})();`;
 const child=spawn(process.execPath,['-e',code],{env:{...process.env,TEST_LOG_DIR:dir},stdio:'ignore',windowsHide:true});
 const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});assert.notEqual(exit,0);
 const next=await new DiagnosticLog(dir,'service').open();await next.flush();const report=await readDiagnosticBundle(dir);
 assert(report.events.some(x=>x.event==='session.interrupted'));assert(report.lastErrors.some(x=>x.event==='process.exception'&&x.attributes.error.code==='ENOENT'));
 assert(!JSON.stringify(report).includes('PRIVATE_NAME'));assert(!JSON.stringify(report).includes('SECRET_TOKEN'));await next.close();
});

test('log storage failures remain visible and safe in-memory events are still exportable',async t=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-event-storage-'));t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const dir=path.join(temp,'not-a-directory');await fs.writeFile(dir,'blocked');const log=await new DiagnosticLog(dir,'service').open();
 log.record('operation.failed',{action:'apply',error:Object.assign(new Error('PRIVATE_PATH'),{code:'EACCES'})},'error');await log.flush();
 assert.equal(log.status().ready,false);assert(log.status().ioErrors.length);
 const report=await readDiagnosticBundle(dir,log.snapshot());assert(report.events.some(x=>x.event==='operation.failed'));assert(report.coverage.inMemoryRecovered>0);assert(!JSON.stringify(report).includes('PRIVATE_PATH'));await log.close();
});
