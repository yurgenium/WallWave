// Reports and the local history use an allowlist. Never copy Error messages,
// native stderr, settings, sources or items directly into a diagnostic file.
import os from 'node:os';
import {atomic,readPersistent} from './persistence.mjs';
import {allowed,contentMask} from './core.mjs';
import {eligible,visibleSettings} from './automation.mjs';

const symbol=value=>typeof value==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(value)?value:undefined;
const number=value=>Number.isFinite(value)?value:undefined;
const actions=new Set(['refresh','retryPending','download','ai','apply','next','previous','restore','rotation','profile','work','vote','frame','settings','collectionPlay','startup','unknown']);
const actionName=value=>actions.has(value)?value:'unknown';
const enums=(value,values)=>values.includes(value)?value:undefined;

export function availabilityReason(item,settings){
 if(!item)return 'itemMissing';
 if(!item.downloaded)return 'notDownloaded';
 if(['ban','dislike'].includes(item.vote))return 'rejectedVote';
 if(contentMask(settings)[['safe','suggestive','adult'].indexOf(item.rating)]!=='1')return 'ratingBlocked';
 if(!allowed(item,settings))return 'excludedTags';
 return null;
}

export function diagnosticError(error){
 const detail=error?.diagnostic||{};
 return {name:symbol(error?.name),systemCode:symbol(error?.code),
  reason:symbol(detail.reason)||({ENOENT:'fileMissing',EACCES:'fileAccessDenied',EPERM:'fileAccessDenied',ENOSPC:'diskFull'})[error?.code],stage:symbol(detail.stage),monitor:number(detail.monitor),
  sourceType:symbol(detail.sourceType),rating:enums(detail.rating,['safe','suggestive','adult']),
  downloaded:typeof detail.downloaded==='boolean'?detail.downloaded:undefined,
  vote:enums(detail.vote,['like','dislike','ban','neutral','deferred']),
  nativeOperation:symbol(detail.nativeOperation),exitCode:number(detail.exitCode),
  nativeSystemCode:symbol(detail.nativeSystemCode),
  hresult:typeof detail.hresult==='string'&&/^0x[\da-fA-F]{8}$/.test(detail.hresult)?detail.hresult:undefined};
}

function selectionSummary(db,settings,current){
 const downloaded=db.items.filter(x=>x.downloaded),candidates=eligible(db,settings),blocked={};
 for(const item of downloaded){const reason=availabilityReason(item,settings);if(reason)blocked[reason]=(blocked[reason]||0)+1;}
 const members=db.rotationCollection?new Set(db.collections?.find(x=>x.id===db.rotationCollection)?.items||[]):null;
 return {downloaded:downloaded.length,eligible:candidates.length,alternatives:candidates.filter(x=>x.id!==current).length,currentPresent:!!current,blocked,
  deferred:downloaded.filter(x=>x.vote==='deferred').length,
  sourceDisabled:downloaded.filter(x=>!x.vote&&!db.providers.some(p=>p.id===x.provider&&p.enabled)).length,
  showLimitReached:downloaded.filter(x=>{const rule=db.settings.cleanupAfterShows?.[x.vote||'pending'];return rule?.enabled&&(x.showCount||0)>=rule.shows;}).length,
  outsideCollection:members?downloaded.filter(x=>!members.has(x.id)).length:0,
  byRating:Object.fromEntries(['safe','suggestive','adult'].map(rating=>[rating,downloaded.filter(x=>x.rating===rating).length]))};
}

