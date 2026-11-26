// SB6-WP-8 (TRS TR-52 to TR-56, D10, D12, D15, D16): the picture screens.
//   Grown-up: the rows of a word list with their pictures (mountRows), the grid of pictures to check (picturesPage), the Word pictures card
//   (picturesCard), the first-time line and "ask for pictures after a list is saved" (savedNote), the swap question (asked EVERY time).
//   Child: loadApproved(words) once per page load puts the grown-up's APPROVED pictures in ui.js's map; nothing else is ever drawn for a child.
// The rules and the strings a grown-up reads are in pictures-doc.js (pure); the account's calls are in pictures-data.js; the saving flow in own-data.js.
// Ships OFF (PICTURES_API = false): picturesOn() is false, so no row, card or request exists. The smoke turns it on against the fake account only,
// on localhost, with localStorage `sb.picturesTest` ('fast' also polls every 0.3 s).
import * as S from './store.js';
import * as W from './words-doc.js';
import * as Ow from './own-doc.js';
import * as D from './own-data.js';
import * as PD from './pictures-doc.js';
import { createPictures, PICTURES_API, askable, WORD_RE } from './pictures-data.js';
import { createRoleStore } from './role-data.js';
import { findEntry } from './word-info.js';
import { adultOnly } from './grownups-views.js';
import { isAdult } from './who.js';
import { esc, setApprovedPictures } from './ui.js';
import { accountOrigin } from './account/config.js';
import { createCredits, creditsCardHtml, wireRedeem, NETWORK } from './credits/credits.js';

const enc = encodeURIComponent;
const LIST = '#/grownups/own';
const POLL_MS = 5000;
const POLL_STOP_MS = 3 * 60 * 1000;
const svg = (inner) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
const ICON = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  img: svg('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10.5" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>'),
  trash: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
};

// ---- the strings (grown-up copy) ------------------------------------------------------------------------------------------------
export const TEXT = {
  making: 'Making a picture…',
  ready: 'Picture ready: check it',
  inUse: 'Picture in use',
  none: 'No picture yet',
  notMade: 'Not made yet',
  waiting: 'Waiting',
  unsuitable: 'This word works better without a picture',
  refused: 'We cannot make a picture for this word.',
  included: 'Picture included',
  card: 'Sentence card in use',
  add: 'Add a picture',
  make: 'Make picture',
  check: 'Check it',
  checkAll: 'Check them all',
  change: 'Change picture',
  remove: 'Remove picture',
  keep: 'Keep it',
  use: 'Use',
  useAll: 'Use all',
  useThis: 'Use this picture',
  another: 'Make another',
  noPicture: 'No picture',
  yes: 'Yes',
  notNow: 'Not now',
  makePictures: 'Make pictures',
  removeTitle: 'Remove this picture?',
  removeBody: 'Children will see the sentence card again. The picture is deleted.',
  gridTitle: 'Pictures to check',
  gridNone: 'No pictures to check.',
  stillMaking: 'Still making: come back later.',
  offline: 'Pictures are made when you are back online. Your list is saved.',
  hourly: 'You have made a lot of pictures this hour. Try again in a little while.',
  paused: 'Pictures are paused for now. Try again later.',
  other: 'We could not make a picture just now. Try again in a little while.',
  notThere: 'That picture is not there any more.',
  firstTitle: 'Pictures for your words',
  firstOff: 'No pictures for now. You can add one from the list at any time.',
  swapped: 'Done. You now have more word pictures.',
  swapButton: (rate) => 'Use 1 story credit for ' + rate + ' word pictures',
  checkLine: (n) => n + (n === 1 ? ' picture' : ' pictures') + ' to check.',
  makingLine: (n) => 'Making ' + (n === 1 ? 'a picture' : n + ' pictures') + '.',
  waitingLine: (n) => n + (n === 1 ? ' word is' : ' words are') + ' waiting for a picture.',
  swapBody: (n, credits) => (n === 0 ? '' : (n === 1 ? '1 word is' : n + ' words are') + ' waiting. ') + 'You have ' + credits + ' story ' + (credits === 1 ? 'credit' : 'credits') + '. Nothing is used unless you say yes.',
  moreLeft: (n) => 'Make another (' + n + ' left)',
  see: { parent: 'Children see a picture only after you use it.', tutor: 'Your learners see a picture only after you use it.', teacher: 'Pupils in your class see a picture only after you use it.' },
  hint: 'Children see it only after you tap Use this picture.',
};
export const roleSee = (role) => TEXT.see[role] || TEXT.see.parent;

