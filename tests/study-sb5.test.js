// SB5 (WP-A2): short weeks (D39, TR-102): weekKind, storySentences, planByDay and the exposed share. The test-due rules are NOT changed:
// the hashes below were taken from the code before this work package, so any drift in them fails here. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import * as G from '../site/js/games-doc.js';

const hash = (x) => createHash('sha256').update(String(x)).digest('hex').slice(0, 16);
const SUN = '2026-11-15'; // Sunday
const mkWeek = (start, n, words = ['one', 'two', 'three']) => {
  const d = W.createGroup(W.emptyDoc(), { id: 'g', name: 'x', test: W.addDays(start, n), words, today: start, now: 1 }).doc;
  return { d, g: W.groupById(d, 'g') };
};
const ids = (plan) => plan.map((p) => [p.day, p.jobs.map((j) => j.id).join('+')]);

test('the test-due and day-spreading rules are byte-for-byte what they were (TR-102: nothing there changes)', () => {
  assert.equal(hash(W.jobFor), 'a9fd0ff9bf8132d6');
  assert.equal(hash(W.studyJobDay), '5ee9825b5e2d1938');
  assert.equal(hash(W.studyDone), '06274a677df51719');
  assert.equal(hash(JSON.stringify(W.STUDY_JOBS)), '792bb3cf75fe9057');
  assert.equal(hash(JSON.stringify(St.BEFORE_TEST)), '792bb3cf75fe9057');
  assert.equal(hash(St.stepDates), '17a62386f34bccf6');
  assert.equal(hash(St.catchUpLine), '319472b34cc9aa49');
  assert.equal(St.CATCH_UP, 2);
  assert.equal(St.MEND_WAIT, 7);
  assert.deepEqual(W.STUDY_JOBS, ['hello', 'fix', 'games', 'story', 'practice']);
  assert.deepEqual(St.STEPS, ['hello', 'fix', 'games', 'story', 'practice', 'test', 'mend'], 'always seven stones');
});
test('stepDates: the jobs\' days for 1 to 9 days to the test (an unchanged rule, pinned)', () => {
  const days = (n) => { const { g } = mkWeek(SUN, n); const dt = St.stepDates(g); return St.BEFORE_TEST.map((s) => W.daysBetween(SUN, dt[s])); };
  assert.deepEqual(days(1), [0, 0, 0, 0, 0]);
  assert.deepEqual(days(2), [0, 0, 0, 1, 1]);
  assert.deepEqual(days(3), [0, 0, 1, 1, 2]);
  assert.deepEqual(days(4), [0, 0, 1, 2, 3]);
  assert.deepEqual(days(5), [0, 1, 2, 3, 4]);
  assert.deepEqual(days(6), [0, 1, 2, 3, 4]);
  assert.deepEqual(days(7), [0, 1, 2, 4, 5]);
  assert.deepEqual(days(9), [0, 1, 3, 5, 7]);
});

test('weekKind: 1-2 days quick, 3-4 short, 5 and more full (1 to 8, and 28)', () => {
  const kinds = {};
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 28]) kinds[n] = St.weekKind(mkWeek(SUN, n).g);
  assert.deepEqual(kinds, { 1: 'quick', 2: 'quick', 3: 'short', 4: 'short', 5: 'full', 6: 'full', 7: 'full', 8: 'full', 28: 'full' });
  assert.equal(St.weekKind({ start: SUN, test: '2026-11-20' }), 'full', 'works on a bare { start, test }');
  assert.deepEqual(St.WEEK_KINDS, ['quick', 'short', 'full']);
});
test('weekKind does not change as the days go by: a missed day never turns a full week short', () => {
  const { g } = mkWeek(SUN, 5);
  assert.equal(St.weekKind(g), 'full');
  assert.equal(St.weekKind({ ...g }), 'full');
  void St.studyState(mkWeek(SUN, 5).d, g, '2026-11-19');
  assert.equal(St.weekKind(g), 'full');
});
test('storySentences: full 3, short 2, quick 1; anything else is full', () => {
  assert.equal(St.storySentences('full'), 3);
  assert.equal(St.storySentences('short'), 2);
  assert.equal(St.storySentences('quick'), 1);
  assert.equal(St.storySentences(undefined), 3);
  assert.equal(St.storySentences('odd'), 3);
  assert.equal(St.SENTENCES, 3);
});
test('sentenceWords: three by default, fewer when a short week asks', () => {
  const { d, g } = mkWeek(SUN, 5, ['one', 'two', 'three', 'four']);
  assert.deepEqual(St.sentenceWords(d, g), ['one', 'two', 'three']);
  assert.deepEqual(St.sentenceWords(d, g, St.storySentences('short')), ['one', 'two']);
  assert.deepEqual(St.sentenceWords(d, g, St.storySentences('quick')), ['one']);
});

