// SB2c: practise each word 3 times in a row, retry at once, skip for later.
// A fake clock throughout: the day and the times are passed in.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import * as G from '../site/js/games-doc.js';
import * as R from '../site/js/spell-run.js';

const MON = '2026-11-02';
const plus = (n) => W.addDays(MON, n);
const base = (day) => Date.parse(day + 'T09:00:00Z');
const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
let n = 0;
function made(words = ['fruit', 'earth', 'heart'], test = plus(5)) {
  const r = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week', test, words, today: MON, now: base(MON) });
  return { d: r.doc, g: W.groupById(r.doc, 'g1') };
}
// One spelling, a minute after the last.
function spell(d, g, word, day, { clean = true, tries = clean ? 0 : 1, peeks = 0, kind = 'p', source } = {}) {
  n += 1;
  return W.addTry(d, { id: 'a' + n, word, day, group: g.id, kind, tries, peeks, clean, source, now: base(day) + n * 60000 });
}
const spellMany = (d, g, word, day, times, o) => Array.from({ length: times }).reduce((x) => spell(x, g, word, day, o), d);
const skip = (d, g, word, day, flow = 'p') => { n += 1; return W.addSkip(d, { id: 'k' + n, group: g.id, word, day, flow, now: base(day) + n * 60000 }); };
const count = (d, g, w, day, flow = 'p') => W.sessionCount(d, g, w, day, flow);
const DAY = plus(4);
const markAll = (d, g, steps) => steps.reduce((x, [s, k]) => W.markStep(x, g, s, plus(k), base(plus(k))), d);
const upToPractice = (d, g) => markAll(d, g, [['hello', 0], ['fix', 1], ['games', 2], ['story', 3]]);

