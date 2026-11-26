// The letter-tile tray (SB4-WP4): tiles to tap into gaps, in place of the 26-key keyboard, for a child on level 1 to 4.
// The state and rules are in tiles-doc.js (pure); this file draws them and wires the taps. Nothing here saves anything:
// each screen records its own try. Tiles never move: a used tile stays as a ghost in its place.
import * as T from './tiles-doc.js';
import * as D from './data.js';
import * as W from './words-doc.js';
import { sayLine } from './speech.js';
import { esc } from './ui.js';

export const LINES = {
  learn: 'Tap the missing letters.',
  all: 'Tap the letters to spell the word.',
  right: 'You spelled it!',
  nearly: 'Nearly. Try the empty boxes again.',
  glow: 'Look for the glowing letter.',
  letter: 'Nearly. Try another letter.',
  capital: 'It starts with a capital letter.',
  back: 'Tap Back to take a letter back.',
  newWay: 'New way to spell today!',
};
/** The instruction for a tile level (1 to 3 fill the missing letters; 4 spells the whole word). */
export const instructionFor = (lv) => (lv >= 4 ? LINES.all : LINES.learn);

// ---- pure helpers (tests/tray.test.js) ---------------------------------------------------
export const tileLabel = (ch) => 'letter ' + ch;
/** "gap 2 of 4, empty" or "gap 2 of 4, p". `ch` empty or missing: empty. */
export const gapLabel = (n, total, ch) => 'gap ' + n + ' of ' + total + ', ' + (ch || 'empty');
/** What a screen reader hears for the word: "a, gap, gap, l, e". `placed` maps a position to a placed letter. */
export function patternOf(spec, placed = {}) {
  return spec.letters.map((l, i) => (l.shown ? l.ch : (placed[i] || 'gap'))).join(', ');
}
/** The box size bucket by word length: 40, 36, 32, 28 or 26 px wide on a phone. */
export function sizeClass(n) {
  if (n <= 6) return 'tb-40';
  if (n <= 8) return 'tb-36';
  if (n <= 10) return 'tb-32';
  if (n === 11) return 'tb-28';
  return 'tb-26';
}
/** How many tiles go in each row: at most 6 (5 under 360 px wide), as even as can be (8 is 4 + 4, 7 is 4 + 3). */
export function rowSizes(n, max = 6) {
  if (n <= max) return [n];
  const rows = Math.ceil(n / max);
  const out = [];
  let left = n;
  for (let r = 0; r < rows; r += 1) { const k = Math.ceil(left / (rows - r)); out.push(k); left -= k; }
  return out;
}
/** The letters of the flower game's keypad in rows of at most 6. */
export const padRows = (letters, max = 6) => { let i = 0; return rowSizes(letters.length, max).map((k) => { const r = letters.slice(i, i + k); i += k; return r; }); };

// ---- icons --------------------------------------------------------------------------------
const svg = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
const BACK_ICON = svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>');
const TICK_ICON = svg('<path d="M5 12.5l4.5 4.5L19 7"/>');
const AGAIN_ICON = svg('<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>');
export const EYE_ICON = svg('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
const HEAR_ICON = svg('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>');

// ---- the words round the tray ---------------------------------------------------------------
/** The gaps and tiles for one word at a tile level (null at level 5), for today: the same word gives the same tray all day. */
export function specFor(entry, lv, { pf = 'normal', gaps = null } = {}) {
  return T.tilesFor(entry, lv, T.seedOf(entry.word, W.localDay(Date.now())), { profile: pf, lexicon: D.lexicon(), gaps });
}

const sget = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const sset = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ }; };
/** The lead line for a page being drawn, shown first and then replaced by the instruction: "New way to spell today!" when the level is not the one last seen (a fresh session has no "new way"), else the capital note. */
export function moreFor(spec, lv) {
  const last = sget('sb.trayLv');
  sset('sb.trayLv', String(lv));
  if (last !== null && last !== String(lv)) return LINES.newWay;
  return /\p{Lu}/u.test(spec.word) ? LINES.capital : '';
}

