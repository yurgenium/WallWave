// A bounded local event journal. Both writes and exports pass through the same
// allowlist. No messages, request bodies, headers, URLs or memory dumps are kept.
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {AsyncLocalStorage}=require('node:async_hooks');
const {performance}=require('node:perf_hooks');

const hex=(value,length)=>typeof value==='string'&&new RegExp('^[a-f0-9]{'+length+'}$').test(value)?value:undefined;
const traceId=()=>randomBytes(16).toString('hex');
const components=new Set(['main','service','renderer','transport','native','network']);
const levels=new Set(['debug','info','warn','error','fatal']);
const eventNames=new Set(['session.started','session.ended','session.interrupted','request.started','request.finished','request.failed','configuration.changed','configuration.monitor_changed','monitor.topology','monitor.added','monitor.removed','operation.started','operation.finished','operation.failed','app.event','automation.triggered','guard.changed','network.finished','network.failed','network.retry','native.finished','native.failed','transport.failed','transport.slow','service.exited','renderer.crashed','renderer.unresponsive','renderer.responsive','renderer.load_failed','renderer.preload_failed','renderer.exception','process.exception','process.warning','ui.action','ui.request_failed','ui.slow','journal.incomplete']);
const actions=new Set(['refresh','retryPending','download','ai','apply','next','previous','restore','rotation','profile','work','vote','frame','settings','collectionPlay','startup','pause','cancel','rotationPause','rotationOptions','wallpaperHold','cleanup','cleanupPreview','collection','collectionItem','collectionMembership','export','import','sourceDetect','sourceCheck','provider','diagnostics','navigate','libraryFilter','preview','windowOpen','windowClose','unknown']);
const origins=new Set(['library.contentCategories','monitor.settings','monitor.useGlobalFilter','settings.form','library','sources','settings','activity','tray','shortcut','automation','main','renderer','unknown']);
const codes=new Set(('unknown other noAlternative noEligibleCandidates workModeActive screenLocked fullscreen systemBusy active idle onBattery checking unsupported blockedProcess workEnabled workDisabled notAvailable monitorContentConflict wallpaperRatingBlocked wallpaperExcludedTags wallpaperChanged noAvailableWallpaper operationFailed saveFailed networkError timeout cancelled waitIdle busy invalidRequest invalidSettings invalidImage invalidFeed diskLimit itemLimit sourceUnavailable sourceTemporarilyUnavailable sourceMaintenance sourceQuotaReached sourceAuthFailed rateLimited downloadFailed downloadSlow apiKeyRequired unsafeURL windowsUnavailable monitorDisconnected guardUnavailable profileChanged aiUnavailable aiDeferred aiRejected aiPaused aiOff jobStarted jobFinished found noNew downloaded applied restored pausedByUser resumed poolUpdated poolReady poolEmpty sourceEmpty modelLoading modelDownloading modelReady settingsSaved profileWallpaperFailed nativeCommandFailed nativeStartFailed nativeTimeout fileMissing fileAccessDenied diskFull ratingBlocked excludedTags monitorFiltersConflict itemMissing notDownloaded rejectedVote sourceDisabled localSourceMissing downloadValidation Error TypeError RangeError ReferenceError SyntaxError URIError EvalError AggregateError AbortError TimeoutError ENOENT EACCES EPERM ENOSPC ENOTDIR EEXIST EBUSY EIO EMFILE ENFILE EPIPE ECONNRESET ECONNREFUSED ETIMEDOUT ENOTFOUND EAI_AGAIN ERR_WORKER_OUT_OF_MEMORY ERR_OUT_OF_MEMORY ERR_IPC_CHANNEL_CLOSED').split(' '));
for(const code of require('./diagnostic-codes.json'))codes.add(code);
const phases=new Set(['eligibility','selection','backup','render','nativeApply','save','download','downloadValidation','sourceLookup','native','search','searching','screening','analysis','modelLoading','modelDownloading','request','response','startup','shutdown','unknown']);
const fields=new Set(['contentCategories','eligibilityRules','monitorContent','monitorInheritance','monitorRotation','framing','rotation','rotationMinutes','rotationPaused','workMode','autoRefresh','refreshMinutes','pendingTarget','batch','maxItemMB','maxTotalGB','dimensions','fit','quality','ai','aiFilter','schedule','shortcuts','sources','pauseOnBattery','changeOnWake','changeOnStartup','changeAfterFullscreen','cancelRefreshMinutes','cleanupAfterShows','other']);
const numeric=new Set(['index','durationMs','status','attempt','bytes','received','pending','exitCode','line','column','width','height','left','top','scale','rotation','monitorCount','topologyRevision','enabledCount','effectiveCount','eligible','alternatives','blocked','beforeCount','afterCount','cpuLoad','gpuLoad','freeMemory','totalMemory','cpuCount','uptimeMs','sequence','timestamp','dropped','repeatCount']);
const booleans=new Set(['ok','success','changed','conflict','inherited','primary','connected','fullscreen','locked','onBattery','rotationEnabled','autoRefreshEnabled','beforeConflict','afterConflict','beforeInherited','afterInherited','categorySetChanged','filtersChanged','clean','truncated','wasInterrupted']);
const safeCode=value=>codes.has(value)?value:'unknown';
const safeAction=value=>actions.has(value)?value:'unknown';
const safeOrigin=value=>origins.has(value)?value:'unknown';
const appFiles=new Set(require('./diagnostic-files.json'));
function safeFrames(stack){
 const result=[];for(const line of String(stack||'').split('\n').slice(0,30)){
  const match=line.replaceAll('\\','/').match(/(?:^|\/)([a-zA-Z0-9_-]+\.(?:mjs|cjs|js)):(\d+):(\d+)(?:\)|\s|$)/);
  if(match&&appFiles.has(match[1]))result.push({file:match[1],line:Number(match[2]),column:Number(match[3])});
  if(result.length===12)break;
 }return result;
}
function safeError(error){
 const d=error?.diagnostic||error||{};
 const frames=Array.isArray(error?.frames)?error.frames.filter(x=>appFiles.has(x?.file)).slice(0,12).map(x=>({file:x.file,line:Number.isFinite(x.line)?x.line:0,column:Number.isFinite(x.column)?x.column:0})):safeFrames(error?.stack);
 const result={name:safeCode(error?.name),code:safeCode(error?.code||error?.systemCode),reason:safeCode(d.reason),phase:phases.has(d.stage||d.phase)?d.stage||d.phase:undefined,frames};
 for(const key of ['exitCode','monitor','status'])if(Number.isFinite(d[key]))result[key]=d[key];
 if(typeof d.hresult==='string'&&/^0x[\da-fA-F]{8}$/.test(d.hresult))result.hresult=d.hresult;
 return result;
}
function safeMonitor(value){
 const result={};if(Number.isSafeInteger(value?.ref)&&value.ref>0)result.ref=value.ref;
 for(const [key,v]of Object.entries(value||{})){if(numeric.has(key)&&Number.isFinite(v))result[key]=v;if(booleans.has(key)&&typeof v==='boolean')result[key]=v;}
 return result;
}
function cleanAttributes(input={}){
 const result={};for(const [key,value]of Object.entries(input||{})){
  if(numeric.has(key)&&Number.isFinite(value))result[key]=value;
  else if(booleans.has(key)&&typeof value==='boolean')result[key]=value;
  else if(key==='action')result.action=safeAction(value);
  else if(key==='origin')result.origin=safeOrigin(value);
  else if(key==='code'||key==='reason'||key==='expected')result[key]=safeCode(value);
  else if(key==='phase'&&phases.has(value))result.phase=value;
  else if(key==='fields'&&Array.isArray(value))result.fields=[...new Set(value.filter(x=>fields.has(x)))];
  else if(key==='monitor')result.monitor=safeMonitor(value);
  else if(key==='before'||key==='after')result[key]=safeMonitor(value);
  else if(key==='error')result.error=safeError(value);
  else if(key==='frames'&&Array.isArray(value))result.frames=value.filter(x=>appFiles.has(x?.file)).slice(0,12).map(x=>({file:x.file,line:Number.isFinite(x.line)?x.line:0,column:Number.isFinite(x.column)?x.column:0}));
  else if(key==='errorName')result.errorName=safeCode(value);
  else if(key==='category'&&['api','preview','metadata','original','other','thumbnail','staticAsset','fullPreview'].includes(value))result.category=value;
  else if(key==='nativeOperation'&&['activity','desktopInfo','listMonitors','applyMonitor','applyWallpaper','unknown'].includes(value))result.nativeOperation=value;
  else if(key==='trigger'&&['startup','wake','fullscreen','schedule','interval','holdExpired'].includes(value))result.trigger=value;
  else if(key==='coordinateSpace'&&['logical','physical'].includes(value))result.coordinateSpace=value;
  else if(key==='crashReason'&&['clean-exit','abnormal-exit','killed','crashed','oom','launch-failed','integrity-failure','memory-eviction','unknown'].includes(value))result.crashReason=value;
 }
 return result;
}
function cleanRecord(value,component){
 if(!value||!Number.isFinite(value.timestamp)||!eventNames.has(value.event))return null;
 return {timestamp:value.timestamp,observedTimestamp:Number.isFinite(value.observedTimestamp)?value.observedTimestamp:value.timestamp,
  sessionId:hex(value.sessionId,32),sequence:Number.isFinite(value.sequence)?value.sequence:0,
  component:components.has(value.component)?value.component:component,version:typeof value.version==='string'&&/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(value.version)?value.version:undefined,severity:levels.has(value.severity)?value.severity:'info',event:value.event,
  traceId:hex(value.traceId,32),spanId:hex(value.spanId,16),uptimeMs:Number.isFinite(value.uptimeMs)?value.uptimeMs:undefined,
  attributes:cleanAttributes(value.attributes)};
}

