// SB4-WP6: the grown-ups' pages for how a child spells, exams, honest result lines, the overview.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as Su from '../site/js/setup-doc.js';
import * as A from '../site/js/assess-doc.js';
import * as P from '../site/js/grownups-doc.js';
import * as PR from '../site/js/progress-doc.js';

const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const MON = '2026-11-02';
const at = (day, h = 12) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':00:00Z');
let n = 0;
const week = (words = ['fruit', 'earth', 'heart', 'build', 'busy']) => {
  const d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week one', test: W.addDays(MON, 5), words, today: MON, now: at(MON) }).doc;
  return { d, g: W.groupById(d, 'g1') };
};
const tr = (d, g, word, day, o = {}) => W.addTry(d, { id: 'x' + (++n), word, day, group: g.id, kind: 'p', tries: 0, peeks: 0, clean: true, source: 'x', now: at(day) + n, ...o });

test('classify: assisted turns Got it into Getting there with the reason tiles; unchanged without', () => {
  assert.deepEqual(P.classify({ dots: 3, any: true, assisted: true }), { key: 'getting', label: 'Getting there', reason: 'tiles' });
  assert.deepEqual(P.classify({ dots: 3, any: true }), { key: 'got', label: 'Got it', reason: '' });
  assert.deepEqual(P.classify({ dots: 3, any: true, assisted: false }), { key: 'got', label: 'Got it', reason: '' });
  assert.equal(P.classify({ dots: 3, slipped: true, assisted: true }).key, 'help');
  assert.equal(P.classify({ dots: 1, any: true, assisted: true }).reason, '1 in a row');
});

test('weekWords: three in a row with letter tiles says so; a keyboard word is Got it', () => {
  let { d, g } = week(['fruit', 'earth']);
  for (const day of [W.addDays(MON, 1)]) for (let i = 0; i < 3; i += 1) d = tr(d, g, 'fruit', day, { lv: 2 });
  for (let i = 0; i < 3; i += 1) d = tr(d, g, 'earth', W.addDays(MON, 1));
  const rows = P.weekWords(d, g, W.addDays(MON, 2));
  const f = rows.find((r) => r.word === 'fruit');
  const e = rows.find((r) => r.word === 'earth');
  assert.equal(f.status, 'getting');
  assert.equal(f.reason, '3 in a row with letter tiles');
  assert.equal(e.status, 'got');
});

test('the card: nothing saved for Year 1, 2 and 4', () => {
  const c1 = P.spellCard({}, 1, 'Robin');
  assert.deepEqual(c1.lines, ['Letters or keyboard: Some letters', 'Help in tests: Standard']);
  assert.equal(c1.usual, 'Using \'Some letters\', the usual start for Year 1. You can change it.');
  assert.equal(P.spellCard({}, 2, 'Robin').usual, 'Using \'Most letters\', the usual start for Year 2. You can change it.');
  const c4 = P.spellCard({}, 4, 'Robin');
  assert.equal(c4.lines[0], 'Letters or keyboard: Keyboard');
  assert.equal(c4.usual, '');
  assert.equal(c4.changed, '');
  assert.equal(c4.title, 'How Robin spells');
});
test('the card: a saved level, a saved help, who and when', () => {
  let s = Su.setHelp({}, 3, at('2026-11-12'), 'Sam');
  assert.equal(P.spellCard(s, 1, 'Robin').lines[0], 'Letters or keyboard: Most letters');
  assert.equal(P.spellCard(s, 1, 'Robin').usual, '');
  assert.equal(P.spellCard(s, 4, 'Robin').changed, 'Last changed by Sam, 12 Nov');
  s = Su.setProfile(s, 'sen', at('2026-11-13'), '');
  const c = P.spellCard(s, 4, 'Robin');
  assert.equal(c.lines[1], 'Help in tests: Extra support');
  assert.equal(c.changed, 'Last changed 13 Nov');
});

