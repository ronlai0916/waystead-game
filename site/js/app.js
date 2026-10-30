// Entry point: load data, route by the URL hash, wire the header.
import { loadData } from './data.js';
import { wireThemeMenu } from './thememenu.js';
import { stop } from './speech.js';
import * as V from './views.js';

const main = document.getElementById('main');
const backBtn = document.getElementById('back');
let cleanup = null;

// Hash routes. :params are captured by name.
const ROUTES = [
  ['', V.home],
  ['about', V.about],
  ['custom', V.custom],
  ['custom/play', V.customPlay],
  ['tricky', V.tricky],
  ['progress', V.progress],
  [':yearId', V.year],
  [':yearId/:slug', V.chapter],
  [':yearId/:slug/study', V.study],
  [':yearId/:slug/study/:word', V.spell],
  [':yearId/:slug/quick', V.quick],
  [':yearId/:slug/quick/:word', V.quick],
  [':yearId/:slug/practice', V.practice],
  [':yearId/:slug/test', V.test],
];

function match(path) {
  const parts = path.split('/').filter(Boolean);
  for (const [pattern, view] of ROUTES) {
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {};
    let ok = true;
    pp.forEach((seg, i) => {
      if (seg.startsWith(':')) params[seg.slice(1)] = parts[i];
      else if (seg !== parts[i]) ok = false;
    });
    if (ok && params.yearId && !/^y(34|56)$/.test(params.yearId)) ok = false;
    if (ok && params.slug && !/^ch\d\d$/.test(params.slug)) ok = false;
    if (ok) return { view, params };
  }
  return null;
}

// Back goes one level up the page tree, so it never leaves the site.
function parentOf(path) {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'custom' && parts[1] === 'play') return '#/custom';
  parts.pop();
  return '#/' + parts.join('/');
}

function render() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  stop();
  const path = decodeURI(location.hash.replace(/^#\/?/, '')).split('?')[0];
  const found = match(path);
  backBtn.hidden = path === '';
  backBtn.onclick = () => { location.hash = parentOf(path); };
  document.querySelectorAll('.topbar__nav a').forEach((a) => {
    a.toggleAttribute('aria-current', a.getAttribute('href') === '#/' + path.split('/')[0]);
    if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
  });
  if (!found) { V.notFound(main); return; }
  cleanup = found.view(main, found.params) || null;
  const h1 = main.querySelector('h1');
  document.title = (path && h1 ? h1.textContent + ' · ' : '') + 'Spellbright by Waystead';
}

function onNavigate() {
  render();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

// The look menu: Day · Sunny garden, Day · Paint box, Night, Match device.
function wireTheme() {
  wireThemeMenu(document.getElementById('theme'), document.getElementById('theme-menu'), document);
}

async function start() {
  wireTheme();
  try {
    await loadData();
  } catch (e) {
    main.innerHTML = '<section class="wrap page"><div class="card empty"><h1>The word list didn\'t load</h1>'
      + '<p class="muted">Check your connection, then reload the page.</p></div></section>';
    console.error(e);
    return;
  }
  window.addEventListener('hashchange', onNavigate);
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