// ---- the client, on or off ----------------------------------------------------------------------------------------------------
let client = null;
let creditsClient = null;
/** Tests hand in a client (createPictures over the fake account). */
export const usePictures = (c) => { client = c; };
export const useCredits = (c) => { creditsClient = c; };
const flag = () => { try { return window.localStorage.getItem('sb.picturesTest'); } catch (e) { return null; } };
/** The smoke only: localhost with the test key. Never true on the real site. */
const testOn = () => typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !!flag();
export const picturesOn = () => PICTURES_API || !!client || testOn();
const pollMs = () => (flag() === 'fast' ? 300 : POLL_MS);
export function pictures() {
  if (!client) client = createPictures({ origin: accountOrigin(location), enabled: picturesOn(), child: () => !isAdult() });
  return client;
}
const credits = () => creditsClient || (creditsClient = createCredits({ origin: accountOrigin(location) }));

let cssDone = false;
/** The stylesheet comes with the first grown-up picture screen (index.html and the shell list are WP-9's), so the shipped-off feature costs nothing. */
function ensureCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  if (document.querySelector('link[data-pictures-css]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'css/pictures.css';
  l.setAttribute('data-pictures-css', '');
  document.head.append(l);
}

// ---- what a child gets (TR-53) -----------------------------------------------------------------------------------------------
/**
 * Once per page load: the approved pictures of these words (A6), into ui.js's map. Never allowance data. Off, offline, signed out or slow: the map is empty
 * and every own word keeps its sentence card. A child session makes this one call and none of A1 to A5 or A8 to A10.
 */
export async function loadApproved(words, { timeoutMs = 2500 } = {}) {
  const list = askable(words);
  if (!picturesOn() || !list.length) { setApprovedPictures(new Map()); return new Map(); }
  const p = pictures();
  const map = await Promise.race([p.approved(list), new Promise((r) => setTimeout(() => r(null), timeoutMs))]);
  if (!map || map.problem) { setApprovedPictures(map && map.size ? map : new Map(), (id) => p.imageUrl(id)); return map || new Map(); }
  setApprovedPictures(map, (id) => p.imageUrl(id));
  return map;
}

// ---- a small dialog (the same look as the other grown-up dialogs) ------------------------------------------------------------
function dialog({ title, bodyHtml, actions, label }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gu-overlay pv-overlay';
    overlay.innerHTML = '<div class="gu-dialog" role="dialog" aria-modal="true" aria-labelledby="pv-dt" aria-label="' + esc(label || title) + '" data-dialog><h2 id="pv-dt">' + esc(title) + '</h2>' + bodyHtml
      + '<div class="btnrow">' + actions.map((a) => '<button type="button" class="btn ' + (a.cls || 'btn--ghost') + '" data-act="' + a.id + '">' + esc(a.label) + '</button>').join('') + '</div></div>';
    const prior = document.activeElement;
    const inert = [...document.body.children].filter((e) => !e.hasAttribute('inert'));
    inert.forEach((e) => e.setAttribute('inert', ''));
    document.body.appendChild(overlay);
    const root = overlay.querySelector('.gu-dialog');
    const close = (answer) => {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('hashchange', away);
      overlay.remove();
      inert.forEach((e) => e.removeAttribute('inert'));
      if (prior && prior.focus && document.contains(prior)) prior.focus();
      resolve(answer);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(null); return; }
      if (e.key !== 'Tab') return;
      const f = [...root.querySelectorAll('button:not(:disabled)')];
      const at = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    };
    const away = () => close(null);
    window.addEventListener('hashchange', away);
    document.addEventListener('keydown', onKey, true);
    root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => close(b.dataset.act)));
    root.querySelector('[data-act]').focus();
  });
}
/** D16: the question, asked every time, with the account's rate. Yes only when the grown-up taps Yes. */
export async function askSwap({ rate, credits: have = 0, waiting = 1 }) {
  const q = PD.swapQuestion(rate);
  if (!q) return false;
  const a = await dialog({ title: q, label: 'Use a story credit', bodyHtml: '<p data-swap-body>' + esc(TEXT.swapBody(waiting, have)) + '</p>', actions: [{ id: 'yes', label: TEXT.yes, cls: 'btn--primary' }, { id: 'no', label: TEXT.notNow }] });
  return a === 'yes';
}

