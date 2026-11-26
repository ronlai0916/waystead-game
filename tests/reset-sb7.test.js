// SB7 BUILD-1 (D28-D30): a grown-up's resets of a Step by step week (site/js/reset-doc.js, words-doc.js `resets`). Run: node --test tests/reset-sb7.test.js
// What each reset clears and keeps, that the child's own screens then read the right state, that a merge from another device cannot bring it back,
// and that the child's pages hold no reset control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import * as K from '../site/js/sbs-week-doc.js';
import * as RD from '../site/js/reset-doc.js';
import * as P from '../site/js/grownups-doc.js';
import * as SR from '../site/js/sbs-report-doc.js';
import * as Rows from '../site/js/rows-doc.js';
import { CODE } from '../site/js/ladder-doc.js';
import { sbsCtx } from '../site/js/sbs-views.js';
import { seedOf } from '../site/js/tiles-doc.js';
import { createChildApi, resetWeek, changeWords, readChild } from '../site/js/grownups-data.js';

const read = (f) => readFileSync(fileURLToPath(new URL('../' + f, import.meta.url)), 'utf8');
const START = '2026-11-23'; // a Monday
const TEST = '2026-11-30';
const TODAY = '2026-11-26';
const WORDS = ['night', 'light', 'fight', 'sight'];
const T0 = Date.parse('2026-11-23T10:00:00Z'); // the old tries
const RESET_AT = Date.parse('2026-11-26T09:00:00Z');
const LATER = Date.parse('2026-11-26T09:30:00Z');
let n = 0;
const id = () => { n += 1; return 'k' + String(n).padStart(6, '0'); };
let tick = 0;
const T = (d, o) => W.addTry(d, { id: id(), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, day: '2026-11-24', now: T0 + (tick += 1000), source: 'g', ...o });

/** A Step by step week part-way through: every stone has something, and an earlier week holds the same word 'night'. */
function week({ extra = true } = {}) {
  let d = W.createGroup(W.emptyDoc(), { id: 'g0', name: 'Earlier', test: '2026-11-20', words: ['night', 'house'], today: '2026-11-13', now: 100 }).doc;
  d = W.createGroup(d, { id: 'g1', name: 'This week', test: TEST, words: WORDS, today: START, now: 1000 }).doc;
  d = W.createGroup(d, { id: 'g2', name: 'Other', test: '2026-12-05', words: ['bridge'], today: START, now: 1001 }).doc;
  const day = '2026-11-24';
  // the earlier week: night was On its own on two days
  d = T(d, { group: 'g0', word: 'night', day: '2026-11-14', r: CODE.ALL, j: 'h', ss: 'aaaaaa' });
  d = T(d, { group: 'g0', word: 'night', day: '2026-11-16', r: CODE.ALL, j: 'f', ss: 'bbbbbb' });
  d = T(d, { group: 'g2', word: 'bridge', r: CODE.ALL, j: 'h', ss: 'cccccc' });
  for (const w of WORDS) {
    d = T(d, { word: w, r: CODE.COPY, j: 'h', ss: 'h11111', day });
    d = T(d, { word: w, r: CODE.ALL, j: 'h', ss: 'h11111', day });
    d = T(d, { word: w, r: CODE.ALL, j: 'f', ss: 'f22222', day: '2026-11-25', peeks: 1, clean: false });
    d = T(d, { word: w, r: CODE.ALL, j: 'w', rw: 2, ss: 'w33333', day: '2026-11-25' });
    d = T(d, { word: w, r: CODE.ALL, j: 'k', ss: 'h11111', day });
    d = T(d, { word: w, j: 'q', source: 'm', ss: 'f22222', day: '2026-11-25' });
    d = T(d, { word: w, source: 'm', day: '2026-11-25' }); // a Meanings pick
    d = T(d, { word: w, r: CODE.ALL, j: 'b', lv: 4, ss: 'b44444', day: '2026-11-25' }); // a Sentences tile try
    d = T(d, { word: w, source: 'x', day: '2026-11-24' }); // a Usual Fix it in try
  }
  const g = W.groupById(d, 'g1');
  for (const s of ['hello', 'hello:0', 'hello:1', 'hello:2', 'hello:3', 'fix', 'fix:0', 'fix:1', 'fix:2', 'fix:3', 'games', 'games:match', 'story', 'practice', 'rw:2', 'rw:2:0', 'rw:2:1', 'se:h11111', 'se:f22222', 'se:w33333', 'se:b44444']) d = W.markStep(d, g, s, '2026-11-25', T0 + (tick += 1000));
  const g2 = W.groupById(d, 'g2');
  d = W.markStep(d, g2, 'hello', day, T0 + 5);
  d = W.addNote(d, { id: 'n1', group: 'g1', word: 'night', text: 'The night is long.', day, now: T0 + 30, bl: 3 });
  d = W.addNote(d, { id: 'n2', group: 'g1', word: 'light', text: 'Turn on the light.', day, now: T0 + 31 });
  d = W.addNote(d, { id: 'n3', group: 'g2', word: 'bridge', text: 'A long bridge.', day, now: T0 + 32 });
  d = W.addSkip(d, { id: 's1', group: 'g1', word: 'night', day, flow: 'x', now: T0 + 40 });
  d = W.setAside(d, 'g1', 'light', TODAY, T0 + 50);
  if (extra) d = { ...d, clues: { night: { t: 'a clue', at: T0 + 60 } } };
  return W.normalise(d);
}
const of = (d, gid = 'g1') => d.results.filter((r) => r.g === gid);
const stepsOf = (d, gid = 'g1') => Object.keys(d.steps).filter((k) => k.startsWith(gid + '|')).map((k) => k.slice(gid.length + 1)).sort();
const OPT = { now: RESET_AT, today: TODAY };
const g1 = (d) => W.groupById(d, 'g1');

// ---- what each reset clears and keeps ----------------------------------------------------------------------
test('the starting week really holds every kind of record (so the cases below mean something)', () => {
  const d = week();
  assert.ok(of(d).length >= 36);
  for (const j of ['h', 'f', 'w', 'k', 'q', 'b']) assert.ok(of(d).some((r) => r.j === j), j);
  assert.ok(of(d).some((r) => r.s === 'm' && !r.j) && of(d).some((r) => r.s === 'x'));
  assert.ok(stepsOf(d).includes('rw:2:1') && stepsOf(d).includes('se:w33333'));
  assert.equal(d.notes.length, 3); assert.equal(d.skips.length, 1);
  assert.ok(K.stoneDone(d, g1(d), 'hello', TODAY) && K.stoneDone(d, g1(d), 'practice', TODAY) === true);
});

test('(a) restart words: those words lose every try, mark, sentence, skip and set-aside of this week; the rest is untouched', () => {
  const d = week();
  const r = RD.restartWords(d, 'g1', ['Night', 'sight'], OPT);
  assert.deepEqual(r.words, ['night', 'sight']);
  const x = r.doc;
  // gone: every non-test try of those words in this week, whatever stone (Usual Fix it in too), so their stars and counts are gone
  assert.deepEqual(of(x).filter((t) => ['night', 'sight'].includes(t.w)), []);
  assert.equal(of(x).length, of(d).length - 2 * 9);
  // kept: the other words' tries
  for (const w of ['light', 'fight']) assert.equal(of(x).filter((t) => t.w === w).length, 9, w);
  // marks (D32): the part marks of those words and the stone marks (Meet, Letter ladder, Meanings, Sentences, rows) go; the other words' part marks stay
  assert.deepEqual(stepsOf(x), ['fix:1', 'fix:2', 'hello:1', 'hello:2', 'se:b44444', 'se:f22222', 'se:h11111', 'se:w33333']);
  // sentences and skips and set-aside of the word are gone, the other word's stay
  assert.deepEqual(x.notes.map((q) => q.id).sort(), ['n2', 'n3']);
  assert.equal(x.skips.length, 0);
  assert.equal(W.isSetAside(x, 'g1', 'light', TODAY), true, 'light was not restarted');
  // not reset: the earlier week's night, the other week, clues
  assert.equal(of(x, 'g0').filter((t) => t.w === 'night').length, 2);
  assert.equal(of(x, 'g2').length, 1); assert.deepEqual(stepsOf(x, 'g2'), ['hello']);
  assert.equal(W.clueFor(x, 'night'), 'a clue');
  // the week itself is as it was
  assert.deepEqual(g1(x).words, WORDS); assert.equal(g1(x).test, TEST); assert.equal(g1(x).start, START);
});

