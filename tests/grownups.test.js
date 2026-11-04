// SB2-3: Grown-ups. Plans, the typed-word check, the dashboard's numbers from fake
// data, permissions and the account calls (against shared/tests/fake-account.js,
// with the routes B7-acct would add). Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as P from '../site/js/grownups-doc.js';
import * as A from '../site/js/grownups-data.js';
import * as Pr from '../site/js/progress-doc.js';
import { usableWord, REFUSED } from '../site/js/wordcheck.js';
import { fakeAccount } from '../shared/tests/fake-account.js';
import { playerFromMe } from '../shared/account/player.js';
import { loadWordGraph, isWord } from '../wordbright/site/js/engine/words.js';

const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const MON = '2026-11-02';
const plus = (n) => W.addDays(MON, n);
const at = (day, h = 12) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':00:00Z');
const KID = '11111111-1111-4111-8111-111111111111';
const KID2 = '22222222-2222-4222-8222-222222222222';
const OTHER = '55555555-5555-4555-8555-555555555555';
const ADULT = '33333333-3333-4333-8333-333333333333';
const ADULT2 = '44444444-4444-4444-8444-444444444444';
const adultMe = (id = ADULT, playingAs = null) => ({ signedIn: true, kind: 'parent', id, displayName: 'Sam', role: 'parent', playingAs });
const childMe = { signedIn: true, kind: 'child', id: KID, nickname: 'Robin', year: 4, avatar: null, parentId: ADULT };
let n = 0;
const nid = () => 'q' + (++n);

function family() {
  const acct = fakeAccount();
  acct.children = (id) => (id === ADULT ? [{ id: KID, nickname: 'Robin', year: 4, avatar: null }, { id: KID2, nickname: 'Wren', year: 6, avatar: null }] : id === ADULT2 ? [{ id: OTHER, nickname: 'Other', year: 5, avatar: null }] : []);
  acct.who = adultMe();
  const api = A.createChildApi({ origin: 'https://account.example', fetch: acct.fetch });
  return { acct, api };
}
const plan = (over = {}) => ({ name: 'Spellings', test: plus(5), words: ['fruit', 'earth'], ...over });
const tryOf = (d, g, word, day, o = {}) => W.addTry(d, { id: nid(), word, day, group: g.id, kind: 'p', tries: 0, peeks: 0, clean: true, now: at(day), ...o });

// ---- the flag ------------------------------------------------------------------------
test('the child-data flag is on: the account has the routes', () => {
  assert.equal(A.CHILD_DATA_API, true);
});

// ---- plans --------------------------------------------------------------------------
test('a preview shows the words, the dates and any words coming back, and saves nothing', () => {
  const d = W.emptyDoc();
  const p = P.preview(d, plan(), MON);
  assert.deepEqual([p.name, p.test, p.words, p.back, p.squeezed], ['Spellings', plus(5), ['fruit', 'earth'], [], false]);
  assert.deepEqual(p.steps.map((s) => s.date), [MON, plus(1), plus(2), plus(3), plus(4), plus(5), plus(6)]);
  assert.deepEqual(d, W.emptyDoc());
});
test('a preview says when the week is short', () => {
  assert.equal(P.preview(W.emptyDoc(), plan({ test: plus(3) }), MON).squeezed, true);
});
test('a plan needs words, at most 10, and a date to come', () => {
  assert.match(P.preview(W.emptyDoc(), plan({ words: [] }), MON).error, /at least one/);
  assert.match(P.preview(W.emptyDoc(), plan({ words: 'abcdefghijk'.split('').map((c) => 'w' + c) }), MON).error, /up to 10/);
  assert.match(P.preview(W.emptyDoc(), plan({ test: MON }), MON).error, /after today/);
});
test('a plan is an ordinary group in the child\'s value, with their returning words', () => {
  let d = W.createGroup(W.emptyDoc(), { id: 'old', name: 'Old', test: plus(1), words: ['heart'], today: MON, now: at(MON) }).doc;
  d = W.addTry(d, { id: 't', word: 'heart', day: plus(1), group: 'old', kind: 't', tries: 1, peeks: 0, clean: false, now: at(plus(1)) });
  const r = P.createPlan(d, plan({ test: plus(9) }), { id: 'p1', today: plus(2), now: at(plus(2)) });
  assert.deepEqual(r.doc.groups.p1.back, ['heart']);
  assert.equal(r.doc.groups.p1.name, 'Spellings');
});
test('a plan can change until the test day, then only its name', () => {
  const d = P.createPlan(W.emptyDoc(), plan(), { id: 'p1', today: MON, now: at(MON) }).doc;
  const e = P.editPlan(d, 'p1', { name: 'New', words: ['fruit'], test: plus(6) }, { today: plus(1), now: at(plus(1)) });
  assert.deepEqual([e.doc.groups.p1.name, e.doc.groups.p1.words, e.doc.groups.p1.test], ['New', ['fruit'], plus(6)]);
  assert.match(P.editPlan(d, 'p1', { words: ['fruit'] }, { today: plus(5), now: at(plus(5)) }).error, /test day/);
});

