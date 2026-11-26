// SB6 WP-2 (TRS TR-11 .. TR-16): the data model in words-doc.js. U-words6.
// Fields on tries/notes/steps, focus words, the rung fold bits, ladderFacts, forward compatibility, and "no Normal code writes the practice step".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as W from '../site/js/words-doc.js';

const DAY = '2026-11-24';
const mk = (words = ['night', 'light', 'fight', 'sight']) => {
  const d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'x', test: '2026-12-01', words, today: DAY, now: 1000 }).doc;
  return { d, g: W.groupById(d, 'g1') };
};
let n = 0;
const T = (d, o) => { n += 1; return W.addTry(d, { id: 'r' + String(n).padStart(5, '0'), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, day: DAY, now: 2000 + n, source: 'g', ...o }); };

test('addTry writes the SB6 fields only when valid, and never a new k or s', () => {
  const { d } = mk();
  const e = T(d, { word: 'night', r: 3, j: 'f', ss: 'k3x9qa', sl: [7, 2, 2, 40, -1, 'a'], rw: 4, lv: 2 }).results[0];
  assert.deepEqual([e.r, e.j, e.ss, e.sl, e.rw, e.lv, e.k, e.s], [3, 'f', 'k3x9qa', [2, 7], 4, 2, 'p', 'g']);
  const bad = T(d, { word: 'night', r: 32, j: 'z', ss: 'ABC', sl: [], rw: 1 }).results[0];
  for (const f of ['r', 'j', 'ss', 'sl', 'rw', 'pr']) assert.ok(!(f in bad), f + ' left out');
  assert.deepEqual(T(d, { word: 'night', sl: [0, 1, 2, 3, 4, 5, 6] }).results[0].sl, [0, 1, 2, 3, 4], 'at most 5');
  assert.ok(JSON.stringify(T(d, { word: 'night', r: 2 }).results[0]).length < 160, 'a small try stays small');
  assert.ok(['p', 't', 'f'].includes(e.k));
});
test('a test word spelled after a Peek is { c: 0, p >= 1, pr } and is out of the pass mark; pr is never invented (TR-13, S2)', () => {
  const d = T(mk(['night']).d, { word: 'night', kind: 't', clean: true, peeks: 1, pr: 1, day: '2026-12-01' }); // a caller error (clean) is corrected
  const t = d.results[0];
  assert.deepEqual([t.k, t.c, t.p, t.pr], ['t', 0, 1, 1]);
  const g = W.groupById(d, 'g1');
  assert.deepEqual(W.testResults(d, g)[0].result, { right: false, day: '2026-12-01' });
  assert.deepEqual(W.slipped(d, g), ['night']);
  assert.deepEqual(W.fixups(d, g), ['night'], 'goes to words we will keep practising');
  assert.equal(T(mk(['night']).d, { word: 'night', kind: 't', clean: false, peeks: 2, pr: 0, day: '2026-12-01' }).results[0].pr, 0);
  // no Peek happened: pr is ignored, nothing is invented, the answer stands
  const none = T(mk(['night']).d, { word: 'night', kind: 't', clean: true, peeks: 0, pr: 1, day: '2026-12-01' }).results[0];
  assert.deepEqual([none.c, none.p, 'pr' in none], [1, 0, false]);
  assert.ok(!('pr' in T(mk(['night']).d, { word: 'night', kind: 'p', peeks: 1, pr: 1 }).results[0]), 'pr only on a test try');
});
test('a note keeps bl and hp only when set (TR-12)', () => {
  const { d } = mk();
  const a = W.addNote(d, { id: 'n1', group: 'g1', word: 'night', text: 'I like the night.', day: DAY, now: 5, bl: 3, hp: true }).notes[0];
  assert.deepEqual([a.bl, a.hp], [3, 1]);
  const b = W.addNote(d, { id: 'n2', group: 'g1', word: 'night', text: 'x', day: DAY, now: 6, bl: 2 }).notes[0];
  assert.ok(!('bl' in b) && !('hp' in b));
  assert.equal(W.normalise(W.addNote(d, { id: 'n1', group: 'g1', word: 'night', text: 'x', day: DAY, now: 5, bl: 4, hp: 1 })).notes[0].bl, 4);
});

