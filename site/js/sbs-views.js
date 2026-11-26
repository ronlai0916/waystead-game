// The child's Step by step screens (SB6, TR-43, WP-6): Meet the words, the Letter ladder, Words in a row and Mend, one sitting at a time.
// Views and the runner only: every rule is in the pure modules (ladder-doc, session-doc, rows-doc, runs-doc, sbs-week-doc). The runner loops
//   item = SD.nextItem(sitting, ctx, now) -> show it -> sitting = SD.afterItem(sitting, outcome, now, ctx) -> write SD.triesOf(...) UNCHANGED through W.addTry.
// Calm by design: no timer on screen, no red, no cross, no sound effect, no confetti, nothing taken away on a slip (no petals here), transitions at most 150 ms,
// a still ring at the end (a "bigger" ring when the grown-up chose it). Tap only: no drag handlers (enableDrag is never called).
// Layout (design Rounds 1-3): one bottom-anchored block (boxes with the word's own Hear, Peek and Undo, tiles or keys, Check) under a spare-space area
// (progress, the one instruction, the picture). Long words go on two lines at a chunk boundary; rows are bottom-aligned cards above Peek.
import * as S from './store.js';
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as K from './sbs-week-doc.js';
import * as R from './rows-doc.js';
import * as Runs from './runs-doc.js';
import * as L from './ladder-doc.js';
import * as SD from './session-doc.js';
import * as Su from './setup-doc.js';
import * as T from './tiles-doc.js';
import * as D from './data.js';
import * as Tr from './tray.js';
import { RULES } from './sbs-rules.js';
import { mountPeek } from './peek.js';
import { mountTileKeys, pressCheck, tileForLetter } from './tile-keys.js';
import { speak, sayLine, spellOut, stop as stopSpeech } from './speech.js';
import { esc, picture, pictureState } from './ui.js';
import { entryFor, findEntry, meaningsFor } from './word-info.js';
import { childYear } from './who.js';
import { useSbsChrome, markSaved } from './child-views.js';
import { safePoint } from './update/update.js';
import * as PV from './pictures-views.js';

export { STONE_TEXT } from './sbs-week-doc.js';
const { CODE } = L;

/** Every sentence a child reads on these screens (each 8 words or fewer, tests/copy-sb6.test.js). */
export const STEP_TEXT = Object.freeze({
  meet: 'Look, listen, then say it.',
  copy: 'Copy the word with the tiles.',
  one: 'Fill the missing letter.',
  many: 'Fill the missing letters.',
  all: 'Hear it, then spell it.',
  peek: 'Look, then fill the letters.',
  glow: 'Try the glowing tile.',
  other: 'Try another tile.',
  done: 'That is it.',
  word: 'That is the word.',
  check: 'Quick one. Spell it.',
  rowAll: 'All the words are right.',
  rowSome: 'Some words once more.',
  rowBoth: 'Both words are right.',
  breakOffer: 'Need a short break?',
  breakTitle: 'Break',
  breakLine: 'Take your time.',
  breakReady: 'Ready when you are.',
  ready: "I'm ready",
  carryOn: 'Carry on',
  next: 'Next',
  onceMore: 'Once more',
  stopped: 'Stopped for now',
  allDone: 'All done for now',
  saved: 'Your place is saved.',
  goHome: 'Go home',
  home: 'Home',
  finished: 'Spelling is finished for today.',
  seeYou: 'See you tomorrow.',
  endStop: 'You can stop now.',
  rowsGrow: 'Rows grow. Then the test opens.',
  thenPick: 'Tap what it means.',
  thenTry: 'Have another look.',
  hearIt: 'Hear it',
  sayLetters: 'Say the letters',
  meaning: 'What it means',
});

// ---- small helpers -------------------------------------------------------------------------------------------------
const today = () => W.localDay(Date.now());
const lc = (w) => String(w).toLowerCase();
const ico = (d, c = '') => '<svg ' + (c ? 'class="' + c + '" ' : '') + 'viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
const I = {
  eye: ico('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  undo: ico('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  hear: ico('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>'),
  tick: ico('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'tk'),
  again: ico('<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>'),
  say: ico('<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/>'),
  cup: ico('<path d="M5 9h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M16 10h2a2 2 0 0 1 0 5h-2"/>'),
  pause: ico('<path d="M9 5v14M15 5v14"/>'),
  home: ico('<path d="M4 11l8-7 8 7v9H4z"/>'),
  arrow: ico('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  info: ico('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  play: ico('<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>'),
};
const BIG = (svg, size) => svg.replace('<svg', '<svg width="' + size + '" height="' + size + '"');

/** Load css/sbs.css once (index.html does not list it): answers when it has loaded (or after 1.5 s, so a screen is never held back). */
let cssWait = null;
export function ensureCss() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (cssWait) return cssWait;
  const have = document.querySelector('link[rel="stylesheet"][href$="css/sbs.css"]');
  if (have) { cssWait = Promise.resolve(); return cssWait; }
  cssWait = new Promise((res) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'css/sbs.css';
    l.setAttribute('data-sbs-css', '');
    l.addEventListener('load', () => res());
    l.addEventListener('error', () => res());
    setTimeout(res, 1500);
    document.head.append(l);
  });
  return cssWait;
}

/** A click gate: true at most once in `ms` (Check and Next, 400 ms). */
const gate = (ms = RULES.ui.debounceMs) => { let t = 0; return () => { const n = Date.now(); if (n - t < ms) return false; t = n; return true; }; };
const tileSize = (year) => (year >= 1 && year <= 2 ? 56 : 48);
const wordTry = (fn) => { try { return fn(); } catch (e) { return undefined; } };
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the boxes: the word whole, in chunks, on one line or (long words) two ----------------------------------------
/** The letters' lengths of the 1 or 2 groups the boxes are drawn in: the entry's chunks, merged to two lines at a chunk boundary that never splits the tricky part. */
export function groupLens(entry) {
  const word = entry.word;
  const n = [...word].length;
  if (n <= 6) return [n];
  const tr = T.trickyAt(word, entry.tricky);
  const lo = tr.length ? Math.min(...tr) : -1;
  const hi = tr.length ? Math.max(...tr) : -1;
  const ok = (cut) => !(lo >= 0 && cut > lo && cut <= hi); // a cut between index cut-1 and cut must not split the tricky run
  const chunks = (entry.chunks || []).map((c) => [...c].length);
  const cuts = [];
  let at = 0;
  for (const c of chunks.slice(0, -1)) { at += c; cuts.push(at); }
  const all = cuts.length && chunks.reduce((a, b) => a + b, 0) === n ? cuts : [];
  const pool = (all.length ? all : Array.from({ length: n - 1 }, (_, i) => i + 1)).filter(ok);
  if (!pool.length) return [n];
  const best = pool.reduce((a, b) => (Math.abs(b - n / 2) < Math.abs(a - n / 2) ? b : a));
  return [best, n - best];
}
const sizeOf = (n) => Tr.sizeClass(n);

/**
 * The boxes of one word. gaps: indices drawn as boxes to fill; every other letter is shown. `word` tag is the row's word number for a row card (data-w).
 * Gap boxes are buttons (a tap on a filled one takes the letter back); the ones that are not gaps are plain letters.
 */
export function boxesHtml(entry, gaps, { rail = true, w = null, label = null } = {}) {
  const chars = [...entry.word];
  const n = chars.length;
  const gapSet = new Set(gaps);
  const lens = groupLens(entry);
  const tricky = rail ? T.trickyAt(entry.word, entry.tricky) : [];
  const cell = (i) => {
    if (!gapSet.has(i)) return '<span class="lshown">' + esc(chars[i]) + '</span>';
    const nth = gaps.indexOf(i) + 1;
    return '<button type="button" class="lgap" data-gap="' + i + '"' + (w !== null ? ' data-w="' + w + '"' : '') + ' aria-label="' + esc(label ? label(i, '') : 'letter ' + (i + 1) + ' of ' + n + ', empty') + '" disabled data-nth="' + nth + '"></button>';
  };
  let at = 0;
  const groups = lens.map((len) => {
    const s = at;
    at += len;
    const part = [];
    for (let i = s; i < s + len; i += 1) part.push({ i, html: cell(i) });
    const inRail = part.filter((x) => tricky.includes(x.i));
    if (inRail.length === tricky.length && tricky.length > 1 && tricky.every((i) => i >= s && i < s + len)) {
      const a = part.findIndex((x) => x.i === tricky[0]);
      return '<span class="chunk">' + [...part.slice(0, a).map((x) => x.html), '<span class="tileboxes__rail">' + part.slice(a, a + tricky.length).map((x) => x.html).join('') + '</span>', ...part.slice(a + tricky.length).map((x) => x.html)].join('') + '</span>';
    }
    return '<span class="chunk">' + part.map((x) => x.html).join('') + '</span>';
  });
  return '<div class="s6-boxes"><div class="spellboxes tileboxes ' + sizeOf(n) + ' is-chunked" data-boxes data-chunks="' + lens.join(',') + '" data-n1="' + n + '" data-n2="' + Math.max(...lens) + '">' + groups.join('') + '</div></div>';
}

/** Set what CSS cannot be given in markup (the CSP has no inline styles): box counts, step heights. */
function paint(root) {
  root.querySelectorAll('[data-n1]').forEach((e) => { e.style.setProperty('--n1', e.dataset.n1); e.style.setProperty('--n2', e.dataset.n2 || e.dataset.n1); });
  root.querySelectorAll('[data-ph]').forEach((e) => { e.style.height = e.dataset.ph + 'px'; });
}

/** After layout: chunked boxes that would be under 36 px (30 px in a row card) go on two lines; the row list goes compact by height; a 4-row tray marks the screen tall. */
export function fitScreen(root) {
  if (!root || !root.isConnected) return;
  root.querySelectorAll('.tileboxes.is-chunked').forEach((tb) => {
    tb.classList.remove('is-two');
    const lens = (tb.dataset.chunks || '').split(',');
    const n1 = Number(tb.dataset.n1) || 0;
    if (lens.length < 2 || !n1 || !tb.clientWidth) return;
    const cs = getComputedStyle(tb);
    const lg = parseFloat(cs.getPropertyValue('--lg')) || 4;
    const lmax = parseFloat(cs.getPropertyValue('--lmax')) || 40;
    const min = tb.closest('.s6-rowcard') ? 30 : 36;
    const lw = (tb.clientWidth - (n1 - 1) * lg) / n1;
    if (Math.min(lw, lmax) < min) tb.classList.add('is-two');
  });
  root.querySelectorAll('.s6-rowlist').forEach((rl) => {
    rl.classList.remove('is-lines', 'is-part');
    const over = () => rl.scrollHeight > rl.clientHeight + 1;
    if (!over()) return;
    rl.classList.add('is-lines');
    if (!over()) return;
    rl.classList.add('is-part');
    const act = rl.querySelector('.is-active');
    if (act) act.scrollIntoView({ block: 'nearest' });
  });
  const tiles = [...root.querySelectorAll('.keyboard--tray .ltile')];
  const tops = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top / 10)));
  if (tiles.length && tops.size >= 4) root.setAttribute('data-tall', String(tops.size)); else root.removeAttribute('data-tall');
  tighten(root);
}