test('(a) a restarted word is offered again from Meet, even though an earlier week had it On its own; its report line and stars start again', () => {
  const d = week();
  assert.ok(K.helloWordDone(d, g1(d), 'night', TODAY));
  const x = RD.restartWords(d, 'g1', ['night'], OPT).doc;
  const g = g1(x);
  assert.equal(K.helloWordDone(x, g, 'night', TODAY), false);
  assert.deepEqual(K.wordsLeft(x, g, 'hello', TODAY), ['night']);
  assert.equal(K.stoneDone(x, g, 'hello', TODAY), false);
  assert.equal(K.fixWordDone(x, g, 'night'), false);
  assert.deepEqual(K.wordsLeft(x, g, 'fix', TODAY), ['night']);
  // the session sees it as new, at the start (Meet), with no peeks counted and nothing stuck
  const ctx = sbsCtx({ d: x, g, step: 'hello', day: TODAY, entryOf: (w) => ({ word: w, chunks: [w] }) });
  assert.deepEqual(ctx.words, ['night']);
  const f = ctx.facts('night');
  assert.equal(f.best, 0); assert.equal(f.metOn, ''); assert.equal(f.peeksTotal, 0); assert.equal(f.secure, false);
  assert.equal(SR.status(f), 'not-started');
  assert.equal(SR.wordLine('Robin', 'night', f), 'Night: not started yet.');
  assert.deepEqual(SR.stuckWords(x, g, TODAY), []);
  // the other words are as before
  assert.ok(K.helloWordDone(x, g, 'light', TODAY));
  // stars: the word's own go
  const stars = (q) => St.weekStars(q, g1(q));
  assert.ok(stars(x) < stars(d));
});

test('(b) redo a stone: that stone goes for every word; the other stones, the words, the test and other weeks stay', () => {
  const expect = {
    hello: { j: ['h'], marks: ['hello', 'hello:0', 'hello:1', 'hello:2', 'hello:3'] },
    fix: { j: ['f'], marks: ['fix', 'fix:0', 'fix:1', 'fix:2', 'fix:3'] },
    practice: { j: ['w'], marks: ['practice', 'rw:2', 'rw:2:0', 'rw:2:1'] },
    games: { j: [], marks: ['games', 'games:match'] },
    story: { j: ['b'], marks: ['story'] },
  };
  for (const stone of RD.STONES) {
    const d = week();
    const x = RD.redoStone(d, 'g1', stone, OPT).doc;
    const e = expect[stone];
    const gone = of(d).filter((r) => !of(x).some((q) => q.id === r.id));
    // the tries gone are only this stone's (j, plus the checks and game of its sittings; Meanings: the picks with no j)
    if (stone === 'games') assert.ok(gone.length === 4 && gone.every((r) => r.s === 'm' && !r.j), stone);
    else if (stone === 'story') assert.ok(gone.length === 4 && gone.every((r) => r.j === 'b'), stone);
    else assert.ok(gone.length === { hello: 12, fix: 8, practice: 4 }[stone] && gone.every((r) => r.j === e.j[0] || (['k', 'q'].includes(r.j))), stone + ' ' + gone.length);
    // marks gone: this stone's, and its sittings' end marks
    const before = stepsOf(d);
    const left = stepsOf(x);
    for (const m of e.marks) assert.ok(!left.includes(m), stone + ' ' + m);
    const kept = before.filter((m) => !left.includes(m));
    assert.ok(kept.every((m) => e.marks.includes(m) || m.startsWith('se:')), stone + ' removed only its own marks: ' + kept);
    for (const m of before.filter((q) => !e.marks.includes(q) && !q.startsWith('se:'))) assert.ok(left.includes(m), stone + ' keeps ' + m);
    // not done any more; every other stone is as it was
    assert.equal(K.stoneDone(x, g1(x), stone, TODAY), false, stone);
    for (const other of RD.STONES.filter((s) => s !== stone)) {
      assert.equal(K.stoneDone(x, g1(x), other, TODAY), K.stoneDone(d, g1(d), other, TODAY), stone + ' keeps ' + other);
    }
    assert.equal(x.notes.length, stone === 'story' ? 1 : 3, stone + ' notes'); // the other week's sentence always stays
    assert.equal(of(x, 'g0').length, 2); assert.equal(of(x, 'g2').length, 1);
    assert.deepEqual(g1(x).words, WORDS); assert.equal(g1(x).test, TEST);
    assert.equal(x.skips.length, 1);
  }
});

test('(b) redo Meet: every word is offered from Meet again although the Letter ladder was done (the ladder is kept)', () => {
  const d = week();
  const x = RD.redoStone(d, 'g1', 'hello', OPT).doc;
  const g = g1(x);
  assert.deepEqual(K.wordsLeft(x, g, 'hello', TODAY), WORDS);
  assert.equal(K.stoneDone(x, g, 'fix', TODAY), true, 'the ladder stone is kept');
  const ctx = sbsCtx({ d: x, g, step: 'hello', day: TODAY, entryOf: (w) => ({ word: w, chunks: [w] }) });
  assert.equal(ctx.facts('night').best, 0, 'Meet asks from the start');
  const fix = sbsCtx({ d: x, g, step: 'fix', day: TODAY, entryOf: (w) => ({ word: w, chunks: [w] }) });
  assert.ok(fix.facts('night').best >= CODE.ALL, 'the ladder keeps what it knows');
});

test('(c) restart the whole week: everything of the week goes, back to day 1; words, test date, other weeks and clues stay', () => {
  const d = week();
  const x = RD.restartWeek(d, 'g1', OPT).doc;
  assert.deepEqual(of(x), []);
  assert.deepEqual(stepsOf(x), []);
  assert.equal(x.notes.filter((q) => q.g === 'g1').length, 0);
  assert.equal(x.skips.length, 0);
  assert.equal(W.isSetAside(x, 'g1', 'light', TODAY), false);
  assert.deepEqual(g1(x).words, WORDS); assert.equal(g1(x).test, TEST);
  assert.equal(g1(x).start, TODAY, 'day 1 is today, as a week set now would be');
  assert.ok(g1(x).at > g1(d).at, 'the group wins a merge');
  assert.equal(of(x, 'g0').length, 2); assert.equal(of(x, 'g2').length, 1); assert.equal(x.notes.filter((q) => q.g === 'g2').length, 1);
  assert.equal(W.clueFor(x, 'night'), 'a clue');
  assert.equal(St.weekStars(x, g1(x)), 0);
  assert.equal(W.stepDay(x, g1(x), 'hello'), '');
});

test('(c) a week whose test date has come keeps its start; a start that is not before today stays', () => {
  const d = week();
  const late = RD.restartWeek(d, 'g1', { now: Date.parse('2026-11-30T09:00:00Z'), today: '2026-11-30' }).doc;
  assert.equal(g1(late).start, START);
  const fresh = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'x', test: TEST, words: WORDS, today: TODAY, now: 1000 }).doc;
  assert.equal(g1(RD.restartWeek(fresh, 'g1', OPT).doc).start, TODAY);
});

test('a reset never touches the test: a week whose test has begun cannot be reset, and the reset says so', () => {
  let d = week();
  d = W.addTry(d, { id: id(), word: 'night', day: TEST, group: 'g1', kind: 't', tries: 0, peeks: 0, clean: true, source: 'g', now: T0 + 999000 });
  assert.equal(RD.blockedReason(d, g1(d)), RD.BLOCKED_TEST);
  for (const r of [RD.restartWords(d, 'g1', ['night'], OPT), RD.redoStone(d, 'g1', 'hello', OPT), RD.restartWeek(d, 'g1', OPT)]) assert.equal(r.error, RD.BLOCKED_TEST);
  assert.equal(RD.restartWords(week(), 'g1', ['nope'], OPT).error, 'Pick at least one word.');
  assert.equal(RD.redoStone(week(), 'g1', 'test', OPT).error, 'Pick a stone.');
  assert.equal(RD.restartWords(week(), 'gone', ['night'], OPT).error, 'That week has gone.');
});

