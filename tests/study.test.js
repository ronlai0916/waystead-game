// SB2-1: Study mode, Practise 3 times and My room (site/js/study-doc.js and the
// parts of words-doc.js they read). A fake clock throughout: `today` is passed in.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import { isPlayPath, isWordsPath } from '../site/js/gate.js';

const MON = '2026-11-02';
const plus = (n, from = MON) => W.addDays(from, n);
const at = (day, h = 12) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':00:00Z');
let n = 0;
const nid = () => 's' + (++n);
function made(words = ['fruit', 'earth', 'heart'], { test: t = plus(7), today = MON, id = 'g1', doc = W.emptyDoc() } = {}) {
  const r = W.createGroup(doc, { id, name: 'Week', test: t, words, today, now: at(today) });
  assert.ok(r.doc, r.error);
  return { d: r.doc, g: W.groupById(r.doc, id) };
}
const pass = (d, g, word, day, { source, clean = true, tries = 0, peeks = 0, kind = 'p', hour = 12 } = {}) =>
  W.addTry(d, { id: nid(), word, day, group: g.id, kind, tries, peeks, clean, source, now: at(day, hour) });
const everyWord = (d, g, day, opts) => W.rows(g).reduce((x, w) => pass(x, g, w, day, opts), d);
const mark = (d, g, step, day) => W.markStep(d, g, step, day, at(day));
const job = (d, g, day) => St.studyState(d, g, day).job;
const status = (d, g, day) => St.studyState(d, g, day).status;
const dotsOf = (d, g, w, day = plus(1)) => W.dots(d, g, w, day);
const threeTimes = (d, g, day, opts = {}) => [9, 10, 11].reduce((x, hour) => everyWord(x, g, day, { ...opts, hour }), d);
const row3 = (d, g, w, day, opts = {}) => [9, 10, 11].reduce((x, hour) => pass(x, g, w, day, { ...opts, hour }), d);
function doJob(d, g, step, day) {
  if (step === 'practice') return threeTimes(d, g, day);
  if (step === 'fix') return mark(threeTimes(d, g, day, { source: 'x' }), g, step, day);
  if (step === 'games') return mark(everyWord(d, g, day, { source: 'g' }), g, step, day);
  if (step === 'test') return g.words.reduce((x, w) => pass(x, g, w, day, { kind: 't' }), d);
  return mark(d, g, step, day);
}
/** All five jobs before the test, done on `day`. */
const studied = (d, g, day = MON) => St.BEFORE_TEST.reduce((x, s) => doJob(x, g, s, day), d);

test('every file in the worker\'s shell is really there', () => {
  const sw = readFileSync(fileURLToPath(new URL('../site/sw.js', import.meta.url)), 'utf8');
  const shell = /const SHELL = \[([\s\S]*?)\];/.exec(sw)[1].match(/'[^']+'/g).map((s) => s.slice(1, -1)).filter((s) => s !== './');
  assert.ok(shell.includes('data/stories.json') && shell.includes('js/room.js'));
  for (const f of shell) assert.ok(existsSync(fileURLToPath(new URL('../site/' + f, import.meta.url))), f);
});

