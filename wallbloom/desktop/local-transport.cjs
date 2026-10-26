// Process messages and in-memory streams only: no TCP, HTTP client or sockets.
const {Readable,Writable}=require('node:stream');
const {safeAction,hex}=require('./diagnostic-log.cjs');

function dispatchLocal(handler,request,host){
 return new Promise((resolve,reject)=>{
  const headers=Object.fromEntries(Object.entries(request.headers||{}).map(([key,value])=>[key.toLowerCase(),value]));
  // The parent has already checked the custom protocol's origin. HTTP-only
  // headers below belong to the in-memory adapter, never to a network request.
  headers.host=host;headers.origin='http://'+host;headers['sec-fetch-site']='same-origin';delete headers['accept-encoding'];
  const req=Readable.from(request.body?.length?[Buffer.from(request.body)]:[]);
  Object.assign(req,{method:request.method||'GET',url:request.path,headers});
  const chunks=[],responseHeaders={};let status=200;
  const res=new Writable({write(chunk,encoding,done){chunks.push(Buffer.from(chunk));done();}});
  res.setHeader=(name,value)=>{responseHeaders[name.toLowerCase()]=String(value);return res;};
  res.hasHeader=name=>Object.hasOwn(responseHeaders,name.toLowerCase());
  res.statusCode=200;
  res.writeHead=(code,values)=>{status=code;res.statusCode=code;for(const [name,value]of Object.entries(values||{}))res.setHeader(name,value);return res;};
  res.once('error',reject);res.once('finish',()=>resolve({status,headers:responseHeaders,body:Buffer.concat(chunks)}));
  Promise.resolve().then(()=>handler(req,res)).catch(reject);
 });
}

function createServiceClient(service,{onEvent}={}){
 let sequence=0;const pending=new Map();
 const emit=(event,entry,attributes={})=>{try{onEvent?.(event,{...entry?.metadata,...attributes,pending:pending.size,durationMs:entry?Date.now()-entry.started:0},{traceId:entry?.traceId});}catch{}};
 const failAll=()=>{for(const entry of pending.values()){clearTimeout(entry.timer);emit('transport.failed',entry,{code:'ERR_IPC_CHANNEL_CLOSED'});entry.reject(Error('Background service unavailable'));}pending.clear();};
 service.on('exit',failAll);service.on('disconnect',failAll);
 service.on('message',message=>{
  if(message?.type!=='local-response')return;
  const entry=pending.get(message.id);if(!entry)return;
  pending.delete(message.id);clearTimeout(entry.timer);
  if(message.error){emit('transport.failed',entry,{code:'operationFailed'});entry.reject(Error(message.error));}else{if(Date.now()-entry.started>1000)emit('transport.slow',entry,{status:message.response.status,bytes:message.response.body?.length||0});entry.resolve(message.response);}
 });
 return (request,timeout=30000)=>new Promise((resolve,reject)=>{
  if(!service.connected||pending.size>=256){reject(Error('Background service unavailable'));return;}
  const id=++sequence;
  const fail=error=>{const entry=pending.get(id);if(!entry)return;pending.delete(id);clearTimeout(entry.timer);emit('transport.failed',entry,{error,code:'timeout'});reject(error);};
  const timer=setTimeout(()=>fail(Error('Local request timed out')),timeout);
  const pathname=String(request.path||'').split('?')[0],category=pathname.startsWith('/api/')?'api':pathname.startsWith('/image/')?'thumbnail':pathname.startsWith('/full-preview/')?'fullPreview':'staticAsset';
  const header=Object.entries(request.headers||{}).find(([name])=>name.toLowerCase()==='x-wallwave-trace');
  pending.set(id,{resolve,reject,timer,started:Date.now(),traceId:hex(header?.[1],32),metadata:{category,action:category==='api'?safeAction(pathname.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())):'unknown'}});
  try{service.send({type:'local-request',id,request},error=>{if(error)fail(error);});}catch(error){fail(error);}
 });
}

module.exports={dispatchLocal,createServiceClient};
