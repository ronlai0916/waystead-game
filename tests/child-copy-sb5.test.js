// SB5 (R4): a child's words. "hide" not "cover"; the games and sentence counts come from the rules, never a fixed "four" or "three";
// every sentence a child reads is at most 8 words, except the two Today lines the design draws longer (listed below, for Ron).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import * as C from '../site/js/child-doc.js';
import * as F from '../site/js/front-doc.js';
import * as CV from '../site/js/child-views.js';
import { literalsOf } from './copy-sb4.test.js';

const read = (p) => readFileSync(fileURLToPath(new URL('../site/js/' + p, import.meta.url)), 'utf8');
const words = (s) => s.trim().split(/\s+/).filter((x) => x !== '·').length;
const parts = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);

// Drawn in the design (07a, 07p3) at 9 and 10 words: the Day line and the quick-week line. Everything else is 8 or fewer.
const DESIGN_LONG = [/^Day \d+ of \d+ · your test is on /, /^Quick week: \d jobs today, test on /];
const long = (s) => parts(s).filter((p) => words(p) > 8 && !DESIGN_LONG.some((r) => r.test(p)));

test('the step lines and job sentences say hide, not cover', () => {
  for (const f of ['study-doc.js', 'child-doc.js', 'front-doc.js', 'study-views.js']) for (const l of literalsOf(read(f))) assert.doesNotMatch(l, /\bCover\b|\bcover,|\bcover and\b/, f + ': ' + l); // the [data-cover] hook and the 'cover' phase name are code, not words
  assert.match(St.STEP_TEXT.fix.line, /^Look, say, hide, write/);
  assert.equal(C.JOB_SENTENCE.fix, 'Look, say, hide and write each word.');
  assert.equal(F.JOBS.find((j) => j.id === 'fix').help, 'Look, say, hide, write');
});

test('no fixed number of games or sentences in a job line', () => {
  const all = [...Object.values(C.JOB_SENTENCE), ...Object.values(St.STEP_TEXT).map((s) => s.line), ...F.JOBS.map((j) => j.help)].join(' | ');
  assert.doesNotMatch(all, /\b(four|three|two|five|six)\b (quick )?(games|sentences|word games)/i);
});

test('jobSentence: the count from the rules, singular for one', () => {
  assert.equal(C.jobSentence('games', { games: 4 }), 'Play 4 quick games with your words.');
  assert.equal(C.jobSentence('games', { games: 2 }), 'Play 2 quick games with your words.');
  assert.equal(C.jobSentence('story', { sentences: 3 }), 'Read about your words. Write 3 sentences.');
  assert.equal(C.jobSentence('story', { sentences: 1 }), 'Read about your words. Write 1 sentence.');
  assert.equal(C.jobSentence('games'), C.JOB_SENTENCE.games, 'no count: the plain sentence');
  assert.equal(C.jobSentence('hello'), C.JOB_SENTENCE.hello);
});

test('homeView passes the counts to the sentence', () => {
  const d = W.createGroup(W.emptyDoc(), { id: 'g', name: 'W', test: '2026-11-20', words: ['one', 'two', 'three', 'four'], today: '2026-11-15', now: 1 }).doc;
  const g = W.groupById(d, 'g');
  const r = { status: 'job', group: g, step: { id: 'games', title: 'Game day' }, pip: 'happy', comeBack: [], strip: [] };
  assert.equal(C.homeView(r, '2026-11-17', { games: 3 }).headline, 'Play 3 quick games with your words.');
  assert.equal(C.homeView(r, '2026-11-17').headline, C.JOB_SENTENCE.games);
});

test('every sentence in the job lines is 8 words or fewer', () => {
  const lines = [...Object.values(C.JOB_SENTENCE), ...Object.values(St.STEP_TEXT).map((s) => s.line), ...F.JOBS.map((j) => j.help), C.jobSentence('games', { games: 6 }), C.jobSentence('story', { sentences: 3 })];
  // STEP_TEXT lines are for grown-ups and the job card; the job sentences are the child's
  for (const s of [...Object.values(C.JOB_SENTENCE), C.jobSentence('games', { games: 6 }), C.jobSentence('story', { sentences: 3 })]) assert.deepEqual(long(s), [], s);
  assert.ok(lines.length > 10);
});

const mk = (start, n) => { const d = W.createGroup(W.emptyDoc(), { id: 'g', name: 'Class 4', test: W.addDays(start, n), words: ['one', 'two', 'three', 'four'], today: start, now: 1 }).doc; return { d, g: W.groupById(d, 'g') }; };
test('Today: every line a child reads is 8 words or fewer (the two drawn longer are listed)', () => {
  const bad = [];
  for (const [start, n] of [['2026-11-15', 5], ['2026-11-22', 3], ['2026-11-22', 2], ['2026-11-15', 6]]) {
    const { d, g } = mk(start, n);
    for (let i = -1; i <= n + 3; i += 1) {
      const day = W.addDays(start, i);
      for (const year of [2, 4]) {
        const st = St.studyState(d, g, day);
        const jobs = CV.todayJobs(d, g, day, st);
        const t = CV.todayText({ g, st, day, year, jobs });
        for (const s of [t.line, t.sub, t.big, t.bigSub]) if (!/, then /.test(s || '')) bad.push(...long(s || '')); // "Hello words, Fix it in, then Game day" is a list of names
      }
    }
  }
  assert.deepEqual([...new Set(bad)], []);
});

test('the Tricky page is "Words to practise again" (09a, 09a2)', () => {
  const v = read('views.js');
  assert.match(v, /<h1>Words to practise again<\/h1>/);
  assert.match(v, /No words to practise again\. Well done!/);
  assert.match(v, /Go to Practice/);
  assert.match(v, /Practise ' \+ \(list\.length === 1/);
  assert.doesNotMatch(v, /Words to go back to|Nothing here yet|Play all/);
  assert.match(read('front-views.js'), /'Words to practise again', tricky \? nWords\(tricky\)/);
});
