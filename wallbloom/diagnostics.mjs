// Reports and the local history use an allowlist. Never copy Error messages,
// native stderr, settings, sources or items directly into a diagnostic file.
import os from 'node:os';
import {atomic,readPersistent} from './persistence.mjs';
import {allowed,contentMask} from './core.mjs';
import {eligible,visibleSettings} from './automation.mjs';
import {effectiveMonitorPurity} from './public/monitor-content.js';
import {safeError,incidentSummary} from './desktop/diagnostic-log.cjs';

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
 const detail=error?.diagnostic||{},base=safeError(error);
 return {name:base.name,systemCode:base.code,
  reason:base.reason!=='unknown'?base.reason:({ENOENT:'fileMissing',EACCES:'fileAccessDenied',EPERM:'fileAccessDenied',ENOSPC:'diskFull'})[error?.code],stage:base.phase,monitor:number(detail.monitor),
  sourceType:enums(detail.sourceType,['wallhaven','local','feed','booru','bing','nasa','commons','deviantart','pixabay','konachan']),
  downloaded:typeof detail.downloaded==='boolean'?detail.downloaded:undefined,
  nativeOperation:enums(detail.nativeOperation,['activity','desktopInfo','listMonitors','applyMonitor','applyWallpaper','unknown']),exitCode:number(detail.exitCode),
  nativeSystemCode:detail.nativeSystemCode?safeError({code:detail.nativeSystemCode}).code:undefined,
  frames:safeError(error).frames,hresult:typeof detail.hresult==='string'&&/^0x[\da-fA-F]{8}$/.test(detail.hresult)?detail.hresult:undefined};
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
    left:monitor.left,top:monitor.top,customSettings:!!db.settings.monitors?.[monitor.id],purity:contentMask(effective),configuredPurity:db.settings.monitors?.[monitor.id]?.purity||contentMask(settings),inheritPurity:!db.settings.monitors?.[monitor.id]||db.settings.monitors[monitor.id].inheritPurity===true,
    rotation:!!effective.rotation,tagsCount:effective.tags.length,excludedTagsCount:effective.excludedTags.length,
    selection:selectionSummary(db,effective,db.monitorCurrent?.[monitor.id])};}),
  backup:{available:!!backup,monitorCount:backup?.monitors?.length||0}};
}

const numericFields=(value,names)=>Object.fromEntries(names.map(name=>[name,number(value?.[name])]));
function cleanSelection(value={}){return {...numericFields(value,['downloaded','eligible','alternatives','sourceDisabled','showLimitReached','outsideCollection']),currentPresent:value.currentPresent===true,blocked:numericFields(value.blocked,['itemMissing','notDownloaded','rejectedVote','ratingBlocked','excludedTags'])};}
const categoryCount=value=>typeof value==='string'&&/^[01]{3}$/.test(value)?[...value].filter(x=>x==='1').length:undefined;
function cleanContext(value={}){
 const settings=value.configuration||{};
 return {profile:enums(value.profile,['main','additional']),transport:enums(value.transport,['ipc','http']),
  guard:{code:symbol(value.guard?.code),...numericFields(value.guard,['cpuLoad','gpuLoad','freeMemory'])},
  network:{received:number(value.network?.received),active:numericFields(value.network?.active,['api','preview','metadata','original','other'])},
  configuration:{...numericFields(settings,['rotationMinutes','pendingTarget','width','height','maxItemMB','maxTotalGB','usedBytes']),
   ...Object.fromEntries(['workMode','rotation','rotationPaused','collectionSelected'].map(key=>[key,settings[key]===true])),
   enabledCategoryCount:categoryCount(settings.purity)??number(settings.enabledCategoryCount),
   hold:enums(settings.hold,['manual','timed','none']),fit:enums(settings.fit,['contain','cover','inside'])},
  selection:cleanSelection(value.selection),monitors:(Array.isArray(value.monitors)?value.monitors:[]).map(m=>({
   ...numericFields(m,['index','ref','width','height','left','top']),customSettings:m.customSettings===true,rotation:m.rotation===true,inheritPurity:m.inheritPurity===true,configuredCategoryCount:categoryCount(m.configuredPurity)??number(m.configuredCategoryCount),effectiveCategoryCount:categoryCount(m.purity)??number(m.effectiveCategoryCount),filterConflict:m.purity==='000'||m.filterConflict===true,selection:cleanSelection(m.selection)})),
  backup:{available:value.backup?.available===true,monitorCount:number(value.backup?.monitorCount)}};
}
function cleanOperation(value){
 if(!value||!actions.has(value.action)||!Number.isFinite(value.started))return null;
 return {id:typeof value.id==='string'&&/^\d+-\d+$/.test(value.id)?value.id:undefined,
  version:typeof value.version==='string'&&/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(value.version)?value.version:undefined,
  action:value.action,status:enums(value.status,['running','success','failed','cancelled','unavailable','interrupted']),
  code:symbol(value.code),...numericFields(value,['started','finished','durationMs']),context:cleanContext(value.context),
  ...value.error&&{error:diagnosticError({name:value.error.name,code:value.error.systemCode,frames:value.error.frames,diagnostic:value.error})}};
}

