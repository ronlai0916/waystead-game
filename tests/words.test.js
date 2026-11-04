// "My words" (site/js/words-doc.js, spell-run.js, wordcheck.js): groups, the
// daily plan, the grid, the test, fix-ups, remembered, words that come back,
// merging, and the word data. A fake clock throughout: `today` is passed in.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as R from '../site/js/spell-run.js';
import { usableWord, cleanWord } from '../site/js/wordcheck.js';
import { isPlayPath } from '../site/js/gate.js';
import { chunked, chunkText } from '../site/js/ui.js';
import { createSync } from '../shared/account/sync.js';
import { forgetPlayer } from '../shared/account/forget.js';
import { loadWordGraph, isWord } from '../wordbright/site/js/engine/words.js';

const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const MON = '2026-11-02';
let n = 0;
const id = () => 'r' + (++n);
const at = (day, h = 12) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':00:00Z');

function made(words = ['fruit', 'earth', 'heart'], opts = {}, d = W.emptyDoc()) {
  const today = opts.today || MON;
  const r = W.createGroup(d, { id: opts.id || 'g1', name: opts.name ?? 'Week one', test: opts.test, words, today, now: at(today) });
  assert.ok(r.doc, r.error);
  return { d: r.doc, g: W.groupById(r.doc, opts.id || 'g1') };
}
const attempt = (d, g, word, day, { kind = 'p', tries = 0, peeks = 0, clean = true, hour = 12 } = {}) =>
  W.addTry(d, { id: id(), word, day, group: g.id, kind, tries, peeks, clean, now: at(day, hour) });
const cleanFirst = (d, g, word, day) => attempt(d, g, word, day);
function runAll(run, letters) {
  let r = run;
  let finished = false;
  for (const L of letters) { const x = R.typeLetter(r, L); r = x.run; finished = x.finished; }
  return { run: r, finished };
}

// ---- groups ------------------------------------------------------------------------
test('a group: a name, a test date 7 days on by default, up to 10 words', () => {
  const { g } = made();
  assert.equal(g.name, 'Week one');
  assert.equal(g.test, '2026-11-09');
  assert.equal(g.start, MON);
  assert.deepEqual(g.words, ['fruit', 'earth', 'heart']);
  const named = W.createGroup(W.emptyDoc(), { id: 'x', name: ' ', words: ['fruit'], today: MON, now: 1 });
  assert.equal(named.doc.groups.x.name, 'Words for 9 Nov');
  const eleven = Array.from({ length: 11 }, (_, i) => 'w' + i);
  assert.match(W.createGroup(W.emptyDoc(), { id: 'x', words: eleven, today: MON, now: 1 }).error, /up to 10/);
  assert.match(W.createGroup(W.emptyDoc(), { id: 'x', words: [], today: MON, now: 1 }).error, /at least one/);
  assert.match(W.createGroup(W.emptyDoc(), { id: 'x', words: ['a1'], test: MON, today: MON, now: 1 }).error, /after today/);
  assert.equal(W.createGroup(W.emptyDoc(), { id: 'x', words: ['fruit', 'fruit'], today: MON, now: 1 }).doc.groups.x.words.length, 1);
});

test('editing: words and date until the test day; renaming and deleting any day', () => {
  const { d, g } = made();
  const edited = W.editGroup(d, g.id, { name: 'New name', words: ['fruit'], test: '2026-11-12' }, '2026-11-08', at('2026-11-08')).doc;
  assert.deepEqual(W.groupById(edited, g.id).words, ['fruit']);
  assert.equal(W.groupById(edited, g.id).test, '2026-11-12');
  assert.match(W.editGroup(d, g.id, { words: ['fruit'] }, '2026-11-09', 2).error, /test day/);
  assert.match(W.editGroup(d, g.id, { test: '2026-11-20' }, '2026-11-10', 2).error, /test day/);
  const renamed = W.editGroup(d, g.id, { name: 'Later', words: g.words, test: g.test }, '2026-11-10', 2).doc;
  assert.equal(W.groupById(renamed, g.id).name, 'Later', 'the same words and date are no change');
  assert.match(W.editGroup(d, g.id, { name: ' ' }, MON, 2).error, /name/);
  assert.equal(W.canEdit(g, '2026-11-08'), true);
  assert.equal(W.canEdit(g, '2026-11-09'), false);
});