test('the level hint: ready for fewer letters names the next level', () => {
  let { d, g } = week(['fruit', 'earth', 'heart', 'build', 'busy']);
  for (const w of g.words) for (let i = 0; i < 3; i += 1) d = tr(d, g, w, W.addDays(MON, 1), { lv: 2 });
  const s = Su.setHelp({}, 2, at(MON), 'Sam');
  const h = P.levelHint(d, W.addDays(MON, 2), s, 4, 'Robin');
  assert.equal(h.next, 3);
  assert.equal(h.line, 'Robin is ready for fewer letters. Try \'Most letters\'?');
  assert.equal(P.levelHint(d, W.addDays(MON, 2), Su.setHelp({}, 5, at(MON), ''), 4, 'Robin'), null);
  assert.equal(P.levelHint(week().d, W.addDays(MON, 2), s, 4, 'Robin'), null);
});

const chapters = [
  { id: 'c1', yearId: 'y4', n: 1, words: [{ word: 'alpha' }, { word: 'beta' }, { word: 'gamma' }] },
  { id: 'c2', yearId: 'y4', n: 2, words: [{ word: 'delta' }, { word: 'eps' }] },
  { id: 'c3', yearId: 'y4', n: 3, words: [{ word: 'zeta' }, { word: 'eta' }] },
  { id: 'c9', yearId: 'y5', n: 1, words: [{ word: 'other' }] },
];
const prog = (...ids) => ids.reduce((p, id, i) => PR.recordTest(p, id, 5, 5, at(MON) + i, 'r' + i), PR.emptyDoc());
test('exam pools come only from tested sources; the summary line', () => {
  const progress = prog('c1', 'c2');
  const { d } = week();
  const src = P.examSources({ chapters, progress, d, year: 4, today: MON });
  assert.deepEqual(src.filter((s) => s.ready).map((s) => s.key), ['c1', 'c2']);
  assert.equal(src.find((s) => s.key === 'c3').ready, false);
  assert.ok(!src.some((s) => s.key === 'c9'), 'another year, not started: not listed');
  assert.equal(src.find((s) => s.key === 'g-g1').ready, false, 'a week whose test is to come');
  const plan = P.examPlan(src, ['c1', 'c2', 'c3', 'g-g1'], 'normal');
  assert.deepEqual(plan.keys, ['c1', 'c2']);
  const words = A.examWords(plan.pools, 'normal', () => 0.5);
  assert.ok(words.every((w) => ['alpha', 'beta', 'gamma', 'delta', 'eps'].includes(w)));
  assert.equal(plan.n, 5);
  assert.equal(P.examSummary(plan), '5 words from 2 chapters');
  assert.equal(P.examSummary({ n: 10, chapters: 1, weeks: 1 }), '10 words from 1 chapter and 1 week');
  assert.equal(P.examSummary(P.examPlan(src, [], 'normal')), 'Nothing chosen yet.');
  const big = [{ key: 'a', kind: 'chapter', ready: true, at: 1, words: Array.from({ length: 25 }, (_, i) => 'w' + i) }];
  assert.equal(P.examPlan(big, ['a'], 'normal').n, 20);
  assert.equal(P.examPlan(big, ['a'], 'sen').n, 10);
});
test('exam messages and default name', () => {
  assert.equal(P.examProblem({ keys: [], date: MON, today: MON, liveCount: 0 }), 'Choose at least one chapter, list or week.');
  assert.equal(P.examProblem({ keys: ['a'], date: '2026-11-01', today: MON, liveCount: 0 }), 'Choose today or a later date.');
  assert.equal(P.examProblem({ keys: ['a'], date: '', today: MON, liveCount: 0 }), 'Choose today or a later date.');
  assert.equal(P.examProblem({ keys: ['a'], date: MON, today: MON, liveCount: 10 }), 'You already have 10 Big tests. Delete one first.');
  assert.equal(P.examProblem({ keys: ['a'], date: MON, today: MON, liveCount: 3 }), '');
  assert.equal(P.examDefaultName('2026-11-21'), 'Big test, 21 Nov');
});
test('the exam report line: later, ready, done', () => {
  const exam = { id: 'e1', name: 'Autumn check', date: W.addDays(MON, 3), words: ['alpha'], from: ['c1'], at: 1 };
  const p0 = PR.emptyDoc();
  const later = PR.examState(p0, 'e1', exam, MON);
  assert.equal(P.examStateLine(later.state, exam, later.last), 'Opens on Thu 5 Nov');
  const ready = PR.examState(p0, 'e1', exam, exam.date);
  assert.equal(P.examStateLine(ready.state, exam, ready.last), 'Ready');
  const p1 = PR.addCheck(p0, { c: 'e:e1', k: 'e', s: 9, t: 10, d: exam.date, miss: ['beta'], pf: 'sen', lv: 2 }, at(exam.date), 'q1');
  const done = PR.examState(p1, 'e1', exam, exam.date);
  assert.equal(P.examStateLine(done.state, exam, done.last), 'Done on Thu 5 Nov');
  assert.equal(P.examResultLine(exam, done.last), 'Autumn check (exam) · 9 of 10 · Extra support · with letter tiles (Some letters)');
  assert.equal(P.examMissLine(done.last), 'Words to practise: beta');
});

