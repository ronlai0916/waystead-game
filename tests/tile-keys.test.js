// SB7 BUILD-1 (D31): a hardware keyboard on letter-tile screens (site/js/tile-keys.js). Run: node --test tests/tile-keys.test.js
// The rules are tested on their own, then with the real tray (tray.js mountTray) behind a tiny fake page, wired the way the Step by step screens wire it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as K from '../site/js/tile-keys.js';
import * as T from '../site/js/tiles-doc.js';

const read = (f) => readFileSync(fileURLToPath(new URL('../site/js/' + f, import.meta.url)), 'utf8');

// ---- a tiny fake page ----
class Cls {
  constructor() { this.s = new Set(); }
  add(...c) { c.forEach((x) => this.s.add(x)); }
  remove(...c) { c.forEach((x) => this.s.delete(x)); }
  contains(c) { return this.s.has(c); }
  toggle(c, on) { if (on === undefined ? !this.s.has(c) : on) this.s.add(c); else this.s.delete(c); }
}
class El {
  constructor(tag = 'span', attrs = {}) { this.tagName = tag.toUpperCase(); this.classList = new Cls(); this.textContent = ''; this.innerHTML = ''; this.dataset = {}; this.attrs = {}; this.disabled = false; this.on = {}; this.attrs = attrs; this.clicks = 0; }
  setAttribute(k, v) { this.attrs[k] = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); }
  removeEventListener(t, f) { this.on[t] = (this.on[t] || []).filter((x) => x !== f); }
  click() { this.clicks += 1; (this.on.click || []).forEach((f) => f()); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 44, height: 44 }; }
  get offsetWidth() { return 44; }
}
/** A page holding `word`'s tray: tile buttons (data-tile), gap buttons (data-gap), Back, a line, and a Check button. */
function pageFor(spec) {
  const tiles = spec.tiles.map((t) => { const e = new El('button'); e.dataset.tile = t.id; e.classList.add('ltile'); return e; });
  const gaps = spec.gaps.map((g) => { const e = new El('button'); e.dataset.gap = String(g); e.classList.add('lgap'); return e; });
  const back = new El('button'); const check = new El('button'); const line = new El('p'); line.dataset.base = 'x'; const pat = new El('span');
  const root = {
    querySelector(sel) {
      let m;
      if ((m = sel.match(/^\.ltile\[data-tile="(.+)"\]$/))) return tiles.find((e) => e.dataset.tile === m[1]) || null;
      if ((m = sel.match(/^\.lgap\[data-gap="(\d+)"\]$/))) return gaps.find((e) => e.dataset.gap === m[1]) || null;
      if (sel === '[data-back]') return back;
      if (sel === '[data-check]') return check;
      if (sel === '[data-line]') return line;
      if (sel === '[data-pattern]') return pat;
      return null;
    },
    querySelectorAll(sel) { return sel === '.ltile[data-tile]' ? tiles : sel === '.lgap[data-gap]' ? gaps : []; },
  };
  return { root, tiles, gaps, back, check };
}
function fakeDoc() {
  const h = [];
  const doc = {
    body: { classList: new Cls() },
    dialog: false,
    listeners: h,
    addEventListener(t, f) { if (t === 'keydown') h.push(f); },
    removeEventListener(t, f) { const i = h.indexOf(f); if (i >= 0) h.splice(i, 1); },
    querySelector(sel) { return this.dialog && /dialog/.test(sel) ? { role: 'dialog' } : null; },
  };
  doc.press = (key, extra = {}) => { const e = { key, target: extra.target || null, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra }; [...h].forEach((f) => f(e)); return e; };
  return doc;
}

const E = (w) => ({ word: w, chunks: [w] });
// 'apple': level 2 leaves a gap for each p (two p tiles). Tiles are the missing letters plus a few more.
const specOf = (word, lv = 3) => T.tilesFor(E(word), lv, T.seedOf(word, '2026-11-27'));

