// Entry point: brand, look menu, and routing by the URL hash.
import { BRAND } from './brand.js';
import { wireThemeMenu } from './ui/thememenu.js';
import { home } from './views/home.js';
import { setup } from './views/setup.js';
import { playView } from './views/play.js';
import { endView } from './views/end.js';
import { rules, about, notFound } from './views/pages.js';
import * as S from './store.js';
import * as D from './player-data.js';
import { wireVoiceMenu } from './voice/menu.js';
import { getSpeaker } from './ui/speak.js';
import { startAccount } from './account/boot.js';
import { gateHtml, gateCard } from './account/gate.js';
import { isLocked } from './gate.js';

const main = document.getElementById('main');
const backBtn = document.getElementById('back');
let cleanup = null;
let account = null;
const currentPath = () => decodeURI(location.hash.replace(/^#\/?/, '')).split('?')[0];

const ROUTES = { '': home, new: setup, play: playView, end: endView, rules, about };
const PARENT = { new: '#/', play: '#/', end: '#/', rules: '#/', about: '#/' };

// G6/G6b: a locked page for a signed-out player shows a card instead: "Sign
// in to play" (with a return URL to this page), "You need to be online" or a
// short wait while /api/me answers (account/gate.js).
let waiting = null;
function gated(path) {
  waiting = null;
  if (!account) return false;
  const answer = account.gate(path, isLocked(path));
  if (answer === 'play') return false;
  main.innerHTML = gateHtml(gateCard(answer, navigator.onLine), account.signInHref(), { href: '#/rules', label: 'How to play' });
  backBtn.hidden = path === '';
  backBtn.onclick = () => { location.hash = '#/'; };
  document.body.dataset.view = 'gate';
  const retry = main.querySelector('[data-gate-retry]');
  if (retry) retry.addEventListener('click', () => account.session.refresh().then(() => render()));
  if (answer === 'wait') {
    waiting = path;
    account.ready.then(() => { if (waiting === path) render(); });
  }
  setTitle();
  return true;
}

function render() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  const path = currentPath();
  if (gated(path)) return;
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

// The look menu: Day · Sunny garden, Day · Paint box, Night, Match device,
// and (G8) the Voice for "Hear" once the device lists its voices.
function wireTheme() {
  const menu = document.getElementById('theme-menu');
  wireThemeMenu(document.getElementById('theme'), menu, document, wireVoiceMenu(menu, getSpeaker()));
}

// The Waystead account: the player chip, and (signed in) this player's saved
// game, choices, results and look, saved to their account. Signed out, nothing changes.
function wireAccount() {
  const value = (key, id, merge, prepare) => ({
    read: () => S.readValue(key, id),
    write: (v) => S.writeValue(key, key === D.STATS ? D.normaliseStats(v) : v, id),
    merge,
    ...(prepare ? { prepare } : {}),
  });
  account = startAccount({
    slot: document.getElementById('player-slot'),
    game: 'wordbright',
    usePlayer: (p, onChange) => S.usePlayer(p ? p.id : null, onChange, p ? p.name : ''),
    docs: (id) => ({
      [D.GAME]: value(D.GAME, id, D.mergeNewest),
      [D.SETUP]: value(D.SETUP, id, D.mergeNewest),
      [D.STATS]: value(D.STATS, id, D.mergeStats, D.trimStats),
    }),
    redraw: () => render(),
    busy: () => currentPath() === 'play',
    applyLook: () => {
      if (window.wbTheme) window.wbTheme.apply();
      document.dispatchEvent(new Event('wb:look'));
    },
    importer: {
      gameName: BRAND.product,
      has: S.hasDeviceData,
      run: (id) => {
        const here = S.deviceData();
        const name = account.session.player ? account.session.player.name : '';
        const add = D.fromDevice(here.game, here.setup, name, Date.now());
        const merge = { [D.GAME]: D.mergeNewest, [D.SETUP]: D.mergeNewest, [D.STATS]: D.mergeStats };
        for (const [key, v] of Object.entries(add)) {
          const mine = S.readValue(key, id);
          S.writeValue(key, mine === undefined ? v : merge[key](mine, v), id);
        }
        return Object.keys(add);
      },
    },
  });
}

wireBrand();
wireTheme();
wireAccount();
window.addEventListener('hashchange', onNavigate);
render();

// Offline play (sw.js). Only over HTTPS, so local testing never sticks to an old cache.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // A new release's worker takes over at once (sw.js); this page still runs
  // the old files, so load it again: now, or after the game in progress.
  const hadWorker = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadWorker) return; // the first install: this page is already current
    if (!(currentPath() === 'play')) location.reload();
    else window.addEventListener('hashchange', () => location.reload(), { once: true });
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