/** The line card: one line at a time. `lead` (the new-way or capital note) shows first, then the instruction replaces it. The Hear button says what is shown. */
export function lineHtml(text, lead = '') {
  return '<div class="tileline" data-tileline><span class="tileline__icon" aria-hidden="true"></span><div class="tileline__body">'
    + '<p class="tileline__text" data-line data-base="' + esc(text) + '" data-lead="' + esc(lead) + '" role="status" aria-live="polite">' + esc(lead || text) + '</p></div>'
    + '<button type="button" class="hearround" data-instruct aria-label="Hear this line">' + HEAR_ICON + '</button></div>';
}

/** The letter boxes for a spec. `tricky`: the word's tricky letters, marked by the Plum rail on levels 1 and 2. */
export function boxesHtml(spec, { tricky = '', static: fixed = false } = {}) {
  const n = spec.letters.length;
  const total = spec.gaps.length;
  const cells = spec.letters.map((l, i) => {
    if (l.shown) return '<span class="lshown">' + esc(l.ch) + '</span>';
    const label = gapLabel(spec.gaps.indexOf(i) + 1, total, '');
    return fixed
      ? '<span class="lgap" data-gap="' + i + '"></span>'
      : '<button type="button" class="lgap" data-gap="' + i + '" aria-label="' + label + '" disabled></button>';
  });
  let out = cells;
  const at = spec.level <= 2 && tricky ? spec.word.toLowerCase().indexOf(String(tricky).toLowerCase()) : -1;
  if (at >= 0) {
    const to = at + String(tricky).length;
    out = [...cells.slice(0, at), '<span class="tileboxes__rail">' + cells.slice(at, to).join('') + '</span>', ...cells.slice(to)];
  }
  return '<div class="spellboxes tileboxes ' + sizeClass(n) + ' tn-' + Math.min(n, 20) + '" data-boxes>' + out.join('') + '</div>'
    + '<span class="sr" data-pattern>' + esc(patternOf(spec)) + '</span>';
}

/** The tray: tiles in one or two rows, and Back in a row of its own. `static`: the same picture with no buttons. */
const narrow = () => typeof innerWidth === 'number' && innerWidth < 360;
/** The tray and the buttons under it in one column, so on a wide short screen Check sits directly under the tray. */
export const colHtml = (tray, buttons) => '<div class="traycol">' + tray + buttons + '</div>';
export function trayHtml(spec, { static: fixed = false, back: withBack = true, size = 0 } = {}) {
  const sizes = rowSizes(spec.tiles.length, narrow() ? 5 : 6);
  let i = 0;
  const rows = sizes.map((k) => '<div class="keyboard-row">' + spec.tiles.slice(i, (i += k)).map((t) => (fixed
    ? '<span class="ltile" data-tile="' + t.id + '">' + esc(t.ch) + '</span>'
    : '<button type="button" class="ltile" data-tile="' + t.id + '" aria-label="' + tileLabel(esc(t.ch)) + '">' + esc(t.ch) + '</button>')).join('') + '</div>').join('');
  const back = fixed || !withBack ? '' : '<div class="keyboard-row tray-actions"><button type="button" class="btn btn--ghost tray-back" data-back>' + BACK_ICON + 'Back</button></div>';
  return '<div class="keyboard keyboard--tray' + (size === 56 || size === 48 ? ' t' + size : '') + '" role="group" aria-label="Letter tiles">' + rows + back + '</div>';
}

/**
 * SB6 (TR-43, Copy rung): the word shown above the boxes as a model. Tap only: it is text, nothing to drag, nothing to press.
 * Every letter has its own span so a screen can light the letter it is on (class is-lit).
 */
export const modelHtml = (word) => '<div class="s6-model" data-model role="img" aria-label="The word: ' + esc(word) + '">' + [...word].map((c, i) => '<span data-i="' + i + '">' + esc(c) + '</span>').join('') + '</div>';

/** The flower game's letters: the same `.key` buttons as the keyboard, in rows of at most 6 (5 on a narrow phone). Revealed letters are already on. */
export function padHtml(letters, revealed = new Set()) {
  return '<div class="keyboard keyboard--pad" role="group" aria-label="Letters">' + padRows(letters, narrow() ? 5 : 6).map((row) => '<div class="keyboard-row">'
    + row.map((c) => {
      const L = c.toUpperCase();
      const on = revealed.has(L);
      return '<button type="button" class="key' + (on ? ' hit' : '') + '" data-letter="' + L + '" aria-label="Guess ' + L + '"' + (on ? ' disabled' : '') + '>' + L + '</button>';
    }).join('') + '</div>').join('') + '<span class="keypop" aria-hidden="true"></span></div>';
}

