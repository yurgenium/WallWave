import {strings} from './i18n.js';

Object.assign(strings.ru,{
 monitorContentConflict:'Общий фильтр категорий конфликтует с настройками монитора. Открой «Настройки → Мониторы» или выбери «Использовать общий фильтр».',
 monitorContentConflictHelp:'Для мониторов {monitors} не осталось разрешённых категорий: общий фильтр и настройки экранов не пересекаются. Поэтому обои на них не устанавливаются.',
 monitorUseCommonContent:'Использовать общий фильтр',monitorConfigureContent:'Настроить мониторы',monitorInheritContent:'Использовать общий фильтр категорий',
 wallpaperRatingBlocked:'Категория этих обоев запрещена настройками выбранного монитора. Проверь категории в «Настройки → Мониторы».',
 wallpaperExcludedTags:'Эти обои содержат исключённый тег. Проверь список исключений в настройках.'
});
Object.assign(strings.en,{
 monitorContentConflict:'The global content filter conflicts with a monitor filter. Open Settings → Monitors or choose Use global filter.',
 monitorContentConflictHelp:'Monitors {monitors} have no allowed categories because their filters do not overlap the global filter. Wallpapers cannot be applied to these screens.',
 monitorUseCommonContent:'Use global filter',monitorConfigureContent:'Configure monitors',monitorInheritContent:'Use global content filter',
 wallpaperRatingBlocked:'This wallpaper category is blocked by the selected monitor settings. Check Settings → Monitors.',
 wallpaperExcludedTags:'This wallpaper matches an excluded tag. Check your exclusions in settings.'
});

export function effectiveMonitorPurity(globalPurity='100',monitor,workMode=false){
 if(workMode)return '100';
 if(!monitor||monitor.inheritPurity===true)return globalPurity;
 return monitor.purity.split('').map((value,index)=>value==='1'&&globalPurity[index]==='1'?'1':'0').join('');
}

export function contentConflicts(state){
 if(state.workMode)return [];
 return state.monitors.map((monitor,index)=>({id:monitor.id,index:index+1}))
  .filter(m=>effectiveMonitorPurity(state.settings.purity,state.settings.monitors[m.id])==='000');
}

export function inheritConflictingMonitorFilters(state){
 const monitors={...state.settings.monitors};
 for(const monitor of contentConflicts(state))monitors[monitor.id]={...monitors[monitor.id],inheritPurity:true};
 return {...state.settings,monitors};
}

export function setupMonitorContentNotice({grid,getState,action,t,openSettings}){
 const section=document.createElement('section'),message=document.createElement('p'),repair=document.createElement('button'),settings=document.createElement('button');
 section.id='monitorContentWarning';section.className='panel monitor-content-warning';section.hidden=true;section.setAttribute('role','status');section.setAttribute('aria-live','polite');
 repair.id='useGlobalMonitorContent';repair.type=settings.type='button';let saving=false;
 repair.onclick=async()=>{if(saving)return;saving=true;repair.disabled=true;try{await action('settings',inheritConflictingMonitorFilters(getState()),'monitor.useGlobalFilter');}finally{saving=false;update(getState());}};
 settings.onclick=openSettings;section.append(message,repair,settings);grid.before(section);
 function update(state){if(!state)return;const conflicts=contentConflicts(state);section.hidden=!conflicts.length;message.textContent=t('monitorContentConflictHelp').replace('{monitors}',conflicts.map(m=>m.index).join(', '));repair.textContent=t('monitorUseCommonContent');settings.textContent=t('monitorConfigureContent');repair.disabled=saving||!!state.wallpaperAction||['import','export','cleanup'].includes(state.job?.kind);}
 return {update};
}

export function setupMonitorInheritance(form,settings,t){
 const input=form.elements.namedItem('purity'),label=document.createElement('label'),checkbox=document.createElement('input'),title=document.createElement('span');
 label.className='check';checkbox.type='checkbox';checkbox.name='inheritPurity';checkbox.checked=settings.inheritPurity===true;title.textContent=t('monitorInheritContent');
 label.append(checkbox,title);input.closest('label').before(label);
 const update=()=>{input.disabled=checkbox.checked;};checkbox.onchange=update;update();
}
