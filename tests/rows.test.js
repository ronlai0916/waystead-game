// SB6 WP-1b: U-rows (TR-25; D11, D13, D14). Words in a row for Step by step: sizes 2, 3, 4 ... up to all words, progress kept as step marks.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../site/js/words-doc.js';
import { CODE } from '../site/js/ladder-doc.js';
import * as R from '../site/js/rows-doc.js';

const DAY = '2026-11-24';
const WORDS = ['night', 'light', 'fight', 'sight', 'right', 'might', 'tight', 'bright', 'flight', 'plight'];
const mk = (n, id = 'g1') => {
  const d = W.createGroup(W.emptyDoc(), { id, name: 'x', test: '2026-12-01', words: WORDS.slice(0, n), today: DAY, now: 1000 }).doc;
  return { d, g: W.groupById(d, id) };
};
const ALLF = { best: CODE.ALL, bestToday: 0, secure: false, days: ['2026-11-20'], metOn: '2026-11-20' };
const factsFor = (words, f = ALLF) => new Map(words.map((w) => [w, f]));
let n = 0;
const T = (d, o) => { n += 1; return W.addTry(d, { id: 'q' + String(n).padStart(5, '0'), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, day: DAY, now: 5000 + n, source: 'g', j: 'w', ...o }); };
const mark = (d, g, step) => W.markStep(d, g, step, DAY, 9);
const ent = (w) => ({ word: w, chunks: [w] });

test('splitSizes: every n 2..10 and k 2..n adds up, has no group of 1, and matches the TRS examples for n = 10', () => {
  for (let m = 2; m <= 10; m += 1) {
    for (let k = 2; k <= m; k += 1) {
      const s = R.splitSizes(m, k);
      assert.equal(s.reduce((a, b) => a + b, 0), m, `n${m} k${k}`);
      assert.ok(s.every((x) => x >= 2), `n${m} k${k} ${s}`);
      assert.ok(s.every((x) => x <= k + 1), `n${m} k${k} ${s}`);
    }
  }
  const t = (k) => R.splitSizes(10, k);
  assert.deepEqual([t(2), t(3), t(4), t(5), t(6), t(9), t(10)], [[2, 2, 2, 2, 2], [3, 3, 2, 2], [4, 4, 2], [5, 5], [6, 4], [8, 2], [10]]);
  assert.deepEqual(R.splitSizes(3, 2), [3]);
  assert.deepEqual(R.splitSizes(5, 2), [2, 3]);
  assert.deepEqual(R.splitSizes(1, 2), [1], 'one word alone is not a row: rowPlan returns none for it');
});

test('roundSizes: 2 .. N, none below 2 (D11: no year cap, it grows to all the week\'s words)', () => {
  assert.deepEqual(R.roundSizes(1), []);
  assert.deepEqual(R.roundSizes(0), []);
  assert.deepEqual(R.roundSizes(2), [2]);
  assert.deepEqual(R.roundSizes(10), [2, 3, 4, 5, 6, 7, 8, 10], 'D27: no size 9 for 10 words (8 + 2, a group of 1 is never made)');
  assert.deepEqual(R.roundSizes(5), [2, 3, 5], 'D27: 4 of 5 is 3 + 2');
  assert.deepEqual(R.roundSizes(3), [3], 'D27: 2 of 3 is 3 (never 2 + 1)');
  for (let n = 2; n <= 12; n += 1) for (const k of R.roundSizes(n)) assert.ok(R.splitSizes(n, k).includes(k), 'n' + n + ' k' + k);
  assert.equal(R.roundSizes(10).at(-1), 10, 'the whole week is always the last size');
});

test('rowPlan: deterministic, every word once per round, rotated between sizes, never the R0 order', () => {
  const w = WORDS;
  for (let k = 2; k <= 10; k += 1) {
    const a = R.rowPlan(w, k, 'g1|rows');
    assert.deepEqual(a, R.rowPlan(w, k, 'g1|rows'));
    assert.deepEqual(a.flat().sort(), [...w].sort());
    assert.deepEqual(a.map((x) => x.length), R.splitSizes(10, k));
  }
  assert.notDeepEqual(R.rowPlan(w, 2, 'g1|rows').flat(), R.rowPlan(w, 3, 'g1|rows').flat(), 'rotated by size');
  assert.notDeepEqual(R.rowPlan(w, 2, 'g1|rows').flat(), R.rowPlan(w, 2, 'other').flat(), 'another week, another order');
  const order = R.rowPlan(w, 4, 's').flat();
  assert.notDeepEqual(R.rowPlan(w, 4, 's', { avoid: order }).flat(), order, 'not the order met in R0');
  assert.deepEqual(R.rowPlan(['a'], 2, 's'), []);
  assert.deepEqual(R.rowPlan([], 2, 's'), []);
  assert.deepEqual(R.rowPlan(['x', 'y', 'z'], 5, 's').map((x) => x.length), [3], 'a size above the words: one group of them all');
});