export function describeSettingsChange(before,after,monitors,workMode=false){
 const changedFields=[];
 for(const field of ['rotation','rotationMinutes','autoRefresh','refreshMinutes','pendingTarget','batch','maxItemMB','maxTotalGB','fit','quality','ai','aiFilter','schedule','shortcuts','pauseOnBattery','changeOnWake','changeOnStartup','changeAfterFullscreen','cancelRefreshMinutes','cleanupAfterShows'])if(JSON.stringify(before[field])!==JSON.stringify(after[field]))changedFields.push(field);
 if(before.width!==after.width||before.height!==after.height)changedFields.push('dimensions');
 const categorySetChanged=contentMask(before)!==contentMask(after);
 if(categorySetChanged)changedFields.push('contentCategories');
 if(JSON.stringify([before.tags,before.excludedTags])!==JSON.stringify([after.tags,after.excludedTags]))changedFields.push('eligibilityRules');
 const affected=[];
 for(const [index,monitor]of monitors.entries()){
  const old=before.monitors?.[monitor.id],next=after.monitors?.[monitor.id];
  const oldMask=effectiveMonitorPurity(contentMask(before),old,workMode),nextMask=effectiveMonitorPurity(contentMask(after),next,workMode);
  if(JSON.stringify(old)!==JSON.stringify(next)||oldMask!==nextMask){
   affected.push({index:index+1,before:{enabledCount:categoryCount(old?.purity||contentMask(before)),effectiveCount:categoryCount(oldMask),inherited:!old||old.inheritPurity===true,conflict:oldMask==='000'},after:{enabledCount:categoryCount(next?.purity||contentMask(after)),effectiveCount:categoryCount(nextMask),inherited:!next||next.inheritPurity===true,conflict:nextMask==='000'}});
  }
 }
 if(affected.length)changedFields.push('monitorContent');
 return {changedFields,categorySetChanged,monitors:affected,before:{enabledCount:categoryCount(contentMask(before)),rotationEnabled:!!before.rotation,autoRefreshEnabled:!!before.autoRefresh},after:{enabledCount:categoryCount(contentMask(after)),rotationEnabled:!!after.rotation,autoRefreshEnabled:!!after.autoRefresh}};
}

// Only diagnosticContext and diagnosticError supply data to the bounded history.
export class DiagnosticJournal{
 constructor(file,version,{onEvent}={}){this.file=file;this.version=version;this.operations=[];this.lastFailure=null;this.pending=Promise.resolve();this.sequence=0;this.saveError=null;this.onEvent=onEvent;}
 async open(){
  try{const saved=await readPersistent(this.file,{operations:[]});
   this.operations=(Array.isArray(saved.operations)?saved.operations:[]).map(cleanOperation).filter(Boolean).slice(0,20)
    .map(x=>({...x,status:x.status==='running'?'interrupted':x.status}));
   this.lastFailure=cleanOperation(saved.lastFailure);
  }catch(error){this.saveError={code:symbol(error.code)||'historyReadFailed'};}
  return this;
 }
 begin(action,context){const operation={id:Date.now()+'-'+(++this.sequence),version:this.version,action:actionName(action),status:'running',started:Date.now(),context:cleanContext(context)};this.operations.unshift(operation);this.operations=this.operations.slice(0,20);this.save();this.notify('operation.started',{action:operation.action,monitorCount:operation.context.monitors.length,before:{enabledCount:operation.context.configuration.enabledCategoryCount,eligible:operation.context.selection.eligible}});return operation;}
 finish(operation,{code,status='success',error,context}={}){if(!operation)return;Object.assign(operation,{status,code:symbol(code),finished:Date.now(),durationMs:Date.now()-operation.started,...error&&{error:diagnosticError(error)},...context&&{context:cleanContext(context)}});if(['failed','unavailable'].includes(status))this.lastFailure=structuredClone(operation);this.save();this.notify(['failed','unavailable'].includes(status)?'operation.failed':'operation.finished',{action:operation.action,code,error,durationMs:operation.durationMs,success:status==='success',after:{eligible:operation.context.selection.eligible}},['failed','unavailable'].includes(status)?'error':'info');}
 notify(...args){try{this.onEvent?.(...args);}catch{}}
 failure(action,code,error,context){const operation=this.begin(action,context);this.finish(operation,{status:'failed',code,error});return operation;}
 save(){const snapshot=structuredClone({schemaVersion:2,operations:this.operations,lastFailure:this.lastFailure});this.pending=this.pending.then(()=>atomic(this.file,snapshot)).then(()=>{this.saveError=null;},error=>{this.saveError={code:symbol(error.code)||'historySaveFailed'};});}
 flush(){return this.pending;}
 snapshot(){return {operations:structuredClone(this.operations),lastFailure:structuredClone(this.lastFailure),persistenceError:this.saveError};}
}