// ---- unlocking by date ---------------------------------------------------------------
test('a 5-day gap gives one job a day, in order, then the test and Mend and keep', () => {
  const { g } = made(undefined, { test: plus(5) });
  assert.deepEqual(St.stepDates(g), { hello: MON, fix: plus(1), games: plus(2), story: plus(3), practice: plus(4), test: plus(5), mend: plus(6) });
});
test('the default week (7 days) keeps each job on its own day, with room to spare', () => {
  const { g } = made();
  const d = St.stepDates(g);
  assert.deepEqual(St.BEFORE_TEST.map((s) => W.daysBetween(MON, d[s])), [0, 1, 2, 4, 5]);
});
test('a job opens on its date and not before', () => {
  let { d, g } = made();
  assert.equal(job(d, g, MON), 'hello');
  d = doJob(d, g, 'hello', MON);
  assert.equal(job(d, g, MON), null);
  assert.equal(status(d, g, MON), 'done');
  assert.equal(job(d, g, plus(1)), 'fix');
  assert.equal(St.canOpen(d, g, 'fix', MON), false, 'fix is locked until its date');
  assert.equal(St.canOpen(d, g, 'fix', plus(1)), true);
});
test('a whole week, day by day', () => {
  let { d, g } = made(undefined, { test: plus(5) });
  ['hello', 'fix', 'games', 'story', 'practice'].forEach((s, i) => {
    assert.equal(job(d, g, plus(i)), s, 'day ' + i);
    d = doJob(d, g, s, plus(i));
    assert.equal(status(d, g, plus(i)), i === 4 ? 'ready' : 'done');
  });
  assert.equal(job(d, g, plus(5)), 'test');
  d = doJob(d, g, 'test', plus(5));
  assert.equal(status(d, g, plus(5)), 'done', 'all right in the test: Mend and keep is still tomorrow');
  assert.equal(job(d, g, plus(6)), 'mend');
  d = mark(d, g, 'mend', plus(6));
  assert.equal(status(d, g, plus(6)), 'finished');
});
test('a day with no job due is a rest day, not "done"', () => {
  let { d, g } = made();
  for (const [s, day] of [['hello', 0], ['fix', 1], ['games', 2]]) d = doJob(d, g, s, plus(day));
  assert.equal(status(d, g, plus(3)), 'rest'); // Story day is day 4 of 7
  assert.equal(job(d, g, plus(4)), 'story');
});
test('the job page: only today\'s job or one already done, and never once the test is due', () => {
  let { d, g } = made(undefined, { test: plus(5) });
  d = doJob(d, g, 'hello', MON);
  assert.equal(St.canOpen(d, g, 'hello', plus(1)), true, 'done again');
  assert.equal(St.canOpen(d, g, 'games', plus(1)), false);
  assert.equal(St.canOpen(d, g, 'hello', plus(5)), true, 'test day, jobs still waiting: the words are on show');
  assert.equal(St.canOpen(d, g, 'fix', plus(5)), true, 'the next job waiting');
  assert.equal(St.canOpen(d, g, 'games', plus(5)), false, 'still in order');
  d = studied(d, g, plus(1));
  assert.equal(St.canOpen(d, g, 'hello', plus(5)), false, 'test due: no word on show');
});