// ---- typed words ---------------------------------------------------------------------
test('typed school words: curriculum, or our list; blocked and unknown get the same reply', () => {
  const buf = readFileSync(file('wordbright/site/data/words_all.dawg'));
  const graph = loadWordGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  const deps = { findEntry: (w) => (w === 'february' ? { word: 'February' } : null), inList: (w) => isWord(w, graph) };
  assert.equal(usableWord('February', deps), 'February');
  assert.equal(usableWord(' Tractor ', deps), 'tractor');
  assert.equal(usableWord('zzqx', deps), null);
  assert.equal(usableWord('arse', deps), null, 'a blocked word: as unknown');
  assert.equal(usableWord('a b', deps), null);
  const src = readFileSync(file('site/js/grownups-views.js'), 'utf8');
  assert.match(src, /checkTyped\(typed, findEntry\)/, 'the plan uses the same check as My words');
  assert.ok(REFUSED.includes('isn\'t on our lists'));
});

// ---- spelling patterns ----------------------------------------------------------------
const patterns = JSON.parse(readFileSync(file('site/data/patterns.json'), 'utf8'));
test('patterns: both stages, an OGL credit, and our own example words', () => {
  assert.match(patterns._meta.credit, /Open Government Licence/);
  assert.match(patterns._meta.credit, /English Appendix 1/);
  assert.ok(patterns.patterns.some((p) => p.stage === 'y34') && patterns.patterns.some((p) => p.stage === 'y56'));
  assert.equal(new Set(patterns.patterns.map((p) => p.id)).size, patterns.patterns.length);
});
test('every pattern word fits its pattern and is on our list (so it isn\'t blocked)', () => {
  const buf = readFileSync(file('wordbright/site/data/words_all.dawg'));
  const graph = loadWordGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  for (const p of patterns.patterns) {
    assert.ok(p.words.length >= 8 && p.words.length <= W.MAX_WORDS, p.id);
    assert.equal(new Set(p.words).size, p.words.length, p.id);
    const re = new RegExp(p.re);
    for (const w of p.words) {
      assert.ok(re.test(w), w + ' fits ' + p.id);
      assert.ok(isWord(w, graph), w + ' is on our list');
    }
  }
});
test('a pattern offers its words, up to a group\'s worth', () => {
  assert.equal(P.patternWords(patterns.patterns, 'ough').length, 10);
  assert.deepEqual(P.patternWords(patterns.patterns, 'nope'), []);
});