// ---- planByDay: BRS 3.2's table, one row per length ----------------------------------------------------------
test('planByDay, 1 day (test tomorrow): all five jobs on day 1, Game day 2 games, Story 1 sentence, then the test', () => {
  const { g } = mkWeek(SUN, 1);
  const plan = St.planByDay(g, 4);
  assert.deepEqual(ids(plan), [[SUN, 'hello+fix+games+story+practice'], ['2026-11-16', 'test']]);
  assert.equal(plan[0].jobs[2].games, 2);
  assert.deepEqual(plan[0].jobs[2].gameIds, ['missing', 'mix']);
  assert.equal(plan[0].jobs[3].sentences, 1);
});
test('planByDay, 2 days (quick): day 1 Hello, Fix it in, Game day; day 2 Story day, Practice day', () => {
  const { g } = mkWeek(SUN, 2);
  const plan = St.planByDay(g, 4);
  assert.deepEqual(ids(plan), [[SUN, 'hello+fix+games'], ['2026-11-16', 'story+practice'], ['2026-11-17', 'test']]);
  assert.equal(plan[0].jobs[2].games, 2);
  assert.equal(plan[1].jobs[0].sentences, 1);
});
test('planByDay, 3 days (short): Hello and Fix it in; Game day and Story day; Practice day; the test', () => {
  const { g } = mkWeek(SUN, 3);
  assert.deepEqual(ids(St.planByDay(g, 4)), [[SUN, 'hello+fix'], ['2026-11-16', 'games+story'], ['2026-11-17', 'practice'], ['2026-11-18', 'test']]);
  const games = (year) => St.planByDay(g, year)[1].jobs[0];
  assert.equal(games(4).games, 4, 'Year 4: 4 games');
  assert.equal(games(2).games, 3, 'Year 2: 3 games');
  assert.equal(games(null).games, 4, 'unknown year: as Years 3-4');
  assert.equal(St.planByDay(g, 4)[1].jobs[1].sentences, 2);
});
test('planByDay, 4 days (short): one job on each of days 2 to 4 after Hello and Fix it in together', () => {
  const { g } = mkWeek(SUN, 4);
  assert.deepEqual(ids(St.planByDay(g, 5)), [[SUN, 'hello+fix'], ['2026-11-16', 'games'], ['2026-11-17', 'story'], ['2026-11-18', 'practice'], ['2026-11-19', 'test']]);
});
test('planByDay, 5 and 6 days (full): one job a day; the 6-day week has one rest day before the test', () => {
  assert.deepEqual(ids(St.planByDay(mkWeek(SUN, 5).g, 4)).map((x) => x[1]), ['hello', 'fix', 'games', 'story', 'practice', 'test']);
  const six = St.planByDay(mkWeek(SUN, 6).g, 4);
  assert.deepEqual(ids(six).map((x) => x[1]), ['hello', 'fix', 'games', 'story', 'practice', 'test']);
  assert.equal(six[5].day, '2026-11-21');
  assert.equal(six[4].day, '2026-11-19', 'day 5, and day 6 is a rest day');
});
test('planByDay, 7 days: jobs on days 1, 2, 3, 5 and 6; days 4 and 7 rest', () => {
  const plan = St.planByDay(mkWeek(SUN, 7).g, 4);
  assert.deepEqual(plan.map((p) => W.daysBetween(SUN, p.day)), [0, 1, 2, 4, 5, 7]);
  assert.deepEqual(plan.map((p) => p.jobs.map((j) => j.id).join('+')), ['hello', 'fix', 'games', 'story', 'practice', 'test']);
});
test('planByDay, long weeks (8 to 28 days): five jobs in order, one at a time, each before the test, the test last, no job dropped', () => {
  for (let n = 8; n <= 28; n += 1) {
    const { g } = mkWeek(SUN, n);
    const plan = St.planByDay(g, 3);
    const flat = plan.flatMap((p) => p.jobs.map((j) => j.id));
    assert.deepEqual(flat, ['hello', 'fix', 'games', 'story', 'practice', 'test'], 'n=' + n);
    for (const p of plan.slice(0, -1)) assert.ok(p.day >= SUN && p.day < g.test && p.jobs.length === 1, 'n=' + n);
    assert.equal(plan[plan.length - 1].day, g.test);
    assert.equal(plan[0].jobs[0].games, undefined);
    assert.equal(plan.find((p) => p.jobs[0].id === 'games').jobs[0].games, 6, 'a long week plays all six games (Year 3)');
    assert.equal(plan.find((p) => p.jobs[0].id === 'story').jobs[0].sentences, 3);
  }
});
test('planByDay for every length matches what the child\'s app actually offers when every job is done on its day', () => {
  for (let n = 1; n <= 12; n += 1) {
    let { d, g } = mkWeek(SUN, n);
    const played = [];
    const marked = new Set(); // Practice day is finished by the grid, not by a mark, so it would be offered again
    let now = 10;
    for (let i = 0; i < n; i += 1) {
      const day = W.addDays(SUN, i);
      const jobs = [];
      for (let k = 0; k < 5; k += 1) {
        const s = St.studyState(d, g, day);
        if (s.status !== 'job' || marked.has(s.job)) break;
        marked.add(s.job);
        jobs.push(s.job);
        d = W.markStep(d, g, s.job, day, now++);
      }
      if (jobs.length) played.push([day, jobs.join('+')]);
    }
    assert.deepEqual(ids(St.planByDay(g, 4)).slice(0, -1), played, 'n=' + n);
  }
});
test('planByDay: the worked example, set Sun 15 Nov, test Fri 20 Nov (5 days, a full week, Year 4)', () => {
  const { g } = mkWeek(SUN, 5);
  assert.equal(g.test, '2026-11-20');
  assert.equal(St.weekKind(g), 'full');
  const plan = St.planByDay(g, 4);
  assert.deepEqual(ids(plan), [['2026-11-15', 'hello'], ['2026-11-16', 'fix'], ['2026-11-17', 'games'], ['2026-11-18', 'story'], ['2026-11-19', 'practice'], ['2026-11-20', 'test']]);
  assert.equal(plan[2].jobs[0].games, 6, 'Game day, Tuesday: 6 games');
  assert.equal(plan[3].jobs[0].sentences, 3, 'Story day, Wednesday: 3 sentences');
  const stones = St.studyState(g && mkWeek(SUN, 5).d, g, '2026-11-18').steps;
  assert.deepEqual(stones.map((s) => [s.id, s.date]), [['hello', '2026-11-15'], ['fix', '2026-11-16'], ['games', '2026-11-17'], ['story', '2026-11-18'], ['practice', '2026-11-19'], ['test', '2026-11-20'], ['mend', '2026-11-21']]);
});
test('planByDay: the worked example, set Sun 22 Nov, "In 3 days": test Wed 25, Game day 4 games and Story 2 sentences on Monday', () => {
  const { g } = mkWeek('2026-11-22', 3);
  assert.equal(g.test, '2026-11-25');
  const plan = St.planByDay(g, 4);
  assert.deepEqual(ids(plan), [['2026-11-22', 'hello+fix'], ['2026-11-23', 'games+story'], ['2026-11-24', 'practice'], ['2026-11-25', 'test']]);
  assert.equal(plan[1].jobs[0].games, 4);
  assert.equal(plan[1].jobs[1].sentences, 2);
  assert.equal(St.studyState(mkWeek('2026-11-22', 3).d, g, '2026-11-22').steps[6].date, '2026-11-26', 'Mend and keep the day after the test');
});
test('planByDay: the test day holds only the test; stones stay seven; test comes after every job', () => {
  for (let n = 1; n <= 9; n += 1) {
    const plan = St.planByDay(mkWeek(SUN, n).g, 3);
    const last = plan[plan.length - 1];
    assert.deepEqual(last.jobs, [{ id: 'test' }]);
    assert.ok(plan.slice(0, -1).every((p) => p.jobs.every((j) => j.id !== 'test' && j.id !== 'mend')));
    assert.equal(St.studyState(mkWeek(SUN, n).d, mkWeek(SUN, n).g, SUN).steps.length, 7);
  }
});
test('planByDay: Game day\'s game count comes from dayGames for the year and week kind', () => {
  for (const n of [1, 3, 5]) for (const year of [1, 4, 6, null]) {
    const { g } = mkWeek(SUN, n);
    const job = St.planByDay(g, year).flatMap((p) => p.jobs).find((j) => j.id === 'games');
    assert.deepEqual(job.gameIds, G.dayGames(year, St.weekKind(g)), 'n=' + n + ' year ' + year);
    assert.equal(job.games, job.gameIds.length);
  }
});

