// SB3-C1b: the child's chosen week (child-doc.js weekChoice, pure) and roomState's optional group.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import * as C from '../site/js/child-doc.js';

const MON = '2026-11-02';
const plus = (n) => W.addDays(MON, n);
const at = (day, h = 12) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':00:00Z');
function two(testA = plus(5), testB = plus(12)) {
  let d = W.createGroup(W.emptyDoc(), { id: 'ga', name: 'Autumn', test: testA, words: ['fruit', 'earth'], today: MON, now: at(MON) }).doc;
  d = W.createGroup(d, { id: 'gb', name: 'Winter', test: testB, words: ['guard', 'heart'], today: MON, now: at(MON, 13) }).doc;
  return d;
}
let n = 0;
const pass = (d, g, word, day, { clean = true, tries = 0, kind = 'p', source, hour = 12 } = {}) =>
  W.addTry(d, { id: 'w' + (++n), word, day, group: g.id, kind, tries, peeks: 0, clean, source, now: at(day, hour) });
const threeTimes = (d, g, day, source) => [9, 10, 11].reduce((x, hour) => W.rows(g).reduce((y, w) => pass(y, g, w, day, { source, hour }), x), d);
function job(d, id, step, day) {
  const g = W.groupById(d, id);
  if (step === 'practice') return threeTimes(d, g, day);
  if (step === 'fix') return W.markStep(threeTimes(d, g, day, 'x'), g, step, day, at(day));
  return W.markStep(d, g, step, day, at(day));
}
const allJobs = (d, id, day) => St.BEFORE_TEST.reduce((x, s) => job(x, id, s, day), d);
const testAllRight = (d, id, day) => { const g = W.groupById(d, id); return g.words.reduce((x, w) => pass(x, g, w, day, { kind: 't' }), d); };

test('no choice: the pick is studyGroup\'s, nothing stale', () => {
  const d = two();
  const p = C.weekChoice(d, MON, '');
  assert.equal(p.group.id, St.studyGroup(d, MON).id);
  assert.equal(p.chosen, false);
  assert.equal(p.stale, false);
  assert.equal(p.canSwitch, true);
});

test('a valid choice wins, even over a week with a job waiting', () => {
  const d = two();
  const other = St.studyGroup(d, MON).id === 'ga' ? 'gb' : 'ga';
  const p = C.weekChoice(d, MON, other);
  assert.equal(p.group.id, other);
  assert.equal(p.chosen, true);
  assert.equal(p.stale, false);
  assert.deepEqual(p.weeks.map((w) => [w.id, w.current]).sort(), [['ga', other === 'ga'], ['gb', other === 'gb']]);
});

test('a gone, reset or unknown choice falls back and is reported stale', () => {
  const d = two();
  const base = St.studyGroup(d, MON).id;
  assert.equal(C.weekChoice(d, MON, 'nope').group.id, base);
  assert.equal(C.weekChoice(d, MON, 'nope').stale, true);
  const gone = { ...d, groups: { ...d.groups, gb: { ...d.groups.gb, gone: true } } };
  const pg = C.weekChoice(gone, MON, 'gb');
  assert.equal(pg.group.id, 'ga');
  assert.equal(pg.stale, true);
  assert.equal(pg.canSwitch, false);
  const reset = { ...d, resetAt: d.groups.ga.at };
  const pr = C.weekChoice(reset, MON, 'ga');
  assert.equal(pr.stale, true);
  assert.deepEqual(pr.weeks.map((w) => w.id), ['gb']);
});

test('a finished choice falls back, is stale, and is not offered', () => {
  let d = two(plus(3), plus(12));
  d = allJobs(d, 'ga', plus(2));
  let x = testAllRight(d, 'ga', plus(3));
  x = W.markStep(x, W.groupById(x, 'ga'), 'mend', plus(4), at(plus(4)));
  const p = C.weekChoice(x, plus(6), 'ga');
  assert.equal(St.studyState(x, W.groupById(x, 'ga'), plus(6)).status, 'finished');
  assert.equal(p.stale, true);
  assert.equal(p.group.id, 'gb');
});

test('rows: name, test date, job number, waiting, and Every job done', () => {
  let d = two(plus(5), plus(12));
  const rows = C.weekChoice(d, MON, '').weeks;
  const a = rows.find((w) => w.id === 'ga');
  assert.equal(a.name, 'Autumn');
  assert.equal(a.testLabel, 'Test ' + W.dayLabel(plus(5)));
  assert.equal(a.job, 'Job 1 of 7');
  assert.equal(a.waiting, false, 'its job is today\'s: nothing waiting yet');
  assert.equal(C.weekChoice(d, plus(2), '').weeks.find((w) => w.id === 'ga').waiting, true, 'days gone: waiting');
  assert.equal(a.due, false);
  // a week whose job is done for today: no jobs waiting
  d = job(d, 'gb', 'hello', MON);
  const b = C.weekChoice(d, MON, '').weeks.find((w) => w.id === 'gb');
  assert.equal(b.waiting, false);
  assert.equal(b.job, 'Job 2 of 7');
  assert.equal(C.weekChoice(d, MON, '').next, null, 'the shown week has its job: no pointer');
  d = allJobs(d, 'ga', MON);
  assert.equal(C.weekChoice(d, MON, '').weeks.find((w) => w.id === 'ga').job, 'Every job done');
});

