// Entry point: load data, route by the URL hash, wire the header.
import * as D from './data.js';
import * as Ch from './chapters-doc.js';
import { loadData } from './data.js';
import { testGuard } from './test-guard.js';
import { wireThemeMenu } from './thememenu.js';
import { stop, getSpeaker, hearSample, useVoiceAccount } from './speech.js';
import * as V from './views.js';
import * as FV from './front-views.js';
import * as MW from './words-views.js';
import * as SV from './study-views.js';
import * as GV from './games-views.js';
import { home } from './room.js';
import { useWho, kind, isChild, isKnownChild, isAdult } from './who.js';
import { applyAdult, useAdultTools } from './adult-chrome.js';
import { pathPage, settingsPage, applyChrome, wireChrome, useChildTools, closeMenu } from './child-views.js';
import * as GU from './grownups-views.js';
import { storyReview } from './story-views.js';
import * as W from './words-doc.js';
import { weekGuard } from './child-doc.js';
import * as S from './store.js';
import * as P from './progress-doc.js';
import { wireVoiceMenu } from './voice/menu.js';
import { startAccount } from './account/boot.js';
import { gateHtml, gateCard } from './account/gate.js';
import { isPlayPath, isLocked, isWordsPath } from './gate.js';
import { watchForUpdate, workerContainer } from './update/update.js';
import { wireTopNav } from './nav/nav.js';

const main = document.getElementById('main');
const backBtn = document.getElementById('back');
let cleanup = null;
let account = null;
let voiceMenu = null; // the look menu's Voice part (G8c: redrawn when the player changes)
let drawn = false; // the word list is in and the first view is drawn
let updates = null; // one-load updates (update/update.js)

const currentPath = () => decodeURI(location.hash.replace(/^#\/?/, '')).split('?')[0];

// Hash routes. :params are captured by name.
const ROUTES = [
  ['', front],
  ['chapters', FV.chapters],
  ['about', V.about],
  ['custom', V.custom],
  ['custom/play', V.customPlay],
  ['tricky', V.tricky],
  ['progress', V.progress],
  ['words', MW.myWords],
  ['words/new', MW.newGroup],
  ['words/progress', MW.wordsProgress],
  ['words/g/:gid', MW.group],
  ['words/g/:gid/edit', MW.editGroupPage],
  ['words/g/:gid/spell/:n', MW.spellWord],
  ['words/g/:gid/test', MW.testDay],
  ['words/g/:gid/study/:step', SV.studyStep],
  ['words/g/:gid/study/:step/:n', SV.studyStep],
  ['words/g/:gid/games', GV.gameMode],
  ['words/g/:gid/game/:game', GV.oneGame],
  ['words/g/:gid/path', pathPage],
  ['settings', settingsPage],
  ['grownups', GU.grownups],
  ['grownups/stories', storyReview],
  ['grownups/plan', GU.planAny],
  ['grownups/child/:cid', GU.childDashboard],
  ['grownups/child/:cid/week/:gid', GU.childDashboard],
  ['grownups/child/:cid/plan', GU.planWeek],
  ['grownups/child/:cid/plan/:gid', GU.editWeek],
  // SB4-WP5 routes

  // SB4-WP6 routes

  // SB4-WP7 routes

  // SB4-WP8 routes

  [':yearId', FV.year],
  [':yearId/:slug', FV.chapter],
  [':yearId/:slug/study', V.study],
  [':yearId/:slug/study/:word', V.spell],
  [':yearId/:slug/quick', V.quick],
  [':yearId/:slug/quick/:word', V.quick],
  [':yearId/:slug/practice', V.practice],
  [':yearId/:slug/test', V.test],
];

// A visitor with no session sees the signed-out front page (SB3-F); everyone else gets room.js's home.
function front(m, p) { return kind() === 'none' ? FV.signedOut(m, { signInHref: account ? account.signInHref() : '' }) : home(m, p); }

const chapterWords = (yearId, slug) => (D.chapterBySlug(yearId, slug) || { words: [] }).words.map((w) => w.word);

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
    if (ok && params.yearId && !(/^y([1-6]|34|56)$/.test(params.yearId) && D.liveYears().includes(params.yearId))) ok = false; // a year with no words yet is not a page
    if (ok && params.slug && !/^ch\d\d$/.test(params.slug)) ok = false;
    if (ok) return { view, params, pattern };
  }
  return null;
}