// ---- share ------------------------------------------------------------------------------------------------------------------------
test('studyState exposes share: the jobs today\'s share allows (2 or more reads "Today: 2 jobs")', () => {
  const three = mkWeek(SUN, 3);
  assert.equal(St.studyState(three.d, three.g, SUN).share, 2, 'a 3-day week: two jobs on day 1');
  const five = mkWeek(SUN, 5);
  assert.equal(St.studyState(five.d, five.g, SUN).share, 1);
  const one = mkWeek(SUN, 1);
  assert.equal(St.studyState(one.d, one.g, SUN).share, 5, 'test tomorrow: all five today');
  const two = mkWeek(SUN, 2);
  assert.equal(St.studyState(two.d, two.g, SUN).share, 3);
  assert.equal(St.studyState(five.d, five.g, '2026-11-20').share, 0, 'from the test date: no share');
  // the rest of the state is what it was
  const s = St.studyState(three.d, three.g, SUN);
  assert.equal(s.status, 'job');
  assert.equal(s.job, 'hello');
  assert.equal(s.steps.length, 7);
  assert.equal(s.squeezed, true);
});
test('the share rule itself is unchanged: a golden run of "do every job offered" gives the same days as before this package', () => {
  const golden = { 1: 'hello+fix+games+story+practice', 2: 'hello+fix+games|story+practice', 3: 'hello+fix|games+story|practice', 4: 'hello+fix|games|story|practice', 5: 'hello|fix|games|story|practice', 7: 'hello|fix|games|-|story|practice|-', 9: 'hello|fix|-|games|-|story|-|practice|-' };
  for (const [n, want] of Object.entries(golden)) {
    let { d, g } = mkWeek(SUN, Number(n));
    const seq = [];
    const marked = new Set();
    let now = 10;
    for (let i = 0; i < Number(n); i += 1) {
      const day = W.addDays(SUN, i);
      const jobs = [];
      for (let k = 0; k < 6; k += 1) {
        const s = St.studyState(d, g, day);
        if (s.status !== 'job' || marked.has(s.job)) break;
        marked.add(s.job);
        jobs.push(s.job);
        d = W.markStep(d, g, s.job, day, now++);
      }
      seq.push(jobs.join('+') || '-');
    }
    assert.equal(seq.join('|'), want, 'n=' + n);
  }
});
test('catch-up is unchanged: on the test date, jobs still waiting come first, 2 a day, in order; the week kind stays as set', () => {
  let { d, g } = mkWeek(SUN, 3);
  const day = '2026-11-18'; // the test date, nothing done
  let s = St.studyState(d, g, day);
  assert.equal(s.catchUp, true);
  assert.equal(s.job, 'hello', 'the first waiting job first');
  d = W.markStep(d, g, 'hello', day, 10);
  d = W.markStep(d, g, 'fix', day, 11);
  s = St.studyState(d, g, day);
  assert.equal(s.status, 'done', 'two catch-up jobs a day (CATCH_UP)');
  assert.equal(St.studyState(d, g, '2026-11-19').job, 'games');
  assert.equal(St.weekKind(g), 'short');
});
