// SB6 WP-1b: U-sbs-week (TR-30, TR-30a, TR-31; D9, D14, D18-D21). The week in Step by step.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import * as Su from '../site/js/setup-doc.js';
import { RULES } from '../site/js/sbs-rules.js';
import { CODE } from '../site/js/ladder-doc.js';
import * as K from '../site/js/sbs-week-doc.js';

const START = '2026-11-24';
const mk = (words = ['night', 'light', 'fight'], testDay = '2026-11-30') => {
  const d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'x', test: testDay, words, today: START, now: 1000 }).doc;
  return { d, g: W.groupById(d, 'g1') };
};
const mark = (d, g, step, day = START) => W.markStep(d, g, step, day, 9);
let n = 0;
const T = (d, o) => { n += 1; return W.addTry(d, { id: 'k' + String(n).padStart(5, '0'), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, day: START, now: 5000 + n, source: 'g', ...o }); };
const done = (d, g, steps, day = START) => steps.reduce((x, s) => mark(x, g, s, day), d);
const SBS = { way: { m: 'sbs', at: 1 } };

// ---- the estimate (TR-30a, recomputed for D18-D24: no skip factor, no focus, no parking; "at least") ----------------
const EXAMPLE = Array(10).fill('garden'); // 10 words of 6 letters
test('estimate: the worked example, N = 10, all words 6 letters, Year 4, m = 10, D = 6 -> Meet 80, ladder 20, rows 120 (D27: no size 9), 14 sittings (4+2+5+1+2), 3 a day', () => {
  const e = K.estimate(EXAMPLE, { minutes: 10, today: START, test: '2026-11-30', year: 4 });
  assert.deepEqual(e.parts, { meet: 80, ladder: 20, rows: 120 });
  assert.deepEqual(e.stones, { meet: 4, ladder: 2, rows: 5, meanings: 1, sentences: 2 });
  assert.deepEqual([e.tries, e.sittings, e.days, e.perDay, e.calm], [220, 14, 6, 3, false]);
  assert.equal(e.line, 'At least about 14 sittings of 10 minutes before the test: about 3 a day.');
  const f = K.estimate(EXAMPLE, { minutes: 15, today: START, test: '2026-11-30', year: 4 });
  assert.deepEqual(f.stones, { meet: 3, ladder: 2, rows: 4, meanings: 1, sentences: 2 });
  assert.deepEqual([f.sittings, f.perDay], [12, 2]);
  assert.equal(f.line, 'At least about 12 sittings of 15 minutes before the test: about 2 a day.');
});

test('estimate: an independent recomputation, stone by stone with the word caps, for N = 1..10, years, 5/10/15 minutes and D = 1..14', () => {
  const words = ['a', 'it', 'cat', 'night', 'friend', 'because', 'beautiful', 'accommodate', 'knee', 'Monday'];
  const letters = (w) => [...w].filter((c) => c === c.toLowerCase()).length;
  for (let N = 1; N <= 10; N += 1) {
    const ws = words.slice(0, N);
    for (const year of [1, 4, undefined]) {
      for (const m of [5, 10, 15]) {
        for (let D = 1; D <= 14; D += 1) {
          const e = K.estimate(ws, { minutes: m, today: START, test: W.addDays(START, D), year });
          const cap = year === 1 ? 3 : year === 4 ? 4 : 3;
          const sec = (t) => Math.ceil((t * 25) / (60 * m));
          const meetT = ws.reduce((a, w) => a + letters(w) + 1, 0) + N;
          // D27: a size is a round only when some group has that size (k of N: r = N % k, q = floor(N / k); with r = 1 the last group is k - 1 or 3, so q must be 2 or more)
          const sizes = Array.from({ length: Math.max(N - 1, 0) }, (_, i) => i + 2).filter((k) => k === N || (Math.floor(N / k) >= (N % k === 1 ? 2 : 1)));
          const low = sizes.filter((k) => k < 5).length;
          const high = sizes.length - low;
          const rowT = low * 2 * N + (high ? Math.ceil(1.2 * N * high - 1e-9) : 0);
          const kind = D <= 2 ? 'quick' : D <= 4 ? 'short' : 'full';
          const S = Math.max(sec(meetT), Math.ceil(N / cap)) + Math.max(sec(2 * N), Math.ceil(N / 5)) + sec(rowT) + 1 + Math.ceil({ quick: 1, short: 2, full: 3 }[kind] / 2);
          assert.equal(e.tries, meetT + 2 * N + rowT, `N${N} m${m} D${D}`);
          assert.equal(e.sittings, S, `N${N} y${year} m${m} D${D}`);
          assert.equal(e.perDay, Math.ceil(S / D));
          assert.equal(e.calm, e.perDay > RULES.est.calmLineAbovePerDay);
          assert.match(e.line, /^At least about /);
        }
      }
    }
  }
});

