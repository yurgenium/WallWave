import {removeCached} from './library.mjs';

export function protectedCacheIds(db){return new Set([db.current,...Object.values(db.monitorCurrent||{}),...(db.recentReviews||[]).slice(0,3).map(x=>x.id)].filter(Boolean));}
async function clearItem(dir,item){
 await removeCached(dir,item);
 item.downloaded=false;item.hasOriginal=false;item.cachePurged=true;item.bytes=0;item.originalBytes=0;delete item.thumbnailVersion;
}
export async function purgeRejectedFiles(dir,db){
 const keep=protectedCacheIds(db);let removed=0;
 for(const item of db.items){if(!['ban','dislike'].includes(item.vote)||keep.has(item.id)||item.cachePurged&&!item.downloaded&&!item.hasOriginal)continue;const hadFile=item.downloaded||item.hasOriginal;await clearItem(dir,item);if(hadFile)removed++;}
 return removed;
}
export async function removeProviderCopies(dir,db,providerId){
 const keep=protectedCacheIds(db);
 for(const item of db.items){if(item.provider!==providerId)continue;item.sourceRemoved=true;if(!item.vote&&!keep.has(item.id))await clearItem(dir,item);}
}
export function rememberReview(db,id,time=Date.now()){
 const at=Math.max(Date.now()-300000,Math.min(Date.now(),Number(time)||Date.now()));
 db.recentReviews=[{id,time:at},...(db.recentReviews||[]).filter(x=>x.id!==id)].sort((a,b)=>b.time-a.time).slice(0,3);
}
