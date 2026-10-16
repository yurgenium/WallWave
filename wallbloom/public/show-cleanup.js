export const cleanupFolders=['pending','like','neutral','deferred'];
export const defaultCleanupRules=()=>Object.fromEntries(cleanupFolders.map(folder=>[folder,{enabled:false,shows:3}]));
export function cleanupRulesError(rules){
 if(!rules||typeof rules!=='object'||Array.isArray(rules)||Object.keys(rules).some(key=>!cleanupFolders.includes(key)))return 'invalidCleanupSettings';
 for(const rule of Object.values(rules))if(!rule||typeof rule.enabled!=='boolean'||!Number.isInteger(rule.shows)||rule.shows<1||rule.shows>1000)return 'invalidCleanupSettings';
 return null;
}
export function setupShowCleanup(form,{t}){
 const pane=form.querySelector('[data-settings-pane="automation"]'),section=document.createElement('section');section.className='panel show-cleanup';section.id='showCleanupSettings';
 const title=document.createElement('h2'),help=document.createElement('p'),status=document.createElement('p');help.className=status.className='muted';status.id='showCleanupStatus';section.append(title,help);const rows=[];
 for(const folder of cleanupFolders){
  const row=document.createElement('div'),label=document.createElement('label'),toggle=document.createElement('input'),name=document.createElement('span'),thresholdLabel=document.createElement('label'),thresholdName=document.createElement('span'),threshold=document.createElement('input');
  row.className='show-cleanup-row';toggle.type='checkbox';toggle.dataset.cleanupFolder=folder;label.append(toggle,name);threshold.type='number';threshold.min='1';threshold.max='1000';threshold.step='1';threshold.dataset.cleanupShows=folder;thresholdLabel.append(thresholdName,threshold);row.append(label,thresholdLabel);section.append(row);toggle.onchange=()=>threshold.disabled=!toggle.checked;rows.push({folder,toggle,name,thresholdName,threshold});
 }
 section.append(status);pane.append(section);
 return {
  refresh(){title.textContent=t('showCleanupTitle');help.textContent=t('showCleanupHelp');for(const row of rows){row.name.textContent=t('cleanupFolder_'+row.folder);row.thresholdName.textContent=t('showCleanupAfter');row.threshold.setAttribute('aria-label',t('showCleanupAfter')+' · '+t('cleanupFolder_'+row.folder));}},
  fill(rules=defaultCleanupRules()){for(const row of rows){const rule=rules[row.folder]||{enabled:false,shows:3};row.toggle.checked=rule.enabled;row.threshold.value=rule.shows;row.threshold.disabled=!rule.enabled;}},
  read(){return Object.fromEntries(rows.map(row=>[row.folder,{enabled:row.toggle.checked,shows:row.toggle.checked?Number(row.threshold.value):Number(row.threshold.value)||3}]));}
 };
}