// ---- a missed day waits -----------------------------------------------------------------
test('a missed day waits: nothing is skipped', () => {
  let { d, g } = made();
  d = doJob(d, g, 'hello', MON);
  // Fix it in was for Tuesday. Thursday: it's still the job, and the strip says so.
  assert.equal(job(d, g, plus(3)), 'fix');
  const s = St.studyState(d, g, plus(3));
  assert.equal(s.steps.find((x) => x.id === 'fix').state, 'today');
  assert.equal(s.steps.find((x) => x.id === 'games').state, 'waiting');
  assert.equal(St.canOpen(d, g, 'games', plus(3)), false, 'still in order');
});
test('catching up: the day\'s share rises only when the days run short', () => {
  let { d, g } = made(undefined, { test: plus(7) });
  // Nothing done until day 4: five jobs, three days left.
  assert.equal(job(d, g, plus(4)), 'hello');
  d = doJob(d, g, 'hello', plus(4));
  assert.equal(job(d, g, plus(4)), 'fix', 'two today: 5 jobs, 3 days');
  d = doJob(d, g, 'fix', plus(4));
  assert.equal(status(d, g, plus(4)), 'done');
  assert.equal(job(d, g, plus(5)), 'games');
});
test('with days to spare a late start still gets one job a day', () => {
  let { d, g } = made(undefined, { test: plus(14) });
  d = doJob(d, g, 'hello', plus(2));
  assert.equal(status(d, g, plus(2)), 'done');
});
test('from its date the jobs still waiting come first, then the test; nothing is passed over', () => {
  let { d, g } = made(undefined, { test: plus(5) });
  d = doJob(d, g, 'hello', MON);
  assert.equal(job(d, g, plus(5)), 'fix');
  const s = St.studyState(d, g, plus(5));
  assert.equal(s.catchUp, true);
  assert.deepEqual(s.steps.map((x) => x.state), ['done', 'today', 'waiting', 'waiting', 'waiting', 'later', 'later']);
  d = studied(d, g, plus(1));
  assert.equal(job(d, g, plus(5)), 'test');
  assert.equal(job(d, g, plus(8)), 'test', 'a missed test waits too');
});
test('Mend and keep comes the day after the test, even a late one', () => {
  let { d, g } = made(undefined, { test: plus(5) });
  d = doJob(d, g, 'test', plus(8));
  assert.equal(status(d, g, plus(8)), 'done');
  assert.equal(St.stepDates(g, plus(8)).mend, plus(9));
  assert.equal(job(d, g, plus(9)), 'mend');
});
test('fix-ups first, then the quick-fire round; a word needing tomorrow brings the week back', () => {
  let { d, g } = made(['fruit', 'earth'], { test: plus(5) });
  d = pass(pass(d, g, 'fruit', plus(5), { kind: 't' }), g, 'earth', plus(5), { kind: 't', clean: false, tries: 1 });
  assert.equal(status(d, g, plus(5)), 'done', 'tested today: fix-ups come tomorrow');
  assert.equal(job(d, g, plus(6)), 'mend');
  assert.equal(St.mendPart(d, g, plus(6)), 'fixups');
  d = pass(d, g, 'earth', plus(6), { kind: 'f', clean: false, tries: 1, hour: 8 });
  d = row3(d, g, 'earth', plus(6), { kind: 'f' });
  assert.equal(St.mendPart(d, g, plus(6)), 'quick');
  assert.equal(job(d, g, plus(6)), 'mend');
  d = mark(d, g, 'mend', plus(6));
  assert.equal(status(d, g, plus(6)), 'done', 'quick round done; the fix-up comes back tomorrow');
  assert.equal(St.mendPart(d, g, plus(7)), 'fixups');
  d = row3(d, g, 'earth', plus(7), { kind: 'f' });
  assert.equal(status(d, g, plus(7)), 'finished');
});
test('Mend and keep stops waiting a week after its date when nothing slipped', () => {
  let { d, g } = made(undefined, { test: plus(5) });
  d = doJob(d, g, 'test', plus(5));
  assert.equal(job(d, g, plus(6 + St.MEND_WAIT)), 'mend');
  assert.equal(status(d, g, plus(7 + St.MEND_WAIT)), 'finished');
});

// ---- squeezing ---------------------------------------------------------------------------
for (const [gap, want] of [[1, [0, 0, 0, 0, 0]], [2, [0, 0, 0, 1, 1]], [3, [0, 0, 1, 1, 2]], [4, [0, 0, 1, 2, 3]], [6, [0, 1, 2, 3, 4]]]) {
  test('test in ' + gap + ' days: the jobs share the days, in order', () => {
    const { g } = made(undefined, { test: plus(gap) });
    const dates = St.stepDates(g);
    assert.deepEqual(St.BEFORE_TEST.map((s) => W.daysBetween(MON, dates[s])), want);
    assert.equal(St.studyState(W.emptyDoc(), g, MON).squeezed, gap < 5);
  });
}
test('a squeezed week runs jobs back to back in the same order', () => {
  let { d, g } = made(undefined, { test: plus(2) });
  const order = [];
  for (const day of [MON, plus(1)]) {
    for (let i = 0; i < 6 && job(d, g, day); i += 1) { const s = job(d, g, day); order.push(s + '@' + W.daysBetween(MON, day)); d = doJob(d, g, s, day); }
  }
  assert.deepEqual(order, ['hello@0', 'fix@0', 'games@0', 'story@1', 'practice@1']);
  assert.equal(job(d, g, plus(2)), 'test');
});
test('a test tomorrow: every job fits today', () => {
  let { d, g } = made(undefined, { test: plus(1) });
  for (const s of St.BEFORE_TEST) { assert.equal(job(d, g, MON), s); d = doJob(d, g, s, MON); }
  assert.equal(status(d, g, MON), 'ready');
});
test('moving the test date moves the plan', () => {
  let { d, g } = made(undefined, { test: plus(7) });
  const r = W.editGroup(d, 'g1', { test: plus(3) }, MON, at(MON));
  assert.equal(St.stepDates(W.groupById(r.doc, 'g1')).practice, plus(2));
});