// ---- first time on this device (BR-19 AC3) -----------------------------------------------------------------------------------
const playerId = () => { try { const p = JSON.parse(window.localStorage.getItem('wa.player')); return p && p.id ? String(p.id) : ''; } catch (e) { return ''; } };
const seenKey = () => 'sb.picsSeen:' + playerId();
const seenGet = () => { try { return window.localStorage.getItem(seenKey()); } catch (e) { return null; } };
const seenSet = (v) => { try { window.localStorage.setItem(seenKey(), v); } catch (e) { /* the question comes back next time */ } };
/** true: go on; false: not now. Asked once per device and grown-up; the answer is kept on this device only. */
export async function firstTime() {
  if (seenGet() === 'yes') return true;
  const a = await dialog({ title: TEXT.firstTitle, label: TEXT.firstTitle, bodyHtml: '<p data-first-line>' + esc(PD.firstTimeLine) + '</p>', actions: [{ id: 'yes', label: TEXT.makePictures, cls: 'btn--primary' }, { id: 'no', label: TEXT.notNow }] });
  seenSet(a === 'yes' ? 'yes' : 'no');
  return a === 'yes';
}

function roleNow() {
  try {
    const id = playerId();
    return id ? createRoleStore({ storage: window.localStorage, playerId: id }).role() : 'parent';
  } catch (e) { return 'parent'; }
}
const isReadyWord = (w) => !!findEntry(w);
const masterFor = (oid) => (D.validOid(oid) ? Ow.normalise(W.ownOf(S.readWords()))[oid] || null : null);

/** What a problem says to a grown-up (never a code, never "error"). */
export function problemLine(problem, a) {
  if (problem === 'hourly-limit') return TEXT.hourly;
  if (problem === 'paused') return TEXT.paused;
  if (problem === 'offline' || problem === 'timeout') return TEXT.offline;
  if (problem === 'no-pictures-left' || problem === 'no-credits') return PD.allowanceLine(a) || TEXT.other;
  if (problem === 'refused') return TEXT.refused;
  if (problem === 'gone' || problem === 'not-ready') return TEXT.notThere;
  return TEXT.other;
}

// ---- the picture tile: the account's image, or a still tile when it will not load ------------------------------------------------
const still = '<span class="pv-pic pv-pic--still" aria-hidden="true">' + ICON.img + '</span>';
function thumb(p, word, id, size = 'sm') {
  const url = id ? p.imageUrl(id) : '';
  if (!url) return still;
  return '<span class="pv-pic pv-pic--' + size + '" data-pic-id="' + esc(id) + '"><img src="' + esc(url) + '" alt="Picture for ' + esc(word) + '" decoding="async" data-pvimg></span>';
}
if (typeof document !== 'undefined') {
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.hasAttribute('data-pvimg')) return;
    const box = img.parentElement;
    if (box) { box.classList.add('pv-pic--still'); box.setAttribute('data-pic-broken', ''); }
    img.outerHTML = ICON.img;
  }, true);
}

// ---- the list's rows, the grid and the check sheet ----------------------------------------------------------------------------
/**
 * Mount the picture rows of one word list into `host`. opts: { words, oid, role, isReady, view: 'rows' | 'grid', onClose }.
 * Answers a stop() function. Draws nothing when the account says off (the plain word chips stay).
 */