class DiagnosticLog{
 constructor(directory,component,{sessionId=traceId(),maxBytes=512*1024,segments=3,version}={}){
  this.directory=directory;this.component=component;this.sessionId=hex(sessionId,32)||traceId();this.maxBytes=maxBytes;this.segments=segments;this.version=version;
  this.pending=Promise.resolve();this.recent=[];this.size=0;this.sequence=0;this.started=Date.now();this.monotonic=performance.now();this.context=new AsyncLocalStorage();this.ioErrors=new Set();this.dropped=0;this.ready=false;this.stopped=false;
 }
 file(index){return path.join(this.directory,this.component+'.'+index+'.jsonl');}
 async open(){
  try{await fsp.mkdir(this.directory,{recursive:true});let previous;
   try{previous=JSON.parse(await fsp.readFile(path.join(this.directory,this.component+'.state.json'),'utf8'));}catch{}
   try{this.size=(await fsp.stat(this.file(0))).size;}catch{}
   await fsp.writeFile(path.join(this.directory,this.component+'.state.json'),JSON.stringify({sessionId:this.sessionId,started:this.started,clean:false}));this.ready=true;
   this.record('session.started',{wasInterrupted:previous?.clean===false});if(previous?.clean===false)this.record('session.interrupted',{wasInterrupted:true},'warn');
  }catch(error){this.ioErrors.add(safeCode(error.code));}return this;
 }
 withTrace(id,fn){return this.context.run({traceId:hex(id,32)||traceId(),spanId:randomBytes(8).toString('hex')},fn);}
 current(){return this.context.getStore()||{};}
 record(event,attributes={},severity='info',correlation={}){
  const now=Date.now(),timestamp=Number.isFinite(correlation.timestamp)&&correlation.timestamp<=now+1000&&correlation.timestamp>=now-86400000?correlation.timestamp:now;
  let record;try{record=cleanRecord({timestamp,observedTimestamp:now,sessionId:this.sessionId,sequence:++this.sequence,component:correlation.component||this.component,version:this.version,event,severity,
   traceId:correlation.traceId||this.current().traceId,spanId:correlation.spanId||this.current().spanId,uptimeMs:Math.round(performance.now()-this.monotonic),attributes},this.component);}catch{this.dropped++;return null;}
  if(!record||this.stopped)return null;let bytes=JSON.stringify(record)+'\n';
  if(Buffer.byteLength(bytes)>16384){this.dropped++;return null;}
  this.recent.push(record);if(this.recent.length>200)this.recent.shift();
  if(this.ready)this.pending=this.pending.then(async()=>{
   if(this.size+Buffer.byteLength(bytes)>this.maxBytes){await fsp.rm(this.file(this.segments-1),{force:true});for(let i=this.segments-2;i>=0;i--)try{await fsp.rename(this.file(i),this.file(i+1));}catch(error){if(error.code!=='ENOENT')throw error;}this.size=0;}
   await fsp.appendFile(this.file(0),bytes);this.size+=Buffer.byteLength(bytes);
   if(['error','fatal'].includes(record.severity))await fsp.writeFile(path.join(this.directory,this.component+'.last-error.json'),JSON.stringify(record));
  }).catch(error=>this.ioErrors.add(safeCode(error.code)));
  return record;
 }
 installProcessMonitoring(){
  this.fatal=error=>{const record=cleanRecord({timestamp:Date.now(),sessionId:this.sessionId,sequence:++this.sequence,component:this.component,version:this.version,event:'process.exception',severity:'fatal',attributes:{error}},this.component);
   if(!this.ready)return;try{fs.appendFileSync(this.file(0),JSON.stringify(record)+'\n');fs.writeFileSync(path.join(this.directory,this.component+'.last-error.json'),JSON.stringify(record));}catch{}
  };
  this.warning=warning=>this.record('process.warning',{error:warning},'warn');
  process.on('uncaughtExceptionMonitor',this.fatal);process.on('warning',this.warning);
 }
 flush(){return this.pending;}
 snapshot(){return structuredClone(this.recent);}
 async close(){if(this.stopped)return;this.record('session.ended',{clean:true});await this.flush();this.stopped=true;
  if(this.ready)try{await fsp.writeFile(path.join(this.directory,this.component+'.state.json'),JSON.stringify({sessionId:this.sessionId,started:this.started,clean:true}));}catch(error){this.ioErrors.add(safeCode(error.code));}
  if(this.fatal)process.off('uncaughtExceptionMonitor',this.fatal);if(this.warning)process.off('warning',this.warning);
 }
 status(){return {ready:this.ready,sessionId:this.sessionId,ioErrors:[...this.ioErrors],droppedOversize:this.dropped,maxSegmentBytes:this.maxBytes,segments:this.segments};}
}

