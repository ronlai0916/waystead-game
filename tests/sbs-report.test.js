// SB6 WP-1b: U-report6 (TR-29, BR-30, BR-31). What a grown-up reads: four statuses with facts, no percentages.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../site/js/words-doc.js';
import { CODE } from '../site/js/ladder-doc.js';
import * as P from '../site/js/sbs-report-doc.js';

const DAY = '2026-11-24';
const base = { best: 0, bestToday: 0, allDays: [], secure: false, metOn: '', days: [], peeksTotal: 0, slipsTotal: 0, lastSitting: null, slipSpots: [], usualSpots: [] };
const F = (o) => ({ ...base, ...o });
const GOT = F({ best: CODE.ALL, secure: true, allDays: ['2026-11-24', '2026-11-25'], days: ['2026-11-23'], metOn: '2026-11-23' }); // Tuesday and Wednesday
const ONCE = F({ best: CODE.ALL, allDays: ['2026-11-24'], days: ['2026-11-24'], metOn: '2026-11-24' });
const CLIMB = F({ best: 4, days: ['2026-11-24'], metOn: '2026-11-24', peeksTotal: 3 });
const e = (word, tricky) => ({ word, chunks: [word], ...(tricky ? { tricky } : {}) });

test('the four statuses, from the facts, with the words a grown-up sees', () => {
  assert.deepEqual(P.STATUSES, ['got-it', 'all-once', 'climbing', 'not-started']);
  assert.equal(P.status(GOT), 'got-it');
  assert.equal(P.status(ONCE), 'all-once');
  assert.equal(P.status(CLIMB), 'climbing');
  assert.equal(P.status(base), 'not-started');
  assert.equal(P.status(null), 'not-started');
  // M4 safety net: a word only ever copied (secure from a bad fold bit) is never On its own or Once on its own
  assert.equal(P.status(F({ best: 1, secure: true, allDays: ['2026-11-24', '2026-11-25'], days: ['2026-11-24'] })), 'climbing');
  assert.equal(P.status(F({ best: 14, secure: true, allDays: ['2026-11-24'], days: ['2026-11-24'] })), 'climbing');
  assert.equal(P.status(F({ best: 14, allDays: ['2026-11-24'], days: ['2026-11-24'] })), 'climbing');
  assert.equal(P.status(F({ bestToday: CODE.ALL })), 'all-once', 'today counts');
  assert.equal(P.status(F({ days: ['2026-11-24'] })), 'climbing', 'met with no rung of its own yet');
  assert.equal(P.status(F({ best: 1 })), 'climbing');
  assert.deepEqual(Object.values(P.STATUS_TEXT), ['On its own', 'Once on its own', 'Still climbing', 'Not started']);
});

test('wordLine: the TRS example for On its own, and facts for each status (best rung, Peek count)', () => {
  assert.equal(P.wordLine('Ada', 'night', GOT, { pronoun: 'she' }), 'Night: all letters on her own on Tuesday and Wednesday. On its own.');
  assert.equal(P.wordLine('Ben', 'night', GOT, { pronoun: 'he' }), 'Night: all letters on his own on Tuesday and Wednesday. On its own.');
  assert.equal(P.wordLine('Sam', 'night', GOT), 'Night: all letters on their own on Tuesday and Wednesday. On its own.');
  assert.equal(P.wordLine('Ada', 'night', ONCE, { pronoun: 'she' }), 'Night: all letters on her own once, on Tuesday. One more day like it and it is On its own.');
  assert.equal(P.wordLine('Ada', 'night', CLIMB, { pronoun: 'she' }), 'Night: Ada is up to 3 letters missing on her own. 3 Peeks so far.');
  assert.equal(P.wordLine('Ada', 'night', F({ best: 3, days: ['x'], peeksTotal: 1 }), { pronoun: 'she' }), 'Night: Ada is up to 2 letters missing on her own. 1 Peek so far.');
  assert.equal(P.wordLine('Ada', 'night', F({ best: 2, days: ['x'] })), 'Night: Ada is up to 1 letter missing on their own.');
  assert.equal(P.wordLine('Ada', 'night', F({ best: 1, days: ['x'] })), 'Night: Ada is up to copying the word.');
  assert.equal(P.wordLine('', 'night', F({ best: 4, days: ['x'] })), 'Night: up to 3 letters missing on their own.');
  assert.equal(P.wordLine('Ada', 'night', base), 'Night: not started yet.');
  assert.equal(P.wordLine('Ada', 'night', F({ days: ['x'], metOn: 'x' })), 'Night: Ada has met it.');
  assert.ok(!/Got it/.test(P.wordLine('Ada', 'night', GOT) + P.wordLine('Ada', 'night', ONCE)), 'one term for one status: On its own');
  assert.equal(P.bestText(CODE.ALL), 'the whole word');
});

