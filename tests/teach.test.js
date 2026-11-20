// SB4-WP11: the teacher page. Pure rules (teach-doc.js) with a four-child fixture, the wording, and the places the page is wired in.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as Ow from '../site/js/own-doc.js';
import * as Su from '../site/js/setup-doc.js';
import * as PR from '../site/js/progress-doc.js';
import * as T from '../site/js/teach-doc.js';
import { RULES } from '../site/js/test-guard.js';

const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const read = (p) => readFileSync(file(p), 'utf8');

const OID = 'o1';
const WORDS = ['because', 'friend', 'island', 'thought', 'weight', 'knife', 'autumn', 'circle', 'famous', 'history', 'answer', 'breathe'];
const MASTER = { name: 'Autumn 2 spellings', words: WORDS, src: 'typed', at: 5000, to: ['c1', 'c2', 'c3', 'c4'] };
const TODAY = '2026-11-21';
const MON = '2026-11-16';
const at = (day) => Date.parse(day + 'T10:00:00Z');
const copyOn = () => Su.setOwnCopy({}, OID, { name: MASTER.name, words: WORDS, src: 'typed' }, MASTER.at).setup;
const prog = (fn = (d) => d) => fn(PR.emptyDoc());

// Robin: passed the chapter test with letter tiles, a quiz with tiles, 'knife' is on the tricky list.
const robin = (() => {
  let p = PR.mark(PR.mark(PR.emptyDoc(), 'own-' + OID, 'studiedAt', at(MON)), 'own-' + OID, 'practisedAt', at(MON));
  p = PR.recordTest(p, 'own-' + OID, 11, 12, at(TODAY), 'r1', { passed: true, pf: 'normal', lv: 2 });
  p = PR.addCheck(p, { c: 'q:own-' + OID, k: 'q', s: 4, t: 5, d: MON, lv: 2, pf: 'normal' }, at(MON), 'q1');
  p = { ...p, tricky: { knife: { n: 2, c: 'own-' + OID, at: at(MON) } } };
  return { d: W.emptyDoc(), progress: p, setup: copyOn() };
})();
// Wren: studying, a quiz that missed 'island' (and 'weight'), one peek.
const wren = (() => {
  let p = PR.mark(PR.emptyDoc(), 'own-' + OID, 'studiedAt', at(MON));
  p = PR.addCheck(p, { c: 'q:own-' + OID, k: 'q', s: 3, t: 5, d: MON, lv: 2, pf: 'sen', pk: 1, miss: ['island', 'weight'] }, at(MON), 'q2');
  return { d: W.emptyDoc(), progress: p, setup: copyOn() };
})();
// Ada: a week from the list (10 of its words) whose test is done with 'thought' not right.
const ada = (() => {
  const ten = WORDS.slice(0, 10);
  let d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Autumn test', test: '2026-11-20', words: ten, today: MON, now: at(MON) }).doc;
  ten.forEach((w, i) => { d = W.addTry(d, { id: 't' + i, word: w, day: '2026-11-20', group: 'g1', kind: 't', tries: w === 'thought' ? 1 : 0, peeks: 0, clean: w !== 'thought', now: at('2026-11-20') + i }); });
  return { d, progress: PR.emptyDoc(), setup: copyOn() };
})();
// Kofi: the list never reached him.
const kofi = { d: W.emptyDoc(), progress: PR.emptyDoc(), setup: {} };
const res = (x, childId) => T.childResult({ oid: OID, master: MASTER, d: x.d, progress: x.progress, setup: x.setup, today: TODAY, childId });