// ---- focus words are gone (D21) ----------------------------------------------------------------------------------------------
test('D21: no focus words: no API, createGroup and editGroup ignore `focus`, an old `focus` field is kept as an unknown field and never acted on', () => {
  assert.equal(W.focusOf, undefined);
  const { d, g } = mk();
  const c = W.createGroup(W.emptyDoc(), { id: 'g2', test: '2026-12-01', words: ['night', 'light'], focus: ['night'], today: DAY, now: 1 });
  assert.ok(!('focus' in c.doc.groups.g2));
  assert.ok(!('focus' in W.editGroup(d, 'g1', { focus: ['night'] }, DAY, 9).doc.groups.g1));
  const old = W.normalise({ ...d, groups: { g1: { ...d.groups.g1, focus: ['night'] } } }).groups.g1;
  assert.deepEqual(old.focus, ['night'], 'kept as it is (forward compatibility)');
  const edited = W.editGroup({ ...d, groups: { g1: old } }, 'g1', { words: ['night', 'fight'] }, DAY, 11).doc.groups.g1;
  assert.deepEqual(edited.focus, ['night'], 'not touched either: nothing acts on it');
  assert.equal(g.words.length, 4);
});
test('S3: an edit never ties with the stored copy: at is max(now, stored at + 1)', () => {
  const { d } = mk();
  const at = d.groups.g1.at;
  assert.equal(W.editGroup(d, 'g1', { name: 'A' }, DAY, at).doc.groups.g1.at, at + 1);
  assert.equal(W.editGroup(d, 'g1', { name: 'A' }, DAY, at - 50).doc.groups.g1.at, at + 1);
  assert.equal(W.editGroup(d, 'g1', { name: 'A' }, DAY, at + 500).doc.groups.g1.at, at + 500);
});