test('report lines: a tested week and a chapter test say how they were taken', () => {
  let { d, g } = week(['fruit', 'earth']);
  assert.equal(P.weekTestLine(d, g), '');
  for (const w of g.words) d = tr(d, g, w, W.addDays(MON, 5), { kind: 't', lv: 2 });
  assert.equal(P.weekTestLine(d, g), 'Week one test · 2 of 2 · Standard · with letter tiles (Some letters)');
  const p = PR.recordTest(PR.emptyDoc(), 'c1', 3, 3, at(MON), 'r1', { lv: 3, pf: 'top', hr: 1 });
  const t = P.chapterTestLine(p, chapters[0], 'Chapter 1');
  assert.equal(t.line, 'Chapter 1 test · 3 of 3 · Stretch · with letter tiles (Most letters) · heard again once');
  assert.equal(t.passed, true);
  assert.equal(P.chapterTestLine(PR.emptyDoc(), chapters[0], 'Chapter 1'), null);
  const q = PR.addCheck(p, { c: 'q:c1', k: 'q', s: 4, t: 5, d: MON }, at(MON, 13), 'q1');
  const lines = P.quizLines(q, () => 'Year 4, Chapter 1');
  assert.equal(lines.length, 1);
  assert.match(lines[0].line, /^Quiz \(practice\): Year 4, Chapter 1 · 4 of 5 · Standard · keyboard$/);
  assert.deepEqual(P.yearCounts(chapters.slice(0, 3), p), { total: 3, passed: 1, studying: 0, todo: 2 });
});

test('overview rows keep the account order and read each child alone', () => {
  const kids = ['Wren', 'Robin', 'Ada'];
  const rows = kids.map((name) => P.overviewRow({ name, words: W.emptyDoc(), progress: PR.emptyDoc(), setup: {}, chapters, today: MON, now: at(MON) }));
  assert.deepEqual(rows.map((r) => r.name), kids);
  assert.equal(rows[0].week, 'No week planned');
  assert.equal(rows[0].exam, 'None');
  assert.equal(rows[0].test, 'No test yet');
  const s = Su.setExam({}, 'e1', { name: 'Big test, 9 Nov', words: ['alpha'], from: ['c1'], date: '2026-11-09' }, at(MON)).setup;
  const r = P.overviewRow({ name: 'Robin', words: W.emptyDoc(), progress: prog('c1'), setup: s, chapters, today: MON, now: at(MON) });
  assert.equal(r.passed, 1);
  assert.equal(r.exam, 'Big test, 9 Nov, Mon 9 Nov');
  assert.match(P.OVERVIEW_CAPTION, /This is not a ranking\.$/);
});

