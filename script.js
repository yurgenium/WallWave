// Presentation only: no analytics, requests, downloads or storage on page load.
const english = document.documentElement.lang === 'en';
const scene = document.querySelector('.scene');
const caption = document.getElementById('scene-title');
const titles = english
  ? {alpine: '01 / Above the clouds', dunes: '02 / In warm light', aurora: '03 / After sunset'}
  : {alpine: '01 / Выше облаков', dunes: '02 / В тёплом свете', aurora: '03 / После заката'};
document.querySelector('.scene-switcher')?.removeAttribute('hidden');
document.querySelectorAll('.scene-switcher button').forEach(button => {
  button.addEventListener('click', () => {
    const name = button.dataset.scene;
    if (!scene || !caption || !Object.hasOwn(titles, name)) return;
    scene.dataset.scene = name;
    caption.textContent = titles[name];
    document.querySelectorAll('.scene-switcher button').forEach(other => {
      other.setAttribute('aria-pressed', String(other === button));
    });
  });
});