test('childResult: the four-child fixture shows exactly the saved facts', () => {
  const r = res(robin, 'c1');
  assert.equal(r.has, 'sent');
  assert.deepEqual(r.stage, { key: 'passed', label: 'Passed' });
  assert.equal(r.studied, true);
  assert.equal(r.practised, true);
  assert.equal(r.test.passed, true);
  assert.equal(r.test.attempts, 1);
  assert.equal(r.test.line, '11 of 12 · Standard · with letter tiles (Some letters)');
  assert.equal(r.quiz, '4 of 5 · Standard · with letter tiles (Some letters)');
  assert.equal(r.week, null);
  assert.deepEqual(r.toPractise, ['knife']);

  const w = res(wren, 'c2');
  assert.equal(w.stage.key, 'studying');
  assert.equal(w.studied, true);
  assert.equal(w.practised, false);
  assert.equal(w.test, null);
  assert.match(w.quiz, /^3 of 5 · Extra support · with letter tiles \(Some letters\) · 1 peek$/);
  assert.deepEqual(w.toPractise, ['island', 'weight']);

  const a = res(ada, 'c3');
  assert.equal(a.week.done, true);
  assert.equal(a.week.name, 'Autumn test');
  assert.match(a.week.line, /^Autumn test test · 9 of 10 · Standard · keyboard$/);
  assert.deepEqual(a.toPractise, ['thought']);
  assert.equal(a.stage.key, 'todo');
  assert.equal(a.quiz, null);

  const k = res(kofi, 'c4');
  assert.equal(k.has, 'behind');
  assert.equal(k.stage.key, 'todo');
  assert.equal(k.test, null);
  assert.equal(k.quiz, null);
  assert.equal(k.week, null);
  assert.deepEqual(k.toPractise, []);
});

test('childResult: an older copy is behind; a deleted one is behind; a keyboard result never says tiles', () => {
  const old = Su.setOwnCopy({}, OID, { name: 'Old', words: ['island'], src: 'typed' }, 10).setup;
  assert.equal(T.childResult({ oid: OID, master: MASTER, d: W.emptyDoc(), progress: PR.emptyDoc(), setup: old, today: TODAY, childId: 'c1' }).has, 'behind');
  const p = PR.recordTest(PR.emptyDoc(), 'own-' + OID, 6, 12, at(TODAY), 'r9', { passed: false });
  const r = T.childResult({ oid: OID, master: MASTER, d: W.emptyDoc(), progress: p, setup: copyOn(), today: TODAY, childId: 'c1' });
  assert.equal(r.test.line, '6 of 12 · Standard · keyboard');
  assert.equal(r.test.passed, false);
  assert.equal(r.stage.key, 'studying', 'a test taken counts as started');
});

test('weekFor: the newest live week whose every word is in the list; one word outside, or a deleted week, is ignored', () => {
  let d = W.emptyDoc();
  d = W.createGroup(d, { id: 'a', name: 'Older', test: '2026-11-20', words: ['island', 'weight'], today: MON, now: 10 }).doc;
  d = W.createGroup(d, { id: 'b', name: 'Newer', test: '2026-11-27', words: ['Because', 'friend'], today: MON, now: 20 }).doc;
  d = W.createGroup(d, { id: 'c', name: 'Mixed', test: '2026-11-30', words: ['island', 'zebra'], today: MON, now: 30 }).doc;
  assert.equal(T.weekFor(d, WORDS).id, 'b', 'newest by when it was made, case ignored');
  assert.equal(T.weekFor(d, ['island', 'weight']).id, 'a');
  assert.equal(T.weekFor(d, ['island']), null, 'a week with a word outside the list is not from it');
  assert.equal(T.weekFor(W.emptyDoc(), WORDS), null);
  d = { ...d, groups: { ...d.groups, b: { ...d.groups.b, gone: 99 } } };
  assert.equal(T.weekFor(d, WORDS).id, 'a', 'a deleted week is not live');
});

test('toPractise: list order, no repeats, case ignored, each source counts', () => {
  assert.deepEqual(T.toPractise({ words: WORDS, quizMiss: ['Island'], weekHelp: ['weight', 'island'], tricky: ['knife', 'zebra'] }), ['island', 'weight', 'knife']);
  assert.deepEqual(T.toPractise({ words: WORDS }), []);
});