async function readDiagnosticBundle(directory,memory=[]){
 const records=[],pinned=[];let invalidLines=0,missingFiles=0;
 for(const component of ['main','service']){
  for(let i=2;i>=0;i--)try{const file=await fsp.open(path.join(directory,component+'.'+i+'.jsonl'),'r');let text;try{const stat=await file.stat(),buffer=Buffer.alloc(Math.min(stat.size,1024*1024));await file.read(buffer,0,buffer.length,Math.max(0,stat.size-buffer.length));text=buffer.toString('utf8');}finally{await file.close();}
   for(const line of text.split('\n'))if(line.trim())try{const record=cleanRecord(JSON.parse(line),component);if(record)records.push(record);else invalidLines++;}catch{invalidLines++;}
  }catch(error){if(error.code!=='ENOENT')missingFiles++;}
  try{const record=cleanRecord(JSON.parse(await fsp.readFile(path.join(directory,component+'.last-error.json'),'utf8')),component);if(record)pinned.push(record);}catch{}
 }
 records.sort((a,b)=>a.timestamp-b.timestamp||a.sequence-b.sequence);
 const kept=records.slice(-6000);
 return mergeDiagnosticEvents({events:kept,lastErrors:pinned,coverage:{retainedEvents:kept.length,omittedOlderEvents:Math.max(0,records.length-kept.length),invalidLines,unreadableFiles:missingFiles,
  firstTimestamp:kept[0]?.timestamp,lastTimestamp:kept.at(-1)?.timestamp,boundedHistory:true,rawMessagesIncluded:false,memoryDumpsIncluded:false}},memory);
}