// ---- the rules ----
test('intentOf: letters (any case), Backspace and Enter mean something; digits, arrows and Space do not', () => {
  assert.deepEqual(K.intentOf({ key: 'a' }), { kind: 'letter', ch: 'a' });
  assert.deepEqual(K.intentOf({ key: 'Q' }), { kind: 'letter', ch: 'q' });
  assert.deepEqual(K.intentOf({ key: 'Backspace' }), { kind: 'back' });
  assert.deepEqual(K.intentOf({ key: 'Enter' }), { kind: 'check' });
  for (const key of ['1', ' ', 'ArrowLeft', 'Tab', 'Escape', 'é', 'Shift']) assert.equal(K.intentOf({ key }), null, key);
});
test('intentOf: Ctrl, Meta or Alt ignore every key', () => {
  for (const mod of ['ctrlKey', 'metaKey', 'altKey']) for (const key of ['a', 'Backspace', 'Enter']) assert.equal(K.intentOf({ key, [mod]: true }), null, mod + key);
});
test('intentOf: a key in a real text field (or editable text) is ignored; a button or the page is not a text field', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) assert.equal(K.intentOf({ key: 'a', target: { tagName } }), null, tagName);
  assert.equal(K.intentOf({ key: 'a', target: { tagName: 'DIV', isContentEditable: true } }), null);
  assert.deepEqual(K.intentOf({ key: 'a', target: { tagName: 'BUTTON' } }), { kind: 'letter', ch: 'a' });
  assert.deepEqual(K.intentOf({ key: 'a', target: { tagName: 'BODY' } }), { kind: 'letter', ch: 'a' });
});
test('intentOf: while a dialog is open every key is ignored', () => {
  const doc = fakeDoc();
  assert.deepEqual(K.intentOf({ key: 'a' }, doc), { kind: 'letter', ch: 'a' });
  doc.dialog = true;
  for (const key of ['a', 'Backspace', 'Enter']) assert.equal(K.intentOf({ key }, doc), null, key);
});
test('Enter on a focused button or link is left to the browser (so Check never fires twice); held Enter does nothing', () => {
  assert.equal(K.intentOf({ key: 'Enter', target: { tagName: 'BUTTON' } }), null);
  assert.equal(K.intentOf({ key: 'Enter', target: { tagName: 'A' } }), null);
  assert.equal(K.intentOf({ key: 'Enter', repeat: true }), null);
  assert.deepEqual(K.intentOf({ key: 'Enter', target: { tagName: 'BODY' } }), { kind: 'check' });
});
test('FIX-1 C3: Enter on a focused letter tile or gap (a tapped tile keeps focus in desktop Chrome) is Check, not a press of the tile', () => {
  const tile = { tagName: 'BUTTON', classList: { contains: (c) => c === 'ltile' }, dataset: { tile: 't1' } };
  const gap = { tagName: 'BUTTON', classList: { contains: (c) => c === 'lgap' }, dataset: { gap: '0' } };
  assert.deepEqual(K.intentOf({ key: 'Enter', target: tile }), { kind: 'check' });
  assert.deepEqual(K.intentOf({ key: 'Enter', target: gap }), { kind: 'check' });
  assert.equal(K.intentOf({ key: 'Enter', target: { tagName: 'BUTTON', classList: { contains: () => false }, dataset: {} } }), null, 'another button keeps its own Enter');
  let pressed = 0; let prevented = 0;
  K.handleKey({ key: 'Enter', target: tile, preventDefault: () => { prevented += 1; } }, { onCheck: () => { pressed += 1; } });
  assert.deepEqual([pressed, prevented], [1, 1]);
});
test('FIX-1 C3: after a right answer Enter is Next on the rung and row screens (wired to the same button)', () => {
  const src = readFileSync(fileURLToPath(new URL('../site/js/sbs-views.js', import.meta.url)), 'utf8');
  assert.equal((src.match(/else if \(!checkBtn\.disabled\) checkBtn\.click\(\)/g) || []).length, 2);
});
test('tileForLetter: the first unused tile with that letter, any case; none when they are all used or there is no such tile', () => {
  const tiles = [{ id: 't0', ch: 'p' }, { id: 't1', ch: 'L' }, { id: 't2', ch: 'p' }];
  assert.equal(K.tileForLetter(tiles, new Set(), 'p').id, 't0');
  assert.equal(K.tileForLetter(tiles, new Set(['t0']), 'P').id, 't2');
  assert.equal(K.tileForLetter(tiles, new Set(['t0', 't2']), 'p'), null);
  assert.equal(K.tileForLetter(tiles, new Set(), 'l').id, 't1');
  assert.equal(K.tileForLetter(tiles, new Set(), 'z'), null);
});
test('pressCheck presses Check only when it is there and enabled', () => {
  const b = new El('button');
  const root = { querySelector: () => b };
  b.disabled = true;
  assert.equal(K.pressCheck(root), false);
  assert.equal(b.clicks, 0);
  b.disabled = false;
  assert.equal(K.pressCheck(root), true);
  assert.equal(b.clicks, 1);
  assert.equal(K.pressCheck({ querySelector: () => null }), false);
});