// ---- the dashboard -----------------------------------------------------------------------
function fakeWeek() {
  let d = P.createPlan(W.emptyDoc(), plan({ words: ['fruit', 'earth'], test: plus(5) }), { id: 'g1', today: MON, now: at(MON) }).doc;
  const g = W.groupById(d, 'g1');
  d = W.markStep(d, g, 'hello', MON, at(MON));
  d = W.markStep(d, g, 'fix', plus(1), at(plus(1)));
  for (let i = 0; i < 3; i += 1) d = tryOf(d, g, 'fruit', plus(1), { source: 'x', now: at(plus(1)) + i });
  d = tryOf(d, g, 'earth', plus(1), { source: 'x', clean: false, tries: 2 });
  d = tryOf(d, g, 'earth', plus(1), { source: 'x' });
  d = tryOf(d, g, 'fruit', plus(2), { source: 'g' });
  d = tryOf(d, g, 'earth', plus(2), { source: 'g', clean: false, peeks: 1 });
  d = W.setClue(d, 'earth', 'ear in earth', at(plus(1)));
  d = W.addNote(d, { id: 'n1', group: 'g1', word: 'fruit', text: 'I love eating fruit.', day: plus(3), now: at(plus(3)) });
  return { d, g };
}
test('dashboard: this week\'s group and today\'s job', () => {
  const { d } = fakeWeek();
  const r = P.dashboard(d, plus(2));
  assert.equal(r.current.name, 'Spellings');
  assert.equal(r.current.job, 'Game day');
  assert.equal(r.current.testDate, plus(5));
  assert.deepEqual(r.current.steps.filter((s) => s.state === 'done').map((s) => s.id), ['hello', 'fix']);
});
test('dashboard: dots, tries and peeks per word', () => {
  const { d } = fakeWeek();
  const w = Object.fromEntries(P.dashboard(d, plus(2)).current.words.map((x) => [x.word, x]));
  assert.deepEqual([w.fruit.dots, w.fruit.tries, w.fruit.peeks, w.fruit.status], [3, 0, 0, 'practising']);
  assert.deepEqual([w.earth.dots, w.earth.tries, w.earth.peeks], [0, 2, 1]);
});
test('dashboard: each word\'s 3 in a row, and today\'s count', () => {
  let { d, g } = fakeWeek();
  for (let i = 0; i < 2; i += 1) d = tryOf(d, g, 'earth', plus(2), { source: 'x', now: at(plus(2)) + 1000 + i });
  d = tryOf(d, g, 'fruit', plus(2), { now: at(plus(2)) + 2000 });
  const w = Object.fromEntries(P.dashboard(d, plus(2)).current.words.map((x) => [x.word, x]));
  assert.deepEqual([w.earth.dots, w.earth.today], [2, 2], 'on its way');
  assert.deepEqual([w.fruit.dots, w.fruit.today], [3, 1], 'finished once, and at it again today');
});
test('dashboard: fix-ups in Mend show in today\'s count', () => {
  let { d, g } = fakeWeek();
  d = tryOf(d, g, 'earth', plus(5), { kind: 't', clean: false, tries: 1 });
  d = tryOf(d, g, 'fruit', plus(5), { kind: 't' });
  d = tryOf(d, g, 'earth', plus(6), { kind: 'f' });
  assert.equal(P.dashboard(d, plus(6)).current.words.find((x) => x.word === 'earth').today, 1);
});
test('dashboard: skipped words, until they\'re done', () => {
  let { d, g } = fakeWeek();
  d = W.addSkip(d, { id: 'k1', group: 'g1', word: 'earth', day: plus(2), flow: 'x', now: at(plus(2)) });
  let r = P.dashboard(d, plus(2)).current;
  assert.deepEqual(r.comeBack, ['earth']);
  assert.equal(r.words.find((x) => x.word === 'earth').comeBack, true);
  assert.equal(r.words.find((x) => x.word === 'fruit').comeBack, false);
  for (let i = 0; i < 3; i += 1) d = tryOf(d, g, 'earth', plus(2), { source: 'x', now: at(plus(2)) + 1000 + i });
  r = P.dashboard(d, plus(2)).current;
  assert.deepEqual(r.comeBack, []);
  assert.deepEqual(P.dashboard(d, plus(3)).current.comeBack, [], 'a skip is for its own day');
});
test('the dashboard shows them', () => {
  const src = readFileSync(file('site/js/grownups-views.js'), 'utf8');
  assert.match(src, /<th scope="col">3 in a row<\/th>/);
  assert.match(src, /rowCountHtml\(w\.dots, W\.ROW_NEEDED\)/);
  assert.match(src, /<b>Come back to this:<\/b>/);
});
test('dashboard: remembered, practised and independent first goes', () => {
  const { d } = fakeWeek();
  const r = P.dashboard(d, plus(2));
  assert.equal(r.remembered, 0);
  assert.equal(r.practised, 2);
  assert.equal(r.firstGoes, 4); // two words on two days
  assert.equal(r.clean, 2); // fruit twice
  assert.equal(r.independent, 50);
});
test('dashboard: stars per day, clues and sentences', () => {
  const { d } = fakeWeek();
  const r = P.dashboard(d, plus(3));
  assert.deepEqual(r.current.stars.slice(0, 3).map((s) => s.stars), [0, 1, 1]);
  assert.deepEqual(r.clues, [{ word: 'earth', clue: 'ear in earth' }]);
  assert.deepEqual(r.current.sentences, [{ word: 'fruit', text: 'I love eating fruit.', day: plus(3) }]);
});
test('dashboard: test results, right and slipped', () => {
  let { d, g } = fakeWeek();
  d = tryOf(d, g, 'fruit', plus(5), { kind: 't' });
  d = tryOf(d, g, 'earth', plus(5), { kind: 't', clean: false, tries: 1 });
  const t = P.dashboard(d, plus(5)).current.test;
  assert.deepEqual([t.taken, t.right, t.of], [2, 1, 2]);
  assert.deepEqual(t.rows.find((x) => !x.right).word, 'earth');
});
test('dashboard: a child with nothing yet', () => {
  const r = P.dashboard(W.emptyDoc(), MON);
  assert.deepEqual([r.current, r.others, r.remembered, r.independent, r.clues], [null, [], 0, 0, []]);
});
test('the dashboard says who can see it, and has a report to print', () => {
  const src = readFileSync(file('site/js/grownups-views.js'), 'utf8');
  assert.ok(src.includes('Only you and your child can see this.'));
  assert.ok(src.includes('Print weekly report'));
  assert.match(readFileSync(file('site/css/app.css'), 'utf8'), /@media print/);
});

