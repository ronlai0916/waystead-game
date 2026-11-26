// SB6 WP-7: the grown-up pages of Step by step: the way card's rules, the report model, stuck words, the estimate lines, Help for each child.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../site/js/words-doc.js';
import * as Su from '../site/js/setup-doc.js';
import * as P from '../site/js/grownups-doc.js';
import * as RD from '../site/js/role-doc.js';
import * as SD from '../site/js/set-doc.js';
import * as SV from '../site/js/set-views.js';
import { sbsDoc } from '../tools/smoke-sb6/gu.mjs';

const DAY = '2026-11-04';
const doc = (o) => W.normalise(sbsDoc(o));

test('way card settings: Usual way and Step by step defaults', () => {
  assert.deepEqual(P.waySettings({}, 4), { way: 'usual', min: 10, big: false, after: '', peek: 3, peekSaved: -1, year: 4 });
  const s = Su.setSbs(Su.setWay({}, 'sbs', 5, 'Sam').setup, { min: 15, big: true, after: '18:45' }, 6, 'Sam');
  assert.deepEqual(P.waySettings(s, 4), { way: 'sbs', min: 10 + 5, big: true, after: '18:45', peek: 3, peekSaved: -1, year: 4 });
  assert.match(P.wayChangedLine(s.way ? s : Su.setWay({}, 'sbs', 5, 'Sam').setup), /^Last changed by Sam, /);
  assert.equal(P.FIRST_ON_LINE, 'Help in tests is now Extra support. You can change it.');
  assert.equal(P.tileSizeLine(2), 'Years 1 to 2 (56 px)');
  assert.equal(P.tileSizeLine(5), 'Years 3 to 6 (48 px)');
});

test('isSbsWeek: the setting, or any try with a rung', () => {
  const u = doc({ way: 'usual', report: false });
  assert.equal(P.isSbsWeek(u, W.groupById(u, 'g1')), false);
  assert.equal(P.isSbsWeek(doc({ report: false }), W.groupById(doc({ report: false }), 'g1')), true);
  const used = W.setupOf(u);
  assert.equal(P.isSbsWeek(W.addTry(u, { id: 'a', word: 'night', day: DAY, group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, source: 'g', r: 2, j: 'f', ss: 'aaaaaa', now: 1e12 }), W.groupById(u, 'g1'), used), true);
});

test('the report: four statuses in the grown-up\'s words, facts only, Peek counts, no banned words', () => {
  const d = doc();
  const g = W.groupById(d, 'g1');
  const m = P.sbsWeek(d, g, DAY, { name: 'Robin' });
  const by = Object.fromEntries(m.words.map((w) => [w.word, w]));
  assert.deepEqual([by.night.pill, by.friend.pill, by.island.pill, by.guard.pill], ['On its own', 'Once on its own', 'Still climbing', 'Not started']);
  assert.match(by.friend.line, /2 Peeks so far/);
  assert.match(by.island.line, /3 Peeks so far/);
  for (const w of m.words) assert.ok(!/\b(wrong|fail|mistake|score|level)\b|%/i.test(w.line), w.line);
  assert.match(m.estimate.line, /^At least about \d+ sittings of 10 minutes before the test: about \d+ a day\./);
  assert.match(m.rows, /Pairs to do/);
  assert.deepEqual(m.sittings.map((x) => x.end), ['Finished', 'Finished', 'Stopped for now']);
  assert.deepEqual(m.sentences.map((x) => x.help), [false, true]);
});

test('Slips around a part of the word comes from the entry', () => {
  const d = doc();
  const g = W.groupById(d, 'g1');
  const m = P.sbsWeek(d, g, DAY, { name: 'Robin', entryOf: (w) => (w === 'friend' ? { word: 'friend', chunks: ['friend'], tricky: 'ie' } : null) });
  assert.match(m.words.find((w) => w.word === 'friend').line, /Slips around 'ie'\./);
});

