// Settings → Monitors: a map of the connected screens drawn to scale (like the
// Windows display settings), a "same wallpaper on every screen" switch and the
// settings of the selected screen. Also the "apply to…" menu used by cards.
import {strings} from './i18n.js';
import {effectiveMonitorPurity} from './monitor-content.js';

Object.assign(strings.ru, {
  monitorModeSeparate: 'Свои обои на каждом экране',
  monitorModeSeparateHelp: 'Каждый экран меняется по своему расписанию и со своими фильтрами.',
  monitorModeSame: 'Одинаковые обои на всех экранах',
  monitorModeSameHelp: 'Одно изображение на всех экранах. Для каждого оно подгоняется под размер и ориентацию.',
  monitorModeLabel: 'Как ставить обои',
  monitorMapHint: 'Расположение и размеры — как в параметрах экрана Windows. Нажмите на экран, чтобы настроить его.',
  monitorPrimary: 'Основной',
  monitorEmpty: 'Нет обоев',
  monitorSameNote: 'Экраны меняются вместе по общему расписанию («Автоматизация и обновление пула»). Здесь можно ограничить категории и теги экрана и настроить кадр.',
  monitorCategories: 'Категории на этом экране',
  monitorPickCategory: 'Выберите хотя бы одну категорию или включите общий фильтр.',
  monitorCategoriesBlocked: 'Общий фильтр не разрешает ни одну из выбранных категорий — обои на этот экран не попадут.',
  monitorSaved: 'Сохранено',
  monitorGloballyOff: 'Выключено в общих категориях: на этот экран не попадёт, пока не включите её в библиотеке.',
  applyTarget: 'Выбрать экран',
  applyToAll: 'На все экраны',
  noSharedWallpaper: 'Нет обоев, подходящих сразу всем экранам. Ослабьте фильтры мониторов или выберите режим «Свои обои на каждом экране».',
});
Object.assign(strings.en, {
  monitorModeSeparate: 'Different wallpaper on each screen',
  monitorModeSeparateHelp: 'Each screen changes on its own schedule with its own filters.',
  monitorModeSame: 'Same wallpaper on all screens',
  monitorModeSameHelp: 'One image on every screen, fitted to each screen’s size and orientation.',
  monitorModeLabel: 'How wallpapers are applied',
  monitorMapHint: 'Position and size match Windows display settings. Click a screen to configure it.',
  monitorPrimary: 'Primary',
  monitorEmpty: 'No wallpaper',
  monitorSameNote: 'Screens change together on the global schedule (Automation and pool refresh). Here you can limit this screen’s categories and tags and adjust framing.',
  monitorCategories: 'Categories on this screen',
  monitorPickCategory: 'Select at least one category or use the global filter.',
  monitorCategoriesBlocked: 'The global filter allows none of the selected categories, so no wallpaper will reach this screen.',
  monitorSaved: 'Saved',
  monitorGloballyOff: 'Off in the global categories: it will not reach this screen until enabled in the library.',
  applyTarget: 'Choose screen',
  applyToAll: 'All screens',
  noSharedWallpaper: 'No wallpaper suits every screen at once. Relax monitor filters or switch to “Different wallpaper on each screen”.',
});

const CATEGORIES = ['SFW', 'Sketchy', 'NSFW'];

function el(tag, className, textContent) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (textContent !== undefined) e.textContent = textContent;
  return e;
}

export const isPrimary = m => m.left === 0 && m.top === 0;
export const orientation = m => (m.height > m.width ? 'portrait' : 'landscape');

/** Monitor rectangles as percentages of their common bounding box. */
export function monitorLayout(monitors) {
  if (!monitors.length) return {width: 1, height: 1, boxes: []};
  const has = m => Number.isFinite(m.left) && Number.isFinite(m.top);
  // Without coordinates, place the screens side by side.
  let x = 0;
  const placed = monitors.map(m => {
    const r = has(m) ? {left: m.left, top: m.top} : {left: x, top: 0};
    x += m.width;
    return {...m, ...r};
  });
  const minX = Math.min(...placed.map(m => m.left)), minY = Math.min(...placed.map(m => m.top));
  const maxX = Math.max(...placed.map(m => m.left + m.width)), maxY = Math.max(...placed.map(m => m.top + m.height));
  const width = maxX - minX, height = maxY - minY;
  return {
    width, height,
    boxes: placed.map(m => ({
      id: m.id,
      left: (m.left - minX) / width * 100,
      top: (m.top - minY) / height * 100,
      width: m.width / width * 100,
      height: m.height / height * 100,
    })),
  };
}

