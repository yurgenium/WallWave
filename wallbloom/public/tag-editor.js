import {parseTags,formatTags,tagListError,maxTags} from './tag-input.js';
export function searchTags(tags,query){const needle=query.trim().toLowerCase();return needle?tags.filter(tag=>tag.toLowerCase().includes(needle)):tags;}
const pageSize=30;
export function setupTagEditors(form,{t}){
 const refreshers=[];
 for(const key of ['tags','excludedTags']){
  const field=form.elements.namedItem(key),label=field.closest('label'),wrap=document.createElement('div');wrap.className='tag-settings-field';label.replaceWith(wrap);wrap.append(label);
  const section=document.createElement('section');section.className='tag-editor';section.dataset.tagEditor=key;
  const searchLabel=document.createElement('label'),searchTitle=document.createElement('span'),search=document.createElement('input');search.type='search';search.autocomplete='off';search.dataset.tagSearch=key;searchLabel.append(searchTitle,search);
  const count=document.createElement('p'),error=document.createElement('p'),list=document.createElement('ul'),pager=document.createElement('div'),previous=document.createElement('button'),next=document.createElement('button'),help=document.createElement('small');
  count.className='muted tag-count';count.setAttribute('role','status');error.className='tag-error';error.setAttribute('role','alert');list.className='tag-results';pager.className='tag-pagination';previous.type=next.type='button';previous.dataset.tagPage='previous';next.dataset.tagPage='next';pager.append(previous,next);section.append(searchLabel,count,error,list,pager,help);wrap.append(section);let page=0;
  const refresh=()=>{
   searchTitle.textContent=t('tagSearch');search.placeholder=t('tagSearchPlaceholder');search.setAttribute('aria-label',t('tagSearch')+' · '+t(key));help.textContent=t('tagEditHelp');previous.textContent=t('tagPagePrevious');next.textContent=t('tagPageNext');
   let tags;try{tags=parseTags(field.value);}catch(e){error.textContent=t(e.message);field.setAttribute('aria-invalid','true');count.textContent='';list.replaceChildren();pager.hidden=true;return;}
   const invalid=tagListError(tags);error.textContent=invalid?t(invalid):'';field.setAttribute('aria-invalid',String(!!invalid));const matches=searchTags(tags,search.value);page=Math.min(page,Math.max(0,Math.ceil(matches.length/pageSize)-1));
   count.textContent=t('tagCounts').replace('{count}',tags.length).replace('{max}',maxTags).replace('{found}',matches.length);list.replaceChildren();
   for(const tag of matches.slice(page*pageSize,(page+1)*pageSize)){
    const row=document.createElement('li'),name=document.createElement('span'),remove=document.createElement('button');name.textContent=tag;remove.type='button';remove.textContent='×';remove.dataset.removeTag=tag;remove.setAttribute('aria-label',t('tagRemove').replace('{tag}',tag));
    remove.onclick=()=>{field.value=formatTags(parseTags(field.value).filter(value=>value.toLowerCase()!==tag.toLowerCase()));field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));};row.append(name,remove);list.append(row);
   }
   if(!matches.length){const empty=document.createElement('li');empty.className='muted';empty.textContent=t(tags.length?'tagNoMatches':'tagEmpty');list.append(empty);}
   pager.hidden=matches.length<=pageSize;previous.disabled=page===0;next.disabled=(page+1)*pageSize>=matches.length;
  };
  search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();}});
  search.addEventListener('input',()=>{page=0;refresh();});field.addEventListener('input',()=>{page=0;refresh();});previous.onclick=()=>{page--;refresh();};next.onclick=()=>{page++;refresh();};refreshers.push(refresh);refresh();
 }
 return {refresh:()=>refreshers.forEach(refresh=>refresh())};
}
