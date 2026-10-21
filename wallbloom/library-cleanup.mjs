import {tagIdentity} from './public/tag-input.js';
import {removeCached} from './library.mjs';

export function protectedCacheIds(db){return new Set([db.current,...Object.values(db.monitorCurrent||{}),...(db.recentReviews||[]).slice(0,3).map(x=>x.id)].filter(Boolean));}
async function clearItem(dir,item){
 await removeCached(dir,item);
 item.downloaded=false;item.hasOriginal=false;item.cachePurged=true;item.bytes=0;item.originalBytes=0;delete item.thumbnailVersion;
}
export const rejectedCleanupDelay=5*60000;
export function rejectedCleanupCandidates(db,now=Date.now()){
 const current=new Set([db.current,...Object.values(db.monitorCurrent||{})].filter(Boolean));
 return db.items.filter(item=>['ban','dislike'].includes(item.vote)&&(item.downloaded||item.hasOriginal)&&!current.has(item.id)&&now-(item.rejectedAt??db.recentReviews?.find(review=>review.id===item.id)?.time??0)>=rejectedCleanupDelay);
}
export async function purgeRejectedFiles(dir,db,now=Date.now()){
 let removed=0;const ids=new Set();
 for(const item of rejectedCleanupCandidates(db,now)){await clearItem(dir,item);ids.add(item.id);removed++;}
 db.recentReviews=(db.recentReviews||[]).filter(review=>!ids.has(review.id));
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

export const tagCleanupDelay=60000;
const tagKey=tags=>JSON.stringify([...new Set((tags||[]).map(tagIdentity).filter(Boolean))].sort());
export function matchesExcludedTags(item,tags){const excluded=new Set(JSON.parse(tagKey(tags)));return (item.tags||[]).some(t=>excluded.has(tagIdentity(t)));}
export function cleanupCandidates(db,scope){
 if(scope.kind==='provider'){
  const provider=db.providers.find(p=>p.id===scope.providerId);
  if(!provider||provider.enabled)throw Error('cleanupSourceEnabled');
 }else if(scope.kind!=='tags')throw Error('invalidRequest');
 const excluded=new Set(JSON.parse(tagKey(db.settings.excludedTags)));
 return db.items.filter(x=>(!x.cleanupRemoved||x.downloaded||x.hasOriginal)&&(scope.kind==='provider'?x.provider===scope.providerId:(x.tags||[]).some(t=>excluded.has(tagIdentity(t)))));
}
export function syncTagCleanup(db,now=Date.now()){
 const key=tagKey(db.settings.excludedTags),count=cleanupCandidates(db,{kind:'tags'}).length;
 const dueAt=count?(db.tagCleanup?.key===key&&db.tagCleanup.dueAt||now+tagCleanupDelay):null;
 db.tagCleanup={key,dueAt};return {count,dueAt};
}
export function shownCleanupCandidates(db){
 const previous=(db.wallpaperHistory||[]).slice(0,3).flatMap(h=>[h.current,...Object.values(h.monitors||{})]);
 const current=new Set([db.current,...Object.values(db.monitorCurrent||{}),...previous].filter(Boolean));
 const collected=new Set((db.collections||[]).flatMap(c=>c.items));
 return db.items.filter(item=>{const rule=db.settings.cleanupAfterShows?.[item.vote||'pending'];return item.downloaded&&!current.has(item.id)&&!collected.has(item.id)&&rule?.enabled&&(item.showCount||0)>=rule.shows;});
}
export function syncShownCleanup(db,now=Date.now()){
 const key=JSON.stringify(db.settings.cleanupAfterShows||{}),count=shownCleanupCandidates(db).length;
 const dueAt=count?(db.showCleanup?.key===key&&db.showCleanup.dueAt||now+tagCleanupDelay):null;
 db.showCleanup={key,dueAt};return {count,dueAt};
}
export function dueCleanupCandidates(db,now=Date.now()){
 const tags=db.tagCleanup?.dueAt&&db.tagCleanup.dueAt<=now?cleanupCandidates(db,{kind:'tags'}):[];
 const shown=db.showCleanup?.dueAt&&db.showCleanup.dueAt<=now?shownCleanupCandidates(db):[];
 return [...new Map([...tags,...shown].map(item=>[item.id,item])).values()];
}
export async function purgeCopies(dir,db,items){
 let removed=0,bytes=0;const ids=new Set();
 for(const item of items){if(item.cleanupRemoved&&!item.downloaded&&!item.hasOriginal)continue;const size=(item.bytes||0)+(item.originalBytes||0);await clearItem(dir,item);item.cleanupRemoved=true;ids.add(item.id);removed++;bytes+=size;}
 db.recentReviews=(db.recentReviews||[]).filter(x=>!ids.has(x.id));
 return {removed,bytes};
}

// Confirmation tickets are single use, expire after five minutes, and freeze the
// displayed scope so a newly downloaded image cannot be deleted without consent.
export class CleanupConfirmations{
 constructor(){this.tickets=new Map();}
 prepare(db,scope,id,now=Date.now()){
  for(const [key,value] of this.tickets)if(now-value.created>300000)this.tickets.delete(key);
  if(this.tickets.size>=100)this.tickets.delete(this.tickets.keys().next().value);
  const items=cleanupCandidates(db,scope);this.tickets.set(id,{scope:{...scope},ids:items.map(x=>x.id),created:now,tagKey:tagKey(db.settings.excludedTags)});
  return {ticket:id,count:items.length,waitMs:3000};
 }
 consume(db,id,now=Date.now()){
  const ticket=this.tickets.get(id);
  if(!ticket||now-ticket.created>300000)throw Error('cleanupExpired');
  if(now-ticket.created<3000)throw Error('cleanupWait');
  if(ticket.scope.kind==='tags'&&ticket.tagKey!==tagKey(db.settings.excludedTags))throw Error('cleanupExpired');
  const items=cleanupCandidates(db,ticket.scope),ids=new Set(ticket.ids);
  this.tickets.delete(id);return items.filter(x=>ids.has(x.id));
 }
}