test('rowWords: only words that did the whole word (today counts, "Got it" counts)', () => {
  const { d, g } = mk(4);
  const f = new Map([['night', ALLF], ['light', { best: 3, bestToday: 0 }], ['fight', { best: 0, bestToday: CODE.ALL }], ['sight', { best: 0, secure: true }]]);
  assert.deepEqual(R.rowWords(d, g, f), ['night', 'fight', 'sight']);
  assert.deepEqual(R.rowWords(d, g, (w) => (w === 'night' ? ALLF : null)), ['night']);
  assert.deepEqual(R.rowWords(d, g, {}), []);
});

test('the stone is done from the marks only: every size 2 .. N; a value with every rw try folded still opens the test', () => {
  const { d, g } = mk(4);
  assert.equal(R.stoneDone(d, g), false);
  let x = d;
  for (const k of [2, 3]) { x = mark(x, g, 'rw:' + k); assert.equal(R.stoneDone(x, g), false); }
  x = mark(x, g, 'rw:4');
  assert.equal(R.stoneDone(x, g), true);
  assert.equal(R.roundDone(x, g, 3), true);
  assert.equal(R.groupDone(x, g, 3, 0), false);
  // trimmed: no tries at all, still done
  assert.equal(R.stoneDone({ ...x, results: [], folded: {} }, g), true);
  // a try that says it reached a size is not a mark
  const t = T(d, { word: 'night', rw: 2, r: CODE.ALL });
  assert.equal(R.stoneDone(t, g), false);
});

test('every size is needed: no size can be skipped, and the practice mark opens the stone (W.studyJobDay) only from the rows', () => {
  for (const size of [2, 5, 10]) {
    const { d, g } = mk(size);
    let x = d;
    for (const k of R.roundSizes(size).slice(0, -1)) x = mark(x, g, 'rw:' + k);
    assert.equal(R.stoneDone(x, g), false, 'the last size is still to do');
    x = mark(x, g, 'rw:' + size);
    assert.equal(R.stoneDone(x, g), true, 'n' + size);
  }
  const { d, g } = mk(3);
  assert.equal(W.studyJobDay(d, g, 'practice'), '');
  assert.equal(W.studyJobDay(mark(d, g, 'practice'), g, 'practice'), DAY);
});

test('a week of one word has no rows and the stone is done at once', () => {
  const { d, g } = mk(1);
  assert.equal(R.stoneDone(d, g), true);
  assert.equal(R.nextRow(d, g, DAY, factsFor(g.words)), null);
  assert.deepEqual(R.marksToWrite(d, g, DAY, factsFor(g.words)), ['practice']);
  assert.match(R.rowsLine(d, g), /only one word/);
});

test('nextRow: smallest size first, first group without its mark, a round is never mixed with the next', () => {
  const { d, g } = mk(5);
  const f = factsFor(g.words);
  let r = R.nextRow(d, g, DAY, f);
  assert.deepEqual([r.size, r.index, r.of], [2, 0, 2]);
  assert.equal(r.group.length, 2);
  assert.deepEqual(r.left, r.group);
  let x = mark(d, g, 'rw:2:0');
  r = R.nextRow(x, g, DAY, f);
  assert.deepEqual([r.size, r.index], [2, 1]);
  assert.equal(r.group.length, 3, '5 words in pairs: 2 and 3');
  x = mark(mark(x, g, 'rw:2:1'), g, 'rw:2');
  r = R.nextRow(x, g, DAY, f);
  assert.deepEqual([r.size, r.index, r.of], [3, 0, 2]);
  for (const k of [3, 4, 5]) x = mark(x, g, 'rw:' + k);
  assert.equal(R.nextRow(x, g, DAY, f), null);
  // only ready words are in the rows
  const some = new Map(g.words.slice(0, 3).map((w) => [w, ALLF]));
  const rr = R.nextRow(d, g, DAY, some);
  assert.ok(rr.group.every((w) => g.words.slice(0, 3).includes(w)));
});

