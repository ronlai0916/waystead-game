// Entry point: brand, theme button, and routing by the URL hash.
import { BRAND } from './brand.js';
import { getTheme, setTheme } from './store.js';
import { home } from './views/home.js';
import { setup } from './views/setup.js';
import { playView } from './views/play.js';
import { endView } from './views/end.js';
import { rules, about, notFound } from './views/pages.js';

const main = document.getElementById('main');
const backBtn = document.getElementById('back');
let cleanup = null;

const ROUTES = { '': home, new: setup, play: playView, end: endView, rules, about };
const PARENT = { new: '#/', play: '#/', end: '#/', rules: '#/', about: '#/' };

function render() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  const path = decodeURI(location.hash.replace(/^#\/?/, '')).split('?')[0];
  const view = Object.prototype.hasOwnProperty.call(ROUTES, path) ? ROUTES[path] : notFound;
  backBtn.hidden = path === '';
  backBtn.onclick = () => { location.hash = PARENT[path] || '#/'; };
  document.querySelectorAll('.topbar__nav a').forEach((a) => {
    if (a.getAttribute('href') === '#/' + path) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.body.dataset.view = path || 'home';
  cleanup = view(main) || null;
  setTitle();
}

// Views that change their heading later call this again.
export function setTitle() {
  const h1 = main.querySelector('h1');
  const path = location.hash.replace(/^#\/?/, '');
  document.title = (path && h1 ? h1.textContent + ' · ' : '') + BRAND.full;
}

function onNavigate() {
  render();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

function wireBrand() {
  document.querySelectorAll('[data-brand]').forEach((el) => {
    const key = el.dataset.brand;
    el.textContent = key === 'partof' ? BRAND.product + ' is part of ' + BRAND.maker : BRAND[key];
  });
  document.getElementById('brand').setAttribute('aria-label', BRAND.product + ' home');
}

// The one theme button: Match device → Day → Night → Match device.
// Day shows the chosen day style (Sunny garden or Paint box); Night is Night sky.
export const THEME_NAMES = { system: 'Match device', light: 'Day', dark: 'Night' };

function wireTheme() {
  const btn = document.getElementById('theme');
  const label = () => {
    const name = THEME_NAMES[getTheme()];
    btn.setAttribute('aria-label', 'Day / Night / Match device. Now: ' + name + '. Change');
    btn.title = 'Now: ' + name;
    btn.querySelector('[data-theme-name]').textContent = name;
  };
  label();
  btn.addEventListener('click', () => {
    setTheme({ system: 'light', light: 'dark', dark: 'system' }[getTheme()]);
    label();
  });
}

wireBrand();
wireTheme();
window.addEventListener('hashchange', onNavigate);
render();

// Offline play (sw.js). Only over HTTPS, so local testing never sticks to an old cache.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