test('"Slips around \'igh\'": the spelling part where slips come back on two days, with the entry; nothing when there is none', () => {
  const night = e('night', 'igh');
  const f = F({ best: 4, days: ['x'], slipSpots: [1, 2, 4], usualSpots: [2] });
  assert.equal(P.slipLine(night, f), "Slips around 'igh'");
  assert.equal(P.wordLine('Ada', 'night', f, { pronoun: 'she', entry: night }), "Night: Ada is up to 3 letters missing on her own. Slips around 'igh'.");
  assert.equal(P.slipLine(night, F({ usualSpots: [0, 4] })), "Slips around 'n' and 't'");
  assert.equal(P.slipLine(night, F({ usualSpots: [1, 2, 3] })), "Slips around 'igh'", 'one part, said once');
  assert.equal(P.slipLine(night, F({ slipSpots: [2], usualSpots: [] })), '', 'a slip on one day only is not a pattern');
  assert.equal(P.slipLine(null, f), '');
  assert.equal(P.slipLine(night, null), '');
  assert.equal(P.wordLine('Ada', 'night', GOT, { pronoun: 'she', entry: night }), 'Night: all letters on her own on Tuesday and Wednesday. On its own.');
  // the line holds the part, never the child's wrong letter
  assert.ok(!/wrong|typed/i.test(P.slipLine(night, f)));
});

test('no percentage, score, level, age or comparison, in any line, for any facts', () => {
  const lines = [];
  for (const f of [GOT, ONCE, CLIMB, base, F({ best: 1, peeksTotal: 9, slipSpots: [0], usualSpots: [0] }), F({ best: 30, days: ['x'] })]) {
    lines.push(P.wordLine('Ada', 'night', f, { pronoun: 'she', entry: e('night', 'igh') }), ...Object.values(P.STATUS_TEXT));
  }
  for (const s of lines) {
    assert.ok(!/%|percent|score|level|\bage\b|behind|ahead|average|compared|than other|worst|best of/i.test(s), s);
    assert.ok(!/\b(wrong|fail\w*|mistakes?|late|lost|errors?|special)\b/i.test(s), s);
    assert.ok(!/\b\d+\s+(tries|goes|attempts|slips)\b/i.test(s), s);
  }
});

test('tally and tryUsualWay: every word Got it two weeks running (BR-31)', () => {
  assert.deepEqual(P.tally(['got-it', 'climbing', 'got-it', 'bogus']), { 'got-it': 2, 'all-once': 0, climbing: 1, 'not-started': 0 });
  const g = ['got-it', 'got-it'];
  assert.equal(P.tryUsualWay([g, g]), true);
  assert.equal(P.tryUsualWay([['climbing'], g, g]), true, 'the last two weeks');
  assert.equal(P.tryUsualWay([g, ['got-it', 'all-once']]), false);
  assert.equal(P.tryUsualWay([g]), false, 'one week is not two');
  assert.equal(P.tryUsualWay([g, []]), false, 'an empty week is not a week');
  assert.equal(P.tryUsualWay([]), false);
  assert.equal(P.tryUsualWay(undefined), false);
  assert.equal(P.tryUsualWay([[GOT, GOT], [GOT]]), true, 'facts work as well as statuses');
  assert.equal(P.tryUsualWay([[GOT], [ONCE]]), false);
});

// ---- sittings and the test, from the data -----------------------------------------------------------------------------
let n = 0;
const mk = (words = ['night', 'light', 'fight']) => {
  const d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'x', test: '2026-12-01', words, today: DAY, now: 1000 }).doc;
  return { d, g: W.groupById(d, 'g1') };
};
const T = (d, o) => { n += 1; return W.addTry(d, { id: 'p' + String(n).padStart(5, '0'), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, day: DAY, now: 1e6 + n, source: 'g', ...o }); };
const MIN = 60000;

test('sittings: from the tries sharing one id; minutes from the first try to the end mark (or the last try), rounded up, at least 1', () => {
  const { d, g } = mk();
  let x = T(d, { word: 'night', ss: 'aaaaaa', j: 'h', r: 2, now: 10 * MIN });
  x = T(x, { word: 'light', ss: 'aaaaaa', j: 'h', r: 2, now: 10 * MIN + 4 * MIN + 1000 });
  x = T(x, { word: 'night', ss: 'aaaaaa', j: 'h', r: 3, now: 10 * MIN + 5 * MIN });
  x = T(x, { word: 'night', ss: 'bbbbbb', j: 'f', r: 3, now: 100 * MIN, day: '2026-11-25' });
  x = T(x, { word: 'night', j: 'f', now: 5 }); // no sitting id: not a sitting
  let s = P.sittings(x, g);
  assert.deepEqual(s, [
    { ss: 'aaaaaa', day: DAY, minutes: 5, words: 2, finished: false },
    { ss: 'bbbbbb', day: '2026-11-25', minutes: 1, words: 1, finished: false },
  ]);
  x = { ...x, steps: { ...x.steps, 'g1|se:aaaaaa': { d: DAY, at: 10 * MIN + 7 * MIN + 1 } } }; // a normal end, 7 minutes and a moment after
  s = P.sittings(x, g);
  assert.deepEqual([s[0].minutes, s[0].finished, s[1].finished], [8, true, false]);
  assert.deepEqual(P.sittings(d, g), []);
  // another group's tries are not this week's
  const other = T(d, { word: 'night', ss: 'cccccc', j: 'h', r: 2, group: 'g2' });
  assert.deepEqual(P.sittings(other, g), []);
});

