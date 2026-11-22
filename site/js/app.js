// Entry point: load data, route by the URL hash, wire the header.
import * as D from './data.js';
import * as Ch from './chapters-doc.js';
import { loadData } from './data.js';
import { testGuard } from './test-guard.js';
import { wireThemeMenu } from './thememenu.js';
import { stop, getSpeaker, hearSample, useVoiceAccount } from './speech.js';
import * as V from './views.js';
import { toast } from './ui.js';
import * as FV from './front-views.js';
import * as MW from './words-views.js';
import * as SV from './study-views.js';
import * as GV from './games-views.js';
import { home } from './room.js';
import { useWho, kind, isChild, isKnownChild, isAdult, ADULT_KEY } from './who.js';
import { applyAdult, useAdultTools } from './adult-chrome.js';
import * as CV from './child-views.js';
import { devicePage } from './device-view.js'; // SB5 D2: About this device
import { pathPage, settingsPage, applyChrome, wireChrome, useChildTools, closeMenu } from './child-views.js';
import * as GU from './grownups-views.js';
import * as SU from './setup-views.js'; // SB4-WP6
import * as AV from './assess-views.js'; // SB4-WP5
import * as OV from './own-views.js'; // SB4-WP7
import * as SC from './scan-views.js'; // SB4-WP8
import * as SET from './set-views.js'; // SB5 (Set a week, Change a week)
import * as RV from './results-views.js'; // SB5 (results for a list)
import { adultParent } from './nav-doc.js'; // SB5 (TR-4)
import { createRoleStore } from './role-data.js'; // SB5 (role: redirects and landing)
import { safeDecode } from './chapters-doc.js';
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

