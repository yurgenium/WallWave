import {safeId,AppError} from './core.mjs';
import {fetchJSON} from './network.mjs';
const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,160);
const nasaURL=value=>{const u=new URL(value);if(u.hostname!=='images-assets.nasa.gov'||u.username||u.password)throw new AppError('unsafeURL');u.protocol='https:';return u.href;};
export async function enrichNASA(item,signal){
 const json=await fetchJSON('https://images-api.nasa.gov/asset/'+encodeURIComponent(item.nasaId),signal);
 const assets=json.collection?.items;if(!Array.isArray(assets))throw new AppError('invalidFeed');
 const file=assets.find(x=>/~orig\.jpe?g$/i.test(x.href))||assets.find(x=>/~large\.jpe?g$/i.test(x.href))||assets.find(x=>/\.(?:jpe?g|png)$/i.test(x.href));
 if(!file)throw new AppError('invalidImage');item.url=nasaURL(file.href);return item;
}
export async function searchCatalog(p,s,signal,page=1){
 if(p.type==='bing'){
  const u=new URL('https://www.bing.com/HPImageArchive.aspx');u.search=new URLSearchParams({format:'js',idx:'0',n:'8',mkt:s.language==='ru'?'ru-RU':'en-US'});
  const json=await fetchJSON(u,signal);if(!Array.isArray(json.images))throw new AppError('invalidFeed');
  return json.images.filter(x=>typeof x.urlbase==='string'&&x.urlbase.startsWith('/th?')).map(x=>({id:safeId(p.id,x.hsh||x.startdate),provider:p.id,title:plain(x.title||x.copyright),url:new URL(x.urlbase+'_UHD.jpg','https://www.bing.com').href,source:'https://www.bing.com',tags:['nature','landscape','travel'],rating:'safe',attribution:plain(x.copyright)}));
 }
 if(p.type==='nasa'){
  const u=new URL('https://images-api.nasa.gov/search');u.search=new URLSearchParams({q:s.tags.length?s.tags[(page-1)%s.tags.length]:['nebula','galaxy','planet','earth'][Math.floor((page-1)/5)%4],media_type:'image',page_size:'24',page:String(s.tags.length?Math.ceil(page/s.tags.length):(page-1)%5+1)});
  const json=await fetchJSON(u,signal);const items=json.collection?.items;if(!Array.isArray(items))throw new AppError('invalidFeed');
  return items.flatMap(x=>{const d=x.data?.[0],link=x.links?.find(l=>l.render==='image');if(!d?.nasa_id||!link?.href)return [];return [{id:safeId(p.id,d.nasa_id),nasaId:String(d.nasa_id),provider:p.id,title:plain(d.title),url:nasaURL(link.href),preview:nasaURL(link.href),source:'https://images.nasa.gov/details/'+encodeURIComponent(d.nasa_id),tags:['space',...(Array.isArray(d.keywords)?d.keywords:[]).filter(x=>typeof x==='string').map(x=>x.toLowerCase().slice(0,80)).slice(0,30)],rating:'safe',attribution:plain(d.photographer||d.center||'NASA')}];});
 }
 if(p.type==='commons'){
  const u=new URL('https://commons.wikimedia.org/w/api.php');u.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:(s.tags.length?s.tags[(page-1)%s.tags.length]:'landscape')+' filetype:bitmap',gsrnamespace:'6',gsrlimit:'24',gsroffset:String(Math.floor((page-1)/Math.max(1,s.tags.length))*24),prop:'imageinfo',iiprop:'url|size|mime',iiurlwidth:'512'});
  const json=await fetchJSON(u,signal);if(json.error)throw new AppError('sourceUnavailable');
  const entries=Object.values(json.query?.pages||{});const result=entries.flatMap(x=>{const f=x.imageinfo?.[0];if(!f||!['image/jpeg','image/png','image/webp'].includes(f.mime)||f.width<1600||f.height>f.width||f.width*f.height>64000000||f.size>s.maxItemMB*1024**2)return [];return [{id:safeId(p.id,x.pageid),provider:p.id,title:plain(x.title).replace(/^File:/,'').replace(/\.(?:jpe?g|png|webp)$/i,''),url:f.url,preview:f.thumburl,source:f.descriptionurl,tags:['nature','landscape'],rating:'safe',width:f.width,height:f.height,size:f.size}];});Object.defineProperty(result,'hasMore',{value:entries.length>0});return result;
 }
 throw new AppError('invalidProvider');
}