// ---- permissions -------------------------------------------------------------------------
test('only an adult playing as themselves sees Grown-ups', () => {
  const o = 'https://account.example';
  const of = (me) => P.canSeeGrownups(playerFromMe(me, o).kind);
  assert.equal(of(adultMe()), true);
  assert.equal(of(childMe), false, 'a child');
  assert.equal(of(adultMe(ADULT, { id: KID, nickname: 'Robin', year: 4, avatar: null })), false, 'an adult playing as a child: a child may be at the keyboard');
  assert.equal(P.canSeeGrownups(undefined), false, 'the cached player has no kind');
});
test('the pages check before they draw or fetch anything', () => {
  const src = readFileSync(file('site/js/grownups-views.js'), 'utf8');
  for (const fn of ['grownups', 'childDashboard', 'planWeek', 'editWeek']) {
    const body = src.slice(src.indexOf('export function ' + fn + '('), src.indexOf('export function ' + fn + '(') + 120);
    assert.match(body, /adultOnly\(main\)/, fn);
  }
});
test('a child\'s session is refused by the account as well', async () => {
  const { acct, api } = family();
  acct.who = childMe;
  assert.equal((await api.children()).status, 403);
  assert.deepEqual(await A.listChildren(api), { problem: 'playing' });
  assert.equal((await api.game(KID)).status, 403);
  assert.equal((await api.put(KID, 'words', {}, 0)).status, 403);
});
test('so is an adult playing as a child', async () => {
  const { acct, api } = family();
  acct.who = adultMe(ADULT, { id: KID, nickname: 'Robin', year: 4, avatar: null });
  assert.equal((await api.children()).status, 403);
});
test('a parent sees only their own children, and can\'t reach another family\'s', async () => {
  const { acct, api } = family();
  assert.deepEqual((await A.listChildren(api)).children.map((c) => c.nickname), ['Robin', 'Wren']);
  acct.put(OTHER, 'spellbright', 'words', W.emptyDoc());
  assert.deepEqual(await A.readChild(api, OTHER), { problem: 'no-child' });
  const put = await api.put(OTHER, 'words', W.emptyDoc(), 1);
  assert.deepEqual([put.status, put.data], [404, { error: 'no-such-child' }]);
  assert.deepEqual(await A.changeWords(api, OTHER, (d) => ({ doc: d })), { problem: 'no-child' });
});
// ---- the account's real replies ----------------------------------------------------------
test('the routes, exactly as the account has them', async () => {
  const { acct, api } = family();
  await A.listChildren(api);
  await A.readChild(api, KID);
  await api.put(KID, 'words', {}, 0);
  assert.deepEqual(acct.calls.map((c) => c.method + ' ' + c.path), ['GET /api/children', 'GET /api/children/' + KID + '/game/spellbright', 'PUT /api/children/' + KID + '/game/spellbright/words']);
  assert.deepEqual(JSON.parse(acct.calls[2].body), { value: {}, version: 0 });
});
test('every reply gets its own problem', () => {
  const p = (status, error) => A.problemOf({ status, data: error ? { error } : null });
  assert.equal(p(0), 'network');
  assert.equal(p(401), 'signed-out');
  assert.equal(p(403, 'adult-session-required'), 'playing');
  assert.equal(p(403, 'origin-not-allowed'), 'other', 'the other 403 isn\'t about who\'s playing');
  assert.equal(p(404, 'no-such-child'), 'no-child');
  assert.equal(p(404, 'unknown-game'), 'other');
  assert.equal(p(413, 'value-too-large'), 'too-big');
  assert.equal(p(413, 'profile-storage-full'), 'too-big');
  assert.equal(p(429, 'rate-limited'), 'busy');
  assert.equal(p(500), 'other');
  for (const k of ['network', 'busy', 'too-big', 'signed-out', 'no-child', 'other']) assert.ok(P.PROBLEM_TEXT[k], k);
});
test('a failure is never "no children": the list reports it', async () => {
  const { acct, api } = family();
  acct.offline = true;
  assert.deepEqual(await A.listChildren(api), { problem: 'network' });
  acct.offline = false;
  acct.who = null;
  assert.deepEqual(await A.listChildren(api), { problem: 'signed-out' });
});
test('a parent with no children yet is an empty list, not a problem', async () => {
  const { acct, api } = family();
  acct.who = adultMe('66666666-6666-4666-8666-666666666666');
  assert.deepEqual(await A.listChildren(api), { children: [] });
});