// ---- the rung bits and ladderFacts (TR-12) ----------------------------------------------------------------------------
const sit = 'aaaaaa';
const ALL = W.ALL_RUNG; // the whole-word code
const rung = (d, word, r, day, o = {}) => T(d, { word, day, r, j: 'f', ss: sit, lv: r === ALL ? undefined : r < 4 ? 2 : 3, ...o });
test('ladderFacts: best is the highest rung reached on its own on a day before today; today is separate', () => {
  let { d } = mk();
  assert.deepEqual(W.ladderFacts(d, 'night', DAY), { best: 0, bestToday: 0, allDays: [], secure: false, metOn: '', days: [], peeksTotal: 0, slipsTotal: 0, resume: null, lastSitting: null, slipSpots: [], usualSpots: [] });
  d = rung(rung(rung(d, 'night', 1, '2026-11-23'), 'night', 2, '2026-11-23'), 'night', 3, '2026-11-23');
  d = rung(d, 'night', 5, '2026-11-23', { t: 0, tries: 1, clean: true }); // a slip on the way: not "on its own"
  let f = W.ladderFacts(d, 'night', DAY);
  assert.equal(f.best, 3);
  assert.equal(f.bestToday, 0);
  assert.equal(f.metOn, '2026-11-23');
  assert.deepEqual(f.days, ['2026-11-23']);
  d = rung(d, 'night', 4, DAY);
  f = W.ladderFacts(d, 'night', DAY);
  assert.deepEqual([f.best, f.bestToday], [3, 4]);
  assert.equal(W.ladderFacts(d, 'night', '2026-11-25').best, 4);
  assert.equal(W.ladderFacts(d, 'Night', DAY).best, 3, 'the word is compared in lower case');
  assert.equal(W.ladderFacts(d, 'light', DAY).best, 0, 'other words are not touched');
});
test('a try with a Peek or a slip does not reach its rung on its own; a try with no rung and nothing missing is R-all (a Normal first go)', () => {
  let { d } = mk();
  d = rung(d, 'night', 6, '2026-11-20', { peeks: 1 });
  d = T(d, { word: 'light', day: '2026-11-20' }); // a keyboard first go, no rung: reads as R-all
  d = T(d, { word: 'fight', day: '2026-11-20', lv: 2 }); // assisted, no rung: not R-all
  assert.equal(W.ladderFacts(d, 'night', DAY).best, 0);
  assert.equal(W.ladderFacts(d, 'light', DAY).best, ALL);
  assert.deepEqual(W.ladderFacts(d, 'light', DAY).allDays, ['2026-11-20']);
  assert.equal(W.ladderFacts(d, 'fight', DAY).best, 1, 'an assisted clean first go with no rung reads as rung 1: one rung lower, never higher');
});
test('Got it (secure): the first R-all try clean on 2 different days; the second try of a day does not count', () => {
  let { d } = mk();
  d = rung(d, 'night', ALL, '2026-11-20', { t: 1, tries: 1, clean: true }); // slipped first: not ALL_FIRST
  d = rung(d, 'night', ALL, '2026-11-20'); // a later clean one that day: still not the first rung-8 try
  assert.deepEqual(W.ladderFacts(d, 'night', DAY).allDays, []);
  d = rung(d, 'night', ALL, '2026-11-21');
  assert.deepEqual(W.ladderFacts(d, 'night', DAY).allDays, ['2026-11-21']);
  assert.equal(W.ladderFacts(d, 'night', DAY).secure, false);
  d = rung(rung(d, 'night', 3, '2026-11-22'), 'night', ALL, '2026-11-22'); // R-all after lower rungs that day: ALL_FIRST, not RECALL
  const f = W.ladderFacts(d, 'night', DAY);
  assert.deepEqual(f.allDays, ['2026-11-21', '2026-11-22']);
  assert.equal(f.secure, true);
  // a Normal first go counts the same
  let e = mk().d;
  e = T(T(e, { word: 'night', day: '2026-11-20' }), { word: 'night', day: '2026-11-22' });
  assert.equal(W.ladderFacts(e, 'night', DAY).secure, true);
});
test('totals, last sitting, park, peeked on every rung, slip spots (TR-12)', () => {
  let { d } = mk();
  d = T(d, { word: 'night', day: '2026-11-23', r: 4, j: 'f', ss: 'old111', tries: 1, peeks: 0, clean: true, sl: [3] });
  // the newest sitting: slips on rungs 3, 5 and 6 (three different rungs: park), a Peek on each hidden rung
  d = T(d, { word: 'night', day: DAY, r: 3, j: 'f', ss: 'new222', tries: 2, peeks: 1, clean: true, sl: [4, 1] });
  d = T(d, { word: 'night', day: DAY, r: 5, j: 'f', ss: 'new222', tries: 1, peeks: 1, clean: true, sl: [4] });
  d = T(d, { word: 'night', day: DAY, r: 6, j: 'f', ss: 'new222', tries: 1, peeks: 1, clean: true, sl: [1] });
  d = T(d, { word: 'night', day: DAY, r: 1, j: 'f', ss: 'new222' }); // the park's R1 copy
  d = T(d, { word: 'light', day: DAY, r: 2, j: 'f', ss: 'zzzzzz' }); // another word's sitting: not this word's
  const f = W.ladderFacts(d, 'night', DAY);
  assert.equal(f.slipsTotal, 5);
  assert.equal(f.peeksTotal, 3);
  assert.deepEqual(f.lastSitting, { ss: 'new222', day: DAY, peekedEvery: true, slipRungs: [3, 5, 6] });
  assert.deepEqual(f.slipSpots, [1, 4, 3]);
  assert.deepEqual(f.usualSpots, [], 'all on one day, bar one');
  // two rungs only: not parked; one rung without a Peek: not peekedEvery
  let e = mk().d;
  e = T(T(e, { word: 'night', day: DAY, r: 3, j: 'f', ss: 'new222', tries: 1, clean: true, peeks: 1 }), { word: 'night', day: DAY, r: 4, j: 'f', ss: 'new222', tries: 1, clean: true });
  assert.deepEqual(W.ladderFacts(e, 'night', DAY).lastSitting, { ss: 'new222', day: DAY, peekedEvery: false, slipRungs: [3, 4] });
  assert.equal(W.ladderFacts(mk().d, 'night', DAY).lastSitting, null);
});
test('slipSpots: the last 5 slips, newest first, no letters; usualSpots: seen on 2 different days among them', () => {
  let { d } = mk();
  d = T(d, { word: 'night', day: '2026-11-20', r: 2, ss: 'aaaa11', tries: 1, sl: [5] });
  d = T(d, { word: 'night', day: '2026-11-21', r: 2, ss: 'bbbb22', tries: 1, sl: [5, 9] });
  d = T(d, { word: 'night', day: '2026-11-22', r: 2, ss: 'cccc33', tries: 1, sl: [2] });
  let f = W.ladderFacts(d, 'night', DAY);
  assert.deepEqual(f.slipSpots, [2, 5, 9]);
  assert.deepEqual(f.usualSpots, [5]);
  d = T(T(d, { word: 'night', day: '2026-11-23', r: 2, ss: 'dddd44', tries: 1, sl: [7, 8] }), { word: 'night', day: DAY, r: 2, ss: 'eeee55', tries: 1, sl: [0] });
  f = W.ladderFacts(d, 'night', DAY); // the window is the last 5: 0, 7, 8, 2, 5 (the older 5 and 9 are out)
  assert.deepEqual(f.slipSpots, [0, 7, 8, 2, 5]);
  assert.deepEqual(f.usualSpots, []);
  assert.equal(W.cleanSlips([3, 1, 3, 25]).join(), '1,3');
});
test('an older device folds an SB6 day without rung bits: the day reads from what the fold holds (TR-12, R-4)', () => {
  const ERA = 32768; const RECALL = 16384; const FIRST = 1; const CLEAN = 2; const SPELT = 1024;
  const fold = (days) => ({ ...mk().d, folded: { 'g1|night': { n: 9, t: 0, p: 0, through: 1, days } } });
  assert.equal(W.ladderFacts(fold({ '2026-11-20': ERA | RECALL | FIRST | CLEAN | SPELT }), 'night', DAY).best, ALL, 'a recall day is R-all');
  assert.equal(W.ladderFacts(fold({ '2026-11-20': ERA | FIRST | CLEAN | SPELT }), 'night', DAY).best, 1, 'a clean first go that was assisted is rung 1: one rung lower, never higher');
  assert.equal(W.ladderFacts(fold({ '2026-11-20': ERA | CLEAN | SPELT }), 'night', DAY).best, 0);
  assert.equal(W.ladderFacts(fold({ '2026-11-20': FIRST | CLEAN }), 'night', DAY).best, ALL, 'a day folded before SB4 (FIRST, no ERA) counted as a first go on its own: R-all');
});