// ---- the real tray, driven by keys ----
async function withTray(word, fn) {
  const store = {};
  globalThis.sessionStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const doc = fakeDoc();
  globalThis.document = doc;
  const spec = specOf(word);
  const page = pageFor(spec);
  const Tr = await import('../site/js/tray.js');
  const ctrl = Tr.mountTray(page.root, spec, { mode: 'practice', xs: true, onChange: (s) => { page.check.disabled = !s.full; } });
  // wired as the Step by step rung screen wires it
  const keys = K.mountTileKeys({ doc, onLetter: (ch) => ctrl.key(ch), onBack: () => ctrl.back(), onCheck: () => K.pressCheck(page.root) });
  try { await fn({ spec, page, ctrl, doc, keys }); } finally { keys.destroy(); ctrl.destroy(); delete globalThis.document; delete globalThis.sessionStorage; }
}
const gapLetters = (spec) => spec.gaps.map((g) => spec.letters[g].ch.toLowerCase());

test('a letter key places the matching tile in the next gap, like a tap (the same state and the same count)', async () => {
  await withTray('apple', async ({ spec, ctrl, doc }) => {
    const first = gapLetters(spec)[0];
    assert.equal(ctrl.state().placed, 0);
    const e = doc.press(first.toUpperCase());
    assert.equal(e.defaultPrevented, true);
    assert.equal(ctrl.state().placed, 1);
    assert.equal(ctrl.state().tries, 0, 'a key is not a try; only Check counts');
    const used = Object.values(ctrl.state().placedIds);
    const tile = spec.tiles.find((t) => t.id === used[0]);
    assert.equal(tile.ch.toLowerCase(), first);
  });
});
test('a repeated letter takes the second tile, then nothing is left for a third press', async () => {
  await withTray('apple', async ({ spec, ctrl, doc }) => {
    const pCount = spec.tiles.filter((t) => t.ch.toLowerCase() === 'p').length;
    assert.ok(pCount >= 1);
    for (let i = 0; i < pCount + 2; i += 1) doc.press('p');
    assert.equal(ctrl.state().placed, Math.min(pCount, spec.gaps.length), 'one tile per press, never more than the p tiles');
    const ids = Object.values(ctrl.state().placedIds);
    assert.equal(new Set(ids).size, ids.length, 'each tile once');
    assert.ok(ids.every((id) => spec.tiles.find((t) => t.id === id).ch.toLowerCase() === 'p'));
  });
});
test('a letter with no tile left does nothing: nothing placed, no wrong try recorded', async () => {
  await withTray('apple', async ({ spec, ctrl, doc }) => {
    const absent = [...'qzxjvk'].find((c) => !spec.tiles.some((t) => t.ch.toLowerCase() === c));
    assert.ok(absent);
    doc.press(absent);
    doc.press(absent.toUpperCase());
    const s = ctrl.state();
    assert.equal(s.placed, 0);
    assert.equal(s.tries, 0);
    assert.equal(s.checks, 0);
    assert.deepEqual(s.misses, {});
  });
});
test('Backspace takes the last tile back (and does nothing when none is placed)', async () => {
  await withTray('apple', async ({ spec, ctrl, doc }) => {
    const [a, b] = gapLetters(spec);
    doc.press('Backspace');
    assert.equal(ctrl.state().placed, 0);
    doc.press(a); doc.press(b);
    assert.equal(ctrl.state().placed, 2);
    const e = doc.press('Backspace');
    assert.equal(e.defaultPrevented, true);
    assert.equal(ctrl.state().placed, 1);
    doc.press('Backspace');
    assert.equal(ctrl.state().placed, 0);
  });
});
test('Enter presses Check only when Check is enabled (every gap full)', async () => {
  await withTray('apple', async ({ spec, page, ctrl, doc }) => {
    doc.press('Enter');
    assert.equal(page.check.clicks, 0, 'disabled: nothing');
    const need = [...gapLetters(spec)];
    need.forEach((c) => doc.press(c));
    assert.equal(ctrl.state().full, true);
    assert.equal(page.check.disabled, false);
    doc.press('Enter');
    assert.equal(page.check.clicks, 1);
    // a focused button takes the key itself: no second press from us
    doc.press('Enter', { target: { tagName: 'BUTTON' } });
    assert.equal(page.check.clicks, 1);
  });
});
test('a modifier key, an open dialog and a text field are all ignored by the screen', async () => {
  await withTray('apple', async ({ spec, ctrl, doc }) => {
    const a = gapLetters(spec)[0];
    doc.press(a, { ctrlKey: true });
    doc.press(a, { metaKey: true });
    doc.press(a, { altKey: true });
    doc.press(a, { target: { tagName: 'INPUT' } });
    doc.dialog = true;
    doc.press(a);
    assert.equal(ctrl.state().placed, 0);
    doc.dialog = false;
    doc.press(a);
    assert.equal(ctrl.state().placed, 1);
  });
});
test('after destroy the listener is gone: a key does nothing, and a second screen is not handled twice', async () => {
  await withTray('apple', async ({ spec, ctrl, doc, keys }) => {
    const a = gapLetters(spec)[0];
    assert.equal(doc.listeners.length, 1);
    keys.destroy();
    keys.destroy(); // safe twice
    assert.equal(doc.listeners.length, 0);
    doc.press(a);
    assert.equal(ctrl.state().placed, 0);
    // the next screen's listener alone handles the key: exactly one tile
    const next = K.mountTileKeys({ doc, onLetter: (ch) => ctrl.key(ch) });
    doc.press(a);
    assert.equal(ctrl.state().placed, 1);
    next.destroy();
  });
});

// ---- the screens are wired ----
test('every Step by step tile screen mounts the keys and drops them in destroy (rung, row, Sentences step)', () => {
  const sbs = read('sbs-views.js');
  assert.equal((sbs.match(/mountTileKeys\(/g) || []).length, 2, 'rungScreen and rowScreen');
  assert.equal((sbs.match(/keyMount\.destroy\(\)/g) || []).length, 2);
  assert.doesNotMatch(sbs, /addEventListener\('keydown'/, 'one place for keys: tile-keys.js');
  const b = read('builder-views.js');
  assert.match(b, /mountTileKeys\(/);
  assert.match(b, /undo\.push\(\(\) => keyMount\.destroy\(\)\)/);
});
test('the Usual tile screens use the same rules (Missing letters, Quick-fire, Fix it in the mix, Fix it in, My words practice)', () => {
  for (const f of ['games-views.js', 'study-views.js', 'words-views.js']) assert.match(read(f), /handleKey as tileKey/, f);
  assert.equal((read('games-views.js').match(/tileKey\(e,/g) || []).length, 3);
});
test('tile-keys.js keeps off the child-facing copy: no strings but selectors', () => {
  assert.doesNotMatch(read('tile-keys.js'), /innerHTML|toast|textContent/);
});
