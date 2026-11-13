// SB3-C2: the garden-path Grown-ups screens. The pure rules (statuses and their reasons, the week card,
// the planner's cap, the short-week line, plan ids), delete and bring back, and the merge between devices.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import * as P from '../site/js/grownups-doc.js';
import * as A from '../site/js/grownups-data.js';
import { fakeAccount } from '../shared/tests/fake-account.js';

const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const MON = '2026-11-02';
const plus = (n) => W.addDays(MON, n);
const at = (day, h = 12) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':00:00Z');
let n = 0;
const nid = () => 'c2' + (++n);
function made(words = ['fruit', 'earth', 'heart'], test = plus(5), today = MON) {
  const doc = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week one', test, words, today, now: at(today) }).doc;
  return { d: doc, g: W.groupById(doc, 'g1') };
}
const tr = (d, g, word, day, o = {}) => W.addTry(d, { id: nid(), word, day, group: g.id, kind: 'p', tries: 0, peeks: 0, clean: true, now: at(day, o.hour || 12) + n, ...o });
const job = (d, g, step, day) => W.markStep(d, g, step, day, at(day));

// ---- statuses and their reasons ---------------------------------------------------------
test('classify: Got it, Getting there, Needs help, Not started, each with its reason', () => {
  assert.deepEqual(P.classify({}), { key: 'new', label: 'Not started', reason: 'no tries yet' });
  assert.deepEqual(P.classify({ any: true, dots: 2 }), { key: 'getting', label: 'Getting there', reason: '2 in a row' });
  assert.equal(P.classify({ any: true }).reason, 'practised');
  assert.deepEqual(P.classify({ dots: 3 }), { key: 'got', label: 'Got it', reason: '' });
  assert.equal(P.classify({ any: true, tries: 1 }).key, 'getting', 'one wrong letter is not yet help');
  assert.deepEqual(P.classify({ any: true, tries: 3 }), { key: 'help', label: 'Needs help', reason: '2 or more wrong letters' });
  assert.equal(P.classify({ any: true, tries: 2 }).key, 'help', 'wrong twice');
  assert.equal(P.classify({ any: true, peeks: 1 }).reason, 'peeked once');
  assert.equal(P.classify({ any: true, peeks: 2, tries: 2 }).reason, '2 or more wrong letters, peeked twice');
  assert.equal(P.classify({ dots: 3, tries: 5, peeks: 1 }).key, 'got', 'a word mended to 3 in a row is Got it');
  assert.equal(P.classify({ dots: 3, slipped: true }).key, 'help', 'a slip in the test, not yet fixed');
  assert.match(P.classify({ slipped: true }).reason, /slipped in the test/);
  assert.equal(P.classify({ passed: true }).reason, 'right in the test');
  assert.equal(P.classify({ remembered: true }).reason, 'remembered');
});

test('weekWords: counted from the tries; help first; what we noticed holds only what is kept', () => {
  let { d, g } = made(['fruit', 'earth', 'heart', 'build']);
  for (const h of [10, 11, 12]) d = tr(d, g, 'fruit', plus(1), { hour: h });
  d = tr(d, g, 'earth', plus(1), { clean: false, tries: 2 });
  d = tr(d, g, 'heart', plus(1), { clean: false, peeks: 1 });
  d = W.addSkip(d, { id: 'k', group: 'g1', word: 'build', day: plus(1), flow: 'x', now: at(plus(1)) });
  d = W.setClue(d, 'fruit', 'fr-uit', at(plus(1)));
  const rows = P.weekWords(d, g, plus(1));
  assert.deepEqual(rows.map((r) => [r.word, r.status]), [['earth', 'help'], ['heart', 'help'], ['fruit', 'got'], ['build', 'new']]);
  assert.equal(rows[0].reason, '2 or more wrong letters');
  assert.equal(rows[1].reason, 'peeked once');
  assert.ok(rows.find((r) => r.word === 'fruit').notes.includes('Memory clue: fr-uit'));
  assert.ok(rows.find((r) => r.word === 'build').notes.includes('Skipped for now today.'));
  for (const r of rows) for (const note of r.notes) assert.doesNotMatch(note, /writes|misses|left out/i, 'never an invented spelling mistake');
});