test('deleting a group keeps its tries: they still count', () => {
  const { d, g } = made();
  const tried = cleanFirst(d, g, 'fruit', MON);
  const gone = W.deleteGroup(tried, g.id, at(MON, 13));
  assert.equal(W.groupById(gone, g.id), null);
  assert.equal(W.liveGroups(gone).length, 0);
  assert.equal(W.overall(gone).practised, 1);
  assert.equal(W.needsStarter(gone), false, 'a player who deleted everything gets no new starter');
});

test('the starter group: one id, made once, and anything real from another device wins', () => {
  const d = W.emptyDoc();
  assert.equal(W.needsStarter(d), true);
  const s = W.starterGroup(d, { name: 'First steps', words: Array.from({ length: 12 }, (_, i) => 'w' + i), today: MON });
  assert.equal(W.needsStarter(s), false);
  const g = W.groupById(s, W.STARTER_ID);
  assert.equal(g.words.length, 10);
  assert.equal(g.test, '2026-11-09');
  const renamed = W.editGroup(s, W.STARTER_ID, { name: 'Mine' }, MON, at(MON)).doc;
  const other = W.starterGroup(W.emptyDoc(), { name: 'First steps', words: ['fruit'], today: '2026-11-03' });
  assert.equal(W.groupById(W.merge(other, renamed), W.STARTER_ID).name, 'Mine');
  assert.equal(W.groupById(W.merge(renamed, other), W.STARTER_ID).name, 'Mine');
  const after = W.reset(500);
  assert.ok(W.groupById(W.merge(after, W.starterGroup(after, { name: 'x', words: ['fruit'], today: MON })), W.STARTER_ID), 'a starter after a reset survives it');
});

// ---- typed words ---------------------------------------------------------------------
const graph = loadWordGraph(readFileSync(file('wordbright/site/data/words_all.dawg')));
const curriculum = JSON.parse(readFileSync(file('site/data/curriculum.json'), 'utf8'));
const allEntries = ['year_3_4', 'year_5_6'].flatMap((y) => curriculum[y].chapters.flatMap((c) => c.words));
const findEntry = (w) => allEntries.find((e) => e.word.toLowerCase() === w) || null;
const check = (raw) => usableWord(raw, { findEntry, inList: (w) => isWord(w, graph) });