test('sittings: the step mark written by W.markStep("se:<ss>") ends a sitting (the key trim keeps)', () => {
  const { d, g } = mk();
  let x = T(d, { word: 'night', ss: 'aaaaaa', j: 'h', r: 2, now: MIN });
  x = W.markStep(x, g, 'se:aaaaaa', DAY, 3 * MIN);
  assert.deepEqual(P.sittings(x, g), [{ ss: 'aaaaaa', day: DAY, minutes: 2, words: 1, finished: true }]);
});

test('testLines: spelled, to keep practising, and with a peek ("spelled with a peek" / "with a peek"); the first answer stands', () => {
  const { d, g } = mk(['night', 'light', 'fight', 'sight']);
  let x = T(d, { word: 'night', kind: 't', day: '2026-12-01' });
  x = T(x, { word: 'light', kind: 't', day: '2026-12-01', clean: false, tries: 2 });
  x = T(x, { word: 'fight', kind: 't', day: '2026-12-01', clean: false, peeks: 1, pr: 1 });
  x = T(x, { word: 'sight', kind: 't', day: '2026-12-01', clean: false, peeks: 2, pr: 0 });
  assert.deepEqual(P.testLines(x, g), { spelled: ['night'], keep: ['light'], withPeek: ['fight: spelled with a peek', 'sight: with a peek'] });
  assert.deepEqual(P.testLines(d, g), { spelled: [], keep: [], withPeek: [] }, 'no test yet');
  // a later try of the same word does not change the answer
  const y = T(x, { word: 'light', kind: 't', day: '2026-12-01', now: 2e6 });
  assert.deepEqual(P.testLines(y, g).keep, ['light']);
  // folded away: the result still comes from the test results (peek detail is then lost, the word is kept to practise)
  const folded = W.trim({ ...x, results: x.results.map((r) => ({ ...r, at: 1 })) }, 9e12);
  assert.equal(W.testResults(folded, g).length, 4);
});

test('the WP-1b modules (and runs-doc) are pure: no Date, Math.random, document, fetch or storage; every number comes from sbs-rules.js (no LOCAL / EST tables)', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['rows-doc.js', 'session-doc.js', 'sbs-week-doc.js', 'sbs-report-doc.js', 'runs-doc.js']) {
    const src = readFileSync(new URL('../site/js/' + f, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\bDate\b|Math\.random|\bdocument\b|\bwindow\b|\bfetch\b|localStorage|sessionStorage/.test(src), f);
    assert.ok(!/\bLOCAL\b|\bEST\b/.test(src), f + ' keeps no private rules table');
    assert.ok(!/parkedAt|\bpark\b|parkPass|skipFactor|focus/i.test(src), f + ' knows nothing of parking or focus words');
  }
});

test('D25 stuckWords / stuckLines: a word that stepped back 3 times in one sitting lately and is not yet spelled whole and clean: "Stuck word: night"', () => {
  const { d, g } = mk(['night', 'light']);
  const seq = (x, word, ss, rungs, extra = {}) => rungs.reduce((acc, r, i) => T(acc, { word, ss, j: 'f', r, tries: 1, clean: false, now: 5e6 + n * 10 + i, ...extra }), x);
  let x = seq(d, 'night', 'aaaaaa', [5, 4, 5, 4, 3, 4, 3, 2]); // down 4 times in one sitting
  x = seq(x, 'light', 'aaaaaa', [5, 4, 5, 6, 5]);                 // down twice only
  assert.deepEqual(P.stuckWords(x, g, DAY), [{ word: 'night', day: DAY }]);
  assert.deepEqual(P.stuckLines(x, g, DAY), ['Stuck word: night']);
  assert.deepEqual(P.stuckLines(x, g, '2026-12-05'), [], 'not lately');
  // spelled whole and clean afterwards: no longer stuck
  const fixed = T(x, { word: 'night', ss: 'bbbbbb', j: 'f', r: CODE.ALL, now: 9e9 });
  assert.deepEqual(P.stuckLines(fixed, g, DAY), []);
  // the steps back must be in one sitting
  let y = seq(d, 'night', 'cccccc', [5, 4, 5, 4]);
  y = seq(y, 'night', 'dddddd', [5, 4, 5, 4]);
  assert.deepEqual(P.stuckLines(y, g, DAY), []);
  // rows count too, by row size
  let z = d;
  for (const [i, r] of [5, 4, 5, 4, 3, 2].entries()) z = T(z, { word: 'light', ss: 'eeeeee', j: 'w', rw: 3, r, tries: 1, clean: false, now: 6e6 + i });
  assert.deepEqual(P.stuckLines(z, g, DAY), ['Stuck word: light']);
  assert.ok(!/%|score|level/i.test(P.stuckLines(z, g, DAY)[0]));
});
