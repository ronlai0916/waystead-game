// SB6 FIX-U1a (UAT F3 to F9, M1): the Step by step child's names and lines, the test card, the Meanings Hear buttons, and the Hide and spell layout rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import * as C from '../site/js/child-doc.js';
import * as CV from '../site/js/child-views.js';
import * as K from '../site/js/sbs-week-doc.js';
import * as A from '../site/js/assess-doc.js';
import * as SD from '../site/js/session-doc.js';
import * as R from '../site/js/rows-doc.js';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const WORDS = ['one', 'two', 'three', 'four'];
const mk = (start, n) => { const d = W.createGroup(W.emptyDoc(), { id: 'g', name: 'Class 4 spellings', test: W.addDays(start, n), words: WORDS, today: start, now: 1 }).doc; return { d, g: W.groupById(d, 'g') }; };
const words = (s) => s.trim().split(/\s+/).filter((x) => x !== '·').length;
const OLD = /Hello words|Fix it in|Game day|Story day|Practice day/;
const SBS = { way: { m: 'sbs', at: 1 } };
const sbsView = (d, g, day, year = 4) => { const st = CV.namedState(St.studyState(d, g, day), SBS); const jobs = CV.todayJobs(d, g, day, st); return { st, jobs, t: CV.todayText({ g, st, day, year, jobs, sbs: true }) }; };

test('F7: a Step by step child sees the stone names on Today, the path and the top bar; Game day and Hello words are Usual names only', () => {
  let { d, g } = mk('2026-11-15', 5);
  d = W.markStep(d, g, 'hello', '2026-11-15', 2); d = W.markStep(d, g, 'fix', '2026-11-16', 2);
  const { st, t } = sbsView(d, g, '2026-11-17');
  assert.equal(st.job, 'games');
  assert.equal(t.big, 'Meanings');
  assert.equal(t.bigSub, K.STONE_TEXT.games.line);
  assert.doesNotMatch(JSON.stringify(t), OLD);
  assert.deepEqual(st.steps.map((s) => s.title), ['Meet the words', 'Letter ladder', 'Meanings', 'Sentences', 'Words in a row', 'Test day', 'Mend and keep']);
  // the Usual way is as it was
  const usual = CV.todayText({ g, st: St.studyState(d, g, '2026-11-17'), day: '2026-11-17', year: 4, jobs: [] });
  assert.equal(usual.big, 'Game day');
  // the top bar names the stone by the way it runs
  const sbsOf = () => true;
  for (const [stone, want] of [['hello', 'Meet the words'], ['fix', 'Letter ladder'], ['games', 'Meanings'], ['story', 'Sentences'], ['practice', 'Words in a row'], ['mend', 'Mend and keep']]) {
    assert.equal(C.jobTitle('words/g/g/study/' + stone, d, '2026-11-17', { names: K.STONE_TEXT, sbs: sbsOf }), want, stone);
  }
  assert.equal(C.jobTitle('words/g/g/study/hello', d, '2026-11-17', { names: K.STONE_TEXT, sbs: () => false }), 'Hello words', 'a stone that runs the Usual way keeps its name');
  assert.equal(C.jobTitle('words/g/g/study/games', d, '2026-11-17'), 'Game day', 'no names given: unchanged');
  assert.equal(C.jobTitle('words/g/g/test', d, '2026-11-17', { names: K.STONE_TEXT, sbs: sbsOf }), 'Test day');
});