export function diagnosticContext(db,{monitors=[],monitorSettings,activeProfile='main',backup,used,transport,guard={},network={}}={}){
 const settings=visibleSettings(db);
 return {profile:activeProfile==='main'?'main':'additional',transport,
  guard:{code:symbol(guard.code),cpuLoad:number(guard.cpuLoad),gpuLoad:number(guard.gpuLoad),freeMemory:number(guard.freeMemory)},
  network:{received:number(network.received),active:numericFields(network.active,['api','preview','metadata','original','other'])},
  configuration:{purity:contentMask(settings),workMode:!!db.workMode,rotation:!!db.settings.rotation,
   rotationPaused:!!db.rotationPaused,rotationMinutes:db.settings.rotationMinutes,
   tagsCount:db.settings.tags.length,excludedTagsCount:db.settings.excludedTags.length,
   pendingTarget:db.settings.pendingTarget,collectionSelected:!!db.rotationCollection,
   hold:db.wallpaperHold?.manual?'manual':db.wallpaperHold?.until>Date.now()?'timed':'none',
   width:db.settings.width,height:db.settings.height,fit:db.settings.fit,
   maxItemMB:db.settings.maxItemMB,maxTotalGB:db.settings.maxTotalGB,usedBytes:number(used)},
  selection:selectionSummary(db,settings,db.current),
  monitors:monitors.map((monitor,index)=>{const effective=monitorSettings?.(monitor.id)||settings;
   return {index:index+1,width:monitor.width,height:monitor.height,
    customSettings:!!db.settings.monitors?.[monitor.id],purity:contentMask(effective),
    rotation:!!effective.rotation,tagsCount:effective.tags.length,excludedTagsCount:effective.excludedTags.length,
    selection:selectionSummary(db,effective,db.monitorCurrent?.[monitor.id])};}),
  backup:{available:!!backup,monitorCount:backup?.monitors?.length||0}};
}

const numericFields=(value,names)=>Object.fromEntries(names.map(name=>[name,number(value?.[name])]));
function cleanSelection(value={}){return {...numericFields(value,['downloaded','eligible','alternatives','deferred','sourceDisabled','showLimitReached','outsideCollection']),currentPresent:value.currentPresent===true,
 blocked:numericFields(value.blocked,['itemMissing','notDownloaded','rejectedVote','ratingBlocked','excludedTags']),byRating:numericFields(value.byRating,['safe','suggestive','adult'])};}
function cleanContext(value={}){
 const settings=value.configuration||{};
 return {profile:enums(value.profile,['main','additional']),transport:enums(value.transport,['ipc','http']),
  guard:{code:symbol(value.guard?.code),...numericFields(value.guard,['cpuLoad','gpuLoad','freeMemory'])},
  network:{received:number(value.network?.received),active:numericFields(value.network?.active,['api','preview','metadata','original','other'])},
  configuration:{...numericFields(settings,['rotationMinutes','tagsCount','excludedTagsCount','pendingTarget','width','height','maxItemMB','maxTotalGB','usedBytes']),
   ...Object.fromEntries(['workMode','rotation','rotationPaused','collectionSelected'].map(key=>[key,settings[key]===true])),
   purity:typeof settings.purity==='string'&&/^[01]{3}$/.test(settings.purity)?settings.purity:undefined,
   hold:enums(settings.hold,['manual','timed','none']),fit:enums(settings.fit,['contain','cover','inside'])},
  selection:cleanSelection(value.selection),monitors:(Array.isArray(value.monitors)?value.monitors:[]).slice(0,64).map(m=>({
   ...numericFields(m,['index','width','height','tagsCount','excludedTagsCount']),customSettings:m.customSettings===true,rotation:m.rotation===true,
   purity:typeof m.purity==='string'&&/^[01]{3}$/.test(m.purity)?m.purity:undefined,selection:cleanSelection(m.selection)})),
  backup:{available:value.backup?.available===true,monitorCount:number(value.backup?.monitorCount)}};
}
function cleanOperation(value){
 if(!value||!actions.has(value.action)||!Number.isFinite(value.started))return null;
 return {id:typeof value.id==='string'&&/^\d+-\d+$/.test(value.id)?value.id:undefined,
  version:typeof value.version==='string'&&/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(value.version)?value.version:undefined,
  action:value.action,status:enums(value.status,['running','success','failed','cancelled','unavailable','interrupted']),
  code:symbol(value.code),...numericFields(value,['started','finished','durationMs']),context:cleanContext(value.context),
  ...value.error&&{error:diagnosticError({name:value.error.name,code:value.error.systemCode,diagnostic:value.error})}};
}