export function mountRows(host, { words, oid = '', role = 'parent', isReady = isReadyWord, view: first = 'rows' } = {}) {
  ensureCss();
  const p = pictures();
  let stopped = false;
  let a = null; // A1
  let items = new Map(); // word -> A3 item
  let view = first; // 'rows' | 'grid' | 'check' | 'remove'
  let cur = '';
  let line = null; // { text, kind }
  let busy = false;
  let loaded = false;
  let timer = null;
  let since = 0;
  let gaveUp = false;
  const refused = new Set();
  const waitingSwap = new Set();
  const listWords = [...new Set((words || []).map((w) => String(w)))];
  const keyOf = (w) => w.toLowerCase();
  const keys = askable(listWords);
  host.classList.add('pv');
  host.setAttribute('data-pictures', '');

  const state = (k) => (refused.has(k) ? 'refused' : PD.rowState(k, items));
  const idOfUse = (k) => (items.get(k) && items.get(k).approved ? items.get(k).approved.id : null);
  const candOf = (k) => (items.get(k) && items.get(k).candidate ? items.get(k).candidate.id : null);
  const model = () => PD.gridModel(items);
  const capacity = () => !!a && a.on === true && !a.paused && (a.unlimited || a.left > 0 || a.credits > 0);
  const leftLabel = () => (a && a.on === true && !a.unlimited && Number.isInteger(a.left) ? TEXT.moreLeft(a.left) : TEXT.another);

  function lineHtml() { return line ? '<p class="pv-note pv-note--' + (line.kind || 'soft') + '" role="status" data-pv-line>' + (line.kind === 'clock' ? ICON.clock : ICON.info) + '<span>' + esc(line.text) + '</span></p>' : ''; }
  const btn = (act, label, cls = 'btn--ghost', extra = '') => '<button type="button" class="btn ' + cls + '" data-act="' + act + '"' + extra + '>' + esc(label) + '</button>';

  function rowHtml(w) {
    const k = keyOf(w);
    if (!WORD_RE.test(k)) return '<div class="pv-row" data-word="' + esc(w) + '">' + still + '<div class="pv-grow"><b>' + esc(w) + '</b><span class="pv-mut">' + esc(TEXT.card) + '</span></div></div>';
    if (isReady(w) && !items.has(k)) return '<div class="pv-row" data-word="' + esc(w) + '">' + still + '<div class="pv-grow"><b>' + esc(w) + '</b><span class="pv-mut">' + esc(TEXT.included) + '</span></div></div>';
    const s = state(k);
    const name = (t) => '<div class="pv-grow"><b>' + esc(w) + '</b><span class="pv-mut" data-state="' + s + '">' + esc(t) + '</span></div>';
    const wrap = (inner, extra = '') => '<div class="pv-row' + extra + '" data-word="' + esc(w) + '" data-state="' + s + '">' + inner + '</div>';
    if (s === 'making') return wrap(still + name(TEXT.making));
    if (s === 'check') {
      const useId = idOfUse(k);
      return wrap(thumb(p, w, candOf(k)) + name(TEXT.ready) + btn('check', TEXT.check, 'btn--primary', ' data-w="' + esc(k) + '" aria-label="' + esc(TEXT.check + ': ' + w) + '"')
        + (useId ? '<span class="pv-mut pv-sub">' + esc(TEXT.inUse) + '</span>' : ''));
    }
    if (s === 'in-use') {
      return wrap(thumb(p, w, idOfUse(k), 'md') + name(TEXT.inUse), ' pv-row--use')
        + '<div class="pv-btns">' + btn('change', TEXT.change, 'btn--ghost', ' data-w="' + esc(k) + '" aria-label="' + esc(TEXT.change + ': ' + w) + '"') + btn('remove', TEXT.remove, 'btn--ghost pv-danger', ' data-w="' + esc(k) + '" aria-label="' + esc(TEXT.remove + ': ' + w) + '"') + '</div>';
    }
    if (s === 'unsuitable') return wrap(still + name(TEXT.unsuitable));
    if (s === 'refused') return wrap(still + name(TEXT.refused));
    const can = !a || a.on !== true ? false : !a.paused && (a.unlimited || a.left > 0 || a.credits > 0);
    const label = waitingSwap.has(k) ? TEXT.make : TEXT.add;
    return wrap(still + name(s === 'failed' ? TEXT.notMade : navigator.onLine === false ? TEXT.waiting : TEXT.none)
      + (can ? btn('ask', label, 'btn--ghost', ' data-w="' + esc(k) + '" aria-label="' + esc(label + ': ' + w) + '"') : ''));
  }

  function rowsHtml() {
    const m = model();
    const mine = (list) => list.filter((x) => keys.includes(typeof x === 'string' ? x : x.word));
    const check = mine(m.check);
    const top = check.length
      ? '<p class="pv-checkline" data-check-line><span>' + ICON.img + '</span><b>' + esc(TEXT.checkLine(check.length)) + '</b>'
        + '<a class="btn btn--primary" href="#/grownups/pictures/list/' + enc(oid) + '" data-act="grid">' + esc(TEXT.checkAll) + '</a></p>'
      : '';
    return lineHtml() + top + '<div class="pv-rows" data-rows>' + listWords.map(rowHtml).join('') + '</div>';
  }

  function cardHtml(w, id) {
    const k = w.word;
    return '<div class="pv-gcard" data-gcard="' + esc(k) + '">' + thumb(p, k, id, 'lg') + '<b>' + esc(k) + '</b>'
      + btn('use', TEXT.use, 'btn--primary', ' data-w="' + esc(k) + '" aria-label="' + esc(TEXT.use + ': ' + k) + '"')
      + btn('another', leftLabel(), 'btn--ghost', ' data-w="' + esc(k) + '"' + (a && a.on === true && !a.unlimited && a.left === 0 && a.credits === 0 ? ' disabled' : '') + ' aria-label="' + esc(leftLabel() + ': ' + k) + '"')
      + btn('none', TEXT.noPicture, 'btn--ghost', ' data-w="' + esc(k) + '" aria-label="' + esc(TEXT.noPicture + ': ' + k) + '"') + '</div>';
  }

  function gridHtml() {
    const m = model();
    const check = m.check.filter((x) => keys.includes(x.word));
    const making = m.making.filter((w) => keys.includes(w));
    return lineHtml() + '<h1 class="pv-h" tabindex="-1" data-grid-title>' + esc(check.length ? TEXT.checkLine(check.length).replace(/\.$/, '') : TEXT.gridTitle) + '</h1>'
      + (check.length ? '<button type="button" class="btn btn--primary pv-useall" data-act="use-all">' + esc(TEXT.useAll) + '</button>' : '<p class="pv-mut" data-grid-empty>' + esc(making.length ? TEXT.making : TEXT.gridNone) + '</p>')
      + '<div class="pv-grid" data-grid>' + check.map((x) => cardHtml(x, x.id)).join('')
      + making.map((w) => '<div class="pv-gcard pv-gcard--making" data-gcard="' + esc(w) + '">' + still + '<b>' + esc(w) + '</b><span class="pv-mut">' + esc(TEXT.making) + '</span></div>').join('') + '</div>'
      + '<p class="pv-help">' + esc(roleSee(role)) + '</p>'
      + '<p><button type="button" class="btn btn--ghost" data-act="rows">' + esc('Back to the list') + '</button></p>';
  }

  function checkHtml() {
    const id = candOf(cur);
    return lineHtml() + '<h1 class="pv-h" tabindex="-1" data-check-title>' + esc(cur) + '</h1><div class="pv-sheetpic">' + thumb(p, cur, id, 'xl') + '</div>'
      + '<div class="pv-btns pv-btns--col">' + btn('use', TEXT.useThis, 'btn--primary pv-big', ' data-w="' + esc(cur) + '"') + btn('another', leftLabel(), 'btn--ghost', ' data-w="' + esc(cur) + '"') + btn('none', TEXT.noPicture, 'btn--ghost', ' data-w="' + esc(cur) + '"') + '</div>'
      + '<p class="pv-help">' + esc(TEXT.hint) + '</p><p><button type="button" class="btn btn--ghost" data-act="rows">Back to the list</button></p>';
  }

  function removeHtml() {
    return '<div class="pv-row pv-row--use" data-word="' + esc(cur) + '">' + thumb(p, cur, idOfUse(cur), 'md') + '<div class="pv-grow"><b>' + esc(cur) + '</b><span class="pv-mut">' + esc(TEXT.inUse) + '</span></div></div>'
      + '<div class="pv-sheet" role="dialog" aria-label="' + esc(TEXT.remove) + '" data-remove-sheet><h2 tabindex="-1">' + esc(TEXT.removeTitle) + '</h2><p>' + esc(TEXT.removeBody) + '</p>'
      + '<div class="pv-btns pv-btns--col">' + btn('keep', TEXT.keep, 'btn--primary pv-big') + btn('remove-yes', TEXT.remove, 'btn--ghost pv-danger pv-big', ' data-w="' + esc(cur) + '"') + '</div></div>';
  }

  function chipsHtml() { return '<ul class="ls-chips" data-words>' + listWords.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>'; }

  function draw(focus) {
    if (stopped) return;
    if (loaded && a && a.on !== true) { host.innerHTML = chipsHtml(); return; } // P14: the feature is off: no picture rows
    host.innerHTML = !loaded ? '<p class="pv-mut" data-pv-loading>Finding pictures…</p>' : view === 'grid' ? gridHtml() : view === 'check' ? checkHtml() : view === 'remove' ? removeHtml() : rowsHtml();
    host.setAttribute('data-view', view);
    if (focus) { const f = host.querySelector(focus); if (f) { f.setAttribute('tabindex', f.getAttribute('tabindex') || '-1'); f.focus({ preventScroll: true }); } }
  }

  async function refresh() {
    const st = keys.length ? await p.states(keys) : { items: [] };
    if (stopped) return;
    if (st.problem) {
      if (st.problem === 'offline' || st.problem === 'timeout') line = { text: TEXT.offline, kind: 'info' };
      else if (st.problem === 'off') a = { problem: 'off', on: false };
      return;
    }
    items = new Map(st.items.map((it) => [it.word, it]));
    if (line && line.sticky !== true && line.kind !== 'clock') line = null;
  }
  async function load() {
    const [al] = await Promise.all([p.allowance(), refresh()]);
    if (stopped) return;
    a = al.problem ? (al.problem === 'off' ? { on: false } : null) : al;
    if (!a && al.problem && al.problem !== 'off') line = line || { text: problemLine(al.problem, null), kind: 'info' };
    loaded = true;
    if (!a && navigator.onLine === false) line = { text: TEXT.offline, kind: 'info', sticky: true };
    draw();
    poll();
  }

  function poll() {
    clearInterval(timer);
    if (stopped || !model().anyMaking) { since = 0; return; }
    if (!since) since = Date.now();
    timer = setInterval(async () => {
      if (stopped || !host.isConnected) { stop(); return; }
      if (Date.now() - since > POLL_STOP_MS) { clearInterval(timer); gaveUp = true; line = { text: TEXT.stillMaking, kind: 'info' }; draw(); return; }
      if (busy) return;
      const before = model().check.length;
      await refresh();
      if (stopped) return;
      if (!model().anyMaking) { clearInterval(timer); since = 0; }
      if (model().check.length !== before || !model().anyMaking) draw();
    }, pollMs());
  }
  function stop() { stopped = true; clearInterval(timer); }

  /** One word's ask, with the first-time line and the swap question. */
  async function askWord(w) {
    if (seenGet() === null) { const go = await firstTime(); if (!go || stopped) return; }
    seenSet('yes');
    let r = await p.ask(w);
    if (r.problem === 'swap-needed') {
      const yes = await askSwap({ rate: r.rate, credits: r.credits, waiting: 1 });
      if (stopped) return;
      if (!yes) { waitingSwap.add(w); return; }
      r = await p.ask(w, { swap: true });
    }
    if (r.problem === 'refused') { refused.add(w); return; }
    if (r.problem && r.problem !== 'already-making') { line = { text: problemLine(r.problem, a), kind: r.problem === 'hourly-limit' ? 'clock' : 'info' }; return; }
    waitingSwap.delete(w);
  }
  /** "Make another" and "Change picture": the same swap question, asked every time. */
  async function anotherFor(id) {
    let r = await p.decide(id, 'another');
    if (r.problem === 'swap-needed') {
      const yes = await askSwap({ rate: r.rate, credits: r.credits, waiting: 1 });
      if (stopped) return null;
      if (!yes) return null;
      r = await p.decide(id, 'another', { swap: true });
    }
    if (r.problem) { line = { text: problemLine(r.problem, a), kind: r.problem === 'hourly-limit' ? 'clock' : 'info' }; return null; }
    return r;
  }
  async function afterChange(nextView, focus) {
    const [al] = await Promise.all([p.allowance(), refresh()]);
    if (stopped) return;
    if (!al.problem) a = al;
    view = nextView || view;
    since = 0;
    draw(focus);
    poll();
  }

  async function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || !host.contains(b) || b.disabled) return;
    const act = b.dataset.act;
    const w = b.dataset.w || '';
    if (act === 'grid' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); view = 'grid'; line = null; draw('[data-grid-title]'); return; }
    if (act === 'rows') { view = 'rows'; line = null; draw(); return; }
    if (act === 'check') { cur = w; view = 'check'; line = null; draw('[data-check-title]'); return; }
    if (act === 'keep') { view = 'rows'; draw(); return; }
    if (act === 'remove') { cur = w; view = 'remove'; draw('[data-remove-sheet] h2'); return; }
    if (busy) return;
    busy = true;
    b.disabled = true;
    try {
      if (act === 'ask') { await askWord(w); await afterChange('rows'); }
      else if (act === 'use') {
        const r = await p.decide(candOf(w), 'use');
        if (r.problem) line = { text: problemLine(r.problem, a), kind: 'info' };
        await afterChange(view === 'check' ? 'rows' : view);
      } else if (act === 'none') {
        const r = await p.decide(candOf(w), 'none');
        if (r.problem) line = { text: problemLine(r.problem, a), kind: 'info' };
        await afterChange(view === 'check' ? 'rows' : view);
      } else if (act === 'another') {
        await anotherFor(candOf(w));
        await afterChange(view === 'check' ? 'rows' : view);
      } else if (act === 'change') {
        await anotherFor(idOfUse(w));
        await afterChange('rows');
      } else if (act === 'use-all') {
        const ids = model().check.filter((x) => keys.includes(x.word)).map((x) => x.id);
        const r = await p.decideAll(ids);
        if (r.problem) line = { text: problemLine(r.problem, a), kind: 'info' };
        else if (r.items.some((x) => x.error)) line = { text: TEXT.notThere, kind: 'info' };
        await afterChange('grid', '[data-grid-title]');
      } else if (act === 'remove-yes') {
        const r = await p.remove(w);
        if (r.problem && r.problem !== 'gone') line = { text: problemLine(r.problem, a), kind: 'info' };
        await afterChange('rows');
      }
    } finally { busy = false; }
  }
  host.addEventListener('click', onClick);
  draw();
  load();
  return () => { stop(); host.removeEventListener('click', onClick); };
}

