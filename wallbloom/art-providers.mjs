import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {safeId,AppError,contentMask} from './core.mjs';
import {fetchJSON} from './network.mjs';
import {persist} from './persistence.mjs';

const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,160);
const secure=(value,base)=>{const url=new URL(value,base);if(url.protocol!=='https:'||url.username||url.password)throw new AppError('unsafeURL');return url.href;};
const tagAt=(settings,page)=>settings.tags.length?settings.tags[(page-1)%settings.tags.length]:'';
const pageAt=(settings,page)=>Math.ceil(page/Math.max(1,settings.tags.length));
const cacheLifetime=24*60*60*1000;
export const automaticSource=p=>p.enabled&&p.type!=='pixabay';

// Each adapter supplies search, metadata and original-file URLs. The common
// downloader stores files; the same local CLIP profile screens every source.
export class ArtSources{
 constructor({request=fetchJSON,now=Date.now}={}){this.request=request;this.now=now;this.tokens=new Map();this.cache=new Map();}
 async token(key,signal,renew=false){
  if(!key)throw new AppError('apiKeyRequired');
  let credentials;try{credentials=JSON.parse(key);}catch{return key;}
  if(!credentials||typeof credentials!=='object')throw new AppError('sourceAuthFailed');
  if(typeof credentials.access_token==='string'&&!credentials.client_secret)return credentials.access_token;
  if(!/^\d{1,20}$/.test(credentials.client_id||'')||typeof credentials.client_secret!=='string'||!credentials.client_secret.trim())throw new AppError('sourceAuthFailed');
  const cached=this.tokens.get(key);if(!renew&&cached?.expires>this.now()+60000)return cached.value;
  const body=new URLSearchParams({grant_type:'client_credentials',client_id:credentials.client_id,client_secret:credentials.client_secret,scope:'browse'}).toString();
  let json;try{json=await this.request('https://www.deviantart.com/oauth2/token',signal,{method:'POST',body,headers:{'Content-Type':'application/x-www-form-urlencoded'}});}catch(e){if([400,401,403].includes(e.status))throw new AppError('sourceAuthFailed');throw e;}
  if(typeof json.access_token!=='string'||!json.access_token)throw new AppError('sourceAuthFailed');
  if(this.tokens.size>=64)this.tokens.clear();this.tokens.set(key,{value:json.access_token,expires:this.now()+Math.min(86400,Math.max(60,Number(json.expires_in)||3600))*1000});return json.access_token;
 }
 async da(endpoint,key,signal){
  for(let attempt=0;attempt<2;attempt++){
   const token=await this.token(key,signal,attempt>0);
   try{return await this.request(endpoint,signal,{headers:{Authorization:'Bearer '+token,'dA-minor-version':'20240701'}});}catch(e){if(e.status===401&&attempt===0&&key?.includes('client_secret'))continue;if([401,403].includes(e.status))throw new AppError('sourceAuthFailed');throw e;}
  }
 }
 async pixabay(url,key,signal,dir){
  const id=createHash('sha256').update(url.href).digest('hex'),base=new URL(url);base.searchParams.delete('page');const query=createHash('sha256').update(base.href).digest('hex'),file=dir&&path.join(dir,'provider-cache.json');
  if(!this.cache.has(file)){let data={};if(file)try{const parsed=JSON.parse(await fs.readFile(file,'utf8'));if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))data=Object.fromEntries(Object.entries(parsed).filter(([,x])=>x&&Number.isFinite(x.time)&&Array.isArray(x.data?.hits)));}catch{}this.cache.set(file,data);}
  const cache=this.cache.get(file),entry=cache[id],now=this.now();if(entry&&now>=entry.time&&now-entry.time<cacheLifetime)return entry.data;
  const known=Object.values(cache).find(x=>x.query===query&&now>=x.time&&now-x.time<cacheLifetime&&Number.isFinite(x.data.totalHits));if(known&&Number(url.searchParams.get('page'))>Math.ceil(known.data.totalHits/24))return {hits:[],totalHits:known.data.totalHits};
  let data;try{data=await this.request(url,signal);}catch(e){if([400,401,403].includes(e.status))throw new AppError('sourceAuthFailed');throw e;}
  if(!Array.isArray(data.hits))throw new AppError('invalidFeed');cache[id]={time:now,data,query};
  const entries=Object.entries(cache).filter(([,x])=>now>=x.time&&now-x.time<cacheLifetime).sort((a,b)=>b[1].time-a[1].time).slice(0,128);this.cache.set(file,Object.fromEntries(entries));if(file)await persist(file,this.cache.get(file));return data;
 }
 async search(p,s,key,signal,page=1,{dir}={}){
  const tag=tagAt(s,page),actualPage=pageAt(s,page),mask=contentMask(s);
  if(p.type==='konachan'){
   const term=value=>value.trim().replace(/\s+/g,'_').replace(/["\\]/g,'_'),rating={100:'rating:s',110:'-rating:e',101:'-rating:q','010':'rating:q','001':'rating:e','011':'-rating:s'}[mask]||'';
   let query=[tag&&term(tag),rating].filter(Boolean).join(' ');for(const excluded of s.excludedTags){const next=[query,'-'+term(excluded)].filter(Boolean).join(' ');if(encodeURIComponent(next).length>1500)break;query=next;}
   const u=new URL('https://konachan.com/post.json');u.search=new URLSearchParams({tags:query,page:String(actualPage),limit:'24'});const json=await this.request(u,signal);if(!Array.isArray(json))throw new AppError('invalidFeed');
   return json.flatMap(x=>{if(!/^\d+$/.test(String(x.id))||!x.file_url||!['s','q','e'].includes(x.rating)||x.status==='deleted'||/\.(?:gif|webm|mp4)(?:\?|$)/i.test(x.file_url))return [];
    return [{id:safeId(p.id,String(x.id)),provider:p.id,sourceType:p.type,title:'Konachan '+x.id,url:secure(x.file_url,'https://konachan.com'),preview:secure(x.preview_url||x.sample_url||x.file_url,'https://konachan.com'),source:'https://konachan.com/post/show/'+x.id,tags:String(x.tags||'').split(/\s+/).filter(Boolean).map(t=>t.replaceAll('_',' ')),rating:{s:'safe',q:'suggestive',e:'adult'}[x.rating],width:Number(x.width),height:Number(x.height),size:Number(x.file_size)||0}];});
  }
  if(p.type==='pixabay'){
   if(!key)throw new AppError('apiKeyRequired');const u=new URL('https://pixabay.com/api/');u.search=new URLSearchParams({key,q:tag.slice(0,100),image_type:'all',safesearch:'true',orientation:'horizontal',per_page:'24',page:String(actualPage),order:'popular',lang:'en'});
   const json=await this.pixabay(u,key,signal,dir);return json.hits.flatMap(x=>{const url=x.imageURL||x.fullHDURL||x.largeImageURL;if(!x.id||!url||x.type==='vector/svg')return [];
    return [{id:safeId(p.id,String(x.id)),provider:p.id,sourceType:p.type,title:'Pixabay '+x.id,url:secure(url),preview:secure(x.webformatURL||x.previewURL||url),source:secure(x.pageURL),tags:String(x.tags||'').split(',').map(t=>t.trim()).filter(Boolean),rating:'safe',width:Number(x.imageWidth),height:Number(x.imageHeight),attribution:plain(x.user)}];});
  }
  if(p.type==='deviantart'){
   if(actualPage>2084)return [];const u=new URL('https://www.deviantart.com/api/v1/oauth2/browse/'+(tag?'tags':'home'));u.search=new URLSearchParams({offset:String((actualPage-1)*24),limit:'24',mature_content:mask[2]==='1'?'true':'false',...tag&&{tag:tag.replace(/[\s_]+/g,'')}});
   const json=await this.da(u,key,signal);if(!Array.isArray(json.results))throw new AppError('invalidFeed');const result=json.results.flatMap(x=>{if(!x.deviationid||x.is_deleted||!x.is_downloadable||!x.content?.src||x.is_mature&&mask[2]!=='1'||x.tier_access?.startsWith('locked'))return [];
    const preview=x.thumbs?.find(t=>t.width>=200)?.src||x.preview?.src||x.thumbs?.[0]?.src||x.content.src;
    return [{id:safeId(p.id,x.deviationid),provider:p.id,sourceType:p.type,deviantartId:x.deviationid,title:plain(x.title),url:secure(x.content.src),preview:secure(preview),source:secure(x.url),tags:tag?[tag]:[],rating:x.is_mature===false?'safe':'adult',width:Number(x.content.width),height:Number(x.content.height),size:Number(x.download_filesize)||0,attribution:plain(x.author?.username)}];});Object.defineProperty(result,'hasMore',{value:json.has_more===true});return result;
  }
  throw new AppError('invalidProvider');
 }
 async enrich(item,key,signal){
  const id=item.deviantartId;if(!id)return item;
  const metadata=new URL('https://www.deviantart.com/api/v1/oauth2/deviation/metadata');metadata.searchParams.set('deviationids[]',id);const json=await this.da(metadata,key,signal),record=json.metadata?.find(x=>x.deviationid===id);if(!record)throw new AppError('notAvailable');
  item.tags=(record.tags||[]).map(t=>t.tag_name).filter(t=>typeof t==='string');item.attribution=plain(record.author?.username||item.attribution);
  const download=await this.da('https://www.deviantart.com/api/v1/oauth2/deviation/download/'+encodeURIComponent(id),key,signal);if(!download.src||!/^.+\.(jpe?g|png|webp|avif)$/i.test(download.filename||''))throw new AppError('notAvailable');
  item.url=secure(download.src);item.width=Number(download.width);item.height=Number(download.height);item.size=Number(download.filesize)||0;return item;
 }
}
export const artSources=new ArtSources();