/** Small proportional screen icon used in menus. */
function screenIcon(monitor) {
  const icon = el('span', 'screen-icon');
  const scale = 18 / Math.max(monitor.width, monitor.height);
  icon.style.width = Math.max(6, Math.round(monitor.width * scale)) + 'px';
  icon.style.height = Math.max(6, Math.round(monitor.height * scale)) + 'px';
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

export function monitorName(t, monitors, monitor) {
  const index = monitors.findIndex(m => m.id === monitor.id) + 1;
  return `${t('monitor')} ${index}`;
}

// One floating menu shared by all cards. It lives on <body>, so card clipping
// and transforms cannot hide it, and listeners are installed only once.
let floating = null;
function floatingMenu() {
  if (floating) return floating;
  const menu = el('div', 'apply-target-menu');
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  document.body.append(menu);
  const state = {menu, owner: null};
  const close = (focusOwner = false) => {
    if (menu.hidden) return;
    menu.hidden = true;
    state.owner?.setAttribute('aria-expanded', 'false');
    if (focusOwner) state.owner?.focus();
    state.owner = null;
  };
  state.close = close;
  document.addEventListener('pointerdown', event => { if (!menu.hidden && !menu.contains(event.target) && event.target !== state.owner) close(); }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(true); });
  addEventListener('resize', () => close());
  addEventListener('scroll', event => { if (!menu.contains(event.target)) close(); }, {capture: true, passive: true});
  floating = state;
  return state;
}

/**
 * A small "▾" button next to Apply: apply to all screens or to one of them.
 * Returns null when there is only one screen.
 */
