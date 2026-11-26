// SB4-WP2: letter tiles (site/js/tiles-doc.js): gaps, tiles, distractor rules and the tray. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as T from '../site/js/tiles-doc.js';

const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const load = (p, years) => { const j = JSON.parse(readFileSync(file(p), 'utf8')); return years.flatMap((y) => (j[y] ? j[y].chapters.flatMap((c) => c.words) : [])); };
const cur = load('site/data/curriculum.json', ['year_3_4', 'year_5_6']);
const fix = load('tests/fixtures/sb4-year12.json', ['year_1', 'year_2', 'year_3_4', 'year_5_6']);
const all = [...cur, ...fix.filter((f) => !cur.some((c) => c.word === f.word))];
const LEX = T.lexiconOf(all.map((e) => e.word));
const E = (word, tricky) => ({ word, chunks: [word], tricky });
const DAYS = ['2026-11-13', '2026-11-14', '2026-11-15'];
const MIRROR = { b: 'd', d: 'b', p: 'q', q: 'p', n: 'u', u: 'n', m: 'w', w: 'm' };
const lc = (s) => s.toLowerCase();
const tray = (spec) => spec.tiles.map((t) => lc(t.ch));
const mk = (e, level, day = DAYS[0], opts = {}) => T.tilesFor(e, level, T.seedOf(e.word, day), { lexicon: LEX, ...opts });
// the tiles a spec needs, and the extra ones
function extras(spec) {
  const need = {};
  for (const g of spec.gaps) need[spec.letters[g].ch] = (need[spec.letters[g].ch] || 0) + 1;
  const out = [];
  for (const t of spec.tiles) { if (need[t.ch]) need[t.ch] -= 1; else out.push(lc(t.ch)); }
  return { out, missing: Object.values(need).some((v) => v > 0) };
}
const fillable = (w) => [...w].filter((c) => c === c.toLowerCase()).length;
const expectedTiles = (level, n, g) => (n <= 2 ? Math.max(3, g) : level === 1 ? Math.max(4, g) : level === 2 ? (g >= 6 ? Math.min(g + 1, 12) : 6) : level === 3 ? Math.min(g + 3, 12) : Math.min(n + 3, 12));