// ---- playing as a child -------------------------------------------------------------------
test('the switch-back card: the wording, and the way back', () => {
  assert.equal(P.playingLine('Robin'), 'You\'re playing as Robin. Switch back to yourself to plan and see progress.');
  assert.equal(P.switchBackHref('https://account.waystead.co.uk', 'https://game.waystead.co.uk/spellbright/#/grownups'),
    'https://account.waystead.co.uk/play?return=https%3A%2F%2Fgame.waystead.co.uk%2Fspellbright%2F%23%2Fgrownups');
});
test('only an adult playing as a child gets it: a child\'s own session can\'t switch', () => {
  const o = 'https://account.example';
  assert.equal(playerFromMe(adultMe(ADULT, { id: KID, nickname: 'Robin', year: 4, avatar: null }), o).canSwitch, true);
  assert.equal(playerFromMe(childMe, o).canSwitch, false);
  const src = readFileSync(file('site/js/who.js'), 'utf8');
  assert.match(src, /p\.kind === 'child' && p\.canSwitch === true/);
});
test('a 403 from a route shows the same card, after asking who\'s playing', async () => {
  const { acct, api } = family();
  acct.who = adultMe(ADULT, { id: KID, nickname: 'Robin', year: 4, avatar: null });
  assert.deepEqual(await A.readChild(api, KID), { problem: 'playing' });
  assert.deepEqual(await A.changeWords(api, KID, () => { throw new Error('no change is made'); }), { problem: 'playing' });
  const src = readFileSync(file('site/js/grownups-views.js'), 'utf8');
  assert.match(src, /if \(problem === 'playing'\) \{ await recheckWho\(\); playingCard\(main\); return; \}/);
});