export function applyTargetMenu({state, t, disabled, onPick}) {
  if (!state?.monitors || state.monitors.length < 2) return null;
  const toggle = el('button', 'apply-target-toggle', '▾');
  toggle.type = 'button';
  toggle.title = t('applyTarget');
  toggle.setAttribute('aria-label', t('applyTarget'));
  toggle.setAttribute('aria-haspopup', 'menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.disabled = !!disabled;
  const monitors = state.monitors;
  toggle.onclick = () => {
    const f = floatingMenu();
    if (f.owner === toggle) { f.close(); return; }
    f.close();
    const item = (label, monitor) => {
      const b = el('button', 'apply-target-item');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      if (monitor) b.append(screenIcon(monitor));
      else { const all = el('span', 'screen-icon-group'); for (const m of [...monitors].sort((a, b) => (a.left ?? 0) - (b.left ?? 0))) all.append(screenIcon(m)); b.append(all); }
      b.append(el('span', '', label));
      b.onclick = () => { f.close(); onPick(monitor?.id || ''); };
      return b;
    };
    f.menu.replaceChildren(item(t('applyToAll')), ...monitors.map(m => item(`${monitorName(t, monitors, m)} · ${m.width} × ${m.height}${isPrimary(m) ? ' · ' + t('monitorPrimary') : ''}`, m)));
    f.menu.hidden = false;
    f.owner = toggle;
    toggle.setAttribute('aria-expanded', 'true');
    const r = toggle.getBoundingClientRect(), width = f.menu.offsetWidth, height = f.menu.offsetHeight;
    f.menu.style.left = Math.max(8, Math.min(r.left, innerWidth - width - 8)) + 'px';
    f.menu.style.top = (r.bottom + 6 + height < innerHeight ? r.bottom + 6 : Math.max(8, r.top - 6 - height)) + 'px';
    f.menu.querySelector('button')?.focus({preventScroll: true});
  };
  return toggle;
}

export function createMonitorPanel({container, t, action, openFrame, controlsLocked, parseTags, formatTags}) {
  let selected = '', signature = '';

  function render(state, language) {
    const key = JSON.stringify([state.monitors, state.settings.monitors, state.settings.monitorMode, state.settings.purity, state.settings.rotation, state.settings.rotationMinutes, state.workMode, state.activeProfile, language, selected, controlsLocked()]);
    if (key === signature || container.contains(document.activeElement) && document.activeElement.closest('form')) return;
    signature = key;
    container.replaceChildren();
    const monitors = state.monitors || [];
    if (!monitors.length) { container.append(el('p', 'muted', t('noMonitors'))); return; }
    if (!monitors.some(m => m.id === selected)) selected = (monitors.find(isPrimary) || monitors[0]).id;
    const same = state.settings.monitorMode === 'same' && monitors.length > 1;
    const panel = el('div', 'monitor-panel' + (same ? ' same-mode' : ''));

    if (monitors.length > 1) panel.append(modeSwitch(state, same));
    panel.append(map(state, monitors, same));
    if (monitors.length > 1) panel.append(el('p', 'muted monitor-map-hint', t('monitorMapHint')));
    for (const m of monitors) {
      const form = monitorForm(state, monitors, m, same);
      form.hidden = m.id !== selected;
      panel.append(form);
    }
    container.append(panel);
  }

  function modeSwitch(state, same) {
    const group = el('fieldset', 'monitor-mode');
    group.append(el('legend', '', t('monitorModeLabel')));
    for (const [value, title, help] of [['separate', 'monitorModeSeparate', 'monitorModeSeparateHelp'], ['same', 'monitorModeSame', 'monitorModeSameHelp']]) {
      const label = el('label', 'monitor-mode-option'), input = el('input');
      input.type = 'radio';
      input.name = 'monitorMode';
      input.value = value;
      input.checked = (value === 'same') === same;
      input.disabled = controlsLocked();
      input.onchange = async () => {
        if (!input.checked) return;
        group.querySelectorAll('input').forEach(i => { i.disabled = true; });
        await action('settings', {...state.settings, monitorMode: value}, 'monitor.mode');
        signature = '';
      };
      const copy = el('span', 'monitor-mode-copy');
      copy.append(el('strong', '', t(title)), el('small', 'muted', t(help)));
      label.append(input, copy);
      group.append(label);
    }
    return group;
  }

  function map(state, monitors, same) {
    const layout = monitorLayout(monitors);
    const box = el('div', 'monitor-map');
    const ratio = layout.width / layout.height;
    box.style.aspectRatio = `${layout.width} / ${layout.height}`;
    box.style.width = `min(100%, ${Math.round(300 * ratio)}px)`;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', t('monitorsTitle'));
    for (const [index, m] of monitors.entries()) {
      const r = layout.boxes[index];
      const tile = el('button', 'monitor-tile ' + orientation(m));
      tile.type = 'button';
      tile.dataset.monitor = m.id;
      Object.assign(tile.style, {left: r.left + '%', top: r.top + '%', width: r.width + '%', height: r.height + '%'});
      tile.setAttribute('aria-pressed', String(m.id === selected));
      tile.setAttribute('aria-label', `${monitorName(t, monitors, m)}, ${m.width} × ${m.height}, ${t(orientation(m))}${isPrimary(m) ? ', ' + t('monitorPrimary') : ''}`);
      const screen = el('span', 'monitor-screen');
      const current = state.items?.find(x => x.id === m.current && x.downloaded);
      if (current) {
        const img = el('img');
        img.alt = '';
        img.loading = 'lazy';
        img.src = '/image/' + encodeURIComponent(current.id) + '?v=2&profile=' + encodeURIComponent(state.activeProfile || 'main');
        screen.append(img);
      } else screen.append(el('span', 'monitor-empty', t('monitorEmpty')));
      const label = el('span', 'monitor-label');
      label.append(el('span', 'monitor-number', String(index + 1)), el('span', 'monitor-size', `${m.width} × ${m.height}`));
      if (isPrimary(m)) label.append(el('span', 'monitor-primary', t('monitorPrimary')));
      const settings = state.settings.monitors[m.id];
      if (!same && settings?.rotation) label.append(el('span', 'monitor-rotation', '↻ ' + settings.rotationMinutes + ' ' + (state.settings.language === 'en' ? 'min' : 'мин')));
      tile.append(screen, label);
      tile.onclick = () => { selected = m.id; signature = ''; render(state, state.settings.language); container.querySelector(`.monitor-tile[data-monitor="${CSS.escape(m.id)}"]`)?.focus(); };
      box.append(tile);
    }
    const wrap = el('div', 'monitor-map-wrap');
    wrap.append(box);
    return wrap;
  }

  function monitorForm(state, monitors, m, same) {
    const settings = state.settings.monitors[m.id] || {rotation: state.settings.rotation, rotationMinutes: state.settings.rotationMinutes, purity: state.settings.purity, tags: state.settings.tags, inheritPurity: true};
    const form = el('form', 'panel monitor-form');
    form.dataset.monitor = m.id;
    form.noValidate = true;
    form.append(el('h3', '', `${monitorName(t, monitors, m)} · ${m.width} × ${m.height} · ${t(orientation(m))}${isPrimary(m) ? ' · ' + t('monitorPrimary') : ''}`));

    // Rotation fields stay in the form in "same" mode so their values are kept on save.
    const rotation = el('div', 'monitor-rotation-fields');
    rotation.hidden = same;
    const rotate = el('label', 'check'), rotateInput = el('input');
    rotateInput.type = 'checkbox'; rotateInput.name = 'rotation'; rotateInput.checked = !!settings.rotation;
    rotate.append(el('span', '', t('rotation')), rotateInput);
    const minutes = el('label'), minutesInput = el('input');
    minutesInput.type = 'number'; minutesInput.name = 'rotationMinutes'; minutesInput.min = 1; minutesInput.max = 10080; minutesInput.value = settings.rotationMinutes;
    minutes.append(el('span', '', t('rotationMinutes')), minutesInput);
    rotation.append(rotate, minutes);
    form.append(rotation);
    if (same) form.append(el('p', 'muted monitor-same-note', t('monitorSameNote')));

    const inherit = el('label', 'check'), inheritInput = el('input');
    inheritInput.type = 'checkbox'; inheritInput.name = 'inheritPurity'; inheritInput.checked = settings.inheritPurity === true;
    inherit.append(inheritInput, el('span', '', t('monitorInheritContent')));
    const categories = el('fieldset', 'monitor-categories');
    categories.name = 'purity';
    categories.append(el('legend', '', t('monitorCategories')));
    const purity = /^[01]{3}$/.test(settings.purity) ? settings.purity : '100';
    // Toggle buttons, the same as the SFW / Sketchy / NSFW switch in the library.
    const toggles = el('div', 'category-toggles');
    toggles.setAttribute('role', 'group');
    for (const [i, name] of CATEGORIES.entries()) {
      const b = el('button', 'purity-button purity-' + i, name);
      b.type = 'button';
      b.dataset.category = String(i);
      b.setAttribute('aria-pressed', String(purity[i] === '1'));
      if (state.settings.purity[i] !== '1') { b.classList.add('globally-off'); b.title = t('monitorGloballyOff'); }
      b.onclick = () => { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); update(); };
      toggles.append(b);
    }
    categories.append(toggles);
    const warning = el('p', 'monitor-warning');
    warning.setAttribute('role', 'status');
    const mask = () => [...toggles.children].map(b => (b.getAttribute('aria-pressed') === 'true' ? '1' : '0')).join('');
    const update = () => {
      categories.disabled = inheritInput.checked;
      const value = mask();
      warning.textContent = inheritInput.checked ? '' : value === '000' ? t('monitorPickCategory') : effectiveMonitorPurity(state.settings.purity, {purity: value}) === '000' ? t('monitorCategoriesBlocked') : '';
      warning.hidden = !warning.textContent;
    };
    inheritInput.onchange = update;
    form.append(inherit, categories, warning);

    const tags = el('label'), tagsInput = el('input');
    tagsInput.name = 'tags'; tagsInput.value = Array.isArray(settings.tags) ? formatTags(settings.tags) : settings.tags || '';
    tags.append(el('span', '', t('tags')), tagsInput);
    form.append(tags);

    const buttons = el('div', 'monitor-actions');
    const save = el('button', 'primary', t('save'));
    save.type = 'submit';
    const frame = el('button', 'monitor-frame-action', t('frameAction'));
    frame.type = 'button';
    frame.disabled = controlsLocked() || !state.items.some(x => x.downloaded && !['ban', 'dislike'].includes(x.vote));
    frame.onclick = () => openFrame(m.current, m.id);
    const saved = el('span', 'muted monitor-saved');
    saved.setAttribute('role', 'status');
    buttons.append(save, frame, saved);
    form.append(buttons);
    update();

    form.onsubmit = async event => {
      event.preventDefault();
      const value = mask();
      if (!inheritInput.checked && value === '000') { update(); toggles.firstChild?.focus(); return; }
      save.disabled = true;
      const ok = await action('settings', {
        ...state.settings,
        monitors: {
          ...state.settings.monitors,
          [m.id]: {
            ...state.settings.monitors[m.id],
            rotation: rotateInput.checked,
            rotationMinutes: Number(minutesInput.value),
            // A monitor that inherits keeps its last own mask for when inheritance is switched off.
            purity: value === '000' ? purity : value,
            inheritPurity: inheritInput.checked,
            tags: parseTags(tagsInput.value),
          },
        },
      }, 'monitor.settings');
      save.disabled = false;
      if (ok !== false) { saved.textContent = t('monitorSaved'); signature = ''; }
    };
    return form;
  }

  return {render, select(id) { selected = id; signature = ''; }};
}
