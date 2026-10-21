import {randomUUID} from 'node:crypto';
import {AppError} from './core.mjs';

export function collection(db,id){const c=(db.collections||[]).find(c=>c.id===id);if(!c)throw new AppError('collectionNotFound');return c;}
export function editCollection(db,{id,name,remove=false}){
 db.collections??=[];
 if(remove){collection(db,id);db.collections=db.collections.filter(c=>c.id!==id);if(db.rotationCollection===id)db.rotationCollection=null;return;}
 if(typeof name!=='string'||!name.trim()||name.trim().length>80||/[\x00-\x1f]/.test(name))throw new AppError('invalidCollectionName');name=name.trim();
 if(db.collections.some(c=>c.id!==id&&c.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new AppError('collectionNameExists');
 if(id){collection(db,id).name=name;return;}
 if(db.collections.length>=100)throw new AppError('collectionLimit');
 const c={id:randomUUID(),name,items:[],created:Date.now()};db.collections.push(c);return c;
}
export function setCollectionItem(db,{collectionId,itemId,add=true}){
 const c=collection(db,collectionId),item=db.items.find(x=>x.id===itemId);
 if(!item?.downloaded||['ban','dislike'].includes(item.vote))throw new AppError('notAvailable');
 c.items=add?[...new Set([...c.items,itemId])]:c.items.filter(id=>id!==itemId);
}
export function wallpaperSnapshot(db){return {current:db.current||null,monitors:{...db.monitorCurrent}};}
export function rememberWallpaper(db,before){
 const after=wallpaperSnapshot(db);if(JSON.stringify(before)===JSON.stringify(after)||!before.current&&!Object.values(before.monitors).some(Boolean))return;
 db.wallpaperHistory=[before,...(db.wallpaperHistory||[])].slice(0,50);
}
export function setWallpaperHold(db,{mode,minutes,until},now=Date.now()){
 if(mode==='clear'){db.wallpaperHold=null;db.rotationTriggers=[];return;}
 if(mode==='manual'){db.wallpaperHold={manual:true,since:now};return;}
 if(mode==='duration'){if(!Number.isInteger(minutes)||minutes<1||minutes>525600)throw new AppError('invalidHoldTime');until=now+minutes*60000;}
 else if(mode!=='until')throw new AppError('invalidHoldTime');
 if(!Number.isFinite(until)||until<=now||until>now+366*86400000)throw new AppError('invalidHoldTime');
 db.wallpaperHold={until,since:now};
}
export const holdActive=(db,now=Date.now())=>!!db.wallpaperHold&&(db.wallpaperHold.manual||db.wallpaperHold.until>now);
export function cancelRefresh(db,now=Date.now()){
 db.refreshResumeAt=now+(db.settings.cancelRefreshMinutes??60)*60000;db.refreshCancelled=true;
}
export const busyForAI=guard=>!guard||['fullscreen','blockedProcess','onBattery','screenLocked','systemBusy','guardUnavailable','checking','windowsUnavailable'].includes(guard.code);