test('typed words: ours are taken; unknown and blocked ones are refused', () => {
  assert.equal(check(' Fruit '), 'fruit', 'the curriculum');
  assert.equal(check('february'), 'February', 'with its own capital');
  assert.equal(check('kitten'), 'kitten', 'Wordbright\'s list');
  assert.equal(check('zzzqqq'), null, 'unknown');
  assert.equal(check('two words'), null);
  assert.equal(check('x'), null);
  assert.equal(check('a'.repeat(21)), null);
  assert.equal(cleanWord('  HeLLo '), 'hello');
  const blocked = readFileSync(file('wordbright-design/wordlist/excluded_full.txt'), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')[0]);
  assert.ok(blocked.length > 1000);
  const passed = blocked.filter((w) => check(w) !== null && !findEntry(w));
  assert.deepEqual(passed, [], 'nothing on the blocklist gets through');
});

// ---- the daily plan --------------------------------------------------------------------
test('days unlock by the date: practise, then the test, then fix-ups', () => {
  const { d, g } = made(['fruit', 'earth']);
  assert.deepEqual(W.practiceDays(g), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.equal(W.jobFor(d, g, MON), 'practise');
  assert.equal(W.jobFor(d, g, '2026-11-08'), 'practise', 'the day before');
  assert.equal(W.jobFor(d, g, '2026-11-09'), 'test', 'on the date');
  assert.equal(W.jobFor(d, g, '2026-11-11'), 'test', 'a missed test waits');
  let t = attempt(d, g, 'fruit', '2026-11-09', { kind: 't' });
  assert.equal(W.jobFor(t, g, '2026-11-09'), 'test', 'one word still to answer');
  t = attempt(t, g, 'earth', '2026-11-09', { kind: 't', tries: 1, clean: false });
  assert.equal(W.jobFor(t, g, '2026-11-09'), 'wait', 'fix-ups aren\'t until tomorrow');
  assert.equal(W.jobFor(t, g, '2026-11-10'), 'fixups', 'the day after the test');
  const clean = attempt(attempt(d, g, 'fruit', '2026-11-09', { kind: 't' }), g, 'earth', '2026-11-09', { kind: 't' });
  assert.equal(W.jobFor(clean, g, '2026-11-10'), 'finished', 'nothing slipped');
});

test('dates cross months and clocks: the local day, adding days', () => {
  assert.equal(W.addDays('2026-12-30', 7), '2027-01-06');
  assert.equal(W.daysBetween('2026-10-20', '2026-11-03'), 14);
  assert.equal(W.dayLabel('2026-11-10'), 'Tue 10 Nov');
  assert.deepEqual(W.dayParts('2026-11-10'), ['Tue', '10']);
  assert.equal(W.localDay(new Date(2026, 10, 3, 23, 59).getTime()), '2026-11-03');
});

// ---- the grid and spelling a word --------------------------------------------------------
test('letters are checked one at a time; a wrong one counts and fills nothing', () => {
  let r = R.newRun('build');
  let x = R.typeLetter(r, 'B');
  assert.deepEqual([x.hit, x.finished, x.run.at], [true, false, 1], 'capitals are fine');
  x = R.typeLetter(x.run, 'o');
  assert.deepEqual([x.hit, x.run.at, x.run.tries], [false, 1, 1]);
  r = x.run;
  assert.ok(R.WRONG_LINES.includes(R.wrongLine(r.tries)));
  assert.equal(R.mustRecord(r), true, 'left now, it still counts');
  const end = runAll(r, 'uild');
  assert.equal(end.finished, true);
  assert.equal(R.isClean(end.run), false);
  assert.equal(R.mustRecord(end.run), false);
  assert.equal(runAll(R.newRun('February'), 'february').finished, true);
});

test('a peek counts, and any mistake or peek needs a clean run after it', () => {
  const peeked = R.peek(R.newRun('fruit'));
  assert.equal(peeked.peeks, 1);
  assert.equal(R.isClean(runAll(peeked, 'fruit').run), false);
  const next = R.again(peeked);
  assert.deepEqual([next.at, next.tries, next.peeks], [0, 0, 0]);
  assert.equal(R.isClean(runAll(next, 'fruit').run), true);

  const { d, g } = made();
  const first = attempt(d, g, 'fruit', MON, { peeks: 1, clean: false });
  assert.equal(W.cell(first, g, 'fruit', MON), 'todo', 'not done until the clean run');
  assert.equal(W.doneOn(first, g, 'fruit', MON), false);
  const second = attempt(first, g, 'fruit', MON, { hour: 13 });
  assert.equal(W.cell(second, g, 'fruit', MON), 'help', 'done with help');
  assert.equal(W.starsOn(second, g, MON), 0, 'no star: that was not clean the first time');
  const other = attempt(second, g, 'earth', MON);
  assert.equal(W.cell(other, g, 'earth', MON), 'clean');
  assert.equal(W.starsOn(other, g, MON), 1);
  assert.equal(W.cell(other, g, 'heart', MON), 'todo');
  const later = attempt(other, g, 'fruit', '2026-11-03');
  assert.equal(W.cell(later, g, 'fruit', '2026-11-03'), 'clean', 'each day starts again');
});

test('every try is kept: word, date, wrong letters, peeks, clean and time', () => {
  const { d, g } = made();
  const out = attempt(d, g, 'fruit', MON, { tries: 2, peeks: 1, clean: false });
  const r = out.results[0];
  assert.deepEqual([r.w, r.d, r.t, r.p, r.c, r.k, r.g, r.at], ['fruit', MON, 2, 1, 0, 'p', 'g1', at(MON)]);
});

// ---- the test ----------------------------------------------------------------------------
test('the test: one go each, and nothing says right or wrong until the end', () => {
  const t = R.createTest(['fruit', 'earth']);
  assert.equal(t.current(), 'fruit');
  assert.deepEqual(t.answer(''), { next: 'fruit' }, 'an empty answer isn\'t a go');
  assert.equal(t.results(), null);
  const step = t.answer('froot');
  assert.deepEqual(Object.keys(step), ['next'], 'no verdict');
  assert.equal(t.results(), null, 'nothing until every word is answered');
  t.answer('EARTH');
  assert.deepEqual(t.results().map((x) => x.right), [false, true]);
  assert.equal(t.current(), null);
  const again = t.answer('fruit');
  assert.equal(again.next, null, 'no second go');
  assert.equal(t.results().length, 2);
});

test('a test left halfway carries on with the words left, and the first answer stands', () => {
  const { d, g } = made(['fruit', 'earth']);
  const half = attempt(d, g, 'fruit', '2026-11-09', { kind: 't', tries: 1, clean: false });
  assert.deepEqual(W.testLeft(half, g), ['earth']);
  assert.equal(W.testDone(half, g), false);
  const twice = attempt(half, g, 'fruit', '2026-11-09', { kind: 't', hour: 13 });
  assert.equal(W.testResults(twice, g)[0].result.right, false);
});

test('back-again words join the practice but not the test', () => {
  const a = made(['fruit']);
  const tested = attempt(a.d, a.g, 'fruit', '2026-11-09', { kind: 't', hour: 8 });
  const b = made(['earth'], { id: 'g2', today: '2026-11-09', test: '2026-11-16' }, tested);
  assert.deepEqual(b.g.back, ['fruit']);
  assert.deepEqual(W.rows(b.g), ['earth', 'fruit']);
  assert.deepEqual(W.testLeft(b.d, b.g), ['earth']);
});

// ---- fix-ups -------------------------------------------------------------------------------
test('fix-ups: the words that slipped, until spelled clean at a first go', () => {
  const { d, g } = made(['fruit', 'earth', 'heart']);
  let t = attempt(d, g, 'fruit', '2026-11-09', { kind: 't' });
  t = attempt(t, g, 'earth', '2026-11-09', { kind: 't', tries: 1, clean: false });
  t = attempt(t, g, 'heart', '2026-11-09', { kind: 't', tries: 1, clean: false });
  assert.deepEqual(W.fixups(t, g), ['earth', 'heart']);
  // Tuesday: earth clean at once; heart needs a mistake and a clean run.
  t = attempt(t, g, 'earth', '2026-11-10', { kind: 'f' });
  assert.deepEqual(W.fixups(t, g), ['heart']);
  assert.equal(W.jobFor(t, g, '2026-11-10'), 'fixups');
  t = attempt(t, g, 'heart', '2026-11-10', { kind: 'f', tries: 2, clean: false });
  t = attempt(t, g, 'heart', '2026-11-10', { kind: 'f', hour: 13 });
  assert.equal(W.jobFor(t, g, '2026-11-10'), 'fixed-today', 'done for today');
  assert.deepEqual(W.fixups(t, g), ['heart'], 'it comes back');
  assert.equal(W.jobFor(t, g, '2026-11-11'), 'fixups');
  t = attempt(t, g, 'heart', '2026-11-11', { kind: 'f' });
  assert.deepEqual(W.fixups(t, g), []);
  assert.equal(W.jobFor(t, g, '2026-11-11'), 'finished');
});

// ---- remembered ------------------------------------------------------------------------------
test('remembered: clean and unaided on 3 different days spanning at least 7', () => {
  const { d, g } = made(['fruit']);
  let t = cleanFirst(d, g, 'fruit', '2026-11-02');
  t = cleanFirst(t, g, 'fruit', '2026-11-03');
  assert.equal(W.isRemembered(t, 'fruit'), false);
  t = cleanFirst(t, g, 'fruit', '2026-11-05');
  assert.equal(W.isRemembered(t, 'fruit'), false, 'three days, but only 3 days apart');
  t = cleanFirst(t, g, 'fruit', '2026-11-08');
  assert.equal(W.isRemembered(t, 'fruit'), false, 'six days apart');
  t = cleanFirst(t, g, 'fruit', '2026-11-09');
  assert.equal(W.isRemembered(t, 'fruit'), true, 'seven');
});

test('remembered: two days can\'t do it however far apart, and a re-run after a mistake doesn\'t count', () => {
  const { d, g } = made(['fruit']);
  let t = cleanFirst(d, g, 'fruit', '2026-11-02');
  t = cleanFirst(t, g, 'fruit', '2026-11-20');
  assert.equal(W.isRemembered(t, 'fruit'), false);
  t = attempt(t, g, 'fruit', '2026-11-10', { tries: 1, clean: false });
  t = attempt(t, g, 'fruit', '2026-11-10', { hour: 13 });
  assert.deepEqual(W.goodDays(t, 'fruit'), ['2026-11-02', '2026-11-20'], 'the first go that day had a mistake');
  const peeked = attempt(t, g, 'fruit', '2026-11-11', { peeks: 1, clean: false });
  assert.deepEqual(W.goodDays(peeked, 'fruit').length, 2);
});

test('remembered: the test counts as one of the days, if passed', () => {
  const { d, g } = made(['fruit', 'earth']);
  let t = cleanFirst(d, g, 'fruit', '2026-11-02');
  t = cleanFirst(t, g, 'fruit', '2026-11-05');
  t = attempt(t, g, 'fruit', '2026-11-09', { kind: 't' });
  assert.equal(W.isRemembered(t, 'fruit'), true);
  let u = cleanFirst(d, g, 'earth', '2026-11-02');
  u = cleanFirst(u, g, 'earth', '2026-11-05');
  u = attempt(u, g, 'earth', '2026-11-09', { kind: 't', tries: 1, clean: false });
  assert.equal(W.isRemembered(u, 'earth'), false);
  // A test right still counts on a day that began with a mistake in another group.
  let v = attempt(d, g, 'earth', '2026-11-09', { tries: 1, clean: false, hour: 8 });
  v = attempt(v, g, 'earth', '2026-11-09', { kind: 't' });
  assert.deepEqual(W.goodDays(v, 'earth'), ['2026-11-09']);
});

// ---- words that come back ----------------------------------------------------------------------
test('returning words: up to 3 from earlier groups, slipped ones first, never remembered ones', () => {
  const a = made(['fruit', 'earth', 'heart', 'learn', 'group']);
  let d = a.d;
  for (const w of ['fruit', 'earth', 'heart', 'learn']) d = attempt(d, a.g, w, '2026-11-09', { kind: 't' });
  d = attempt(d, a.g, 'group', '2026-11-09', { kind: 't', tries: 1, clean: false });
  // heart is remembered by the end of the group.
  for (const day of ['2026-11-02', '2026-11-05']) d = cleanFirst(d, a.g, 'heart', day);
  const older = made(['earth', 'build', 'guide', 'reign'], { id: 'g0', today: '2026-11-01', test: '2026-11-03' }, d);
  d = older.d;
  for (const w of ['earth', 'build', 'guide', 'reign']) d = attempt(d, older.g, w, '2026-11-03', { kind: 't' });
  const back = W.returningWords(d, '2026-11-10', ['learn'], 3);
  assert.equal(back.length, 3);
  assert.equal(back[0], 'group', 'slipped first');
  assert.ok(!back.includes('heart'), 'remembered');
  assert.ok(!back.includes('learn'), 'already in the new group');
  const next = made(['learn', 'build'], { id: 'g2', today: '2026-11-10', test: '2026-11-17' }, d);
  assert.deepEqual(next.g.back, W.returningWords(d, '2026-11-10', ['learn', 'build'], 3));
  assert.ok(!next.g.back.includes('build'));
  assert.ok(next.g.back.length <= W.MAX_BACK);
});

test('returning words: a group still before its test keeps its own words', () => {
  const a = made(['fruit']);
  assert.deepEqual(W.returningWords(a.d, '2026-11-05', []), []);
  assert.deepEqual(W.returningWords(a.d, '2026-11-09', []), [], 'nor while its test is due');
  assert.deepEqual(W.returningWords(attempt(a.d, a.g, 'fruit', '2026-11-09', { kind: 't' }), '2026-11-09', []), ['fruit'], 'once it\'s taken');
  const b = made(['earth'], { id: 'g2', today: '2026-11-05' }, a.d);
  assert.deepEqual(b.g.back, []);
});

test('a group\'s words can\'t be its back-again words', () => {
  const a = made(['fruit']);
  const b = made(['earth'], { id: 'g2', today: '2026-11-09', test: '2026-11-16' }, a.d);
  const e = W.editGroup(b.d, 'g2', { words: ['earth', 'fruit'] }, '2026-11-10', at('2026-11-10')).doc;
  assert.deepEqual(W.groupById(e, 'g2').back, []);
});

// ---- progress --------------------------------------------------------------------------------------
test('progress: per group and overall, plain counts', () => {
  const { d, g } = made(['fruit', 'earth', 'heart']);
  let t = attempt(d, g, 'fruit', MON, { tries: 2, peeks: 1, clean: false });
  t = attempt(t, g, 'fruit', MON, { hour: 13 });
  t = cleanFirst(t, g, 'earth', MON);
  const p = W.groupProgress(t, g);
  assert.deepEqual(p.words.map((x) => x.status), ['practising', 'practising', 'new']);
  assert.deepEqual([p.tries, p.peeks, p.of], [2, 1, 3]);
  assert.deepEqual(p.stars[0], { day: MON, stars: 1 });
  t = attempt(t, g, 'earth', '2026-11-09', { kind: 't' });
  assert.equal(W.groupProgress(t, g).words[1].status, 'test passed');
  assert.deepEqual(W.overall(t), { remembered: 0, practised: 2, firstGoes: 3, clean: 2, independent: 67 });
  assert.deepEqual(W.overall(W.emptyDoc()), { remembered: 0, practised: 0, firstGoes: 0, clean: 0, independent: 0 });
});

// ---- merge -------------------------------------------------------------------------------------------
test('merge: tries are the union by id, counted from the records, the same either way', () => {
  const { d, g } = made(['fruit', 'earth']);
  const phone = attempt(d, g, 'fruit', MON, { hour: 9 });
  const tablet = attempt(attempt(d, g, 'earth', MON, { hour: 10 }), g, 'fruit', '2026-11-03');
  const both = W.merge(phone, tablet);
  assert.equal(both.results.length, 3);
  assert.deepEqual(W.merge(tablet, phone), both);
  assert.deepEqual(W.merge(both, both), both, 'merging again adds nothing');
  assert.equal(W.overall(both).firstGoes, 3);
  assert.equal(W.starsOn(both, g, MON), 2);
});

test('merge: a group\'s newest copy wins; a delete stands; its tries stay; reset wipes earlier tries', () => {
  const { d, g } = made(['fruit']);
  const renamed = W.editGroup(d, g.id, { name: 'Phone' }, MON, at(MON, 13)).doc;
  const tried = attempt(d, g, 'fruit', MON, { hour: 14 });
  const gone = W.deleteGroup(tried, g.id, at(MON, 15));
  const m = W.merge(renamed, gone);
  assert.equal(W.groupById(m, g.id), null);
  assert.equal(m.results.length, 1);
  const later = W.editGroup(d, g.id, { name: 'Later' }, MON, at(MON, 16)).doc;
  assert.equal(W.groupById(W.merge(gone, later), g.id).name, 'Later');
  const cleared = W.merge(tried, W.reset(at(MON, 20)));
  assert.equal(cleared.results.length, 0);
  assert.equal(W.liveGroups(cleared).length, 0);
});

// The real sync (shared/account/sync.js) against a server copy that has moved on.
test('a 409 from the account loses no tries, on either side', async () => {
  const { d, g } = made(['fruit', 'earth']);
  const mine = attempt(d, g, 'fruit', MON, { hour: 9 });
  const theirs = attempt(d, g, 'earth', MON, { hour: 10 });
  const server = { value: theirs, version: 5 };
  let local = mine;
  const storage = new Map();
  const api = {
    getGame: async () => ({ ok: true, data: { items: { words: { value: server.value, version: server.version } } } }),
    putItem: async (_g, _k, value, version) => {
      if (version !== server.version) return { ok: false, status: 409, data: { value: server.value, version: server.version } };
      server.value = value; server.version += 1;
      return { ok: true, status: 200, data: { version: server.version } };
    },
  };
  const sync = createSync({
    api, game: 'spellbright', playerId: 'p1',
    storage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) },
    docs: { words: { read: () => local, write: (v) => { local = W.normalise(v); }, merge: W.merge, prepare: (v) => W.trim(W.normalise(v), at(MON)) } },
    setTimer: () => 1, clearTimer: () => {},
  });
  sync.changed('words');
  await sync.flush(); // no version seen yet: the account answers 409
  assert.equal(new Set(W.normalise(local).results.map((r) => r.w)).size, 2, 'both tries here');
  assert.equal(W.normalise(server.value).results.length, 2, 'and on the account');
});

