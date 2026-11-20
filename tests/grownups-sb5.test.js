// SB5 (WP-A): grown-up rules that changed: exam sources from Word lists, the child page's weeks, the lead button.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../site/js/words-doc.js';
import * as Su from '../site/js/setup-doc.js';
import * as PR from '../site/js/progress-doc.js';
import * as P from '../site/js/grownups-doc.js';

const MON = '2026-11-16';
const OID = 'r0123456789ab';
const at = (day) => Date.parse(day + 'T10:00:00Z');
const setup = Su.setOwnCopy(Su.setOwnCopy({}, OID, { name: 'School words', words: ['island', 'quay'], src: 'typed' }, 5).setup, 'o2', { name: 'Other', words: ['knife'], src: 'typed' }, 6).setup;

test('examSources: each live list copy is a source, ready once tried or tested', () => {
  const d = W.emptyDoc();
  let src = P.examSources({ chapters: [], progress: PR.emptyDoc(), d, year: 4, today: MON, setup });
  const lists = src.filter((s) => s.kind === 'list');
  assert.deepEqual(lists.map((s) => [s.key, s.label, s.ready]).sort(), [['o-' + OID, 'School words', false], ['o-o2', 'Other', false]].sort());
  assert.deepEqual(lists.find((s) => s.key === 'o-' + OID).words, ['island', 'quay']);
  // tried (attempted a list test)
  const tried = PR.recordTest(PR.emptyDoc(), 'own-' + OID, 1, 2, at(MON), 'r1', { passed: false, pf: 'normal', lv: 5 });
  src = P.examSources({ chapters: [], progress: tried, d, year: 4, today: MON, setup });
  assert.equal(src.find((s) => s.key === 'o-' + OID).ready, true);
  assert.equal(src.find((s) => s.key === 'o-o2').ready, false);
  // a tested week from the list (prefix) also makes it ready
  const gid = OID + '.pabc12';
  let wd = W.createGroup(d, { id: gid, name: 'Wk', test: '2026-11-20', words: ['island'], today: MON, now: 1 }).doc;
  wd = W.addTry(wd, { id: 't1', word: 'island', day: '2026-11-20', group: gid, kind: 't', tries: 0, peeks: 0, clean: true, now: 5 });
  src = P.examSources({ chapters: [], progress: PR.emptyDoc(), d: wd, year: 4, today: MON, setup });
  assert.equal(src.find((s) => s.key === 'o-' + OID).ready, true);
  // no setup argument: unchanged behaviour
  assert.equal(P.examSources({ chapters: [], progress: PR.emptyDoc(), d, year: 4, today: MON }).length, 0);
});

test('examPlan, examSummary and examProblem count lists', () => {
  const src = P.examSources({ chapters: [], progress: PR.recordTest(PR.recordTest(PR.emptyDoc(), 'own-' + OID, 1, 2, at(MON), 'r1', { passed: false }), 'own-o2', 1, 1, at(MON), 'r2', { passed: false }), d: W.emptyDoc(), year: 4, today: MON, setup });
  const plan = P.examPlan(src, ['o-' + OID, 'o-o2'], 'normal');
  assert.equal(plan.lists, 2);
  assert.equal(plan.n, 3);
  assert.deepEqual(plan.pools.map((p) => p.src).sort(), ['o-' + OID, 'o-o2'].sort());
  assert.equal(P.examSummary(plan), '3 words from 2 lists');
  assert.equal(P.examSummary({ n: 5, chapters: 1, lists: 1, weeks: 1 }), '5 words from 1 chapter, 1 list and 1 week');
  assert.equal(P.examSummary({ n: 4, chapters: 0, lists: 1, weeks: 0 }), '4 words from 1 list');
  assert.equal(P.examProblem({ keys: [], date: MON, today: MON, liveCount: 0 }), 'Choose at least one chapter, list or week.');
});

test('childPageWeeks: soonest test first, with who set each', () => {
  let d = W.createGroup(W.emptyDoc(), { id: OID + '.abc123', name: 'From list', test: '2026-11-27', words: ['island'], today: MON, now: 1 }).doc;
  d = W.createGroup(d, { id: 'r1111111111aa', name: 'Robin made', test: '2026-11-20', words: ['zebra'], today: MON, now: 2 }).doc;
  d = W.createGroup(d, { id: 'r2222222222bb', name: 'Old teacher', test: '2026-11-25', words: ['quay'], today: MON, now: 3 }).doc;
  d = W.starterGroup(d, { name: 'Starter', words: ['fruit'], today: MON });
  const rows = P.childPageWeeks(d, MON, [{ id: OID, words: ['island', 'quay'] }]);
  assert.deepEqual(rows.map((r) => [r.name, r.setBy, r.testLine]), [
    ['Robin made', 'child', 'Test on Fri 20 Nov'],
    ['Starter', 'app', 'Test on Mon 23 Nov'],
    ['Old teacher', 'grown-up', 'Test on Wed 25 Nov'],
    ['From list', 'grown-up', 'Test on Fri 27 Nov'],
  ]);
  assert.equal(P.setByLine('grown-up', 'Robin'), 'You set this');
  assert.equal(P.setByLine('app', 'Robin'), 'Started by Spellbright');
  assert.equal(P.setByLine('child', 'Robin'), 'Robin’s own week, from before');
});

test('the lead button says Set a week; the locked line says set next week', () => {
  const kid = (name, key) => ({ name, key, waiting: 0 });
  assert.deepEqual(P.primaryAction([kid('A', 'ontrack')]), { kind: 'set', index: -1, label: 'Set a week' });
  assert.equal(P.primaryAction([kid('Ada', 'noweek')]).label, 'Set a week for Ada');
  assert.equal(P.primaryAction([kid('Ada', 'ended')]).label, 'Set Ada’s next week');
  assert.equal(P.setIsPrimary([kid('A', 'ontrack')]), true);
  assert.equal(P.LOCKED_LINE, 'The test has begun, so the words and date can\'t change now. You can still rename the week, or set next week.');
  for (const gone of ['firstStep', 'stepBack', 'FULL_WEEK_LINE', 'atCap', 'confirmLine', 'suggestName', 'planIsPrimary']) assert.equal(P[gone], undefined, gone);
});