/**
 * F1 (Ron's phone rule): the main button never needs scrolling and never sits under Safari's bar. The picture has already given way (the stage shrinks
 * to nothing, sbs.css); if the main button is still too low, level 1 takes the progress strip out of the layout (it stays for a screen reader) and level 2
 * closes up the gaps. The tiles never shrink. Measured, never guessed: a phone that fits keeps every part.
 */
export function tighten(root) {
  if (!root || !root.isConnected) return;
  root.removeAttribute('data-tight');
  const btn = root.querySelector('[data-check], [data-next]');
  if (!btn) return;
  const cs = getComputedStyle(root);
  const limit = () => {
    const top = root.getBoundingClientRect().top;
    const room = Math.min(window.innerHeight, top + (parseFloat(cs.minHeight) || window.innerHeight));
    return room - (parseFloat(cs.paddingBottom) || 0);
  };
  const low = () => btn.getBoundingClientRect().bottom > limit() + 0.5;
  for (const level of ['1', '2']) {
    if (!low()) return;
    root.setAttribute('data-tight', level);
  }
}

// ---- the pieces of every screen ---------------------------------------------------------------------------------------
const hearBtn = (label, attrs = 'data-hear data-fold="hear"') => '<button type="button" class="hearround" ' + attrs + ' aria-label="' + esc(label) + '">' + I.hear + '</button>';
/** Words today (dots, no numbers) and the steps of this word (filled never go down; the ring may sit on a filled step). */
export function stripHtml({ total = 0, done = 0, now = true, label = '', steps = null } = {}) {
  const text = label || total + (total === 1 ? ' word today' : ' words today');
  const dots = '<div class="s6-dots" role="img" aria-label="' + esc(label || total + ' words today, ' + done + ' done') + '">'
    + Array.from({ length: Math.min(total, 12) }, (_, i) => '<i class="' + (i < done ? 'is-done' : i === done && now ? 'is-now' : '') + '"></i>').join('') + '<span>' + esc(text) + '</span></div>';
  let st = '';
  if (steps && steps.n > 1) {
    const big = false;
    st = '<div class="s6-steps' + (big ? ' s6-steps--l' : '') + '" role="img" aria-label="Your steps for this word">'
      + Array.from({ length: steps.n }, (_, i) => '<i class="' + (i < steps.filled ? 'is-done' : '') + (steps.now === i ? ' is-now' : '') + '" data-ph="' + (10 + Math.round((i + 1) * 14 / steps.n)) + '"></i>').join('') + '</div>';
  }
  return '<div class="s6-strip0">' + dots + st + '</div>';
}
/** The picture of a word (its own approved or made picture), or '' when it has none (a screen that spells the word never shows a letter tile: it would give a letter away). */
export function picHtml(entry, { tile = false } = {}) {
  if (pictureState(entry) === 'ready') return '<span class="s6-pic">' + picture(entry) + '</span>';
  if (tile) return '<span class="s6-pic s6-pic--tile" role="img" aria-label="Letter tile ' + esc(entry.word[0]) + '">' + esc(entry.word[0]) + '</span>';
  return '';
}
const lineHtml = (text, kind = '', hear = true) => '<div class="s6-line' + (kind === 'ok' ? ' is-ok' : kind === 'soft' ? ' is-soft' : '') + '" data-sline>' + (kind === 'ok' ? I.tick : '')
  + '<p data-line data-base="' + esc(text) + '" data-instruction="' + esc(text) + '" role="status">' + esc(text) + '</p>' + (hear ? hearBtn('Hear the instruction', 'data-instruct data-fold="hear"') : '') + '</div>';
const headHtml = (pic, text, kind) => '<div class="s6-head">' + pic + lineHtml(text, kind) + '</div>';
const peekHtml = ({ peek = true, undo = true } = {}) => '<div class="s6-peekrow">'
  + '<button type="button" class="btn btn--ghost s6-peek' + (peek ? '' : ' is-hidden') + '" data-peekbtn data-fold="peek"' + (peek ? '' : ' tabindex="-1" aria-hidden="true"') + '>' + I.eye + 'Peek</button>'
  + (undo ? '<button type="button" class="btn btn--ghost s6-peek s6-undo" data-back aria-label="Undo the last tile" disabled>' + I.undo + 'Undo</button>' : '') + '</div>';
const checkHtml = (label = 'Check', tick = true) => '<button type="button" class="btn btn--primary s6-check" data-check data-fold="check" disabled>' + (tick ? I.tick : '') + esc(label) + '</button>';
const frame = (cls, inner, attrs = '') => '<section class="s6 ' + cls + '" data-sbs ' + attrs + '><h1 class="sr" data-h1 tabindex="-1">' + esc('Step by step') + '</h1>' + inner + '</section>';

/** Focus the heading of a new screen (TR-72) without scrolling; then tidy the page. */
function arrived(main) {
  const root = main.querySelector('[data-sbs]');
  if (!root) return;
  const h = root.querySelector('[data-h1]');
  paint(root);
  if (h) wordTry(() => h.focus({ preventScroll: true }));
  fitScreen(root);
  wordTry(() => window.scrollTo(0, 0));
}

// ---- Peek: the one component, peek.js (the same place on every screen, TR-41) -------------------------------------------

// ---- one word: the rung screen ------------------------------------------------------------------------------------
const lvOf = (entry, code, keys) => (code === CODE.COPY ? 1 : code >= CODE.ALL ? (keys ? 0 : 4) : code >= L.middleCode(entry) ? 3 : 2);
export const lvForTry = lvOf;

/** The instruction for a rung. */
export function lineFor(entry, code, { check = false } = {}) {
  if (check && code >= CODE.ALL) return STEP_TEXT.check;
  if (code === CODE.COPY) return STEP_TEXT.copy;
  if (code >= CODE.ALL) return STEP_TEXT.all;
  return L.gapsAt(entry, code, {}).length === 1 ? STEP_TEXT.one : STEP_TEXT.many;
}

/** A typing board for the whole word (a grown-up's choice, Years 5-6): the same shape as the tray controller. */
function keysCtrl(root, spec, { onChange }) {
  const gaps = spec.gaps;
  const placed = {};
  const order = [];
  const slipSet = new Set();
  let tries = 0;
  let locked = false;
  let right = false;
  const el = (g) => root.querySelector('.lgap[data-gap="' + g + '"]');
  const render = () => {
    gaps.forEach((g, n) => {
      const e = el(g);
      if (!e) return;
      const ch = placed[g] || '';
      e.textContent = ch;
      e.classList.toggle('is-filled', !!ch);
      e.classList.toggle('is-right', right);
      e.classList.toggle('is-next', !right && !ch && g === gaps.find((x) => !(x in placed)));
      e.setAttribute('aria-label', 'letter ' + (g + 1) + ' of ' + spec.letters.length + ', ' + (ch || 'empty'));
      e.disabled = !ch || locked || right;
    });
    const back = root.querySelector('[data-back]');
    if (back) back.disabled = locked || right || !order.length;
    if (onChange) onChange(state());
  };
  const state = () => ({ full: gaps.every((g) => g in placed), right, tries, helped: false, placed: order.length, placedIds: { ...placed }, slipSpots: [...slipSet].sort((a, b) => a - b) });
  const key = (letter) => {
    if (locked || right) return false;
    const g = gaps.find((x) => !(x in placed));
    if (g === undefined) return false;
    placed[g] = String(letter).toLowerCase();
    order.push(g);
    render();
    return true;
  };
  const back = () => {
    if (locked || right || !order.length) return false;
    delete placed[order.pop()];
    render();
    return true;
  };
  const unput = (g) => { if (locked || right || !(g in placed)) return; delete placed[g]; order.splice(order.indexOf(g), 1); render(); };
  const check = () => {
    if (locked || right || !state().full) return null;
    const wrong = gaps.filter((g) => placed[g] !== spec.letters[g].ch.toLowerCase());
    if (!wrong.length) { right = true; render(); return { right: true, wrongGaps: [], slips: [], glowGap: null, ...state() }; }
    tries += wrong.length;
    wrong.forEach((g) => { slipSet.add(g); delete placed[g]; order.splice(order.indexOf(g), 1); });
    render();
    return { right: false, wrongGaps: wrong, slips: [...wrong].sort((a, b) => a - b), glowGap: null, ...state() };
  };
  root.querySelectorAll('.key[data-letter]').forEach((k) => k.addEventListener('click', () => key(k.dataset.letter)));
  const del = root.querySelector('[data-del]');
  if (del) del.addEventListener('click', back);
  const bk = root.querySelector('[data-back]');
  if (bk) bk.addEventListener('click', back);
  root.querySelectorAll('.lgap[data-gap]').forEach((e) => e.addEventListener('click', () => unput(Number(e.dataset.gap))));
  render();
  return {
    key, back, check, state, lock(on) { locked = !!on; render(); }, say() {}, setBase() {},
    restorePlaced(map) { let n = 0; for (const g of Object.keys(map || {}).map(Number).sort((a, b) => a - b)) { if (gaps.includes(g) && typeof map[g] === 'string' && !(g in placed)) { placed[g] = map[g]; order.push(g); n += 1; } } if (n) render(); return n; },
    destroy() {},
  };
}
const keysSpecFor = (entry) => { const letters = [...entry.word].map((ch) => ({ ch, shown: false })); const gaps = T.fillableOf(entry.word); gaps.forEach(() => {}); return { word: entry.word, letters: [...entry.word].map((ch, i) => ({ ch, shown: !gaps.includes(i) })), gaps, tiles: [] , level: 5, rows: 0, glowAfter: 2, code: CODE.ALL, input: 'keys', model: false, _n: letters.length }; };