test('estimate from the data: only the work still to do; nothing left gives no line; after the date it does not say "before the test"', () => {
  const { d, g } = mk(['night', 'light', 'fight'], '2026-11-30');
  const full = K.estimateFor(d, g, START, {}, { year: 4 });
  assert.equal(full.sittings, K.estimate(g.words, { today: START, test: '2026-11-30', year: 4 }).sittings, 'nothing done: the whole week');
  const some = done(d, g, ['hello', 'fix', 'games'], START);
  const e = K.estimateFor(some, g, '2026-11-27', {}, { year: 4 });
  assert.deepEqual(K.remaining(some, g, '2026-11-27').sizes, [3], 'D27: 3 words have the one size 3');
  assert.equal(e.stones.meet + e.stones.ladder + e.stones.meanings, 0);
  assert.ok(e.sittings < full.sittings);
  const none = done(some, g, ['story', 'practice'], START);
  assert.equal(K.estimateFor(none, g, '2026-11-27', {}, { year: 4 }).line, '');
  const late = K.estimateFor(d, g, '2026-12-02', {}, { year: 4 });
  assert.match(late.line, /^About \d+ sittings? left before the test can open\.$/);
  assert.ok(!/a day|minutes/.test(late.line));
  assert.equal(late.calm, false);
});

test('estimate: every word climbs every rung: a longer word costs a rung more, and nothing is shortened (no skip, no focus)', () => {
  const short = K.estimate(['cat', 'dog', 'sun'], { today: START, test: '2026-11-30' });
  const long = K.estimate(['beautiful', 'dog', 'sun'], { today: START, test: '2026-11-30' });
  assert.equal(long.parts.meet - short.parts.meet, 9 - 3, 'one try per letter more');
  assert.equal(K.estimate(['cat'], { today: START, test: '2026-11-30' }).parts.meet, 4 + 1, 'Copy, 1, 2 missing, the whole word, plus the check');
  assert.equal(K.estimate(['cat'], { today: START, test: '2026-11-30' }).parts.rows, 0, 'one word: no rows');
  assert.equal(RULES.est.skipFactor, undefined);
  assert.equal(RULES.rungs.nonFocus, undefined);
  // the options object has no focus: an extra `focus` changes nothing
  assert.deepEqual(K.estimate(EXAMPLE, { today: START, test: '2026-11-30', focus: ['garden'] }), K.estimate(EXAMPLE, { today: START, test: '2026-11-30' }));
});

test('estimate: more than 3 a day adds the calm line, never alarming; entries and strings both work; test today counts as one day', () => {
  const e = K.estimate(EXAMPLE, { minutes: 5, today: START, test: W.addDays(START, 2) });
  assert.ok(e.calm);
  assert.match(e.line, /That is a lot for this week\. You could give it more days\.$/);
  assert.ok(!/!|red|warning|urgent|%/.test(e.line));
  assert.equal(K.estimate(EXAMPLE.map((w) => ({ word: w, chunks: [w] })), { today: START, test: W.addDays(START, 2), minutes: 5 }).line, e.line);
  assert.equal(K.estimate(EXAMPLE, { today: START, test: START }).days, 1);
  assert.equal(K.estimate(['cat'], { minutes: 15, today: START, test: '2026-12-10' }).line.startsWith('At least about 1 sitting of 15'), false, 'one word still has Meanings and Sentences');
  assert.equal(K.estimate(EXAMPLE, { minutes: 7, today: START, test: '2026-11-30' }).line.includes('10 minutes'), true, 'a bad length falls back to the default');
});