test('the words of a week that holds words from earlier weeks (back) restart too, by their place in the list', () => {
  let d = week();
  d = { ...d, groups: { ...d.groups, g1: { ...d.groups.g1, back: ['house'] } } };
  d = T(d, { word: 'house', r: CODE.ALL, j: 'h', ss: 'h11111' });
  d = W.markStep(d, g1(d), 'hello:4', '2026-11-25', T0 + 777);
  const x = RD.restartWords(d, 'g1', ['house'], OPT).doc;
  assert.equal(of(x).filter((r) => r.w === 'house').length, 0);
  assert.ok(!stepsOf(x).includes('hello:4'));
  assert.ok(stepsOf(x).includes('hello:3') && !stepsOf(x).includes('hello'), 'the other words\' part marks stay; the stone is no longer done');
});

test('a reset does not open the test early: before the date it stays closed, on the date it is not due until the study is done again', () => {
  // a week with every study job done, on its test date
  let d = week();
  const g = g1(d);
  for (const s of ['hello', 'fix', 'games', 'story', 'practice']) d = W.markStep(d, g, s, '2026-11-26', T0 + 1);
  assert.equal(W.jobFor(d, g1(d), TEST), 'test');
  for (const r of [RD.restartWords(d, 'g1', ['night'], OPT), RD.redoStone(d, 'g1', 'practice', OPT), RD.redoStone(d, 'g1', 'games', OPT), RD.restartWeek(d, 'g1', OPT)]) {
    const x = r.doc;
    assert.equal(W.jobFor(x, g1(x), TEST), 'practise', 'not due: the child has study left');
    assert.equal(W.jobFor(x, g1(x), TODAY), 'practise');
    assert.equal(K.canOpen(x, g1(x), 'test', TEST, {}), false);
  }
  // a stone that is not part of the study (Mend) is not offered to reset
  assert.ok(!RD.STONES.includes('mend') && !RD.STONES.includes('test'));
});

test('the child\'s Today and path after a reset: the first stone left is the job now, a redone stone is open, a restarted week starts at Meet', () => {
  const d = week();
  const after = (r) => { const x = r.doc; return K.weekState(x, g1(x), TODAY); };
  assert.equal(after(RD.restartWeek(d, 'g1', OPT)).job, 'hello');
  assert.equal(after(RD.restartWords(d, 'g1', ['sight'], OPT)).job, 'hello');
  const redo = after(RD.redoStone(d, 'g1', 'story', OPT));
  assert.equal(redo.job, 'story');
  assert.ok(redo.steps.find((s) => s.id === 'story').state !== 'done');
  assert.equal(redo.steps.find((s) => s.id === 'hello').state, 'done');
  // the redone stone's page opens for the child
  const x = RD.redoStone(d, 'g1', 'story', OPT).doc;
  assert.equal(K.canOpen(x, g1(x), 'story', TODAY, {}), true);
  // the rows come again after a rows redo, for the words that reached the whole word
  const y = RD.redoStone(d, 'g1', 'practice', OPT).doc;
  const facts = new Map(WORDS.map((w) => [w, K.factsOf(y, g1(y), w, TODAY)]));
  assert.deepEqual(Rows.rowWords(y, g1(y), facts), WORDS);
  assert.equal(Rows.roundDone(y, g1(y), 2), false);
  assert.ok(Rows.nextRow(y, g1(y), TODAY, facts));
  // the estimate counts the work again
  const e0 = K.estimateFor(d, g1(d), TODAY, { way: { m: 'sbs', at: 1 } }, { year: 5 });
  const e1 = K.estimateFor(RD.restartWeek(d, 'g1', OPT).doc, g1(RD.restartWeek(d, 'g1', OPT).doc), TODAY, { way: { m: 'sbs', at: 1 } }, { year: 5 });
  assert.ok(e1.sittings > e0.sittings);
});

// ---- the merge: another device cannot bring a reset back ---------------------------------------------------------
const J = (x) => JSON.stringify(x);
test('merge, two devices: the child\'s stale copy and the server copy after a grown-up\'s reset give the reset, either way round', () => {
  const stale = week(); // the child's iPad: every old try, mark and sentence
  for (const run of [
    (d) => RD.restartWords(d, 'g1', ['night', 'sight'], OPT),
    (d) => RD.redoStone(d, 'g1', 'practice', OPT),
    (d) => RD.redoStone(d, 'g1', 'hello', OPT),
    (d) => RD.redoStone(d, 'g1', 'story', OPT),
    (d) => RD.restartWeek(d, 'g1', OPT),
  ]) {
    const server = run(stale).doc;
    const a = W.merge(stale, server);
    const b = W.merge(server, stale);
    assert.equal(J(a), J(b), 'the order of the two copies makes no difference');
    assert.equal(J(W.merge(a, stale)), J(a), 'merging the stale copy again changes nothing');
    assert.equal(J(W.merge(a, server)), J(a));
    assert.equal(J(W.normalise(a).results), J(server.results), 'no old try came back');
    assert.equal(J(W.normalise(a).steps), J(server.steps), 'no old mark came back');
    assert.equal(J(a.notes), J(server.notes));
    assert.equal(J(a.skips), J(server.skips));
    assert.equal(J(a.groups), J(server.groups));
    assert.equal(J(a.resets), J(server.resets), 'the stamp stays so the next stale device is caught too');
  }
});

test('merge: what the child did after the reset is kept; what the child did offline BEFORE it (and the server never saw) goes with the reset', () => {
  const stale = week();
  const server = RD.restartWords(stale, 'g1', ['night'], OPT).doc;
  // the child's iPad, still on the old copy, kept going: a try at 08:00 (before the reset), another at 09:30 (after it)
  let ipad = T(stale, { word: 'night', r: CODE.COPY, j: 'h', ss: 'h99999', now: RESET_AT - 3600000, day: '2026-11-26' });
  ipad = T(ipad, { word: 'night', r: CODE.COPY, j: 'h', ss: 'h99999', now: LATER, day: '2026-11-26' });
  ipad = T(ipad, { word: 'light', r: CODE.ALL, j: 'f', ss: 'f99999', now: RESET_AT - 1000, day: '2026-11-26' }); // another word: not reset, kept
  const m = W.merge(ipad, server);
  assert.equal(J(m), J(W.merge(server, ipad)));
  const night = of(m).filter((r) => r.w === 'night');
  assert.equal(night.length, 1);
  assert.equal(night[0].at, LATER, 'only the try made after the reset');
  assert.ok(of(m).some((r) => r.w === 'light' && r.ss === 'f99999'));
  // and the word is at the start again (Meet), not done
  assert.equal(K.helloWordDone(m, g1(m), 'night', TODAY), false);
});

test('merge: a restart of the week then more work then a second copy from before: the new work stays, the old does not', () => {
  const stale = week();
  let server = RD.restartWeek(stale, 'g1', OPT).doc;
  server = W.addTry(server, { id: id(), word: 'night', day: TODAY, group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, source: 'g', now: LATER, r: CODE.COPY, j: 'h', ss: 'h88888' });
  server = W.markStep(server, g1(server), 'hello:0', TODAY, LATER + 1);
  const m = W.merge(stale, server);
  assert.deepEqual(of(m).map((r) => r.ss), ['h88888']);
  assert.deepEqual(stepsOf(m), ['hello:0']);
  assert.equal(J(m), J(W.merge(server, stale)));
});

test('merge: a try folded by trimming before the reset does not come back from a stale copy (folded days), nor does one folded across it', () => {
  let stale = week();
  // fold night's tries of this week into days, as trim does over 48 KB
  const folded = { ...stale.folded, 'g1|night': { n: 9, t: 1, p: 1, through: T0 + 60000, days: { '2026-11-24': 2 | 1024 | 32768 | 16384, '2026-11-25': 2 | 1024 | 32768 } } };
  stale = { ...stale, results: stale.results.filter((r) => !(r.g === 'g1' && r.w === 'night')), folded };
  const server = RD.restartWords(stale, 'g1', ['night'], OPT).doc;
  assert.equal(server.folded['g1|night'], undefined, 'the reset took the fold');
  const m = W.merge(stale, server);
  assert.equal(m.folded['g1|night'], undefined, 'and a stale copy cannot bring it back');
  // a fold made on another device across the reset: its days before the reset day go, later days stay
  const across = { ...stale, folded: { 'g1|night': { n: 3, t: 0, p: 0, through: LATER, days: { '2026-11-24': 2, '2026-11-26': 2 | 1024 } } } };
  const m2 = W.merge(across, server);
  assert.deepEqual(Object.keys(m2.folded['g1|night'].days), ['2026-11-26']);
});

