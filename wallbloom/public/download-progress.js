const count=value=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
export function downloadProgress(job){
 if(job?.kind!=='refresh')return null;
 const target=count(job.target),downloaded=Math.min(target,count(job.downloaded));
 const ready=Math.min(target-downloaded,count(job.ready)),active=Math.min(ready,count(job.active));
 return {target,downloaded,prepared:downloaded+ready,active,waiting:ready-active};
}
export const progressText=(template,count,target)=>template.replace('{count}',String(count)).replace('{target}',String(target));
export function refreshSummary(state,t){
 if(state.job||!state.refreshOutcome||state.lastError?.time>(state.lastRefresh||0))return '';
 const parts=[t(state.refreshOutcome)];
 if(state.refreshTarget>0&&Number.isFinite(state.refreshDownloaded))parts.push(progressText(t('downloadedCount'),state.refreshDownloaded,state.refreshTarget));
 if(state.refreshReason&&(state.refreshOutcome==='poolPartial'||state.refreshOutcome==='poolUpdated'&&state.refreshReason==='reserveBatchLimited'))parts.push(t(state.refreshReason));
 return parts.join(' · ');
}