test('weekWords: a slipped test word needs help until it is mended; a right one is Got it', () => {
  let { d, g } = made(['fruit', 'earth']);
  d = tr(d, g, 'fruit', plus(5), { kind: 't' });
  d = tr(d, g, 'earth', plus(5), { kind: 't', clean: false, tries: 1 });
  const rows = P.weekWords(d, g, plus(5));
  assert.equal(rows.find((r) => r.word === 'earth').status, 'help');
  assert.equal(rows.find((r) => r.word === 'fruit').status, 'got');
});

test('typed words say what they have, listed words say nothing', () => {
  assert.equal(P.readiness({ typed: false, hasMeaning: true }), null);
  assert.deepEqual(P.readiness({ typed: true, hasMeaning: true }), { meaning: true, meaningLine: 'Meaning from the Wordbright word list', picture: 'No picture, meaning only' });
  assert.equal(P.readiness({ typed: true, hasMeaning: false }).picture, 'No picture or meaning');
});

// ---- the week at a glance -----------------------------------------------------------------
test('the chip: On track only when nothing is waiting; waiting counts jobs whose day has passed', () => {
  let { d, g } = made(['fruit'], plus(5));
  assert.equal(P.weekCard(d, g, MON).chip.label, 'Not started');
  d = job(d, g, 'hello', MON);
  let k = P.weekCard(d, g, MON);
  assert.deepEqual([k.chip.key, k.waiting], ['ontrack', 0]);
  k = P.weekCard(d, g, plus(1)); // Fix it in is today: not waiting
  assert.deepEqual([k.chip.key, k.waiting, k.today], ['ontrack', 0, 'Fix it in']);
  k = P.weekCard(d, g, plus(3)); // fix and games have had their days
  assert.equal(k.chip.key, 'waiting');
  assert.equal(k.waiting, 2);
  assert.equal(k.chip.label, '2 jobs waiting');
  assert.deepEqual(k.waitingTitles, ['Game day'], 'today\'s job (Fix it in) is named under Today, not again here');
  assert.equal(k.waitingToday, true, 'but it is still counted: the same count as the child\'s screens');
  assert.equal(k.waiting, St.studyState(d, g, plus(3)).waiting, 'the same number the rules count');
  assert.equal(P.waitingLabel(1), '1 job waiting');
  assert.equal(k.today, 'Fix it in', 'a missed job comes first');
});

test('the chip: Week finished, and No week yet', () => {
  let { d, g } = made(['fruit'], plus(5));
  for (const s of St.BEFORE_TEST) d = job(d, g, s, plus(2));
  d = tr(d, g, 'fruit', plus(5), { kind: 't' });
  const g2 = W.groupById(d, 'g1');
  assert.equal(P.weekCard(d, g2, plus(5)).chip.label, 'On track', 'the test day itself: Mend and keep is still to come');
  d = job(d, g2, 'mend', plus(6));
  assert.equal(P.weekCard(d, g2, plus(6)).chip.label, 'Week finished');
  assert.equal(P.childOverview(W.emptyDoc(), MON, 0).chip.label, 'No week yet');
  assert.equal(P.childOverview(W.emptyDoc(), MON, 0).current, null);
});

test('the stone strip has seven stones, with their states', () => {
  let { d, g } = made(['fruit'], plus(5));
  d = job(d, g, 'hello', MON);
  const k = P.weekCard(d, g, plus(1));
  assert.deepEqual(k.steps.map((s) => s.id), ['hello', 'fix', 'games', 'story', 'practice', 'test', 'mend']);
  assert.deepEqual(k.steps.slice(0, 3).map((s) => s.kind), ['done', 'today', 'later']);
  assert.equal(k.steps[5].icon, 'flag');
});