// ---- the count ---------------------------------------------------------------------------
test('a mistake: the same word again, and it isn\'t done', () => {
  let { d, g } = made();
  d = spell(d, g, 'fruit', DAY, { clean: false });
  assert.equal(count(d, g, 'fruit', DAY), 0);
  assert.equal(W.queue(d, g, DAY, 'p')[0], 'fruit', 'the word stays first');
  assert.equal(W.sessionDone(d, g, 'fruit', DAY, 'p'), false);
});
test('the page keeps the word until it has its 3, and says the retry line', () => {
  const v = readFileSync(file('site/js/words-views.js'), 'utf8');
  assert.match(v, /if \(n2 >= W\.ROW_NEEDED && clean\) \{ finish\(\); return; \}/);
  assert.match(v, /nextPass\(clean \? .* : RETRY_LINE\)/);
  assert.match(readFileSync(file('site/js/ui.js'), 'utf8'), /Let\\'s try that one again/);
});
test('clean spellings count up: 1, 2, 3', () => {
  let { d, g } = made();
  for (const want of [1, 2, 3]) { d = spell(d, g, 'fruit', DAY); assert.equal(count(d, g, 'fruit', DAY), want); }
});
test('3 in a row completes the word for the session', () => {
  let { d, g } = made();
  d = spellMany(d, g, 'fruit', DAY, 3);
  assert.equal(W.sessionDone(d, g, 'fruit', DAY, 'p'), true);
  assert.deepEqual(W.queue(d, g, DAY, 'p'), ['earth', 'heart']);
});
test('a peek resets the count, even with every letter right', () => {
  let { d, g } = made();
  d = spellMany(d, g, 'fruit', DAY, 2);
  d = spell(d, g, 'fruit', DAY, { clean: false, tries: 0, peeks: 1 });
  assert.equal(count(d, g, 'fruit', DAY), 0);
});
test('a pass with a peek isn\'t clean', () => {
  assert.equal(R.isClean(R.peek(R.newRun('fruit'))), false);
});
test('a mistake at 2/3 resets, and 3 more are needed', () => {
  let { d, g } = made();
  d = spellMany(d, g, 'fruit', DAY, 2);
  d = spell(d, g, 'fruit', DAY, { clean: false });
  assert.equal(count(d, g, 'fruit', DAY), 0);
  d = spellMany(d, g, 'fruit', DAY, 2);
  assert.equal(W.sessionDone(d, g, 'fruit', DAY, 'p'), false);
  d = spell(d, g, 'fruit', DAY);
  assert.equal(W.sessionDone(d, g, 'fruit', DAY, 'p'), true);
});
test('in a row means in a row: 4 clean with a slip in the middle isn\'t a session', () => {
  let { d, g } = made();
  for (const clean of [true, true, false, true, true]) d = spell(d, g, 'fruit', DAY, { clean });
  assert.equal(count(d, g, 'fruit', DAY), 2);
});
test('done stays done: a slip after the 3rd doesn\'t undo it', () => {
  let { d, g } = made();
  d = spell(spellMany(d, g, 'fruit', DAY, 3), g, 'fruit', DAY, { clean: false });
  assert.equal(W.sessionDone(d, g, 'fruit', DAY, 'p'), true);
});
test('each flow has its own count', () => {
  let { d, g } = made();
  d = spellMany(d, g, 'fruit', DAY, 2, { source: 'x' });
  d = spell(d, g, 'fruit', DAY);
  assert.equal(count(d, g, 'fruit', DAY, 'x'), 2);
  assert.equal(count(d, g, 'fruit', DAY, 'p'), 1);
});
test('a game or a test try neither adds to the count nor resets it', () => {
  let { d, g } = made();
  d = spellMany(d, g, 'fruit', DAY, 2);
  d = spell(d, g, 'fruit', DAY, { clean: false, source: 'g' });
  d = spell(d, g, 'fruit', DAY, { source: 'g' });
  d = spell(d, g, 'fruit', DAY, { source: 'm' });
  assert.equal(count(d, g, 'fruit', DAY), 2);
});
test('a new day starts a new session', () => {
  let { d, g } = made();
  d = spellMany(d, g, 'fruit', plus(1), 2);
  assert.equal(count(d, g, 'fruit', plus(2)), 0);
});
test('a star is still the clean first go of the day, and a slip first means no star', () => {
  let { d, g } = made();
  d = spellMany(d, g, 'fruit', DAY, 3);
  assert.equal(W.cell(d, g, 'fruit', DAY), 'clean');
  d = spell(d, g, 'earth', DAY, { clean: false });
  d = spellMany(d, g, 'earth', DAY, 3);
  assert.equal(W.cell(d, g, 'earth', DAY), 'help');
  assert.equal(W.starsOn(d, g, DAY), 1);
});
test('remembered is unchanged: 3 in a row on one day is one day', () => {
  let { d, g } = made(['fruit'], plus(9));
  d = spellMany(d, g, 'fruit', plus(1), 9);
  assert.deepEqual(W.goodDays(d, 'fruit'), [plus(1)]);
  assert.equal(W.isRemembered(d, 'fruit'), false);
  d = spellMany(spellMany(d, g, 'fruit', plus(4), 3), g, 'fruit', plus(8), 3);
  assert.equal(W.isRemembered(d, 'fruit'), true);
});

// ---- every flow --------------------------------------------------------------------------
test('Fix it in: the job needs every word\'s 3', () => {
  let { d, g } = made(['fruit', 'earth']);
  d = W.markStep(d, g, 'hello', MON, base(MON));
  d = spellMany(d, g, 'fruit', plus(1), 3, { source: 'x' });
  d = spellMany(d, g, 'earth', plus(1), 2, { source: 'x' });
  assert.equal(St.studyState(d, g, plus(1)).job, 'fix');
  d = spell(d, g, 'earth', plus(1), { source: 'x' });
  assert.equal(St.doneDay(d, g, 'fix'), plus(1));
  assert.equal(St.studyState(d, g, plus(1)).status, 'done');
});
test('a Fix it in job left yesterday keeps the words already done', () => {
  let { d, g } = made(['fruit', 'earth']);
  d = spellMany(d, g, 'fruit', plus(1), 3, { source: 'x' });
  assert.deepEqual(W.queue(d, g, plus(2), 'x'), ['earth']);
});
test('Practice day: the same, and the grid\'s own session is what counts', () => {
  let { d, g } = made(['fruit']);
  d = upToPractice(d, g);
  d = spellMany(d, g, 'fruit', plus(1), 3, { source: 'x' });
  assert.equal(St.studyState(d, g, DAY).job, 'practice');
  d = spellMany(d, g, 'fruit', DAY, 3);
  assert.equal(St.studyState(d, g, DAY).status, 'ready');
});
test('Mend: 3 in a row; a slip resets; the word is done for today only then', () => {
  let { d, g } = made(['fruit'], plus(2));
  d = spell(d, g, 'fruit', plus(2), { kind: 't', clean: false });
  const day = plus(3);
  assert.equal(St.mendPart(d, g, day), 'fixups');
  d = spellMany(d, g, 'fruit', day, 2, { kind: 'f' });
  d = spell(d, g, 'fruit', day, { kind: 'f', clean: false });
  assert.equal(St.mendPart(d, g, day), 'fixups');
  assert.equal(count(d, g, 'fruit', day, 'f'), 0);
  d = spellMany(d, g, 'fruit', day, 3, { kind: 'f' });
  assert.equal(St.mendPart(d, g, day), 'quick');
});

// ---- skip ----------------------------------------------------------------------------------
test('skip: the word goes to the end of today\'s list', () => {
  let { d, g } = made();
  d = skip(d, g, 'fruit', DAY);
  assert.deepEqual(W.queue(d, g, DAY, 'p'), ['earth', 'heart', 'fruit']);
});
test('skip: skipped again goes behind the others', () => {
  let { d, g } = made();
  d = skip(skip(d, g, 'fruit', DAY), g, 'earth', DAY);
  assert.deepEqual(W.queue(d, g, DAY, 'p'), ['heart', 'fruit', 'earth']);
  d = skip(d, g, 'fruit', DAY);
  assert.deepEqual(W.queue(d, g, DAY, 'p'), ['heart', 'earth', 'fruit']);
});
test('skip: it\'s marked "Come back to this" until it\'s done', () => {
  let { d, g } = made();
  d = skip(d, g, 'fruit', DAY);
  assert.deepEqual(W.comeBack(d, g, DAY), [{ word: 'fruit', flow: 'p' }]);
  d = spellMany(d, g, 'fruit', DAY, 3);
  assert.deepEqual(W.comeBack(d, g, DAY), []);
});
test('skip: the marker is on the list, the grid and in My room, and opens the word', async () => {
  let { d, g } = made();
  d = skip(skip(d, g, 'earth', DAY), g, 'fruit', DAY, 'x');
  assert.equal(St.roomState(d, DAY).comeBack.length, 2);
  const v = readFileSync(file('site/js/words-views.js'), 'utf8');
  assert.match(v, /comeBackHref\(g, w, later\.get\(w\)\)/, 'the grid');
  assert.match(v, /comeBackHtml\(g, W\.comeBack\(d, g, day\)\)/, 'the group page');
  assert.match(readFileSync(file('site/js/child-views.js'), 'utf8'), /comeBackHref\(g, x\.word, x\.flow\)/, 'the room');
  const s = readFileSync(file('site/js/study-views.js'), 'utf8');
  assert.match(s, /flow === 'x' \? '\/study\/fix\/' \+ n : '\/spell\/' \+ n/);
});
test('skip: the job isn\'t complete until the skipped word is done', () => {
  let { d, g } = made(['fruit', 'earth']);
  d = upToPractice(d, g);
  d = skip(d, g, 'fruit', DAY);
  d = spellMany(d, g, 'earth', DAY, 3);
  assert.equal(St.studyState(d, g, DAY).status, 'job');
  assert.equal(St.studyState(d, g, DAY).job, 'practice');
  assert.equal(St.studyState(d, g, DAY).steps.find((s) => s.id === 'practice').state, 'today', 'no badge');
  assert.equal(St.roomState(d, DAY).status, 'job', 'no Done for today');
  d = spellMany(d, g, 'fruit', DAY, 3);
  assert.equal(St.studyState(d, g, DAY).steps.find((s) => s.id === 'practice').state, 'done');
});
test('a finished word never says "Done for today": only a finished job does', () => {
  const v = readFileSync(file('site/js/words-views.js'), 'utf8');
  const body = v.slice(v.indexOf('export function spellWord('), v.indexOf('// ---- the test ---'));
  assert.doesNotMatch(body, /Done for today/);
  const s = readFileSync(file('site/js/study-views.js'), 'utf8');
  assert.equal(s.match(/Done for today!/g).length, 1, 'only finishStep says it');
  assert.ok(s.indexOf('Done for today!') < s.indexOf('function hello('));
});
test('skip: a fix-up skipped keeps Mend open', () => {
  let { d, g } = made(['fruit'], plus(2));
  d = spell(d, g, 'fruit', plus(2), { kind: 't', clean: false });
  d = skip(d, g, 'fruit', plus(3), 'f');
  assert.equal(St.studyState(d, g, plus(3)).job, 'mend');
  assert.deepEqual(W.comeBack(d, g, plus(3)), [{ word: 'fruit', flow: 'f' }]);
});
test('skip: it keeps the count so far', () => {
  let { d, g } = made();
  d = spellMany(d, g, 'fruit', DAY, 2);
  d = skip(d, g, 'fruit', DAY);
  assert.equal(count(d, g, 'fruit', DAY), 2);
});
test('skip: it\'s for today only', () => {
  let { d, g } = made();
  d = skip(d, g, 'fruit', plus(3));
  assert.deepEqual(W.queue(d, g, DAY, 'p'), ['fruit', 'earth', 'heart']);
  assert.deepEqual(W.comeBack(d, g, DAY), []);
});
test('a skipped word shows no marker on a day its words are hidden', () => {
  const src = readFileSync(file('site/js/child-doc.js'), 'utf8');
  assert.match(src, /g && !r\.hideWords \? r\.comeBack/);
  assert.match(readFileSync(file('site/js/words-views.js'), 'utf8'), /\(testing \? '' : comeBackHtml/);
});

// ---- leaving and coming back --------------------------------------------------------------
test('resuming after leaving: the count and the skips are all still there', () => {
  let { d, g } = made();
  d = spellMany(d, g, 'earth', DAY, 2);
  d = skip(d, g, 'fruit', DAY);
  const back = W.normalise(JSON.parse(JSON.stringify(d))); // saved and read again
  assert.equal(count(back, g, 'earth', DAY), 2);
  assert.deepEqual(W.queue(back, g, DAY, 'p'), ['earth', 'heart', 'fruit']);
});
test('leaving halfway after a mistake counts as the mistake', () => {
  const v = readFileSync(file('site/js/words-views.js'), 'utf8');
  assert.match(v, /if \(!done && R\.mustRecord\(run\)\) \{ record\(run, false\);/);
});

// ---- another device -------------------------------------------------------------------------
const sendAndPull = (d) => W.normalise(JSON.parse(JSON.stringify(d)));
test('another device continues from the same count and skip list', () => {
  let { d, g } = made();
  d = spellMany(d, g, 'fruit', DAY, 2);
  d = skip(d, g, 'earth', DAY);
  let tablet = W.merge(W.emptyDoc(), sendAndPull(d));
  assert.equal(count(tablet, g, 'fruit', DAY), 2);
  assert.deepEqual(W.comeBack(tablet, g, DAY), [{ word: 'earth', flow: 'p' }]);
  tablet = spell(tablet, g, 'fruit', DAY);
  assert.equal(W.sessionDone(tablet, g, 'fruit', DAY, 'p'), true);
});
test('a 409: both devices\' spellings and skips are kept, nothing counted twice', () => {
  const start = made();
  const { g } = start;
  const phone = skip(spellMany(start.d, g, 'fruit', DAY, 2), g, 'earth', DAY);
  const tablet = skip(spell(start.d, g, 'fruit', DAY), g, 'heart', DAY);
  const m = W.merge(phone, tablet);
  assert.equal(m.results.length, 3);
  assert.equal(W.sessionDone(m, g, 'fruit', DAY, 'p'), true);
  assert.deepEqual(W.comeBack(m, g, DAY).map((x) => x.word).sort(), ['earth', 'heart']);
  assert.deepEqual(W.merge(m, m), m);
  assert.deepEqual(W.merge(m, phone), m);
});
test('a slip on one device and clean spellings on another fall in time order', () => {
  const { d, g } = made();
  const slip = spell(d, g, 'fruit', DAY, { clean: false }); // earlier
  const clean = spellMany(d, g, 'fruit', DAY, 2);
  assert.equal(count(W.merge(slip, clean), g, 'fruit', DAY), 2);
});
test('a finished session survives folding; old skips go', () => {
  let { d, g } = made(['fruit']);
  d = spellMany(d, g, 'fruit', plus(1), 3, { source: 'x' });
  d = skip(d, g, 'fruit', plus(1));
  const big = { ...d, groups: { ...d.groups, pad: { name: 'x'.repeat(60000), start: MON, test: plus(7), words: ['a'], back: [], at: base(MON) } } };
  const small = W.normalise(W.trim(big, base(plus(6))));
  assert.equal(small.results.length, 0);
  assert.equal(small.skips.length, 0);
  assert.equal(W.dots(small, g, 'fruit', plus(6)), 3);
  assert.equal(W.readyForTest(small, g), true);
  assert.equal(W.dots(W.merge(d, small), g, 'fruit', plus(6)), 3);
});
test('a device on the last release can read a value with skips in it', () => {
  const { d, g } = made();
  const old = { ...skip(d, g, 'fruit', DAY) };
  delete old.skips;
  assert.deepEqual(W.normalise(old).skips, []);
});

// ---- dots and readiness -------------------------------------------------------------------------
test('the dots show today\'s count', () => {
  let { d, g } = made();
  d = spellMany(d, g, 'fruit', DAY, 2);
  assert.equal(W.dots(d, g, 'fruit', DAY), 2);
  d = spell(d, g, 'fruit', DAY, { clean: false });
  assert.equal(W.dots(d, g, 'fruit', DAY), 0);
});
test('tomorrow they start again, unless the word finished a session', () => {
  let { d, g } = made();
  d = spellMany(spellMany(d, g, 'fruit', plus(1), 2), g, 'earth', plus(1), 3);
  assert.equal(W.dots(d, g, 'fruit', plus(2)), 0);
  assert.equal(W.dots(d, g, 'earth', plus(2)), 3);
});
test('a finished word keeps its 3, even after a slip on a later day', () => {
  let { d, g } = made();
  d = spell(spellMany(d, g, 'fruit', plus(1), 3), g, 'fruit', plus(2), { clean: false });
  assert.equal(W.dots(d, g, 'fruit', plus(2)), 3);
});
test('Fix it in or the grid can finish a word; games and fix-ups can\'t', () => {
  let { d, g } = made(['fruit', 'earth', 'heart', 'guard']);
  d = spellMany(d, g, 'fruit', plus(1), 3, { source: 'x' });
  d = spellMany(d, g, 'earth', plus(1), 3);
  d = spellMany(d, g, 'heart', plus(1), 9, { source: 'g' });
  d = spellMany(d, g, 'guard', plus(1), 9, { source: 'm' });
  assert.deepEqual(W.allDots(d, g, plus(1)).map((x) => x.dots), [3, 3, 0, 0]);
});
test('ready: every test word has finished a session; words back again don\'t hold it up', () => {
  let { d, g } = made(['fruit', 'earth']);
  d = { ...d, groups: { ...d.groups, g1: { ...d.groups.g1, back: ['heart'] } } };
  g = W.groupById(d, 'g1');
  d = spellMany(d, g, 'fruit', plus(1), 3);
  assert.equal(W.readyForTest(d, g), false);
  d = spellMany(d, g, 'earth', plus(2), 3, { source: 'x' });
  assert.equal(W.readyForTest(d, g), true, 'on different days and in different flows');
});
test('not ready on 3 clean spellings spread over days or broken by a slip', () => {
  let { d, g } = made(['fruit']);
  for (const k of [1, 2, 3]) d = spell(d, g, 'fruit', plus(k));
  assert.equal(W.readyForTest(d, g), false);
  for (const clean of [true, true, false, true, true]) d = spell(d, g, 'fruit', DAY, { clean });
  assert.equal(W.readyForTest(d, g), false);
});
test('only a session before the test counts', () => {
  let { d, g } = made(['fruit'], plus(2));
  d = spell(d, g, 'fruit', plus(2), { kind: 't' });
  d = spellMany(d, g, 'fruit', plus(3), 3);
  assert.equal(W.readyForTest(d, g), false);
  assert.equal(W.dots(d, g, 'fruit', plus(3)), 0);
});

// ---- games -----------------------------------------------------------------------------------
test('games: a wrong answer keeps the word first; a right one moves on', () => {
  assert.deepEqual(G.afterPass(['fruit', 'earth'], false), ['fruit', 'earth']);
  assert.deepEqual(G.afterPass(['fruit', 'earth'], true), ['earth']);
});
test('games: a word goes round until it\'s clean, and every go is recorded', () => {
  let { d, g } = made(['fruit']);
  let list = ['fruit'];
  for (const clean of [false, false, true]) {
    d = G.recordPass(d, g, 'fruit', { tries: clean ? 0 : 1, clean }, { id: 'g' + clean + list.length + (n += 1), day: DAY, now: base(DAY) + (n * 60000) });
    list = G.afterPass(list, clean);
  }
  assert.deepEqual(list, []);
  assert.equal(d.results.length, 3);
  assert.equal(W.cell(d, g, 'fruit', DAY), 'help');
});
test('games: skip sends the word to the end, and a lone word stays', () => {
  assert.deepEqual(G.afterSkip(['fruit', 'earth', 'heart']), ['earth', 'heart', 'fruit']);
  assert.deepEqual(G.afterSkip(['fruit']), ['fruit']);
});
test('games: today\'s skipped words wait at the end on coming back, or on another device', () => {
  let { d, g } = made();
  d = skip(d, g, 'fruit', DAY, 'g:quick');
  assert.deepEqual(W.inTurn(d, g, ['fruit', 'earth', 'heart'], DAY, 'g:quick'), ['earth', 'heart', 'fruit']);
  assert.deepEqual(W.inTurn(d, g, ['fruit', 'earth'], DAY, 'g:unjumble'), ['fruit', 'earth'], 'each game has its own');
  assert.deepEqual(W.comeBack(d, g, DAY), [], 'no marker: a game can\'t finish with a word left');
});
test('games: all three spelling games retry and skip; none needs 3 in a row', () => {
  const src = readFileSync(file('site/js/games-views.js'), 'utf8');
  assert.equal(src.match(/words = G\.afterPass\(words, p\.clean\);/g).length, 3);
  assert.equal(src.match(/words = G\.afterSkip\(words\);/g).length, 3);
  assert.equal(src.match(/RETRY_LINE\); return;/g).length, 3);
  assert.doesNotMatch(src, /ROW_NEEDED|sessionCount/);
});
test('Meaning match is unchanged: no retry queue, no skip', () => {
  const src = readFileSync(file('site/js/games-views.js'), 'utf8');
  const body = src.slice(src.indexOf('function match('), src.indexOf('function quick('));
  assert.doesNotMatch(body, /afterPass|afterSkip|data-skip/);
});

// ---- test day ----------------------------------------------------------------------------------
test('test day: one go each, and nothing is checked until the end', () => {
  let { d, g } = made(['fruit', 'earth'], plus(5));
  d = spell(d, g, 'fruit', plus(5), { kind: 't', clean: false });
  assert.deepEqual(W.testLeft(d, g), ['earth'], 'a wrong word doesn\'t come back');
  const t = R.createTest(['fruit', 'earth']);
  assert.equal(t.answer('froot').next, 'earth');
  assert.equal(t.results(), null);
  const v = readFileSync(file('site/js/words-views.js'), 'utf8');
  const body = v.slice(v.indexOf('export function testDay('), v.indexOf('// ---- the numbers'));
  assert.doesNotMatch(body, /data-skip|data-peekbtn|RETRY_LINE|sessionCount/);
});
test('test day: a test try is no part of any session', () => {
  let { d, g } = made(['fruit'], plus(5));
  d = spellMany(d, g, 'fruit', plus(5), 3, { kind: 't' });
  assert.equal(W.sessionCount(d, g, 'fruit', plus(5), 'p'), 0);
  assert.equal(W.readyForTest(d, g), false);
});
test('the new way in to a word is guarded on test day too', () => {
  const src = readFileSync(file('site/js/test-guard.js'), 'utf8');
  assert.match(src, /'words\/g\/:gid\/study\/:step\/:n': 'group'/);
});
