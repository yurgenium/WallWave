const canonical=value=>String(value).normalize('NFC').replaceAll('_',' ').replace(/\s+/g,' ').trim();
const noise=/^(?:highres|absurdres|commentary(?:_request)?|translation(?:_request)?|wallpaper|\d+x\d+)$/i;
// Query words come from metadata of liked images, not invented CLIP captions.
// This profile deliberately includes all providers and retained ratings.
export function tasteSearchTags(db){
 const excluded=new Set(db.settings.excludedTags.map(x=>canonical(x).toLowerCase())),counts=new Map();
 for(const item of db.items){if(!['like','dislike'].includes(item.vote))continue;for(const raw of new Set(item.tags||[])){const tag=canonical(raw),id=tag.toLowerCase();if(!tag||tag.length>80||noise.test(tag)||excluded.has(id))continue;const value=counts.get(id)||{tag,positive:0,negative:0};value[item.vote==='like'?'positive':'negative']++;counts.set(id,value);}}
 const learned=[...counts.values()].filter(x=>x.positive).sort((a,b)=>b.positive/(1+b.negative)-a.positive/(1+a.negative)||a.tag.localeCompare(b.tag)).slice(0,32).map(x=>x.tag);
 if(!learned.length)return db.settings.tags;
 const result=[],seen=new Set();for(let i=0;i<Math.max(db.settings.tags.length,learned.length);i++)for(const tag of [db.settings.tags[i],learned[i]])if(tag){const id=canonical(tag).toLowerCase();if(!seen.has(id)&&!excluded.has(id)){seen.add(id);result.push(tag);}}
 return result;
}
