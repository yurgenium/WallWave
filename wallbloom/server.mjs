import http from 'node:http';
import {purgeRejectedFiles,removeProviderCopies,rememberReview,cleanupCandidates,syncTagCleanup,purgeCopies,CleanupConfirmations,syncShownCleanup,shownCleanupCandidates,dueCleanupCandidates,rejectedCleanupCandidates} from './library-cleanup.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {AISession} from './ai-session.mjs';
import {embeddingVersion,validEmbedding,tasteProfile,tasteSignature,assessTaste} from './visual-ai.mjs';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import {defaults,validate,allowed,score,sharpModule,AppError,errorCode} from './core.mjs';
import {initialProviders,validateProvider,searchProvider,enrich} from './providers.mjs';
import {resourceAvailability} from './resources.mjs';
import {fetchBytes} from './network.mjs';
import {hasPortraitScreen,portraitImage,sourceDimensions} from './orientation.mjs';
import {atomic,persist,readPersistent,initLibrary,usage,imagePath,downloadImage,changeVote,writeIndexes,visualFingerprint} from './library.mjs';
import {activity,applyWallpaper,desktopInfo,openWallhavenAccount,listMonitors,applyMonitor} from './windows.mjs';
import {visibleSettings,eligible,chooseNext,rankCandidates,pendingCapacity,staleItems,confirmShows,automationState} from './automation.mjs';
import {exportLibrary,restoreLibrary} from './archive.mjs';
import {validateFrame,frameSource,effectiveFrame,renderFrame,renderDesktop,renderedName,pruneRendered} from './framing.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),dir=path.resolve(process.env.WALLBLOOM_DATA_DIR||path.join(root,'data'));
await initLibrary(dir);let db,keys;let desktop=await desktopInfo().catch(()=>null);let backup;async function read(file,fallback){return readPersistent(path.join(dir,file),fallback);}
db=await read('state.json',{settings:{...defaults,...desktop&&{width:desktop.width,height:desktop.height}},providers:initialProviders,items:[],pages:{},current:null,lastRefresh:0,lastRotation:0});for(const p of initialProviders.filter(p=>['bing','nasa','commons'].includes(p.type)))if(!db.providers.some(x=>x.id===p.id||x.type===p.type))db.providers.push({...p});db.settings=validate(db.settings);db.paused=db.paused===true;keys=await read('credentials.json',{});backup=await read('desktop-before-wallbloom.json',null);
// Repair a cache/state mismatch after an interrupted operation without deleting files.
for(const x of db.items){if(!x.downloaded)continue;try{await fs.access(imagePath(dir,x));}catch{let found=false;for(const folder of ['pending','liked','disliked','blocked']){try{const candidate=path.join(dir,folder,x.id+'.jpg');await fs.access(candidate);await fs.rename(candidate,imagePath(dir,x));found=true;break;}catch{}}x.downloaded=found;}}
db.monitorCurrent??={};db.monitorLastRotation??={};db.rotationTriggers=[];db.exposures={};db.workMode=db.workMode===true;
let monitors=await listMonitors().catch(()=>[]),desktopContext={locked:false},shortcutStatus={},exportPath=null,rollbackPath=null;
const orientationAllowed=x=>hasPortraitScreen(monitors,desktop)||portraitImage(x)!==true;
async function updateDownloadScreens(){
 monitors=await listMonitors().catch(()=>monitors);desktop=await desktopInfo().catch(()=>desktop);
 const retained=db.items.filter(x=>x.downloaded||orientationAllowed(x));
 if(retained.length!==db.items.length){db.items=retained;await save();}
}
async function prepareOrientation(x,signal){
 if(hasPortraitScreen(monitors,desktop))return true;
 if(portraitImage(x)!==null)return orientationAllowed(x);
 const sharp=await sharpModule();let source;
 if(x.localSource){const provider=db.providers.find(p=>p.id===x.provider),file=await fs.realpath(x.localSource),folder=await fs.realpath(provider.folder);if(!file.startsWith(folder+path.sep))throw new AppError('unsafeURL');source=file;}
 else source=await fetchBytes(x.url,{prefix:256*1024,limit:256*1024,signal});
 Object.assign(x,sourceDimensions(await sharp(source,{limitInputPixels:64000000,animated:false}).metadata()));
 if(portraitImage(x)===null)throw new AppError('invalidImage');
 return orientationAllowed(x);
}
db.renderedCurrent??={};
await pruneRendered(dir,[...Object.values(db.renderedCurrent),desktop?.wallpaper,...monitors.map(m=>m.wallpaper),backup?.wallpaper,...(backup?.monitors||[]).map(m=>m.wallpaper)]);
await writeIndexes(dir,db.items);
function syncCleanups(){syncTagCleanup(db);syncShownCleanup(db);}
const cleanupConfirmations=new CleanupConfirmations();
let libraryWrites=Promise.resolve();function mutateLibrary(fn){const task=libraryWrites.catch(()=>{}).then(fn);libraryWrites=task;return task;}
let writes=Promise.resolve();function save(){const snapshot=structuredClone(db);writes=writes.catch(()=>{}).then(async()=>{await persist(path.join(dir,'state.json'),snapshot);await writeIndexes(dir,snapshot.items);});return writes;}
let aiSession=null,profileCache=null;
let job=null,controller=null,events=[],providerStatus={},used=await usage(dir),guard={code:'checking',idle:0},nextRetry=0,mutating=false,aiRequested=false,lastError=null,activeTask=Promise.resolve(),shuttingDown=false;
const errorEvents=new Set(['networkError','timeout','sourceUnavailable','rateLimited','diskLimit','itemLimit','invalidFeed','invalidImage','downloadFailed','aiUnavailable','saveFailed','operationFailed','apiKeyRequired','guardUnavailable','invalidArchive','monitorDisconnected']);
function event(code,detail={}){const entry={time:Date.now(),code,...detail};events.unshift(entry);events=events.slice(0,60);if(errorEvents.has(code))lastError={code,time:entry.time};}
function desktopState(){return {settings:db.settings,job:db.workMode&&job?{...job,item:''}:job,aiRequested,guard,paused:db.paused,lastError,workMode:db.workMode,current:db.current,shortcutStatus,token};}
// Cleared copies retain private metadata for duplicate prevention, not gallery cards.
function libraryVisible(x){if(x.cleanupRemoved&&!x.downloaded)return false;if(!x.vote&&!db.providers.some(p=>p.id===x.provider&&p.enabled))return false;const settings=visibleSettings(db);return allowed(x,x.downloaded||x.vote?{...settings,excludedTags:[]}:settings);}
function state(){return {...desktopState(),showCleanup:{count:shownCleanupCandidates(db).length,dueAt:db.showCleanup?.dueAt},providers:db.providers.map(p=>({...p,hasKey:!!keys[p.id]})),tagCleanup:{count:cleanupCandidates(db,{kind:'tags'}).length,dueAt:db.tagCleanup?.dueAt},items:db.items.filter(x=>libraryVisible(x)&&(!x.aiScreening?.rejected||x.downloaded)).map(({embedding,localSource,visualSample,aiTitle,...x})=>x),events:db.workMode?events.map(({item,...x})=>x):events,providerStatus,used,library:dir,aiRejectedCount:db.items.filter(x=>!x.downloaded&&x.aiScreening?.rejected).length,lastRefresh:db.lastRefresh,recentReviews:db.recentReviews||[],refreshOutcome:db.lastRefreshOutcome,refreshDownloaded:db.lastRefreshDownloaded,refreshTarget:db.lastRefreshTarget,refreshReason:db.lastRefreshReason,canRestore:!!backup,screen:desktop&&{width:desktop.width,height:desktop.height},monitors:monitors.map(({wallpaper,...m})=>({...m,current:db.monitorCurrent[m.id]})),automation:automationState(db,guard,{job,nextRetry,lastError,aiRequested}),exportPath,rollbackPath};}
function start(kind,fn,automatic=false){if(job||shuttingDown)throw new AppError('busy');if(db.paused&&automatic)throw new AppError('pausedByUser');lastError=null;controller=new AbortController();const signal=controller.signal;job={kind,automatic,done:0,total:0,bytes:0,started:Date.now()};event('jobStarted',{kind});activeTask=(async()=>{try{await fn(signal);event('jobFinished',{kind});}catch(e){event(signal.aborted?'cancelled':errorCode(e),{kind});nextRetry=Date.now()+300000;}finally{aiSession?.close();aiSession=null;trimAIRejections();syncCleanups();job=null;controller=null;used=await usage(dir);await save();}})().catch(()=>event('saveFailed'));}
function rememberSkipped(x,duplicateId){
 db.downloadSkips??={};delete db.downloadSkips[x.id];db.downloadSkips[x.id]={code:x.error,duplicateId,time:Date.now()};
 const ids=Object.keys(db.downloadSkips);for(const id of ids.slice(0,Math.max(0,ids.length-5000)))delete db.downloadSkips[id];
}
function skipDownload(x){
 const skip=db.downloadSkips?.[x.id];if(!skip||Date.now()-skip.time>86400000)return false;
 return skip.code==='portraitSkipped'?!hasPortraitScreen(monitors,desktop):skip.duplicateId&&db.items.some(y=>y.id===skip.duplicateId&&(y.downloaded||['ban','dislike'].includes(y.vote)));
}
async function refresh(signal){
 const needed=pendingCapacity(db);
 if(needed===0){db.lastRefresh=Date.now();db.lastRefreshOutcome='poolReady';event('poolReady');return;}
 await updateDownloadScreens();
 const enabled=db.providers.filter(p=>p.enabled);
 if(!enabled.length)throw new AppError('noSources');
 const target=Math.min(db.settings.batch,needed),attempted=new Set();
 const maxAttempts=Math.max(96,target*32),maxPages=32;
 let downloaded=0,rejected=0,deferred=0,stopReason='',failure='';
 job.target=target;job.downloaded=0;
 const room=()=>downloaded<target&&pendingCapacity(db)>0&&!stopReason;
 const consume=async candidates=>{
  job.total+=candidates.length;
  for(const x of candidates){
   if(!room())break;
   signal.throwIfAborted();
   if(job.automatic&&guard.code!=='idle')throw new AppError('waitIdle');
   if(attempted.has(x.id)||!db.providers.some(p=>p.id===x.provider&&p.enabled))continue;
   if(attempted.size>=maxAttempts){stopReason='searchLimited';break;}
   attempted.add(x.id);x.vote??=null;
   if(!db.items.some(y=>y.id===x.id))db.items.push(x);
   await save();
   if(await download(x,signal)){downloaded++;job.downloaded=downloaded;}
   else if(x.aiScreening?.rejected)rejected++;
   else if(['aiDeferred','aiPreviewUnavailable'].includes(x.error)){deferred++;if(aiSession?.closed||['lowMemory','aiPaused'].includes(x.aiDeferredReason))stopReason='aiDeferred';}
   else if(x.error&&!['duplicateImage','portraitSkipped','notAvailable'].includes(x.error))failure=x.error;
   if(x.error==='diskLimit')stopReason='diskLimit';
   job.done++;
  }
 };
 await consume(db.items.filter(x=>!screenedOut(x)&&!x.downloaded&&!['ban','dislike'].includes(x.vote)&&allowed(x,db.settings)));
 db.searchState??={};db.pages??={};
 const sources=enabled.map(p=>{
  const settings={...db.settings,tags:Math.random()<db.settings.diversity/100?[]:db.settings.tags};
  const signature=JSON.stringify([p.type,p.url,p.folder,p.rating,settings.tags,settings.excludedTags,settings.purity,settings.period,settings.language]);
  const previous=db.searchState[p.id];
  const cursor=previous?.signature===signature?previous:{signature,page:0};db.searchState[p.id]=cursor;
  return {p,settings,cursor,page:cursor.page+1,paged:['wallhaven','nasa','commons','local'].includes(p.type),seenPages:new Set(),empty:0,wrapped:false,done:false,count:0};
 });
 for(let round=0;room()&&sources.some(s=>!s.done)&&round<maxPages;round++){
  const pages=[],candidates=[],queued=new Set();
  for(const s of sources){
   if(!db.providers.some(p=>p.id===s.p.id&&p.enabled))s.done=true;
   if(s.done)continue;
   signal.throwIfAborted();
   if(s.seenPages.has(s.page)){s.done=true;s.cursor.page=0;continue;}
   s.seenPages.add(s.page);
   providerStatus[s.p.id]={code:'searching',time:Date.now()};
   try{
    const list=await searchProvider(s.p,s.settings,keys[s.p.id],signal,s.page);
    const known=new Set(db.items.map(x=>x.id));
    const fresh=list.filter(x=>!known.has(x.id)&&!skipDownload(x)&&!attempted.has(x.id)&&!queued.has(x.id)&&allowed(x,db.settings)&&orientationAllowed(x));
    for(const x of fresh){queued.add(x.id);candidates.push(x);}
    s.count+=fresh.length;
    providerStatus[s.p.id]={code:s.count?'found':'noNew',count:s.count,time:Date.now(),periodSupported:s.p.type==='wallhaven'};
    event(fresh.length?'found':'noNew',{provider:s.p.name,count:fresh.length});
    pages.push({s,page:s.page,fresh});
    if(!s.paged)s.done=true;
    if(list.length||list.hasMore)s.empty=0;else s.empty++;
    const emptyLimit=s.p.type==='wallhaven'?Math.max(1,s.settings.tags.length):1;
    if(s.empty>=emptyLimit){
     // A saved cursor can outlive a changed catalogue: wrap during this click.
     if(!s.wrapped&&s.cursor.page>0){s.wrapped=true;s.page=1;s.empty=0;}
     else{s.done=true;s.cursor.page=0;}
    }else s.page++;
   }catch(e){
    if(signal.aborted)throw e;
    failure=errorCode(e,'sourceUnavailable');s.done=true;
    providerStatus[s.p.id]={code:failure,time:Date.now()};event(failure,{provider:s.p.name});
   }
  }
  await consume(rankCandidates(candidates,db));
  for(const {s,page,fresh} of pages){
   // Do not lose the rest of a page when the requested batch is already full.
   if(fresh.some(x=>!attempted.has(x.id)))s.cursor.page=page-1;
   else if(!s.done&&!s.wrapped)s.cursor.page=page;
   else if(s.wrapped&&s.page!==1&&!s.done)s.cursor.page=page;
   db.pages[s.p.id]=s.cursor.page;
  }
  if(round===maxPages-1&&room()&&sources.some(s=>!s.done))stopReason='searchLimited';
 }
 const reason=stopReason||failure||(deferred?'aiDeferred':rejected?'aiFiltered':'sourceEmpty');
 db.lastRefresh=Date.now();db.lastRefreshDownloaded=downloaded;db.lastRefreshTarget=target;db.lastRefreshReason=reason;
 db.lastRefreshOutcome=downloaded>=target?'poolUpdated':downloaded?'poolPartial':reason;
 // Recovered per-image/network failures stay in the journal, not as a false
 // global error after a successful batch. A full disk still requires attention.
 if(downloaded&&stopReason!=='diskLimit')lastError=null;
 event(db.lastRefreshOutcome,{count:downloaded,target,reason});
}
function trimAIRejections(){const candidates=db.items.filter(x=>!x.downloaded&&!x.vote&&x.aiScreening?.rejected&&!x.maintenanceQuarantine&&!x.cleanupRemoved).sort((a,b)=>b.aiScreening.time-a.aiScreening.time);if(candidates.length>500){const remove=new Set(candidates.slice(500).map(x=>x.id));db.items=db.items.filter(x=>!remove.has(x.id));}}
function currentTasteProfile(){const signature=tasteSignature(db.items);if(profileCache?.signature!==signature)profileCache=tasteProfile(db.items);return profileCache;}
function getAISession(signal){
 if(db.settings.ai==='off')throw new AppError('aiOff');
 if(os.totalmem()<8*1024**3||os.freemem()<3*1024**3)throw new AppError('lowMemory');
 if(['fullscreen','blockedProcess','onBattery','screenLocked','systemBusy'].includes(guard.code))throw new AppError('aiPaused');
 if(!aiSession)aiSession=new AISession(dir,{signal,mode:db.settings.ai,onEvent:code=>event(code),allowed:()=>db.settings.ai!=='off'&&!['fullscreen','blockedProcess','onBattery','screenLocked','systemBusy'].includes(guard.code)});
 return aiSession;
}
function screenedOut(x){return !x.downloaded&&x.aiScreening?.rejected&&db.settings.ai!=='off'&&db.settings.aiFilter!=='off'&&x.aiScreening.mode===db.settings.aiFilter&&x.aiScreening.signature===currentTasteProfile().signature;}
async function screenBeforeDownload(x,signal){
 if(x.downloaded||db.settings.ai==='off'||db.settings.aiFilter==='off')return true;
 delete x.aiDeferredReason;const profile=currentTasteProfile(),mode=db.settings.aiFilter;
 if(screenedOut(x))return false;
 let embedding=x.embedding;
 if(!validEmbedding(embedding)||x.embeddingVersion!==embeddingVersion){
  if(!x.preview&&!x.localSource){event('aiPreviewUnavailable',{item:x.title});if(mode==='strict')x.error='aiPreviewUnavailable';return mode!=='strict';}
  event('aiScreening',{item:x.title});
  try{
   let bytes;
   if(x.localSource){const p=db.providers.find(p=>p.id===x.provider),real=await fs.realpath(x.localSource),base=await fs.realpath(p.folder);if(!real.startsWith(base+path.sep))throw new AppError('unsafeURL');bytes=await(await sharpModule())(real,{limitInputPixels:64000000,animated:false}).resize(512,512,{fit:'inside',withoutEnlargement:true}).jpeg().toBuffer();}
   else bytes=await fetchBytes(x.preview,{limit:2*1024**2,signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
   const result=await getAISession(signal).request({id:x.id,bytes:bytes.toString('base64'),titles:false});
   if(!validEmbedding(result.embedding))throw new AppError('aiUnavailable');
   x.embedding=embedding=result.embedding;x.embeddingVersion=result.embeddingVersion;
  }catch(e){if(signal.aborted)throw e;if(e.code==='unsafeURL')throw e;event('aiDeferred',{item:x.title});x.error='aiDeferred';x.aiDeferredReason=errorCode(e,'aiUnavailable');return false;}
 }
 const verdict=assessTaste(embedding,profile,mode);
 x.aiScreening={...verdict,mode,signature:profile.signature,time:Date.now()};
 if(verdict.rejected){x.error=null;event('aiRejected',{item:x.title});return false;}
 if(verdict.reason==='learning')event('aiFilterLearning');
 return true;
}
async function download(x,signal,manual=false){if(!x.downloaded&&!db.providers.some(p=>p.id===x.provider&&p.enabled))return false;if(!x.downloaded&&!x.vote&&pendingCapacity(db)===0){event('poolReady');return false;}job.item=x.title;job.provider=x.provider;job.bytes=0;job.itemTotal=0;try{await enrich(x,keys[x.provider],signal);const sourceProvider=db.providers.find(p=>p.id===x.provider);if(sourceProvider?.type==='local'&&!x.localSource){const match=(await searchProvider(sourceProvider,db.settings,null,signal)).find(y=>y.id===x.id);if(!match)throw new AppError('notAvailable');x.localSource=match.localSource;}if(!allowed(x,db.settings))throw new AppError('notAvailable');if(!manual&&!await screenBeforeDownload(x,signal)){await save();return false;}if(!await prepareOrientation(x,signal)){if(!x.downloaded){rememberSkipped({...x,error:'portraitSkipped'});db.items=db.items.filter(y=>y.id!==x.id);}event('portraitSkipped',{item:x.title});await save();return false;}if(x.localSource){const p=db.providers.find(p=>p.id===x.provider);const real=await fs.realpath(x.localSource),base=await fs.realpath(p.folder);if(!real.startsWith(base+path.sep))throw new AppError('unsafeURL');}Object.assign(x,await downloadImage(dir,x,{...db.settings,allowPortrait:hasPortraitScreen(monitors,desktop)},signal,(bytes,total)=>{job.bytes=bytes;job.itemTotal=total;},db.items));x.error=null;delete x.cachePurged;event('downloaded',{item:x.title});await save();return true;}catch(e){if(signal.aborted)throw e;x.error=errorCode(e,'downloadFailed');if(!x.downloaded&&['duplicateImage','portraitSkipped'].includes(x.error)){rememberSkipped(x,e.duplicateId);}if(x.error==='duplicateImage'||x.error==='portraitSkipped'&&!x.downloaded)db.items=db.items.filter(y=>y.id!==x.id);event(x.error,{item:x.title});await save();return false;}}
async function updateGuard(){try{const a=await activity();const blocked=a.processes.some(p=>db.settings.pauseProcesses.some(v=>v.toLowerCase()===p.toLowerCase()));const old=guard;guard={...a,freeMemory:os.freemem(),locked:desktopContext.locked,code:!a.supported?'windowsUnavailable':desktopContext.locked?'screenLocked':a.fullscreen?'fullscreen':blocked?'blockedProcess':db.settings.pauseOnBattery&&a.onBattery?'onBattery':a.cpuLoad==null?(a.idle<120000?'active':'idle'):(resourceAvailability(a,os.freemem(),os.totalmem()).ready?'idle':'systemBusy')};if(old.fullscreen&&!a.fullscreen&&db.settings.changeAfterFullscreen)queueTrigger('fullscreen');if(job?.automatic&&guard.code!=='idle')controller?.abort();if(confirmShows(db,guard)){syncShownCleanup(db);await save();}}catch{guard={idle:0,code:'guardUnavailable'};if(job?.automatic)controller?.abort();}}
function queueTrigger(reason){if(!db.rotationTriggers.includes(reason))db.rotationTriggers.push(reason);}
async function indexCached(signal){const items=db.items.filter(x=>x.downloaded&&!x.visualHash&&!x.fingerprintError).slice(0,8);job.total=items.length;for(const x of items){signal.throwIfAborted();if(guard.code!=='idle')throw new AppError('waitIdle');try{const fingerprint=await visualFingerprint(await fs.readFile(imagePath(dir,x)));Object.assign(x,fingerprint,{hash:x.hash||fingerprint.hash});}catch(e){if(signal.aborted)throw e;x.fingerprintError=true;event('invalidImage');}job.done++;await save();}}
await updateGuard();setInterval(updateGuard,10000).unref();
if(db.settings.changeOnStartup)queueTrigger('startup');
setInterval(async()=>{try{const next=await listMonitors(),added=next.filter(m=>!monitors.some(old=>old.id===m.id));monitors=next;if(db.workMode&&!job&&added.length)start('apply',async()=>{for(const m of added)await applyMonitor(path.join(dir,'work-neutral.jpg'),m.id);});}catch{}},60000).unref();
async function ai(signal){
 if(db.settings.ai==='off')throw new AppError('aiOff');if(guard.code!=='idle')throw new AppError('waitIdle');
 const items=db.items.filter(x=>x.downloaded&&x.vote!=='ban'&&allowed(x,db.settings)&&(!validEmbedding(x.embedding)||x.embeddingVersion!==embeddingVersion)).sort((a,b)=>Number(['like','dislike'].includes(b.vote))-Number(['like','dislike'].includes(a.vote))).slice(0,8);
 if(!items.length)throw new AppError('nothingToAnalyze');job.total=items.length;
 const session=getAISession(signal);
 for(const x of items){signal.throwIfAborted();if(guard.code!=='idle'||Date.now()-job.started>180000)throw new AppError('aiPaused');const result=await session.request({id:x.id,embedding:x.embeddingVersion===embeddingVersion?x.embedding:undefined});if(!validEmbedding(result.embedding))throw new AppError('aiUnavailable');x.embedding=result.embedding;x.embeddingVersion=result.embeddingVersion;job.done++;}
}
async function ensureDesktopBackup(){if(backup)return;const info=await desktopInfo();if(!info)throw new AppError('windowsUnavailable');const screens=await listMonitors();const originals=[];for(const [i,m]of screens.entries()){let file='';if(m.wallpaper){const meta=await (await sharpModule())(m.wallpaper).metadata();file=path.join(dir,'original-wallpaper-'+i+'.'+(meta.format==='jpeg'?'jpg':meta.format));await fs.copyFile(m.wallpaper,file);}originals.push({id:m.id,wallpaper:file});}let file='';if(info.wallpaper){const meta=await (await sharpModule())(info.wallpaper).metadata();file=path.join(dir,'original-wallpaper.'+(meta.format==='jpeg'?'jpg':meta.format));await fs.copyFile(info.wallpaper,file);}backup={wallpaper:file,monitors:originals,time:Date.now()};await atomic(path.join(dir,'desktop-before-wallbloom.json'),backup);}
function monitorSettings(id){const base=visibleSettings(db),m=db.settings.monitors[id],screen=monitors.find(x=>x.id===id);if(!m)return {...base,...screen&&{width:screen.width,height:screen.height}};return {...base,...m,purity:db.workMode?'100':m.purity.split('').map((v,i)=>v==='1'&&base.purity[i]==='1'?'1':'0').join(''),...screen&&{width:screen.width,height:screen.height}};}
async function apply(x,monitorId){const targets=monitorId?monitors.filter(m=>m.id===monitorId):monitors.length?monitors:[{id:'desktop',width:db.settings.width,height:db.settings.height}];if(!targets.length)throw new AppError('monitorDisconnected');if(!x?.downloaded||['ban','dislike'].includes(x.vote)||targets.some(m=>!allowed(x,m.id==='desktop'?visibleSettings(db):monitorSettings(m.id))))throw new AppError('notAvailable');await ensureDesktopBackup();for(const m of targets){const settings=m.id==='desktop'?visibleSettings(db):monitorSettings(m.id);const file=await renderDesktop(dir,x,settings,m.id,m.width,m.height);try{if(m.id==='desktop')await applyWallpaper(file);else await applyMonitor(file,m.id);}catch(e){if(!Object.values(db.renderedCurrent).includes(path.basename(file)))await fs.rm(file,{force:true});throw e;}const previous=db.renderedCurrent[m.id];db.renderedCurrent[m.id]=path.basename(file);db.monitorCurrent[m.id]=x.id;db.monitorLastRotation[m.id]=Date.now();db.exposures[m.id]={id:x.id,since:Date.now(),counted:false};db.current=x.id;db.lastRotation=Date.now();await save();if(previous&&previous!==path.basename(file)&&renderedName.test(previous)&&!Object.values(db.renderedCurrent).includes(previous))await fs.rm(path.join(dir,'rendered',previous),{force:true}).catch(()=>{});}x.rotationCount=(x.rotationCount||0)+1;await mutateLibrary(async()=>{await purgeRejectedFiles(dir,db);for(const id of new Set(db.items.filter(x=>x.sourceRemoved&&!x.vote&&x.downloaded).map(x=>x.provider)))await removeProviderCopies(dir,db,id);syncShownCleanup(db);used=await usage(dir);await save();});event('applied',{item:x.title});}
async function rotate(all=true){if(db.workMode)return;let applied=false;if(monitors.length){for(const m of monitors){const settings=monitorSettings(m.id);if(!all&&(!settings.rotation||Date.now()-(db.monitorLastRotation[m.id]||0)<settings.rotationMinutes*60000))continue;const x=chooseNext(db,settings,db.monitorCurrent[m.id]);if(x){await apply(x,m.id);applied=true;}else db.monitorLastRotation[m.id]=Date.now();}}else{const x=chooseNext(db);if(x){await apply(x);applied=true;}}if(!applied){db.lastRotation=Date.now();event('noAvailableWallpaper');await save();}}
async function workMode(enabled){if(typeof enabled!=='boolean')throw new AppError('invalidRequest');if(enabled===db.workMode)return;await ensureDesktopBackup();if(enabled){const previous=db.workMode;db.workMode=true;try{const neutral=path.join(dir,'work-neutral.jpg');await (await sharpModule())({create:{width:1920,height:1080,channels:3,background:'#203040'}}).jpeg().toFile(neutral);if(monitors.length){for(const m of monitors)await applyMonitor(neutral,m.id);}else await applyWallpaper(neutral);db.monitorCurrent={};db.current=null;db.exposures={};}catch(e){db.workMode=previous;throw e;}}else{db.workMode=false;await rotate();}await save();event(enabled?'workEnabled':'workDisabled');}
function rejectionTargets(id){
 if(db.workMode)return [];
 if(!monitors.length)return db.current===id?[{id:null,settings:visibleSettings(db)}]:[];
 const legacy=!Object.keys(db.monitorCurrent).length&&db.current===id;
 return monitors.filter(m=>legacy||db.monitorCurrent[m.id]===id).map(m=>({id:m.id,settings:monitorSettings(m.id)}));
}
async function replaceRejected(id,targets){
 for(const target of targets){const next=chooseNext(db,target.settings,id);if(next)await apply(next,target.id);else event('noAvailableWallpaper');}
}
async function cleanupCopies(items,rejected=false){
 return mutateLibrary(async()=>{try{const result=await purgeCopies(dir,db,items);if(rejected)result.removed+=await purgeRejectedFiles(dir,db);return result;}finally{syncCleanups();used=await usage(dir);await save();}});
}
function tick(){
 const now=new Date(),day=now.toLocaleDateString('en-CA');for(const time of db.settings.schedule){const stamp=day+' '+time;if(now.getHours()*60+now.getMinutes()===Number(time.slice(0,2))*60+Number(time.slice(3))&&db.scheduleStamp!==stamp){db.scheduleStamp=stamp;queueTrigger('schedule');}}
 if(job||mutating||shuttingDown||db.paused||Date.now()<nextRetry)return;
 const cleanup=dueCleanupCandidates(db);if(cleanup.length||rejectedCleanupCandidates(db).length){start('cleanup',()=>cleanupCopies(cleanup,true),true);return;}
 const due=db.rotationTriggers.length>0||db.settings.rotation&&Date.now()-db.lastRotation>db.settings.rotationMinutes*60000||monitors.some(m=>{const s=monitorSettings(m.id);return s.rotation&&Date.now()-(db.monitorLastRotation[m.id]||0)>s.rotationMinutes*60000;});
 if(due&&!db.workMode&&['active','idle'].includes(guard.code)){const triggered=db.rotationTriggers.length>0;db.rotationTriggers=[];start('apply',()=>rotate(triggered));return;}
 if(guard.code!=='idle')return;if(db.items.some(x=>x.downloaded&&!x.visualHash&&!x.fingerprintError)){start('index',indexCached,true);return;}if(aiRequested){aiRequested=false;start('ai',ai);}else if(db.settings.autoRefresh&&Date.now()-db.lastRefresh>(db.items.filter(x=>x.downloaded&&!x.vote&&db.providers.some(p=>p.id===x.provider&&p.enabled)).length<db.settings.pendingTarget||staleItems(db).length?Math.min(db.settings.refreshMinutes,5):db.settings.refreshMinutes)*60000){start('refresh',refresh,true);}else if(db.settings.ai!=='off'&&db.items.some(x=>x.downloaded&&(!validEmbedding(x.embedding)||x.embeddingVersion!==embeddingVersion)&&x.vote!=='ban'&&allowed(x,db.settings)))start('ai',ai);}
setInterval(tick,15000).unref();
for(const x of db.items)if(!db.providers.some(p=>p.id===x.provider)&&x.localSource)x.sourceType='local';
for(const id of new Set(db.items.map(x=>x.provider).filter(id=>id&&!db.providers.some(p=>p.id===id))))await removeProviderCopies(dir,db,id);
await purgeRejectedFiles(dir,db);syncCleanups();used=await usage(dir);await save();
const token=randomBytes(24).toString('hex'),port=Number(process.env.WALLBLOOM_PORT||43198);let host=`127.0.0.1:${port}`;
async function body(req,limit=65536){let bytes=0,chunks=[];for await(const c of req){bytes+=c.length;if(bytes>limit)throw new AppError('invalidRequest');chunks.push(c);}try{const value=JSON.parse(Buffer.concat(chunks).toString());if(!value||typeof value!=='object'||Array.isArray(value))throw new AppError('invalidRequest');return value;}catch{throw new AppError('invalidRequest');}}
function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const server=http.createServer(async(req,res)=>{let ownsMutation=false;try{
 if(req.headers.host!==host){send(res,403,{error:'invalidRequest'});return;}const u=new URL(req.url,`http://${host}`);const url=u.pathname;
 res.setHeader('Cross-Origin-Resource-Policy','same-origin');
 const privateRead=url.startsWith('/api/')||['/image/','/full-preview/','/frame-preview/'].some(prefix=>url.startsWith(prefix));
 if(privateRead&&(req.headers.origin&&req.headers.origin!==`http://${host}`||req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))){send(res,403,{error:'invalidRequest'});return;}
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");
 if(req.method==='GET'&&(url==='/api/state'||url==='/api/desktop-state')){if(req.headers['sec-fetch-site']==='cross-site'){send(res,403,{error:'invalidRequest'});return;}send(res,200,url==='/api/state'?state():desktopState());return;}
 if(req.method==='POST'&&url.startsWith('/api/')){if(req.headers['x-wallbloom-token']!==token||req.headers.origin&&req.headers.origin!==`http://${host}`){send(res,403,{error:'invalidRequest'});return;}const b=await body(req,url==='/api/settings'?16*1024*1024:65536);if(url==='/api/pause'){if(typeof b.paused!=='boolean')throw new AppError('invalidRequest');db.paused=b.paused;if(db.paused){controller?.abort();aiRequested=false;}event(db.paused?'pausedByUser':'resumed');await save();send(res,200,{ok:true});return;}if(url==='/api/wallhaven-account'){await openWallhavenAccount();send(res,200,{ok:true});return;}if(url==='/api/cancel'){aiRequested=false;controller?.abort();send(res,200,{ok:true});return;}if(url==='/api/desktop-context'){desktopContext={locked:b.locked===true};if(b.trigger==='wake'&&db.settings.changeOnWake)queueTrigger('wake');if(b.shortcuts&&typeof b.shortcuts==='object')shortcutStatus=b.shortcuts;await updateGuard();send(res,200,{ok:true});return;}if(mutating||job&&['export','import','cleanup'].includes(job.kind))throw new AppError('busy');mutating=true;ownsMutation=true;
 if(url==='/api/cleanup-preview'){try{const preview=cleanupConfirmations.prepare(db,b,randomUUID());send(res,200,preview);return;}catch(e){throw new AppError(e.message);}}
 else if(url==='/api/cleanup'){if(job)throw new AppError('busy');let items;try{items=cleanupConfirmations.consume(db,b.ticket);}catch(e){throw new AppError(e.message);}const result=await cleanupCopies(items);send(res,200,result);return;}
 else if(url==='/api/settings'){db.settings=validate(b);syncCleanups();if(db.settings.ai==='off')aiRequested=false;db.pages={};await save();}
 else if(url==='/api/provider'){const existing=db.providers.find(p=>p.id===b.id);if(existing){for(const x of db.items.filter(x=>x.provider===existing.id)){x.providerName=existing.name;x.sourceType=existing.type;}if((b.remove||b.enabled===false)&&job?.provider===existing.id)controller?.abort();}if(b.remove){if(existing){await mutateLibrary(()=>removeProviderCopies(dir,db,existing.id));db.providers=db.providers.filter(p=>p.id!==existing.id);}delete keys[b.id];}else{const p=validateProvider({...existing,...b,id:existing?.id||randomUUID().replaceAll('-','')});delete p.apiKey;delete p.remove;if(!['safe','suggestive','adult'].includes(p.rating||'safe'))throw new AppError('invalidProvider');if(existing)Object.assign(existing,p);else db.providers.push(p);if(typeof b.apiKey==='string'&&b.apiKey.trim())keys[p.id]=b.apiKey.trim();if(b.clearKey)delete keys[p.id];}await persist(path.join(dir,'credentials.json'),keys);await save();}
 else if(url==='/api/refresh')start('refresh',refresh);
 else if(url==='/api/retry-pending')start('download',async signal=>{await updateDownloadScreens();const items=db.items.filter(x=>!screenedOut(x)&&!x.downloaded&&!['dislike','ban'].includes(x.vote)&&allowed(x,db.settings)&&db.providers.some(p=>p.id===x.provider&&p.enabled));job.total=items.length;for(const x of items){signal.throwIfAborted();if(pendingCapacity(db)===0)break;await download(x,signal);job.done++;}});
 else if(url==='/api/ai'){if(db.settings.ai==='off')throw new AppError('aiOff');aiRequested=true;event('aiQueued');}
 else if(url==='/api/vote'){const x=db.items.find(x=>x.id===b.id);if(!x||![null,'like','dislike','ban','neutral','deferred'].includes(b.vote))throw new AppError('invalidRequest');const returning=b.vote===null&&['neutral','deferred'].includes(x.vote);await mutateLibrary(async()=>{await changeVote(dir,x,b.vote);if(['ban','dislike'].includes(b.vote)){x.rejectedAt??=Date.now();}else delete x.rejectedAt;if(b.vote!==null&&x.downloaded)rememberReview(db,x.id,b.reviewedAt);if(returning){x.reviewReturnedAt=Date.now();db.items=db.items.filter(y=>y.id!==x.id);db.items.push(x);}else delete x.reviewReturnedAt;await purgeRejectedFiles(dir,db);used=await usage(dir);await save();});const targets=rejectionTargets(x.id);if(['ban','dislike'].includes(b.vote)&&targets.length){if(job)await replaceRejected(x.id,targets);else start('apply',()=>replaceRejected(x.id,targets));}}
 else if(url==='/api/download'){const x=db.items.find(x=>x.id===b.id);if(!x||!allowed(x,db.settings)||['ban','dislike'].includes(x.vote)||!db.providers.find(p=>p.id===x.provider)?.enabled)throw new AppError('notAvailable');start('download',async signal=>{await updateDownloadScreens();await download(x,signal,true);});}
 else if(url==='/api/frame'){const x=db.items.find(x=>x.id===b.id);if(!x?.downloaded||!libraryVisible(x)||['ban','dislike'].includes(x.vote))throw new AppError('notAvailable');const id=b.monitorId||'*';if(id!=='*'&&!monitors.some(m=>m.id===id)&&!Object.hasOwn(db.settings.monitors,id))throw new AppError('monitorDisconnected');if(b.reset===true){if(x.frames){if(Object.hasOwn(x.frames,id))delete x.frames[id];else delete x.frames['*'];}await save();send(res,200,{ok:true});return;}const frame=validateFrame(b.frame);if(b.scope==='monitor'){if(id==='*')db.settings.frame=frame;else{const m=db.settings.monitors[id]||{rotation:db.settings.rotation,rotationMinutes:db.settings.rotationMinutes,purity:db.settings.purity,tags:db.settings.tags};db.settings.monitors[id]={...m,frame};}}else{x.frames??={};x.frames[id]=frame;}await save();event('frameSaved');}
 else if(url==='/api/apply'){const x=db.items.find(x=>x.id===b.id);if(job)await apply(x,b.monitorId);else start('apply',()=>apply(x,b.monitorId));}
 else if(url==='/api/next'){if(job)await rotate();else start('apply',()=>rotate());}
 else if(url==='/api/work'){if(job)await workMode(b.enabled);else start('apply',()=>workMode(b.enabled));}
  else if(url==='/api/export'){if(typeof b.folder!=='string')throw new AppError('invalidArchive');start('export',async()=>{await writes;exportPath=await exportLibrary(dir,db,b.folder);event('exportFinished');});}
 else if(url==='/api/import'){if(typeof b.folder!=='string')throw new AppError('invalidArchive');start('import',async()=>{await writes;const result=await restoreLibrary(dir,b.folder);db=result.state;rollbackPath=result.rollback;syncCleanups();await save();event('importFinished');});}
 else if(url==='/api/restore'){if(!backup)throw new AppError('notAvailable');start('apply',async()=>{if(backup.monitors?.length){for(const m of backup.monitors)if(monitors.some(x=>x.id===m.id))await applyMonitor(m.wallpaper,m.id);}else await applyWallpaper(backup.wallpaper);db.current=null;db.monitorCurrent={};db.exposures={};db.workMode=false;db.settings.rotation=false;for(const m of Object.values(db.settings.monitors))m.rotation=false;await save();event('restored');});}
 else{send(res,404,{error:'notFound'});return;}send(res,200,{ok:true});return;}
 if(req.method!=='GET'){send(res,405,{error:'invalidRequest'});return;}
 if(url.startsWith('/full-preview/')){if(req.headers['sec-fetch-site']==='cross-site')throw new AppError('invalidRequest');const id=decodeURIComponent(url.slice(14)),x=db.items.find(x=>x.id===id&&x.downloaded&&libraryVisible(x));if(!x)throw new AppError('notAvailable');const file=await frameSource(dir,x),sharp=await sharpModule(),meta=await sharp(file,{limitInputPixels:64000000,animated:false}).metadata(),mime={jpeg:'image/jpeg',png:'image/png',webp:'image/webp',avif:'image/avif'}[meta.format];if(!mime)throw new AppError('invalidImage');res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await fs.readFile(file));return;}
 if(url.startsWith('/frame-preview/')){if(req.headers['sec-fetch-site']==='cross-site')throw new AppError('invalidRequest');const id=decodeURIComponent(url.slice(15)),x=db.items.find(x=>x.id===id);if(!x?.downloaded||!libraryVisible(x)||['ban','dislike'].includes(x.vote))throw new AppError('notAvailable');const monitorId=u.searchParams.get('monitorId')||'',screen=monitors.find(m=>m.id===monitorId);if(monitorId&&!screen)throw new AppError('monitorDisconnected');const frame=validateFrame({fit:u.searchParams.get('fit')||'cover',x:Number(u.searchParams.get('x')??.5),y:Number(u.searchParams.get('y')??.5),flip:u.searchParams.get('flip')==='true'});const width=screen?.width||db.settings.width,height=screen?.height||db.settings.height,scale=Math.min(1,960/width,640/height),bytes=await renderFrame(await frameSource(dir,x),Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)),frame,85);res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store'});res.end(bytes);return;}
 let file;if(url.startsWith('/image/')){const id=url.slice(7);const x=db.items.find(x=>x.id===id&&x.downloaded&&libraryVisible(x));if(!x){send(res,404,{error:'notFound'});return;}file=path.join(dir,'thumbnails',x.id+'.jpg');if(x.thumbnailVersion!==2){const sharp=await sharpModule();const bytes=await sharp(await frameSource(dir,x)).rotate().resize(1280,800,{fit:'inside',withoutEnlargement:true}).jpeg({quality:92}).toBuffer();await fs.writeFile(file,bytes);x.thumbnailVersion=2;}res.setHeader('Content-Type','image/jpeg');}else{const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/i18n.js':'i18n.js','/frame-editor.js':'frame-editor.js','/provider-catalog.js':'provider-catalog.js','/wallpaper-source.js':'wallpaper-source.js','/review-state.js':'review-state.js','/tag-input.js':'tag-input.js','/tag-editor.js':'tag-editor.js','/show-cleanup.js':'show-cleanup.js','/cleanup-dialog.js':'cleanup-dialog.js','/shortcut-input.js':'shortcut-input.js','/redesign.js':'redesign.js','/redesign.css':'redesign.css'};if(!files[url]){send(res,404,{error:'notFound'});return;}file=path.join(root,'public',files[url]);res.setHeader('Content-Type',url.endsWith('.js')?'text/javascript; charset=utf-8':url.endsWith('.css')?'text/css':'text/html; charset=utf-8');}res.setHeader('Cache-Control','no-store');res.end(await fs.readFile(file));
 }catch(e){send(res,e.code==='ENOENT'?404:400,{error:e instanceof AppError?e.code:'operationFailed'});}finally{if(ownsMutation)mutating=false;}});
server.listen(port,'127.0.0.1',()=>{host=`127.0.0.1:${server.address().port}`;console.log(`WallWave: http://${host}`);process.send?.({type:'ready',port:server.address().port});});
async function shutdown(){if(shuttingDown)return;shuttingDown=true;controller?.abort();aiRequested=false;await activeTask;await save();server.close(()=>process.exit(0));server.closeAllConnections();setTimeout(()=>process.exit(0),3000).unref();}
for(const name of ['SIGINT','SIGTERM'])process.on(name,shutdown);
if(process.send){process.on('message',message=>{if(message?.type==='shutdown')shutdown();});process.on('disconnect',shutdown);}