// ---- 404, network, nothing half-saved ------------------------------------------------------
test('a 404 says so and goes back to the list', () => {
  assert.equal(P.PROBLEM_TEXT['no-child'], 'That child isn\'t on your account.');
  assert.match(readFileSync(file('site/js/grownups-views.js'), 'utf8'), /href="#\/grownups">Back to the list/);
});
test('a network failure while reading saves nothing', async () => {
  const { acct, api } = family();
  acct.offline = true;
  assert.deepEqual(await A.changeWords(api, KID, (d) => P.createPlan(d, plan(), { id: 'p1', today: MON, now: at(MON) })), { problem: 'network' });
  assert.equal((acct.data.get(KID) || new Map()).size, 0);
});
test('a network failure while writing: nothing saved, and trying again works', async () => {
  const { acct, api } = family();
  const flaky = { ...api, put: async (...a) => { acct.offline = true; const r = await api.put(...a); acct.offline = false; return r; } };
  const make = (d) => P.createPlan(d, plan(), { id: 'p1', today: MON, now: at(MON) });
  assert.deepEqual(await A.changeWords(flaky, KID, make), { problem: 'network' });
  assert.equal((acct.data.get(KID) || new Map()).size, 0);
  assert.equal((await A.changeWords(api, KID, make)).ok, true);
});
test('the answer lost after the save arrived: trying again makes no second plan', async () => {
  const { acct, api } = family();
  const lost = { ...api, put: async (...a) => { await api.put(...a); return { ok: false, status: 0, data: null }; } };
  const make = (now) => (d) => P.createPlan(d, plan(), { id: 'p1', today: MON, now });
  assert.deepEqual(await A.changeWords(lost, KID, make(at(MON))), { problem: 'network' });
  assert.equal((await A.changeWords(api, KID, make(at(MON) + 1))).ok, true);
  assert.deepEqual(Object.keys(acct.data.get(KID).get('spellbright/words').value.groups), ['p1']);
  assert.match(readFileSync(file('site/js/grownups-views.js'), 'utf8'), /id: planId/, 'the form keeps one id');
});
test('a save that fails says nothing was saved, and the button comes back', () => {
  const src = readFileSync(file('site/js/grownups-views.js'), 'utf8');
  assert.match(src, /P\.PROBLEM_TEXT\[r\.problem\] \+ ' Nothing has been saved\.'/);
  assert.match(src, /button\.disabled = false;/);
});
test('too big and rate-limited are reported too', async () => {
  const { acct, api } = family();
  acct.failNext = { status: 429, times: 1 };
  assert.equal((await A.listChildren(api)).problem, 'busy');
  const huge = await A.changeWords(api, KID, () => ({ doc: { ...W.emptyDoc(), groups: { g: { name: 'x'.repeat(70000), start: MON, test: plus(1), words: [], back: [], at: at(MON) } } } }));
  assert.equal(huge.problem, 'too-big');
});
test('at the end of its tries a clash is a "try again", not a lost plan', async () => {
  const { api } = family();
  const clash = { ...api, put: async () => ({ ok: false, status: 409, data: { error: 'version-conflict', value: null, version: 9 } }) };
  assert.deepEqual(await A.changeWords(clash, KID, (d) => ({ doc: d })), { problem: 'busy' });
});

// ---- the wording ------------------------------------------------------------------------------
test('the new time is everywhere, and the old one nowhere', () => {
  const text = (f) => readFileSync(file(f), 'utf8');
  for (const f of ['site/js/views.js', 'site/js/words-views.js', 'site/js/room.js', 'site/js/grownups-views.js', 'README.md', 'site/js/study-doc.js']) {
    assert.doesNotMatch(text(f), /10[–-]15|10 to 15|ten to fifteen/i, f);
  }
  for (const f of ['site/js/views.js', 'site/js/words-views.js', 'site/js/room.js', 'site/js/grownups-views.js']) assert.match(text(f), /DAILY_TIME/, f);
  assert.match(text('site/js/study-doc.js'), /about 15–20 minutes a day/);
  assert.match(text('README.md'), /about 15–20 minutes a day/);
});
test('parents are told how a word counts', () => {
  assert.match(readFileSync(file('site/js/study-doc.js'), 'utf8'), /Each word is spelled 3 times in a row before it counts\./);
  for (const f of ['site/js/views.js', 'site/js/grownups-views.js']) assert.match(readFileSync(file(f), 'utf8'), /ROW_LINE/, f);
  assert.match(readFileSync(file('README.md'), 'utf8'), /Each word is spelled 3 times in a row before it counts\./);
});