test('a row group is done when every word reached the whole word cleanly in that row (tries with j w and rw)', () => {
  const { d, g } = mk(4);
  const f = factsFor(g.words);
  const row = R.nextRow(d, g, DAY, f);
  const [a, b] = row.group;
  let x = T(d, { word: a, rw: 2, r: CODE.ALL, ss: 'aaaaaa' });
  assert.equal(R.groupStatus(x, g, 2, 0, row.group).done, false);
  assert.deepEqual(R.groupStatus(x, g, 2, 0, row.group).left, [b]);
  x = T(x, { word: b, rw: 2, r: CODE.ALL, ss: 'aaaaaa' });
  assert.equal(R.groupStatus(x, g, 2, 0, row.group).done, true);
  assert.equal(R.nextRow(x, g, DAY, f).index, 1, 'a finished group is skipped even before the runner writes its mark');
  assert.deepEqual(R.marksToWrite(x, g, DAY, f), ['rw:2:0']);
  // a slip does not count
  const y = T(d, { word: a, rw: 2, r: CODE.ALL, ss: 'aaaaaa', tries: 1, clean: false });
  assert.deepEqual(R.groupStatus(y, g, 2, 0, row.group).left, row.group);
});

test('D22: no pass-over and no parking: a group stays until every word has reached the whole word cleanly in that row, however many sittings it takes', () => {
  const { d, g } = mk(4);
  const f = factsFor(g.words);
  const row = R.nextRow(d, g, DAY, f);
  const [a, b] = row.group;
  let x = T(d, { word: a, rw: 2, r: CODE.ALL, ss: 'aaaaaa' });
  for (const ss of ['aaaaaa', 'bbbbbb', 'cccccc', 'dddddd']) {
    x = W.markStep(x, g, 'se:' + ss, DAY, 9); // every sitting ended normally
    x = T(x, { word: b, rw: 2, r: CODE.ALL, ss, tries: 2, clean: false }); // the whole word, never clean
  }
  assert.equal(R.passedOver, undefined, 'no pass-over');
  const st = R.groupStatus(x, g, 2, 0, row.group);
  assert.deepEqual([st.done, st.left], [false, [b]]);
  assert.deepEqual(R.nextRow(x, g, DAY, f).left, [b], 'the same group is still next');
  assert.deepEqual(R.marksToWrite(x, g, DAY, f), []);
  assert.equal(R.stoneDone(x, g), false);
  // the checker\'s probe: one clean Check a rung below the whole word, in each of two sittings, is not a way round
  let y = d;
  for (const ss of ['aaaaaa', 'bbbbbb']) for (const w of g.words) y = T(W.markStep(y, g, 'se:' + ss, DAY, 9), { word: w, rw: 2, r: 3, ss });
  for (const w of g.words) y = T(y, { word: w, rw: 3, r: 4, ss: 'cccccc' });
  assert.deepEqual(R.marksToWrite(y, g, DAY, f), []);
  assert.equal(R.stoneDone(y, g), false);
  // one clean whole word finishes it
  const z = T(x, { word: b, rw: 2, r: CODE.ALL, ss: 'eeeeee' });
  assert.equal(R.groupStatus(z, g, 2, 0, row.group).done, true);
  assert.equal(R.reachedInRow(z, g, 3, b), null);
});

test('D22: a word left in a row comes back at its exact step: after a clean try the next rung, after a slip the same rung; a finished word does not', () => {
  const { d, g } = mk(4);
  const e = ent('night');
  const rungs = [0, 1, 2, 3, 4, 5, CODE.ALL]; // night: 5 letters
  assert.equal(R.resumeCode(3, true, e), 4);
  assert.equal(R.resumeCode(3, false, e), 3);
  assert.equal(R.resumeCode(CODE.ALL, true, e), 0);
  assert.equal(R.resumeCode(CODE.ALL, false, e), CODE.ALL);
  assert.equal(R.resumeCode(0, true, e), 0);
  assert.equal(R.resumeCode(99, false, e), 0, 'a code that is not a rung of the word');
  assert.deepEqual(rungs.slice(-2), [5, CODE.ALL]);
  const f = factsFor(g.words);
  let x = T(d, { word: 'night', rw: 2, r: 3, ss: 'aaaaaa' });
  assert.equal(R.rowResume(x, g, 2, 'night', e), 4);
  assert.equal(R.rowStart(x, g, 2, 'night', f, e), 4);
  x = T(x, { word: 'night', rw: 2, r: 4, ss: 'aaaaaa', tries: 1, clean: false });
  assert.equal(R.rowStart(x, g, 2, 'night', f, e), 4);
  x = T(x, { word: 'night', rw: 2, r: CODE.ALL, ss: 'bbbbbb' });
  assert.equal(R.rowResume(x, g, 2, 'night', e), 0);
  assert.equal(R.rowResume(x, g, 3, 'night', e), 0, 'another size has no try');
});