test('F7: the source gives the top bar and the stone cards the Step by step names', () => {
  assert.match(src('site/js/child-views.js'), /C\.jobTitle\(path, S\.readWords\(\), today\(\), \{ names: K\.STONE_TEXT/);
  assert.match(src('site/js/words-views.js'), /AVnamed\(St\.studyState/);
  assert.match(src('site/js/words-views.js'), /K\.STONE_TEXT\.test\.title/);
});

test('F9: a Step by step child\'s Today lines are 8 words or fewer, on every day of a week and after it', () => {
  const lines = [];
  for (const n of [5, 7]) {
    let { d, g } = mk('2026-11-15', n);
    for (let i = 0; i <= n; i += 1) {
      const day = W.addDays('2026-11-15', i);
      const { t } = sbsView(d, g, day);
      lines.push(t.sub, t.bigSub, t.line);
      if (i < 4) d = W.markStep(d, g, St.BEFORE_TEST[i], day, 2);
    }
  }
  lines.push(...(() => { const { d, g } = mk('2026-11-15', 5); const done = St.BEFORE_TEST.reduce((x, id) => W.markStep(x, g, id, '2026-11-16', 2), d); return [sbsView(done, g, '2026-11-17').t.sub, sbsView(done, g, '2026-11-19').t.sub]; })());
  for (const s of lines.filter(Boolean)) for (const p of s.split(/(?<=[.!?])\s+/)) assert.ok(words(p) <= 8, 'over 8 words: ' + p);
  const ready = (() => { const { d, g } = mk('2026-11-15', 5); const done = St.BEFORE_TEST.reduce((x, id) => W.markStep(x, g, id, '2026-11-16', 2), d); return [sbsView(done, g, '2026-11-17').t.sub, sbsView(done, g, '2026-11-19').t.sub]; })();
  assert.deepEqual(ready, ['All done. Test on Fri 20 Nov.', 'All done. Test tomorrow.']);
  const { d, g } = mk('2026-11-15', 5);
  const far = mk('2026-11-15', 14);
  assert.equal(sbsView(far.d, far.g, '2026-11-17').t.sub, 'Day 3 of 14 · test Sun 29 Nov');
});

test('F9: the path page gives a Step by step child two short lines: day and test, then stars', () => {
  const v = src('site/js/child-views.js');
  assert.match(v, /sbsWay \? \[dayBit, 'test ' \+ W\.dayLabel\(g\.test\)\]\.join\(' · '\)/);
  assert.match(v, /const sub2 = sbsWay \? \[C\.starsText\(St\.weekStars\(d, g\)\), setBy\]/);
  assert.ok(words('Day 5 of 5 · test Sat 7 Nov') <= 8);
});

test('F5: the Step by step test says what it allows (hear as often as you like, one Peek), never "no peeking"; the Usual card is as it was', () => {
  const r = A.readyLines('test', 'sen', 10, { sbs: true });
  assert.deepEqual(r.lines, ['10 words.', 'Hear each word as often as you like.', 'You can peek once on each word.', 'Start when you\'re ready.']);
  // S2: a child kept on the Stretch help (2 replays) is told what the test really allows
  const top = A.readyLines('test', 'top', 10, { sbs: true });
  assert.deepEqual(top.lines, ['10 words.', 'Hear each word again up to 2 times.', 'You can peek once on each word.', 'Start when you\'re ready.']);
  for (const l of top.lines) assert.ok(words(l) <= 8, l);
  assert.equal(A.rulesFor('test', 'top', { way: 'sbs' }).replays, 2, 'the line reads the rule');
  assert.deepEqual(A.sbsTestAllows('normal'), A.SBS_TEST_ALLOWS);
  assert.deepEqual(A.sbsTestAllows(undefined), A.SBS_TEST_ALLOWS);
  for (const l of r.lines) assert.ok(words(l) <= 8, l);
  assert.doesNotMatch(JSON.stringify(r) + JSON.stringify(K.STONE_TEXT.test), /no peeking/i);
  assert.deepEqual(A.readyLines('test', 'normal', 10), { lines: ['10 words. Hear each one as often as you like.', 'Start when you\'re ready.'], button: 'Start' });
  assert.deepEqual(A.readyLines('test', 'normal', 10, { sbs: false }), A.readyLines('test', 'normal', 10));
  assert.deepEqual(A.readyLines('exam', 'normal', 20, { sbs: true }), A.readyLines('exam', 'normal', 20), 'only the weekly test');
  assert.match(src('site/js/assess-views.js'), /A\.readyLines\(kind, pf, n, \{ sbs: sbsTest \}\)/);
  assert.match(src('site/js/words-views.js'), /A\.sbsTestAllows\(S\.helpNow\(childYear\(\)\)\.pf\)\.join/);
  assert.match(src('site/js/words-views.js'), /Each word is spoken, with no peeking and one go each\./, 'the Usual wording is unchanged');
});

test('F5: the First letter hint is the child\'s test help (BR-24 AC2): Extra support has one, the Usual helps have none, and a hinted word is never clean', () => {
  assert.equal(A.rulesFor('test', 'sen', { way: 'sbs' }).hints, 1);
  assert.equal(A.rulesFor('test', 'sen', { way: 'sbs' }).peeks, 1);
  assert.equal(A.rulesFor('test', 'normal', { way: 'sbs' }).hints, 0);
  assert.equal(A.rulesFor('test', 'sen').hints, 1);
});

test('F6: in Step by step every option on the Meaning match, Fill in the blanks and Mix and match boards has its own Hear, 48 x 48; the Usual boards have none', () => {
  const v = src('site/js/games-views.js');
  assert.match(v, /const optHear = \(text, kind\)/);
  // match: both columns; fill and mix: each card; all only when ctx.sbs (or sbs in fill)
  assert.match(v, /const opt = \(btn, text, kind\) => \(ctx\.sbs \? '<div class="matchopt">'/);
  assert.match(v, /opt\('<button type="button" class="matchcard matchcard--word[\s\S]*?, c\.word, 'word'\)/);
  assert.match(v, /opt\('<button type="button" class="matchcard' \+ \(used[\s\S]*?, m, 'meaning'\)/);
  assert.match(v, /cards\.map\(\(w\) => \(sbs \? '<span class="mixopt">' \+ cardHtml\(w\) \+ optHear\(w, 'word'\)/);
  assert.match(v, /return ctx\.sbs \? '<span class="mixopt">' \+ card \+ optHear\(c\.word, 'word'\)/);
  assert.equal((v.match(/wireOptHear\(main\)/g) || []).length, 4, 'wired in each game');
  assert.match(v, /dataset\.hearopt === 'word' \? speak\(b\.dataset\.text\) : sayLine\(b\.dataset\.text\)/, 'a Hear says the option text');
  const css = src('site/css/mix.css');
  assert.match(css, /\.matchopt > \.hearround, \.mixopt > \.hearround \{ flex: none; width: 48px; height: 48px; \}/);
});

test('M1/F1: Hide and spell on tiles has Hear and Peek on one row and a short hint under them (Usual and the grid)', () => {
  for (const f of ['site/js/study-views.js', 'site/js/words-views.js']) {
    const v = src(f);
    assert.match(v, /<div class="btnrow btnrow--peek"><button type="button" class="btn btn--ghost btn--wide" data-hear>' \+ ICON\.play \+ 'Hear again<\/button>' \+ peekButtonHtml\(\) \+ '<\/div>'/, f);
    assert.match(v, /<p class="peekhint" data-hint aria-live="polite">/, f);
  }
  assert.equal(C.PEEK_HINT, 'Peek restarts your count.');
  assert.ok(words(C.PEEK_HINT) <= 8 && words(C.PEEKED_LINE) <= 8);
});

test('F2: the Step by step pages without a keyboard take no second bottom padding, and Hear is never under 48 px', () => {
  const css = src('site/css/sbs.css');
  assert.match(css, /html body\.is-child main\.sbs-main\.sbs-main \{ padding-block: 0; \}/);
  assert.doesNotMatch(css, /\.s6-boxline \.hearround \{ width: 44px/);
  assert.doesNotMatch(css, /\.s6-rowcard \.hearround \{ width: 44px/, 'rows: the small Hear is 48 too');
});

test('F4 (D27): a size with no group of its own size is not a round; the stone and the test still open from the marks', () => {
  assert.deepEqual(R.roundSizes(10), [2, 3, 4, 5, 6, 7, 8, 10]);
  assert.ok(!R.rowsLine(W.emptyDoc(), { words: Array(10).fill('x'), id: 'g' }).includes('Nines'));
});

test('F3: the end card counts words once (the number comes from the distinct words of the sitting)', () => {
  const end = SD.nextItem({ ...baseSitting(), done: [{ word: 'cat' }, { word: 'dog' }, { word: 'cat' }, { word: 'dog' }], wordsDone: 4, closed: true, stopped: false }, { words: ['cat', 'dog'], facts: () => ({ best: 0, days: [], secure: false, metOn: '' }), entries: (w) => ({ word: w, chunks: [w] }) }, 1);
  assert.deepEqual(end.words, ['cat', 'dog']);
});
function baseSitting() { return SD.newSitting({ gid: 'g', stone: 'practice', ss: 'aaaaaa', startedAt: 0, year: 4, setup: {}, day: '2026-11-02' }); }