test('merge through the account\'s two paths: pull (child merges its copy with the server\'s) and a 409 (the child\'s push meets a newer server copy)', () => {
  const stale = week();
  const server = RD.restartWeek(stale, 'g1', OPT).doc;
  const pull = W.merge(stale, server); // sync.pull: merge(local, remote)
  const conflict = W.merge(pull, server); // sync 409: merge(local, remote.value)
  assert.equal(J(pull), J(conflict));
  assert.equal(of(pull).length, 0);
});

test('resets keep: the key is small, normalise keeps it, trim drops a spent stamp and Clear my progress drops them all', () => {
  const d = week();
  const x = RD.restartWords(d, 'g1', ['night'], OPT).doc;
  assert.ok(Object.keys(x.resets).length === 1);
  const stamp = Object.values(x.resets)[0];
  assert.deepEqual(Object.keys(stamp).sort(), ['at', 'day', 'g', 'i', 'r', 't', 'w']);
  assert.equal(J(W.normalise(JSON.parse(J(x))).resets), J(x.resets));
  assert.equal(J(W.trim(x, RESET_AT + 86400000).resets), J(x.resets));
  assert.equal(W.trim(x, RESET_AT + 46 * 86400000).resets, undefined, 'spent after 45 days');
  assert.equal(W.reset(5, x).resets, undefined);
  // FIX-3: no stamp is dropped because a newer one covers it; repeated redos pile up to the cap, then the next is refused
  let y = d;
  let refusedRedo = 0;
  for (let i = 0; i < 40; i += 1) {
    const r = RD.redoStone(y, 'g1', RD.STONES[i % 5], { now: RESET_AT + i * 1000, today: TODAY });
    if (r.error) { refusedRedo += 1; assert.equal(r.error, RD.FULL); } else y = r.doc;
  }
  assert.equal(Object.keys(y.resets).length, W.RESET_KEEP);
  assert.equal(refusedRedo, 40 - W.RESET_KEEP);
  assert.ok(new TextEncoder().encode(J(y.resets)).length < 4096);
  // a bad stamp is ignored
  assert.equal(W.normalise({ ...d, resets: { bad: { at: 'x' }, ok: stamp } }).resets.bad, undefined);
});

test('the grown-up\'s write goes through the account with the same 409 retry, and a stale copy on the server is reset on the newer one', async () => {
  const base = week();
  let version = 3;
  let stored = JSON.parse(J(base));
  let conflicts = 1;
  const calls = [];
  const api = {
    game: async () => ({ ok: true, status: 200, data: { items: { words: { value: stored, version } } } }),
    put: async (cid, key, value, v) => {
      calls.push([cid, key, v]);
      if (conflicts-- > 0) { // the child's device saved first: one more try on its newer copy
        version += 1; stored = JSON.parse(J(W.addTry(W.normalise(stored), { id: 'late1', word: 'light', day: TODAY, group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, source: 'g', now: RESET_AT - 10, r: CODE.COPY, j: 'f', ss: 'f77777' })));
        return { ok: false, status: 409, data: { error: 'version' } };
      }
      stored = value; version += 1;
      return { ok: true, status: 200, data: { version } };
    },
  };
  const r = await resetWeek(api, 'kid1', (doc, o) => RD.redoStone(doc, 'g1', 'practice', o), { now: () => RESET_AT, today: TODAY });
  assert.equal(r.ok, true); assert.equal(r.updated, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][2], 4, 'the second write carries the newer version');
  const saved = W.normalise(stored);
  assert.ok(of(saved).some((q) => q.id === 'late1'), 'what the child did in between is kept');
  assert.ok(!of(saved).some((q) => q.j === 'w'));
  assert.ok(createChildApi && changeWords);
});

// ---- the grown-up page, and the child's pages ----------------------------------------------------------------------
test('the words a grown-up reads: each confirm says what is removed and that it can\'t be undone; the buttons are Restart / Keep it', () => {
  const w1 = RD.confirmFor('words', ['island']);
  assert.equal(w1.title, 'Restart ‘island’?');
  assert.match(w1.body, /^It starts again from Meet the word\. Meanings and Sentences open again for the week\. Its progress and stars this week are removed\. This can’t be undone\.$/);
  assert.deepEqual([w1.confirm, w1.keep], ['Restart', 'Keep it']);
  assert.equal(RD.confirmFor('words', ['a', 'b', 'c']).title, 'Restart 3 words?');
  assert.match(RD.confirmFor('words', ['a', 'b']).body, /^They start again from Meet the word\. Meanings and Sentences open again for the week\. Their progress and stars this week are removed\./);
  const s = RD.confirmFor('stone', 'hello');
  assert.equal(s.title, 'Redo ‘Meet the words’?');
  assert.match(s.body, /removed\. The other stones are kept\. This can’t be undone\./);
  const wk = RD.confirmFor('week');
  assert.match(wk.body, /^Everything this week is removed: all progress, stars and sentences\. It goes back to day 1\. The words and the test date stay\. This can’t be undone\.$/);
  assert.doesNotMatch(RD.RESET_HELP, /other words are not touched/i, 'a stone or week reset changes every word');
  assert.match(RD.RESET_HELP, /Other weeks are not touched/);
  assert.equal(RD.doneLine('words', ['island']), '‘island’ is back at the start.');
  assert.equal(RD.doneLine('words', ['a', 'b']), '2 words are back at the start.');
  assert.equal(RD.doneLine('stone', 'fix'), 'Letter ladder starts again.');
  assert.equal(RD.doneLine('week'), 'The week starts again at day 1.');
  assert.deepEqual(RD.STONES.map(RD.stoneTitle), ['Meet the words', 'Letter ladder', 'Meanings', 'Sentences', 'Words in a row']);
});

