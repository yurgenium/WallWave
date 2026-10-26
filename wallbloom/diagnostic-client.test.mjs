import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiagnosticClient} from './public/diagnostic-client.js';
import {cleanAttributes} from './desktop/diagnostic-log.cjs';

test('renderer records the logical control and safe exception coordinates without values or messages',()=>{
 const saved=globalThis.window,handlers=new Map(),records=[];
 globalThis.window={addEventListener:(name,fn)=>handlers.set(name,fn),wallwaveDesktop:{diagnosticEvent:record=>records.push(record)}};
 try{
  const client=createDiagnosticClient({getState:()=>({token:'SECRET_TOKEN'}),getView:()=> 'library'});
  const request=client.context('settings','library.contentCategories');
  assert.match(request.traceId,/^[a-f0-9]{32}$/);assert.equal(records[0].attributes.origin,'library.contentCategories');
  const error=Object.assign(new TypeError('PRIVATE_WALLPAPER_TITLE'),{stack:'TypeError: SECRET_KEY\n at update (wallwave://app/app.js:12:3)\n at private (C:/PRIVATE_USER/PRIVATE_FILE.js:2:1)'});
  handlers.get('error')({error});client.failure(request,error);
  const exported=records.map(x=>({...x,attributes:cleanAttributes(x.attributes)}));
  assert(exported.some(x=>x.event==='renderer.exception'&&x.attributes.frames.some(frame=>frame.file==='app.js'&&frame.line===12)));
  const text=JSON.stringify(exported);for(const secret of ['SECRET','PRIVATE','TOKEN','TITLE'])assert(!text.includes(secret));
  assert(exported.some(x=>x.event==='ui.request_failed'&&x.traceId===request.traceId));
 }finally{globalThis.window=saved;}
});