// ---- Practise 3 times ----------------------------------------------------------------------
test('a game or Fix try is a grid cell like any other: stars and remembered', () => {
  let { d, g } = made(['fruit'], { test: plus(9) });
  d = pass(d, g, 'fruit', plus(1), { source: 'g' });
  assert.equal(W.cell(d, g, 'fruit', plus(1)), 'clean');
  assert.equal(W.starsOn(d, g, plus(1)), 1);
  d = pass(d, g, 'fruit', plus(4), { source: 'x' });
  d = pass(d, g, 'fruit', plus(8), { source: 'g' });
  assert.equal(W.isRemembered(d, 'fruit'), true);
});
test('after the test a word still to fix counts as a fix-up, whatever page it\'s spelled on', () => {
  let { d, g } = made(['fruit'], { test: plus(3) });
  d = pass(d, g, 'fruit', plus(3), { kind: 't', clean: false, tries: 1 });
  assert.equal(W.kindOn(d, g, 'fruit', plus(2)), 'p');
  assert.equal(W.kindOn(d, g, 'fruit', plus(4)), 'f');
  d = row3(d, g, 'fruit', plus(4), { kind: W.kindOn(d, g, 'fruit', plus(4)) });
  assert.deepEqual(W.fixups(d, g), []);
});

// ---- jobs, clues, sentences in the saved value -----------------------------------------------
test('a job\'s mark, a clue and a sentence are saved and merge', () => {
  const { d, g } = made();
  const a = W.addNote(W.setClue(mark(d, g, 'hello', MON), 'fruit', 'old', at(MON)), { id: 'n1', group: 'g1', word: 'fruit', text: 'I ate some fruit today.', day: MON, now: at(MON) });
  const b = W.addNote(W.setClue(mark(d, g, 'hello', plus(1)), 'fruit', 'newer', at(plus(1))), { id: 'n2', group: 'g1', word: 'earth', text: 'The earth is very round.', day: plus(1), now: at(plus(1)) });
  const m = W.merge(a, b);
  assert.equal(W.stepDay(m, g, 'hello'), MON, 'the first time a job was done');
  assert.equal(W.clueFor(m, 'fruit'), 'newer');
  assert.deepEqual(m.notes.map((x) => x.id), ['n1', 'n2']);
  assert.deepEqual(W.merge(m, m), m);
  assert.deepEqual(W.normalise(JSON.parse(JSON.stringify(m))), m);
});
test('a reset clears jobs, clues and sentences', () => {
  const { d, g } = made();
  const a = W.setClue(mark(d, g, 'hello', MON), 'fruit', 'x', at(MON));
  const m = W.merge(a, W.reset(at(plus(1))));
  assert.deepEqual([m.steps, m.clues, m.notes], [{}, {}, []]);
});
test('trimming keeps the newest sentences and drops jobs of deleted groups', () => {
  let { d, g } = made();
  for (let i = 0; i < 100; i += 1) d = W.addNote(d, { id: 'n' + i, group: 'g1', word: 'fruit', text: 'x'.repeat(100), day: MON, now: at(MON) + i });
  d = mark(d, g, 'hello', MON);
  d = { ...d, steps: { ...d.steps, 'gone|hello': { d: MON, at: at(MON) } }, results: Array.from({ length: 600 }, (_, i) => ({ id: 'x' + i, w: 'fruit', d: MON, g: 'g1', k: 'p', t: 0, p: 0, c: 1, at: at(MON) + i })) };
  const t = W.trim(d, at(plus(1)));
  assert.equal(t.notes.length, W.MAX_NOTES);
  assert.equal(t.notes.at(-1).id, 'n99');
  assert.ok(!('gone|hello' in t.steps));
  assert.ok(W.sizeOf(t) <= W.TRIM_TO);
});
test('trimming drops the part marks of a job that\'s done, and keeps those of one under way', () => {
  let { d, g } = made();
  d = mark(mark(mark(d, g, 'fix:0', MON), g, 'fix', MON), g, 'hello:0', MON);
  d = { ...d, results: Array.from({ length: 600 }, (_, i) => ({ id: 'x' + i, w: 'fruit', d: MON, g: 'g1', k: 'p', t: 0, p: 0, c: 1, at: at(MON) + i })) };
  assert.deepEqual(Object.keys(W.trim(d, at(plus(1))).steps).sort(), ['g1|fix', 'g1|hello:0']);
});
test('a clue is cut to size; an empty one is no clue', () => {
  const { d } = made();
  assert.equal(W.clueFor(W.setClue(d, 'fruit', ' ' + 'y'.repeat(200), 1), 'fruit').length, W.MAX_CLUE);
  assert.equal(W.clueFor(W.setClue(d, 'fruit', '  ', 1), 'fruit'), '');
});
test('clue choices come from the word itself', () => {
  assert.deepEqual(St.clueOptions({ word: 'build', chunks: ['build'], tricky: 'ui' }), ['Watch the letters ui in build', 'Chant the letters: b-u-i-l-d']);
  assert.equal(St.clueOptions({ word: 'different', chunks: ['dif', 'fer', 'ent'] })[0], 'Say every part: dif · fer · ent');
});
test('three words for sentences: those with the fewest so far', () => {
  let { d, g } = made(['fruit', 'earth', 'heart', 'guard']);
  assert.deepEqual(St.sentenceWords(d, g), ['fruit', 'earth', 'heart']);
  d = W.addNote(d, { id: 'a', group: 'g1', word: 'fruit', text: 'x', day: MON, now: 1 });
  assert.deepEqual(St.sentenceWords(d, g), ['earth', 'heart', 'guard']);
});
test('a sentence: the word spelled right, and at least 4 words', () => {
  assert.equal(St.checkSentence('I like to build dens.', 'build'), '');
  assert.equal(St.checkSentence('Build me a den!', 'build'), '');
  assert.equal(St.checkSentence('She builds huge sandcastles.', 'build'), '');
  assert.match(St.checkSentence('I like to bild dens.', 'build'), /Use the word build/);
  assert.match(St.checkSentence('I build.', 'build'), /at least 4/);
  assert.match(St.checkSentence('   ', 'build'), /Use the word/);
  assert.match(St.checkSentence('A rebuilding of walls.', 'build'), /Use the word/, 'inside another word doesn\'t count');
});