const currentPath = () => { const h = location.hash.replace(/^#\/?/, ''); let p = h; try { p = decodeURI(h); } catch (e) { /* a malformed address: match it as typed */ } return p.split('?')[0]; }; // SB4-WP11

// SB5 (TR-2): an old route that only sends the visitor on. `to(params)` is the new path without '#/'; a bad piece is '' (see piece).
const piece = (v) => { const d = safeDecode(v); return d ? encodeURIComponent(d) : ''; };
const redirect = (to) => (m, p) => { location.replace('#/' + to(p || {})); };

// SB5: a route to a view another file may not export yet (or any more): it is looked up when the page is opened, so app.js still loads;
// without it the fallback view draws, else the not-found page.
const later = (ns, name, fallback) => (m, p) => { const f = ns[name] || fallback; return typeof f === 'function' ? f(m, p) : V.notFound(m); };

// SB5 (TR-80, TR-82): this adult's role ('parent' until one is chosen), from the role store (device copy, then the account's prefs).
const roleStores = new Map(); // player id -> { prefs, store }: rebuilt when the prefs sync changes (it is null until the account has one)
function roles() {
  const p = account && account.session.player;
  if (!p || !p.id) return null;
  const prefs = account.prefs || null;
  const have = roleStores.get(p.id);
  if (!have || have.prefs !== prefs) {
    let storage = null;
    try { storage = window.localStorage; } catch (e) { storage = null; }
    roleStores.set(p.id, { prefs, store: createRoleStore({ storage: storage || { getItem: () => null, setItem: () => {} }, playerId: p.id, prefs }) });
  }
  return roleStores.get(p.id).store;
}
function roleNow() { try { const r = roles(); return r ? r.role() : 'parent'; } catch (e) { return 'parent'; } }

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
  ['device', devicePage], // SB5 D2: About this device (the sizes this phone gives the page)
  ['look', later(CV, 'lookVoicePage')], // SB5 (R4): Look and voice, a child's page
  ['grownups', GU.grownups],
  ['grownups/stories', storyReview],
  ['grownups/plan', redirect(() => 'grownups/set')], // SB5 TR-2
  ['grownups/child/:cid', GU.childDashboard],
  ['grownups/child/:cid/week/:gid', later(GU, 'pastWeek', GU.childDashboard)], // SB5 05g: one past week, read-only
  ['grownups/child/:cid/weeks', later(GU, 'earlierWeeks')], // SB5 05f
  ['grownups/child/:cid/print/:gid', later(GU, 'printWeek')], // SB5 05e
  ['grownups/child/:cid/plan', redirect((p) => (piece(p.cid) ? 'grownups/set/child/' + piece(p.cid) : 'grownups/set'))], // SB5 TR-2
  ['grownups/child/:cid/plan/:gid', SET.changeWeek],
  ['grownups/child/:cid/rename/:gid', SET.renameWeek], // SB5 05j
  // SB4-WP5 routes
  ['words/exam/:eid', AV.examPage],
  ['words/g/:gid/quiz', AV.groupQuiz],
  [':yearId/:slug/quiz', AV.chapterQuiz],

  // SB4-WP6 routes
  ['grownups/overview', (m, p) => (roleNow() === 'teacher' ? redirect(() => 'grownups')(m, p) : SU.overview(m, p))], // TR-82: the teacher's class home is the table
  ['grownups/class', SU.overview], // UAT3 H5: the teacher's class results with Print (a week set from a year chapter has no list results page to go to)
  ['grownups/child/:cid/spelling', SU.spellingPage],
  ['grownups/child/:cid/exam', SU.examForm],
  ['grownups/child/:cid/exam/:eid', SU.examReport],

  // SB4-WP7 routes
  ['grownups/own', OV.list],
  ['grownups/own/new', OV.editor],
  ['grownups/own/ready', later(OV, 'readyLists')], // SB5 02f (before :oid)
  ['grownups/own/ready/:id', later(OV, 'readyList')], // SB5 02g (a chapter id, or y1..y6 for a year)
  ['grownups/own/ready/:id/copy', (m, p) => later(OV, 'copyPage')(m, { ready: p.id })], // SB5 02h
  ['grownups/own/:oid', later(OV, 'listPage', OV.editor)], // SB5 03a (the editor until the list page exists)
  ['grownups/own/:oid/edit', OV.editor],
  ['grownups/own/:oid/give', later(OV, 'givePage')], // SB5 03e, 03g
  ['grownups/own/:oid/copy', later(OV, 'copyPage')], // SB5 03c, 03f
  ['grownups/own/:oid/sentences', later(OV, 'sentencesPage')], // SB5 03k
  ['words/own/:oid', OV.chapter],
  ['words/own/:oid/study', OV.study],
  ['words/own/:oid/study/:word', OV.spell],
  ['words/own/:oid/quick', OV.quick],
  ['words/own/:oid/quick/:word', OV.quick],
  ['words/own/:oid/practice', OV.practice],
  ['words/own/:oid/test', OV.test],
  ['words/own/:oid/quiz', OV.quiz],

  // SB4-WP8 routes
  ['grownups/scan', SC.scan],

  // SB5 routes (TR-1, TR-82); the two teach routes only redirect (TR-2)
  ['grownups/set', SET.setWeek],
  ['grownups/set/list/:oid', SET.setWeek],
  ['grownups/set/child/:cid', SET.setWeek],
  ['grownups/own/:oid/results', RV.listResults],
  ['grownups/yourself', GU.yourself],
  ['grownups/role', GU.rolePage],
  ['grownups/help', GU.helpTable],
  ['grownups/more', GU.askMore], // SB5 (at-limit homes: Ask for more places)
  ['grownups/teach', redirect(() => (roleNow() === 'teacher' ? 'grownups' : 'grownups/own'))],
  ['grownups/teach/:oid', redirect((p) => (piece(p.oid) ? 'grownups/own/' + piece(p.oid) + '/results' : 'grownups/own'))],

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

// A year's chapter by id and slug, or (SB4-WP7) a grown-up's own chapter by params.oid, from the copy in this player's setup.
const chapterWords = (yearId, slug, params) => {
  if (params && params.oid) { const e = (S.readSetup().own || {})[safeDecode(params.oid)]; return e && !e.gone ? e.words : []; }
  return (D.chapterBySlug(yearId, slug) || { words: [] }).words.map((w) => w.word);
};

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
  // SB5 parentOf (TR-4, TR-82), before the generic grownups rule
  if (parts[0] === 'grownups' && parts[1] === 'set') {
    if (parts[2] === 'list' && parts[3]) return '#/grownups/own/' + parts[3];
    if (parts[2] === 'child' && parts[3]) return '#/grownups/child/' + parts[3];
    return '#/grownups';
  }
  if (parts[0] === 'grownups' && parts[1] === 'own' && parts[2] === 'ready') return parts.length > 4 ? '#/grownups/own/ready/' + parts[3] : parts.length > 3 ? '#/grownups/own/ready' : '#/grownups/own';
  if (parts[0] === 'grownups' && parts[1] === 'own' && parts[3] && ['results', 'edit', 'give', 'copy', 'sentences'].includes(parts[3])) return '#/grownups/own/' + parts[2];
  if (parts[0] === 'grownups' && parts[1] === 'more') return '#/grownups';
  if (parts[0] === 'grownups' && parts[1] === 'child' && parts[2] && parts[3] === 'week' && parts[4]) return '#/grownups/child/' + parts[2] + '/weeks';
  if (parts[0] === 'grownups' && parts[1] === 'child' && parts[2] && ['weeks', 'print', 'rename'].includes(parts[3])) return '#/grownups/child/' + parts[2];
  if (parts[0] === 'grownups' && (parts[1] === 'yourself' || parts[1] === 'role' || parts[1] === 'help')) return '#/grownups';
  // SB4-WP7 parentOf
  // SB4-WP8 parentOf
  if (parts[0] === 'grownups' && parts[1] === 'scan') return '#/grownups/own';
  if (parts[0] === 'words' && parts[1] === 'own' && parts.length > 3) return '#/words/own/' + parts[2];
  if (parts[0] === 'words' && parts[1] === 'own' && parts.length > 2) return '#/chapters';
  if (parts[0] === 'grownups' && parts[1] === 'own' && parts.length > 2) return '#/grownups/own';
  if (parts[0] === 'look') return '#/';
  if (parts[0] === 'custom' && parts[1] === 'play') return '#/custom';
  if (parts[0] === 'grownups') return parts.length > 3 ? '#/grownups/child/' + parts[2] : parts.length > 1 ? '#/grownups' : '#/';
  if (parts[0] === 'words' && parts.length > 3) return '#/words/g/' + parts[2];
  if (parts[0] === 'words' && parts.length > 1) return '#/words';
  if (/^y[1-6]$/.test(parts[0]) && parts.length <= 2) return '#/chapters'; // a year or a chapter page: back to More practice
  parts.pop();
  return '#/' + parts.join('/');
}

// Back with the adult's pages: an adult's own practice pages go to Play yourself (nav-doc.js), the help table goes to the table a parent
// came from (TR-82), everything else is parentOf.
function backOf(path) {
  const a = adultParent(path, kind());
  if (a) return a;
  if (path === 'grownups/help' && roleNow() === 'parent') return '#/grownups/overview';
  return parentOf(path);
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
  backBtn.onclick = () => { location.hash = backOf(path); };
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
  if (landing(path)) return;
  const found = match(path);
  if (found && (found.pattern === 'settings' || found.pattern === 'look') && !isChild()) { location.replace('#/'); return; }
  backBtn.hidden = path === '';
  backBtn.onclick = () => { location.hash = backOf(path); };
  document.querySelectorAll('.topbar__nav a, .navmenu a').forEach((a) => {
    a.toggleAttribute('aria-current', a.getAttribute('href') === '#/' + path.split('/')[0]);
    if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
  });
  if (!found) { unknownPage(path); return; }
  // SB3-G: a grown-up's week switch is off: a child's (or unknown player's) pages for another week go to the app's pick.
  if (found.pattern.startsWith('words/g/:gid')) {
    const to = weekGuard(S.readWords(), W.localDay(Date.now()), safeDecode(found.params.gid), isAdult() ? 'adult' : 'child');
    if (to) { location.replace('#/words/g/' + encodeURIComponent(to)); return; }
  }
  // A test is due: no page shows its words, so the page goes to the test instead.
  const due = testGuard(found.pattern, found.params, S.readWords(), W.localDay(Date.now()), chapterWords);
  if (due) MW.testTodayPage(main, due); else cleanup = found.view(main, found.params) || null;
  const h1 = main.querySelector('h1');
  document.title = (path && h1 ? h1.textContent + ' · ' : '') + 'Spellbright by Waystead';
}

// SB5 (TR-5, TR-82): an adult with no role and no "Not now" goes to the role page first, then home. A new device has no
// device copy yet: the account's prefs are pulled once before asking (a role chosen elsewhere is never asked again).
// S7 (FAT F-2): the role page only appears when no role exists ANYWHERE: the account's prefs must have been read (prefs.loaded) first.
// Until then (or if they cannot be read: offline) nobody is asked; a failed read is not retried in a loop, the next load asks again.
const rolePulled = new Set(); // player ids whose prefs we have tried to read this load
function landing(path) {
  if (path !== '' && path !== 'grownups') return false;
  if (!isAdult()) return false;
  let r = null;
  try { r = roles(); } catch (e) { r = null; }
  if (!r) return false;
  let ask = false;
  try { ask = r.shouldAsk(); } catch (e) { ask = false; }
  if (!ask) return false;
  const prefs = account.prefs;
  if (!prefs) return false; // the account's sync is not connected yet: the next draw asks
  if (prefs.loaded !== true) {
    const id = account.session.player.id;
    if (!rolePulled.has(id)) {
      rolePulled.add(id);
      Promise.resolve().then(() => prefs.pull()).catch(() => {}).then(() => { if (currentPath() === path) render(); });
    }
    return false;
  }
  location.replace('#/grownups/role');
  return true;
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
  // M3: once the account's prefs are read, a role chosen offline (device copy only) is sent up (role-data sendUp)
  // S7 (m-4): the account refused the settings as too large (413): said once, never retried on every change
  let refusedShown = false;
  window.addEventListener('wa:prefs-refused', () => { if (refusedShown) return; refusedShown = true; try { toast('Your account is full, so your choices are kept on this device only. They will not follow you to another device.'); } catch (e) { /* no toast */ } });
  window.addEventListener('wa:prefs', () => { try { const r = roles(); if (r) r.get(); } catch (e) { /* ignore */ } });
  useAdultTools({ origin: () => account.origin, player: () => account.session.player, prefs: () => account.prefs }); // SB5 (TR-80): the role is kept in the account
  SET.useSetTools({ prefs: () => account.prefs });
  useVoiceAccount(() => (account ? { origin: account.origin, signedIn: !!account.session.player } : null));
  account.session.on(() => { if (voiceMenu) voiceMenu.redraw(); });
  // /api/me says what kind of player this is; the cached player can't. It decides
  // the home page, so draw it again once that's known.
  // S7 (F-1): offline, a cached player this device last heard to be a grown-up is shown the grown-up pages from the device (see who.js).
  const lsGet = (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch (e) { /* no storage: the offline page shows */ } };
  useWho(() => account.session.player, () => account.session.refresh(), {
    reach: () => { const r = account.session.reach; return r === 'unknown' && typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : r; },
    adultMark: (id) => lsGet(ADULT_KEY + id) === '1',
  });
  account.ready.then((r) => {
    answered = true;
    if (!drawn) return;
    chrome();
    if (r && r.offline && /^(grownups|chapters$|$)/.test(currentPath())) render(); // the first draw waited for the account: draw again from the device
  });
  setTimeout(() => { waitedOut = true; releaseBar(); if (drawn) chrome(); }, 2500);
  let knownKind = '';
  account.session.on(({ player, prev }) => {
    const k = (player && player.kind) || '';
    if (player && player.id) lsSet(ADULT_KEY + player.id, k === 'adult' ? '1' : null); // S7: only a live answer says "grown-up"
    if (!player && prev && prev.id) lsSet(ADULT_KEY + prev.id, null);
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
  wireChrome({ currentPath, parentOf: backOf });
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