// ---- trimming keeps every fact the ladder needs (TR-12, TR-16) ------------------------------------------------------------
test('folding old tries keeps ladderFacts, the study jobs and jobFor the same (rung bits are in the fold)', () => {
  let { d } = mk(['night', 'light']);
  let k = 0;
  for (let day = 17; day <= 24; day += 1) {
    const dd = '2026-11-' + day;
    d = rung(rung(rung(d, 'night', 1, dd), 'night', 3, dd, { tries: 1, clean: true, sl: [2, 6] }), 'night', day % 2 ? ALL : 4, dd);
    d = rung(d, 'light', ALL, dd);
    for (let i = 0; i < 40; i += 1) { k += 1; d = T(d, { word: i % 2 ? 'night' : 'light', day: dd, r: 2 + (i % 6), j: 'w', ss: 'x' + String(i).padStart(5, '0'), tries: 2, clean: true, sl: [i % 7], rw: 3 }); }
  }
  d = W.markStep(d, W.groupById(d, 'g1'), 'rw:2:0', '2026-11-20', 5);
  assert.ok(W.sizeOf(d) > W.TRIM_AT, 'big enough to fold: ' + W.sizeOf(d));
  const t = W.trim(d, 9e12);
  assert.ok(Object.keys(t.folded).length > 0 && t.results.length < d.results.length, 'it did fold');
  assert.ok(W.sizeOf(t) <= W.TRIM_TO);
  for (const w of ['night', 'light']) assert.deepEqual(W.ladderFacts(t, w, DAY), W.ladderFacts(d, w, DAY), w);
  const g = W.groupById(d, 'g1');
  for (const day of ['2026-11-25', '2026-12-01', '2026-12-02']) assert.equal(W.jobFor(W.normalise(t), W.groupById(t, 'g1'), day), W.jobFor(d, g, day));
  assert.equal(W.studyDone(t, W.groupById(t, 'g1')), W.studyDone(d, g));
  assert.deepEqual(Object.keys(t.steps), Object.keys(d.steps), 'steps stay');
});
test('ledger facts are unchanged for tries without SB6 fields (the old rules read the same days)', () => {
  let { d, g } = mk();
  d = T(d, { word: 'night', day: DAY, lv: 2 });
  assert.equal(W.cell(d, g, 'night', DAY), 'clean');
  d = T(T(T(d, { word: 'night', day: DAY }), { word: 'night', day: DAY }), { word: 'night', day: DAY });
  assert.equal(W.doneOn(d, g, 'night', DAY), true);
  assert.equal(W.assisted({ lv: 2 }), true);
});