test('a week with its test due says "Test ready", names only, and is reported in due', () => {
  let d = two(plus(3), plus(12));
  d = allJobs(d, 'ga', plus(2));
  const p = C.weekChoice(d, plus(3), 'gb');
  assert.equal(St.dueGroups(d, plus(3)).length, 1);
  const a = p.weeks.find((w) => w.id === 'ga');
  assert.equal(a.due, true);
  assert.equal(a.job, 'Test ready');
  assert.equal(a.waiting, false);
  assert.equal(p.group.id, 'gb');
  assert.deepEqual(p.due, [{ id: 'ga', name: 'Autumn' }]);
  const text = JSON.stringify(p.weeks);
  for (const w of ['fruit', 'earth']) assert.equal(text.includes(w), false, w + ' must not be in the list');
  // the shown week is the due one: nothing else due
  assert.deepEqual(C.weekChoice(d, plus(3), 'ga').due, []);
});

test('one week: no switcher', () => {
  const d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Only', test: plus(5), words: ['fruit'], today: MON, now: at(MON) }).doc;
  const p = C.weekChoice(d, MON, '');
  assert.equal(p.canSwitch, false);
  assert.equal(p.weeks.length, 1);
  assert.equal(p.group.id, 'g1');
  assert.equal(C.weekChoice(W.emptyDoc(), MON, '').group, null);
});

test('roomState: without the group it is today\'s; with it, that week', () => {
  const d = two();
  const base = St.roomState(d, MON);
  assert.equal(base.group.id, St.studyGroup(d, MON).id);
  assert.deepEqual(St.roomState(d, MON, null), base);
  assert.deepEqual(St.roomState(d, MON, undefined), base);
  const other = W.groupById(d, base.group.id === 'ga' ? 'gb' : 'ga');
  const r = St.roomState(d, MON, other);
  assert.equal(r.group.id, other.id);
  assert.equal(r.test, other.test);
  assert.equal(r.status, St.studyState(d, other, MON).status);
});

test('menuRows: My words opens the chosen week\'s page only when one is given', () => {
  const rows = (wordsGid) => C.menuRows({ gid: 'x', gamesOpen: true, hasGroup: true, wordsGid }).find((r) => r.id === 'words').href;
  assert.equal(rows(''), '#/words');
  assert.equal(rows('gb'), '#/words/g/gb');
});

test('sign-out forgets sb.week:<id> and the device preference is not in the account data', () => {
  const src = readFileSync(fileURLToPath(new URL('../shared/account/forget.js', import.meta.url)), 'utf8');
  assert.match(src, /'sb\.week'/);
  const store = readFileSync(fileURLToPath(new URL('../site/js/week-choice.js', import.meta.url)), 'utf8');
  assert.match(store, /'sb\.week:'/);
});

test('forgetPlayer removes sb.week:<id> (and only that player\'s)', async () => {
  const { forgetPlayer } = await import('../shared/account/forget.js');
  const m = new Map([['sb.week:p', 'g1'], ['sb.week:q', 'g2'], ['sb.words:p', '{}']]);
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => m.delete(k), keys: () => [...m.keys()] };
  const r = forgetPlayer(storage, 'p');
  assert.ok(r.removed.includes('sb.week:p'));
  assert.equal(m.has('sb.week:p'), false);
  assert.equal(m.get('sb.week:q'), 'g2');
});

test('next: the shown week has nothing today and another has a job: a pointer (names only)', () => {
  let d = two(plus(5), plus(12));
  d = job(d, 'ga', 'hello', MON); // Autumn done for today, Winter has Hello
  const p = C.weekChoice(d, MON, 'ga');
  assert.equal(p.group.id, 'ga');
  assert.equal(St.studyState(d, W.groupById(d, 'ga'), MON).status, 'done');
  assert.deepEqual(p.next, { id: 'gb', name: 'Winter' });
  assert.equal(C.weekChoice(d, MON, 'gb').next, null, 'the shown week has a job');
  assert.equal(JSON.stringify(p.next).includes('guard'), false);
});

test('next: none when the other week has nothing to do, or its test is due', () => {
  let d = two(plus(5), plus(12));
  d = job(d, 'ga', 'hello', MON);
  d = job(d, 'gb', 'hello', MON);
  assert.equal(C.weekChoice(d, MON, 'ga').next, null, 'both done for today');
  let e = two(plus(3), plus(12));
  e = allJobs(e, 'ga', plus(2));
  assert.equal(C.weekChoice(e, plus(3), 'gb').next, null, 'a due test gets the due line, not this one');
});
