// Entry point: load data, route by the URL hash, wire the header.
import { loadData } from './data.js';
import { wireThemeMenu } from './thememenu.js';
import { stop, getSpeaker, hearSample, useVoiceAccount } from './speech.js';
import * as V from './views.js';
import * as S from './store.js';
import * as P from './progress-doc.js';
import { wireVoiceMenu } from './voice/menu.js';
import { startAccount } from './account/boot.js';
import { gateHtml, gateCard } from './account/gate.js';
import { isPlayPath, isLocked } from './gate.js';

const main = document.getElementById('main');
const backBtn = document.getElementById('back');
let cleanup = null;
let account = null;
let voiceMenu = null; // the look menu's Voice part (G8c: redrawn when the player changes)
let drawn = false; // the word list is in and the first view is drawn

const currentPath = () => decodeURI(location.hash.replace(/^#\/?/, '')).split('?')[0];

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

// G6/G6b: a locked page for a signed-out player shows a card instead: "Sign
// in to play" (with a return URL to this page), "You need to be online" or a
// short wait while /api/me answers (account/gate.js).
let waiting = null;
function gated(path) {
  waiting = null;
  if (!account) return false;
  const answer = account.gate(path, isLocked(path));
  if (answer === 'play') return false;
  main.innerHTML = gateHtml(gateCard(answer, navigator.onLine), account.signInHref(), { href: '#/about', label: 'About Spellbright' });
  backBtn.hidden = path === '';
  backBtn.onclick = () => { location.hash = parentOf(path); };
  const retry = main.querySelector('[data-gate-retry]');
  if (retry) retry.addEventListener('click', () => account.session.refresh().then(() => render()));
  if (answer === 'wait') {
    waiting = path;
    account.ready.then(() => { if (waiting === path) render(); });
  }
  document.title = main.querySelector('h1').textContent + ' · Spellbright by Waystead';
  return true;
}

function render() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  stop();
  const path = currentPath();
  if (gated(path)) return;
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

// The look menu: Day · Sunny garden, Day · Paint box, Night, Match device,
// and (G8) the Voice for "Hear" once the device lists its voices.
function wireTheme() {
  const menu = document.getElementById('theme-menu');
  // G8c: the Waystead voices, usable when signed in and online.
  voiceMenu = wireVoiceMenu(menu, getSpeaker(), {
    server: () => ({ signedIn: !!(account && account.session.player), online: navigator.onLine !== false }),
    hearSample,
  });
  wireThemeMenu(document.getElementById('theme'), menu, document, voiceMenu);
}

// The Waystead account: the player chip, and (signed in) this player's
// progress and look, saved to their account. Signed out, nothing changes.
function wireAccount() {
  account = startAccount({
    slot: document.getElementById('player-slot'),
    game: 'spellbright',
    usePlayer: (p, onChange) => S.usePlayer(p ? p.id : null, onChange),
    docs: (id) => ({
      [P.DOC_KEY]: {
        read: () => (S.hasDoc(id) ? S.readDoc(id) : undefined),
        write: (v) => S.writeDoc(P.normalise(v), id),
        merge: P.merge,
        prepare: (v) => P.trim(P.normalise(v), Date.now()),
      },
    }),
    redraw: () => { if (drawn) render(); },
    busy: () => isPlayPath(currentPath()),
    applyLook: () => {
      if (window.sbTheme) window.sbTheme.apply();
      document.dispatchEvent(new Event('sb:look'));
    },
    importer: {
      gameName: 'Spellbright',
      has: S.hasDeviceProgress,
      run: (id, device) => {
        const here = S.deviceProgress();
        S.writeDoc(P.merge(S.readDoc(id), P.fromDevice(here.progress, here.tricky, device, Date.now())), id);
        return [P.DOC_KEY];
      },
    },
  });
  // G8c: Hear asks the account's voice server for a signed-in player.
  useVoiceAccount(() => (account ? { origin: account.origin, signedIn: !!account.session.player } : null));
  account.session.on(() => { if (voiceMenu) voiceMenu.redraw(); });
}

async function start() {
  wireTheme();
  wireAccount();
  try {
    await loadData();
  } catch (e) {
    main.innerHTML = '<section class="wrap page"><div class="card empty"><h1>The word list didn\'t load</h1>'
      + '<p class="muted">Check your connection, then reload the page.</p></div></section>';
    console.error(e);
    return;
  }
  window.addEventListener('hashchange', onNavigate);
  drawn = true;
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    // A new release's worker takes over at once (sw.js); this page still runs
    // the old files, so load it again: now, or after the game in progress.
    const hadWorker = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadWorker) return; // the first install: this page is already current
      if (!(isPlayPath(currentPath()))) location.reload();
      else window.addEventListener('hashchange', () => location.reload(), { once: true });
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