const calm = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.body.classList.contains('is-xs');

// A copy of a tile flies between two places in 180 ms (never with reduced motion or on Extra support).
function fly(ch, from, to, size, done) {
  if (calm() || typeof document.body.animate !== 'function') { done(); return; }
  const el = document.createElement('span');
  el.className = 'ltile ltile--fly';
  el.textContent = ch;
  el.setAttribute('aria-hidden', 'true');
  const cx0 = from.left + from.width / 2;
  const cy0 = from.top + from.height / 2;
  el.style.setProperty('left', (cx0 - size.width / 2) + 'px');
  el.style.setProperty('top', (cy0 - size.height / 2) + 'px');
  document.body.appendChild(el);
  const dx = to.left + to.width / 2 - cx0;
  const dy = to.top + to.height / 2 - cy0;
  const a = el.animate([{ transform: 'translate(0, 0)' }, { transform: 'translate(' + dx + 'px, ' + dy + 'px)' }], { duration: 180, easing: 'ease-out' });
  const end = () => { el.remove(); done(); };
  a.onfinish = end;
  a.oncancel = end;
}

/**
 * Brings the tray in `root` to life. `root` holds the boxes (boxesHtml), the tray (trayHtml) and the line (lineHtml).
 * Returns { key, back, state, reset, check, showWrong, glow, fill, say, restore, hear, lock, destroy }.
 * mode 'test' gives no glow and no help. glowAfter: the miss on a gap after which its right tile glows (SB6: the spec's own `glowAfter` when the ladder made it).
 * SB6: every Check also reports `slips` (the box indices not right at that Check, ascending) and state().slipSpots holds every index missed since the last reset.
 */