// ---- size -----------------------------------------------------------------------------------------------
test('trim: under the size cap, with remembered words, totals and stars kept', () => {
  const { d, g } = made(['fruit', 'earth', 'heart', 'learn', 'group', 'build', 'guard', 'heard', 'reign', 'guide']);
  let t = d;
  for (let i = 0; i < 90; i += 1) {
    const day = W.addDays('2026-01-01', i);
    for (const w of g.words) t = W.addTry(t, { id: id(), word: w, day, group: g.id, kind: 'p', tries: 1, peeks: 0, clean: false, now: at(day, 9) });
    for (const w of g.words) t = W.addTry(t, { id: id(), word: w, day, group: g.id, kind: 'p', tries: 0, peeks: 0, clean: true, now: at(day, 10) });
  }
  // fruit: clean first goes, long ago.
  const early = ['2025-11-01', '2025-11-04', '2025-11-10'];
  for (const day of early) t = cleanFirst(t, g, 'fruit', day);
  const before = W.overall(t);
  const tries = W.groupProgress(t, g).tries;
  assert.ok(W.sizeOf(t) > W.TRIM_AT);
  const small = W.trim(t, at('2026-06-01'));
  assert.ok(W.sizeOf(small) <= W.TRIM_TO, String(W.sizeOf(small)));
  assert.equal(W.isRemembered(small, 'fruit'), true);
  assert.deepEqual(W.overall(small), before);
  assert.equal(W.groupProgress(small, g).tries, tries);
  const merged = W.merge(small, t);
  assert.equal(W.isRemembered(merged, 'fruit'), true);
  assert.equal(W.groupProgress(merged, g).tries, tries, 'a folded try that arrives again isn\'t counted twice');
  assert.deepEqual(W.normalise(small), small, 'it survives being read back');
});