test('start rungs: sizes 2-4 one below the best; from size 5 a word that reached the whole word in the previous round starts there', () => {
  const { d, g } = mk(8); // sizes 2 3 4 5 6 8: size 5 follows size 4
  const w = 'night';
  const e = ent(w);
  const f = factsFor(g.words);
  const below = R.rowStart(d, g, 3, w, f, e);
  assert.ok(below < CODE.ALL && below > CODE.COPY, 'one below the whole word: ' + below);
  assert.equal(R.rowStart(d, g, 4, w, f, e), below);
  assert.equal(R.rowStart(d, g, 5, w, f, e), below, 'no previous-round evidence yet');
  const x = T(d, { word: w, rw: 4, r: CODE.ALL, ss: 'aaaaaa' });
  assert.equal(R.rowStart(x, g, 5, w, f, e), CODE.ALL);
  assert.equal(R.rowStart(x, g, 4, w, f, e), below, 'not before size 5');
  const slip = T(d, { word: w, rw: 4, r: CODE.ALL, ss: 'aaaaaa', tries: 1, clean: false });
  assert.equal(R.rowStart(slip, g, 5, w, f, e), below);
  // folded away but the round has its mark: it reached it
  assert.equal(R.rowStart(mark(d, g, 'rw:4'), g, 5, w, f, e), CODE.ALL);
  // a word that is Got it starts at the whole word
  assert.equal(R.rowStart(d, g, 2, w, factsFor(g.words, { ...ALLF, secure: true }), e), CODE.ALL);
  // a word with no facts: Copy
  assert.equal(R.rowStart(d, g, 2, w, new Map(), e), CODE.COPY);
});

test('rowStart (D27): the previous round is the size before this one in roundSizes, not size - 1', () => {
  const w = 'night';
  const e = ent(w);
  // 10 words: no size 9, so size 10 follows size 8
  const t = mk(10);
  const f10 = factsFor(t.g.words);
  const below = R.rowStart(t.d, t.g, 10, w, f10, e);
  assert.ok(below < CODE.ALL, 'no evidence: one below');
  const x = T(t.d, { word: w, rw: 8, r: CODE.ALL, ss: 'aaaaaa' });
  assert.equal(R.rowStart(x, t.g, 10, w, f10, e), CODE.ALL, 'reached at size 8: size 10 starts at the whole word');
  assert.equal(R.rowStart(mark(t.d, t.g, 'rw:8'), t.g, 10, w, f10, e), CODE.ALL, 'folded away, round marked');
  const slip = T(t.d, { word: w, rw: 8, r: CODE.ALL, ss: 'aaaaaa', tries: 1, clean: false });
  assert.equal(R.rowStart(slip, t.g, 10, w, f10, e), below, 'not clean at size 8');
  // 5 words: sizes 2 3 5
  const u = mk(5);
  const f5 = factsFor(u.g.words);
  const b5 = R.rowStart(u.d, u.g, 5, w, f5, e);
  assert.ok(b5 < CODE.ALL);
  const y = T(u.d, { word: w, rw: 3, r: CODE.ALL, ss: 'aaaaaa' });
  assert.equal(R.rowStart(y, u.g, 5, w, f5, e), CODE.ALL, 'reached at size 3: size 5 starts at the whole word');
  assert.equal(R.rowStart(mark(u.d, u.g, 'rw:3'), u.g, 5, w, f5, e), CODE.ALL);
  // the first size has no previous round
  assert.equal(R.rowStart(y, u.g, 3, w, f5, e) < CODE.ALL, true, 'size 3 is below 5: one below the best');
});

test('marksToWrite: group marks, then the round, size by size, then practice; nothing twice', () => {
  const { d, g } = mk(3);
  const f = factsFor(g.words);
  const clean3 = (x, size, words) => words.reduce((acc, w) => T(acc, { word: w, rw: size, r: CODE.ALL, ss: 'aaaaaa' }), x);
  assert.deepEqual(R.marksToWrite(d, g, DAY, f), []);
  // D27: size 2 with 3 words would be one group of 3, so it is not a size: 3 words have the one size 3
  let x = clean3(d, 2, g.words);
  assert.deepEqual(R.marksToWrite(x, g, DAY, f), [], 'tries of a skipped size are not marks');
  x = clean3(x, 3, g.words);
  assert.deepEqual(R.marksToWrite(x, g, DAY, f), ['rw:3:0', 'rw:3', 'practice']);
  x = mark(mark(mark(x, g, 'rw:3:0'), g, 'rw:3'), g, 'practice');
  assert.deepEqual(R.marksToWrite(x, g, DAY, f), []);
  // the rows stone writes the practice mark only: no other W step is ever named
  assert.ok(R.marksToWrite(clean3(d, 3, g.words), g, DAY, f).every((s) => /^rw:\d+(:\d+)?$/.test(s) || s === 'practice'));
  // 4 words: 3 of 4 is 2 + 2 (no group of 3), so the sizes are 2 and 4
  const four = mk(4);
  assert.deepEqual(R.roundSizes(4), [2, 4]);
  let y = clean3(four.d, 2, four.g.words);
  assert.deepEqual(R.marksToWrite(y, four.g, DAY, factsFor(four.g.words)), ['rw:2:0', 'rw:2:1', 'rw:2']);
});