// ---- the week (D9) ------------------------------------------------------------------------------------------------
test('weekState: several stones in one day, in order: a stone done for today\'s share or not yet on its date is offered at once (early)', () => {
  let { d, g } = mk();
  const s0 = K.weekState(d, g, START);
  assert.deepEqual([s0.status, s0.job, s0.early], ['job', 'hello', false]);
  d = mark(d, g, 'hello');
  const normal = St.studyState(d, g, START);
  assert.notEqual(normal.status, 'job', 'Normal: one a day');
  const s1 = K.weekState(d, g, START);
  assert.deepEqual([s1.status, s1.job, s1.early, s1.share], ['job', 'fix', true, 0]);
  assert.equal(s1.steps.find((x) => x.id === 'fix').state, 'today');
  assert.equal(s1.steps.find((x) => x.id === 'hello').state, 'done');
  d = done(d, g, ['fix', 'games']);
  assert.equal(K.weekState(d, g, START).job, 'story');
  d = done(d, g, ['story', 'practice']);
  const all = K.weekState(d, g, START);
  assert.deepEqual([all.status, all.job], ['ready', null], 'the test waits for its date');
  assert.equal(W.jobFor(d, g, START), 'practise');
});

test('weekState: stone order is never skipped, and a stone whose date has passed is simply the job (not early)', () => {
  const { d, g } = mk();
  const later = K.weekState(d, g, '2026-11-27');
  assert.deepEqual([later.job, later.early], ['hello', false]);
  assert.deepEqual(K.weekState(mark(d, g, 'fix'), g, START).job, 'hello', 'fix done by itself does not skip hello');
});

test('weekState: from the test date the catch-up cap (2 a day) is not applied', () => {
  const { d, g } = mk(undefined, '2026-11-26');
  const day = '2026-11-26';
  let x = done(d, g, ['hello', 'fix'], day);
  assert.equal(St.studyState(x, g, day).status, 'done', 'Normal stops at 2 a day');
  const s = K.weekState(x, g, day);
  assert.deepEqual([s.status, s.job, s.catchUp, s.early], ['job', 'games', true, false]);
  x = done(x, g, ['games', 'story'], day);
  assert.equal(K.weekState(x, g, day).job, 'practice');
  assert.equal(W.jobFor(x, g, day), 'practise', 'the words stay on show meanwhile');
  x = mark(x, g, 'practice', day);
  assert.equal(W.jobFor(x, g, day), 'test');
  assert.deepEqual([K.weekState(x, g, day).job], ['test']);
});

test('the test never opens before its date, and W.jobFor / hiddenWords are the same as for a Normal week with the same marks', () => {
  const { d, g } = mk();
  const all = done(d, g, ['hello', 'fix', 'games', 'story', 'practice']);
  for (const day of ['2026-11-24', '2026-11-27', '2026-11-29']) {
    assert.equal(W.jobFor(all, g, day), 'practise');
    assert.equal(St.hiddenWords(all, day).size, 0);
    assert.notEqual(K.weekState(all, g, day).job, 'test');
    assert.equal(K.canOpen(all, g, 'test', day), false);
  }
  assert.equal(W.jobFor(all, g, '2026-11-30'), 'test');
  assert.deepEqual([...St.hiddenWords(all, '2026-11-30')].sort(), ['fight', 'light', 'night']);
  assert.equal(K.canOpen(all, g, 'test', '2026-11-30'), true);
  // tries written by Step by step change none of that: jobFor reads marks and results only
  let x = T(all, { word: 'night', j: 'h', r: 2, ss: 'aaaaaa' });
  x = T(x, { word: 'night', j: 'w', rw: 2, r: CODE.ALL, ss: 'aaaaaa' });
  assert.equal(W.jobFor(x, g, '2026-11-30'), 'test');
  assert.equal(W.jobFor(x, g, '2026-11-27'), 'practise');
});

