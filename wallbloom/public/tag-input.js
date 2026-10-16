// CSV-style lists keep commas inside quoted tag names intact.
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
export function formatTags(tags){return tags.map(tag=>/[,"\r\n]/.test(tag)?'"'+tag.replaceAll('"','""')+'"':tag).join(', ');}