test('trim: a test folded away still counts', () => {
  const { d, g } = made(['fruit']);
  let t = attempt(d, g, 'fruit', '2026-11-09', { kind: 't', tries: 1, clean: false });
  for (let i = 0; i < 700; i += 1) t = W.addTry(t, { id: id(), word: 'earth', day: W.addDays('2026-12-01', i % 40), group: 'other', kind: 'p', tries: 0, peeks: 0, clean: true, now: at('2026-12-01') + i });
  const small = W.trim(t, at('2027-03-01'));
  assert.ok(small.results.length < t.results.length);
  assert.ok(small.folded['g1|fruit']);
  assert.deepEqual(W.slipped(small, g), ['fruit']);
  assert.equal(W.testDone(small, g), true);
});

test('normalise: rubbish in, the empty shape out', () => {
  assert.deepEqual(W.normalise(null), W.emptyDoc());
  assert.deepEqual(W.normalise({ v: 2 }), W.emptyDoc());
  const n1 = W.normalise({ v: 1, groups: { a: { name: 'x' } }, results: [{ id: 'r' }], folded: { nokey: {} } });
  assert.deepEqual(n1, W.emptyDoc());
});

// ---- wiring ---------------------------------------------------------------------------------------------
test('spelling a word and the test are play pages: no redraw under a child\'s hands', () => {
  assert.equal(isPlayPath('words/g/r1/spell/3'), true);
  assert.equal(isPlayPath('words/g/starter/test'), true);
  assert.equal(isPlayPath('words/g/r1'), false);
  assert.equal(isPlayPath('words'), false);
});