test('canOpen (D9): a done stone may be revisited before the date; refused while the test is due; allowed after the test; a stone not yet reached stays closed', () => {
  const { d, g } = mk();
  let x = done(d, g, ['hello', 'fix']);
  const day = '2026-11-25';
  assert.equal(K.canOpen(x, g, 'hello', day), true, 'revisit');
  assert.equal(K.canOpen(x, g, 'fix', day), true);
  assert.equal(K.canOpen(x, g, 'games', day), true, 'the job now (early)');
  assert.equal(K.canOpen(x, g, 'story', day), false, 'not before the stones in front of it');
  assert.equal(K.canOpen(x, g, 'practice', day), false);
  // the test is due: no stone opens, whatever its marks say
  x = done(x, g, ['games', 'story', 'practice']);
  for (const s of ['hello', 'fix', 'games', 'story', 'practice']) assert.equal(K.canOpen(x, g, s, '2026-11-30'), false, s + ' while the test is due');
  assert.equal(K.canOpen(x, g, 'mend', '2026-11-30'), false);
  // after the test: earlier stones open again
  let y = x;
  for (const w of g.words) y = T(y, { word: w, kind: 't', day: '2026-11-30', clean: true, now: 9000 });
  assert.equal(W.jobFor(y, g, '2026-12-02'), 'finished');
  for (const s of ['hello', 'fix', 'games', 'story', 'practice']) assert.equal(K.canOpen(y, g, s, '2026-12-02'), true, s + ' after the test');
  // a revisit never re-marks a step: the first mark stays
  const again = W.markStep(x, g, 'hello', '2026-11-29', 77);
  assert.equal(W.stepDay(again, g, 'hello'), START);
});

test('D9: several sittings a day and revisits do not change the job dates or the short-week rule', () => {
  const { d, g } = mk(undefined, '2026-11-26'); // 2 days: a quick week
  const before = JSON.stringify(St.stepDates(g));
  let x = done(d, g, ['hello', 'fix', 'games'], START);
  x = T(x, { word: 'night', j: 'h', r: 3, ss: 'aaaaaa' });
  x = T(x, { word: 'night', j: 'h', r: 4, ss: 'bbbbbb', day: START });
  assert.equal(JSON.stringify(St.stepDates(W.groupById(x, 'g1'))), before);
  assert.equal(St.weekKind(g), 'quick');
  assert.equal(St.storySentences(St.weekKind(g)), 1);
  assert.equal(K.stoneDone(x, g, 'story', START), false);
  const y = W.addNote(x, { id: 'n1', group: 'g1', word: 'night', text: 'The night is dark and quiet.', day: START, now: 3 });
  assert.equal(K.stoneDone(y, g, 'story', START), true, 'a quick week: one sentence');
  // every stone can be done on the one day (D9), and the test still waits for its date
  const all = done(y, g, ['story', 'practice']);
  assert.equal(St.studyState(all, g, START).status, 'ready');
  assert.equal(W.jobFor(all, g, START), 'practise');
  assert.equal(W.jobFor(all, g, '2026-11-26'), 'test');
});

