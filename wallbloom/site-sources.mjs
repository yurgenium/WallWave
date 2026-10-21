import {AppError,safeId,contentMask} from './core.mjs';
import {checkURL,fetchJSON} from './network.mjs';

// A declarative connection description chooses fields; no downloaded scripts run.
const known=[
 ['bing.com','bing','Bing','none','https://www.bing.com'],
 ['images.nasa.gov','nasa','NASA Images','none','https://images.nasa.gov'],
 ['commons.wikimedia.org','commons','Wikimedia Commons','none','https://commons.wikimedia.org'],
 ['wallhaven.cc','wallhaven','Wallhaven','key','https://wallhaven.cc/settings/account'],
 ['deviantart.com','deviantart','DeviantArt','client','https://www.deviantart.com/studio/apps'],
 ['pixabay.com','pixabay','Pixabay','key','https://pixabay.com/api/docs/'],
 ['konachan.com','konachan','Konachan','none','https://konachan.com'],
 ['konachan.net','booru','Konachan.net','none','https://konachan.net'],
 ['rule34.xxx','booru','Rule34','userKey','https://rule34.xxx/index.php?page=account&s=options'],
 ['danbooru.donmai.us','booru','Danbooru','loginKey','https://danbooru.donmai.us/profile']
];
export function normalizeSite(value){
 if(typeof value!=='string'||!value.trim()||value.length>4096)throw new AppError('invalidProvider');value=value.trim();
 let u;try{u=new URL(value.includes('://')?value:'https://'+value);}catch{throw new AppError('invalidProvider');}
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')throw new AppError('invalidProvider');
 return u;
}
export function knownSite(value){
 const u=normalizeSite(value),host=u.hostname.replace(/^www\./,'');
 const row=known.find(([domain])=>host===domain||domain==='rule34.xxx'&&host==='api.rule34.xxx'||domain==='deviantart.com'&&host.endsWith('.deviantart.com'));
 if(!row)return null;const [domain,type,name,auth,help]=row;
 return {supported:true,type,name,auth,help,url:'https://'+(domain==='rule34.xxx'?'api.rule34.xxx':domain),engine:domain==='danbooru.donmai.us'?'danbooru':'gelbooru',known:true};
}
export function booruRecords(json){return Array.isArray(json)?json:Array.isArray(json?.post)?json.post:Array.isArray(json?.posts)?json.posts:null;}
const mediaURL=(value,base)=>{if(typeof value!=='string'||!value)return null;try{const u=new URL(value,base);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
export function parseBooru(json,p){
 const records=booruRecords(json);if(!records)throw new AppError('invalidFeed');
 return records.flatMap(x=>{const url=mediaURL(x.file_url||x.large_file_url,p.url);if(!x.id||!url||! /\.(?:jpe?g|png|webp|avif)(?:\?|$)/i.test(url))return [];
 const rating=({s:p.engine==='danbooru'?'suggestive':'safe',g:'safe',safe:'safe',general:'safe',sensitive:'suggestive',q:'suggestive',questionable:'suggestive',e:'adult',explicit:'adult'})[x.rating];if(!rating)return [];
 return [{id:safeId(p.id,String(x.id)),provider:p.id,sourceType:'booru',title:p.name+' '+x.id,url,preview:mediaURL(x.preview_file_url||x.preview_url||x.sample_url,p.url)||url,source:new URL(p.engine==='danbooru'?'posts/'+x.id:'index.php?page=post&s=view&id='+x.id,(new URL(p.url).hostname==='api.rule34.xxx'?'https://rule34.xxx/':p.url.replace(/\/$/,'')+'/')).href,tags:String(x.tag_string||x.tags||'').split(/\s+/).filter(Boolean).slice(0,1000),rating,width:Number(x.image_width||x.width)||0,height:Number(x.image_height||x.height)||0,size:Number(x.file_size)||0}];});
}
export function booruURL(p,{tag='',page=1,purity='100',limit=24,key}={}){
 const base=normalizeSite(p.url);let credentials={};if(key){try{credentials=JSON.parse(key);}catch{throw new AppError('sourceAuthFailed');}}
 const u=new URL(p.engine==='danbooru'?'posts.json':'index.php',base.href.replace(/\/$/,'')+'/');
 const term=tag.trim().replace(/\s+/g,'_'),ratings=purity==='100'?(p.engine==='danbooru'?'rating:g':'rating:safe'):purity==='110'?'-rating:explicit':purity==='001'?'rating:explicit':'';
 if(p.engine==='gelbooru')u.search=new URLSearchParams({page:'dapi',s:'post',q:'index',json:'1',limit:String(limit),pid:String(page-1),tags:[term,ratings].filter(Boolean).join(' ')});
 else u.search=new URLSearchParams({limit:String(limit),page:String(page),tags:[term,ratings].filter(Boolean).join(' ')});
 if(p.auth==='userKey'){if(!/^\d+$/.test(credentials.user_id||'')||!credentials.api_key)throw new AppError('apiKeyRequired');u.searchParams.set('user_id',credentials.user_id);u.searchParams.set('api_key',credentials.api_key);}
 if(p.auth==='loginKey'&&key){if(!credentials.login||!credentials.api_key)throw new AppError('sourceAuthFailed');u.searchParams.set('login',credentials.login);u.searchParams.set('api_key',credentials.api_key);}
 return u;
}
export async function searchBooru(p,s,key,signal,page=1,{request=fetchJSON}={}){
 const count=Math.max(1,s.tags.length),u=booruURL(p,{tag:s.tags[(page-1)%count]||'',page:Math.ceil(page/count),purity:contentMask(s),key});
 try{return parseBooru(await request(u,signal),p);}catch(e){if([401,403].includes(e.status))throw new AppError('sourceAuthFailed');throw e;}
}
export async function detectSite(value,{request=fetchJSON,check=checkURL,signal}={}){
 const u=normalizeSite(value);await check(u.href);const match=knownSite(u.href);if(match)return match;
 // A catalogue URL must actually return a catalogue. A page is never silently saved as one.
 try{const json=await request(u,signal);if(Array.isArray(json?.items)&&json.items.length<=500&&json.items.every(x=>x&&x.id&&typeof x.url==='string'&&Array.isArray(x.tags)&&['safe','suggestive','adult'].includes(x.rating)))return {supported:true,type:'feed',name:u.hostname,url:u.href,auth:'none',known:false};}catch(e){if(signal?.aborted)throw e;if([429,503].includes(e.status))return {supported:false,temporary:true,code:e.status===503?'sourceMaintenance':'rateLimited',url:u.origin};}
 const base=new URL(u.origin+'/');
 for(const engine of ['danbooru','gelbooru']){
  const p={type:'booru',id:'probe',url:base.href,engine,auth:'none',name:u.hostname};
  try{const json=await request(booruURL(p,{limit:1}),signal);const records=booruRecords(json);if(records&&records.length&&records.some(x=>x.id&&(x.file_url||x.large_file_url)&&typeof (x.tag_string||x.tags)==='string'))return {...p,supported:true,known:false};}catch(e){if(signal?.aborted)throw e;}
 }
 return {supported:false,url:u.origin};
}