test('rows facts that are not ready yet: a round with fewer than two ready words has nothing to do and is marked done', () => {
  const { d, g } = mk(3);
  const one = new Map([['night', ALLF]]);
  assert.equal(R.nextRow(d, g, DAY, one), null);
  assert.deepEqual(R.marksToWrite(d, g, DAY, one), ['rw:3', 'practice']);
});

test('D9: other stones and earlier days do not move the rows: only marks and the same week\'s row tries count', () => {
  const { d, g } = mk(3);
  const f = factsFor(g.words);
  const before = R.nextRow(d, g, DAY, f);
  let x = T(d, { word: 'night', j: 'h', r: 5, ss: 'zzzzzz' });
  x = T(x, { word: 'light', j: 'f', r: CODE.ALL, ss: 'zzzzzz' });
  x = T(x, { word: 'night', j: 'w', rw: 3, r: CODE.ALL, ss: 'yyyyyy', group: 'other' });
  assert.deepEqual(R.nextRow(x, g, DAY, f), before);
});

test('rowsLine: grown-up wording, up to the first size still to do', () => {
  const { d, g } = mk(5);
  assert.equal(R.rowsLine(d, g), 'Pairs to do. Then up to fives.');
  let x = mark(d, g, 'rw:2');
  assert.equal(R.rowsLine(x, g), 'Pairs done. Threes to do. Then up to fives.');
  x = mark(x, g, 'rw:3');
  assert.equal(R.rowsLine(x, g), 'Pairs done. Threes done. Fives to do.', 'D27: no Fours for 5 words (3 + 2)');
  assert.equal(R.rowsLine(mark(x, g, 'rw:5'), g), 'Pairs done. Threes done. Fives done.');
  const t = mk(10);
  const y = ['2', '3', '4', '5', '6', '7', '8'].reduce((a, k) => mark(a, t.g, 'rw:' + k), t.d);
  assert.equal(R.rowsLine(y, t.g), 'Pairs done. Threes done. Fours done. Fives done. Sixes done. Sevens done. Eights done. Tens to do.', 'D27: no Nines line');
  assert.equal(R.stoneDone(mark(y, t.g, 'rw:10'), t.g), true, 'the stone opens with no Nines mark');
});

test('rows are for Step by step only (D13): no Normal code names a rw mark; this module makes no new k or s', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../site/js/rows-doc.js', import.meta.url), 'utf8');
  assert.ok(!/kind:\s*'/.test(src) && !/source:\s*'/.test(src));
  for (const f of ['words-views.js', 'study-views.js', 'games-views.js', 'play.js']) {
    assert.ok(!/rw:/.test(readFileSync(new URL('../site/js/' + f, import.meta.url), 'utf8')), f);
  }
});

test('S3: nextRow and marksToWrite give the same groups even when the plan would follow the order the words were met in (avoid comes from the data)', () => {
  const { d, g } = mk(4);
  const f = factsFor(g.words);
  const plain = R.rowPlan(g.words, 2, 'g1|rows').flat(); // what the plan would be with no avoid
  let x = d;
  plain.forEach((w, i) => { x = T(x, { word: w, j: 'h', r: 2, ss: 'zzzzzz', now: 10 + i }); });
  const row = R.nextRow(x, g, DAY, f);
  assert.notDeepEqual(R.rowPlan(g.words, 2, 'g1|rows').flat(), R.rowPlan(g.words, 2, 'g1|rows', { avoid: plain }).flat());
  for (const w of row.group) x = T(x, { word: w, rw: 2, r: CODE.ALL, ss: 'aaaaaa' });
  assert.deepEqual(R.marksToWrite(x, g, DAY, f), ['rw:2:0']);
  assert.notDeepEqual(row.group, R.rowPlan(g.words, 2, 'g1|rows')[0], 'the order met in R0 was avoided');
});