// Only diagnosticContext and diagnosticError supply data to the bounded history.
export class DiagnosticJournal{
 constructor(file,version){this.file=file;this.version=version;this.operations=[];this.lastFailure=null;this.pending=Promise.resolve();this.sequence=0;this.saveError=null;}
 async open(){
  try{const saved=await readPersistent(this.file,{operations:[]});
   this.operations=(Array.isArray(saved.operations)?saved.operations:[]).map(cleanOperation).filter(Boolean).slice(0,20)
    .map(x=>({...x,status:x.status==='running'?'interrupted':x.status}));
   this.lastFailure=cleanOperation(saved.lastFailure);
  }catch(error){this.saveError={code:symbol(error.code)||'historyReadFailed'};}
  return this;
 }
 begin(action,context){const operation={id:Date.now()+'-'+(++this.sequence),version:this.version,action:actionName(action),status:'running',started:Date.now(),context:cleanContext(context)};this.operations.unshift(operation);this.operations=this.operations.slice(0,20);this.save();return operation;}
 finish(operation,{code,status='success',error,context}={}){if(!operation)return;Object.assign(operation,{status,code:symbol(code),finished:Date.now(),durationMs:Date.now()-operation.started,...error&&{error:diagnosticError(error)},...context&&{context:cleanContext(context)}});if(['failed','unavailable'].includes(status))this.lastFailure=structuredClone(operation);this.save();}
 failure(action,code,error,context){const operation=this.begin(action,context);this.finish(operation,{status:'failed',code,error});return operation;}
 save(){const snapshot=structuredClone({schemaVersion:2,operations:this.operations,lastFailure:this.lastFailure});this.pending=this.pending.then(()=>atomic(this.file,snapshot)).then(()=>{this.saveError=null;},error=>{this.saveError={code:symbol(error.code)||'historySaveFailed'};});}
 flush(){return this.pending;}
 snapshot(){return {operations:structuredClone(this.operations),lastFailure:structuredClone(this.lastFailure),persistenceError:this.saveError};}
}

export function diagnosticsReport(db,{guard,job,lastError,events,network,version,context,history,wallpaperAction,wallpaperResult,nativeStatus={}}){
 return {schemaVersion:2,application:'WallWave',version,createdAt:new Date().toISOString(),paused:db.paused,
  environment:{platform:process.platform,arch:process.arch,osRelease:os.release(),node:process.versions.node,electron:process.versions.electron},
  nativeStatus:Object.fromEntries(['desktopInfo','listMonitors','activity'].map(name=>[name,nativeStatus[name]&&{ok:nativeStatus[name].ok,error:nativeStatus[name].error}])),
  library:{items:db.items.length,downloaded:db.items.filter(x=>x.downloaded).length,collections:(db.collections||[]).length},
  configuration:{ai:db.settings.ai,aiFilter:db.settings.aiFilter,batch:db.settings.batch,autoRefresh:db.settings.autoRefresh,cancelRefreshMinutes:db.settings.cancelRefreshMinutes,...context?.configuration},
  sources:db.providers.map(p=>({type:p.type,enabled:p.enabled})),
  guard:{code:guard.code,cpuLoad:guard.cpuLoad,gpuLoad:guard.gpuLoad,freeMemory:guard.freeMemory,fullscreen:guard.fullscreen,onBattery:guard.onBattery,locked:guard.locked},
  job:job&&{kind:job.kind,action:job.action,phase:job.phase,downloaded:job.downloaded,target:job.target,started:job.started,
   modelDownload:job.modelDownload&&{loaded:number(job.modelDownload.loaded),total:number(job.modelDownload.total)}},
  lastError:lastError&&{code:lastError.code,time:lastError.time,scope:lastError.scope},network,
  wallpaperAction:wallpaperAction&&{action:wallpaperAction.action,started:wallpaperAction.started},
  wallpaperResult:wallpaperResult&&{code:wallpaperResult.code,time:wallpaperResult.time},
  recentEvents:events.slice(0,60).map(({code,time,count,kind,action})=>({code,time,count,kind,action})),context,history,
  refresh:{outcome:db.lastRefreshOutcome,downloaded:db.lastRefreshDownloaded,target:db.lastRefreshTarget,reason:db.lastRefreshReason,resumeAt:db.refreshResumeAt}};
}