test('summaryLine: non-zero parts in order; all zero says so', () => {
  assert.equal(T.summaryLine({ passed: 2, studying: 1, todo: 1, notSent: 0 }), '2 passed · 1 studying · 1 to do');
  assert.equal(T.summaryLine({ passed: 1, studying: 2, todo: 1, notSent: 1 }), '1 passed · 2 studying · 1 to do · 1 not sent yet');
  assert.equal(T.summaryLine({ passed: 0, studying: 1, todo: 0, notSent: 0 }), '1 studying');
  assert.equal(T.summaryLine({ passed: 0, studying: 0, todo: 0, notSent: 2 }), '2 not sent yet');
  assert.equal(T.summaryLine({ passed: 0, studying: 0, todo: 0, notSent: 0 }), 'Not started by anyone yet');
  assert.equal(T.summaryLine(null), 'Not started by anyone yet');
});

test('listSummary: counts only the children who are on the account; a child not read is left out; not sent is counted apart', () => {
  const kids = { c1: robin, c2: wren, c3: ada, c4: kofi };
  const own = { [OID]: { ...MASTER, to: ['c1', 'c2', 'c3', 'c4', 'gone'] }, o2: { name: 'Trip words', words: ['quay'], src: 'typed', at: 9000, to: [] } };
  const out = T.listSummary(own, (oid, cid) => (cid === 'c3' ? null : oid === OID ? res(kids[cid], cid) : null), ['c1', 'c2', 'c3', 'c4']);
  assert.deepEqual(out.map((x) => x.id), ['o2', OID], 'newest first');
  const a = out[1];
  assert.deepEqual(a.to, ['c1', 'c2', 'c3', 'c4'], 'a child no longer on the account is skipped');
  assert.deepEqual(a.counts, { passed: 1, studying: 1, todo: 0, notSent: 1 });
  assert.equal(a.read, 3);
  assert.equal(T.summaryLine(a.counts), '1 passed · 1 studying · 1 not sent yet');
  assert.deepEqual(out[0].to, []);
  assert.equal(out[0].read, 0);
});

test('wordRows: the list\'s own order, never by who needs most', () => {
  const rows = T.wordRows(WORDS, [{ name: 'Wren', toPractise: ['weight', 'island'] }, { name: 'Ada', toPractise: ['thought', 'weight'] }, { name: 'Robin', toPractise: ['knife'] }]);
  assert.deepEqual(rows.map((r) => r.word), WORDS);
  assert.deepEqual(rows.find((r) => r.word === 'island').names, ['Wren']);
  assert.deepEqual(rows.find((r) => r.word === 'weight').names, ['Wren', 'Ada']);
  assert.deepEqual(rows.find((r) => r.word === 'because').names, []);
  assert.equal(T.wordRowLine(['Wren', 'Ada']), 'To practise: Wren, Ada');
  assert.equal(T.wordRowLine([]), 'No one noted');
});

