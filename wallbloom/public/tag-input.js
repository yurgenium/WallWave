// CSV-style lists keep commas inside quoted tag names intact.
export function parseTags(input){
 const result=[];let i=0;
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
  value=value.trim();if(value&&!result.some(x=>x.toLowerCase()===value.toLowerCase()))result.push(value);
 }
 return result;
}
export function formatTags(tags){return tags.map(tag=>/[,"\r\n]/.test(tag)?'"'+tag.replaceAll('"','""')+'"':tag).join(', ');}