// ---- forward compatibility (TR-15) --------------------------------------------------------------------------------------------
test('unknown fields survive normalise, merge and trim: a top-level key, a setup field, a group field', () => {
  const { d } = mk();
  const v = {
    ...d,
    zz: { at: 5, a: [1, 2] },
    list: [1, 2, 3],
    setup: { zz: { at: 7, q: 1 }, help: { lv: 2, at: 3 } },
    groups: { g1: { ...d.groups.g1, zz: { at: 4 }, shortText: 'hi' } },
  };
  const nrm = W.normalise(v);
  assert.deepEqual(nrm.zz, { at: 5, a: [1, 2] });
  assert.deepEqual(nrm.list, [1, 2, 3]);
  assert.deepEqual(nrm.setup.zz, { at: 7, q: 1 });
  assert.deepEqual(nrm.groups.g1.zz, { at: 4 });
  assert.equal(nrm.groups.g1.shortText, 'hi');
  assert.deepEqual(W.normalise(nrm), nrm, 'normalise is stable');
  // too big or badly named: dropped
  const big = W.normalise({ ...d, huge: { at: 1, x: 'y'.repeat(5000) }, '__proto__x': { at: 1 }, '1bad': { at: 1 }, str: 'text', nul: null, groups: { g1: { ...d.groups.g1, big: 'y'.repeat(1100), 'Bad': 1 } }, setup: { help: { lv: 2, at: 3 }, noAt: { x: 1 }, big: { at: 1, x: 'y'.repeat(3000) } } });
  assert.ok(!('huge' in big) && !('1bad' in big) && !('str' in big) && !('nul' in big) && !('__proto__x' in big));
  assert.ok(!('big' in big.groups.g1) && !('Bad' in big.groups.g1) && !('noAt' in big.setup) && !('big' in big.setup));
  assert.equal(Object.getPrototypeOf(big), Object.prototype);
  // merge: the larger numeric at; else this device's copy (the first argument)
  const a = W.normalise({ ...d, zz: { at: 5, v: 'a' }, kk: { at: 1, v: 'a' }, arr: [1] });
  const b = W.normalise({ ...d, zz: { at: 9, v: 'b' }, kk: { at: 1, v: 'b' }, arr: [2], only: { at: 2 } });
  const m = W.merge(a, b);
  assert.equal(m.zz.v, 'b');
  assert.equal(m.kk.v, 'b', 'a tie goes to the larger JSON, the same on every device');
  assert.deepEqual(m.arr, [2], 'arrays have no at: the larger JSON, the same on every device');
  assert.deepEqual(m.only, { at: 2 });
  assert.deepEqual(W.merge(b, a).arr, [2]);
  // setup and group extras merge too
  const sa = W.normalise({ ...d, setup: { zz: { at: 1, v: 'a' } }, groups: { g1: { ...d.groups.g1, zz: { v: 'a' } } } });
  const sb = W.normalise({ ...d, setup: { zz: { at: 2, v: 'b' } }, groups: { g1: { ...d.groups.g1, zz: { v: 'b' } } } });
  assert.equal(W.merge(sa, sb).setup.zz.v, 'b');
  // trim keeps them (even folding)
  let big2 = { ...nrm };
  for (let i = 0; i < 400; i += 1) big2 = T(big2, { word: 'night', day: '2026-11-' + (10 + (i % 14)), r: 3, ss: 'abcdef', sl: [1], tries: 1 });
  const t = W.trim(big2, 9e12);
  assert.ok(t.results.length < big2.results.length);
  assert.deepEqual([t.zz, t.list, t.setup.zz, t.groups.g1.zz], [nrm.zz, nrm.list, nrm.setup.zz, nrm.groups.g1.zz]);
  // reset drops them (they are progress)
  assert.ok(!('zz' in W.reset(5, nrm)));
});
test('S7: unknown top-level keys converge on one copy at a tie, and a reset wins by time', () => {
  const { d } = mk();
  const a = W.normalise({ ...d, zz: { at: 5, v: 'a' }, arr: [1, 2], ky: { v: 'short' } });
  const b = W.normalise({ ...d, zz: { at: 5, v: 'bbbbbb' }, arr: [2, 1, 3], ky: { v: 'a much longer one' } });
  const ab = W.merge(a, b);
  const ba = W.merge(b, a);
  assert.deepEqual([ab.zz, ab.arr, ab.ky], [ba.zz, ba.arr, ba.ky], 'the same copy whichever device merges');
  assert.equal(ab.zz.v, 'bbbbbb');
  assert.deepEqual(ab.arr, [2, 1, 3]);
  // a reset (resetAt later than the key's at) is not undone by the other device's copy
  const reset = W.reset(9000, a);
  const other = W.normalise({ ...d, zz: { at: 100, v: 'old' } });
  assert.ok(!('zz' in W.merge(reset, other)) && !('zz' in W.merge(other, reset)));
  assert.equal(W.merge(reset, W.normalise({ ...d, zz: { at: 99999, v: 'new' } })).zz.v, 'new', 'but a newer copy stays');
});