// ---- when a stone is done -----------------------------------------------------------------------------------------
test('Meet the words is done per word: the whole word reached on its own, a clean whole-word try, or a part mark; never passed over (D22)', () => {
  const { d, g } = mk();
  assert.deepEqual(K.wordsLeft(d, g, 'hello', START), ['night', 'light', 'fight']);
  let x = T(d, { word: 'night', j: 'h', r: CODE.ALL, ss: 'aaaaaa' });
  assert.deepEqual(K.wordsLeft(x, g, 'hello', START), ['light', 'fight']);
  x = T(x, { word: 'light', j: 'h', r: CODE.ALL, ss: 'aaaaaa', tries: 1, clean: false });
  assert.ok(K.wordsLeft(x, g, 'hello', START).includes('light'), 'a whole-word try with a slip does not count');
  x = mark(x, g, 'hello:1');
  assert.deepEqual(K.wordsLeft(x, g, 'hello', START), ['fight']);
  assert.equal(K.stoneDone(x, g, 'hello', START), false);
  // D22: no pass-over: a word that parked, slipped or stopped every time is still to do
  let p = x;
  for (const ss of ['bbbbbb', 'cccccc', 'dddddd']) p = T(p, { word: 'fight', j: 'h', r: 2, ss, tries: 2, clean: false });
  assert.deepEqual(K.wordsLeft(p, g, 'hello', START), ['fight']);
  assert.equal(K.stoneDone(p, g, 'hello', START), false);
  assert.equal(K.parkedTwice, undefined, 'nothing passes a word over');
  // best from an earlier day counts (a Normal recall too)
  const old = T(d, { word: 'night', day: '2026-11-20', r: CODE.ALL, j: 'h', ss: 'oooooo', now: 100 });
  assert.ok(!K.wordsLeft(old, g, 'hello', START).includes('night'));
});

test('Letter ladder is done when every word has a clean whole-word go in the ladder, on any day (D9)', () => {
  const { d, g } = mk();
  let x = d;
  for (const w of g.words.slice(0, 2)) x = T(x, { word: w, j: 'f', r: CODE.ALL, ss: 'aaaaaa', day: '2026-11-25' });
  assert.deepEqual(K.wordsLeft(x, g, 'fix', START), ['fight']);
  assert.equal(K.stoneDone(x, g, 'fix', START), false);
  x = T(x, { word: 'fight', j: 'f', r: CODE.ALL, ss: 'bbbbbb', tries: 1, clean: false });
  assert.equal(K.stoneDone(x, g, 'fix', START), false, 'a slip does not count');
  x = mark(x, g, 'fix:2');
  assert.equal(K.stoneDone(x, g, 'fix', START), true, 'a part mark counts when its tries are folded');
  // a meet-stone try at the whole word is not a ladder go
  assert.equal(K.stoneDone(T(d, { word: 'night', j: 'h', r: CODE.ALL }), g, 'fix', START), false);
});

test('Meanings, Sentences, Words in a row, test and Mend: how each is done', () => {
  const { d, g } = mk();
  assert.equal(K.stoneDone(d, g, 'games', START), false);
  assert.equal(K.stoneDone(mark(d, g, 'games:match'), g, 'games', START), true);
  assert.equal(K.stoneDone(mark(d, g, 'games'), g, 'games', START), true, 'the stone mark itself counts');
  assert.equal(K.stoneDone(d, g, 'practice', START), false);
  assert.equal(K.stoneDone(done(d, g, ['rw:2', 'rw:3']), g, 'practice', START), false, 'the rw marks alone are not the stone: only the practice mark the runner writes after every size');
  assert.equal(K.stoneDone(mark(d, g, 'practice'), g, 'practice', START), true);
  assert.equal(K.stoneDone(d, g, 'test', START), false);
  assert.equal(K.stoneDone(d, g, 'zzz', START), false);
  const notes = [1, 2, 3].reduce((x, i) => W.addNote(x, { id: 'n' + i, group: 'g1', word: 'night', text: 'x y z w ' + i, day: START, now: i }), d);
  assert.equal(K.stoneDone(notes, g, 'story', START), true);
  assert.equal(K.stoneDone(notes.notes.length ? { ...notes, notes: notes.notes.slice(0, 2) } : notes, g, 'story', START), false, 'a full week needs 3');
  // Mend: needs the step mark and no fix-ups left
  let x = done(d, g, ['hello', 'fix', 'games', 'story', 'practice']);
  x = T(x, { word: 'night', kind: 't', day: '2026-11-30', clean: false, tries: 1 });
  x = T(x, { word: 'light', kind: 't', day: '2026-11-30' });
  x = T(x, { word: 'fight', kind: 't', day: '2026-11-30' });
  assert.equal(W.jobFor(x, g, '2026-12-01'), 'fixups');
  assert.deepEqual(K.wordsLeft(x, g, 'mend', '2026-12-01'), ['night']);
  assert.equal(K.stoneDone(mark(x, g, 'mend', '2026-12-01'), g, 'mend', '2026-12-01'), false);
});

