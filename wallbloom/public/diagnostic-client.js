// Log control names and technical outcomes, never DOM text, input values,
// keyboard characters, request payloads, image identities or exception messages.
const origins=new Set(['library.contentCategories','monitor.settings','monitor.useGlobalFilter','settings.form','library','sources','settings','activity','unknown']);
const actions=new Set(['refresh','retryPending','download','ai','apply','next','previous','restore','profile','work','vote','frame','settings','pause','cancel','rotationPause','rotationOptions','wallpaperHold','cleanup','cleanupPreview','collection','collectionItem','collectionMembership','collectionPlay','export','import','sourceDetect','sourceCheck','provider','diagnostics','navigate','libraryFilter','preview']);
export function clientFrames(error){
 const frames=[];for(const line of String(error?.stack||'').split('\n').slice(0,30)){
  const match=line.replaceAll('\\','/').match(/(?:^|\/)([a-zA-Z0-9_-]+\.js):(\d+):(\d+)(?:\)|\s|$)/);
  if(match)frames.push({file:match[1],line:Number(match[2]),column:Number(match[3])});
  if(frames.length===12)break;
 }return frames;
}
export function createDiagnosticClient({getState,getView}){
 const pending=[];let lastConnectionFailure=0,dropped=0;
 const newTrace=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
 const drain=()=>{const records=pending.splice(0);if(dropped){records.unshift({event:'journal.incomplete',attributes:{dropped},timestamp:Date.now()});dropped=0;}return records;};
 const flush=()=>{if(window.wallwaveDesktop?.diagnosticEvent){for(const record of drain())window.wallwaveDesktop.diagnosticEvent(record);return;}
  const state=getState();if(!state?.token)return;
  for(const record of drain())fetch('/api/diagnostic-event',{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':state.token},body:JSON.stringify(record)}).catch(()=>{if(pending.length<50)pending.push(record);else dropped++;});
 };
 const emit=(event,attributes,traceId)=>{pending.push({event,attributes,traceId,timestamp:Date.now()});if(pending.length>50){pending.shift();dropped++;}flush();};
 const context=(route,origin)=>{const action=route==='profiles'?'profile':route.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());const selectedOrigin=origin||getView();const result={traceId:newTrace(),action:actions.has(action)?action:'unknown',origin:origins.has(selectedOrigin)?selectedOrigin:'unknown'};emit('ui.action',{action:result.action,origin:result.origin},result.traceId);return result;};
 const failure=(request,error,code)=>emit('ui.request_failed',{action:request.action,origin:request.origin,code:code||(['AbortError','TimeoutError'].includes(error?.name)?'timeout':'networkError'),errorName:error?.name,frames:clientFrames(error)},request.traceId);
 const slow=(durationMs,request={})=>emit('ui.slow',{action:request.action||'unknown',origin:request.origin||getView(),durationMs:Math.round(durationMs)},request.traceId);
 const exception=error=>emit('renderer.exception',{errorName:error?.name||'Error',frames:clientFrames(error)},newTrace());
 window.addEventListener('error',event=>exception(event.error||{name:'Error'}));
 window.addEventListener('unhandledrejection',event=>exception(event.reason));
 return {context,failure,slow,flush,blocked(action,origin,code){emit('ui.action',{action,origin,code,success:false},newTrace());},connectionFailure(error){if(Date.now()-lastConnectionFailure>30000){lastConnectionFailure=Date.now();failure({action:'unknown',origin:getView(),traceId:newTrace()},error);}}};
}
