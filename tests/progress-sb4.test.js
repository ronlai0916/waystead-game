// SB4 progress value: explicit `passed`, quiz and exam records, examState.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../site/js/progress-doc.js';

const DAY = 86400000;
const T = Date.parse('2026-11-02T12:00:00Z');
const day = (i) => new Date(T + i * DAY).toISOString().slice(0, 10);
const quiz = (o = {}) => ({ c: 'q:y34-ch03', k: 'q', s: 4, t: 5, d: day(0), miss: ['earth'], ...o });

test('explicit passed: 8 of 11 passes the chapter; old results are unchanged', () => {
  let d = P.recordTest(P.emptyDoc(), 'y34-ch03', 8, 11, T, 'r1', { passed: true, pf: 'sen' });
  assert.equal(d.results[0].passed, true);
  assert.equal(d.results[0].pf, 'sen');
  assert.equal(P.chapterProgress(d, 'y34-ch03').passed, true);
  d = P.recordTest(P.emptyDoc(), 'y34-ch03', 8, 11, T, 'r2');
  assert.equal(d.results[0].passed, false, 'always a boolean');
  assert.equal(P.chapterProgress(d, 'y34-ch03').passed, false);
  assert.equal(P.recordTest(P.emptyDoc(), 'c', 11, 11, T, 'r3').results[0].passed, true);
  assert.equal(P.recordTest(P.emptyDoc(), 'c', 11, 11, T, 'r4', { passed: false }).results[0].passed, false);
  const only = P.recordTest(P.emptyDoc(), 'c', 1, 2, T, 'r5', { zzz: 1, lv: 2, hr: 3, hn: 1 }).results[0];
  assert.deepEqual(Object.keys(only).sort(), ['at', 'c', 'hn', 'hr', 'id', 'lv', 'passed', 's', 't']);
  // an old result with no passed, and one with an imported total, read as before
  const old = P.normalise({ v: 1, resetAt: 0, chapters: {}, results: [{ id: 'a', c: 'x', s: 10, t: 10, at: 5 }, { id: 'b', c: 'y', n: 3, best: 4, passed: false, at: 6 }], folded: {}, tricky: {} });
  assert.equal(P.chapterProgress(old, 'x').passed, true);
  assert.equal(P.chapterProgress(old, 'y').attempts, 3);
  assert.equal(P.chapterProgress(old, 'y').passed, false);
});

test('a quiz or exam record never changes any real chapter', () => {
  let d = P.recordTest(P.emptyDoc(), 'y34-ch03', 5, 10, T, 'r1');
  const before = JSON.stringify(P.chapterProgress(d, 'y34-ch03'));
  d = P.addCheck(d, quiz({ s: 5, t: 5 }), T + 1000, 'q1');
  d = P.addCheck(d, { c: 'e:ex1', k: 'e', s: 9, t: 9, d: day(0) }, T + 2000, 'e1');
  assert.equal(JSON.stringify(P.chapterProgress(d, 'y34-ch03')), before);
  assert.equal(P.chapterProgress(d, 'y34-ch04').attempts, 0);
  assert.equal(P.chapterProgress(d, 'y34-ch04').passed, false);
  const n = P.normalise(JSON.parse(JSON.stringify(d)));
  assert.equal(n.results.length, 3);
  assert.deepEqual(n.results[1], { ...quiz({ s: 5, t: 5 }), id: 'q1', at: T + 1000 });
  const m = P.merge(n, P.addCheck(P.emptyDoc(), quiz(), T + 3000, 'q2'));
  assert.equal(m.results.length, 4);
  assert.equal(P.checksOf(m, 'q:y34-ch03').runs.length, 2);
  assert.equal(P.checksOf(m, 'q:y34-ch03').runs[0].id, 'q2', 'newest first');
  assert.equal(P.anyProgress(P.addCheck(P.emptyDoc(), quiz(), T, 'q9')), true);
});

test('records fold under their own key, and a trim keeps what the rules read', () => {
  let d = P.emptyDoc();
  d = P.recordTest(d, 'y34-ch03', 10, 10, T - 1000, 'real');
  for (let i = 0; i < 700; i += 1) d = P.addCheck(d, quiz({ miss: ['earth', 'heart', 'bread'] }), T + i, 'q' + i);
  d = P.addCheck(d, { c: 'e:ex1', k: 'e', s: 8, t: 10, d: day(0) }, T + 800, 'ex-run');
  assert.ok(P.sizeOf(d) > P.TRIM_AT);
  const t = P.trim(d, T + DAY);
  assert.ok(P.sizeOf(t) <= P.TRIM_TO);
  const c = P.checksOf(t, 'q:y34-ch03');
  assert.ok(c.folded && c.folded.n > 0 && c.folded.through > 0, 'folded under its own c');
  assert.equal(c.runs.length + c.folded.n, 700);
  assert.ok(t.folded['q:y34-ch03']);
  assert.equal(P.chapterProgress(t, 'y34-ch03').passed, true);
  assert.equal(P.chapterProgress(t, 'y34-ch03').attempts, 1);
  assert.equal(P.checksOf(t, 'e:ex1').runs.length, 1, 'the newest survive');
  assert.equal(P.checksOf(P.emptyDoc(), 'e:none').folded, null);
});

test('examState: later, ready, done, reopen, after a fold, after a reset', () => {
  const exam = { date: day(5) };
  let d = P.emptyDoc();
  assert.equal(P.examState(d, 'ex1', exam, day(4)).state, 'later');
  assert.equal(P.examState(d, 'ex1', exam, day(5)).state, 'ready');
  assert.equal(P.examState(d, 'ex1', exam, day(5)).last, null);
  d = P.addCheck(d, { c: 'e:ex1', k: 'e', s: 8, t: 10, d: day(5) }, T + 5 * DAY, 'e1');
  const done = P.examState(d, 'ex1', exam, day(6));
  assert.equal(done.state, 'done');
  assert.equal(done.last.id, 'e1');
  assert.equal(P.examState(d, 'ex1', { ...exam, reopen: T + 6 * DAY }, day(6)).state, 'ready', 'reopened after the run');
  assert.equal(P.examState(d, 'ex1', { ...exam, reopen: T + 4 * DAY }, day(6)).state, 'done', 'reopened before the run');
  d = P.addCheck(d, { c: 'e:ex1', k: 'e', s: 9, t: 10, d: day(7) }, T + 7 * DAY, 'e2');
  assert.equal(P.examState(d, 'ex1', { ...exam, reopen: T + 6 * DAY }, day(7)).state, 'done', 'a run after the reopen');
  assert.equal(P.examState(d, 'ex2', exam, day(7)).state, 'ready', 'another exam');
  // after a fold: the run itself is gone, the fold's time stays
  const f = { ...d, results: [], folded: { 'e:ex1': { n: 2, best: 9, passed: false, through: T + 7 * DAY } } };
  assert.equal(P.examState(f, 'ex1', exam, day(8)).state, 'done');
  assert.equal(P.examState(f, 'ex1', { ...exam, reopen: T + 8 * DAY }, day(8)).state, 'ready');
  // after a reset
  const r = P.reset(T + 9 * DAY);
  assert.equal(P.examState(r, 'ex1', exam, day(10)).state, 'ready');
  const merged = P.merge(d, r);
  assert.equal(P.examState(merged, 'ex1', exam, day(10)).state, 'ready');
  assert.equal(P.checksOf(merged, 'e:ex1').runs.length, 0);
  const foldReset = P.merge({ ...d, results: [], folded: f.folded }, r);
  assert.equal(P.examState(foldReset, 'ex1', exam, day(10)).state, 'ready');
});
