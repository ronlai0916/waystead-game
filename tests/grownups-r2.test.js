// SB5 R2: grown-up pages: the overview facts, "Big test" wording, the child print / earlier weeks / past week exports, the footer and Clear my progress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as W from '../site/js/words-doc.js';
import * as PR from '../site/js/progress-doc.js';
import * as P from '../site/js/grownups-doc.js';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MON = '2026-11-16';

test('overviewRow: last week, score and words to practise again, or a dash when nothing is tested', () => {
  const empty = P.overviewRow({ name: 'Ada', words: W.emptyDoc(), progress: PR.emptyDoc(), setup: {}, chapters: [], today: MON, now: 1 });
  assert.deepEqual([empty.lastWeek, empty.score, empty.practise], ['', '–', '']);
  let d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Class 4 spellings', test: MON, words: ['island', 'quay'], today: W.addDays(MON, -5), now: 1 }).doc;
  d = W.addTry(d, { id: 't1', word: 'island', day: MON, group: 'g1', kind: 't', tries: 0, peeks: 0, clean: true, now: 5 });
  d = W.addTry(d, { id: 't2', word: 'quay', day: MON, group: 'g1', kind: 't', tries: 2, peeks: 0, clean: false, now: 6 });
  const r = P.lastWeekFacts(d);
  assert.equal(r.lastWeek, 'Class 4 spellings');
  assert.match(r.score, /^\d of 2$/);
});

test('grown-up pages say Big test, never Exam', () => {
  const sv = read('site/js/setup-views.js');
  for (const s of ['Set a Big test', 'Big tests are off for', 'Delete this Big test', 'has not sat this Big test yet', 'Next Big test', 'Print for all']) assert.ok(sv.includes(s), s);
  assert.doesNotMatch(sv.replace(/examHref|examReportHref|data-exam\w*|exam: |\.exam|name="exam"|'exam'|kindName\('exam'|Su\.\w*Exam\w*|P\.exam\w*|examForm|examReport|\bexams?\b(?=[\w-]*[(.,;:)'\]]| =|\)|\/)/g, ''), /[“'>]\s*(Set an exam|Exams are off|Next exam|No exams set)/);
  assert.equal(P.examPlanLimit(), 'You already have 10 Big tests. Delete one first.');
  assert.match(P.examOfferText('Ada'), /Big test/);
});

test('the dead plan wizard is gone and the new pages are exported', () => {
  const gv = read('site/js/grownups-views.js');
  assert.doesNotMatch(gv, /function planForm|export function (planWeek|planAny|editWeek)/);
  for (const fn of ['printWeek', 'earlierWeeks', 'pastWeek']) {
    const i = gv.indexOf('export function ' + fn + '(');
    assert.ok(i > 0, fn);
    assert.match(gv.slice(i, i + 160), /adultOnly\(main\)/, fn);
  }
  assert.match(gv, /Copy results as text/);
  assert.match(gv, /Use this list again/);
  assert.match(gv, /Rename this week/);
  assert.match(gv, /renameHref\(id, g\.id\)/);
});

test('Clear my progress on Play yourself asks first', () => {
  const gv = read('site/js/grownups-views.js');
  const i = gv.indexOf('export function yourself(');
  const body = gv.slice(i, i + 3000);
  assert.match(body, /data-clearprogress/);
  assert.ok(body.indexOf('confirmDialog') < body.indexOf('S.resetAll()'), 'the confirm comes before the delete');
});

test('the adult footer shows the four links and the overview is cards on a phone', () => {
  assert.doesNotMatch(read('site/css/adult.css'), /foot__more\s*\{\s*display:\s*none/);
  const css = read('site/css/grownups.css');
  assert.match(css, /\.gu \.gu-ocards/);
  assert.doesNotMatch(css.slice(css.indexOf('SB5 R2')), /:has\(/);
});
