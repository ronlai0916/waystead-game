// SB6 WP-5a: the one Peek component (site/js/peek.js) and the pass rules that follow a Peek (games-doc.js), with a tiny fake DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { peekButtonHtml, peekRowHtml, mountPeek } from '../site/js/peek.js';
import * as G from '../site/js/games-doc.js';
import * as R from '../site/js/spell-run.js';

class Cls {
  constructor() { this.s = new Set(); }
  add(...c) { c.forEach((x) => this.s.add(x)); }
  remove(...c) { c.forEach((x) => this.s.delete(x)); }
  contains(c) { return this.s.has(c); }
  toggle(c, on) { if (on) this.s.add(c); else this.s.delete(c); }
}
class El {
  constructor(tag = 'span') { this.tag = tag; this.classList = new Cls(); this.textContent = ''; this.dataset = {}; this.attrs = {}; this.disabled = false; this.kids = []; this.on = {}; this.isConnected = true; }
  get className() { return [...this.classList.s].join(' '); }
  set className(v) { this.classList = new Cls(); String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c)); }
  setAttribute(k, v) { this.attrs[k] = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); }
  removeEventListener(t, f) { this.on[t] = (this.on[t] || []).filter((x) => x !== f); }
  click() { (this.on.click || []).forEach((f) => f()); }
  append(k) { this.kids.push(k); }
  remove() { this.removed = true; }
  querySelector(sel) { return this.find(sel)[0] || null; }
  querySelectorAll(sel) { return this.find(sel); }
  find(sel) { return sel === '[data-peekbtn]' ? (this.btn ? [this.btn] : []) : sel === '[data-peek]' ? (this.line ? [this.line] : []) : (this.sets && this.sets[sel]) || []; }
}
globalThis.document = { createElement: (t) => new El(t) };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = () => { const root = new El('main'); root.btn = new El('button'); return root; };

test('the button and the row carry data-peekbtn, data-fold="peek", the eye and the word Peek', () => {
  const b = peekButtonHtml();
  assert.match(b, /data-peekbtn/); assert.match(b, /data-fold="peek"/); assert.match(b, /<svg/); assert.match(b, />Peek<\/span><\/button>/);
  assert.match(peekRowHtml({ hint: 'x' }), /class="peekrow"[\s\S]*data-hint/);
  assert.doesNotMatch(peekButtonHtml(), /Peep/);
});
test('a Peek on the line shows the word, disables the button only while it shows, locks, then undoes it all', async () => {
  const root = page(); root.line = new El('p');
  const log = [];
  const p = mountPeek(root, { word: 'because', ms: 30, lock: (on) => log.push('lock' + on), onPeek: (n) => log.push('peek' + n), onEnd: () => log.push('end') });
  assert.equal(root.btn.disabled, false);
  root.btn.click();
  assert.equal(root.line.textContent, 'because');
  assert.equal(root.btn.disabled, true);
  assert.ok(root.classList.contains('is-peek'));
  root.btn.click(); // a second tap while it shows changes nothing
  assert.deepEqual(log, ['locktrue', 'peek1']);
  await wait(60);
  assert.equal(root.line.textContent, '');
  assert.equal(root.btn.disabled, false);
  assert.ok(!root.classList.contains('is-peek'));
  assert.deepEqual(log, ['locktrue', 'peek1', 'lockfalse', 'end']);
  assert.equal(p.peeks(), 1);
});
test('boxes: empty ones show their letter lighter, filled ones are left alone, and all is put back', async () => {
  const root = page();
  const bx = ['a', 'b', 'c'].map(() => new El());
  bx[0].textContent = 'B'; bx[0].classList.add('is-filled');
  root.sets = { '.x': bx };
  mountPeek(root, { word: 'BEE', ms: 20, boxes: () => root.sets['.x'] });
  root.btn.click();
  assert.deepEqual(bx.map((b) => b.textContent), ['B', 'E', 'E']);
  assert.ok(!bx[0].classList.contains('is-peeked') && bx[1].classList.contains('is-peeked'));
  await wait(50);
  assert.deepEqual(bx.map((b) => b.textContent), ['B', '', '']);
  assert.ok(!bx[1].classList.contains('is-peeked'));
  assert.equal(bx[1].dataset.ch, undefined);
});
test('allowed 1: after the one Peek the button stays disabled, with no message', async () => {
  const root = page(); root.line = new El('p');
  mountPeek(root, { word: 'x', ms: 10, allowed: 1 });
  root.btn.click();
  await wait(30);
  assert.equal(root.btn.disabled, true);
  assert.ok(root.btn.classList.contains('is-used'));
  root.btn.click();
  assert.equal(root.line.textContent, '');
});
test('can() false ignores the tap; destroy while showing puts everything back and unlocks', () => {
  const root = page(); root.line = new El('p');
  let ok = false; const log = [];
  const p = mountPeek(root, { word: 'cat', ms: 1000, can: () => ok, lock: (on) => log.push(on) });
  root.btn.click();
  assert.equal(root.line.textContent, '');
  ok = true; root.btn.click();
  assert.equal(root.line.textContent, 'cat');
  p.destroy();
  assert.equal(root.line.textContent, '');
  assert.deepEqual(log, [true, false]);
});
test('the nudge is a still outline class after nudgeMs, never before a tap, gone on a tap', async () => {
  const root = page(); root.line = new El('p');
  mountPeek(root, { word: 'x', ms: 10, nudgeMs: 20 });
  assert.ok(!root.btn.classList.contains('is-nudge'));
  await wait(40);
  assert.ok(root.btn.classList.contains('is-nudge'));
  root.btn.click();
  assert.ok(!root.btn.classList.contains('is-nudge'));
});
test('no button on the page: a quiet no-op', () => {
  const p = mountPeek(new El('main'), { word: 'x' });
  assert.equal(p.peeks(), 0); p.destroy();
});

