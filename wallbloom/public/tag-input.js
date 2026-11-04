// CSV-style lists keep commas inside quoted tag names intact.
export const tagIdentity=value=>value.normalize('NFC').replaceAll('_',' ').replace(/\s+/g,' ').trim().toLowerCase();
export const maxTags=1000,maxTagLength=80;
export function tagListError(tags){
 if(!Array.isArray(tags)||tags.some(t=>typeof t!=='string'))return 'invalidSettings';
 if(tags.length>maxTags)return 'tooManyTags';
 if(tags.some(t=>t.length>maxTagLength))return 'tagTooLong';
 return null;
}
export function parseTags(input){
 const result=[],seen=new Set();let i=0;
 while(i<input.length){
  while(i<input.length&&/[\s,]/.test(input[i]))i++;
  if(i>=input.length)break;
  let value='';
  if(input[i]==='"'){
   i++;let closed=false;
   while(i<input.length){if(input[i]==='"'){if(input[i+1]==='"'){value+='"';i+=2;}else{i++;closed=true;break;}}else value+=input[i++];}
   if(!closed)throw Error('invalidTagList');
   while(i<input.length&&/[ \t]/.test(input[i]))i++;
   if(i<input.length&&!/[,\r\n]/.test(input[i]))throw Error('invalidTagList');
  }else{while(i<input.length&&!/[,\r\n]/.test(input[i]))value+=input[i++];}
  value=value.trim();const key=value.toLowerCase();if(value&&!seen.has(key)){seen.add(key);result.push(value);}
 }
 return result;
}
// Older versions split a clicked tag such as "Warhammer 40,000" at its comma and saved
// the parts as neighbours. Join them again when the library knows the original tag.
export function repairSplitTags(tags,knownTags){
 const compact=value=>tagIdentity(value).replace(/\s*,\s*/g,','),known=new Map();
 for(const tag of knownTags)if(tag.includes(','))known.set(compact(tag),tag);
 if(!known.size)return tags;
 const result=[],seen=new Set();
 for(let i=0;i<tags.length;i++){
  let value=tags[i];
  for(let length=4;length>=2;length--){const original=i+length<=tags.length&&known.get(tags.slice(i,i+length).map(compact).join(','));if(original){value=original;i+=length-1;break;}}
  const id=tagIdentity(value);if(!seen.has(id)){seen.add(id);result.push(value);}
 }
 return result;
}
export function formatTags(tags){return tags.map(tag=>/[,"\r\n]/.test(tag)?'"'+tag.replaceAll('"','""')+'"':tag).join(', ');}