export function mountTray(root, spec, { mode = 'practice', glowAfter = spec && spec.glowAfter ? spec.glowAfter : 2, xs = false, onChange, onFull } = {}) {
  let sp = spec;
  const slipSet = new Set(); // SB6: the box indices that were not right at any Check of this spec, for the try's `sl`
  let st = T.newTray(sp);
  let glowGap = null;
  let pulse = new Set();
  let right = false;
  let locked = false;
  let tries = 0;
  let checks = 0;
  let timer = null;
  let sayKind = '';
  const lineEl = root.querySelector('[data-line]');
  let base = (lineEl && lineEl.dataset.base) || (lineEl || {}).textContent || '';
  let lead = (lineEl && lineEl.dataset.lead) || ''; // shown first, then replaced by the instruction (one line at a time)
  let leadTimer = null;
  let hintTold = false;
  let pend = {}; // gap -> tile id: a flight on its way to that gap
  const q = (s) => root.querySelector(s);
  const card = q('[data-tileline]');
  if (xs) document.body.classList.add('is-xs');
  const tileEl = (id) => q('.ltile[data-tile="' + id + '"]');
  const gapEl = (g) => q('.lgap[data-gap="' + g + '"]');
  const chOf = (id) => sp.tiles.find((t) => t.id === id).ch;
  const placedLetters = () => Object.fromEntries(Object.entries(st.placed).map(([g, id]) => [g, chOf(id)]));
  const state = () => ({ answer: T.answerOf(st), full: T.full(st), right, tries, checks, helped: st.helped, placed: Object.keys(st.placed).length, misses: { ...st.misses }, placedIds: { ...st.placed }, slipSpots: [...slipSet].sort((a, b) => a - b) });

  function paintLine() {
    const t = q('[data-line]');
    if (!t) return;
    t.textContent = lead || base;
    if (card) { card.classList.remove('tileline--soft', 'tileline--ok'); const i = q('.tileline__icon'); if (i) i.innerHTML = ''; }
    sayKind = '';
  }
  function say(text, kind = '') {
    const t = q('[data-line]');
    if (!t) return;
    t.textContent = text;
    lead = '';
    clearTimeout(leadTimer);
    if (card) {
      card.classList.toggle('tileline--soft', kind === 'soft');
      card.classList.toggle('tileline--ok', kind === 'ok');
      const i = q('.tileline__icon');
      if (i) i.innerHTML = kind === 'ok' ? TICK_ICON : kind === 'soft' ? AGAIN_ICON : '';
    }
    sayKind = kind || 'x';
  }
  const restore = () => { if (sayKind) paintLine(); };
  // The lead line gives way to the instruction (a tap, or 4.5 s); the Back hint is the same kind of lead.
  function endLead() { clearTimeout(leadTimer); if (!lead) return; lead = ''; if (!sayKind) paintLine(); }
  function startLead(text) { lead = text; clearTimeout(leadTimer); leadTimer = setTimeout(endLead, 4500); if (!sayKind) paintLine(); }
  function clearArriving() { pend = {}; root.querySelectorAll('.lgap.is-arriving').forEach((e) => e.classList.remove('is-arriving')); }

  function render() {
    const used = new Set(Object.values(st.placed));
    const glowId = glowGap !== null && !(glowGap in st.placed) ? T.glowFor(st, glowGap) : null;
    for (const t of sp.tiles) {
      const el = tileEl(t.id);
      if (!el) continue;
      const u = used.has(t.id);
      el.classList.toggle('is-used', u);
      el.classList.toggle('is-glow', glowId === t.id);
      if (u) { el.disabled = true; el.setAttribute('aria-hidden', 'true'); el.tabIndex = -1; } else {
        el.disabled = locked || right;
        el.removeAttribute('aria-hidden');
        el.removeAttribute('tabindex');
      }
    }
    const next = st.open !== null && !(st.open in st.placed) ? st.open : sp.gaps.find((g) => !(g in st.placed));
    sp.gaps.forEach((g, n) => {
      const el = gapEl(g);
      if (!el) return;
      const filled = g in st.placed;
      const ch = filled ? chOf(st.placed[g]) : '';
      if (!el.classList.contains('is-arriving')) el.textContent = ch;
      el.classList.toggle('is-filled', filled);
      el.classList.toggle('is-next', !right && g === next);
      el.classList.toggle('is-pulse', pulse.has(g));
      el.classList.toggle('is-right', right);
      if (el.tagName === 'BUTTON') {
        el.setAttribute('aria-label', gapLabel(n + 1, sp.gaps.length, ch));
        el.disabled = !filled || right || locked;
      }
    });
    const pat = q('[data-pattern]');
    if (pat) pat.textContent = patternOf(sp, placedLetters());
    const back = q('[data-back]');
    if (back) back.disabled = right || locked || !st.order.length;
    if (onChange) onChange(state());
    if (T.full(st) && onFull) onFull(state());
  }
  const clearPulseLater = () => { clearTimeout(timer); timer = setTimeout(() => { pulse = new Set(); render(); }, 400); };

  function touched() { glowGap = null; if (pulse.size) pulse = new Set(); restore(); }
  function popGap(g) {
    const el = gapEl(g);
    if (!el) return;
    el.classList.remove('is-pop');
    void el.offsetWidth;
    el.classList.add('is-pop');
  }
  function placeTile(id) {
    if (locked || right) return false;
    const before = st;
    const next = T.put(st, id);
    if (next === before) return false;
    const gap = next.order[next.order.length - 1];
    const from = tileEl(id).getBoundingClientRect();
    const ge = gapEl(gap);
    const to = ge.getBoundingClientRect();
    const hadLead = !!lead;
    endLead();
    touched();
    st = next;
    ge.classList.add('is-arriving');
    pend[gap] = id;
    render();
    fly(chOf(id), from, to, { width: from.width, height: from.height }, () => {
      if (pend[gap] !== id) return; // taken back (or replaced) while flying: nothing to write
      delete pend[gap];
      ge.classList.remove('is-arriving');
      if (st.placed[gap] === id) { ge.textContent = chOf(id); popGap(gap); } else render();
    });
    if (!hadLead && !hintTold && !sget('sb.trayHint') && mode !== 'test') {
      hintTold = true;
      sset('sb.trayHint', '1');
      startLead(LINES.back);
    }
    return true;
  }
  function takeBack() {
    if (locked || right) return false;
    const next = T.back(st);
    if (next === st) return false;
    clearArriving();
    touched();
    st = next;
    render();
    return true;
  }
  function unputGap(g) {
    if (locked || right) return false;
    const el = gapEl(g);
    if (!el || el.getBoundingClientRect().width < 40) return false;
    const next = T.unput(st, g);
    if (next === st) return false;
    clearArriving();
    touched();
    st = next;
    render();
    return true;
  }

  function key(letter) {
    const L = String(letter).toLowerCase();
    const used = new Set(Object.values(st.placed));
    const t = sp.tiles.find((x) => x.ch.toLowerCase() === L && !used.has(x.id));
    return t ? placeTile(t.id) : false;
  }
  function showWrong(gaps) {
    pulse = new Set(gaps);
    render();
    clearPulseLater();
  }
  function glow(g) { glowGap = g; render(); }
  function fill(g) {
    st = T.autoFill(st, g);
    glowGap = null;
    render();
    popGap(g);
  }
  function check() {
    if (locked || right || !T.full(st)) return null;
    checks += 1;
    clearArriving();
    const wrongNow = sp.gaps.filter((g) => g in st.placed && chOf(st.placed[g]) !== sp.letters[g].ch);
    const flights = wrongNow.map((g) => ({ g, ch: chOf(st.placed[g]), id: st.placed[g], from: gapEl(g).getBoundingClientRect() }));
    const r = T.check(st);
    if (r.right) {
      right = true;
      render();
      say(LINES.right, 'ok');
      return { right: true, wrongGaps: [], slips: [], glowGap: null, filledGap: null, ...state() };
    }
    st = r.st;
    tries += r.wrongGaps.length;
    r.wrongGaps.forEach((g) => slipSet.add(g));
    let filled = null;
    let glowAt = null;
    if (mode !== 'test') {
      for (const g of r.wrongGaps) {
        const m = st.misses[g] || 0;
        if (m >= 3 && filled === null) filled = g;
        else if (m >= glowAfter && glowAt === null) glowAt = g;
      }
    }
    glowGap = glowAt;
    if (filled !== null) st = T.autoFill(st, filled);
    pulse = new Set(r.wrongGaps.filter((g) => g !== filled));
    render();
    for (const f of flights) {
      const te = tileEl(f.id);
      if (te) { const ghost = te.getBoundingClientRect(); fly(f.ch, f.from, ghost, { width: ghost.width, height: ghost.height }, () => {}); }
    }
    clearPulseLater();
    let line = '';
    if (mode === 'test') line = '';
    else if (glowAt !== null) line = LINES.glow;
    else if (!T.full(st)) line = LINES.nearly;
    if (line) say(line, 'soft');
    return { right: false, wrongGaps: r.wrongGaps, slips: [...r.wrongGaps].sort((a, b) => a - b), glowGap: glowAt, filledGap: filled, line, ...state() };
  }
  function reset(next = sp) {
    sp = next;
    st = T.newTray(sp);
    glowGap = null;
    pulse = new Set();
    right = false;
    tries = 0;
    checks = 0;
    slipSet.clear();
    lead = '';
    clearTimeout(leadTimer);
    clearArriving();
    paintLine();
    render();
  }
  function hear() {
    return sayLine((q('[data-line]') || {}).textContent || '');
  }
  // SB6 (place restore): put tiles back where a reload left them: { gapIndex: tileId }, in gap order. A tile that is gone or already used is skipped.
  function restorePlaced(map) {
    let n = 0;
    for (const g of Object.keys(map || {}).map(Number).sort((a, b) => a - b)) {
      if (!sp.gaps.includes(g) || g in st.placed) continue;
      const next = T.put({ ...st, open: g }, map[g]);
      if (next !== st && g in next.placed) { st = next; n += 1; }
    }
    if (n) { clearArriving(); render(); }
    return n;
  }

  root.querySelectorAll('.ltile[data-tile]').forEach((el) => el.addEventListener('click', () => placeTile(el.dataset.tile)));
  root.querySelectorAll('.lgap[data-gap]').forEach((el) => el.addEventListener('click', () => unputGap(Number(el.dataset.gap))));
  const backBtn = q('[data-back]');
  if (backBtn) backBtn.addEventListener('click', takeBack);
  const ins = q('[data-instruct]');
  if (ins) ins.addEventListener('click', hear);
  paintLine();
  render();
  if (lead) leadTimer = setTimeout(endLead, 4500);

  return {
    key, back: takeBack, state, reset, check, showWrong, glow, fill, say, restore, hear, restorePlaced,
    setBase(text) { base = text; lead = ''; clearTimeout(leadTimer); paintLine(); },
    lock(on) { locked = !!on; render(); },
    destroy() { clearTimeout(timer); clearTimeout(leadTimer); if (xs) document.body.classList.remove('is-xs'); },
  };
}