// ---- Study or Game --------------------------------------------------------------------------
test('Game mode: open any time, except while the test is due', () => {
  let { d, g } = made(['fruit'], { test: plus(3) });
  assert.equal(St.gamesOpen(d, g, MON), true);
  assert.equal(St.gamesOpen(d, g, plus(3)), true, 'test day with jobs waiting: they need the words');
  d = studied(d, g, MON);
  assert.equal(St.gamesOpen(d, g, plus(3)), false, 'no word on show on test day');
  assert.equal(St.gamesOpen(d, g, plus(5)), false, 'a test not yet taken');
  d = pass(d, g, 'fruit', plus(3), { kind: 't' });
  assert.equal(St.gamesOpen(d, g, plus(3)), true);
});
test('Game mode doesn\'t move the guided week on', () => {
  let { d, g } = made(['fruit']);
  d = pass(d, g, 'fruit', MON, { source: 'g' });
  assert.equal(job(d, g, MON), 'hello');
});
test('the group page has the switch; each mode has its own address', () => {
  const v = readFileSync(fileURLToPath(new URL('../site/js/words-views.js', import.meta.url)), 'utf8');
  assert.match(v, /modeSwitch\(g, 'study'\)/);
  const gv = readFileSync(fileURLToPath(new URL('../site/js/games-views.js', import.meta.url)), 'utf8');
  assert.match(gv, /modeSwitch\(g, 'game'\)/);
});
test('the study and game pages count as busy, so nothing redraws under them', () => {
  for (const p of ['words/g/g1/study/hello', 'words/g/g1/study/fix', 'words/g/g1/game/quick']) assert.equal(isPlayPath(p), true, p);
  for (const p of ['words/g/g1', 'words/g/g1/games', '']) assert.equal(isPlayPath(p), false, p);
  assert.equal(isWordsPath('grownups/stories'), true);
});