test('D25 stuck words: shown to the grown-up, set aside only by the grown-up\'s record, for that day', () => {
  const d = doc();
  const g = W.groupById(d, 'g1');
  const m = P.sbsWeek(d, g, DAY, { name: 'Robin' });
  assert.deepEqual(m.stuck.map((x) => x.line), ['Stuck word: light']);
  assert.equal(m.stuck[0].aside, false);
  assert.equal(P.setAsideButton('Robin'), 'Let Robin set it aside for today');
  const a = W.setAside(d, 'g1', 'light', DAY, 9e12);
  assert.equal(P.sbsWeek(a, g, DAY, { name: 'Robin' }).stuck[0].aside, true);
  const tomorrow = P.sbsWeek(a, g, '2026-11-05', { name: 'Robin' }).stuck;
  assert.deepEqual(tomorrow.map((x) => x.aside), [false], 'tomorrow the word is not set aside: it comes back first');
  assert.equal(P.sbsWeek(a, g, '2026-11-20', { name: 'Robin' }).stuck.length, 0, 'not lately: nothing is shown');
  const back = W.setAside(a, 'g1', 'light', '', 9e12 + 1);
  assert.equal(P.sbsWeek(back, g, DAY, { name: 'Robin' }).stuck[0].aside, false);
});

test('the test lines: "with a peek" is its own line and does not count', () => {
  const d = doc({ test: true });
  const m = P.sbsWeek(d, W.groupById(d, 'g1'), '2026-11-08', { name: 'Robin' });
  assert.deepEqual(m.test.withPeek, ['guard: spelled with a peek']);
  assert.ok(!m.test.spelled.includes('guard'));
  const lines = P.sbsPrintLines(m, { name: 'Robin', test: 'Sat 7 Nov' });
  assert.ok(lines.some((l) => /with a peek/.test(l)) && lines.some((l) => /^Words in a row: /.test(l)));
});

test('the usual-way offer needs two ended weeks of every word On its own', () => {
  assert.equal(P.usualWayOffer(doc(), DAY), false);
});

test('Help for each child: Way of learning and a stuck word that needs a look (Step by step only)', () => {
  assert.equal(RD.wayName(W.setupOf(doc())), 'Step by step');
  assert.equal(RD.wayName(W.setupOf(doc({ way: 'usual', report: false }))), 'Usual way');
  assert.equal(RD.WAY_COLUMN, 'Way of learning');
  const needs = RD.needsHelp({ id: 'a', name: 'Robin', d: doc(), today: DAY }, DAY);
  assert.ok(needs.some((x) => x.why === 'stuck' && x.line === 'Stuck word: light'));
  assert.deepEqual(RD.needsHelp({ id: 'b', name: 'Wren', d: doc({ way: 'usual', report: false }), today: DAY }, DAY).filter((x) => x.why === 'stuck'), []);
  assert.equal(P.wayHelpLine(W.setupOf(doc()), 4, 'Robin'), 'Step by step · Extra support');
});

test('the estimate under the date: only Step-by-step children, "About N", per child', () => {
  const kids = [{ nickname: 'Robin', year: 4, d: doc({ report: false }) }, { nickname: 'Wren', year: 6, d: doc({ way: 'usual', report: false }) }];
  const words = ['night', 'friend', 'island', 'guard', 'light', 'tree', 'Wednesday', 'February', 'environment', 'necessary'];
  const lines = SD.estimateLines({ kids, words, test: '2026-11-08', today: '2026-11-02' });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].name, 'Robin');
  assert.match(lines[0].line, /^At least about \d+ sittings of 10 minutes before the test: about \d+ a day\./);
  assert.deepEqual(SD.estimateLines({ kids, words: [], test: '2026-11-08', today: '2026-11-02' }), []);
  assert.deepEqual(SD.estimateLines({ kids, words, test: '', today: '2026-11-02' }), []);
  assert.match(SV.estimateHtml(lines), /data-estimate-line/);
  assert.equal(SV.estimateHtml([]), '');
});

test('copy: the grown-up lines of this slice use no banned word', () => {
  const all = [P.WAY_HELP, P.FIRST_ON_LINE, P.updateLine('Robin'), P.sessionHelp('Robin'), P.BIG_HELP, P.AFTER_HELP, P.peekUsualHelp, P.USUAL_OFFER('Robin'), P.SET_ASIDE_HELP, P.ASIDE_LINE, P.PROBLEM_TEXT.other, P.STATUS_KEY];
  for (const s of all) assert.ok(!/\b(wrong|fail|failed|incorrect|mistakes?|late|lost|errors?)\b/i.test(s), s);
});