function mergeDiagnosticEvents(bundle,memory=[]){
 const key=record=>[record.sessionId,record.component,record.sequence,record.timestamp].join(':');
 const records=new Map((bundle.events||[]).map(x=>[key(x),x]));let recovered=0;
 for(const value of memory){const record=cleanRecord(value,value.component);if(record&&!records.has(key(record))){records.set(key(record),record);recovered++;}}
 const events=[...records.values()].sort((a,b)=>a.timestamp-b.timestamp||a.sequence-b.sequence).slice(-6000);
 const failures=new Map();for(const record of [...(bundle.lastErrors||[]),...events.filter(x=>['error','fatal'].includes(x.severity))])if(!failures.has(record.component)||failures.get(record.component).timestamp<=record.timestamp)failures.set(record.component,record);
 return {...bundle,events,lastErrors:[...failures.values()],coverage:{...bundle.coverage,retainedEvents:events.length,firstTimestamp:events[0]?.timestamp,lastTimestamp:events.at(-1)?.timestamp,inMemoryRecovered:(bundle.coverage?.inMemoryRecovered||0)+recovered}};
}

function incidentSummary(journal){
 const entries=journal?.events||[],sessionId=journal?.writerStatus?.sessionId;
 const failures=entries.filter(x=>['operation.failed','request.failed','renderer.crashed','renderer.exception','renderer.unresponsive','process.exception','transport.failed'].includes(x.event)&&!(x.event==='request.failed'&&x.attributes?.category==='staticAsset'&&x.attributes?.status<500)&&!['busy','cancelled','waitIdle'].includes(x.attributes?.code));
 const candidate=failures.at(-1)||journal?.lastErrors?.at(-1);const latestFailure=candidate?.traceId?[...failures].reverse().find(x=>x.traceId===candidate.traceId&&x.attributes?.error)||candidate:candidate,trace=latestFailure?.traceId;
 const lastObservedOutcome=entries.filter(x=>['operation.finished','operation.failed','renderer.crashed','process.exception'].includes(x.event)).at(-1);
 const reproduction={lastFailure:latestFailure,lastObservedOutcome,expectedOutcome:({apply:'wallpaperChanged',next:'wallpaperChanged',previous:'wallpaperChanged',refresh:'poolUpdated',retryPending:'poolUpdated',settings:'settingsSaved'})[latestFailure?.attributes?.action]||'unknown',
  observedSteps:entries.filter(x=>['request.started','configuration.changed','configuration.monitor_changed','monitor.added','monitor.removed','operation.failed','renderer.crashed','renderer.unresponsive','ui.action'].includes(x.event)).slice(-100),
  relatedTrace:trace?entries.filter(x=>x.traceId===trace):[],automaticallyObserved:true};
 return reproduction;
}

module.exports={incidentSummary,DiagnosticLog,readDiagnosticBundle,mergeDiagnosticEvents,cleanAttributes,safeError,safeFrames,safeAction,safeOrigin,traceId,hex};
