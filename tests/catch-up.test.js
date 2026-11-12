// SB3-A: the study week never skips a day. A missed job waits; from the test date
// the jobs still waiting catch up (CATCH_UP a day), and the test opens, and its
// words hide, only once all five are done. A fake clock throughout. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import * as P from '../site/js/grownups-doc.js';
import { testGuard } from '../site/js/test-guard.js';

const MON = '2026-11-02';
const plus = (n) => W.addDays(MON, n);
const at = (day, h = 12) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':00:00Z');
const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
let n = 0;
const nid = () => 'c' + (++n);
function made(words = ['fruit', 'earth'], t = plus(5)) {
  const r = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week', test: t, words, today: MON, now: at(MON) });
  return { d: r.doc, g: W.groupById(r.doc, 'g1') };
}
const pass = (d, g, word, day, { source, clean = true, tries = 0, kind = 'p', hour = 12 } = {}) =>
  W.addTry(d, { id: nid(), word, day, group: g.id, kind, tries, peeks: 0, clean, source, now: at(day, hour) });
const threeTimes = (d, g, day, source) => [9, 10, 11].reduce((x, hour) => W.rows(g).reduce((y, w) => pass(y, g, w, day, { source, hour }), x), d);
function doJob(d, g, step, day) {
  if (step === 'practice') return threeTimes(d, g, day);
  if (step === 'fix') return W.markStep(threeTimes(d, g, day, 'x'), g, step, day, at(day));
  if (step === 'test') return g.words.reduce((x, w) => pass(x, g, w, day, { kind: 't', clean: w !== 'earth', tries: w === 'earth' ? 1 : 0 }), d);
  return W.markStep(d, g, step, day, at(day));
}
const state = (d, g, day) => St.studyState(d, g, day);
const guard = (pattern, d, day) => testGuard(pattern, { gid: 'g1', yearId: 'y34', slug: 'ch01' }, d, day, () => ['fruit', 'earth']);
const noPassed = (s) => assert.ok(s.steps.every((x) => ['done', 'today', 'waiting', 'later'].includes(x.state)), JSON.stringify(s.steps.map((x) => x.state)));

test('CATCH_UP is exported, and is 2', () => {
  assert.equal(St.CATCH_UP, 2);
});

test('missed every day, opened on the test date: the job is Hello words, not the test', () => {
  const { d, g } = made();
  const s = state(d, g, plus(5));
  assert.equal(s.status, 'job');
  assert.equal(s.job, 'hello');
  assert.equal(s.catchUp, true);
  assert.equal(W.jobFor(d, g, plus(5)), 'practise', 'the test isn\'t due');
  assert.equal(St.dueGroups(d, plus(5)).length, 0);
  noPassed(s);
});

test('catch-up: two jobs a day, then done for today; in order; the test after all five', () => {
  let { d, g } = made();
  const day1 = plus(5);
  d = doJob(d, g, 'hello', day1);
  assert.equal(state(d, g, day1).job, 'fix', 'a second job today');
  d = doJob(d, g, 'fix', day1);
  assert.equal(state(d, g, day1).status, 'done', 'two today: done for today');
  assert.equal(state(d, g, day1).job, null);
  const day2 = plus(6);
  assert.equal(state(d, g, day2).job, 'games');
  d = doJob(d, g, 'games', day2);
  assert.equal(state(d, g, day2).job, 'story');
  d = doJob(d, g, 'story', day2);
  assert.equal(state(d, g, day2).status, 'done');
  assert.equal(W.jobFor(d, g, day2), 'practise', 'no test yet: one job still waiting');
  const day3 = plus(7);
  assert.equal(state(d, g, day3).job, 'practice');
  d = doJob(d, g, 'practice', day3);
  assert.equal(state(d, g, day3).job, 'test', 'the test opens the same day the last job is done');
  assert.equal(W.jobFor(d, g, day3), 'test');
  noPassed(state(d, g, day3));
});

test('catch-up counts a job finished today, even one done before the test date ran out', () => {
  let { d, g } = made();
  // Three jobs done on the test date: only two count as catch-up today, so the rest waits.
  d = doJob(doJob(d, g, 'hello', plus(4)), g, 'fix', plus(5));
  assert.equal(state(d, g, plus(5)).job, 'games');
  d = doJob(d, g, 'games', plus(5));
  assert.equal(state(d, g, plus(5)).status, 'done');
  assert.equal(state(d, g, plus(6)).job, 'story');
});

