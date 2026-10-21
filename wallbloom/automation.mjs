import {allowed,score} from './core.mjs';
import {automaticSource} from './art-providers.mjs';
import {validEmbedding,embeddingVersion} from './visual-ai.mjs';

export function visibleSettings(db){return db.workMode?{...db.settings,purity:'100',preset:'safe'}:db.settings;}
export function eligible(db,settings=visibleSettings(db)){
 const members=db.rotationCollection?new Set(db.collections?.find(c=>c.id===db.rotationCollection)?.items||[]):null;
 return db.items.filter(x=>{if(members&&!members.has(x.id))return false;const rule=db.settings.cleanupAfterShows?.[x.vote||'pending'];return x.downloaded&&(members?.has(x.id)||!rule?.enabled||(x.showCount||0)<rule.shows)&&(members?.has(x.id)||x.vote||!db.providers||db.providers.some(p=>p.id===x.provider&&p.enabled))&&allowed(x,settings)&&!['ban','dislike'].includes(x.vote)&&(members||x.vote!=='deferred');});
}
export function chooseNext(db,settings=visibleSettings(db),current=db.current,random=Math.random){
 const items=eligible(db,settings).filter(x=>x.id!==current);
 if(!items.length)return null;
 // Use the least shown cohort first; persisted counters survive restarts.
 const playlist=db.rotationCollection?db.collections?.find(c=>c.id===db.rotationCollection):null;
 const seen=x=>playlist?(playlist.lastShown?.[x.id]||0):(x.rotationCount||0),least=Math.min(...items.map(seen));
 const pool=items.filter(x=>seen(x)===least);
 const diversity=settings.diversity/100;
 if(random()<diversity)return pool[Math.floor(random()*pool.length)];
 const rank=x=>score(x,db.items,settings)-Math.abs(Math.log(((x.originalWidth||x.width||settings.width)/(x.originalHeight||x.height||settings.height))/(settings.width/settings.height)))*3;
 const ranks=new Map(pool.map(x=>[x.id,rank(x)]));return pool.sort((a,b)=>ranks.get(b.id)-ranks.get(a.id)||(a.lastShown||0)-(b.lastShown||0))[0];
}
export function pendingCapacity(db){return db.settings.pendingTarget>0?Math.max(0,db.settings.pendingTarget-db.items.filter(x=>x.downloaded&&!x.vote&&(!db.providers||db.providers.some(p=>p.id===x.provider&&p.enabled))).length):Infinity;}
export function rankCandidates(items,db,random=Math.random){
 const ranked=items.map(x=>({x,rank:score(x,db.items,db.settings)})).sort((a,b)=>b.rank-a.rank||(a.x.size>0?a.x.size:Infinity)-(b.x.size>0?b.x.size:Infinity));
 const result=[];while(ranked.length){const i=random()<db.settings.diversity/100?Math.floor(random()*ranked.length):0;result.push(ranked.splice(i,1)[0].x);}return result;
}
export function staleItems(){return [];}
export function hamming(a,b){if(!/^[0-9a-f]{16}$/.test(a||'')||!/^[0-9a-f]{16}$/.test(b||''))return Infinity;let value=BigInt('0x'+a)^BigInt('0x'+b),n=0;while(value){value&=value-1n;n++;}return n;}
export function duplicateOf(candidate,items){return items.find(x=>x.id!==candidate.id&&(x.downloaded||x.cleanupRemoved||['ban','dislike'].includes(x.vote))&&((candidate.hash&&x.hash===candidate.hash)||(candidate.pixelHash&&x.pixelHash===candidate.pixelHash)||(hamming(x.visualHash,candidate.visualHash)<=5&&Math.abs((x.visualAspect||1)-(candidate.visualAspect||1))<.12&&sampleDistance(x.visualSample,candidate.visualSample)<9)));}
function sampleDistance(a,b){if(!a||!b||a.length!==b.length)return Infinity;const aa=Buffer.from(a,'hex'),bb=Buffer.from(b,'hex');return aa.reduce((n,v,i)=>n+Math.abs(v-bb[i]),0)/aa.length;}
export function confirmShows(db,guard,now=Date.now()){
 if(!['active','idle'].includes(guard.code)||guard.idle>=120000||guard.locked||guard.fullscreen){for(const exposure of Object.values(db.exposures||{}))if(!exposure.counted)exposure.since=now;return false;}
 let changed=false;const counted=new Set();for(const exposure of Object.values(db.exposures||{})){if(exposure.counted||now-exposure.since<30000)continue;const x=db.items.find(x=>x.id===exposure.id);if(x){if(!counted.has(x.id)){x.showCount=(x.showCount||0)+1;x.lastShown=now;counted.add(x.id);}exposure.counted=true;changed=true;}}return changed;
}
export function automationState(db,guard,{job,nextRetry,lastError,aiRequested},now=Date.now()){
 const one=(enabled,due,source=false)=>({code:!enabled?'automationOff':db.paused?'pausedByUser':source&&lastError&&nextRetry>now?'sourceRetry':job?'automationBusy':guard.code==='idle'?'scheduled':guard.code==='active'?'waitIdle':guard.code,nextAt:enabled?Math.max(due,nextRetry||0):null});
 const pending=db.items.filter(x=>x.downloaded&&!x.vote&&(!db.providers||db.providers.some(p=>p.id===x.provider&&p.enabled))).length,stale=staleItems(db).length,refresh=one(db.settings.autoRefresh,db.lastRefresh+(pending<db.settings.pendingTarget||stale?Math.min(db.settings.refreshMinutes,5):db.settings.refreshMinutes)*60000,true);if(refresh.code==='scheduled'&&db.lastRefreshOutcome==='sourceEmpty')refresh.code='sourceEmpty';
 if(db.settings.autoRefresh&&db.providers?.some(p=>p.enabled)&&!db.providers.some(automaticSource)){refresh.code='manualSourcesOnly';refresh.nextAt=null;}
 if(refresh.code==='scheduled'&&db.lastRefreshOutcome==='poolReady')refresh.code='poolReady';
 const analysis=one(db.settings.ai!=='off'||aiRequested,now);if(db.settings.ai!=='off'&&!aiRequested&&!db.items.some(x=>x.downloaded&&(!validEmbedding(x.embedding)||x.embeddingVersion!==embeddingVersion)&&x.vote!=='ban'&&allowed(x,db.settings))){analysis.code='nothingToAnalyze';analysis.nextAt=null;}
 if(db.refreshCancelled&&(db.refreshResumeAt||0)>now){refresh.code='refreshCancelledPause';refresh.nextAt=db.settings.autoRefresh?db.refreshResumeAt:null;}else if(refresh.nextAt)refresh.nextAt=Math.max(refresh.nextAt,db.refreshResumeAt||0);
 if(job?.kind==='refresh'){refresh.code='refreshJob';refresh.nextAt=null;if(['screening','modelLoading','modelDownloading'].includes(job.phase)){analysis.code=job.phase==='screening'?'previewScreening':job.phase;analysis.nextAt=null;}}if(job?.kind==='ai'){analysis.code=job.phase==='modelDownloading'?'modelDownloading':job.phase==='modelLoading'?'modelLoading':'aiJob';analysis.nextAt=null;}
 if(db.refreshCancelled&&(db.refreshResumeAt||0)>now&&db.settings.ai!=='off'&&!aiRequested&&analysis.code!=='nothingToAnalyze'){analysis.code='analysisCancelledPause';analysis.nextAt=db.refreshResumeAt;}
 const rules=Object.values(db.settings.monitors||{}),rotationEnabled=db.settings.rotation||rules.some(x=>x.rotation)||db.settings.changeOnStartup||db.settings.changeOnWake||db.settings.changeAfterFullscreen||db.settings.schedule.length>0;
 const scheduled=(db.settings.schedule||[]).map(time=>{const date=new Date(now);date.setHours(Number(time.slice(0,2)),Number(time.slice(3)),0,0);if(date.getTime()<=now)date.setDate(date.getDate()+1);return date.getTime();});
 const times=[...scheduled,db.settings.rotation?db.lastRotation+db.settings.rotationMinutes*60000:Infinity,...Object.entries(db.settings.monitors||{}).filter(([,m])=>m.rotation).map(([id,m])=>(db.monitorLastRotation?.[id]||0)+m.rotationMinutes*60000)],next=Math.min(...times);
 const held=db.wallpaperHold;
 return {refresh,analysis,rotation:{code:db.rotationPaused?'rotationPaused':held?(held.manual?'wallpaperHeldManual':'wallpaperHeld'):db.workMode?'workEnabled':!rotationEnabled?'automationOff':db.paused?'pausedByUser':guard.locked?'screenLocked':['active','idle'].includes(guard.code)?(Number.isFinite(next)?'rotationScheduled':'rotationOnEvent'):guard.code,nextAt:db.rotationPaused?null:held?(held.manual?null:held.until):Number.isFinite(next)?Math.max(next,now):null},pending,stale};
}