test('signed out: nothing', async () => {
  const { acct, api } = family();
  acct.who = null;
  assert.equal((await api.children()).status, 401);
});

// ---- writing into the child's data --------------------------------------------------------
test('a plan lands in the child\'s value, with credentials and no token', async () => {
  const { acct, api } = family();
  const r = await A.changeWords(api, KID, (d) => P.createPlan(d, plan(), { id: 'p1', today: MON, now: at(MON) }));
  assert.equal(r.ok, true);
  const saved = acct.data.get(KID).get('spellbright/words');
  assert.equal(saved.version, 1);
  assert.equal(saved.value.groups.p1.name, 'Spellings');
  assert.ok(acct.calls.every((c) => c.credentials === 'include'));
});
test('a plan never loses what the child did: a 409 is made again on the newer copy', async () => {
  const { acct, api } = family();
  const first = P.createPlan(W.emptyDoc(), plan({ name: 'Theirs' }), { id: 'own', today: MON, now: at(MON) }).doc;
  acct.put(KID, 'spellbright', 'words', first);
  let raced = false;
  const r = await A.changeWords(api, KID, (d) => {
    if (!raced) { raced = true; acct.put(KID, 'spellbright', 'words', W.addTry(first, { id: 'late', word: 'fruit', day: MON, group: 'own', kind: 'p', tries: 0, peeks: 0, clean: true, now: at(MON) })); }
    return P.createPlan(d, plan({ words: ['heart'], test: plus(7) }), { id: 'p1', today: MON, now: at(MON) });
  });
  assert.equal(r.ok, true);
  assert.equal(r.updated, true, 'the page says "Updated with the latest"');
  const v = acct.data.get(KID).get('spellbright/words').value;
  assert.deepEqual(Object.keys(v.groups).sort(), ['own', 'p1']);
  assert.equal(v.results[0].id, 'late', 'the child\'s try is still there');
});
test('a plan with no clash isn\'t reported as updated', async () => {
  const { api } = family();
  const r = await A.changeWords(api, KID, (d) => P.createPlan(d, plan(), { id: 'p1', today: MON, now: at(MON) }));
  assert.equal(r.updated, false);
});
test('the page says it', () => {
  assert.match(readFileSync(file('site/js/grownups-views.js'), 'utf8'), /r\.updated \? 'Updated with the latest' : 'Saved'/);
});
test('a bad plan saves nothing', async () => {
  const { acct, api } = family();
  const r = await A.changeWords(api, KID, (d) => P.createPlan(d, plan({ words: [] }), { id: 'p1', today: MON, now: at(MON) }));
  assert.match(r.error, /at least one/);
  assert.equal((acct.data.get(KID) || new Map()).size, 0);
});
test('the plan merges into the child\'s device copy like any new group', async () => {
  const { acct, api } = family();
  await A.changeWords(api, KID, (d) => P.createPlan(d, plan(), { id: 'p1', today: MON, now: at(MON) }));
  const device = W.createGroup(W.emptyDoc(), { id: 'own', name: 'Mine', test: plus(9), words: ['guard'], today: MON, now: at(MON) }).doc;
  const m = W.merge(device, acct.data.get(KID).get('spellbright/words').value);
  assert.deepEqual(W.liveGroups(m).map((g) => g.id).sort(), ['own', 'p1']);
});
test('reading a child gives the words, the Tricky list and the version', async () => {
  const { acct, api } = family();
  const prog = Pr.noteMissed(Pr.normalise(null), 'fruit', 'y34-ch01', at(MON));
  acct.put(KID, 'spellbright', 'progress', prog);
  acct.put(KID, 'spellbright', 'words', W.emptyDoc());
  const c = await A.readChild(api, KID);
  assert.equal(c.version, 1);
  assert.deepEqual(P.childTricky(c.progress), ['fruit']);
});
test('nothing about a child is written to the adult\'s device', () => {
  for (const f of ['site/js/grownups-data.js', 'site/js/grownups-views.js', 'site/js/grownups-doc.js']) {
    assert.doesNotMatch(readFileSync(file(f), 'utf8'), /localStorage|sessionStorage/, f);
  }
});
