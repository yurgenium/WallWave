import {durationText} from './hold-time.js';

export function setupStatusPanel({getState,action,t,getLanguage,openHold,openHelp}){
 const $=id=>document.getElementById(id),panel=$('status'),details=$('statusDetails');
 const node=(tag,cls='')=>{const e=document.createElement(tag);e.className=cls;return e;};
 const controls=node('section','panel-quick'),buttons=node('div','panel-wallpaper-buttons');
 const button=(id,key,fn)=>{const b=node('button');b.id=id;b.type='button';b.dataset.label=key;b.onclick=async()=>{b.disabled=true;try{await fn();}finally{update(getState());}};return b;};
 const previous=button('panelPrevious','panelPrevious',()=>action('previous')),
 next=button('panelNext','panelNext',()=>action('next')),
 pin=button('panelHold','panelPin',openHold),pause=button('panelRotationPause','panelPauseRotation',()=>{const s=getState(),enabled=s.settings.rotation||Object.values(s.settings.monitors||{}).some(m=>m.rotation);return action('rotation-pause',{paused:enabled&&!s.rotationPaused,enable:!enabled});});
 buttons.append(previous,next,pin,pause);controls.append(buttons);
 const makeSelect=(id,key)=>{const l=node('label'),title=node('span'),input=node('select');input.id=id;title.dataset.label=key;l.append(title,input);controls.append(l);return input;};
 const interval=makeSelect('panelInterval','panelInterval'),folder=makeSelect('panelFolder','panelFolder');interval.title=t('panelIntervalHelp');
 interval.onchange=()=>action('rotation-options',{minutes:Number(interval.value)});folder.onchange=()=>action('collection-play',{id:folder.value||null});
 details.prepend(controls);$('librarySummary').hidden=true;
 const transfers=node('details','panel-transfer-details'),transferTitle=node('summary'),transferText=node('p');transfers.append(transferTitle,transferText);details.append(transfers);transfers.append($('guard'));
 const critical=node('div','panel-critical'),criticalText=node('p'),help=button('panelDiagnostics','openDiagnostics',openHelp);critical.hidden=true;critical.append(criticalText,help);panel.append(critical);
 const showCritical=offline=>{const s=getState();critical.hidden=!offline&&s?.lastError?.code!=='saveFailed';criticalText.textContent=t('criticalHelp');help.textContent=t('openDiagnostics');panel.dataset.offline=String(offline);};
 let lastBytes=null,lastTime=Date.now(),lastSpeed=0,folderKey='',intervalKey='';
 function update(s){if(!s)return;showCritical(panel.dataset.offline==='true');const lang=getLanguage(),busy=!!s.wallpaperAction||s.job?.kind==='apply',locked=['import','export','cleanup'].includes(s.job?.kind);
  for(const e of controls.querySelectorAll('[data-label]'))e.textContent=t(e.dataset.label);
  previous.disabled=locked||busy||!s.canPrevious;next.disabled=locked||busy||s.workMode;pin.disabled=locked||s.workMode;pause.disabled=locked;pause.textContent=t(s.rotationPaused?'panelResumeRotation':s.settings.rotation||Object.values(s.settings.monitors||{}).some(m=>m.rotation)?'panelPauseRotation':'panelEnableRotation');
  const keys=JSON.stringify([s.settings.rotationMinutes,lang]);if(keys!==intervalKey&&document.activeElement!==interval){intervalKey=keys;const values=[...new Set([5,15,30,60,120,360,720,1440,s.settings.rotationMinutes])].sort((a,b)=>a-b);interval.replaceChildren(...values.map(value=>{const o=node('option');o.value=value;o.textContent=durationText(value*60000,lang);return o;}));interval.value=s.settings.rotationMinutes;}interval.disabled=locked;interval.title=t('panelIntervalHelp');
  const collections=JSON.stringify([s.collections,s.rotationCollection,lang]);if(collections!==folderKey&&document.activeElement!==folder){folderKey=collections;folder.replaceChildren(...[{id:'',name:t('panelAllFolders')},...(s.collections||[])].map(c=>{const o=node('option');o.value=c.id;o.textContent=c.name;return o;}));folder.value=s.rotationCollection||'';}folder.disabled=locked;
  const cards=$('automationInfo').children;if(cards[1])cards[1].hidden=!(s.aiRequested||s.job?.kind==='ai'||s.job?.kind==='refresh'&&['screening','modelLoading','modelDownloading'].includes(s.job.phase));
  if(s.job&&['modelLoading','modelDownloading'].includes(s.job.phase))$('jobText').textContent=t(s.job.phase);else if(s.job?.kind==='apply')$('jobText').textContent=t('changingWallpaper');
  if(!s.job&&!s.paused&&!s.lastError){const r=s.automation.rotation,held=s.wallpaperHold;if(held?.manual)$('jobText').textContent=t('panelHoldManual');else if(held?.until>Date.now())$('jobText').textContent=t('panelHeld')+' '+durationText(held.until-Date.now(),lang);else if(!['active','idle'].includes(s.guard.code))$('jobText').textContent=t(s.guard.code);else if(r.nextAt>Date.now())$('jobText').textContent=t('panelNextDue')+' '+durationText(r.nextAt-Date.now(),lang);else if(s.rotationPaused)$('jobText').textContent=t('rotationPaused');else if(s.automation.refresh.nextAt>Date.now())$('jobText').textContent=t('panelRefreshDue')+' '+durationText(s.automation.refresh.nextAt-Date.now(),lang);}
  const net=s.network||{},now=Date.now(),received=net.received||0;if(lastBytes===null){lastBytes=received;lastTime=now;}if(now-lastTime>=1000){lastSpeed=Math.max(0,received-lastBytes)/((now-lastTime)/1000);lastBytes=received;lastTime=now;}const active=net.active||{},source=s.providers?.find(p=>p.id===s.job?.provider)?.name||s.providers?.filter(p=>s.providerStatus?.[p.id]?.code==='searching').map(p=>p.name).join(', ');
  const lines=[t('panelTransferred')+': '+(received/1024**2).toFixed(1)+' MiB',t('panelSpeed')+': '+(lastSpeed/1024).toFixed(0)+' KiB/s',t('panelOriginal')+': '+(active.original||0),t('panelPreview')+': '+(active.preview||0),t('panelAPI')+': '+(active.api||0)];if(source)lines.push(t('panelActiveSource')+': '+source);if(s.job?.modelDownload){const m=s.job.modelDownload;lines.push(t('panelModel')+': '+(Number(m.loaded||m.bytes||0)/1024**2).toFixed(1)+(m.total?' / '+(m.total/1024**2).toFixed(1):'')+' MiB');}transferTitle.textContent=t('panelDetails');transferText.textContent=lines.join(' · ');
 }
 // Move before the pointer reaches the overlay, while the uncovered part of the card is hovered.
 let coveredCard=null,returnTimer;const reset=()=>{panel.style.setProperty('--panel-shift','0px');panel.dataset.dodged='false';coveredCard=null;};
 document.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'||panel.contains(e.target))return;
  const card=e.target.closest?.('#grid .card');if(coveredCard===card&&card){clearTimeout(returnTimer);return;}
  if(card&&document.body.dataset.view==='library'){
   const r=card.getBoundingClientRect(),p=panel.getBoundingClientRect(),base=innerWidth-(innerWidth<=700?10:18)-panel.offsetWidth;
   if(r.right>base&&r.left<base+panel.offsetWidth&&r.bottom>p.top&&r.top<p.bottom){clearTimeout(returnTimer);coveredCard=card;const x=Math.max(44-panel.offsetWidth,r.left-panel.offsetWidth-12);panel.style.setProperty('--panel-shift',(Math.min(0,x-base))+'px');panel.dataset.dodged='true';return;}
  }
  clearTimeout(returnTimer);returnTimer=setTimeout(()=>{if(!panel.matches(':hover')&&(!keyboardFocus||!panel.contains(document.activeElement)))reset();},900);
 });
 let keyboardFocus=false;document.addEventListener('keydown',e=>{if(e.key==='Tab')keyboardFocus=true;});document.addEventListener('pointerdown',()=>keyboardFocus=false);panel.addEventListener('focusin',()=>{clearTimeout(returnTimer);if(keyboardFocus)reset();});window.addEventListener('resize',reset);document.addEventListener('pointerleave',()=>{clearTimeout(returnTimer);reset();});
 return {update,connection:connected=>showCritical(!connected)};
}