// Back goes one level up the page tree, so it never leaves the site.
function parentOf(path) {
  const parts = path.split('/').filter(Boolean);
  // SB4-WP7 parentOf
  if (parts[0] === 'custom' && parts[1] === 'play') return '#/custom';
  if (parts[0] === 'grownups') return parts.length > 3 ? '#/grownups/child/' + parts[2] : parts.length > 1 ? '#/grownups' : '#/';
  if (parts[0] === 'words' && parts.length > 3) return '#/words/g/' + parts[2];
  if (parts[0] === 'words' && parts.length > 1) return '#/words';
  if (/^y[1-6]$/.test(parts[0]) && parts.length <= 2) return '#/chapters'; // a year or a chapter page: back to More practice
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
  if (answer === 'play' || (path === '' && (answer === 'signin' || answer === 'offline'))) return false; // the front page is open to a visitor; only a wait shows the card
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

// The top bar while /api/me has not answered (a cached player with no kind): the mark alone, then once the
// child bar or the full bar. After 2.5 s with no answer (or offline) it is the full bar.
let answered = false;
let waitedOut = false;
const pending = () => kind() === 'unknown' && !answered && !waitedOut;
/** The mark-alone bar must never stick: put the full bar back (before the first draw, or when the word list fails). */
function releaseBar() {
  document.documentElement.classList.remove('wa-pre');
  document.body.classList.remove('is-pending');
}
// A visitor with no session sees the mark and a small Sign in only (css/front.css; the nav is hidden, never display: none).
const applyVisitor = () => document.body.classList.toggle('is-visitor', kind() === 'none');
const chrome = () => { applyChrome(isKnownChild(), currentPath(), pending()); applyAdult(isAdult()); applyVisitor(); };

function render() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  stop();
  const hadSheet = closeMenu(false); // a sheet never stays open over a redraw (a sync, a route change)
  const path = currentPath();
  chrome();
  if (hadSheet) setTimeout(settleFocus, 0);
  if (gated(path)) return;
  // The two old year blocks are gone: y34/ch07 is Year 4, Chapter 2 now; a bare y34 or y56 goes to More practice on its first year.
  const old = Ch.legacyHref(path, D.chapterIds());
  if (old) {
    if (old.remember) FV.rememberYear(old.remember);
    location.replace(old.href);
    return;
  }
  const found = match(path);
  if (found && found.pattern === 'settings' && !isChild()) { location.replace('#/'); return; }
  backBtn.hidden = path === '';
  backBtn.onclick = () => { location.hash = parentOf(path); };
  document.querySelectorAll('.topbar__nav a, .navmenu a').forEach((a) => {
    a.toggleAttribute('aria-current', a.getAttribute('href') === '#/' + path.split('/')[0]);
    if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
  });
  if (!found) { unknownPage(path); return; }
  // SB3-G: a grown-up's week switch is off: a child's (or unknown player's) pages for another week go to the app's pick.
  if (found.pattern.startsWith('words/g/:gid')) {
    const to = weekGuard(S.readWords(), W.localDay(Date.now()), decodeURIComponent(found.params.gid), isAdult() ? 'adult' : 'child');
    if (to) { location.replace('#/words/g/' + encodeURIComponent(to)); return; }
  }
  // A test is due: no page shows its words, so the page goes to the test instead.
  const due = testGuard(found.pattern, found.params, S.readWords(), W.localDay(Date.now()), chapterWords);
  if (due) MW.testTodayPage(main, due); else cleanup = found.view(main, found.params) || null;
  const h1 = main.querySelector('h1');
  document.title = (path && h1 ? h1.textContent + ' · ' : '') + 'Spellbright by Waystead';
}

// A sheet was closed by a redraw: focus goes to the Change or Menu button if there is one, else the page heading.
function settleFocus() {
  const a = document.activeElement;
  if (a && a !== document.body && a !== main && a.isConnected && !a.closest('.sheetlayer') && !a.closest('[inert]')) return;
  const menu = document.getElementById('child-menu');
  const target = main.querySelector('[data-week-change]') || (menu && !menu.hidden ? menu : null) || main.querySelector('h1');
  if (!target) return;
  if (!/^(A|BUTTON)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

// A My words page this app doesn't know may belong to a release still on its
// way (update/update.js): wait for it, and the reload, before saying it isn't here.
function unknownPage(path) {
  if (!isWordsPath(path)) { V.notFound(main); return; }
  main.innerHTML = '<section class="wrap page"><div class="card empty"><h1>Just a moment</h1>'
    + '<p class="muted">Getting the newest Spellbright…</p></div></section>';
  updates.settled().then(() => { if (currentPath() === path) V.notFound(main); });
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
      [W.DOC_KEY]: {
        read: () => (S.hasWords(id) ? S.readWords(id) : undefined),
        write: (v) => S.writeWords(W.normalise(v), id),
        merge: W.merge,
        prepare: (v) => W.trim(W.normalise(v), Date.now()),
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
  useChildTools({ voice: () => voiceMenu, speaker: () => getSpeaker() });
  useAdultTools({ origin: () => account.origin, player: () => account.session.player });
  useVoiceAccount(() => (account ? { origin: account.origin, signedIn: !!account.session.player } : null));
  account.session.on(() => { if (voiceMenu) voiceMenu.redraw(); });
  // /api/me says what kind of player this is; the cached player can't. It decides
  // the home page, so draw it again once that's known.
  useWho(() => account.session.player, () => account.session.refresh());
  account.ready.then(() => { answered = true; if (drawn) chrome(); });
  setTimeout(() => { waitedOut = true; releaseBar(); if (drawn) chrome(); }, 2500);
  let knownKind = '';
  account.session.on(({ player }) => {
    const k = (player && player.kind) || '';
    if (k !== knownKind) { knownKind = k; if (drawn) chrome(); if (drawn && /^(grownups|chapters$|y[1-6](\/ch\d\d)?$|$)/.test(currentPath())) render(); } // no other page depends on it: never wipe a half-filled form
  });
}

async function start() {
  updates = watchForUpdate({
    sw: workerContainer(),
    isBusy: () => isPlayPath(currentPath()),
    reload: () => location.reload(),
    onLeave: (fn) => window.addEventListener('hashchange', fn),
  });
  wireTopNav();
  wireChrome({ currentPath, parentOf });
  wireTheme();
  wireAccount();
  try {
    await loadData();
  } catch (e) {
    waitedOut = true;
    releaseBar(); // the full bar, whatever happened to the account
    main.innerHTML = '<section class="wrap page"><div class="card empty"><h1>The word list didn\'t load</h1>'
      + '<p class="muted">Check your connection, then reload the page.</p></div></section>';
    console.error(e);
    return;
  }
  window.addEventListener('hashchange', onNavigate);
  updates.register();
  drawn = true;
  render();
}

start();
