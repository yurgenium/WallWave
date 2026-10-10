// Compact navigation and floating status; existing controls keep their handlers.
export const icons = {
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  search:'<rect x="3" y="3" width="15" height="14" rx="2"/><path d="m4 14 4-4 4 4M12 7h.01"/><circle cx="17" cy="17" r="4"/><path d="m20 20 2 2"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  monitor:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  settings:'<path d="M10 2h4l.5 3 2 1 2.5-1.5 2 3.5-2.5 2v4l2.5 2-2 3.5L16.5 18l-2 1-.5 3h-4l-.5-3-2-1L5 19.5l-2-3.5 2.5-2v-4L3 8l2-3.5L7.5 6l2-1Z"/><circle cx="12" cy="12" r="3"/>',
  activity:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  up:'<path d="m6 15 6-6 6 6"/>',
  like:'<path d="M7 10v11H3V10Zm0 0 5-8c3 0 2 5 1 8h6c2 0 2 2 1 5l-2 6H7"/>',
  dislike:'<path d="M7 14V3H3v11Zm0 0 5 8c3 0 2-5 1-8h6c2 0 2-2 1-5l-2-6H7"/>',
  ban:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
  folder:'<path d="M3 6h6l2 2h10v12H3Z"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
};
export function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.innerHTML=icons[name];return svg;}
export function setupRedesign({t,getLanguage,openSettings,retryPending}){
  const $=id=>document.getElementById(id),rail=document.querySelector('aside');
  rail.id='navigation';rail.querySelector('.brand').innerHTML='<span class="mark">W</span><span class="brand-name">'+document.title+'</span>';
  const label=()=>getLanguage()==='ru',navButton=(id,name,kind,fn)=>{const b=document.createElement('button');b.id=id;b.type='button';b.dataset.redesignLabel=name;b.append(icon(kind),document.createElement('span'));b.onclick=fn;return b;};
  const toggle=navButton('navToggle','expand','menu',()=>{const expanded=!document.body.classList.contains('nav-expanded');document.body.classList.toggle('nav-expanded',expanded);toggle.setAttribute('aria-expanded',String(expanded));localStorage.setItem('wallbloom-nav-expanded',String(expanded));update();});toggle.setAttribute('aria-controls','navigation');rail.querySelector('.brand').after(toggle);
  document.body.classList.toggle('nav-expanded',localStorage.getItem('wallbloom-nav-expanded')==='true');toggle.setAttribute('aria-expanded',String(document.body.classList.contains('nav-expanded')));
  const nav=rail.querySelector('nav');
  for(const b of nav.querySelectorAll('[data-view]')){const key=b.dataset.view;b.removeAttribute('data-t');b.dataset.navLabel=key;b.replaceChildren(icon({library:'grid',sources:'globe',settings:'settings',activity:'activity'}[key]),document.createElement('span'));}
  const refresh=$('refresh');refresh.removeAttribute('data-t');refresh.replaceChildren(icon('search'),document.createElement('span'));refresh.dataset.redesignLabel='pick';// Attached to the floating status below, away from navigation.
  refresh.classList.add('status-action');
  const desktop=navButton('desktopShortcut','desktop','monitor',()=>openSettings('monitors'));nav.insertBefore(desktop,nav.querySelector('[data-view="sources"]'));
  const desktopControls=document.querySelector('.library-controls');desktopControls.append($('restore'));document.querySelector('[data-settings-pane="monitors"]').prepend(desktopControls);
  // General settings stay reachable at the bottom of the rail.
  rail.querySelector('.bottom').prepend(nav.querySelector('[data-view="settings"]'));
  document.querySelector('.purity-control').classList.add('settings-content-control');document.querySelector('[data-settings-pane="interests"]').prepend(document.querySelector('.purity-control'));
  document.querySelector('[data-settings-pane="ai"]').prepend(document.querySelector('.analyze-action'));
  const languageLabel=$('language').closest('label');document.querySelector('[data-settings-pane="interests"]').append(languageLabel,$('libraryInfo'));
  const status=$('status');status.classList.add('floating-status');status.dataset.expanded='false';const expand=document.createElement('button');expand.id='statusToggle';expand.type='button';expand.append(icon('up'));expand.setAttribute('aria-expanded','false');expand.setAttribute('aria-controls','statusDetails');expand.onclick=()=>{const on=status.dataset.expanded!=='true';status.dataset.expanded=String(on);expand.setAttribute('aria-expanded',String(on));$('statusDetails').hidden=!on;};status.insertBefore(expand,$('jobText').nextSibling);
  const details=document.createElement('div');details.id='statusDetails';details.hidden=true;details.append($('jobItem'),$('automationInfo'),$('guard'),$('librarySummary'));status.append(details);document.body.append(status);status.prepend($('message'));const actions=document.createElement('div');actions.className='status-actions';const retry=document.createElement('button');retry.id='retryPending';retry.type='button';retry.hidden=true;retry.onclick=()=>retryPending();actions.append(refresh,retry);status.append(actions);
  document.body.dataset.view='library';for(const b of document.querySelectorAll('button[data-view]'))b.addEventListener('click',()=>{document.body.dataset.view=b.dataset.view;});
  document.addEventListener('click',e=>{document.querySelectorAll('.card-more[open]').forEach(menu=>{if(!menu.contains(e.target))menu.open=false;});});document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.card-more[open]').forEach(menu=>menu.open=false);});
  function update(){const names=label()?{expand:document.body.classList.contains('nav-expanded')?'Свернуть панель':'Развернуть панель',pick:'Подобрать обои',desktop:'Рабочий стол'}:{expand:document.body.classList.contains('nav-expanded')?'Collapse navigation':'Expand navigation',pick:'Find wallpapers',desktop:'Desktop'};for(const e of document.querySelectorAll('[data-redesign-label],[data-nav-label]')){const name=e.dataset.navLabel?t(e.dataset.navLabel):names[e.dataset.redesignLabel];e.querySelector('span').textContent=name;e.title=name;e.setAttribute('aria-label',name);}expand.title=label()?'Все статусы приложения':'All app statuses';expand.setAttribute('aria-label',expand.title);}
  update();return {update};
}