// ---- the page of pictures to check (TR-52 `picturesPage`) -------------------------------------------------------------------
const wrap = (title, body, attr = '') => '<section class="wrap page grownups gu ls pv-page"' + attr + '><div class="pagehead"><span class="eyebrow">Grown-ups</span><h1 tabindex="-1">' + esc(title) + '</h1></div>' + body + '</section>';
const back = (href, text, attr = '') => '<a class="gu-back" href="' + href + '"' + attr + '>' + ICON.back + esc(text) + '</a>';
const offCard = (main) => {
  main.innerHTML = wrap('Pictures', '<div class="card gu-panel" data-pictures-off><p class="muted">Word pictures are not open yet.</p></div>' + back(LIST, 'Word lists'));
};

/** `#/grownups/pictures/list/:oid`: every picture to check on one screen, with Use all. */
export function picturesPage(main, { oid: given } = {}) {
  if (!adultOnly(main)) return undefined;
  ensureCss();
  if (!picturesOn()) { offCard(main); return undefined; }
  const oid = D.safeDecode(given || '');
  const e = masterFor(oid);
  if (!e || e.gone) {
    main.innerHTML = wrap('That list isn’t here', '<p class="muted">It may have been deleted, or the link is old.</p>' + back(LIST, 'Back to Word lists'));
    return undefined;
  }
  main.innerHTML = '<section class="wrap page grownups gu ls pv-page" data-pictures-page>' + back(LIST + '/' + enc(oid), e.name, ' data-back-list') + '<div class="pv-host" data-pictures-host></div></section>';
  const stop = mountRows(main.querySelector('[data-pictures-host]'), { words: e.words, oid, role: roleNow(), view: 'grid' });
  return stop;
}