test('the test opens only after all five jobs, whatever order the days came in', () => {
  let { d, g } = made();
  for (const s of ['hello', 'fix', 'games', 'story']) {
    d = doJob(d, g, s, plus(9));
    assert.notEqual(W.jobFor(d, g, plus(20)), 'test', 'after ' + s);
  }
  d = doJob(d, g, 'practice', plus(10));
  assert.equal(W.jobFor(d, g, plus(10)), 'test');
  assert.equal(W.studyDone(d, g), true);
});

test('words are on show during catch-up and hidden once the test is due', () => {
  let { d, g } = made();
  const day = plus(5);
  assert.equal(St.hiddenWords(d, day).size, 0);
  assert.equal(St.gamesOpen(d, g, day), true);
  assert.equal(guard('words/g/:gid/study/:step', d, day), null);
  assert.equal(guard('words/g/:gid/spell/:n', d, day), null);
  assert.equal(St.roomState(d, day).hideWords, false);
  assert.deepEqual(W.returningWords(d, day), [], 'a group still catching up keeps its own words');
  for (const s of St.BEFORE_TEST) d = doJob(d, g, s, plus(4));
  assert.deepEqual([...St.hiddenWords(d, day)].sort(), ['earth', 'fruit']);
  assert.equal(St.gamesOpen(d, g, day), false);
  assert.equal(guard('words/g/:gid/spell/:n', d, day).id, 'g1');
  assert.equal(St.roomState(d, day).hideWords, true);
});

test('a test left halfway stays due and hidden, even with jobs still waiting (an older release)', () => {
  let { d, g } = made();
  d = pass(d, g, 'fruit', plus(5), { kind: 't' });
  assert.equal(W.jobFor(d, g, plus(6)), 'test');
  assert.equal(St.hiddenWords(d, plus(6)).size, 2);
});

test('practice during catch-up counts for the dots and Ready for the test', () => {
  let { d, g } = made();
  d = threeTimes(d, g, plus(6));
  assert.equal(W.readyForTest(d, g), true);
  assert.equal(W.dots(d, g, 'fruit', plus(6)), W.ROW_NEEDED);
  assert.equal(W.studyJobDay(d, g, 'practice'), plus(6));
});

test('Mend and keep still follows the test, the day after it was done', () => {
  let { d, g } = made();
  for (const s of St.BEFORE_TEST) d = doJob(d, g, s, plus(7));
  d = doJob(d, g, 'test', plus(8));
  assert.equal(state(d, g, plus(8)).status, 'done', 'tested today');
  assert.equal(St.stepDates(g, plus(8)).mend, plus(9));
  assert.equal(state(d, g, plus(9)).job, 'mend');
  assert.equal(St.mendPart(d, g, plus(9)), 'fixups');
  noPassed(state(d, g, plus(9)));
});

test('a week done on time behaves exactly as before', () => {
  let { d, g } = made();
  const want = ['hello', 'fix', 'games', 'story', 'practice'];
  want.forEach((s, i) => {
    const day = plus(i);
    const st = state(d, g, day);
    assert.equal(st.job, s, day);
    assert.equal(st.catchUp, false);
    d = doJob(d, g, s, day);
    assert.equal(state(d, g, day).status, i === 4 ? 'ready' : 'done');
  });
  assert.equal(state(d, g, plus(5)).job, 'test');
  assert.equal(state(d, g, plus(5)).catchUp, false);
  assert.equal(St.hiddenWords(d, plus(5)).size, 2);
  assert.deepEqual(state(d, g, plus(5)).steps.map((x) => x.state), ['done', 'done', 'done', 'done', 'done', 'today', 'later']);
  d = doJob(d, g, 'test', plus(5));
  assert.equal(state(d, g, plus(6)).job, 'mend');
});