const rowsOf = () => [['c1', 'Robin', 3, robin], ['c2', 'Wren', 1, wren], ['c3', 'Ada', 3, ada], ['c4', 'Kofi', 4, kofi]].map(([cid, name, year, x]) => ({ cid, name, year, result: res(x, cid) }));
test('reportText: the whole page names every child and the words; one child names that child only', () => {
  const all = T.reportText({ listName: MASTER.name, day: TODAY, rows: rowsOf(), words: WORDS });
  for (const n of ['Robin', 'Wren', 'Ada', 'Kofi']) assert.match(all, new RegExp('\\b' + n + '\\b'));
  assert.match(all, /^Autumn 2 spellings\n21 Nov 2026\n12 words · given for practice to Robin, Wren, Ada and Kofi\n/);
  assert.match(all, /island: To practise: Wren/);
  assert.match(all, /because: No one noted/);
  assert.match(all, /Not sent to Kofi yet\./);
  assert.match(all, /Words to practise come from the newest quiz/);
  assert.match(all, /Printed or copied results show children's names\. Keep them safe\.$/);
  const one = T.reportText({ listName: MASTER.name, day: TODAY, rows: rowsOf(), words: WORDS, only: 'c2' });
  assert.match(one, /\bWren\b/);
  for (const n of ['Robin', 'Ada', 'Kofi']) assert.doesNotMatch(one, new RegExp('\\b' + n + '\\b'), n + ' must not be in one child\'s text');
  assert.match(one, /^Autumn 2 spellings\n21 Nov 2026\n12 words · Wren\n/);
  assert.doesNotMatch(one, /The words/, 'no word rows (they name other children)');
  assert.match(one, /Words to practise: island, weight/);
  assert.doesNotMatch(one, /<|&[a-z]+;/, 'plain text');
  const bad = T.reportText({ listName: 'L', day: TODAY, rows: [{ cid: 'c9', name: 'Zed', year: 2, problem: 'network' }], words: ['quay'] });
  assert.match(bad, /Zed \(Year 2\)\nWe can't reach Waystead just now/);
});

test('the small helpers: dates, plurals, lines', () => {
  assert.equal(T.printedLine('2026-11-16'), 'Printed on 16 Nov 2026');
  assert.equal(T.headLine(12, ['Robin', 'Wren', 'Ada', 'Kofi']), '12 words · given for practice to Robin, Wren, Ada and Kofi');
  assert.equal(T.headLine(1, []), '1 word · not given for practice yet');
  assert.equal(T.printOneLine(12, 'Robin'), '12 words · Robin');
  assert.equal(T.onePrintLine('Robin'), 'Only Robin’s results will print or copy. Use this when you hand it to one family.');
  assert.equal(T.onePrintLine('Chris'), 'Only Chris’s results will print or copy. Use this when you hand it to one family.');
  assert.equal(T.notReachedLine(['Robin', 'Wren']), 'It hasn\'t reached Robin or Wren yet.');
  assert.equal(T.sharedLine([]), 'Not given for practice yet');
  assert.equal(T.sharedLine(['Robin', 'Wren']), 'Given for practice to Robin and Wren');
  assert.equal(T.attemptsLine(2), 'Taken 2 times');
  assert.equal(T.attemptsLine(1), 'Taken 1 time');
  assert.deepEqual(T.liveLists({ a: { name: 'B', words: ['x'], src: 'typed', at: 5, to: [] }, b: { name: 'A', words: ['x'], src: 'typed', at: 9, to: [] }, c: { name: 'C', words: ['x'], src: 'typed', at: 9, to: [], gone: 3 } }).map((x) => x.id), ['b', 'a']);
});

// ---- wording ---------------------------------------------------------------------------------------------------------------
const strings = (src) => [...src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] || m[2] || m[3] || '');
const FILES = ['site/js/teach-doc.js'];
const lines = (f) => strings(read(f)).filter((s) => !/^\.{1,2}\//.test(s)).map((s) => s.replace(/<[^>]*>/g, ' ').replace(/\\'/g, '\'')).filter((s) => /\s/.test(s.trim()) || /^[A-Z]/.test(s.trim()));
test('grown-up copy: no banned word, never "class" outside the one scope line, no "pupil", short sentences', () => {
  for (const f of FILES) {
    for (const s of lines(f)) {
      assert.ok(!/\bSEN\b/.test(s) && !/\b(profile|mode|doc|sync|toggle|scaffold|OCR)\b/i.test(s) && !/input method|AI model|level [1-5]\b/i.test(s), f + ': ' + s);
      assert.doesNotMatch(s, /\b(pupil|pupils|student account|school account)\b/i, f + ': ' + s);
      if (!/class=|\bclass\s/.test(s) && /\bclass(es)?\b/i.test(s)) assert.equal(s, T.SCOPE_LINE, f + ': "class" only in the one scope line: ' + s);
      assert.doesNotMatch(s, /\b(worst|failed|behind)\b/i, f + ': ' + s);
      assert.doesNotMatch(s, /(?<![-_.#\w])(color|gray|practicing|favorite|center)(?![-_\w])/i, f + ': ' + s);
      assert.doesNotMatch(s, /\b(?!(?:size|prize|seize|maize|autocapitalize)\b)\w+ize\b/, f + ': ' + s);
    }
  }
  const sentences = [T.SCOPE_LINE, T.PERMISSION_LINE, T.KEY_LINE, T.KEEP_SAFE, T.OFFLINE, T.GONE, T.COPY_FAILED, T.WORDS_CAPTION, T.onePrintLine('Robin')];
  for (const s of sentences) for (const p of s.split(/(?<=[.?!])\s+/)) assert.ok(p.split(/\s+/).length <= 20, p);
  assert.equal(T.SCOPE_LINE, 'Your account holds up to 5 children. Whole classes are not here yet.');
});
test('no inline style or script, no storage, and the rules file is pure', () => {
  for (const f of [...FILES, 'site/css/grownups.css']) assert.doesNotMatch(read(f), /style="|<script|\.style\./, f);
  assert.doesNotMatch(read('site/js/results-views.js'), /localStorage|sessionStorage|indexedDB/, 'the page keeps nothing about a child');
  assert.doesNotMatch(read('site/js/results-views.js'), /\.style\b|setAttribute\('style'/);
  assert.doesNotMatch(read('site/js/teach-doc.js'), /\b(document|window|fetch|localStorage|sessionStorage)\b|Date\.now|new Date\(\)|Math\.random/, 'no DOM, fetch, clock or random');
});
test('the new CSS is all under .gu and sits in its own section', () => {
  const css = read('site/css/grownups.css');
  const mine = css.slice(css.indexOf('/* SB4-WP11 teach'));
  assert.ok(mine.length > 500);
  for (const rule of mine.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{').pop().length ? r.split('{')[0].trim() : '').filter((s) => s && !s.startsWith('@'))) {
    for (const sel of rule.split(',').map((x) => x.trim())) assert.match(sel, /^\.gu/, sel);
  }
});

// ---- wiring ------------------------------------------------------------------------------------------------------------------
test('both routes are adult-only, in the router with a parent, and the new files are in the shell', () => {
  assert.equal(RULES['grownups/teach'], 'adult');
  assert.equal(RULES['grownups/teach/:oid'], 'adult');
  assert.match(read('site/js/test-guard.js'), /SB4-WP11 rules/);
  const sw = read('site/sw.js');
  assert.match(sw, /SB4-WP11 files/);
  assert.ok(sw.includes("'js/teach-doc.js'"));
  // SB5 (WP-E): teach-views.js is gone; its results page is results-views.js listResults (the routes and the shell list are WP-G's)
  assert.ok(!existsSync(new URL('../site/js/teach-views.js', import.meta.url)));
  assert.match(read('site/js/results-views.js'), /export function listResults/);
});
test('See results and the About sentence', () => {
  // SB5: the foot link "For teachers and tutors" is gone (B9 dropped); the library card says Results, and the About sentence stays
  assert.match(read('site/js/own-views.js'), /data-results-link/);
  // SB5 (R4, 06d): the About page has no "up to 5 children" and no sharing between grown-ups; see tests/views-about-sb5.test.js
  assert.doesNotMatch(read('site/js/views.js'), /up to 5 children|share it with them/);
});
test('the overview caption fix is in, for phones', () => {
  assert.match(read('site/css/grownups.css'), /@media \(max-width: 700px\) \{ \.gu \.gu-table caption:not\(\.sr\) \{ display: block; width: auto; \} \}/);
});

test('the results page has no Set form (a week is set from Set a week)', () => {
  const src = read('site/js/results-views.js');
  assert.ok(!/createPlan|changeWords|data-set-go/.test(src));
  assert.match(src, /Print for the class/);
});

test('reportText: a child with no year has no "(Year undefined)"', () => {
  const t = T.reportText({ listName: 'L', day: TODAY, rows: [{ cid: 'c9', name: 'Zed', problem: 'network' }], words: ['quay'] });
  assert.ok(!/undefined|\(Year/.test(t) && /Zed/.test(t));
});

test('wording: N-10 joins names with "or"', () => {
  assert.equal(T.joinNames(['A', 'B', 'C'], 'or'), 'A, B or C');
});