// ---- the Word pictures card (TR-52, P7 to P10) --------------------------------------------------------------------------------
/** `#/grownups/pictures`: plan, pictures left, story credits, the one redeem form and History. */
export function picturesCard(main) {
  if (!adultOnly(main)) return undefined;
  ensureCss();
  if (!picturesOn()) { offCard(main); return undefined; }
  let stopped = false;
  const p = pictures();
  let note = null;
  const head = (inner) => '<section class="wrap page grownups gu ls pv-page" data-pictures-card>' + back(LIST, 'Word lists') + '<div class="pagehead"><span class="eyebrow">Grown-ups</span><h1 tabindex="-1">Word pictures</h1></div>' + inner + '</section>';
  main.innerHTML = head('<p class="muted">Finding your pictures…</p>');
  const kv = (rows) => '<dl class="pv-kv">' + rows.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl>';
  const noteHtml = () => (note ? '<p class="pv-note pv-note--' + (note.kind || 'soft') + '" role="status" data-pv-line>' + ICON.info + '<span>' + esc(note.text) + '</span></p>' : '');
  async function draw() {
    const [a, fam] = await Promise.all([p.allowance(), credits().family()]);
    if (stopped) return;
    if (a.problem) {
      main.innerHTML = head('<div class="card gu-panel" data-problem="' + esc(a.problem) + '"><p class="muted">' + esc(a.problem === 'off' ? 'Word pictures are not open yet.' : problemLine(a.problem, null)) + '</p>'
        + (a.problem === 'off' ? '' : '<button type="button" class="btn btn--primary" data-retry>Try again</button>') + '</div>');
      const r = main.querySelector('[data-retry]');
      if (r) r.addEventListener('click', () => { main.innerHTML = head('<p class="muted">Finding your pictures…</p>'); draw(); });
      return;
    }
    const rows = [];
    if (a.unlimited) rows.push(['Word pictures', 'No limit']);
    else {
      rows.push(['Plan', a.plan ? a.plan.name + ', ' + a.plan.monthly + ' a month' : 'No plan']);
      if (a.trial) rows.push(['Free trial', a.trial.left + ' left until ' + PD.trialLine(a).replace(/^.* until /, '').replace(/\.$/, '')]);
      rows.push([a.plan ? 'Left this month' : 'Word pictures left', String(a.left)]);
      rows.push(['Story credits', String(a.credits)]);
    }
    const headline = !a.unlimited && (a.paused || (a.left === 0 && a.credits === 0)) ? PD.allowanceLine(a) : '';
    const canSwap = !a.unlimited && !a.paused && a.credits > 0 && PD.swapQuestion(a.rate);
    const swap = canSwap ? '<p><button type="button" class="btn btn--ghost" data-swap>' + esc(TEXT.swapButton(a.rate)) + '</button></p>' : '';
    const help = a.unlimited ? '<p class="pv-help" data-unlimited-help>' + esc(PD.UNLIMITED_HELP) + '</p>' : a.rate ? '<p class="pv-help">One story credit is one story, or ' + esc(a.rate) + ' word pictures. Nothing is used unless you say yes.</p>' : '';
    const famHtml = fam && fam.ok && fam.data ? creditsCardHtml(fam.data, { product: 'spellbright', unlimited: !!a.unlimited }) : '<p class="muted" data-credits-problem>' + esc(NETWORK) + '</p>';
    main.innerHTML = head((headline ? '<p class="pv-note pv-note--soft" role="status" data-pv-line>' + ICON.info + '<span>' + esc(headline) + '</span></p>' : '') + noteHtml()
      + '<section class="card gu-panel pv-card" aria-label="Word pictures" data-allowance><h2>Word pictures</h2>' + kv(rows) + help + swap + '<div data-creditslot>' + famHtml + '</div></section>');
    const slot = main.querySelector('[data-creditslot]');
    wireRedeem(slot, credits(), (msg) => { note = { text: msg, kind: 'ok' }; draw(); });
    const sw = main.querySelector('[data-swap]');
    if (sw) sw.addEventListener('click', async () => {
      sw.disabled = true;
      const yes = await askSwap({ rate: a.rate, credits: a.credits, waiting: 0 });
      if (stopped) return;
      if (yes) { const r = await p.swap({ yes: true }); note = r.problem ? { text: problemLine(r.problem, a), kind: 'soft' } : { text: TEXT.swapped, kind: 'ok' }; }
      draw();
    });
  }
  draw();
  return () => { stopped = true; };
}