// ---- planning ------------------------------------------------------------------------------
test('10 words is a full week; the line says so', () => {
  assert.equal(P.atCap(Array(9).fill('a')), false);
  assert.equal(P.atCap(Array(10).fill('a')), true);
  assert.equal(P.FULL_WEEK_LINE, '10 words is a full week. Remove one to add another.');
});
test('a short week: fewer than 5 days before the test', () => {
  assert.equal(P.isShortWeek(MON, plus(4)), true);
  assert.equal(P.isShortWeek(MON, plus(5)), false);
  assert.equal(P.isShortWeek(MON, plus(7)), false);
  assert.equal(P.SHORT_WEEK_LINE, 'Short week: some days will have two jobs.');
  assert.equal(P.preview(W.emptyDoc(), { name: 'x', test: plus(3), words: ['fruit'] }, MON).squeezed, true);
});
test('the date is written beside the field', () => {
  assert.equal(P.dateWords('2026-11-27'), 'Fri 27 Nov');
  assert.equal(P.dateWords(''), '');
});
test('the week name: School spellings for typed words, else the list\'s name', () => {
  assert.equal(P.suggestName({ typedCount: 1, listName: 'Year 3 & 4 words', test: plus(5) }), 'School spellings');
  assert.equal(P.suggestName({ typedCount: 0, listName: 'Year 3 & 4 words', test: plus(5) }), 'Year 3 & 4 words');
  assert.match(P.suggestName({ typedCount: 0, listName: '', test: plus(5) }), /^Words for/);
});
test('the child\'s year list, and where the planner starts', () => {
  assert.deepEqual([3, 4, 5, 6].map((y) => P.yearListFor(y)), ['y3', 'y4', 'y5', 'y6']);
  assert.deepEqual([1, 2].map((y) => P.yearListFor(y, ['y3', 'y4', 'y5', 'y6'])), ['y3', 'y3'], 'Years 1 and 2 are Year 3 until they have words');
  assert.deepEqual([1, 2, 3, 7].map((y) => P.yearListFor(y, ['y1', 'y2', 'y3', 'y4', 'y5', 'y6'])), ['y1', 'y2', 'y3', 'y6']);
  assert.equal(P.yearListFor(undefined), 'y3');
  assert.equal(P.firstStep({ children: 2, chosen: '', editing: false }), 1);
  assert.equal(P.firstStep({ children: 1, chosen: '', editing: false }), 2, 'one child: skip step 1');
  assert.equal(P.firstStep({ children: 2, chosen: 'k', editing: false }), 2);
  assert.equal(P.firstStep({ children: 2, chosen: '', editing: true }), 2, 'a revision has its child');
  assert.equal(P.stepBack(3, { children: 2, editing: false }), 2);
  assert.equal(P.stepBack(2, { children: 2, editing: false }), 1);
  assert.equal(P.stepBack(2, { children: 1, editing: false }), 0, 'step 1 was never shown');
  assert.equal(P.stepBack(2, { children: 2, editing: true }), 0);
});
test('one plan id: sending it twice makes one group', () => {
  const plan = { name: 'School spellings', test: plus(5), words: ['fruit'] };
  const once = P.createPlan(W.emptyDoc(), plan, { id: 'pabc', today: MON, now: 1 }).doc;
  const twice = P.createPlan(once, plan, { id: 'pabc', today: MON, now: 2 }).doc;
  assert.equal(W.liveGroups(twice).length, 1);
  const src = readFileSync(file('site/js/grownups-views.js'), 'utf8');
  assert.match(src, /const planId = 'p' \+/);
  assert.equal((src.match(/id: planId/g) || []).length, 1, 'only one place makes a plan, with the form\'s id');
});

// ---- revise ---------------------------------------------------------------------------------
test('revise: kept words keep their dots, the date can move after today', () => {
  let { d, g } = made(['fruit', 'earth'], plus(5));
  for (const h of [10, 11, 12]) d = tr(d, g, 'fruit', plus(1), { hour: h });
  const r = P.editPlan(d, 'g1', { name: 'School spellings', words: ['fruit', 'build'], test: plus(8) }, { today: plus(2), now: at(plus(2)) });
  const g2 = W.groupById(r.doc, 'g1');
  assert.deepEqual([g2.name, g2.test, g2.words], ['School spellings', plus(8), ['fruit', 'build']]);
  assert.equal(P.weekWords(r.doc, g2, plus(1)).find((x) => x.word === 'fruit').dots, 3);
  assert.match(P.editPlan(d, 'g1', { words: ['fruit'], test: plus(2) }, { today: plus(2), now: 5 }).error, /after today/);
});