test('pendingMarks: the part marks, then the stone\'s own mark, once; for rows the rw: marks then practice (never another step)', () => {
  const { d, g } = mk();
  const all = g.words.reduce((x, w) => T(x, { word: w, j: 'h', r: CODE.ALL, ss: 'aaaaaa' }), d);
  assert.deepEqual(K.pendingMarks(all, g, 'hello', START), ['hello:0', 'hello:1', 'hello:2', 'hello']);
  const m = mark(mark(all, g, 'hello:0'), g, 'hello');
  assert.deepEqual(K.pendingMarks(m, g, 'hello', START), ['hello:1', 'hello:2']);
  assert.deepEqual(K.pendingMarks(d, g, 'hello', START), []);
  assert.deepEqual(K.pendingMarks(d, g, 'games', START), []);
  assert.deepEqual(K.pendingMarks(mark(d, g, 'games:match'), g, 'games', START), ['games']);
  // rows: ready words (best whole word) and clean row tries
  let r = g.words.reduce((x, w) => T(x, { word: w, j: 'h', r: CODE.ALL, ss: 'aaaaaa', day: '2026-11-20', now: 100 }), d);
  for (const w of g.words) r = T(r, { word: w, j: 'w', rw: 3, r: CODE.ALL, ss: 'bbbbbb' });
  assert.deepEqual(K.pendingMarks(r, g, 'practice', START), ['rw:3:0', 'rw:3', 'practice']);
});

// ---- which way a stone runs (TR-31) ---------------------------------------------------------------------------------
test('wayFor: a done stone follows today\'s setting; a started stone keeps the way it started; a stone not begun follows the setting', () => {
  const { d, g } = mk();
  assert.equal(K.wayFor(d, g, 'hello', {}), 'usual');
  assert.equal(K.wayFor(d, g, 'hello', SBS), 'sbs');
  // started in Step by step, then the grown-up switches off: it carries on that way
  const s = T(d, { word: 'night', j: 'h', r: 2, ss: 'aaaaaa' });
  assert.equal(K.wayFor(s, g, 'hello', {}), 'sbs');
  assert.equal(K.wayFor(s, g, 'fix', {}), 'usual', 'another stone is not started');
  // started the usual way (Normal part marks), then Step by step is switched on: it carries on the usual way
  const u = mark(d, g, 'hello:0');
  assert.equal(K.wayFor(u, g, 'hello', SBS), 'usual');
  const f = T(d, { word: 'night', kind: 'p', source: 'x' });
  assert.equal(K.wayFor(f, g, 'fix', SBS), 'usual');
  const grid = T(d, { word: 'night', kind: 'p', source: undefined });
  assert.equal(K.wayFor(grid, g, 'practice', SBS), 'usual');
  // done: revisits use the current way
  assert.equal(K.wayFor(mark(s, g, 'hello'), g, 'hello', {}), 'usual');
  assert.equal(K.wayFor(mark(u, g, 'hello'), g, 'hello', SBS), 'sbs');
  // a sentence built in a builder level, the test, and a row try
  const note = W.addNote(d, { id: 'n1', group: 'g1', word: 'night', text: 'The night is dark.', day: START, now: 3, bl: 3 });
  assert.equal(K.wayFor(note, g, 'story', {}), 'sbs');
  assert.equal(K.wayFor(W.addNote(d, { id: 'n2', group: 'g1', word: 'night', text: 'The night is dark.', day: START, now: 3 }), g, 'story', SBS), 'usual');
  assert.equal(K.wayFor(T(d, { word: 'night', j: 'w', rw: 2, r: 5 }), g, 'practice', {}), 'sbs');
  assert.equal(K.wayFor(d, g, 'test', SBS), 'sbs');
  // the setup the child's words carry
  assert.equal(K.wayFor(d, g, 'hello', W.setupOf(W.withSetup(d, Su.setWay({}, 'sbs', 5).setup))), 'sbs');
});