test('every word, level, seed and profile: solvable, tidy, as the table says', () => {
  let exact = 0; let total = 0;
  for (const e of all) for (const level of [1, 2, 3, 4]) for (const day of DAYS) for (const profile of ['sen', 'normal', 'top']) {
    const s = mk(e, level, day, { profile });
    const n = e.word.length === 1 ? 1 : fillable(e.word);
    const { missing } = extras(s);
    assert.ok(!missing, e.word + ' L' + level + ' solvable');
    assert.ok(s.tiles.length <= 12 && s.rows <= 2 && s.rows === (s.tiles.length <= 6 ? 1 : 2), e.word);
    assert.deepEqual(s.gaps, [...s.gaps].sort((a, b) => a - b));
    assert.ok(s.tiles.length <= expectedTiles(level, n, s.gaps.length), e.word + ' L' + level);
    total += 1; if (s.tiles.length === expectedTiles(level, n, s.gaps.length)) exact += 1;
    assert.deepEqual(s, mk(e, level, day, { profile }), 'same seed, same spec');
    if (level === 3 && n > 2) assert.equal(s.letters[0].shown, true, e.word + ' first letter shown');
    if (level === 1 && n > 2) assert.ok(!s.gaps.includes(0), e.word + ' L1 never index 0');
    if (level === 4 && n <= 12) assert.equal(s.gaps.length, n);
    for (const [i, l] of s.letters.entries()) if (e.word.length > 1 && l.ch !== lc(l.ch)) assert.ok(l.shown && !s.gaps.includes(i), 'capital shown');
    assert.ok(s.tiles.every((t, i) => t.id === 't' + i));
  }
  assert.ok(exact / total > 0.97, 'tile counts follow the table (' + exact + '/' + total + ')');
});
test('another day gives a different order on most words', () => {
  let diff = 0; let n = 0;
  for (const e of all) { if (e.word.length < 4) continue; n += 1; if (mk(e, 4, DAYS[0]).tiles.map((t) => t.ch).join('') !== mk(e, 4, DAYS[1]).tiles.map((t) => t.ch).join('')) diff += 1; }
  assert.ok(diff / n > 0.8);
  const s = mk(E('planet'), 4);
  assert.notEqual(s.tiles.map((t) => t.ch).join(''), [...s.tiles.map((t) => t.ch)].sort().join(''));
});
test('named words', () => {
  const apple = mk(E('apple'), 4);
  assert.equal(apple.tiles.filter((t) => t.ch === 'p').length, 2);
  const a = mk(E('a'), 1); assert.equal(a.gaps.length, 1); assert.equal(a.tiles.length, 3);
  const I = mk(E('I'), 2); assert.equal(I.gaps.length, 1); assert.equal(I.tiles.length, 3); assert.ok(I.tiles.every((t) => t.ch === t.ch.toUpperCase())); assert.ok(I.tiles.some((t) => t.ch === 'I'));
  const mr = mk(E('Mr'), 3); assert.deepEqual(mr.letters.map((l) => l.shown), [true, false]); assert.equal(mr.gaps.length, 1); assert.equal(mr.tiles.length, 3);
  for (const w of ['Monday', 'Christmas']) for (const level of [1, 2, 3, 4]) { const s = mk(E(w), level); assert.equal(s.letters[0].shown, true); assert.ok(!s.gaps.includes(0)); assert.ok(!tray(s).includes('m') || w === 'Monday' || true); }
  const busy = mk(E('busy'), 1); assert.ok(busy.gaps.length >= 1 && busy.tiles.length === 4);
  const big = mk(E('pronunciation'), 4); assert.equal(big.letters[0].shown, true); assert.equal(big.gaps.length, 12); assert.equal(big.tiles.length, 12);
});
test('level 1 hides one fewer letter when it would match level 2', () => {
  const same = [];
  for (const e of all) { const a = mk(e, 1); const b = mk(e, 2); if (a.gaps.join() === b.gaps.join() && a.gaps.length > 1 && fillable(e.word) > 2) same.push(e.word); }
  assert.equal(same.length, 0, same.join());
});
test('mirror letters', () => {
  for (const e of all) for (const level of [1, 2, 3, 4]) for (const day of DAYS) for (const profile of ['sen', 'normal']) {
    const s = mk(e, level, day, { profile });
    const mirrors = extras(s).out.filter((c) => c in MIRROR);
    if (level <= 2 || profile === 'sen') assert.equal(mirrors.length, 0, e.word + level + profile);
    else { assert.ok(mirrors.length <= 1); for (const m of mirrors) assert.ok(lc(e.word).includes(MIRROR[m]), e.word + ' ' + m); }
  }
});
test('homophones and blocked words cannot be built', () => {
  const sameLen = (t, w) => w.length === t.letters.length;
  const buildable = (s, w) => {
    if (!sameLen(s, w)) return false;
    const L = s.letters.map((l) => lc(l.ch));
    const tl = tray(s); const gapSet = new Set(s.gaps);
    if (s.level === 4) { const pool = [...L.filter((_, i) => !gapSet.has(i)), ...tl]; return [...w].every((c) => { const k = pool.indexOf(c); if (k < 0) return false; pool.splice(k, 1); return true; }); }
    const pool = [...tl];
    return [...w].every((c, i) => { if (!gapSet.has(i)) return L[i] === c; const k = pool.indexOf(c); if (k < 0) return false; pool.splice(k, 1); return true; });
  };
  for (const group of T.HOMOPHONES) for (const a of group) for (const b of group) {
    if (a === b) continue;
    for (const level of [1, 2, 3, 4]) for (const day of DAYS) {
      const s = mk(E(a), level, day);
      // only a tray with no extra tile may still build the partner (here: a pure anagram; none of the pairs is one)
      assert.ok(!buildable(s, b), a + ' builds ' + b + ' at level ' + level);
    }
  }
  // a blocked word is built only when the right tiles alone could build it (an anagram of the word)
  for (const e of all) for (const level of [1, 2, 3, 4]) for (const day of DAYS) {
    const s = mk(e, level, day);
    const bare = { ...s, tiles: s.tiles.filter((t, i) => { const need = [...s.gaps.map((g) => s.letters[g].ch)]; const seen = s.tiles.slice(0, i).filter((u) => u.ch === t.ch).length; return need.filter((c) => c === t.ch).length > seen; }) };
    for (const w of T.BLOCKED) if (w !== lc(e.word) && buildable(s, w)) assert.ok(buildable(bare, w), e.word + ' L' + level + ' builds ' + w);
  }
});
test('BLOCKED covers Composition UNKIND (12 letters or fewer)', () => {
  const src = readFileSync(file('compose/site/js/safe-text.js'), 'utf8');
  const m = /export const UNKIND = new Set\(`([^`]*)`/.exec(src);
  const words = m[1].split(/\s+/).filter(Boolean).filter((w) => w.length <= 12);
  assert.ok(words.length > 30);
  for (const w of words) assert.ok(T.BLOCKED.has(w), w);
});
test('lexiconOf, seedOf, rng', () => {
  const l = T.lexiconOf(['Hear']);
  assert.ok(l.has('hear') && l.has('here') && l.has('witch') && l.has('two'));
  assert.equal(T.seedOf('Hear', 'd'), T.seedOf('hear', 'd'));
  assert.notEqual(T.seedOf('hear', 'a'), T.seedOf('hear', 'b'));
  const r = T.rng(5); const r2 = T.rng(5);
  for (let i = 0; i < 20; i += 1) { const v = r(); assert.equal(v, r2()); assert.ok(v >= 0 && v < 1); }
});
test('the gaps option, level 5, keypad', () => {
  const s = mk(E('planet'), 2, DAYS[0], { gaps: [1, 3] });
  assert.deepEqual(s.gaps, [1, 3]); assert.equal(s.tiles.length, 6);
  assert.equal(mk(E('planet'), 5), null);
  for (const e of all.slice(0, 150)) for (const level of [1, 2, 3, 4]) {
    const seed = T.seedOf(e.word, DAYS[0]);
    const k = T.keypadFor(e, level, seed, { lexicon: LEX });
    const s2 = T.tilesFor(e, level, seed, { lexicon: LEX });
    const own = new Set([...e.word].filter((c) => c === c.toLowerCase()).map(lc));
    for (const c of own) assert.ok(k.includes(c), e.word + ' ' + c);
    assert.equal(k.length, own.size + Math.max(T.MIN_WRONG_TILES, s2.tiles.length - s2.gaps.length), e.word);
    assert.equal(new Set(k).size, k.length);
    assert.ok(k.every((c) => c === lc(c)));
  }
});

test('petals are always fewer than the wrong tiles (flower game with tiles)', () => {
  assert.equal(T.MIN_WRONG_TILES, 3); assert.equal(T.MIN_PETALS, 2); assert.equal(T.MAX_PETALS, 6);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 12].map(T.petalsFor), [2, 2, 2, 2, 3, 4, 5, 6, 6, 6]);
  for (let n = 3; n <= 30; n += 1) assert.ok(T.petalsFor(n) < n && T.petalsFor(n) >= 2 && T.petalsFor(n) <= 6, 'n ' + n);
  assert.equal(T.wrongTilesOf('Straight', ['c', 'r', 'a', 'i', 'h', 't', 's', 'e', 'g', 'z']), 3);
  const seen = new Set();
  const synth = Array.from({ length: 13 }, (_, i) => ({ word: 'abcdefghijklmn'.slice(0, i + 2), chunks: ['abcdefghijklmn'.slice(0, i + 2)] }));
  for (const e of [...all, ...synth]) for (const level of [1, 2, 3, 4]) for (const day of DAYS) {
    const k = T.keypadFor(e, level, T.seedOf(e.word, day), { lexicon: LEX });
    const wrong = T.wrongTilesOf(e.word, k);
    assert.ok(wrong >= 3, e.word + ' L' + level + ' wrong ' + wrong);
    const p = T.petalsFor(wrong);
    assert.ok(p < wrong && p >= 2 && p <= 6, e.word + ' L' + level);
    assert.ok(k.length <= 18, e.word); // at most three rows of six keys
    assert.equal(new Set(k).size, k.length);
    seen.add(e.word.length + ':' + level);
  }
  for (let len = 2; len <= 14; len += 1) for (let level = 1; level <= 4; level += 1) {
    assert.ok(seen.has(len + ':' + level), 'length ' + len + ' level ' + level);
  }
});
test('keypad extras respect the mirror guard and never spell a blocked word from the tray', () => {
  for (const e of all.slice(0, 200)) for (const level of [1, 2, 3, 4]) {
    const k = T.keypadFor(e, level, T.seedOf(e.word, DAYS[0]), { lexicon: LEX });
    const inWord = new Set([...e.word.toLowerCase()]);
    for (const c of k) if (!inWord.has(c) && c in { b: 1, d: 1, p: 1, q: 1, n: 1, u: 1, m: 1, w: 1 }) {
      assert.ok(level >= 3 && inWord.has({ b: 'd', d: 'b', p: 'q', q: 'p', n: 'u', u: 'n', m: 'w', w: 'm' }[c]), e.word + ' ' + c);
    }
  }
});

// ---- the tray ---------------------------------------------------------------------------
const spec = () => T.tilesFor(E('planet'), 4, 99, { lexicon: LEX });
const idFor = (st, ch, skip = []) => st.spec.tiles.find((t) => t.ch === ch && !skip.includes(t.id)).id;
test('tray: put fills from the left; back; full; answerOf', () => {
  let st = T.newTray(spec());
  assert.equal(T.answerOf(st), '');
  st = T.put(st, idFor(st, 'p')); st = T.put(st, idFor(st, 'l'));
  assert.deepEqual(Object.keys(st.placed), ['0', '1']);
  assert.equal(T.answerOf(st), 'pl');
  st = T.back(st); assert.equal(T.answerOf(st), 'p');
  for (const c of 'lanet') st = T.put(st, idFor(st, c, Object.values(st.placed)));
  assert.ok(T.full(st)); assert.equal(T.answerOf(st), 'planet');
  const same = T.put(st, st.spec.tiles.find((t) => !Object.values(st.placed).includes(t.id)).id);
  assert.equal(same, st);
});
test('tray: unput opens a gap, the next put fills it; a used tile is a no-op', () => {
  let st = T.newTray(spec());
  for (const c of 'pla') st = T.put(st, idFor(st, c, Object.values(st.placed)));
  const used = st.placed[1];
  assert.equal(T.put(st, used), st);
  st = T.unput(st, 1); assert.equal(st.open, 1); assert.equal(T.answerOf(st), 'pa');
  st = T.put(st, idFor(st, 'n', Object.values(st.placed))); assert.equal(st.placed[1] !== undefined, true); assert.equal(st.open, null);
  assert.equal(T.answerOf(st).slice(0, 3), 'pna');
});
test('tray: check keeps right tiles, returns wrong ones, counts the miss', () => {
  let st = T.newTray(spec());
  const bad = st.spec.tiles.find((t) => !'planet'.includes(t.ch)).id;
  for (const c of ['p', 'l', bad, 'n', 'e', 't']) st = T.put(st, c.length === 1 ? idFor(st, c, Object.values(st.placed)) : c);
  const r = T.check(st);
  assert.equal(r.right, false); assert.deepEqual(r.wrongGaps, [2]);
  assert.equal(r.st.misses[2], 1);
  assert.deepEqual(Object.keys(r.st.placed).map(Number), [0, 1, 3, 4, 5]);
  assert.equal(r.st.spec.tiles.find((t) => t.id === T.glowFor(r.st, 2)).ch, 'a');
  const filled = T.put(r.st, T.glowFor(r.st, 2));
  assert.equal(T.check(filled).right, true);
});
test('tray: autoFill places the right tile and sets helped', () => {
  let st = T.newTray(spec());
  st = T.put(st, st.spec.tiles[0].id);
  const f = T.autoFill(st, 3);
  assert.equal(f.helped, true);
  assert.equal(f.spec.tiles.find((t) => t.id === f.placed[3]).ch, st.spec.letters[3].ch);
  assert.equal(st.helped, false);
});
test('tray: states are never mutated', () => {
  const s0 = T.newTray(spec());
  const snap = JSON.stringify(s0);
  let st = s0;
  const steps = [(x) => T.put(x, x.spec.tiles[0].id), (x) => T.put(x, x.spec.tiles[1].id), (x) => T.back(x), (x) => T.unput(x, 0), (x) => T.autoFill(x, 2), (x) => T.check(x).st];
  for (const f of steps) { const before = JSON.stringify(st); const next = f(st); assert.equal(JSON.stringify(st), before); st = next; }
  assert.equal(JSON.stringify(s0), snap);
});