// ---- My room ---------------------------------------------------------------------------------
test('room: before any group', () => {
  const r = St.roomState(W.emptyDoc(), MON);
  assert.equal(r.status, 'none');
  assert.equal(r.group, null);
});
test('room: today\'s job, with stars, the test date and the strip', () => {
  let { d, g } = made(['fruit']);
  d = mark(d, g, 'hello', MON);
  const r = St.roomState(d, plus(1));
  assert.equal(r.status, 'job');
  assert.equal(r.step.id, 'fix');
  assert.equal(r.test, plus(7));
  assert.equal(r.pip, 'happy');
  assert.equal(r.strip[0].state, 'done');
  assert.equal(r.strip[1].state, 'today');
  assert.equal(r.strip[2].state, 'later');
});
test('room: stars add up over the week', () => {
  let { d, g } = made(['fruit', 'earth']);
  d = pass(d, g, 'fruit', plus(1));
  d = pass(d, g, 'earth', plus(1));
  d = pass(d, g, 'fruit', plus(2));
  assert.equal(St.roomState(d, plus(2)).stars, 3);
});
test('room: done for today cheers; a job that waited makes Pip think', () => {
  let { d, g } = made();
  const before = St.roomState(d, plus(2));
  assert.equal(before.pip, 'thinking');
  d = mark(d, g, 'hello', MON);
  const r = St.roomState(d, MON);
  assert.equal(r.status, 'done');
  assert.equal(r.pip, 'cheering');
});
test('room: a rest day; every job done', () => {
  let { d, g } = made();
  for (const [s, k] of [['hello', 0], ['fix', 1], ['games', 2]]) d = doJob(d, g, s, plus(k));
  assert.equal(St.roomState(d, plus(3)).status, 'rest');
  assert.equal(St.roomState(d, plus(3)).pip, 'happy');
  for (const [s, k] of [['story', 4], ['practice', 5]]) d = doJob(d, g, s, plus(k));
  assert.equal(St.roomState(d, plus(6)).status, 'ready');
});
test('room: on test day the words stay hidden and Pip thinks', () => {
  const m = made(undefined, { test: plus(5) });
  const d = studied(m.d, m.g, plus(1));
  const r = St.roomState(d, plus(5));
  assert.equal(r.step.id, 'test');
  assert.equal(r.hideWords, true);
  assert.equal(r.pip, 'thinking');
});
test('room: ready for the test shows up as soon as every word has its dots', () => {
  let { d, g } = made(['fruit']);
  d = row3(d, g, 'fruit', plus(3));
  assert.equal(St.roomState(d, plus(3)).ready, true);
});
test('room: finished, then the next group takes over', () => {
  let { d, g } = made(['fruit'], { test: plus(2) });
  d = doJob(d, g, 'test', plus(2));
  d = mark(d, g, 'mend', plus(3));
  assert.equal(St.roomState(d, plus(3)).status, 'finished');
  const r2 = W.createGroup(d, { id: 'g2', name: 'Next', test: plus(9), words: ['earth'], today: plus(4), now: at(plus(4)) });
  const r = St.roomState(r2.doc, plus(4));
  assert.equal(r.group.id, 'g2');
  assert.equal(r.step.id, 'hello');
});
test('room: a group with a job comes before one resting', () => {
  let { d, g } = made(['fruit'], { test: plus(9), id: 'a' });
  d = mark(d, g, 'hello', MON);
  const r2 = W.createGroup(d, { id: 'b', name: 'B', test: plus(12), words: ['earth'], today: MON, now: at(MON) });
  assert.equal(St.studyGroup(r2.doc, MON).id, 'b');
});
