// SB5 UAT3 fixes (S6): each finding of the four Haiku business-user runs, as a test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as L from '../site/js/lists-doc.js';
import * as RD from '../site/js/role-doc.js';
import * as D from '../site/js/own-data.js';
import * as V from '../site/js/set-views.js';
import * as P from '../site/js/grownups-doc.js';
import * as CV from '../site/js/child-views.js';
import * as SN from '../site/js/sentences-data.js';

const src = (p) => readFileSync(new URL('../site/' + p, import.meta.url), 'utf8');
const OWN = src('js/own-views.js');
const GV = src('js/grownups-views.js');
const CSS = src('css/set.css');

// (a) the editor's sentence line tells the truth while the maker is off
test('a: the editor foot says what happens while the sentence maker is off, and only then', () => {
  assert.equal(SN.SENTENCES_API, false, 'ships off');
  const off = L.sentenceFoot(true);
  assert.doesNotMatch(off, /are made for words you type/);
  assert.match(off, /you write a sentence yourself/);
  assert.match(off, /ready-made/);
  assert.equal(L.sentenceFoot(false), 'Sentences are made for words you type.');
  assert.match(OWN, /L\.sentenceFoot\(sentences\(\)\.off\)/);
  assert.doesNotMatch(OWN, /'\. Sentences are made for words you type\./);
});

// (b) the Ask page never says "email us" while there is no address
test('b: with no address the ask page points at the Waystead account, with one it still can email', () => {
  assert.match(GV, /export const ASK_EMAIL = '';/);
  for (const many of ['children', 'learners']) {
    const off = RD.askLine(many, false);
    assert.doesNotMatch(off, /email/i);
    assert.match(off, /Waystead account/);
    assert.match(RD.askLine(many, true), /email us/);
  }
  assert.match(GV, /RD\.askLine\(many, !!ASK_EMAIL\)/);
  assert.equal(RD.placesLine('tutor', 5, 5), 'You have 5 of 5 learners.');
  assert.equal(RD.placesLine('parent', 2, 5), 'You have 2 of 5 places.');
  assert.equal(RD.askMoreFor('tutor'), 'Ask for more learners');
  assert.equal(RD.askMoreFor('parent'), 'Ask for more places');
});

// (c) student Today: two different plain labels, and the icon button has a name
test('c: Today has no two near-identical practise/practice labels', () => {
  const t = CV.todayText({ g: null });
  assert.equal(t.big, 'Pick words');
  assert.equal(t.bigSub, 'Choose words to practise');
  const m = /title: 'Practice', sub: g \? '([^']+)' : '([^']+)'/.exec(src('js/child-views.js'));
  assert.ok(m, 'the Practice tile');
  for (const s of [m[1], m[2]]) assert.notEqual(s, t.bigSub);
  assert.doesNotMatch(src('js/child-views.js'), /Pick any words|Year chapters and your own words|Practise a little/);
});
test('c: the read-it-to-me speech button has an accessible name and a tooltip', () => {
  assert.match(src('js/child-views.js'), /data-hear title="Read it to me" aria-label="Read it to me: /);
});

// (d) tutor wording, the left-out word, the not-yet-started week
test('d: a tutor reads learner(s), never child(ren), on the shared lines', () => {
  assert.equal(L.asRole(L.PAGE.giveHelp, 'tutor'), 'The learner can practise these words any time. No test and no daily jobs.');
  assert.equal(L.asRole(L.PAGE.noResults, 'tutor'), 'No results yet. Results show after a learner practises these words.');
  assert.equal(L.asRole(L.PAGE.allKids, 'tutor'), 'All learners who can have it');
  assert.equal(L.asRole(L.giveButton(2), 'tutor'), 'Give to 2 learners');
  assert.equal(L.asRole(L.PAGE.giveHelp, 'parent'), L.PAGE.giveHelp);
  assert.match(OWN, /L\.asRole\(L\.PAGE\.giveHelp, role\)/);
});
test('d: the word left out of an 11-word chapter is named before Save', () => {
  const list = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8', 'i9', 'j10', 'length'];
  const left = V.leftOut(list, list.slice(0, 10));
  assert.deepEqual(left, ['length']);
  assert.match(V.leftOutLine(left), /^Left out of this week: length\. To swap it, use the link below\.$/);
  assert.equal(V.leftOutLine([]), '');
  const html = V.summaryHtml({ role: 'tutor', label: 'Year 3 · Chapter 1', line: '11 words', over: true, left });
  assert.match(html, /data-leftout/);
  assert.match(html, /Left out of this week: length/);
  assert.doesNotMatch(V.summaryHtml({ role: 'tutor', label: 'x', line: '5 words', over: false, left: [] }), /data-leftout/);
});
test('d: a week not yet finished is "This week", not "Last week"', () => {
  assert.equal(P.weekKey({ lastWeek: 'Chapter 1', week: 'Chapter 2' }), 'Last week');
  assert.equal(P.weekKey({ lastWeek: '', week: 'Year 3 · Chapter 1' }), 'This week');
  assert.equal(P.weekKey({ lastWeek: '', week: 'No week planned' }), 'Week');
  assert.doesNotMatch(src('js/setup-views.js'), /<dt>Last week<\/dt>|<th scope="col">Last week<\/th>/);
});

// (e) teacher
test('e: the preview card folds into its cue row on a phone up to 899 px tall', () => {
  assert.match(CSS, /@media \(max-width: 600px\) and \(min-height: 700px\) and \(max-height: 899px\) \{\s*\.st-when \.st-see--full, \.st-when \.st-daybyday \{ display: none; \}\s*\.st-when \.st-see--cue \{ display: flex; \}/);
});
test('e: the class band says the week\'s state when a week is already set', () => {
  const lab = (x) => 'LBL ' + x;
  assert.deepEqual(RD.classBand({ n: 5 }), { label: 'Set the class week', line: 'All 5 children ticked, one test date' });
  const today = RD.classBand({ tests: ['2026-11-19'], today: '2026-11-19', n: 5, dayLabel: lab });
  assert.equal(today.label, 'Set next week');
  assert.match(today.line, /^The class test is today/);
  assert.doesNotMatch(today.line, /Starts after/);
  const later = RD.classBand({ tests: ['2026-11-27'], today: '2026-11-19', n: 5, dayLabel: lab });
  assert.match(later.line, /^Class week running · test LBL 2026-11-27/);
  const done = RD.classBand({ tests: [], ended: 5, today: '2026-11-30', n: 5 });
  assert.equal(done.label, 'Set next week');
  assert.match(done.line, /The class test is done/);
  assert.match(GV, /RD\.classBand\(/);
});
test('e: "See the class results" always reaches a screen with printing', () => {
  assert.equal(V.classResultsHref('r1'), '#/grownups/own/r1/results');
  assert.equal(V.classResultsHref(''), '#/grownups/class');
  assert.match(src('js/app.js'), /\['grownups\/class', SU\.overview\]/);
  assert.match(src('js/setup-views.js'), /data-print-report/);
});
test('e/f: a refused word says why and what to do; a near match reads plainly', () => {
  const plain = D.refusedLines('india', '');
  assert.equal(plain.head, D.OWN_REFUSED);
  assert.match(plain.tail, /Names of people, places and months are not spelling words here\./);
  assert.match(plain.tail, /remove it/);
  assert.deepEqual(D.refusedLines('frend', 'friend'), { head: '“frend” doesn’t look right.', tail: 'Did you mean “friend”?' });
  assert.match(OWN, /Use “' \+ sug \+ '”/);
});

// (f) parent
test('f: the home confirms the saved name', () => {
  assert.equal(RD.seenAsLine('parent', 'Mum'), 'Set by Mum. Your children see this name on their weeks.');
  assert.equal(RD.seenAsLine('tutor', 'Sam'), 'Set by Sam. Your learners see this name on their weeks.');
  assert.equal(RD.seenAsLine('teacher', 'Ms Patel'), 'Set by Ms Patel. Your class sees this name on their weeks.');
  assert.equal(RD.seenAsLine('parent', ''), '');
  assert.match(GV, /data-seenas/);
});
test('f: a Year 4 chapter for a Year 6 child is explained, and never blocks', () => {
  const n = V.yearNote('Wren', 6, 4);
  assert.match(n, /Wren is in Year 6\. These are Year 4 words, so they may be easier than Wren needs\. You can still set them\./);
  assert.match(V.yearNote('Robin', 4, 6), /harder/);
  assert.doesNotMatch(src('js/set-views.js'), /mismatch[^;\n]*(disabled|return;|blocked)/);
});
test('f: a tap while a word is being checked is queued, not dropped', () => {
  assert.match(OWN, /if \(busy\) \{ waiting\.push\(text\); say\(L\.CHECKING_LINE\); return; \}/);
  assert.match(OWN, /if \(waiting\.length\) await addText\(waiting\.shift\(\)\);/);
  assert.doesNotMatch(OWN, /if \(busy \|\| full\(\)\) return;/);
  assert.match(L.CHECKING_LINE, /checking the last word/);
});