// ---- wording and the page's constraints ------------------------------------------------------------
const BANNED = /\bSEN\b|\b(profile|mode|doc|sync|toggle|scaffold|OCR)\b|input method|AI model|level [1-5]\b/i;
const strings = (src) => [...src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] || m[2] || m[3] || '');
test('no banned word in any string of setup-views.js or the new helpers', () => {
  const views = readFileSync(file('site/js/setup-views.js'), 'utf8');
  const doc = readFileSync(file('site/js/grownups-doc.js'), 'utf8');
  const mine = doc.slice(doc.indexOf('SB4-WP6: how a child spells'));
  for (const s of [...strings(views), ...strings(mine)]) {
    if (/^\.{1,2}\//.test(s)) continue; // an import path
    const t = s.replace(/<[^>]*>/g, ' ');
    if (/\bSEN\b/.test(t) || /\b(profile|mode|doc|sync|toggle|scaffold|OCR)\b/i.test(t) || /input method|AI model|level [1-5]\b/i.test(t)) assert.fail('banned word in: ' + s);
  }
  void BANNED;
  for (const line of [P.SPELL_TILES_NOTE, P.QUIZ_OFFER_TEXT, P.TEST_OFFER_TEXT, P.OVERVIEW_CAPTION, P.usualLine(1), P.examOfferText('Robin', 4, 'normal')]) {
    assert.ok(line.split(/(?<=[.?!])\s+/).every((x) => x.split(/\s+/).length <= 20), line);
    assert.doesNotMatch(line, BANNED);
  }
});
test('no inline style or script, and the new routes are adult-only and in the shell', () => {
  for (const f of ['site/js/setup-views.js', 'site/css/grownups.css']) assert.doesNotMatch(readFileSync(file(f), 'utf8'), /style="|<script/);
  const guard = readFileSync(file('site/js/test-guard.js'), 'utf8');
  for (const r of ['grownups/overview', 'grownups/child/:cid/spelling', 'grownups/child/:cid/exam', 'grownups/child/:cid/exam/:eid']) assert.match(guard, new RegExp("'" + r.replace(/[/:]/g, '\\$&') + "': 'adult'"));
  assert.match(readFileSync(file('site/sw.js'), 'utf8'), /'js\/setup-views\.js'/);
  const css = readFileSync(file('site/css/grownups.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of css.split('}').map((r) => r.split('{')[0].trim()).filter((s) => s && !s.startsWith('@') && !/^\d|^(from|to)/.test(s))) {
    for (const sel of rule.split(',').map((x) => x.trim())) assert.match(sel, /^\.gu|^@/, 'scoped to .gu: ' + sel);
  }
});

// ---- the checker's cases ---------------------------------------------------------------------------
test('a word right in the test with tiles or a hint is not Got it; tile practice then a keyboard test is', () => {
  const test5 = W.addDays(MON, 5);
  for (const o of [{ lv: 2 }, { hn: 1 }]) {
    const { d, g } = week(['fruit']);
    const row = P.weekWords(tr(d, g, 'fruit', test5, { kind: 't', ...o }), g, test5).find((r) => r.word === 'fruit');
    assert.equal(row.status, 'getting', JSON.stringify(o));
    assert.equal(row.reason, 'right in the test with letter tiles');
  }
  let { d, g } = week(['fruit']);
  for (let i = 0; i < 3; i += 1) d = tr(d, g, 'fruit', W.addDays(MON, 1), { lv: 2 });
  d = tr(d, g, 'fruit', test5, { kind: 't' });
  assert.equal(P.weekWords(d, g, test5).find((r) => r.word === 'fruit').status, 'got');
  assert.equal(P.assistedWord(d, g, 'fruit'), false);
});
test('an exam with no kept run says Done; the Stretch note; no year claimed when the account gives none', () => {
  assert.equal(P.examStateLine('done', { date: MON }, null), 'Done');
  assert.match(P.stretchNote(2), /Stretch is keyboard only/);
  assert.equal(P.spellSub('Robin', 0), 'Each choice saves as soon as you tap it.');
});