export function diagnosticsReport(db,{guard,job,lastError,events,network,version,context,history,wallpaperAction,wallpaperResult,nativeStatus={},journal}){
 const publicContext=cleanContext(context);
 const reproduction=incidentSummary(journal),entries=journal?.events||[],sessionId=journal?.writerStatus?.sessionId;
 const logicalDisplays=new Map();for(const entry of entries)if(entry.sessionId===sessionId&&entry.component==='main'&&entry.attributes?.monitor?.ref){const monitor=entry.attributes.monitor;if(entry.event==='monitor.removed')logicalDisplays.delete(monitor.ref);else if(['monitor.topology','monitor.added'].includes(entry.event))logicalDisplays.set(monitor.ref,monitor);}
 return {schemaVersion:3,application:'WallWave',version,reproduction,displayTopology:{physicalTopologyFresh:nativeStatus.listMonitors?.ok===true,physicalMonitors:publicContext.monitors,logicalDisplays:[...logicalDisplays.values()]},collectionLimits:{boundedHistory:true,privateContentsExcluded:true,mainProcessExpected:context?.transport==='ipc',historyBeforeThisVersionUnavailable:entries.length===0},createdAt:new Date().toISOString(),paused:db.paused,
  environment:{platform:process.platform,arch:process.arch,osRelease:os.release(),node:process.versions.node,electron:process.versions.electron,cpuCount:os.availableParallelism?.()||os.cpus().length,totalMemory:os.totalmem()},
  nativeStatus:Object.fromEntries(['desktopInfo','listMonitors','activity'].map(name=>[name,nativeStatus[name]&&{ok:nativeStatus[name].ok,observedAt:nativeStatus[name].observedAt,error:nativeStatus[name].error}])),
  library:{items:db.items.length,downloaded:db.items.filter(x=>x.downloaded).length,collections:(db.collections||[]).length},
  configuration:{ai:db.settings.ai,batch:db.settings.batch,autoRefresh:db.settings.autoRefresh,cancelRefreshMinutes:db.settings.cancelRefreshMinutes,...publicContext.configuration},
  sources:{configured:db.providers.length,enabled:db.providers.filter(p=>p.enabled).length},
  guard:{code:guard.code,cpuLoad:guard.cpuLoad,gpuLoad:guard.gpuLoad,freeMemory:guard.freeMemory,fullscreen:guard.fullscreen,onBattery:guard.onBattery,locked:guard.locked},
  job:job&&{kind:job.kind,action:job.action,phase:job.phase,downloaded:job.downloaded,target:job.target,started:job.started,
   modelDownload:job.modelDownload&&{loaded:number(job.modelDownload.loaded),total:number(job.modelDownload.total)}},
  lastError:lastError&&{code:lastError.code,time:lastError.time,scope:lastError.scope},network,
  wallpaperAction:wallpaperAction&&{action:wallpaperAction.action,started:wallpaperAction.started},
  wallpaperResult:wallpaperResult&&{code:wallpaperResult.code,time:wallpaperResult.time},
  recentEvents:events.slice(0,60).map(({code,time,count,kind,action})=>({code,time,count,kind,action})),context:publicContext,history,journal,
  refresh:{outcome:db.lastRefreshOutcome,downloaded:db.lastRefreshDownloaded,target:db.lastRefreshTarget,reason:db.lastRefreshReason,resumeAt:db.refreshResumeAt}};
}
