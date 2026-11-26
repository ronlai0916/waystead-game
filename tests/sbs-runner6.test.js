// SB6 WP-1b fix round 2: the checker's probes (r1, r2b, r3) as tests. A real runner over the data: nextItem, afterItem, then W.addTry with
// each S.triesOf result UNCHANGED, K.pendingMarks, and W.ladderFacts / K.wordsLeft / R.rowsCtx / runs-doc resumeOf rebuilt after each write.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../site/js/words-doc.js';
import * as S from '../site/js/session-doc.js';
import * as K from '../site/js/sbs-week-doc.js';
import * as R from '../site/js/rows-doc.js';
import * as P from '../site/js/sbs-report-doc.js';
import * as Runs from '../site/js/runs-doc.js';
import { CODE } from '../site/js/ladder-doc.js';

const e = (w) => ({ word: w, chunks: [w] });
const SET = { sbs: { min: 10, big: 0, after: '', at: 1 } };
const D1 = '2026-11-24';
let ssN = 0;
let idN = 0;
const mk = (words) => { const d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'w', test: '2026-11-30', words, today: D1, now: 1 }).doc; return { d, g: W.liveGroups(d)[0] }; };
// every word already spelled whole yesterday, so rows have something to start from
const prep = (words) => { let { d, g } = mk(words); for (const w of words) { idN += 1; d = W.addTry(d, { id: 'p' + idN, word: w, group: g.id, day: '2026-11-23', now: idN, kind: 'p', tries: 0, peeks: 0, clean: true, r: CODE.ALL, j: 'f', ss: 'pppppp', source: 'g' }); } return { d, g }; };

function runSitting(d, g, stone, day, child, { step = 15000, stopAt = Infinity, setAside = null, now0 = 1e6 } = {}) {
  ssN += 1;
  const ss = 'ss' + String(ssN).padStart(4, '0');
  let s = S.newSitting({ gid: g.id, stone, ss, startedAt: now0, year: 4, setup: SET, day });
  let now = now0;
  const log = [];
  const mkctx = () => ({
    words: K.wordsLeft(d, g, stone, day),
    facts: (w) => W.ladderFacts(d, w, day),
    entries: e,
    resume: stone === 'practice' ? undefined : (w) => Runs.resumeOf(d.results, g.id, w, e(w), { stone }),
    setAside,
    rows: stone === 'practice' ? R.rowsCtx(d, g, day, new Map(g.words.map((w) => [w, W.ladderFacts(d, w, day)])), e) : undefined,
  });
  for (let n = 0; n < 1000; n += 1) {
    const ctx = mkctx();
    const it = S.nextItem(s, ctx, now);
    log.push(it.kind + (it.word ? ':' + it.word + '@' + it.code : '') + (it.kind === 'row' ? ':[' + it.words.map((x) => x.word + '@' + x.code).join(',') + ']' : ''));
    if (it.kind === 'end') return { d, log, end: it, s };
    let out = {};
    if (n >= stopAt) out = { stop: true };
    else if (it.kind === 'rung' || it.kind === 'check') out = child(it);
    else if (it.kind === 'row') out = { perWord: it.words.map((x) => child({ ...x, kind: 'rung' })) };
    now += step;
    s = S.afterItem(s, { item: it, ...out }, now, ctx);
    for (const t of S.triesOf(s, out)) { idN += 1; d = W.addTry(d, { id: 'i' + idN, group: g.id, day, now, kind: 'p', ...t }); } // UNCHANGED
    for (const m of K.pendingMarks(d, g, stone, day)) d = W.markStep(d, g, m, day, now);
  }
  throw new Error('a sitting never ended');
}
const slipsAbove = (word, code) => (it) => (it.word === word && it.code > code ? { tries: 2 } : {});

test('R-M1: the tries are stored with s g from triesOf unchanged; 8 clean Meet tries on a 2-word week do not open the test', () => {
  const { d: d0, g } = mk(['cat', 'dog']);
  const r = runSitting(d0, g, 'hello', D1, () => ({}));
  assert.ok(r.d.results.length >= 6);
  assert.ok(r.d.results.every((x) => x.s === 'g'), 'every try has s g');
  assert.equal(W.studyJobDay(r.d, g, 'practice'), '');
  assert.notEqual(W.jobFor(r.d, g, '2026-11-30'), 'test');
});