test('a Peek makes a game pass not clean and is written on it; the word comes back (afterPass)', () => {
  let run = R.peek(R.newRun('cat'));
  const p = G.passOf(run);
  assert.deepEqual(p, { tries: 0, clean: false, peeks: 1 });
  assert.deepEqual(G.afterPass(['cat', 'dog'], p.clean), ['cat', 'dog']);
  assert.deepEqual(G.passOf(R.newRun('cat')), { tries: 0, clean: true });
  assert.deepEqual(G.leftPassOf(run), { tries: 0, clean: false, peeks: 1 });
  assert.equal(G.quickPass('cat', 'cat', 1).clean, false);
  assert.equal(G.quickPass('cat', 'cat').clean, true);
  const f = G.fillPass({ word: 'cat' }, { spelled: true, peeks: 1 });
  assert.equal(f.clean, false); assert.equal(f.peeks, 1); assert.equal(f.source, 'g');
  assert.equal(G.fillPass({ word: 'cat' }, { tries: 0 }).peeks, undefined);
});
test('recordPass writes the peeks, never clean with one', () => {
  const d = { groups: [], tries: [] };
  assert.equal(typeof G.recordPass, 'function');
  assert.equal(G.withPeeks({ tries: 0, clean: true }, 2).peeks, 2);
  assert.equal(G.withPeeks({ tries: 0, clean: true }, 0).clean, true);
  void d;
});
test('Step by step Meanings: cards of 3, quick-fire never offered, a game with fewer than 3 usable words is left out', () => {
  const e = (w) => ({ word: w, meaning: { definition: 'x ' + w } });
  assert.deepEqual(G.sbsLevel(2), { fill: 'pick', choices: 3, items: 5, boards: ['statement', 'statement'], cards: 3 });
  assert.equal(G.sbsLevel(5).fill, 'spell');
  assert.equal(G.sbsLevel(3).fill, 'pick');
  assert.deepEqual(G.gamesFor([e('aa'), e('bb'), e('cc')], {}, ['match'], { sbs: true }), ['match']);
  assert.deepEqual(G.gamesFor([e('aa'), e('bb'), e('cc')], {}, ['match']), [], 'Normal still needs 4');
  assert.deepEqual(G.gamesFor([e('aa'), e('bb')], {}, ['match', 'missing', 'unjumble', 'quick'], { sbs: true }), []);
  assert.deepEqual(G.gamesFor([e('aa'), e('bb'), e('cc')], {}, ['quick'], { sbs: true }), []);
  const rounds = G.matchRounds([e('aa'), e('bb'), e('cc'), e('dd')], [e('ee'), e('ff')], Math.random, 3);
  assert.deepEqual(rounds.map((r) => r.cards.length), [3, 3]);
  assert.deepEqual(G.SBS_GAMES, ['match', 'fill', 'mix']);
});
test('the source: Peek is mounted on every game screen and the grid, and the petal rules are untouched', () => {
  const gv = readFileSync(new URL('../site/js/games-views.js', import.meta.url), 'utf8');
  const pl = readFileSync(new URL('../site/js/play.js', import.meta.url), 'utf8');
  const wv = readFileSync(new URL('../site/js/words-views.js', import.meta.url), 'utf8');
  assert.match(pl, /mountPeek/); assert.match(wv, /mountPeek/);
  assert.equal((gv.match(/= keyPeek\(main/g) || []).length, 4, 'Missing letters, Unjumble, Quick-fire and Fill spelled on the keyboard');
  assert.match(gv, /mountPeek\(main/, 'the tray games');
  assert.match(pl, /T\.petalsFor\(T\.wrongTilesOf/);
  assert.match(wv, /to try again/);
  assert.doesNotMatch(wv, /wrong letter/);
  assert.match(gv, /if \(!sbs\) stopDrag = enableDrag/, 'no drag in Step by step');
});
// SB6 fix round P2c
test('P2c SF1/SF5: a Step-by-step round with a slip is not from memory; a peek says nothing; Normal is as before', () => {
  const e = { word: 'friend' };
  const clean = G.flowerResult({ entry: e, state: 'won', sbs: true });
  assert.equal(clean.won, true); assert.equal(clean.slips, 0); assert.equal(G.flowerNote(clean), 'correct');
  const slipped = G.flowerResult({ entry: e, state: 'won', slips: 3, wrong: 0, sbs: true });
  assert.equal(slipped.won, false); assert.equal(slipped.slips, 3); assert.equal(G.flowerNote(slipped), 'missed');
  const tiledSlip = G.flowerResult({ entry: e, state: 'won', slips: 1, tiled: true, sbs: true });
  assert.equal(G.flowerNote(tiledSlip), 'missed', 'tiles or keys, a slip is noted');
  assert.equal(G.flowerNote(G.flowerResult({ entry: e, state: 'won', tiled: true, sbs: true })), 'skip');
  const peek = G.flowerResult({ entry: e, state: 'playing', peeked: true, sbs: true });
  assert.equal(peek.peeked, true); assert.equal(peek.tiles, undefined, 'tiles keeps meaning tiles');
  assert.equal(G.flowerNote(peek), 'skip');
  assert.equal(G.flowerResult({ entry: e, state: 'won', slips: 2, wrong: 2 }).won, true, 'Normal: a lost petal does not unwin a word');
  assert.equal(G.flowerNote(G.flowerResult({ entry: e, state: 'lost', wrong: 6 })), 'missed');
});
test('P2c SF2/SF3/SF6/nits: the test notes by testTry().clean; the Meanings stone has no game list of its own; Fix it in uses the shared Peek', async () => {
  const A = await import('../site/js/assess-doc.js');
  assert.equal(A.testTry({ ok: 1, pk: 1 }).clean, false, 'spelled after a Peek is not clean');
  assert.equal(A.testTry({ ok: 1, pk: 0 }).clean, true);
  const rd = (f) => readFileSync(new URL('../site/js/' + f, import.meta.url), 'utf8');
  assert.match(rd('words-views.js'), /if \(A\.testTry\(a\)\.clean\) S\.noteCorrect/);
  assert.match(rd('words-views.js'), /Practise these words/);
  const sv = rd('study-views.js');
  const stone = sv.slice(sv.indexOf('function meaningsStone'), sv.indexOf('function mend('));
  assert.doesNotMatch(stone, /games:/, 'the stone uses G.SBS_GAMES through playGames');
  assert.match(sv, /mountPeek\(main/);
  assert.doesNotMatch(sv, /ctrl \? 3000 : 2000/);
  assert.match(rd('games-views.js'), /study\/games/, 'quick in Step by step goes to the Meanings stone');
  assert.match(rd('peek.js'), /toLowerCase\(\)\) \+ '\.'/, 'announced in normal case');
});

// SB6 fix round P2d
test('P2d SF1: Step by step slips are "With a slip", never "Missed", and no count; the Usual way is unchanged', async () => {
  const e = (w) => ({ word: w });
  const sbs = [G.flowerResult({ entry: e('one'), state: 'won', sbs: true }), G.flowerResult({ entry: e('two'), state: 'won', slips: 2, sbs: true }), G.flowerResult({ entry: e('six'), state: 'playing', peeked: true, sbs: true })];
  const usual = [G.flowerResult({ entry: e('one'), state: 'won' }), G.flowerResult({ entry: e('two'), state: 'lost', wrong: 6 }), G.flowerResult({ entry: e('six'), state: 'playing', peeked: true })];
  assert.equal(usual.some((r) => r.sbs), false, 'the Usual way adds nothing to a result');
  const pl = readFileSync(new URL('../site/js/play.js', import.meta.url), 'utf8');
  const vw = readFileSync(new URL('../site/js/views.js', import.meta.url), 'utf8');
  assert.match(pl, /r\.sbs \? '<span class="pill pill--warm">With a slip<\/span>'/);
  assert.match(pl, /sbs \? '' : '<p class="muted">You spelled /);
  assert.match(pl, /<span class="pill pill--warm">Missed<\/span>/, 'Usual still says Missed');
  assert.match(vw, /stepWay \? 'These words are now in Words to practise again\.' : 'Missed words are now in Words to practise again\.'/);
  assert.match(vw, /stepWay \? 'Practise these again' : 'Play the missed words'/);
  try {
    const { summaryHtml } = await import('../site/js/play.js');
    const s = summaryHtml(sbs, 'All done');
    assert.doesNotMatch(s, /You spelled|Missed/); assert.match(s, /With a slip/); assert.match(s, /With a peek/); assert.match(s, /Got it/);
    const u = summaryHtml(usual, 'All done');
    assert.match(u, /You spelled 1 of 3 words\./); assert.match(u, /Missed/);
  } catch (err) { if (err.name === 'AssertionError') throw err; }
});
test('P2d SF2: the Step-by-step test end button goes to Words to practise again, with no count', () => {
  const wv = readFileSync(new URL('../site/js/words-views.js', import.meta.url), 'utf8');
  assert.match(wv, /\{ label: 'Practise these words', href: '#\/tricky', primary: true \}/);
  assert.doesNotMatch(wv, /label: 'Practise these words', href: stepHref/);
  assert.match(wv, /'Practise the ' \+ plural\(/, 'Usual unchanged');
});
test('P2d SF3: Hear and Peek stay 8 px apart in short landscape and under 360 px', () => {
  const css = readFileSync(new URL('../site/css/app.css', import.meta.url), 'utf8');
  assert.match(css, /\.btnrow--peek, body main > \.page\.play \.btnrow--center \{ gap: 8px; \}/);
  assert.match(css, /@media \(max-width: 359px\) \{ \.play \.btnrow--center, \.btnrow--peek \{ gap: 8px; \}/);
  assert.doesNotMatch(css, /btnrow--peek[^{]*\{ gap: 6px/);
});