// ---- delete and bring back -------------------------------------------------------------------
test('delete keeps every try; the week leaves the live list and appears in Deleted weeks', () => {
  let { d, g } = made();
  d = tr(d, g, 'fruit', plus(1));
  const gone = W.deleteGroup(d, 'g1', at(plus(2)));
  assert.equal(W.liveGroups(gone).length, 0);
  assert.equal(gone.results.length, 1, 'the tries stay');
  assert.equal(W.overall(gone).practised, 1, 'and still count towards remembered words');
  const list = W.deletedGroups(gone, at(plus(2)) + 1000);
  assert.deepEqual(list.map((x) => x.id), ['g1']);
  assert.equal(W.deletedGroups(gone, at(plus(2)) + 31 * 86400000).length, 0, 'only the last 30 days');
  assert.deepEqual(P.childOverview(gone, plus(2), at(plus(2)) + 5).deleted.map((x) => x.name), ['Week one']);
  assert.equal(P.childOverview(gone, plus(2), at(plus(2)) + 5).chip.key, 'none');
});
test('bring back: clears gone, bumps at, changes nothing else', () => {
  const { d } = made();
  const gone = W.deleteGroup(d, 'g1', at(plus(2)));
  const r = W.restoreGroup(gone, 'g1', at(plus(3)));
  const back = r.doc.groups.g1;
  assert.equal('gone' in back, false);
  assert.ok(back.at > gone.groups.g1.at);
  assert.deepEqual([back.name, back.start, back.test, back.words, back.back], [d.groups.g1.name, d.groups.g1.start, d.groups.g1.test, d.groups.g1.words, d.groups.g1.back]);
  assert.equal(W.liveGroups(r.doc).length, 1);
  assert.match(W.restoreGroup(d, 'g1', 9).error, /isn.t in the deleted list/);
});
test('bring back is refused kindly when a live week has the same date and words', () => {
  const { d } = made(['fruit', 'earth'], plus(5));
  const gone = W.deleteGroup(d, 'g1', at(plus(1)));
  const twin = P.createPlan(gone, { name: 'Again', test: plus(5), words: ['Earth', 'fruit'] }, { id: 'p2', today: plus(1), now: at(plus(1)) + 5 }).doc;
  const r = W.restoreGroup(twin, 'g1', at(plus(2)));
  assert.match(r.error, /already a week with these words and this test date/);
  const other = P.createPlan(gone, { name: 'Other', test: plus(6), words: ['fruit', 'earth'] }, { id: 'p3', today: plus(1), now: at(plus(1)) + 5 }).doc;
  assert.ok(W.restoreGroup(other, 'g1', at(plus(2))).doc, 'a different date is fine');
});
test('two devices: delete on one, practice on the other: still deleted, the practice kept; restore wins', () => {
  const { d, g } = made();
  const phone = W.deleteGroup(d, 'g1', at(plus(2), 10));
  const tablet = tr(d, g, 'fruit', plus(2), { hour: 11 });
  const m = W.merge(phone, tablet);
  assert.equal(W.liveGroups(m).length, 0, 'the delete stands');
  assert.equal(m.results.length, 1, 'the practice is kept');
  assert.equal(W.overall(m).practised, 1);
  const restored = W.restoreGroup(m, 'g1', at(plus(2), 12)).doc;
  assert.equal(W.liveGroups(W.merge(m, restored)).length, 1, 'bringing it back wins the merge');
  assert.equal(W.liveGroups(W.merge(restored, phone)).length, 1, 'whichever order the copies arrive');
  assert.equal(W.liveGroups(W.merge(restored, tablet)).length, 1);
  assert.equal(W.groupProgress(W.merge(restored, tablet), W.groupById(W.merge(restored, tablet), 'g1')).words.find((x) => x.word === 'fruit').status, 'practising');
});
test('through the account: delete then bring back, one change each', async () => {
  const acct = fakeAccount();
  const KID = '11111111-1111-4111-8111-111111111111';
  const ADULT = '33333333-3333-4333-8333-333333333333';
  acct.children = (id) => (id === ADULT ? [{ id: KID, nickname: 'Robin', year: 4, avatar: null }] : []);
  acct.who = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const api = A.createChildApi({ origin: 'https://account.example', fetch: acct.fetch });
  const { d } = made();
  acct.put(KID, 'spellbright', 'words', d);
  assert.equal((await A.changeWords(api, KID, (doc) => ({ doc: W.deleteGroup(doc, 'g1', at(plus(1))) }))).ok, true);
  let c = await A.readChild(api, KID);
  assert.equal(W.liveGroups(c.words).length, 0);
  assert.equal(W.deletedGroups(c.words, at(plus(1)) + 5).length, 1);
  assert.equal((await A.changeWords(api, KID, (doc) => W.restoreGroup(doc, 'g1', at(plus(2))))).ok, true);
  c = await A.readChild(api, KID);
  assert.equal(W.liveGroups(c.words).length, 1);
});