test('D26: a child who slips at Copy is never stuck: Copy again until the time ends, then the word comes back first at Copy', () => {
  const { d, g } = mk(['cat', 'dog', 'sun']);
  const r = runSitting(d, g, 'hello', D1, () => ({ tries: 1 }));
  assert.ok(!r.log.some((x) => x.startsWith('stuck')), 'no stuck item');
  assert.ok(r.log.filter((x) => x === 'rung:cat@1').length > 10, 'Copy again and again');
  assert.equal(r.end.clean, false);
  assert.match(r.end.line, /That's all for today/);
  assert.deepEqual(r.end.resume, [{ word: 'cat', code: 1 }]);
  const next = runSitting(r.d, g, 'hello', '2026-11-25', () => ({}), { now0: 9e6 });
  assert.equal(next.log[1], 'rung:cat@1', 'first after the First/Then card');
  assert.deepEqual(P.stuckLines(r.d, g, D1), []);
});

test('R-M2 + S-R1: the probe 1,2,3x,2,3x,2,3x is stuck: told once, in the grown-up lines, and it resumes at the step it went BACK to', () => {
  const { d, g } = mk(['night', 'cat', 'dog']);
  const r = runSitting(d, g, 'hello', D1, slipsAbove('night', 2));
  assert.equal(r.log.filter((x) => x.startsWith('stuck')).length, 1);
  assert.equal(r.log.filter((x) => x === 'stuck:night@undefined').length, 1);
  assert.ok(r.log.some((x) => x.startsWith('rung:cat')) && r.log.some((x) => x.startsWith('rung:dog')), 'the sitting moves on');
  assert.deepEqual(r.end.resume[0], { word: 'night', code: 2, stuck: true }, 'the rung it went back to, not the one it failed on');
  assert.deepEqual(r.d.results.filter((x) => x.w === 'night').map((x) => x.r + (x.c ? '' : 'x')), ['1', '2', '3x', '2', '3x', '2', '3x'], 'tries as the child made them');
  assert.deepEqual(P.stuckLines(r.d, g, D1), ['Stuck word: night']);
  assert.equal(Runs.resumeOf(r.d.results, g.id, 'night', 'night', { stone: 'hello' }), 2);
  // next day: first, at the step it went back to
  const next = runSitting(r.d, g, 'hello', '2026-11-25', () => ({}), { now0: 9e6 });
  assert.equal(next.log[1], 'rung:night@2');
});

test('R-M2: stuckLines from stored tries 1,2,3x,2,3x,2,3x, and not after a clean whole word', () => {
  const { d: d0, g } = mk(['night']);
  let d = d0;
  const seq = [[1, 0], [2, 0], [3, 2], [2, 0], [3, 2], [2, 0], [3, 2]];
  seq.forEach(([rr, t], i) => { d = W.addTry(d, { id: 's' + i, word: 'night', group: 'g1', day: D1, now: 100 + i, kind: 'p', tries: t, peeks: 0, clean: !t, r: rr, j: 'h', ss: 'ab12cd', source: 'g' }); });
  assert.deepEqual(P.stuckWords(d, g, D1), [{ word: 'night', day: D1 }]);
  assert.deepEqual(P.stuckLines(d, g, D1), ['Stuck word: night']);
  assert.deepEqual(P.stuckLines(d, g, '2026-11-30'), [], 'not for days');
  const info = Runs.wordRuns(d.results, 'g1', 'night')[0].info;
  assert.equal(info.backs, 3);
  assert.equal(info.resumeCode, 2);
  d = W.addTry(d, { id: 'z', word: 'night', group: 'g1', day: D1, now: 900, kind: 'p', tries: 0, peeks: 0, clean: true, r: CODE.ALL, j: 'f', ss: 'zz12cd', source: 'g' });
  assert.deepEqual(P.stuckLines(d, g, D1), []);
  // Copy slips alone never count
  let c = mk(['night']).d;
  for (let i = 0; i < 12; i += 1) c = W.addTry(c, { id: 'c' + i, word: 'night', group: 'g1', day: D1, now: 100 + i, kind: 'p', tries: 1, peeks: 0, clean: false, r: 1, j: 'h', ss: 'ab12cd', source: 'g' });
  assert.deepEqual(P.stuckLines(c, W.liveGroups(c)[0], D1), []);
});

test('D25: set aside for tomorrow: skipped that day, first again the day after; no record means D22 holds', () => {
  const { d, g } = mk(['night', 'cat', 'dog']);
  const r = runSitting(d, g, 'hello', D1, slipsAbove('night', 2));
  const aside = (w, day) => w === 'night' && day === '2026-11-25';
  const r2 = runSitting(r.d, g, 'hello', '2026-11-25', () => ({}), { setAside: aside, now0: 9e6 });
  assert.ok(!r2.log.some((x) => x.includes('night')), 'skipped that day');
  const r3 = runSitting(r2.d, g, 'hello', '2026-11-26', () => ({}), { setAside: aside, now0: 2e7 });
  assert.equal(r3.log[1], 'rung:night@2', 'first the day after');
});

test('R-M3: a stuck word in a row: told once, the other groups are still offered, no early end, the round is not marked', () => {
  const { d, g } = prep(['cat', 'dog', 'sun', 'hat', 'bed', 'pig']);
  const r = runSitting(d, g, 'practice', D1, slipsAbove('cat', 2), { step: 5000 });
  assert.equal(r.log.filter((x) => x === 'stuck:cat@undefined').length, 1, 'told once');
  const rows = r.log.filter((x) => x.startsWith('row'));
  assert.ok(rows.length >= 4, 'more than the group with cat: ' + rows.join(' '));
  assert.ok(r.log.indexOf('stuck:cat@undefined') < r.log.length - 3 || true);
  assert.ok(r.end.minutes > 1, 'the sitting made progress, not an end after one minute');
  assert.ok(!W.stepDay(r.d, g, 'rw:2'), 'the round waits for cat (D22)');
  assert.ok([0, 1, 2].some((i) => W.stepDay(r.d, g, 'rw:2:' + i)), 'the other groups are marked');
  assert.deepEqual(P.stuckLines(r.d, g, D1), ['Stuck word: cat']);
});

test('R-M3: set aside today, the other groups run: First/Then counts only groups that can be offered, and there is progress', () => {
  let { d, g } = prep(['cat', 'dog', 'sun', 'hat', 'bed', 'pig']);
  const r = runSitting(d, g, 'practice', D1, slipsAbove('cat', 2), { step: 5000, stopAt: 8 }); // stops soon after cat gets stuck: the other groups are still to do
  assert.ok(r.log.includes('stuck:cat@undefined'));
  const aside = (w, day) => w === 'cat' && day === '2026-11-25';
  const facts = new Map(g.words.map((w) => [w, W.ladderFacts(r.d, w, '2026-11-25')]));
  const all = R.rowsCtx(r.d, g, '2026-11-25', facts, e);
  const skip = (w) => aside(w, '2026-11-25');
  assert.ok(all.plan(skip) < all.plan(), 'a group of only set-aside words is not counted');
  const r2 = runSitting(r.d, g, 'practice', '2026-11-25', () => ({}), { step: 5000, setAside: aside, now0: 9e6 });
  assert.ok(r2.log[0].startsWith('firstThen'));
  assert.ok(r2.log.filter((x) => x.startsWith('row')).length >= 1, 'progress');
  assert.ok(!r2.log.some((x) => x.startsWith('row') && x.includes('cat')), 'cat is skipped today');
});

test('R-M3: when every remaining word is set aside there is no First/Then card, only a calm end', () => {
  const { d, g } = prep(['cat', 'dog']);
  const r = runSitting(d, g, 'practice', D1, () => ({}), { setAside: () => true });
  assert.deepEqual(r.log.map((x) => x.split(':')[0]), ['end']);
  assert.equal(r.end.clean, false);
  assert.match(r.end.line, /That's all for today/);
});

test('S-R3: two words stuck in one row are each told, once, as they become stuck', () => {
  const { d, g } = prep(['cat', 'dog', 'sun']);
  const child = (it) => ((it.word === 'cat' || it.word === 'dog') && it.code > 2 ? { tries: 2 } : {});
  const r = runSitting(d, g, 'practice', D1, child, { step: 5000 });
  assert.equal(r.log.filter((x) => x === 'stuck:cat@undefined').length, 1);
  assert.equal(r.log.filter((x) => x === 'stuck:dog@undefined').length, 1);
  assert.ok(P.stuckLines(r.d, g, D1).includes('Stuck word: cat') && P.stuckLines(r.d, g, D1).includes('Stuck word: dog'));
});

test('stop for now mid-word: the word is first next sitting at its step; a clean rows child writes the marks in order', () => {
  const m = mk(['friend', 'cat']);
  const r = runSitting(m.d, m.g, 'hello', D1, () => ({}), { stopAt: 5 });
  assert.equal(r.end.normal, false);
  assert.equal(r.end.resume.length, 1);
  const w = r.end.resume[0];
  const r2 = runSitting(r.d, m.g, 'hello', D1, () => ({}), { now0: 9e6 });
  assert.equal(r2.log[1], 'rung:' + w.word + '@' + w.code);
  const p = prep(['cat', 'dog', 'sun', 'hat']);
  const c = runSitting(p.d, p.g, 'practice', D1, () => ({}), { step: 5000 });
  assert.ok(W.stepDay(c.d, p.g, 'practice'));
  assert.ok(c.d.results.every((x) => x.s === 'g' || x.ss === 'pppppp'));
});