// ---- steps (TR-12) -----------------------------------------------------------------------------------------------------------
test('sitting and rows marks are steps: kept by normalise, merge and trim; se: marks go with a deleted group', () => {
  let { d, g } = mk();
  for (const k of ['se:k3x9qa', 'rw:2', 'rw:2:0', 'rw:3:1', 'practice']) d = W.markStep(d, g, k, DAY, 7);
  const steps = Object.keys(d.steps).sort();
  assert.deepEqual(Object.keys(W.normalise(d).steps).sort(), steps);
  assert.deepEqual(Object.keys(W.merge(d, W.emptyDoc()).steps).sort(), steps);
  let big = d;
  for (let i = 0; i < 700; i += 1) big = T(big, { word: 'night', day: '2026-11-' + (10 + (i % 14)), r: 3, ss: 'abcdef', sl: [1], tries: 1 });
  assert.ok(W.sizeOf(big) > W.TRIM_AT);
  const t = W.trim(big, 9e12);
  assert.ok(t.results.length < big.results.length, 'it folded');
  assert.deepEqual(Object.keys(t.steps).sort(), steps, 'a live group keeps its rw: marks and sitting marks');
  const gone = W.trim(W.deleteGroup(big, 'g1', 100), 200);
  assert.ok(gone.results.length < big.results.length);
  assert.deepEqual(Object.keys(gone.steps).sort(), steps.filter((k) => !k.includes('|se:')), 'a deleted group loses its sitting marks now');
});
test('studyJobDay(practice) is done by the step mark too, and no Normal code writes that step (TR-12, R-3)', () => {
  let { d, g } = mk(['night']);
  assert.equal(W.studyJobDay(d, g, 'practice'), '');
  d = W.markStep(d, g, 'practice', DAY, 3);
  assert.equal(W.studyJobDay(d, g, 'practice'), DAY);
  assert.equal(W.studyJobDay(d, g, 'fix'), '');
  const dir = new URL('../site/js/', import.meta.url);
  const hits = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const line of src.split('\n')) if (/markStep\(/.test(line) && /['"]practice['"]/.test(line) && !/^\s*(\/\/|\*)/.test(line)) hits.push(f + ': ' + line.trim());
  }
  // The only writer allowed is the Step by step rows stone (sbs-week-doc.js / sbs-views.js, written later in SB6): nothing else.
  assert.deepEqual(hits.filter((h) => !/^(sbs-[a-z-]+|rows-doc|session-doc)\.js:/.test(h)), [], 'no Normal code writes the practice step');
});

// ---- M1: trim folds strictly oldest-first, so the shared merge never drops a protected try --------------------------------
test('M1: an old last sitting, newer tries without ss, over 48 KB: trim, then merge with itself and with the untrimmed copy: nothing the ladder reads is lost', () => {
  let { d } = mk(['night', 'light']);
  const day = (n) => '2026-11-' + String(n).padStart(2, '0');
  // lots of older ladder tries
  for (let i = 0; i < 320; i += 1) d = T(d, { word: i % 2 ? 'night' : 'light', day: day(5 + (i % 8)), r: 2 + (i % 6), ss: 'old' + String(i % 9).padStart(3, '0'), j: 'w', rw: 3, tries: 1, sl: [i % 9], now: 10000 + i });
  // the last sitting of 'night' (older than 24 h) and, NEWER than it, tries with no sitting id (the test, a game)
  const sitAt = 9e8;
  for (let i = 0; i < 6; i += 1) d = T(d, { word: 'night', day: day(20), r: 3 + (i % 3), j: 'f', ss: 'last01', tries: 1, peeks: 1, sl: [i], now: sitAt + i * 1000 });
  for (let i = 0; i < 3; i += 1) d = T(d, { word: 'night', day: day(22), kind: 't', tries: 0, now: sitAt + 5e7 + i, clean: true });
  for (let i = 0; i < 250; i += 1) d = T(d, { word: 'light', day: day(22), r: 3, ss: 'zzz' + String(i % 3), j: 'w', rw: 2, tries: 1, sl: [1], now: sitAt + 6e7 + i });
  assert.ok(W.sizeOf(d) > W.TRIM_AT, 'big enough: ' + W.sizeOf(d));
  const now = sitAt + 6e7 + 9e6; // more than 24 h after the 'last01' sitting
  const t = W.trim(d, now);
  assert.ok(t.results.length < d.results.length, 'folded');
  const before = (x) => ['night', 'light'].map((w) => W.ladderFacts(x, w, day(23)));
  const ref = before(d);
  assert.deepEqual(before(t), ref, 'trim keeps every fact');
  assert.deepEqual(before(W.merge(t, t)), ref, 'merge with itself');
  assert.deepEqual(before(W.merge(t, d)), ref, 'merge with the untrimmed copy');
  assert.deepEqual(before(W.merge(d, t)), ref);
  const f = W.ladderFacts(W.merge(t, t), 'night', day(23));
  assert.equal(f.lastSitting.ss, 'last01');
  assert.equal(f.slipsTotal, W.ladderFacts(d, 'night', day(23)).slipsTotal);
  assert.equal(f.peeksTotal, W.ladderFacts(d, 'night', day(23)).peeksTotal);
  // folding is strictly oldest-first: no kept try is older than a fold's `through`
  for (const [key, fold] of Object.entries(t.folded)) for (const r of t.results) if (key === r.g + '|' + r.w) assert.ok(r.at > fold.through, key);
});

// ---- S4: where the park happened --------------------------------------------------------------------------------------------
test('D22: nothing is parked: no parkedAt, and an old pk field is kept but never acted on; resume gives the exact saved step', () => {
  let { d } = mk();
  const s = (r, t, at, o = {}) => { d = T(d, { word: 'night', day: DAY, r, j: 'f', ss: 'park01', tries: t, clean: true, now: 70000 + at, ...o }); };
  s(3, 1, 1); s(4, 1, 2); s(5, 2, 3); s(1, 1, 4);
  const f = W.ladderFacts(d, 'night', DAY);
  assert.ok(!('parkedAt' in f.lastSitting));
  assert.deepEqual(f.lastSitting.slipRungs, [1, 3, 4, 5]);
  assert.ok(!('pk' in T(mk().d, { word: 'night', r: 2, j: 'f', pk: 1 }).results[0]), 'addTry no longer writes pk');
  const withPk = { ...d, results: d.results.map((r, i) => (i === 2 ? { ...r, pk: 1 } : r)) };
  assert.equal(W.normalise(JSON.parse(JSON.stringify(withPk))).results[2].pk, 1, 'kept through normalise');
  assert.equal(W.merge(withPk, withPk).results[2].pk, 1);
  assert.deepEqual(W.ladderFacts(withPk, 'night', DAY), W.ladderFacts(d, 'night', DAY), 'and never acted on');
  // resume: the last ladder try's rung and whether it was clean
  assert.deepEqual(f.resume, { r: 1, clean: false, day: DAY, ss: 'park01' });
  s(6, 0, 5);
  assert.deepEqual(W.ladderFacts(d, 'night', DAY).resume, { r: 6, clean: true, day: DAY, ss: 'park01' });
  s(7, 0, 6, { peeks: 1 });
  assert.deepEqual(W.ladderFacts(d, 'night', DAY).resume, { r: 7, clean: false, day: DAY, ss: 'park01' }, 'a Peek is not clean');
  // rows, checks and builder tries are not the ladder
  d = T(d, { word: 'night', day: DAY, r: 2, j: 'w', rw: 2, ss: 'rows01', now: 80000 });
  d = T(d, { word: 'night', day: DAY, r: ALL, j: 'k', ss: 'rows01', now: 80001 });
  assert.equal(W.ladderFacts(d, 'night', DAY).resume.r, 7);
  assert.equal(W.ladderFacts(mk().d, 'night', DAY).resume, null);
  assert.equal(W.ladderFacts(d, 'light', DAY).resume, null);
});

// ---- D20: long words: rung codes up to 31 and the fold bits -------------------------------------------------------------------
test('D20: long words: partial rung codes up to 20 are stored; the fold keeps the best rung (saturating at slot 14) and the whole word separately', () => {
  assert.equal(W.MAX_RUNG, 31);
  assert.equal(W.ALL_RUNG, 31, 'RULES.rungs.allCode = 31 = MAX_RUNG');
  const { d } = mk(['night']);
  const one = (r, day = '2026-11-20') => T(d, { word: 'night', day, r, j: 'f', ss: 'long01', lv: r === W.ALL_RUNG ? undefined : 3 });
  for (const r of [9, 11, 14]) assert.equal(W.ladderFacts(one(r), 'night', DAY).best, r);
  assert.equal(W.ladderFacts(one(20), 'night', DAY).best, 14, 'codes above 14 read as 14: one rung or more lower, never higher');
  assert.equal(W.ladderFacts(one(W.ALL_RUNG), 'night', DAY).best, W.ALL_RUNG);
  assert.equal(W.ladderFacts(one(7), 'night', DAY).best, 7);
  // no flag collides with the old bits (1-16, 256-32768) and every one fits in 31 bits
  const used = 1 | 2 | 4 | 8 | 16 | 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384 | 32768;
  assert.equal(used & (0x7fff << 16 | 32 | 64 | 128), 0, 'the new bits are all free ones');
  assert.ok((0x7fff << 16 | 32 | 64 | 128) > 0, 'positive 31-bit value');
});

// ---- M4: only a try with no rung, or the whole word, is "recall" ---------------------------------------------------------------
test('M4: Copy tries never make a word remembered or Got it; whole-word first tries do; Normal play is unchanged', () => {
  const days = ['2026-11-01', '2026-11-05', '2026-11-10']; // three days, nine days apart: enough for remembered
  const make = (o) => days.reduce((d, day) => T(d, { word: 'night', day, ...o }), mk(['night']).d);
  const copy = make({ r: 1, j: 'f', ss: 'cccccc' });
  assert.equal(W.isRemembered(copy, 'night'), false, 'Copy only');
  assert.equal(W.ladderFacts(copy, 'night', DAY).secure, false);
  assert.equal(W.ladderFacts(copy, 'night', DAY).best, 1);
  const mid = make({ r: 5, j: 'f', ss: 'cccccc' });
  assert.equal(W.isRemembered(mid, 'night'), false);
  assert.deepEqual(W.goodDays(mid, 'night'), []);
  const whole = make({ r: ALL, j: 'f', ss: 'cccccc' });
  assert.equal(W.isRemembered(whole, 'night'), true, 'whole word, first go, clean');
  assert.equal(W.ladderFacts(whole, 'night', DAY).secure, true);
  const normal = make({ source: undefined });
  assert.equal(W.isRemembered(normal, 'night'), true, 'Normal play (no rung) as today');
  assert.equal(W.recall({ c: 1, t: 0, p: 0 }), true);
  assert.equal(W.recall({ c: 1, t: 0, p: 0, r: 1 }), false);
  assert.equal(W.recall({ c: 1, t: 0, p: 0, r: ALL }), true);
  // a Copy first go does not set RECALL in a fold either
  let big = mk(['night']).d;
  for (let i = 0; i < 700; i += 1) big = T(big, { word: 'night', day: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'), r: 1, j: 'f', ss: 'cccccc', now: 100 + i, tries: 1 });
  const t = W.trim(big, 9e12);
  assert.ok(Object.keys(t.folded).length > 0);
  assert.equal(W.isRemembered(t, 'night'), false);
});

// ---- C-a: the top slot ---------------------------------------------------------------------------------------------------------
test('C-a: the top fold slot (the whole word) and a high partial rung, without 32-bit wrap', () => {
  const { d } = mk(['night']);
  const one = (r) => T(d, { word: 'night', day: '2026-11-20', r, j: 'f', ss: 'topbit', lv: r === ALL ? undefined : 3 });
  for (const r of [1, 2, 14, 20, 30]) assert.equal(W.ladderFacts(one(r), 'night', DAY).best, Math.min(r, 14));
  assert.equal(W.ladderFacts(one(ALL), 'night', DAY).best, ALL);
  // the same through a fold
  let big = one(ALL);
  for (let i = 0; i < 700; i += 1) big = T(big, { word: 'light', day: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'), r: 3, j: 'f', ss: 'topbit', now: 9e6 + i, tries: 1 });
  const t = W.trim(big, 9e12);
  const day = t.folded['g1|night'].days['2026-11-20'];
  assert.ok(day > 0 && day < 2 ** 31, 'a positive 31-bit flag');
  assert.equal(day & (0x7fff << 16), 0x7fff << 16, 'every slot is set');
  assert.equal(W.ladderFacts(t, 'night', DAY).best, ALL);
});

// ---- D25: set a stuck word aside for a day ------------------------------------------------------------------------
test('D25: setAside / isSetAside: one day, newest at wins in merge, brought back with day \'\'', () => {
  const { d } = mk();
  const a = W.setAside(d, 'g1', 'Night', DAY, 5000);
  assert.deepEqual(a.aside, { 'g1|night': { day: DAY, at: 5000 } });
  assert.equal(W.isSetAside(a, 'g1', 'night', DAY), true);
  assert.equal(W.isSetAside(a, 'g1', 'NIGHT', DAY), true, 'in lower case');
  assert.equal(W.isSetAside(a, 'g1', 'night', W.addDays(DAY, 1)), false, 'only for that day');
  assert.equal(W.isSetAside(a, 'g1', 'light', DAY), false);
  assert.equal(W.isSetAside(d, 'g1', 'night', DAY), false);
  assert.equal(W.setAside(a, 'g1', 'night', W.addDays(DAY, 1), 4000).aside['g1|night'].at, 5001, 'at always goes up');
  for (const bad of [['', 'night', DAY], ['g1', '', DAY], ['g1', 'night', '24/11'], ['g|1', 'night', DAY], ['g1', 'ni|ght', DAY]]) assert.equal(W.setAside(d, ...bad, 1), d, JSON.stringify(bad));
  // normalise keeps it; bad entries go
  assert.deepEqual(W.normalise(JSON.parse(JSON.stringify(a))).aside, a.aside);
  assert.ok(!('aside' in W.normalise({ ...d, aside: { 'g1|night': { day: 'x', at: 1 }, nobar: { day: DAY, at: 1 }, 'g1|a': { day: DAY } } })));
  // merge: newest at wins, whichever side; both words kept
  const back = W.setAside(a, 'g1', 'night', '', 6000);
  assert.equal(W.isSetAside(W.merge(a, back), 'g1', 'night', DAY), false, 'brought back wins by time');
  assert.equal(W.isSetAside(W.merge(back, a), 'g1', 'night', DAY), false);
  const other = W.setAside(d, 'g1', 'light', DAY, 5500);
  const m = W.merge(a, other);
  assert.deepEqual(Object.keys(m.aside).sort(), ['g1|light', 'g1|night']);
  assert.deepEqual(W.merge(a, other), W.merge(other, a));
  // a later reset drops it with the other progress
  assert.ok(!('aside' in W.reset(9000, a)));
});
test('D25: a set-aside mark is trimmed once its day has passed (even under the size limit); a brought-back mark after three days', () => {
  const { d } = mk();
  const noon = (day) => Date.parse(day + 'T12:00:00');
  let a = W.setAside(W.setAside(d, 'g1', 'night', '2026-11-24', noon('2026-11-24')), 'g1', 'light', '2026-11-25', noon('2026-11-24'));
  assert.deepEqual(Object.keys(W.trim(a, noon('2026-11-24')).aside), ['g1|night', 'g1|light'], 'same day: kept');
  assert.deepEqual(Object.keys(W.trim(a, noon('2026-11-25')).aside), ['g1|light'], 'the next day: the first has passed');
  assert.ok(!('aside' in W.trim(a, noon('2026-11-26'))));
  assert.equal(W.trim(d, noon('2026-11-26')), d, 'nothing to trim: the same value');
  a = W.setAside(a, 'g1', 'night', '', noon('2026-11-24') + 1);
  assert.ok('g1|night' in W.trim(a, noon('2026-11-26')).aside, 'a brought-back mark stays for a while, so it still wins a merge');
  assert.ok(!('aside' in W.trim(a, noon('2026-12-05'))));
  // setAside itself sweeps spent entries
  const swept = W.setAside(W.setAside(d, 'g1', 'night', '2026-11-20', noon('2026-11-20')), 'g1', 'light', '2026-11-25', noon('2026-11-25'));
  assert.deepEqual(Object.keys(swept.aside), ['g1|light']);
});
test('D25: only grown-up code writes it: setAside is called from grownups-data.js alone', () => {
  const dir = new URL('../site/js/', import.meta.url);
  const users = readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'words-doc.js').filter((f) => /\b(?!ctx\b)\w+\.setAside\(/.test(readFileSync(new URL(f, dir), 'utf8')));
  assert.deepEqual(users, ['grownups-data.js']);
});