test('STONE_TEXT: the seven names the child sees, short lines, no banned words, same ids as Study mode', () => {
  assert.deepEqual(Object.keys(K.STONE_TEXT), St.STEPS);
  assert.deepEqual(Object.values(K.STONE_TEXT).map((x) => x.title), ['Meet the words', 'Letter ladder', 'Meanings', 'Sentences', 'Words in a row', 'Test day', 'Mend and keep']);
  for (const x of Object.values(K.STONE_TEXT)) {
    assert.ok(x.line.split(/\s+/).length <= RULES.ui.instructionWords, x.line);
    assert.ok(!/\b(wrong|fail\w*|mistake|late|lost|error|special|treat)\b/i.test(x.line + x.title));
  }
});

// ---- M2: the test cannot open without the rows -------------------------------------------------------------------
test('M2: 8 clean Meet tries on a 2-word week must NOT open the test, written per the contract (s: "g"); without it Normal practice would complete', () => {
  const { d, g } = mk(['night', 'light'], '2026-11-25');
  const day = '2026-11-25';
  // the contract: every sbs try carries s: 'g' (S.triesOf gives the fields)
  let ok = d;
  const per = (x, o) => W.addTry(x, { id: 'm' + (n += 1), group: 'g1', kind: 'p', day, now: 9000 + n, ...o });
  for (const w of g.words) for (let i = 0; i < 4; i += 1) ok = per(ok, { word: w, tries: 0, peeks: 0, clean: true, source: 'g', j: 'h', r: 1 + i, ss: 'aaaaaa' });
  assert.equal(W.studyJobDay(ok, g, 'practice'), '');
  assert.equal(W.studyJobDay(ok, g, 'fix'), '');
  assert.equal(K.stoneDone(ok, g, 'practice', day), false);
  assert.equal(W.jobFor(ok, g, day), 'practise', 'the test waits for every row size');
  // a try WITHOUT s is a Normal practice try: three clean in a row complete the round (this is why the contract exists)
  let bad = d;
  for (const w of g.words) for (let i = 0; i < 4; i += 1) bad = per(bad, { word: w, tries: 0, peeks: 0, clean: true, j: 'h', r: 1 + i, ss: 'aaaaaa' });
  assert.notEqual(W.studyJobDay(bad, g, 'practice'), '', 'Normal rounds count a try with no s');
  assert.equal(K.stoneDone(bad, g, 'practice', day), false, 'but Step by step reads only its own practice mark');
  assert.equal(K.stoneDone(bad, g, 'fix', day), false);
});

test('M2: the Mend ladder tries are the one exception (flow f, no s); the rows stone writes the practice mark only', () => {
  const { d, g } = mk();
  const all = pendingRows(d, g);
  assert.ok(all.every((x) => /^rw:\d+(:\d+)?$/.test(x) || x === 'practice'));
});
function pendingRows(d, g) {
  let x = d;
  for (const w of g.words) x = T(x, { word: w, j: 'h', r: CODE.ALL, ss: 'aaaaaa', s: 'g', day: '2026-11-20', now: 100 });
  for (const size of [2, 3]) for (const w of g.words) x = T(x, { word: w, j: 'w', rw: size, r: CODE.ALL, ss: 'bbbbbb', s: 'g' });
  return K.pendingMarks(x, g, 'practice', START);
}