// ---- the page's constraints ----------------------------------------------------------------------
test('grown-ups pages: no inline style or script, own stylesheet in the shell, a real dialog', () => {
  const views = readFileSync(file('site/js/grownups-views.js'), 'utf8');
  assert.doesNotMatch(views, /\sstyle="/);
  assert.doesNotMatch(views, /\son[a-z]+="/);
  assert.match(views, /role="dialog" aria-modal="true"/);
  assert.match(views, /e\.key === 'Escape'/);
  assert.match(views, /Keep it/);
  const sw = readFileSync(file('site/sw.js'), 'utf8');
  assert.ok(sw.includes("'css/grownups.css'"));
  assert.match(readFileSync(file('site/index.html'), 'utf8'), /css\/grownups\.css/);
  assert.match(sw, /VERSION = 'spellbright-2026-11-13f'/);
  const css = readFileSync(file('site/css/grownups.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of css.split('}').map((r) => r.split('{')[0].trim()).filter((s) => s && !s.startsWith('@') && !/^\d|^(from|to)/.test(s))) {
    for (const sel of rule.split(',').map((x) => x.trim())) assert.match(sel, /^\.gu|^@/, 'scoped to .gu: ' + sel);
  }
});
test('the wording a parent reads', () => {
  const views = readFileSync(file('site/js/grownups-views.js'), 'utf8');
  for (const s of ['At a glance', 'Change words or test date', 'Delete this week', 'Print this week', 'Plan next week', 'Deleted weeks', 'Bring back', 'Start the week for', 'All children', 'Step \' + step + \' of 3']) assert.ok(views.includes(s), s);
  assert.equal(P.deleteQuestion('School spellings', 'Robin'), 'Delete School spellings for Robin?');
  assert.equal(P.deleteBody('Robin'), 'Robin\'s practice on these words is kept and still counts towards remembered words.');
});

// ---- fix round: Needs help is truthful ------------------------------------------------------------
test('S1: wrong letters from a game or meaning match never make "Needs help"', () => {
  let { d, g } = made(['fruit', 'earth', 'heart', 'build']);
  d = tr(d, g, 'fruit', plus(1), { clean: false, tries: 2, source: 'g' });   // a game retry
  d = tr(d, g, 'earth', plus(1), { clean: false, tries: 3, source: 'm' });   // meaning match
  let rows = P.weekWords(d, g, plus(1));
  for (const w of ['fruit', 'earth']) assert.notEqual(rows.find((r) => r.word === w).status, 'help', w);
  assert.equal(rows.find((r) => r.word === 'fruit').status, 'getting');
  d = tr(d, g, 'build', plus(1), { clean: false, tries: 2 });                // real spelling practice
  rows = P.weekWords(d, g, plus(1));
  assert.deepEqual([rows[0].word, rows[0].status, rows[0].reason], ['build', 'help', '2 or more wrong letters']);
  d = tr(d, g, 'build', plus(1), { clean: false, tries: 1, source: 'x' });   // Fix it in counts as practice
  assert.equal(P.weekWords(d, g, plus(1))[0].tries, 3);
});
test('S1: the checker\'s case: a game retry, then two clean goes next day: Getting there', () => {
  let { d, g } = made(['fruit', 'earth']);
  d = tr(d, g, 'fruit', plus(1), { clean: false, tries: 2, source: 'g' });
  assert.equal(P.weekWords(d, g, plus(1)).find((r) => r.word === 'fruit').status, 'getting');
  d = tr(d, g, 'fruit', plus(2), { hour: 10 });
  d = tr(d, g, 'fruit', plus(2), { hour: 11 });
  const r = P.weekWords(d, g, plus(2)).find((x) => x.word === 'fruit');
  assert.equal(r.status, 'getting');
  assert.equal(r.reason, '2 in a row');
});
test('S1: old mistakes stop counting once the word is practised again, and 3 in a row is Got it', () => {
  let { d, g } = made(['fruit']);
  d = tr(d, g, 'fruit', plus(1), { clean: false, tries: 3 });
  assert.equal(P.weekWords(d, g, plus(1))[0].status, 'help');
  d = tr(d, g, 'fruit', plus(2), { hour: 10 });
  assert.equal(P.weekWords(d, g, plus(2))[0].status, 'getting', 'the latest practice day was clean');
  d = tr(d, g, 'fruit', plus(2), { hour: 11 });
  d = tr(d, g, 'fruit', plus(2), { hour: 12 });
  assert.equal(P.weekWords(d, g, plus(2))[0].status, 'got');
  assert.equal(P.recentHelp(d, g, 'fruit').tries, 0);
});
test('S1: slipped in the test and still to fix stays "Needs help · slipped in the test"', () => {
  let { d, g } = made(['fruit', 'earth'], plus(5));
  d = tr(d, g, 'fruit', plus(5), { kind: 't', clean: false, tries: 1 });
  d = tr(d, g, 'earth', plus(5), { kind: 't' });
  const r = P.weekWords(d, g, plus(5)).find((x) => x.word === 'fruit');
  assert.deepEqual([r.status, r.reason], ['help', 'slipped in the test']);
  assert.match(P.STATUS_KEY, /2 or more wrong letters/);
});

// ---- fix round: the path never prints a past date as "Today" --------------------------------------
test('S2: path labels: Today, Waiting since, Today · waiting since', () => {
  let { d, g } = made(['fruit', 'earth'], plus(6));
  const day = plus(3); // Thu 5: Hello (Mon) done, Fix it in (Tue) waiting, Game (Wed) waiting, Story today
  d = job(d, g, 'hello', MON);
  const k = P.weekCard(d, g, day);
  const label = (id) => { const s = k.steps.find((x) => x.id === id); return P.pathLabel(s, s.date ? W.dayParts(s.date).join(' ') : ''); };
  const lines = k.steps.map((s) => [s.id, s.kind, P.pathLabel(s, W.dayParts(s.date).join(' '))]);
  const w = lines.filter((x) => x[1] === 'waiting');
  assert.ok(w.length >= 1);
  for (const x of w) assert.match(x[2], /^Waiting since \w{3} \d+/);
  const t = lines.filter((x) => x[1] === 'today' || x[1] === 'todaywait');
  assert.equal(t.length, 1);
  for (const x of lines) if (x[1] !== 'today' && x[1] !== 'todaywait') assert.doesNotMatch(x[2], /^Today/, 'only today\'s job says Today');
  assert.equal(P.pathLabel({ kind: 'today', id: 'game' }, 'Sat 7'), 'Today');
  assert.equal(P.pathLabel({ kind: 'todaywait', id: 'game' }, 'Wed 4'), 'Today · waiting since Wed 4');
  assert.equal(P.pathLabel({ kind: 'waiting', id: 'game' }, 'Thu 5'), 'Waiting since Thu 5');
  assert.equal(P.pathLabel({ kind: 'later', id: 'test' }, 'Sat 7'), 'Sat 7 · test');
  assert.equal(label('hello'), k.steps.find((s) => s.id === 'hello').sub);
});

// ---- fix round: a revise never moves the test date silently ---------------------------------------
test('S3: changing only the words or the name keeps the test date, even on or after the test day', () => {
  const { d, g } = made(['fruit', 'earth'], plus(5));
  for (const day of [plus(5), plus(7)]) {
    const r = P.editPlan(d, 'g1', { name: 'Same date', words: ['fruit', 'earth', 'heart'], test: g.test }, { today: day, now: at(day) });
    assert.ok(!r.error, r.error);
    assert.equal(r.doc.groups.g1.test, plus(5), 'the date did not move');
    assert.deepEqual(r.doc.groups.g1.words, ['fruit', 'earth', 'heart']);
    const n2 = P.editPlan(d, 'g1', { name: 'Only the name', test: g.test }, { today: day, now: at(day) });
    assert.equal(n2.doc.groups.g1.test, plus(5));
  }
});
test('S3: a date the grown-up picks must be after today; the passed-date line', () => {
  const { d, g } = made(['fruit'], plus(5));
  const day = plus(6);
  assert.match(P.editPlan(d, 'g1', { test: day }, { today: day, now: at(day) }).error, /./, 'today is not after today');
  assert.equal(P.editPlan(d, 'g1', { test: plus(8) }, { today: day, now: at(day) }).doc.groups.g1.test, plus(8));
  assert.equal(P.passedLine('Robin'), 'The test date has passed. Robin\'s test opens when the jobs are done. You can pick a new date.');
  const views = readFileSync(file('site/js/grownups-views.js'), 'utf8');
  assert.match(views, /test = existing\.test;/);
  assert.doesNotMatch(views, /existing\.test > day \? existing\.test/);
  assert.match(views, /data-datepassed/);
  assert.ok(g);
});

// ---- the adult card and the child's home agree on the next job (SB3-F, F4) ---------------------
test('nextJobs: Mend marked done with fix-ups still to do is still the next job', () => {
  const card = { jobId: 'mend', steps: ['hello:Hello words', 'fix:Fix it in', 'games:Game day', 'story:Story day', 'practice:Practice day', 'test:Test day', 'mend:Mend and keep'].map((x) => ({ id: x.split(':')[0], title: x.split(':')[1], kind: 'done' })) };
  assert.equal(P.nextLine(card), 'Next: Mend and keep.');
  assert.equal(P.sunStep(card), 'mend');
  assert.equal(P.sunStep({ jobId: '', steps: card.steps }), '', 'nothing left when the job id is empty');
});
test('the adult card names the same next job as the child\'s home, over generated weeks', () => {
  let seed = 7;
  const rnd = (m) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % m; };
  const ids = ['hello', 'fix', 'games', 'story', 'practice', 'test', 'mend'];
  let checked = 0;
  for (let i = 0; i < 400; i += 1) {
    let { d, g } = made(['fruit', 'earth'], plus(5));
    const today = plus(rnd(9));
    for (const id of ids) if (rnd(3) === 0) d = job(d, g, id, plus(rnd(9)));
    if (rnd(2)) d = tr(d, g, 'fruit', plus(rnd(9)), { kind: 't', clean: false, tries: 2 });
    g = W.groupById(d, 'g1');
    const s = St.studyState(d, g, today);
    const card = P.weekCard(d, g, today);
    if (!s.job) continue;
    checked += 1;
    assert.equal(P.nextJobs(card).next.id, s.job, 'case ' + i + ' on ' + today);
  }
  assert.ok(checked > 100, 'enough generated weeks had a job: ' + checked);
});
test('a child\'s name always takes \'s, with a curly apostrophe', () => {
  assert.equal(P.possessive('Chris'), 'Chris’s');
  assert.equal(P.possessive('James'), 'James’s');
  assert.equal(P.possessive('Robin'), 'Robin’s');
});
