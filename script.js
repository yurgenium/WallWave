// Presentation only: no analytics, requests, downloads or storage on page load.
const scene = document.querySelector('.scene');
const caption = document.getElementById('scene-title');
const titles = {alpine: '01 / Выше облаков', dunes: '02 / В тёплом свете', aurora: '03 / После заката'};
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