/**
 * One word on one rung. o = { entry, code, day, usual, year, input: 'tiles'|'keys', say, line (the instruction to start with), kind ('' | 'soft'), check (a quick check),
 *   strip: { total, done, label, steps: { n, filled, now } }, restore: { placed }, preview, ms (Peek length), allowPeek,
 *   onTry({ tries, peeks, slips, helped, ctrlState }) -> { line, kind, label } (the runner records the try and says what to show),
 *   onNext(), onPlaced(placedIds) }.
 * Returns { destroy, snapshot(), lock(on) }. Nothing is saved here.
 */
export function rungScreen(main, o) {
  const { entry, code } = o;
  const word = entry.word;
  const keys = o.input === 'keys' && code >= CODE.ALL;
  const spec = keys ? keysSpecFor(entry) : L.traySpec(entry, code, { day: o.day || '', usual: o.usual || [], lexicon: D.lexicon(), input: 'tiles' });
  if (!spec) { main.innerHTML = frame('prac', '<div class="s6-mid"><p>' + esc(RULES.lines.endCalm) + '</p></div>'); return { destroy() {}, snapshot: () => ({}), lock() {} }; }
  const gaps = spec.gaps;
  const noPeek = code <= CODE.COPY && !o.check && code === CODE.COPY ? true : code === CODE.MEET;
  const size = tileSize(o.year);
  const first = o.line || lineFor(entry, code, { check: o.check });
  const pic = picHtml(entry);
  const model = spec.model ? Tr.modelHtml(word) : '';
  const board = keys ? keyboardHtml() : Tr.trayHtml(spec, { back: false, size });
  const block = model + '<div class="s6-boxline">' + boxesHtml(entry, gaps, { label: (i, ch) => 'letter ' + (i + 1) + ' of ' + [...word].length + ', ' + (ch || 'empty') }) + hearBtn('Hear ' + word) + '</div>'
    + peekHtml({ peek: !noPeek, undo: true }) + board + checkHtml('Check');
  main.innerHTML = frame('prac' + (spec.model ? ' has-model' : '') + (keys ? ' kb' : ''),
    '<div class="s6-upper">' + stripHtml(o.strip || {}) + headHtml('', first, o.kind || '') + (pic ? '<div class="s6-stage">' + pic + '</div>' : '<div class="s6-stage"></div>') + '</div><div class="s6-block">' + block + '</div>', 'data-word="' + esc(word) + '"');
  const root = main.querySelector('[data-sbs]');
  const q = (s) => root.querySelector(s);
  const checkBtn = q('[data-check]');
  const lineBox = q('[data-sline]');
  const lineP = lineBox.querySelector('p');
  let peeks = 0;
  let done = false;
  let finished = false;
  let slips = new Set();
  const ok = gate();
  const setLine = (text, kind) => {
    lineP.textContent = text;
    lineP.setAttribute('data-instruction', text);
    lineP.setAttribute('data-base', text);
    lineBox.classList.toggle('is-ok', kind === 'ok');
    lineBox.classList.toggle('is-soft', kind === 'soft');
    const t = lineBox.querySelector('svg.tk');
    if (kind === 'ok' && !t) lineBox.insertAdjacentHTML('afterbegin', I.tick);
    if (kind !== 'ok' && t) t.remove();
  };
  const clearSlip = () => root.querySelectorAll('.lgap.is-slip').forEach((e) => e.classList.remove('is-slip'));
  let peekCtl = null;
  let lastPlaced = -1;
  const ctrl = keys
    ? keysCtrl(root, spec, { onChange: (s) => onChange(s) })
    : Tr.mountTray(root, spec, { mode: 'practice', xs: true, onChange: (s) => onChange(s) });
  // D31: a hardware keyboard works the tiles (and the typing board) like a tap; gone with the screen (destroy), never kept for the next one
  const keyMount = mountTileKeys({
    onLetter: (ch) => { if (!finished && !done) ctrl.key(ch); },
    onBack: () => { if (!finished && !done) ctrl.back(); },
    onCheck: () => { if (finished) return; if (!done) pressCheck(root); else if (!checkBtn.disabled) checkBtn.click(); }, // after a right answer Enter is Next
  });
  function onChange(s) {
    if (finished) return;
    if (!done) checkBtn.disabled = !s.full;
    if (s.placed !== lastPlaced) { lastPlaced = s.placed; clearSlip(); if (peekCtl) peekCtl.touch(); if (o.onPlaced) o.onPlaced(s.placedIds || {}); }
  }
  if (o.restore && o.restore.placed) { const n = ctrl.restorePlaced(o.restore.placed); if (n) lastPlaced = -1; }
  peekCtl = noPeek || o.allowPeek === false ? null : mountPeek(root, {
    nudgeMs: RULES.peek.nudgeMs, words: () => [{ root, entry }], ms: o.ms || 3000, lock: (on) => { ctrl.lock(on); if (on) checkBtn.disabled = true; else checkBtn.disabled = done ? false : !ctrl.state().full; }, onPeek: () => { peeks += 1; },
  });
  // Hear: the word's own, and the instruction
  q('[data-hear]').addEventListener('click', () => wordTry(() => speak(word)));
  if (keys) q('[data-instruct]').addEventListener('click', () => wordTry(() => sayLine(lineP.textContent)));
  checkBtn.addEventListener('click', () => {
    if (!ok()) return;
    if (done) { if (!finished) { finished = true; if (o.onNext) o.onNext(); } return; }
    const r = ctrl.check();
    if (!r) return;
    if (!r.right) {
      (r.slips || r.wrongGaps).forEach((g) => { slips.add(g); const e = q('.lgap[data-gap="' + g + '"]'); if (e) e.classList.add('is-slip'); });
      setLine(r.glowGap !== null && r.glowGap !== undefined ? STEP_TEXT.glow : STEP_TEXT.other, 'soft');
      checkBtn.disabled = true;
      return;
    }
    done = true;
    if (peekCtl) peekCtl.setEnabled(false);
    const st = ctrl.state();
    const res = o.onTry ? o.onTry({ tries: st.tries, peeks, slips: st.slipSpots || [...slips], helped: !!st.helped, ctrlState: st }) : { line: STEP_TEXT.done, kind: 'ok', label: STEP_TEXT.next };
    setLine(res.line || STEP_TEXT.done, res.kind || 'ok');
    checkBtn.innerHTML = (res.label === STEP_TEXT.onceMore ? I.again : '') + esc(res.label || STEP_TEXT.next);
    checkBtn.removeAttribute('data-check');
    checkBtn.setAttribute('data-next', '');
    checkBtn.setAttribute('data-fold', 'next');
    checkBtn.disabled = false;
    q('[data-back]').disabled = true;
    root.querySelectorAll('.lgap').forEach((e) => { e.classList.remove('is-slip', 'is-next'); });
    if (o.sayWord !== false) wordTry(() => speak(word));
    if (res.focus !== false) checkBtn.focus({ preventScroll: true });
  });
  // sound on arrival: the instruction the first time this screen appears, then the word
  arrived(main);
  const onResize = () => fitScreen(root);
  window.addEventListener('resize', onResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
  const lead = !o.preview ? (o.say ? Promise.resolve(wordTry(() => sayLine(first))) : Promise.resolve()) : Promise.resolve();
  lead.then(() => { if (root.isConnected && !finished && o.autoSpeak !== false) wordTry(() => speak(word)); });
  return {
    destroy() { finished = true; keyMount.destroy(); window.removeEventListener('resize', onResize); if (peekCtl) peekCtl.destroy(); if (ctrl.destroy) ctrl.destroy(); stopSpeech(); },
    snapshot: () => ({ placed: (ctrl.state().placedIds) || {}, peeks, slips: [...slips] }),
    lock: (on) => ctrl.lock(on),
  };
}
function keyboardHtml() {
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const del = ico('<path d="M9 5h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z"/><path d="M13 9.5l4 4M17 9.5l-4 4"/>');
  return '<div class="keyboard" role="group" aria-label="Keyboard">' + rows.map((r, i) => '<div class="keyboard-row">' + [...r].map((c) => '<button type="button" class="key" data-letter="' + c.toUpperCase() + '" aria-label="' + c + '">' + c.toUpperCase() + '</button>').join('')
    + (i === 2 ? '<button type="button" class="key key--del" data-del aria-label="Delete">' + del + '</button>' : '') + '</div>').join('') + '</div>';
}

// ---- the other single screens ----------------------------------------------------------------------------------------
const wordSpans = (entry, lit = -1) => {
  const tr = new Set(T.trickyAt(entry.word, entry.tricky));
  const chunks = (entry.chunks && entry.chunks.join('') === entry.word ? entry.chunks : [entry.word]);
  let at = 0;
  return chunks.map((c, k) => {
    const part = [...c].map((ch, j) => { const i = at + j; return i === lit ? '<span class="lit">' + esc(ch) + '</span>' : tr.has(i) ? '<span class="tricky">' + esc(ch) + '</span>' : esc(ch); }).join('');
    at += [...c].length;
    return '<span class="syl' + ((k % 2) + 1) + '">' + part + '</span>';
  }).join('');
};

/** R0 Meet it: the word whole, Hear it, Say the letters, what it means. o = { entry, strip, say, onReady }. */
export function meetScreen(main, o) {
  const { entry } = o;
  const m = entry.meaning || {};
  const pic = picHtml(entry, { tile: false }) || (m.example ? '<span class="s6-pic s6-pic--sent" role="img" aria-label="Sentence card">' + esc(m.example) + '</span>' : '');
  main.innerHTML = frame('meet', stripHtml(o.strip || {}) + headHtml(pic, STEP_TEXT.meet)
    + '<div class="s6-word" data-word aria-label="' + esc(entry.word) + '">' + wordSpans(entry) + '</div>'
    + '<div class="s6-two"><button type="button" class="btn btn--ghost" data-hear data-fold="hear">' + I.hear + STEP_TEXT.hearIt + '</button><button type="button" class="btn btn--ghost" data-letters>' + I.say + STEP_TEXT.sayLetters + '</button></div>'
    + (m.definition ? '<div class="s6-mean"><p><small>' + STEP_TEXT.meaning + '</small>' + esc(m.definition) + '</p>' + hearBtn('Hear what it means', 'data-mean data-fold="hear"') + '</div>' : '')
    + '<div class="s6-foot"><button type="button" class="btn btn--primary" data-next data-fold="next">' + STEP_TEXT.ready + '</button></div>');
  const root = main.querySelector('[data-sbs]');
  const ok = gate();
  const q = (s) => root.querySelector(s);
  q('[data-hear]').addEventListener('click', () => wordTry(() => speak(entry.word)));
  q('[data-instruct]').addEventListener('click', () => wordTry(() => sayLine(STEP_TEXT.meet)));
  q('[data-letters]').addEventListener('click', () => wordTry(() => spellOut(entry.word, (i) => {
    root.querySelectorAll('.s6-word').forEach((w) => { w.innerHTML = wordSpans(entry, i); });
  })));
  const mean = q('[data-mean]');
  if (mean) mean.addEventListener('click', () => wordTry(() => sayLine(m.definition)));
  q('[data-next]').addEventListener('click', () => { if (ok() && o.onReady) o.onReady(); });
  arrived(main);
  const onResize = () => fitScreen(root);
  window.addEventListener('resize', onResize);
  const lead = o.say ? Promise.resolve(wordTry(() => sayLine(STEP_TEXT.meet))) : Promise.resolve();
  lead.then(() => { if (root.isConnected) wordTry(() => speak(entry.word)); });
  return { destroy() { window.removeEventListener('resize', onResize); stopSpeech(); }, snapshot: () => ({}) };
}

/** First/then (C3): "First: 3 words. Then: a game." with the words' pictures. o = { firstThen: { first, then }, entries: [entry], onReady, sizes? (the row-size path) }. */
export function firstThenCard(main, o = {}) {
  const ft = o.firstThen || { first: '', then: '' };
  const pics = (o.entries || []).slice(0, 3).map((e) => picHtml(e, { tile: true })).join('');
  const rowsCard = o.sizes ? sizesHtml(o.sizes) : '';
  const line = ft.first + ' ' + ft.then;
  main.innerHTML = frame('ft', '<div class="s6-head">' + lineHtml(line, '', true) + '</div>'
    + '<div class="s6-ft"><div class="s6-ft__row"><span class="s6-ft__lab">First</span><span class="s6-ft__pics">' + pics + '</span><span class="s6-ft__txt">' + esc(ft.first.replace(/^First:\s*/, '').replace(/\.$/, '')) + '</span></div>'
    + '<div class="s6-ft__arrow" aria-hidden="true">' + I.arrow + '</div>'
    + '<div class="s6-ft__row"><span class="s6-ft__lab">Then</span><span class="s6-ft__txt">' + esc(ft.then.replace(/^Then:\s*/, '').replace(/\.$/, '').replace(/^a /, 'A ')) + '</span></div></div>'
    + rowsCard + '<div class="s6-foot"><button type="button" class="btn btn--primary" data-next data-fold="next">' + STEP_TEXT.ready + '</button></div>');
  const root = main.querySelector('[data-sbs]');
  const ok = gate();
  root.querySelector('[data-next]').addEventListener('click', () => { if (ok() && o.onReady) o.onReady(); });
  root.querySelector('[data-instruct]').addEventListener('click', () => wordTry(() => sayLine(line)));
  arrived(main);
  if (o.say) wordTry(() => sayLine(line));
  return { destroy() { stopSpeech(); }, snapshot: () => ({}) };
}
/** The row-size path (R9): every size in `roundSizes` as a compact stone; done, now, to come. o = { n, done: [sizes], now }. */
function sizesHtml({ n, done = [], now = 0 }) {
  const items = [];
  for (const s of R.roundSizes(n)) {
    const st = done.includes(s) ? 'done' : s === now ? 'now' : 'wait';
    const label = s === n ? 'All' : String(s);
    items.push('<li class="s6-size is-' + st + '" data-rowsize data-size="' + s + '"' + (st === 'now' ? ' aria-current="step"' : '') + '><span aria-hidden="true">' + (st === 'done' ? '&#10003;' : label) + '</span><span class="sr">' + (s === n ? 'All ' + n + ' words' : s + ' words') + ', ' + (st === 'done' ? 'done' : st === 'now' ? 'now' : 'to do') + '</span></li>');
  }
  return '<div class="s6-card s6-sizecard"><h2>' + esc(STEP_TEXT.rowsGrow) + '</h2><ol class="s6-sizes" aria-label="Row sizes">' + items.join('') + '</ol></div>';
}

/** A calm card: a still ring, a heading, lines and buttons. o = { ring: 'tick'|'cup'|'pause'|'home', big, title, lines: [], muted: [], buttons: [{ text, kind, id, icon }] }. */
function cardScreen(main, o) {
  const ring = { tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>', cup: BIG(I.cup, 54), pause: BIG(I.pause, 54), home: BIG(I.home, 54) }[o.ring || 'tick'];
  const stickers = o.big ? '<div class="s6-stickers" aria-hidden="true"><span>&#127802;</span><span>&#11088;</span><span>&#127803;</span></div>' : '';
  main.innerHTML = frame('card ' + (o.cls || ''), '<div class="s6-mid"><span class="s6-ring' + (o.big ? ' s6-ring--big' : '') + '">' + ring + '</span>' + stickers
    + '<h2 class="s6-title" data-title>' + esc(o.title) + '</h2>' + (o.lines || []).map((l) => '<p>' + esc(l) + '</p>').join('') + (o.muted ? '<p class="mut" role="status" data-late></p>' : '') + '</div>'
    + '<div class="s6-foot">' + (o.buttons || []).map((b, i) => '<button type="button" class="btn btn--' + (b.kind || (i === 0 ? 'primary' : 'ghost')) + '" data-card="' + i + '"' + (i === 0 ? ' data-next data-fold="next"' : '') + '>' + (b.icon || '') + esc(b.text) + '</button>').join('') + '</div>');
  const root = main.querySelector('[data-sbs]');
  const ok = gate();
  (o.buttons || []).forEach((b, i) => root.querySelector('[data-card="' + i + '"]').addEventListener('click', () => { if (ok() && b.onTap) b.onTap(); }));
  arrived(main);
  const first = root.querySelector('[data-card="0"]');
  if (first) wordTry(() => first.focus({ preventScroll: true }));
  return { destroy() { stopSpeech(); }, root, say(t) { wordTry(() => sayLine(t)); } };
}

/** C6a/C6b Break: no countdown. After two minutes a still line. o = { onReady(pausedMs) }. */
export function breakScreen(main, o = {}) {
  const t0 = Date.now();
  const c = cardScreen(main, { ring: 'cup', title: STEP_TEXT.breakTitle, lines: [STEP_TEXT.breakLine], muted: true, cls: 'brk', buttons: [{ text: STEP_TEXT.ready, onTap: () => o.onReady && o.onReady(Date.now() - t0) }] });
  const late = setTimeout(() => { const e = c.root.querySelector('[data-late]'); if (e) e.textContent = STEP_TEXT.breakReady; }, RULES.session.breakLineMs);
  return { ...c, destroy() { clearTimeout(late); c.destroy(); } };
}
/** Between words (never forced): "Need a short break?" with Break and Carry on. */
function breakOfferScreen(main, o) {
  return cardScreen(main, { ring: 'cup', title: STEP_TEXT.breakOffer, lines: [], cls: 'brk', buttons: [{ text: STEP_TEXT.carryOn, onTap: o.onCarry }, { text: STEP_TEXT.breakTitle, icon: I.cup, onTap: o.onBreak }] });
}
/** The end of a sitting. end = the session's end item: a clean end says how many words (a still ring); otherwise the calm line and no praise. o = { end, big, stoneLine, onHome }. */
export function endCard(main, o = {}) {
  const e = o.end || { clean: false, line: RULES.lines.endCalm, words: [] };
  const n = (e.words || []).length;
  const clean = !!e.clean && n > 0;
  const lines = clean ? [o.stoneLine || STEP_TEXT.endStop] : [e.line || RULES.lines.endCalm];
  return cardScreen(main, {
    ring: clean ? 'tick' : 'pause', big: clean && !!o.big, title: clean ? (o.title || 'That is ' + n + (n === 1 ? ' word.' : ' words.')) : STEP_TEXT.allDone,
    lines, cls: 'end', buttons: [{ text: STEP_TEXT.home, icon: I.home, kind: 'primary', onTap: o.onHome }],
  });
}
/** C9: "No practice after" has passed. */
export function finishedCard(main, o = {}) {
  return cardScreen(main, { ring: 'home', title: STEP_TEXT.finished, lines: [STEP_TEXT.seeYou], cls: 'end', buttons: [{ text: STEP_TEXT.home, icon: I.home, kind: 'primary', onTap: o.onHome }] });
}
/** C7a: Stop for now: one tap, no "Are you sure?". */
function stoppedCard(main, o) {
  return cardScreen(main, { ring: 'pause', title: STEP_TEXT.stopped, lines: [STEP_TEXT.saved], cls: 'stopped', buttons: [{ text: STEP_TEXT.carryOn, onTap: o.onCarry }, { text: STEP_TEXT.goHome, icon: I.home, onTap: o.onHome }] });
}
/** The stuck word (D25): said once, calmly, then the sitting moves on. */
function stuckCard(main, o) {
  return cardScreen(main, { ring: 'pause', title: o.line, lines: [], cls: 'stuck', buttons: [{ text: STEP_TEXT.carryOn, onTap: o.onNext }] });
}

// ---- words in a row ---------------------------------------------------------------------------------------------------
const rowLine = (n) => (n === 1 ? STEP_TEXT.one : n === 2 ? 'Spell both words.' : n === 3 ? 'Spell all three words.' : n === 4 ? 'Spell all four words.' : 'Spell all ' + n + ' words.');

/**
 * One row group: a card for each word (its own picture or number, boxes, Hear), one tray for the active word, one Peek, one Check when every box is full.
 * o = { words: [{ entry, code }], kept: [entry], day, usual: {word: []}, year, ms, strip, say, restore: { active, placed: { i: {gap: id} } },
 *   onTry({ perWord: [{ tries, peeks, slips, helped }] }) -> { marks: [{ ok, soft }], line, kind, label }, onNext(), onPlaced(map) }.
 */
export function rowScreen(main, o) {
  const list = o.words;
  const size = tileSize(o.year);
  const specs = list.map((x) => L.traySpec(x.entry, x.code, { day: o.day || '', usual: (o.usual || {})[lc(x.entry.word)] || [], lexicon: D.lexicon(), input: 'tiles' }));
  const sts = specs.map((sp) => T.newTray(sp));
  const tries = list.map(() => 0);
  const slips = list.map(() => new Set());
  const helped = list.map(() => false);
  const glow = list.map(() => null);
  let peeks = 0;
  let active = Math.min(Math.max(0, (o.restore && o.restore.active) || 0), list.length - 1);
  let done = false;
  let finished = false;
  const keptHtml = (o.kept || []).map((e, k) => '<div class="s6-rowcard is-ok" data-kept="' + k + '"><span class="s6-rowpic" aria-hidden="true">' + (picHtml(e) || '<span class="s6-pic"><span class="s6-num">&#10003;</span></span>') + '</span>'
    + '<div class="s6-boxes"><div class="spellboxes tileboxes ' + sizeOf([...e.word].length) + '">' + [...e.word].map((c) => '<span class="lshown">' + esc(c) + '</span>').join('') + '</div></div><span class="mk" aria-label="done">' + I.tick + '</span>' + hearBtn('Hear ' + e.word, 'data-hearw="' + esc(e.word) + '" data-fold="hear"') + '</div>').join('');
  const card = (x, i) => '<div class="s6-rowcard" data-rw="' + i + '"><button type="button" class="s6-rowpic" data-pickrow="' + i + '" aria-label="Pick word ' + (i + 1) + '">' + (picHtml(x.entry) || '<span class="s6-pic"><span class="s6-num">' + (i + 1) + '</span></span>') + '</button>'
    + boxesHtml(x.entry, specs[i].gaps, { w: i, label: (g, ch) => 'word ' + (i + 1) + ', letter ' + (g + 1) + ' of ' + [...x.entry.word].length + ', ' + (ch || 'empty') }) + '<span class="mk" data-mk></span>' + hearBtn('Hear word ' + (i + 1), 'data-hearw="' + esc(x.entry.word) + '" data-fold="hear"') + '</div>';
  const hearAll = '<button type="button" class="s6-hearall" data-hearall data-fold="hear" aria-label="Hear them all">' + I.hear + '<span>Hear them<br>all</span></button>';
  const dotsN = list.length + (o.kept || []).length;
  const head = '<div class="s6-head"><div class="s6-line" data-sline><span class="s6-mdots" aria-hidden="true">' + Array.from({ length: Math.min(dotsN, 5) }, (_, i) => '<i class="' + (i < (o.kept || []).length ? 'is-done' : i === (o.kept || []).length ? 'is-now' : '') + '"></i>').join('') + '</span>'
    + '<p data-instruction="" role="status"></p>' + hearAll + '</div></div>';
  const focus = '<div class="s6-focus" data-focus aria-label="The word you are on"><div class="s6-focuspic" data-focuspic></div><div class="s6-boxline" data-focusbox></div></div>';
  const upper = stripHtml(o.strip || { total: dotsN, done: (o.kept || []).length, label: dotsN + ' words in a row' }) + head
    + '<div class="s6-rowlist" tabindex="0" aria-label="The ' + dotsN + ' words"><div class="s6-rowcards" data-n="' + dotsN + '">' + keptHtml + list.map(card).join('') + '</div></div>';
  const block = focus + peekHtml({ peek: true, undo: true }) + '<div class="keyboard keyboard--tray t' + size + '" role="group" aria-label="Letter tiles" data-rowtray></div>' + checkHtml('Check');
  main.innerHTML = frame('prac rows', '<div class="s6-upper">' + upper + '</div><div class="s6-block">' + block + '</div>', 'data-words="' + esc(list.map((x) => x.entry.word).join(',')) + '"');
  const root = main.querySelector('[data-sbs]');
  const q = (s) => root.querySelector(s);
  const qa = (s) => [...root.querySelectorAll(s)];
  const lineBox = q('[data-sline]');
  const lineP = lineBox.querySelector('p');
  const checkBtn = q('[data-check]');
  const tray = q('[data-rowtray]');
  const backBtn = q('[data-back]');
  const firstLine = o.line || rowLine(dotsN);
  const setLine = (text, kind) => {
    lineP.textContent = text;
    lineP.setAttribute('data-instruction', text);
    lineBox.classList.toggle('is-ok', kind === 'ok');
    lineBox.classList.toggle('is-soft', kind === 'soft');
  };
  setLine(firstLine, o.kind || '');
  const ok = gate();
  let peekCtl = null;
  const chOf = (i, id) => specs[i].tiles.find((t) => t.id === id).ch;
  const allFull = () => sts.every((s) => T.full(s));
  const placedMap = () => Object.fromEntries(sts.map((s, i) => [i, { ...s.placed }]));
  const nextActive = (from) => { for (let k = 1; k <= sts.length; k += 1) { const j = (from + k) % sts.length; if (!T.full(sts[j])) return j; } return from; };

  function drawTray() {
    const sp = specs[active];
    const st = sts[active];
    const used = new Set(Object.values(st.placed));
    const glowId = glow[active] !== null && !(glow[active] in st.placed) ? T.glowFor(st, glow[active]) : null;
    const per = Math.ceil(sp.tiles.length / Math.ceil(sp.tiles.length / (innerWidth < 360 ? 5 : 6)));
    const rows = [];
    for (let i = 0; i < sp.tiles.length; i += per) rows.push(sp.tiles.slice(i, i + per));
    tray.innerHTML = rows.map((r) => '<div class="keyboard-row">' + r.map((t) => '<button type="button" class="ltile' + (used.has(t.id) ? ' is-used' : '') + (glowId === t.id ? ' is-glow' : '') + '" data-tile="' + t.id + '" aria-label="letter ' + esc(t.ch) + '"' + (used.has(t.id) || done ? ' disabled aria-hidden="true" tabindex="-1"' : '') + '>' + esc(t.ch) + '</button>').join('') + '</div>').join('');
    tray.querySelectorAll('.ltile').forEach((b) => b.addEventListener('click', () => put(b.dataset.tile)));
  }
  function drawBoxes() {
    list.forEach((x, i) => {
      const sp = specs[i];
      const st = sts[i];
      const nextGap = sp.gaps.find((g) => !(g in st.placed));
      qa('.lgap[data-w="' + i + '"]').forEach((e) => {
        const g = Number(e.dataset.gap);
        const filled = g in st.placed;
        const ch = filled ? chOf(i, st.placed[g]) : '';
        if (!e.classList.contains('is-peeked')) e.textContent = ch;
        e.classList.toggle('is-filled', filled);
        e.classList.toggle('is-next', !done && i === active && g === nextGap);
        e.setAttribute('aria-label', 'word ' + (i + 1) + ', letter ' + (g + 1) + ' of ' + [...x.entry.word].length + ', ' + (ch || 'empty'));
        e.disabled = !filled || done;
      });
    });
    qa('.s6-rowcard[data-rw]').forEach((c) => { const i = Number(c.dataset.rw); c.classList.toggle('is-active', !done && i === active); });
    // the focus panel: the active word's picture and boxes, a copy that follows the list (1180 x 640)
    const f = q('[data-focusbox]');
    const fp = q('[data-focuspic]');
    const srcCard = q('.s6-rowcard[data-rw="' + active + '"]');
    if (f && srcCard) {
      // cloneNode, never outerHTML: the painted boxes carry --n1/--n2 in a style attribute, and parsing that from a string is an inline style the CSP blocks
      f.replaceChildren(srcCard.querySelector('.s6-boxes').cloneNode(true));
      f.insertAdjacentHTML('beforeend', hearBtn('Hear ' + list[active].entry.word, 'data-hearfocus data-fold="hear"'));
      f.querySelectorAll('.lgap').forEach((e) => { e.removeAttribute('data-w'); e.addEventListener('click', () => unput(Number(e.dataset.gap))); });
      const hf = f.querySelector('[data-hearfocus]');
      if (hf) hf.addEventListener('click', () => wordTry(() => speak(list[active].entry.word)));
      if (fp) fp.innerHTML = picHtml(list[active].entry);
      paint(f);
    }
    checkBtn.disabled = done ? false : !allFull();
    backBtn.disabled = done || !sts[active].order.length;
    if (!done) { const v = peekCtl && peekCtl.isShowing && peekCtl.isShowing(); if (v) checkBtn.disabled = true; }
  }
  function render() { drawTray(); drawBoxes(); if (o.onPlaced) o.onPlaced({ active, placed: placedMap() }); const s = root; fitScreen(s); }
  function put(id) {
    if (done || (peekCtl && peekCtl.isShowing())) return;
    const next = T.put(sts[active], id);
    if (next === sts[active]) return;
    sts[active] = next;
    glow[active] = null;
    qa('.lgap.is-slip').forEach((e) => e.classList.remove('is-slip'));
    if (T.full(next) && !allFull()) active = nextActive(active);
    if (peekCtl) peekCtl.touch();
    render();
  }
  function unput(g, w = active) {
    if (done) return;
    const next = T.unput(sts[w], g);
    if (next === sts[w]) return;
    sts[w] = next;
    active = w;
    render();
  }
  qa('.s6-rowcard[data-rw]').forEach((c) => {
    const i = Number(c.dataset.rw);
    c.addEventListener('click', (e) => {
      const gap = e.target.closest('.lgap[data-gap]');
      if (gap && !gap.disabled) { unput(Number(gap.dataset.gap), i); return; }
      if (e.target.closest('.hearround')) return;
      if (!done) { active = i; render(); }
    });
  });
  qa('.hearround[data-hearw]').forEach((b) => b.addEventListener('click', () => wordTry(() => speak(b.dataset.hearw))));
  q('[data-hearall]').addEventListener('click', () => wordTry(async () => { for (const x of [...(o.kept || []), ...list.map((y) => y.entry)]) { await speak(x.word); await sleepMs(250); } }));
  q('[data-instruct]')?.addEventListener('click', () => wordTry(() => sayLine(lineP.textContent)));
  function takeBack() { if (done) return; const w = sts.map((s, i) => [s.order.length, i]); const cur = sts[active].order.length ? active : (w.filter((x) => x[0]).pop() || [0, active])[1]; const nx = T.back(sts[cur]); if (nx !== sts[cur]) { sts[cur] = nx; active = cur; render(); } }
  backBtn.addEventListener('click', takeBack);
  // D31: a letter key takes the next matching unused tile of the word being spelled, as a tap does (no tile left: nothing happens)
  function keyLetter(ch) {
    if (done || finished || (peekCtl && peekCtl.isShowing())) return;
    const used = new Set(Object.values(sts[active].placed));
    const t = tileForLetter(specs[active].tiles, used, ch);
    if (t) put(t.id);
  }
  const keyMount = mountTileKeys({
    onLetter: keyLetter,
    onBack: () => { if (!finished && !(peekCtl && peekCtl.isShowing())) takeBack(); },
    onCheck: () => { if (finished) return; if (!done) pressCheck(root); else if (!checkBtn.disabled) checkBtn.click(); },
  });
  checkBtn.addEventListener('click', () => {
    if (!ok()) return;
    if (done) { if (!finished) { finished = true; if (o.onNext) o.onNext(); } return; }
    if (!allFull()) return;
    let allRight = true;
    list.forEach((x, i) => {
      const r = T.check(sts[i]);
      if (r.right) return;
      allRight = false;
      sts[i] = r.st;
      tries[i] += r.wrongGaps.length;
      r.wrongGaps.forEach((g) => slips[i].add(g));
      const rule = specs[i].glowAfter || 2;
      for (const g of r.wrongGaps) {
        const m = sts[i].misses[g] || 0;
        if (m >= 3) { sts[i] = T.autoFill(sts[i], g); helped[i] = true; } else if (m >= rule && glow[i] === null) glow[i] = g;
      }
      qa('.lgap[data-w="' + i + '"]').forEach((e) => e.classList.toggle('is-slip', r.wrongGaps.includes(Number(e.dataset.gap))));
    });
    if (!allRight) {
      const bad = sts.findIndex((s) => !T.full(s));
      active = bad >= 0 ? bad : active;
      setLine(glow.some((g) => g !== null) ? STEP_TEXT.glow : STEP_TEXT.other, 'soft');
      qa('.s6-rowcard[data-rw]').forEach((c) => { const i = Number(c.dataset.rw); c.classList.toggle('is-soft', !T.full(sts[i]) || sts[i].misses && Object.keys(sts[i].misses).length > 0 && slips[i].size > 0 && !T.full(sts[i])); });
      render();
      return;
    }
    done = true;
    if (peekCtl) peekCtl.setEnabled(false);
    const res = o.onTry({ perWord: list.map((x, i) => ({ tries: tries[i], peeks, slips: [...slips[i]].sort((a, b) => a - b), helped: helped[i] })) });
    qa('.lgap').forEach((e) => e.classList.remove('is-slip', 'is-next'));
    qa('.s6-rowcard[data-rw]').forEach((c) => {
      const i = Number(c.dataset.rw);
      const m = (res.marks || [])[i] || {};
      c.classList.remove('is-active', 'is-soft');
      c.classList.toggle('is-ok', !!m.ok);
      c.classList.toggle('is-soft', !!m.soft);
      const mk = c.querySelector('[data-mk]');
      if (mk) { mk.className = 'mk'; mk.innerHTML = m.ok ? I.tick : m.soft ? I.again : ''; mk.setAttribute('aria-label', m.ok ? 'done' : m.soft ? 'once more' : ''); }
    });
    setLine(res.line || STEP_TEXT.rowAll, res.kind || 'ok');
    checkBtn.innerHTML = (res.label === STEP_TEXT.onceMore ? I.again : '') + esc(res.label || STEP_TEXT.next);
    checkBtn.removeAttribute('data-check');
    checkBtn.setAttribute('data-next', '');
    checkBtn.setAttribute('data-fold', 'next');
    drawTray();
    drawBoxes();
    checkBtn.disabled = false;
    checkBtn.focus({ preventScroll: true });
  });
  peekCtl = mountPeek(root, {
    nudgeMs: RULES.peek.nudgeMs, words: () => list.map((x, i) => ({ root: q('.s6-rowcard[data-rw="' + i + '"]'), entry: x.entry })), ms: o.ms || 3000, onPeek: () => { peeks += 1; },
    lock: (on) => { if (!on) drawBoxes(); else checkBtn.disabled = true; tray.querySelectorAll('.ltile').forEach((b) => { b.disabled = on || b.classList.contains('is-used'); }); },
  });
  // restore (a reload): the tiles go back where they were
  if (o.restore && o.restore.placed) {
    list.forEach((x, i) => {
      const map = o.restore.placed[i] || {};
      for (const g of Object.keys(map).map(Number).sort((a, b) => a - b)) {
        if (!specs[i].gaps.includes(g) || g in sts[i].placed) continue;
        const nx = T.put({ ...sts[i], open: g }, map[g]);
        if (nx !== sts[i]) sts[i] = nx;
      }
    });
  }
  render();
  arrived(main);
  const onResize = () => fitScreen(root);
  window.addEventListener('resize', onResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
  if (o.say) wordTry(() => sayLine(firstLine));
  return {
    destroy() { finished = true; keyMount.destroy(); window.removeEventListener('resize', onResize); if (peekCtl) peekCtl.destroy(); stopSpeech(); },
    snapshot: () => ({ active, placed: placedMap(), peeks }),
    lock() {},
  };
}

// ---- the short game at the end of a sitting (M6): tap what each word means ------------------------------------------
function thenGame(main, o) {
  const items = o.items;
  let i = 0;
  let wrong = 0;
  const result = [];
  let picked = -1;
  let ctl = null;
  const show = () => {
    const it = items[i];
    const cards = it.options.map((t, k) => '<div class="s6-opt"><button type="button" class="s6-cardbtn" data-opt="' + k + '" data-fold="option"><span>' + esc(t) + '</span></button>' + hearBtn('Hear: ' + t, 'data-hearopt="' + k + '" data-fold="hear"') + '</div>').join('');
    main.innerHTML = frame('mean then', stripHtml({ total: items.length, done: i, label: 'A game' }) + headHtml('', STEP_TEXT.thenPick)
      + '<div class="s6-stage s6-stage--pic">' + (picHtml(it.entry, { tile: true })) + '</div>'
      + '<div class="s6-wordline"><span class="s6-word" aria-label="' + esc(it.entry.word) + '">' + esc(it.entry.word) + '</span>' + hearBtn('Hear ' + it.entry.word) + '</div>'
      + '<div class="s6-cards">' + cards + '</div><div class="s6-foot"><button type="button" class="btn btn--primary s6-check" data-check data-fold="check" disabled>' + I.tick + 'Check</button></div>');
    const root = main.querySelector('[data-sbs]');
    picked = -1;
    wrong = 0;
    const ok = gate();
    const chk = root.querySelector('[data-check]');
    const line = root.querySelector('[data-sline]');
    root.querySelector('[data-hear]').addEventListener('click', () => wordTry(() => speak(it.entry.word)));
    root.querySelector('[data-instruct]').addEventListener('click', () => wordTry(() => sayLine(STEP_TEXT.thenPick)));
    root.querySelectorAll('[data-hearopt]').forEach((b) => b.addEventListener('click', () => wordTry(() => sayLine(it.options[Number(b.dataset.hearopt)]))));
    root.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
      picked = Number(b.dataset.opt);
      root.querySelectorAll('[data-opt]').forEach((x) => x.classList.toggle('is-picked', x === b));
      chk.disabled = false;
      line.classList.remove('is-soft');
    }));
    chk.addEventListener('click', () => {
      if (!ok() || picked < 0) return;
      if (picked !== it.correct) {
        wrong += 1;
        line.classList.add('is-soft');
        line.querySelector('p').textContent = STEP_TEXT.thenTry;
        root.querySelectorAll('[data-opt]')[picked].classList.remove('is-picked');
        picked = -1;
        chk.disabled = true;
        return;
      }
      result.push({ word: it.entry.word, tries: wrong, clean: wrong === 0 });
      i += 1;
      if (i < items.length) { ctl.destroy(); ctl = null; show(); } else o.onDone(result);
    });
    arrived(main);
    ctl = { destroy() { stopSpeech(); } };
    wordTry(() => speak(it.entry.word));
  };
  show();
  return { destroy() { if (ctl) ctl.destroy(); stopSpeech(); }, snapshot: () => ({}) };
}
/** Three meanings for a word: its own, and two others (from the other words, then the lexicon). Deterministic for the day. */
export function meaningOptions(entry, pool, day) {
  const own = entry.meaning && entry.meaning.definition;
  if (!own) return null;
  const r = T.rng(T.seedOf(entry.word, day + '|then'));
  const others = pool.filter((e) => lc(e.word) !== lc(entry.word) && e.meaning && e.meaning.definition && e.meaning.definition !== own);
  const picks = [];
  const bag = [...others];
  while (picks.length < 2 && bag.length) picks.push(bag.splice(Math.floor(r() * bag.length), 1)[0].meaning.definition);
  if (picks.length < 2) return null;
  const opts = [own, ...picks];
  for (let i = opts.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return { options: opts, correct: opts.indexOf(own) };
}

// ---- the grown-up's preview: one rung, nothing recorded -----------------------------------------------------------------
export function previewRung(main, a, b, c) {
  // previewRung(host, { entry, code, setup, year }) or previewRung(host, word, rung[, { setup, year }])
  const o = typeof a === 'string' ? { entry: entryFor(a), code: b, ...(c || {}) } : (a || {});
  const { entry, code, setup, year } = o;
  ensureCss();
  if (!entry) { main.textContent = ''; return () => {}; }
  const e = entry.chunks ? entry : { ...entry, chunks: [entry.word] };
  const rungs = L.rungsFor(e);
  const code0 = code === undefined ? L.middleCode(e) : code;
  const pos = Math.max(0, rungs.indexOf(code0));
  const ms = Su.peekSecondsOf(setup, { way: 'sbs', input: 'tiles' }) * 1000;
  document.body.classList.add('is-sbs');
  const draw = () => rungScreen(main, {
    entry: e, code: code0, day: today(), year, ms, preview: true, say: false, autoSpeak: false, strip: { total: 1, done: 0, label: 'Preview', steps: { n: rungs.length, filled: pos, now: pos } },
    onTry: () => ({ line: STEP_TEXT.done, kind: 'ok', label: STEP_TEXT.next }), onNext: () => { ctl.destroy(); ctl = draw(); },
  });
  let ctl = draw();
  return () => { ctl.destroy(); document.body.classList.remove('is-sbs'); };
}

// ---- place restore (BR-13 AC5): device-local sb.sbs:<playerId> --------------------------------------------------------------
const placeKey = () => { const id = S.currentPlayer(); return id ? 'sb.sbs:' + id : ''; };
export function readPlace(gid, step, now = Date.now()) {
  const k = placeKey();
  if (!k) return null;
  try {
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    if (!v || v.v !== 1 || v.gid !== gid || v.step !== step || !/^[a-z0-9]{6}$/.test(v.ss || '')) return null;
    return now - (v.at || 0) < 6 * 3600000 ? v : null;
  } catch (e) { return null; }
}
export function writePlace(v) { const k = placeKey(); if (!k) return; try { localStorage.setItem(k, JSON.stringify({ v: 1, ...v, at: Date.now() })); } catch (e) { /* storage blocked: the sitting still works */ } }
export function clearPlace() { const k = placeKey(); if (!k) return; try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

/** A new sitting id: six lower-case letters or digits. */
const newSs = () => S.newId().slice(-6);

// ---- the runner -----------------------------------------------------------------------------------------------------------
/**
 * What the session needs (rebuilt after every write): the stone's words in order, each word's facts and entry, where a word was left (D22:
 * ctx.resume from the tries it left, so a step-back is kept), what a grown-up set aside for today (D25), and the row groups (rows-doc rowsCtx).
 */
export function sbsCtx({ d, g, step, day, entryOf }) {
  const facts = new Map();
  const factsOf = (w) => { const k = lc(w); if (!facts.has(k)) facts.set(k, K.factsOf(d, g, w, day, { hello: step === 'hello' })); return facts.get(k); };
  const left = K.wordsLeft(d, g, step, day);
  const words = step === 'practice' ? [] : left.length ? left : (step === 'hello' || step === 'fix' ? [...g.words] : []);
  const ctx = {
    words, facts: factsOf, entries: entryOf,
    resume: (w) => (step === 'practice' ? 0 : Runs.resumeOf(d.results, g.id, w, entryOf(w), { stone: step })),
    setAside: (w, dy) => W.isSetAside(d, g.id, w, dy),
  };
  if (step === 'practice') ctx.rows = R.rowsCtx(d, g, day, factsOf, entryOf);
  return ctx;
}

const CHECKS_J = { hello: 'h', fix: 'f', practice: 'w', mend: 'm' };

/**
 * Meet the words, Letter ladder, Words in a row and Mend (the stone's page for a Step by step child). Returns a cleanup.
 * `g` is the group (from the route), `step` is hello | fix | practice | mend; `n` is unused (a sitting is not a word number).
 */
export function sbsStone(main, { g, step } = {}) {
  if (!main || !g) return () => {};
  let alive = true;
  let screen = null;
  let paused = 0;
  let pendingBreak = false;
  const gid = g.id;
  const ensure = ensureCss();
  document.body.classList.add('is-sbs');
  main.classList.add('sbs-main');
  const year = childYear();
  const setup = S.readSetup();
  const sbsSet = Su.sbsOf(setup);
  const lvKeys = S.helpNow(year).lv === 5;
  const ms = Su.peekSecondsOf(setup, { way: 'sbs', input: lvKeys ? 'keys' : 'tiles' }) * 1000;
  const day = today();
  let d = S.readWords();
  const entryOf = (w) => entryFor(w);
  let ctx = null;
  let sitting = null;
  let item = null;
  const prog = new Map(); // word -> the most steps it has filled in this sitting (never goes down)
  const home = () => { markSaved(); location.hash = '#/'; };
  const clearScreen = () => { if (screen) { screen.destroy(); screen = null; } };
  const refresh = () => { d = S.readWords(); ctx = sbsCtx({ d, g: W.groupById(d, gid) || g, step, day, entryOf }); };
  const group = () => W.groupById(d, gid) || g;

  function savePlace(extra = {}) {
    writePlace({ gid, step, ss: sitting.ss, startedAt: sitting.startedAt, heard: sitting.heard, run: item && item.word ? { word: item.word, code: item.code || 0 } : null, ...extra });
  }

  // -- writing --
  function writeTries(outcome, meta) {
    const list = SD.triesOf(sitting, outcome); // exactly W.addTry's names; passed on UNCHANGED (the contract), plus what only the screen knows
    if (!list.length) return;
    const now = Date.now();
    S.updateWords((dd) => {
      let x = dd;
      list.forEach((t, i) => {
        const m = meta[i] || {};
        const entry = entryOf(t.word);
        x = W.addTry(x, {
          ...t, id: S.newId(), group: gid, day, kind: W.kindOn(x, group(), t.word, day), now,
          ...(m.slips && m.slips.length ? { sl: m.slips } : {}),
          ...(t.r === undefined ? {} : { lv: lvOf(entry, t.r, m.keys) }), ...(m.helped ? { h: 1 } : {}),
        });
      });
      return x;
    });
  }
  function writeMarks(extra = []) {
    refresh();
    const marks = [...K.pendingMarks(d, group(), step, day), ...extra];
    if (!marks.length) return;
    const now = Date.now();
    const hashes = step === 'practice' ? K.markHashes(d, group(), marks, day) : {}; // a row group mark remembers its words (FIX-2)
    S.updateWords((dd) => marks.reduce((x, m) => W.markStep(x, group(), m, day, now, hashes[m] || ''), dd));
    refresh();
    safePoint();
  }

  // -- progress strip --
  const stripFor = (it) => {
    const total = sitting.plan || 0;
    const e = it.word ? entryOf(it.word) : null;
    const rungs = e ? L.rungsFor(e) : [];
    const pos = e && it.code !== undefined ? Math.max(0, rungs.indexOf(it.code)) : 0;
    const key = e ? lc(e.word) : '';
    if (key) prog.set(key, Math.max(prog.get(key) || 0, pos));
    const warn = it.warn === 'last-word' ? 'Last word, then a game.' : it.warn === 'last-one' ? 'Last one, then we stop.' : '';
    const dots = { total: Math.max(total, 1), done: Math.min(sitting.wordsDone, Math.max(total, 1)), now: true, label: warn };
    return e ? { ...dots, steps: { n: rungs.length, filled: prog.get(key), now: pos } } : dots;
  };

  // -- the loop --
  function next() {
    if (!alive) return;
    clearScreen();
    const now = Date.now();
    item = SD.nextItem(sitting, ctx, now);
    switch (item.kind) {
      case 'firstThen': return showFirstThen();
      case 'meet': return showMeet();
      case 'rung': return showRung(false);
      case 'check': return showRung(true);
      case 'row': return showRow();
      case 'break-offer': return showOffer();
      case 'stuck': return showStuck();
      case 'then': return showThen();
      case 'end': return showEnd();
      default: sitting = SD.afterItem(sitting, { item }, now, ctx); return next();
    }
  }
  const advance = (outcome = {}) => { sitting = SD.afterItem(sitting, { item, ...outcome, pausedMs: (outcome.pausedMs || 0) + paused }, Date.now(), ctx); paused = 0; };

  function showFirstThen() {
    const entries = ctx.words.slice(0, 3).map(entryOf);
    const sizes = step === 'practice' ? (() => { const gg = group(); const nn = gg.words.length; const doneSizes = R.roundSizes(nn).filter((k) => R.roundDone(d, gg, k)); const nowSize = (ctx.rows.next(() => false) || {}).size || 0; return nn >= 2 ? { n: nn, done: doneSizes, now: nowSize } : null; })() : null;
    screen = firstThenCard(main, { firstThen: item.firstThen, entries, sizes, say: item.say, onReady: () => { advance(); refresh(); next(); } });
  }
  function showMeet() {
    const e = entryOf(item.word);
    savePlace();
    screen = meetScreen(main, { entry: e, strip: stripFor(item), say: item.say, onReady: () => { advance(); refresh(); next(); } });
  }
  function usualOf(word) { return K.factsOf(d, group(), word, day, { hello: step === 'hello' }).usualSpots || []; }
  function showRung(isCheck) {
    const e = entryOf(item.word);
    const restored = restoreFor(item);
    const keys = lvKeys && item.code >= CODE.ALL;
    const line = item.line === RULES.lines.back ? item.line : '';
    savePlace();
    screen = rungScreen(main, {
      entry: e, code: item.code, day, usual: usualOf(item.word), year, ms, input: keys ? 'keys' : 'tiles', say: item.say, check: isCheck,
      line, kind: line ? 'soft' : '', strip: stripFor(item), restore: restored,
      onPlaced: (placed) => savePlace({ placed }),
      onTry: (r) => {
        const outcome = { tries: r.tries, peeks: r.peeks };
        advance(outcome);
        writeTries(outcome, [{ slips: r.slips, helped: r.helped, keys }]);
        const last = sitting.last || {};
        refresh();
        const key = lc(e.word);
        const rungs = L.rungsFor(e);
        const pos = Math.max(0, rungs.indexOf(item.code));
        if (last.next === 'up' || last.next === 'done') prog.set(key, Math.max(prog.get(key) || 0, pos + 1));
        clearPlace();
        if (last.next === 'done') writeMarks();
        const clean = !!last.clean;
        const repeat = last.next === 'repeat';
        return { line: clean ? STEP_TEXT.done : (last.line || STEP_TEXT.word), kind: clean ? 'ok' : 'soft', label: repeat ? STEP_TEXT.onceMore : STEP_TEXT.next };
      },
      onNext: () => next(),
    });
  }
  function showRow() {
    const entries = item.words.map((x) => entryOf(x.word));
    const kept = (item.kept || []).map(entryOf);
    const rest = readRestoreRow(item);
    savePlace({ run: { word: item.words.map((x) => x.word).join(','), code: item.size } });
    const usual = Object.fromEntries(item.words.map((x) => [lc(x.word), usualOf(x.word)]));
    const dotsN = item.words.length + kept.length;
    screen = rowScreen(main, {
      words: item.words.map((x, i) => ({ entry: entries[i], code: x.code })), kept, day, usual, year, ms, say: item.say, restore: rest,
      strip: { total: dotsN, done: kept.length, label: dotsN + ' words in a row' },
      line: item.words.some((x) => x.repeat) ? STEP_TEXT.onceMore + '.' : '',
      onPlaced: (p) => savePlace({ placedRow: p }),
      onTry: (r) => {
        const outcome = { perWord: r.perWord.map((x) => ({ tries: x.tries, peeks: x.peeks })) };
        advance(outcome);
        writeTries(outcome, r.perWord.map((x) => ({ slips: x.slips, helped: x.helped })));
        const last = sitting.last || { words: [] };
        refresh();
        clearPlace();
        writeMarks();
        const marks = last.words.map((w) => ({ ok: w.clean && (w.next === 'up' || w.next === 'done'), soft: !(w.clean && (w.next === 'up' || w.next === 'done')) }));
        const all = marks.every((m) => m.ok);
        return { marks, line: all ? (dotsN === 2 ? STEP_TEXT.rowBoth : STEP_TEXT.rowAll) : STEP_TEXT.rowSome, kind: all ? 'ok' : 'soft', label: all ? STEP_TEXT.next : STEP_TEXT.onceMore };
      },
      onNext: () => next(),
    });
  }
  function restoreFor(it) {
    const v = restoredPlace;
    if (!v || !v.run || lc(v.run.word) !== lc(it.word) || v.run.code !== it.code || !v.placed) return null;
    restoredPlace = null;
    return { placed: v.placed };
  }
  function readRestoreRow(it) {
    const v = restoredPlace;
    if (!v || !v.run || v.run.word !== it.words.map((x) => x.word).join(',') || v.run.code !== it.size || !v.placedRow) return null;
    restoredPlace = null;
    return v.placedRow;
  }
  function showOffer() {
    screen = breakOfferScreen(main, {
      onCarry: () => { advance(); next(); },
      onBreak: () => { clearScreen(); screen = breakScreen(main, { onReady: (ms2) => { advance({ pausedMs: ms2 }); next(); } }); },
    });
  }
  function showStuck() {
    screen = stuckCard(main, { line: item.line, onNext: () => { advance(); refresh(); next(); } });
    if (item.say) screen.say(item.line);
  }
  function showThen() {
    const pool = D.allWords().filter((e) => e.meaning && e.meaning.definition);
    const items = item.words.map((w) => { const e = entryOf(w); const o = meaningOptions(e, [...ctx.words.map(entryOf), ...pool], day); return o ? { entry: e, ...o } : null; }).filter(Boolean);
    if (items.length < 2) { advance(); next(); return; }
    screen = thenGame(main, {
      items, onDone: (res) => {
        advance(); // marks the game done (last = then); triesOf reads `last`
        writeTries({ results: res }, []);
        refresh();
        next();
      },
    });
  }
  function showEnd() {
    const normal = item.normal;
    if (normal) writeMarks(['se:' + sitting.ss]); else writeMarks();
    clearPlace();
    advance();
    const gg = group();
    const doneStone = K.stoneDone(d, gg, step, day);
    const t = K.STONE_TEXT[step] || { title: '' };
    const stoneLine = doneStone ? t.title + ' is done.' : step === 'practice' ? R.rowsLine(d, gg) : '';
    screen = endCard(main, { end: item, big: !!sbsSet.big, stoneLine, onHome: home });
  }

  // -- Break and Stop on the job bar --
  let restoredPlace = null;
  function doBreak() {
    if (!alive || !sitting || pendingBreak || !item || item.kind === 'end') return;
    pendingBreak = true;
    const snap = screen && screen.snapshot ? screen.snapshot() : {};
    const keep = item;
    clearScreen();
    screen = breakScreen(main, {
      onReady: (ms2) => {
        pendingBreak = false;
        paused += ms2;
        restoredPlace = { run: keep.words ? { word: keep.words.map((x) => x.word).join(','), code: keep.size } : { word: keep.word || '', code: keep.code || 0 }, ...(keep.words ? { placedRow: snap } : { placed: snap.placed }) };
        item = keep;
        clearScreen();
        redraw(keep);
      },
    });
  }
  function redraw(it) {
    switch (it.kind) {
      case 'meet': return showMeet();
      case 'rung': return showRung(false);
      case 'check': return showRung(true);
      case 'row': return showRow();
      case 'firstThen': return showFirstThen();
      case 'break-offer': return showOffer();
      case 'stuck': return showStuck();
      case 'then': return showThen();
      default: return next();
    }
  }
  function doStop() {
    if (!alive || !sitting) return;
    clearScreen();
    stopSpeech();
    if (item && item.kind !== 'end') { sitting = SD.afterItem(sitting, { item, stop: true }, Date.now(), ctx); writeMarks(); }
    screen = stoppedCard(main, {
      onCarry: () => { start(true); },
      onHome: home,
    });
  }
  const chrome = useSbsChrome({ stop: doStop, brk: doBreak });

  // -- starting --
  async function start(again = false) {
    clearScreen();
    refresh();
    const pace = sitting && again ? { ss: sitting.ss, startedAt: sitting.startedAt, heard: sitting.heard } : null;
    const saved = again ? null : readPlace(gid, step);
    sitting = SD.newSitting({ gid, stone: step, ss: pace ? pace.ss : saved ? saved.ss : newSs(), startedAt: pace ? pace.startedAt : saved ? saved.startedAt : Date.now(), year, setup, day });
    if (pace) sitting = { ...sitting, heard: pace.heard };
    if (saved) { sitting = { ...sitting, heard: saved.heard || [] }; restoredPlace = saved; }
    const hhmm = (() => { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); })();
    if (SD.afterTime(setup, hhmm)) { screen = finishedCard(main, { onHome: home }); return; }
    next();
    // a restore does not show the First/then card again
    if (saved && item && item.kind === 'firstThen') { advance(); next(); }
  }
  (async () => {
    await ensure;
    await meaningsFor(g.words).catch(() => {});
    await Promise.resolve(wordTry(() => (PV.picturesOn() ? PV.loadApproved(g.words.filter((w) => !findEntry(w))) : null))).catch(() => {});
    if (!alive) return;
    start(false);
  })();
  return () => { alive = false; chrome.release(); clearScreen(); stopSpeech(); document.body.classList.remove('is-sbs'); main.classList.remove('sbs-main'); };
}

export { CHECKS_J };