// ---- after a list is saved (TR-52, D15) -----------------------------------------------------------------------------------------
/**
 * Called by the editor's "List saved" page: asks for a picture of each own word with none (never swaps by itself) and says what happened in `host`.
 * Offline: the list is saved and the pictures wait. Not now at the first-time line or at a swap: nothing is spent.
 */
export async function savedNote(host, { words, oid }) {
  if (!picturesOn() || !host) return null;
  ensureCss();
  const say = (text, kind = 'soft', extra = '') => { if (host.isConnected) host.innerHTML = '<p class="pv-note pv-note--' + kind + '" role="status" data-pictures-note>' + (kind === 'clock' ? ICON.clock : ICON.img) + '<span>' + esc(text) + '</span>' + extra + '</p>'; };
  if (navigator.onLine === false) { say(TEXT.offline, 'info'); return { offline: true }; }
  const p = pictures();
  const open = '<a class="pv-link" href="' + LIST + '/' + enc(oid) + '" data-pictures-link>See the list</a>';
  if (seenGet() === null) {
    const go = await firstTime();
    if (!go) { say(TEXT.firstOff, 'info'); return { notNow: true }; }
  } else if (seenGet() === 'no') { say(TEXT.firstOff, 'info'); return { notNow: true }; }
  const r = await D.makePictures(p, { words, isReady: isReadyWord, confirmSwap: askSwap });
  if (r.off) { host.innerHTML = ''; return r; }
  if (r.noneLeft) { say(PD.allowanceLine({ on: true, left: 0, credits: 0 }), 'info'); return r; }
  if (r.problem) { say(problemLine(r.problem, null), r.problem === 'hourly-limit' ? 'clock' : 'info'); return r; }
  const bits = [];
  if (r.made.length) bits.push(TEXT.makingLine(r.made.length));
  if (r.waiting.length) bits.push(TEXT.waitingLine(r.waiting.length));
  if (r.refused.length) bits.push(TEXT.refused);
  if (!bits.length) { host.innerHTML = ''; return r; }
  say(bits.join(' '), 'soft', open);
  return r;
}