test('signing out forgets sb.words:<id> too, unless changes are waiting to send', () => {
  const store = new Map([['sb.words:p', '{}'], ['sb.words:other', '{}'], ['wa.player', '{}']]);
  const s = { getItem: (k) => (store.has(k) ? store.get(k) : null), removeItem: (k) => store.delete(k), keys: () => [...store.keys()] };
  forgetPlayer(s, 'p');
  assert.equal(store.has('sb.words:p'), false);
  assert.equal(store.has('sb.words:other'), true);
  store.set('sb.words:p', '{}');
  store.set('wa.sync:p:spellbright', JSON.stringify({ ver: {}, dirty: ['words'] }));
  forgetPlayer(s, 'p');
  assert.equal(store.has('sb.words:p'), true, 'the queue keeps it');
});

test('the word never shows in the address, and tricky letters stay out of the test', () => {
  const v = readFileSync(file('site/js/words-views.js'), 'utf8');
  assert.match(v, /\/spell\/' \+ W\.rows\(g\)\.indexOf\(w\)/);
  assert.ok(!/tricky: true/.test(v), 'My words never asks for the highlight');
  const views = readFileSync(file('site/js/views.js'), 'utf8');
  assert.equal(views.match(/tricky: true/g).length, 2, 'only the two study pages');
});

// ---- the word data ---------------------------------------------------------------------------------------
const ONE_SYLLABLE = { build: 'ui', earth: 'ear', fruit: 'ui', group: 'ou', guard: 'u', heard: 'ear', heart: 'ear', learn: 'ear', reign: 'eign', breath: 'ea', length: 'gth', strength: 'gth', guide: 'u', breathe: 'ea', strange: 'ange', straight: 'aigh', eight: 'eigh', caught: 'augh', eighth: 'ghth', height: 'eigh', though: 'ough', weight: 'eigh', thought: 'ough', through: 'ough', rhyme: 'rhy', yacht: 'ach', queue: 'ueue', bruise: 'ui', twelfth: 'fth' };
const RESPLIT = { interest: ['in', 'ter', 'est'], naughty: ['naugh', 'ty'], rhythm: ['rhy', 'thm'], vehicle: ['ve', 'hi', 'cle'], temperature: ['tem', 'per', 'a', 'ture'] };

test('the 29 one-syllable words are one chunk, with tricky letters inside them', () => {
  assert.equal(Object.keys(ONE_SYLLABLE).length, 29);
  for (const [word, tricky] of Object.entries(ONE_SYLLABLE)) {
    const e = findEntry(word);
    assert.deepEqual(e.chunks, [word], word);
    assert.equal(e.tricky, tricky, word);
    assert.ok(word.includes(tricky), word);
  }
});

test('the 5 re-split words go by syllable, with no tricky field', () => {
  for (const [word, chunks] of Object.entries(RESPLIT)) {
    const e = findEntry(word);
    assert.deepEqual(e.chunks, chunks, word);
    assert.equal(e.tricky, undefined, word);
  }
});

test('every word\'s chunks join to it, and only those 29 have tricky letters', () => {
  assert.equal(allEntries.length, 213);
  for (const e of allEntries) assert.equal(e.chunks.join(''), e.word);
  assert.equal(allEntries.filter((e) => e.tricky).length, 29);
});

// ---- G4b: whole words ---------------------------------------------------------------
test('G4b: a word is one whole word: no gap in the CSS, no space in the letters, segments mark the syllables', () => {
  const css = readFileSync(fileURLToPath(new URL('../site/css/app.css', import.meta.url)), 'utf8');
  const rule = (sel) => css.match(new RegExp('(?:^|\\n)' + sel.replace(/\./g, '\\.') + ' \\{([^}]*)\\}'))[1];
  assert.doesNotMatch(rule('.chunked'), /gap/);
  assert.match(rule('.chunked'), /flex-wrap: nowrap/, 'never split over two lines');
  assert.match(rule('.chunked__chunk'), /padding: 0 0 /, 'no side padding between the parts');
  assert.match(css, /\.chunked__chunk::after \{[^}]*left: 0\.04em; right: 0\.04em/, 'each segment stops short, so the syllables still show');
  const html = chunked({ word: 'bargain', chunks: ['bar', 'gain'] });
  assert.equal(html.replace(/<[^>]*>/g, ''), 'bargain');
  assert.equal((html.match(/chunked__chunk/g) || []).length, 2);
  assert.match(html, /aria-label="bargain, in parts: bar, gain"/);
});

test('G4b: tricky letters show only when asked for; the syllable line stays as it was', () => {
  const w = { word: 'build', chunks: ['build'], tricky: 'ui' };
  assert.equal((chunked(w, '', { tricky: true }).match(/is-tricky/g) || []).length, 2);
  assert.doesNotMatch(chunked(w), /is-tricky/);
  assert.equal(chunkText({ word: 'bargain', chunks: ['bar', 'gain'] }), 'bar · gain');
});

test('G4b: the grid boxes keep a small group spacing, as the word is hidden there', () => {
  const css = readFileSync(fileURLToPath(new URL('../site/css/app.css', import.meta.url)), 'utf8');
  assert.match(css, /\.spellboxes \{[^}]*gap: 6px 8px/);
});
