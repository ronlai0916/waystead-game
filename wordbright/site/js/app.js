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
import { startAccount } from './account/boot.js';
import { signInUrl } from './account/config.js';
import { needsSignIn } from './gate.js';

const main = document.getElementById('main');
const backBtn = document.getElementById('back');
let cleanup = null;
let account = null;
const currentPath = () => decodeURI(location.hash.replace(/^#\/?/, '')).split('?')[0];

const ROUTES = { '': home, new: setup, play: playView, end: endView, rules, about };
const PARENT = { new: '#/', play: '#/', end: '#/', rules: '#/', about: '#/' };

function render() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  const path = currentPath();
  if (account && needsSignIn(path, account.session.player)) {
    location.assign(signInUrl(account.origin, location.href));
    return;
  }
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

// The look menu: Day · Sunny garden, Day · Paint box, Night, Match device.
function wireTheme() {
  wireThemeMenu(document.getElementById('theme'), document.getElementById('theme-menu'), document);
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
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
