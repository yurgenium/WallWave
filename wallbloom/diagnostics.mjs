// No keys, URLs, image titles, tags, embeddings or personal source paths.
export function diagnosticsReport(db,{guard,job,lastError,events,network,version}){
 return {application:'WallWave',version,createdAt:new Date().toISOString(),paused:db.paused,
  library:{items:db.items.length,downloaded:db.items.filter(x=>x.downloaded).length,collections:(db.collections||[]).length},
  configuration:{ai:db.settings.ai,aiFilter:db.settings.aiFilter,batch:db.settings.batch,autoRefresh:db.settings.autoRefresh,cancelRefreshMinutes:db.settings.cancelRefreshMinutes},
  sources:db.providers.map(p=>({type:p.type,enabled:p.enabled})),
  guard:{code:guard.code,cpuLoad:guard.cpuLoad,gpuLoad:guard.gpuLoad,freeMemory:guard.freeMemory},
  job:job&&{kind:job.kind,phase:job.phase,downloaded:job.downloaded,target:job.target,started:job.started,modelDownload:job.modelDownload},
  lastError:lastError&&{code:lastError.code,time:lastError.time},network,
  recentEvents:events.slice(0,60).map(({code,time,count,kind})=>({code,time,count,kind})),
  refresh:{outcome:db.lastRefreshOutcome,downloaded:db.lastRefreshDownloaded,target:db.lastRefreshTarget,reason:db.lastRefreshReason,resumeAt:db.refreshResumeAt}};
}