test('nothing is ever "passed", on any day of a missed week', () => {
  let { d, g } = made();
  for (let i = 0; i < 14; i += 1) {
    const day = plus(i);
    const s = state(d, g, day);
    noPassed(s);
    if (s.job && i % 3 === 2) d = doJob(d, g, s.job, day); // a job now and then
  }
  for (const f of ['site/js/study-doc.js', 'site/js/study-views.js', 'site/css/app.css']) {
    assert.doesNotMatch(readFileSync(file(f), 'utf8'), /'passed'|passed over'|is-passed/, f);
  }
});

test('the waiting line: kind words, the test day by name', () => {
  const { d, g } = made();
  assert.equal(St.roomState(d, plus(6)).catchUp, 'Your test day was Sat 7 Nov. Finish your jobs, then take the test here.');
  assert.equal(St.roomState(d, plus(5)).catchUp, 'Today is your test day. Finish your jobs, then take the test here.');
  assert.equal(St.roomState(d, plus(4)).catchUp, '', 'not before the date');
  for (const line of [St.catchUpLine(g, plus(6)), St.catchUpLine(g, plus(5))]) assert.doesNotMatch(line, /late|behind|missed/i);
  const v = readFileSync(file('site/js/words-views.js'), 'utf8') + readFileSync(file('site/js/child-views.js'), 'utf8');
  assert.equal(v.match(/data-catchup/g).length, 2, 'on the study page and on the child\'s home');
});

test('Grown-ups: how many jobs wait, and that the test opens once they\'re done', () => {
  let { d, g } = made();
  d = doJob(d, g, 'hello', MON);
  const r = P.dashboard(d, plus(6)).current;
  assert.equal(r.waiting, 4);
  assert.equal(r.testWaits, true);
  const early = P.dashboard(d, plus(3)).current;
  assert.equal(early.waiting, 2, 'fix and games have had their dates');
  assert.equal(early.testWaits, false);
  for (const s of St.BEFORE_TEST) d = doJob(d, g, s, plus(6));
  assert.equal(P.dashboard(d, plus(6)).current.waiting, 0);
  const views = readFileSync(file('site/js/grownups-views.js'), 'utf8');
  assert.match(views, /data-waiting/);
  assert.match(views, /the test opens once/);
});

test('a legacy week (test finished under the old rule, jobs left undone): those jobs are "missed", never waiting or a job', () => {
  let { d, g } = made();
  for (const [s, i] of [['fix', 1], ['games', 2], ['practice', 4]]) d = doJob(d, g, s, plus(i));
  d = doJob(d, g, 'test', plus(5)); // hello and story not done
  let full = made().d;
  for (const s of St.BEFORE_TEST) full = doJob(full, g, s, plus(1));
  full = doJob(full, g, 'test', plus(5));
  for (const i of [5, 6, 7, 9, 20]) {
    const s = state(d, g, plus(i));
    const want = state(full, g, plus(i));
    assert.deepEqual(s.steps.map((x) => x.state), ['missed', 'done', 'done', 'missed', 'done', 'done', ...want.steps.slice(6).map((x) => x.state)], 'day ' + i);
    assert.deepEqual([s.status, s.job, s.catchUp, s.waiting], [want.status, want.job, false, 0], 'the after-test flow as before, day ' + i);
  }
  assert.equal(state(d, g, plus(6)).job, 'mend');
  assert.equal(St.mendPart(d, g, plus(6)), 'fixups');
  for (const s of ['hello', 'story']) assert.equal(St.canOpen(d, g, s, plus(6)), false, s + ' can\'t be opened');
  const r = St.roomState(d, plus(6));
  assert.equal(r.step.id, 'mend', 'My room: the job is Mend and keep');
  assert.equal(r.catchUp, '');
  assert.equal(P.dashboard(d, plus(6)).current.waiting, 0);
});

test('a half-started test (an older release) keeps its jobs waiting, not missed, and stays hidden', () => {
  let { d, g } = made();
  d = pass(d, g, 'fruit', plus(5), { kind: 't' });
  const s = state(d, g, plus(6));
  assert.equal(s.job, 'test');
  assert.ok(!s.steps.some((x) => x.state === 'missed'));
});

test('a week following the new rule never yields "missed", however it goes', () => {
  for (const every of [1, 2, 3]) {
    let { d, g } = made();
    for (let i = 0; i < 16; i += 1) {
      const day = plus(i);
      const s = state(d, g, day);
      noPassed(s); // only done, today, waiting, later
      if (s.job && i % every === 0) d = doJob(d, g, s.job, day);
    }
  }
});

test('the strip shows a missed job muted, with "Not done"', () => {
  const v = readFileSync(file('site/js/study-views.js'), 'utf8');
  assert.match(v, /missed: 'not done'/);
  assert.match(v, /s\.state === 'missed' \? 'Not done'/);
  assert.match(readFileSync(file('site/css/app.css'), 'utf8'), /\.weekstrip__day\.is-missed \.weekstrip__badge \{ background: var\(--surface\); color: var\(--muted\);/);
});