test('the grown-up\'s child page: the card is built for a Step by step child, lists the week\'s words, is hidden by a started test and for a Usual-way child', async () => {
  const { resetCardHtml } = await import('../site/js/grownups-views.js');
  const d = week();
  const html = resetCardHtml(g1(d), 'Robin', '');
  assert.match(html, /data-resets/);
  assert.equal((html.match(/data-reset-word /g) || []).length, WORDS.length);
  for (const stone of RD.STONES) assert.match(html, new RegExp('<option value="' + stone + '">' + RD.stoneTitle(stone)));
  for (const a of ['data-reset-words-go', 'data-reset-stone-go', 'data-reset-week-go']) assert.match(html, new RegExp(a));
  assert.doesNotMatch(html, /style=/);
  const blocked = resetCardHtml(g1(d), 'Robin', RD.BLOCKED_TEST);
  assert.match(blocked, /data-resetwhy/); assert.doesNotMatch(blocked, /data-reset-week-go/);
  const src = read('site/js/grownups-views.js');
  assert.match(src, /sbsM && Su\.wayOf\(setupNow\) === 'sbs' \? resetCardHtml/, 'only a Step by step child gets the card');
  assert.match(src, /A\.resetWeek\(childApi\(\)/);
  assert.match(src, /confirmDialog\(\{ \.\.\.ask, opener: btn \}\)/, 'every reset asks first');
});

test('the child has no reset control: no child screen imports the reset rules or draws a reset button, and the grown-up\'s page is adult-only', () => {
  const childFiles = ['child-views.js', 'child-doc.js', 'sbs-views.js', 'study-views.js', 'words-views.js', 'games-views.js', 'play.js', 'room.js', 'assess-views.js', 'builder-views.js', 'tray.js', 'peek.js', 'front-views.js', 'results-views.js', 'views.js', 'tile-keys.js'];
  for (const f of childFiles) {
    const s = read('site/js/' + f);
    assert.doesNotMatch(s, /reset-doc/, f);
    assert.doesNotMatch(s, /data-reset-|restartWords|redoStone|restartWeek|resetWeek|Restart words|Redo a stone/, f);
  }
  const gv = read('site/js/grownups-views.js');
  assert.match(gv, /export function childDashboard\(main, \{ cid, gid \}\) \{\n  if \(!adultOnly\(main\)/);
  // and the child's own words value cannot be reset by the child's device: only grownups-data writes a reset
  const writers = ['restartWords', 'redoStone', 'restartWeek', 'addReset'];
  for (const f of ['store.js', 'progress-doc.js', 'set-data.js', 'words-views.js', 'sbs-views.js']) for (const w of writers) assert.doesNotMatch(read('site/js/' + f), new RegExp('\\b' + w + '\\b'), f + ' ' + w);
});

test('the words of the card and the dialogs: no banned word, no claim, nothing a child reads', () => {
  const copy = Object.values(RD).filter((v) => typeof v === 'string').join(' ') + [RD.wordsHelp('Robin'), RD.confirmFor('words', ['a']).body, RD.confirmFor('stone', 'fix').body, RD.confirmFor('week').body, RD.doneLine('week')].join(' ');
  assert.doesNotMatch(copy, /\b(wrong|fail\w*|incorrect|mistakes?|late|lost|errors?|therapy|treatment|improves?|calms?|helps? focus|ASD|ADHD|autis\w*|dyslexi\w*)\b/i);
  assert.ok(P && SR);
});

// ======================= FIX-1 (after CHECK-1) =======================================================================
const facts = (d, w) => K.factsOf(d, g1(d), w, TODAY);
/** The week with a CLEAN whole-word go in the Letter ladder for every word (the case the first fixture missed: its Fix tries were peeked). */
function cleanWeek() {
  let d = week();
  for (const w of WORDS) d = T(d, { word: w, r: CODE.ALL, j: 'f', ss: 'f88888', day: '2026-11-25', peeks: 0, clean: true, c: 1 });
  return d;
}
const pending = (d, step) => K.pendingMarks(d, g1(d), step, TODAY);

test('FIX-1 M1: with clean whole-word Fix tries in the ladder, redo Meet really reopens Meet (nothing writes the hello marks again) and a new Meet go finishes it', () => {
  const d = cleanWeek();
  assert.ok(of(d).some((r) => r.j === 'f' && r.r === CODE.ALL && r.c === 1 && !r.t && !r.p), 'the fixture has a clean Fix try');
  const x = RD.redoStone(d, 'g1', 'hello', OPT).doc;
  const g = g1(x);
  assert.equal(K.stoneDone(x, g, 'hello', TODAY), false);
  assert.deepEqual(K.wordsLeft(x, g, 'hello', TODAY), WORDS);
  for (const w of WORDS) assert.equal(K.helloWordDone(x, g, w, TODAY), false, w);
  assert.deepEqual(pending(x, 'hello'), [], 'no hello mark is written again by itself');
  assert.equal(of(x).filter((r) => r.j === 'f').length, of(d).filter((r) => r.j === 'f').length, 'Fix is kept (D29: other stones kept)');
  assert.equal(K.stoneDone(x, g, 'fix', TODAY), K.stoneDone(d, g1(d), 'fix', TODAY));
  // the child does Meet again after the reset: a clean whole-word go counts
  let y = x;
  for (const w of WORDS) y = T(y, { word: w, r: CODE.ALL, j: 'h', ss: 'h99999', day: TODAY, now: LATER + (tick += 1000), peeks: 0, clean: true, c: 1 });
  assert.equal(K.stoneDone(y, g1(y), 'hello', TODAY), true);
  assert.deepEqual(K.wordsLeft(y, g1(y), 'hello', TODAY), []);
});

test('FIX-1 M1: every stone redo reopens exactly that stone (clean tries of every stone in the fixture), a words restart reopens its words, and the other stones stay as they were', () => {
  const d = cleanWeek();
  const state = (q) => Object.fromEntries(['hello', 'fix', 'games', 'story'].map((s) => [s, K.stoneDone(q, g1(q), s, TODAY)]));
  const before = state(d);
  assert.deepEqual(before, { hello: true, fix: true, games: true, story: true });
  for (const s of RD.STONES) {
    const x = RD.redoStone(d, 'g1', s, OPT).doc;
    const after = state(x);
    if (s !== 'practice') assert.equal(after[s], false, s + ' is reopened');
    for (const o of Object.keys(after)) if (o !== s) assert.equal(after[o], before[o], o + ' is kept when ' + s + ' is redone');
    assert.equal(W.stepDay(x, g1(x), s), '', s + ' mark gone');
    if (s === 'hello') assert.deepEqual(pending(x, 'hello'), []);
    if (s === 'fix') assert.deepEqual(K.wordsLeft(x, g1(x), 'fix', TODAY), WORDS);
  }
  const w = RD.restartWords(d, 'g1', ['night'], OPT).doc;
  assert.deepEqual(K.wordsLeft(w, g1(w), 'hello', TODAY), ['night']);
  assert.deepEqual(K.wordsLeft(w, g1(w), 'fix', TODAY), ['night']);
  assert.deepEqual(pending(w, 'hello'), []);
});

test('FIX-1 S1: two restarts in a row, with a record newer than the grown-up\'s clock, get two stamps and a stale copy loses both', () => {
  const d0 = week();
  const ahead = T(d0, { word: 'light', r: CODE.ALL, j: 'f', ss: 'f66666', day: TODAY, now: RESET_AT + 5 * 60000 }); // a child clock 5 minutes fast
  const a = RD.restartWords(ahead, 'g1', ['light'], OPT).doc;
  const b = RD.restartWords(a, 'g1', ['night'], OPT).doc;
  const ids = Object.keys(b.resets);
  assert.equal(ids.length, 2, 'the second stamp does not overwrite the first');
  assert.equal(new Set(ids).size, 2);
  assert.ok(ids.every((i) => /^[A-Za-z0-9_-]{1,40}$/.test(i)));
  // the same reset twice in the same millisecond: a new id (at one millisecond later), never the first one overwritten
  const c = RD.restartWords(b, 'g1', ['night'], OPT).doc;
  assert.ok(Object.keys(c.resets).length >= 2);
  const nights = Object.values(c.resets).filter((x) => x.w[0] === 'night');
  assert.ok(nights.length >= 1 && nights.every((x) => x.at >= RESET_AT));
  const e1 = W.addReset(week(), 'same', { at: 5, day: TODAY, g: 'g1', t: 'week' });
  const again = RD.restartWeek(e1, 'g1', { now: 5, today: TODAY }).doc;
  assert.equal(Object.keys(again.resets).length >= 1, true);
  const m = W.merge(ahead, b);
  for (const w of ['light', 'night']) assert.deepEqual(of(m).filter((t) => t.w === w), [], w);
  assert.equal(of(m).filter((t) => t.w === 'fight').length, 9);
});

test('FIX-1 S2: a stamp is never dated more than 10 minutes ahead; a record from a wild clock stays, and is spent like any stamp', () => {
  const future = Date.parse('2030-01-01T00:00:00Z');
  const d = T(week(), { word: 'light', r: CODE.ALL, j: 'f', ss: 'f55555', day: TODAY, now: future, id: 'zfuture' });
  const x = RD.redoStone(d, 'g1', 'fix', OPT).doc;
  const st = Object.values(x.resets)[0];
  assert.equal(st.at, RESET_AT + RD.SKEW_MS, 'clamped to now + 10 minutes');
  assert.ok(of(x).some((r) => r.id === 'zfuture'), 'the record dated 2030 is newer than the stamp, so it stays (the accepted limit)');
  assert.equal(of(x).filter((r) => r.j === 'f' && r.at < RESET_AT).length, 0);
  // the stamp is spent about 46 days after, so it can never swallow the real tries between now and 2030
  assert.equal(W.trim(x, RESET_AT + 47 * 86400000).resets, undefined);
  // a real try made after the reset is kept by a later merge with a stale copy
  const real = T(x, { word: 'night', r: CODE.ALL, j: 'f', ss: 'f44444', day: TODAY, now: RESET_AT + 3600000, id: 'zreal' });
  const m = W.merge(d, real);
  assert.ok(of(m).some((r) => r.id === 'zreal'));
  assert.equal(of(m).filter((r) => r.j === 'f' && r.at < RESET_AT).length, 0);
  // a words or week stamp is clamped the same way
  assert.equal(Object.values(RD.restartWeek(d, 'g1', OPT).doc.resets)[0].at, RESET_AT + RD.SKEW_MS);
  assert.equal(Object.values(RD.restartWords(d, 'g1', ['night'], OPT).doc.resets)[0].at, RESET_AT + RD.SKEW_MS);
  // a clock only a little ahead still clears the copy whole (the stamp reaches that record)
  const fast = T(week(), { word: 'light', r: CODE.ALL, j: 'f', ss: 'f33333', day: TODAY, now: RESET_AT + 120000, id: 'zfast' });
  assert.ok(!of(RD.redoStone(fast, 'g1', 'fix', OPT).doc).some((r) => r.id === 'zfast'));
});

test('FIX-1 S3: whoever reads a copy sees the stamps applied: normalise, and the grown-up page\'s readChild, of a server copy an older device topped up', async () => {
  const d = week();
  const reset = RD.restartWords(d, 'g1', ['night'], OPT).doc;
  const stale = JSON.parse(J({ ...reset, results: [...reset.results, ...of(d).filter((r) => r.w === 'night')], steps: { ...reset.steps, ...Object.fromEntries(Object.entries(d.steps).filter(([k]) => k === 'g1|hello:0')) } }));
  assert.ok(stale.results.some((r) => r.w === 'night' && r.g === 'g1'), 'the server copy has the old tries back');
  const n = W.normalise(stale);
  assert.deepEqual(of(n).filter((t) => t.w === 'night'), []);
  assert.equal(n.steps['g1|hello:0'], undefined);
  const api = { game: async () => ({ ok: true, status: 200, data: { items: { words: { value: stale, version: 7 } } } }) };
  const r = await readChild(api, 'kid1');
  assert.deepEqual(of(r.words).filter((t) => t.w === 'night'), []);
  assert.equal(r.version, 7);
  const g = W.groupById(r.words, 'g1');
  assert.deepEqual(K.wordsLeft(r.words, g, 'hello', TODAY), ['night']);
  assert.equal(J(W.normalise(n)), J(n), 'applying twice changes nothing');
});

function bigStamp(i, at) {
  const words = Array.from({ length: 10 }, (_, k) => 'longlongword' + i + 'x' + k + 'z'.repeat(20));
  return { at, day: TODAY, g: 'gg' + i, t: 'words', w: words, i: [0, 1, 2, 3], r: ['2:0', '3:1'] };
}
test('FIX-1 S4: the stamps stay under the byte limit; a reset that would not fit is refused, nothing silently dropped, and a newer stamp never replaces an older one', () => {
  const bytes = (x) => new TextEncoder().encode(J(x)).length;
  let d = week();
  let refused = 0;
  const added = [];
  for (let i = 0; i < 12; i += 1) {
    const next = W.addReset(d, 'b' + i, bigStamp(i, RESET_AT + i));
    if (!next) { refused += 1; continue; }
    d = next; added.push('b' + i);
    assert.ok(bytes(d.resets) <= W.RESET_BYTES, 'under the limit after every add');
  }
  assert.ok(refused > 0, 'the limit was reached');
  assert.ok(W.RESET_BYTES < W.MAX_EXTRA);
  assert.deepEqual(Object.keys(d.resets).sort(), added.sort(), 'nothing already kept was dropped to make room');
  // fill what is left with small stamps, then the real reset says so and changes nothing
  for (let i = 0; i < 40; i += 1) d = W.addReset(d, 'f' + i, { at: RESET_AT + 100 + i, day: TODAY, g: 'fill' + i, t: 'week' }) || d;
  const r = RD.restartWords(d, 'g1', ['night'], OPT);
  assert.equal(r.error, RD.FULL);
  assert.ok(!r.doc);
  // FIX-3: a whole-week reset does not replace the older stamps (a 25b device keeps the bigger map, so the newer map must be a superset)
  let e = week();
  for (let i = 0; i < 4; i += 1) e = RD.restartWords(e, 'g1', [WORDS[i]], { now: RESET_AT + i * 1000, today: TODAY }).doc;
  assert.equal(Object.keys(e.resets).length, 4);
  e = RD.restartWeek(e, 'g1', { now: RESET_AT + 9000, today: TODAY }).doc;
  assert.equal(Object.keys(e.resets).length, 5, 'the week stamp is added; the four words stamps stay');
  assert.ok(Object.values(e.resets).some((x) => x.t === 'week'));
  // an overfull copy (two devices' stamps joined) keeps the newest that fit, under the limit
  const all = {};
  for (let i = 0; i < 12; i += 1) all['c' + i] = bigStamp(i, RESET_AT + i);
  const n = W.normalise({ ...week(), resets: all });
  assert.ok(bytes(n.resets) <= W.RESET_BYTES);
  assert.ok(n.resets.c11 && !n.resets.c0, 'the oldest go first');
  assert.equal(J(W.fitResets(all).kept), J(n.resets));
});

test('FIX-1 S4 / FIX-3 S1: a covered stamp is kept; a stale copy cannot bring records back; a newer other-word stamp drops nothing', () => {
  const d = week();
  const mk = (w, i) => ({ day: TODAY, g: 'g1', t: 'words', w, i, r: [] });
  const a0 = W.addReset(d, 'xa', { at: RESET_AT, ...mk(['night'], [0]) });
  const b = W.addReset(a0, 'xb', { at: RESET_AT + 1000, ...mk(['night', 'light'], [0, 1]) });
  assert.deepEqual(Object.keys(b.resets).sort(), ['xa', 'xb'], 'night alone is covered by the newer night+light stamp, and is kept');
  const m = W.merge(d, b); // the stale copy is the original, with night's old tries
  assert.deepEqual(of(m).filter((t) => t.w === 'night' || t.w === 'light'), []);
  const c = RD.restartWords(b, 'g1', ['fight'], { now: RESET_AT + 2000, today: TODAY }).doc;
  assert.equal(Object.keys(c.resets).length, 3, 'nothing is dropped by the newer stamp');
  const stone = RD.redoStone(b, 'g1', 'fix', { now: RESET_AT + 3000, today: TODAY }).doc;
  assert.equal(Object.keys(stone.resets).length, 3, 'a stone redo drops nothing');
});

test('FIX-1 S5: restart words clears only the row marks of the rows that held the word; other rows stay; a row shared by two words is cleared for both', () => {
  const d = week();
  const g = g1(d);
  const f = (w) => K.factsOf(d, g, w, TODAY);
  const keysOf = (ws) => Rows.rowKeysOf(d, g, f, ws);
  const night = keysOf(['night']);
  assert.ok(night.length >= 1 && night.every((k) => /^\d+:\d+$/.test(k)));
  const rowMarks = (q) => stepsOf(q).filter((k) => /^rw:\d+:\d+$/.test(k)).sort();
  assert.deepEqual(rowMarks(d), ['rw:2:0', 'rw:2:1']);
  // size 2 pairs four words: night shares a pair with one partner
  const pairOf = (w) => keysOf([w]).find((k) => k.startsWith('2:'));
  const partner = WORDS.find((w) => w !== 'night' && pairOf(w) === pairOf('night'));
  assert.ok(partner, 'night has a partner in its pair');
  const other = WORDS.find((w) => pairOf(w) !== pairOf('night'));
  const x = RD.restartWords(d, 'g1', ['night'], OPT).doc;
  assert.ok(!rowMarks(x).includes('rw:' + pairOf('night')), 'the row night is in is not done');
  assert.ok(rowMarks(x).includes('rw:' + pairOf(other)), 'the other pair stays done');
  assert.equal(W.stepDay(x, g1(x), 'rw:2'), '', 'the round and the stone reopen so the row comes round again');
  assert.equal(W.stepDay(x, g1(x), 'practice'), '');
  // shared row: restarting the partner clears the same row, and the other pair still stays
  const y = RD.restartWords(d, 'g1', [partner], OPT).doc;
  assert.ok(!rowMarks(y).includes('rw:' + pairOf('night')));
  assert.ok(rowMarks(y).includes('rw:' + pairOf(other)));
  // the stamp holds those keys, and the tries of the other words' rows are untouched
  assert.deepEqual(Object.values(x.resets)[0].r, night);
  assert.equal(of(x).filter((t) => t.w === other && t.j === 'w').length, 1);
  // stone-level rw marks still clear for a practice redo and a week restart
  assert.deepEqual(rowMarks(RD.redoStone(d, 'g1', 'practice', OPT).doc), []);
  assert.deepEqual(rowMarks(RD.restartWeek(d, 'g1', OPT).doc), []);
});

test('FIX-1 copy: the help and each confirm say what each reset removes (a words restart says Meanings and Sentences open again, D33)', () => {
  assert.match(RD.RESET_HELP, /some words, one stone for every word, or the whole week/);
  assert.match(RD.confirmFor('words', ['a']).body, /Meanings and Sentences open again for the week/);
  assert.doesNotMatch(RD.confirmFor('words', ['a']).body, /no extra|Other words/);
  assert.match(RD.confirmFor('stone', 'fix').body, /every word/);
  assert.match(RD.confirmFor('stone', 'fix').body, /other stones are kept/);
  assert.match(RD.confirmFor('week').body, /Everything this week/);
  for (const s of [RD.RESET_HELP, RD.confirmFor('words', ['a']).body, RD.confirmFor('stone', 'hello').body, RD.confirmFor('week').body]) assert.ok(s.length < 260);
});

// ======================= FIX-2 (D32, row marks by word set, repeated restart) =============================================================
const doTry = (d, o) => T(d, { r: CODE.ALL, c: 1, clean: true, peeks: 0, day: TODAY, now: LATER + (tick += 1000), ...o });
/** The marks the child's runner writes for a stone now, applied (what a finished sitting does). */
const writeMarks = (d, step) => { let x = d; for (const m of pending(x, step)) x = W.markStep(x, g1(x), m, TODAY, LATER + (tick += 1000)); return x; };

test('FIX-2 D32: restart words reopens Meanings, Sentences and rows for that word, in the usual order; other words\' marks stay; the stone is done again once the word has redone it', () => {
  const d = cleanWeek();
  const state = (q) => Object.fromEntries(['hello', 'fix', 'games', 'story', 'practice'].map((s) => [s, !!W.stepDay(q, g1(q), s)]));
  assert.deepEqual(state(d), { hello: true, fix: true, games: true, story: true, practice: true });
  let x = RD.restartWords(d, 'g1', ['night'], OPT).doc;
  const g = () => g1(x);
  // every stone of the word reopens; the part marks of the other words stay
  assert.deepEqual(state(x), { hello: false, fix: false, games: false, story: false, practice: false });
  assert.equal(W.stepDay(x, g(), 'games:match'), '');
  assert.deepEqual(stepsOf(x).filter((k) => /^(hello|fix):\d$/.test(k)), ['fix:1', 'fix:2', 'fix:3', 'hello:1', 'hello:2', 'hello:3']);
  assert.equal(of(x).filter((t) => t.w === 'night').length, 0, 'its Meanings, Sentences and row tries went too');
  assert.deepEqual(x.notes.map((q) => q.w).sort(), ['bridge', 'light'], 'its sentence went, the other words\' stay');
  for (const w of ['light', 'fight', 'sight']) assert.equal(of(x).filter((t) => t.w === w).length, of(d).filter((t) => t.w === w).length, w + ' keeps every try');
  assert.equal(St.doneDay(x, g(), 'games'), ''); assert.equal(St.doneDay(x, g(), 'story'), '');
  // the order: Meet first, the word is not offered Meanings before its ladder
  const job = () => K.weekState(x, g(), TODAY).job;
  assert.equal(job(), 'hello');
  assert.equal(K.canOpen(x, g(), 'games', TODAY, {}), false);
  assert.equal(K.canOpen(x, g(), 'story', TODAY, {}), false);
  x = doTry(x, { word: 'night', j: 'h', ss: 'h77777' });
  x = writeMarks(x, 'hello');
  assert.equal(job(), 'fix', 'Meet done: the ladder is next, not Meanings');
  assert.equal(K.canOpen(x, g(), 'games', TODAY, {}), false);
  x = doTry(x, { word: 'night', j: 'f', ss: 'f77777' });
  x = writeMarks(x, 'fix');
  assert.equal(job(), 'games', 'the ladder done: Meanings is offered again');
  assert.equal(K.canOpen(x, g(), 'games', TODAY, {}), true);
  assert.equal(K.canOpen(x, g(), 'story', TODAY, {}), false);
  // the test is not open early at any point
  assert.equal(W.jobFor(x, g(), TEST), 'practise');
  assert.equal(K.canOpen(x, g(), 'test', TEST, {}), false);
  x = W.markStep(W.markStep(x, g(), 'games:match', TODAY, LATER + 50000), g(), 'games', TODAY, LATER + 50001);
  assert.equal(St.doneDay(x, g(), 'games'), TODAY, 'Meanings is done again once the word has redone it');
  assert.equal(job(), 'story');
  x = W.addNote(x, { id: 'n9', group: 'g1', word: 'night', text: 'The night is dark.', day: TODAY, now: LATER + 60000, bl: 3 });
  assert.deepEqual(St.sentenceWords(x, g(), 3).includes('night'), true, 'the word with no sentence is asked for first');
  x = W.markStep(x, g(), 'story', TODAY, LATER + 60001);
  assert.equal(job(), 'practice');
  assert.equal(K.stoneDone(x, g(), 'story', TODAY), true);
  assert.equal(W.jobFor(x, g(), TEST), 'practise', 'rows are still to do: the test stays closed');
});

test('FIX-3 display: the grown-up\'s estimate does not show Sentences as done after a restart reopened it, even when other words hold enough sentences', () => {
  let d = cleanWeek();
  for (const [i, w] of ['light', 'fight', 'sight'].entries()) d = W.addNote(d, { id: 'f3n' + i, group: 'g1', word: w, text: 'A ' + w + ' sentence ' + i + '.', day: TODAY, now: T0 + 500 + i, bl: 3 });
  assert.ok(W.notesFor(d, g1(d)).length >= 3, 'other words hold the full count of sentences');
  assert.equal(K.remaining(d, g1(d), TODAY).sentences, false, 'before: done');
  const x = RD.restartWords(d, 'g1', ['night'], OPT).doc;
  assert.ok(W.notesFor(x, g1(x)).length >= 3, 'the notes of the other words stay');
  assert.equal(W.stepDay(x, g1(x), 'story'), '', 'the child\'s stone is open again');
  const left = K.remaining(x, g1(x), TODAY);
  assert.equal(left.sentences, true, 'the estimate counts the Sentences stone as still to do');
  assert.equal(left.meanings, true);
  const est = K.estimate(WORDS, { today: TODAY, test: TEST, start: START, left });
  const done = K.estimate(WORDS, { today: TODAY, test: TEST, start: START, left: { ...left, sentences: false } });
  assert.ok(est.sittings > done.sittings, 'and it costs a sitting in the estimate');
  // redone: the mark is back, so it is done again
  const y = W.markStep(x, g1(x), 'story', TODAY, LATER + 70000);
  assert.equal(K.remaining(y, g1(y), TODAY).sentences, false);
});

test('FIX-2 D32: Meanings and Sentences marks go only with a words restart of that week; another week keeps its own', () => {
  const d = week();
  const x = RD.restartWords(d, 'g1', ['night'], OPT).doc;
  let y = W.markStep(x, W.groupById(x, 'g2'), 'games:match', TODAY, T0 + 70);
  y = W.markStep(y, W.groupById(y, 'g2'), 'story', TODAY, T0 + 71);
  const z = RD.restartWords(y, 'g1', ['light'], OPT).doc;
  assert.deepEqual(stepsOf(z, 'g2'), ['games:match', 'hello', 'story']);
  assert.ok(!stepsOf(z).includes('story') && !stepsOf(z).includes('games'));
});

/** The row plan (the groups of size 2) the week has for the words that did the whole word. */
const planOf = (d, size = 2) => {
  const g = g1(d);
  const f = new Map(WORDS.map((w) => [w, K.factsOf(d, g, w, TODAY)]));
  const ids = Rows.rowWords(d, g, f);
  return Rows.rowPlan(ids, size, seedOf('g1|rows', ''), {});
};

test('FIX-2 row marks: after a restart reshapes the plan, a kept mark never shows a group done that the child has not done in its current shape', () => {
  const d = week();
  const g = g1(d);
  const f = (q) => new Map(WORDS.map((w) => [w, K.factsOf(q, g1(q), w, TODAY)]));
  const before = Rows.rowWords(d, g, f(d));
  assert.deepEqual(before, WORDS);
  // the live (25b) marks have no word set; with no restart they count as ever
  const keyOf = (i) => g.id + '|rw:2:' + i;
  assert.ok(!d.steps[keyOf(0)].h && !d.steps[keyOf(1)].h);
  assert.equal(Rows.groupDone(d, g, 2, 0), true);
  assert.equal(Rows.roundDone(d, g, 2), true);
  // restart night: its row tries go, so the plan is of three words and has one group of three (a lone pair kept at some index would point at it)
  const x = RD.restartWords(d, 'g1', ['night'], OPT).doc;
  const gx = g1(x);
  const after = Rows.rowWords(x, gx, f(x));
  assert.ok(!after.includes('night'), 'night is not in the rows until it has climbed back');
  const plan = Rows.rowPlan(after, 2, seedOf('g1|rows', ''), {});
  const kept = Object.keys(x.steps).filter((k) => /\|rw:2:\d$/.test(k));
  assert.ok(kept.length >= 1, 'a mark of the pair without night is kept');
  assert.ok(kept.every((k) => x.steps[k].h), 'and it now knows its words');
  plan.forEach((grp, i) => assert.equal(Rows.groupDone(x, gx, 2, i, grp), false, 'group ' + i + ' of the new plan is not shown done: ' + grp.join(',')));
  // the same, when the kept mark is an old one with no word set and only the stamp tells: it does not count either
  const stripped = { ...x, steps: Object.fromEntries(Object.entries(x.steps).map(([k, v]) => { const { h, ...rest } = v; return [k, rest]; })) };
  plan.forEach((grp, i) => assert.equal(Rows.groupDone(stripped, gx, 2, i, grp), false, 'old mark, group ' + i));
  // night climbs back (Meet and ladder), so every word is in the plan again: a group counts done only if it is a kept pair, whole
  let y = doTry(x, { word: 'night', j: 'h', ss: 'h66666' });
  y = doTry(y, { word: 'night', j: 'f', ss: 'f66666' });
  const gy = g1(y);
  const back = Rows.rowWords(y, gy, f(y));
  assert.deepEqual([...back].sort(), [...WORDS].sort());
  const planBack = Rows.rowPlan(back, 2, seedOf('g1|rows', ''), { avoid: null });
  const nightPair = (planBack.find((grp) => grp.includes('night')) || []).length;
  assert.ok(nightPair >= 2);
  for (const [i, grp] of planBack.entries()) {
    const done = Rows.groupDone(y, gy, 2, i, grp);
    if (grp.includes('night')) assert.equal(done, false, 'the pair with night is not done');
    else assert.equal(done, !!y.steps[gy.id + '|rw:2:' + i] && y.steps[gy.id + '|rw:2:' + i].h === Rows.setHash(grp));
  }
  assert.equal(Rows.nextRow(y, gy, TODAY, f(y)) !== null, true, 'the child is offered rows again');
});

test('FIX-2 row marks: a new mark is written with its words, a marks written earlier still read, and the word set is kept through normalise and merge', () => {
  const d = week();
  const g = g1(d);
  const x = RD.redoStone(d, 'g1', 'practice', OPT).doc;
  // the runner writes row marks as the child finishes the groups, each with the hash of the words of its group
  const hashes = K.markHashes(x, g1(x), ['rw:2:0', 'rw:2:1', 'rw:2', 'practice'], TODAY);
  assert.ok(hashes['rw:2:0'] && hashes['rw:2:1'], 'both groups have a hash');
  assert.equal(hashes['rw:2'], ''); assert.equal(hashes.practice, '');
  let y = W.markStep(x, g1(x), 'rw:2:0', TODAY, LATER, hashes['rw:2:0']);
  y = W.markStep(y, g1(y), 'rw:2', TODAY, LATER + 1, hashes['rw:2']);
  assert.equal(y.steps['g1|rw:2:0'].h, hashes['rw:2:0']); assert.ok(!('h' in y.steps['g1|rw:2']));
  // normalise keeps a good hash and drops a bad one; an old mark has none and is read as before
  assert.equal(W.normalise(y).steps['g1|rw:2:0'].h, hashes['rw:2:0']);
  const bad = W.normalise({ ...y, steps: { ...y.steps, 'g1|rw:2:1': { d: TODAY, at: LATER, h: '../x y' } } });
  assert.ok(!('h' in bad.steps['g1|rw:2:1']));
  assert.equal(Rows.groupDone(d, g, 2, 0, WORDS.slice(0, 2)), true, 'the live data reads as it did');
  // two copies of the same mark, one with and one without the word set: merge keeps the one that knows its words
  const a = { ...y, steps: { ...y.steps, 'g1|rw:2:0': { d: TODAY, at: LATER } } };
  const b = { ...y, steps: { ...y.steps, 'g1|rw:2:0': { d: TODAY, at: LATER, h: hashes['rw:2:0'] } } };
  assert.equal(W.merge(a, b).steps['g1|rw:2:0'].h, hashes['rw:2:0']);
  assert.equal(W.merge(b, a).steps['g1|rw:2:0'].h, hashes['rw:2:0']);
  // a mark is done for the same set of words in any order, not for another
  assert.equal(Rows.groupDone(y, g1(y), 2, 0, [...planOf(x)[0]].reverse()), planOf(x)[0] ? Rows.setHash(planOf(x)[0]) === hashes['rw:2:0'] : false);
  assert.equal(Rows.groupDone(y, g1(y), 2, 0, ['other', 'words']), false);
});

test('FIX-2 repeat: restarting the same words again with nothing done since adds no new stamp; new work or other words does', () => {
  const d = week();
  const one = RD.restartWords(d, 'g1', ['night'], OPT).doc;
  assert.equal(Object.keys(one.resets).length, 1);
  const again = RD.restartWords(one, 'g1', ['Night'], { now: RESET_AT + 60000, today: TODAY });
  assert.equal(Object.keys(again.doc.resets).length, 1, 'still the one stamp');
  assert.deepEqual(again.words, ['night']);
  assert.deepEqual(again.doc.resets, one.resets);
  assert.deepEqual(again.doc.results, one.results);
  // a subset of a restarted pair is covered as well
  const two = RD.restartWords(d, 'g1', ['night', 'sight'], OPT).doc;
  assert.equal(Object.keys(RD.restartWords(two, 'g1', ['sight'], { now: RESET_AT + 60000, today: TODAY }).doc.resets).length, 1);
  // something done since: the second restart is a new stamp
  const work = doTry(one, { word: 'night', j: 'h', ss: 'h55555' });
  const third = RD.restartWords(work, 'g1', ['night'], { now: LATER + 3 * 3600000, today: TODAY }).doc;
  assert.equal(Object.keys(third.resets).length, 2, 'the newer stamp is added; the older one stays (FIX-3)');
  assert.ok(Math.max(...Object.values(third.resets).map((x) => x.at)) > Object.values(one.resets)[0].at);
  assert.equal(of(third).filter((t) => t.w === 'night').length, 0, 'and that work is removed');
  // another word is a new stamp, and the first restart is not undone by it
  const other = RD.restartWords(one, 'g1', ['light'], { now: RESET_AT + 60000, today: TODAY }).doc;
  assert.equal(Object.keys(other.resets).length, 2);
  // a different week is its own
  const wk = RD.restartWords(RD.restartWords(one, 'g2', ['bridge'], OPT).doc, 'g1', ['night'], { now: RESET_AT + 120000, today: TODAY }).doc;
  assert.equal(Object.keys(wk.resets).length, 2);
});

// FIX-3 S1 (CHECK-2): a 25b device keeps `resets` as an unknown key and merges it by the bigger JSON, not by union. A newer map must therefore
// be a superset of the older one (so also bigger), or a 25b device that saw only the first reset writes it back over the second.
test('FIX-3 S1: restart a word, then the week, then a 25b-style merge that keeps the bigger copy: the week reset survives', () => {
  const bigger = (p, q) => (J(p).length > J(q).length || (J(p).length === J(q).length && J(p) > J(q)) ? p : q);
  const d = week();
  const a = RD.restartWords(d, 'g1', ['night'], OPT).doc; // the 25b child pulls this
  const server = RD.restartWeek(a, 'g1', { now: RESET_AT + 300000, today: TODAY }).doc;
  assert.ok(J(server.resets).length > J(a.resets).length, 'the newer map is the bigger one');
  assert.deepEqual(Object.values(server.resets).map((x) => x.t).sort(), ['week', 'words']);
  // what 25b writes back: its own old tries (kept by its merge) and the bigger resets map
  const oldChild = { ...d, resets: a.resets, results: d.results };
  const wrote = { ...server, results: [...server.results, ...oldChild.results.filter((r) => r.g === 'g1')], resets: bigger(oldChild.resets, server.resets) };
  assert.ok(Object.values(wrote.resets).some((x) => x.t === 'week'), 'the week stamp is still there');
  const read = W.normalise(wrote);
  assert.deepEqual(of(read), [], 'the grown-up\'s read shows no old tries');
  assert.deepEqual(of(W.merge(wrote, server)), []);
  assert.equal(Object.keys(read.steps).filter((k) => k.startsWith('g1|')).length, 0);
});
