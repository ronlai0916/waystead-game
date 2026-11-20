// SB5 (WP-A): the pure rules of Set a week (set-doc.js) and the adult's Back target (nav-doc.js).
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../site/js/words-doc.js';
import * as Su from '../site/js/setup-doc.js';
import * as SD from '../site/js/set-doc.js';
import * as P from '../site/js/grownups-doc.js';
import * as C from '../site/js/child-doc.js';
import { adultParent } from '../site/js/nav-doc.js';

const MON = '2026-11-16';
const OID = 'r0123456789ab';
const OID2 = 'rabcdefabcdef';
const LIST15 = Array.from({ length: 15 }, (_, i) => 'word' + String.fromCharCode(97 + i));
const week = (d, id, words, test, now, name = 'W') => W.createGroup(d, { id, name, test, words, today: MON, now }).doc;

test('weekId and weekListOid: list prefix, no-list prefix, role letter, and the formats that do not count', () => {
  assert.equal(SD.weekId(OID, 'parent', 'abc12'), OID + '.pabc12');
  assert.equal(SD.weekId(OID, 'teacher', 'abc12'), OID + '.tabc12');
  assert.equal(SD.weekId('', 'tutor', 'abc12'), 'a.uabc12');
  assert.equal(SD.weekId('nonsense', 'parent', 'abc12'), 'a.pabc12');
  assert.equal(SD.weekId(OID, 'u', 'abc12'), OID + '.uabc12', 'a letter works too');
  assert.equal(SD.weekId(OID, 'nobody', 'abc12'), OID + '.pabc12', 'an unknown role is a parent');
  assert.ok(SD.WEEK_ID_RE.test(OID + '.pabc12') && SD.WEEK_ID_RE.test('a.tabc12'));
  assert.ok((OID + '.pabc12').length <= 20);
  assert.equal(SD.weekListOid(OID + '.tabc12'), OID);
  for (const x of ['a.pabc12', 'p0123456789ab', OID, 'starter', '', undefined, OID + '.PABC12', OID + '.abc123']) assert.equal(SD.weekListOid(x), '', String(x));
  assert.equal(W.createGroup(W.emptyDoc(), { id: OID + '.pabc12', name: 'x', test: '2026-11-23', words: ['fruit'], today: MON, now: 1 }).doc.groups[OID + '.pabc12'].words[0], 'fruit', 'normalise-safe key');
});

test('isGrownupWeek and setBy: each id class', () => {
  assert.equal(SD.isGrownupWeek(OID + '.pabc12'), true);
  assert.equal(SD.isGrownupWeek('a.pabc12'), true);
  assert.equal(SD.isGrownupWeek('p0123456789ab'), true);
  assert.equal(SD.isGrownupWeek(OID), false);
  assert.equal(SD.isGrownupWeek('starter'), false);
  const lists = [{ id: OID, words: ['island', 'quay', 'weight'] }];
  assert.equal(SD.setBy(OID + '.pabc12', { words: ['zzz'] }, lists), 'parent');
  assert.equal(SD.setBy(OID + '.uabc12', { words: ['zzz'] }, lists), 'tutor');
  assert.equal(SD.setBy('a.tabc12', { words: ['zzz'] }, lists), 'teacher');
  assert.equal(SD.setBy('a.abc123', { words: ['zzz'] }, lists), 'grown-up', 'a dotted id with no role letter');
  assert.equal(SD.setBy('p0123456789ab', { words: [] }, []), 'grown-up');
  assert.equal(SD.setBy('starter', { words: ['x'] }, lists), 'app');
  assert.equal(SD.setBy(OID2, { words: ['Island', 'quay'] }, lists), 'grown-up', 'old teacher week: words all in a list');
  assert.equal(SD.setBy(OID2, { words: ['island', 'zebra'] }, lists), 'child');
  assert.equal(SD.setBy(OID2, { words: ['island'] }, []), 'child', 'list deleted: the known limit');
  assert.equal(SD.setBy('weird', { words: ['island'] }, lists), 'child');
});

test('weeksFromList: prefix is exact and beats a subset false positive; the fallback is for older weeks only', () => {
  let d = week(W.emptyDoc(), 'p0123456789ab', ['island'], '2026-11-20', 5); // pre-SB5, subset of the list
  assert.deepEqual(SD.weeksFromList(d, OID, [{ id: OID, words: ['island', 'quay'] }]).map((g) => g.id), ['p0123456789ab'], 'fallback when no prefixed week');
  d = week(d, OID + '.paaaaa', ['quay', 'zebra'], '2026-11-27', 10);
  d = week(d, OID2 + '.pbbbbb', ['island'], '2026-11-27', 11);
  d = week(d, 'a.pccccc', ['island'], '2026-11-27', 12);
  assert.deepEqual(SD.weeksFromList(d, OID, [{ id: OID, words: ['island', 'quay'] }]).map((g) => g.id), [OID + '.paaaaa'], 'prefix only; a., other-list and subset weeks do not match');
  assert.deepEqual(SD.weeksFromList(d, 'rnone00000000', null), []);
  const own = { [OID]: { words: ['island'] } };
  assert.deepEqual(SD.weeksFromList(week(W.emptyDoc(), 'r1111111111aa', ['island'], '2026-11-20', 3), OID, own).map((g) => g.id), ['r1111111111aa'], 'the own map works too');
  // newest first; a deleted week is not live
  let e = week(W.emptyDoc(), OID + '.p00001', ['a1'], '2026-11-20', 1);
  e = week(e, OID + '.p00002', ['a2'], '2026-11-27', 2);
  assert.deepEqual(SD.weeksFromList(e, OID).map((g) => g.id), [OID + '.p00002', OID + '.p00001']);
  e = { ...e, groups: { ...e.groups, [OID + '.p00002']: { ...e.groups[OID + '.p00002'], gone: 9 } } };
  assert.deepEqual(SD.weeksFromList(e, OID).map((g) => g.id), [OID + '.p00001']);
});

test('weekFor keeps the old subset rule; runningFor and runningNote', () => {
  let d = week(W.emptyDoc(), 'g', ['island', 'weight'], '2026-11-27', 5, 'Autumn 2');
  assert.equal(SD.weekFor(d, ['island', 'weight', 'quay']).id, 'g');
  assert.equal(SD.weekFor(d, ['island']), null);
  const r = SD.runningFor(d, OID, [{ id: OID, words: ['island', 'weight', 'quay'] }]);
  assert.deepEqual(r, { from: true, name: 'Autumn 2', test: '2026-11-27' });
  assert.deepEqual(SD.runningFor(d, OID, []), { from: false, name: 'Autumn 2', test: '2026-11-27' });
  assert.equal(SD.runningFor(W.emptyDoc(), OID), null);
  assert.equal(SD.runningNote('Wren', r, true), 'Wren already has a week from this list, with a test on Fri 27 Nov.');
  assert.equal(SD.runningNote('Wren', r, false), 'Wren already has a week running: Autumn 2. This adds another week.');
});

test('sourceOrder: own lists newest first, then type and scan, years, patterns; tricky only for one child', () => {
  const args = { lists: [{ id: 'a', name: 'Old', at: 1 }, { id: 'b', name: 'New', at: 9 }], years: [{ id: 'y3', label: 'Year 3' }], patterns: [{ id: 'p1', label: 'ough' }] };
  const many = SD.sourceOrder({ ...args, oneChild: false });
  assert.deepEqual(many.map((x) => x.kind), ['list', 'list', 'type', 'scan', 'year', 'pattern']);
  assert.deepEqual(many.slice(0, 2).map((x) => x.id), ['b', 'a']);
  assert.equal(SD.sourceOrder({ ...args, oneChild: true }).pop().kind, 'tricky');
  assert.equal(SD.trickyOffered(['c1']), true);
  assert.equal(SD.trickyOffered(['c1', 'c2']), false);
  assert.equal(SD.trickyOffered([]), false);
});

test('firstTicks, restAfter and fitLine: a 15-word list is 10 ticked and "the other 5"', () => {
  const t = SD.firstTicks(LIST15, []);
  assert.deepEqual(t, LIST15.slice(0, 10));
  assert.deepEqual(SD.restAfter(LIST15, t), LIST15.slice(10));
  assert.equal(SD.fitLine(15), 'A week holds 10 words. The first 10 are ticked; the other 5 can be next week.');
  assert.equal(SD.fitLine(10), '');
  // next time: the rest are ticked first, topped up from the used words in list order
  assert.deepEqual(SD.firstTicks(LIST15, t), [...LIST15.slice(0, 5), ...LIST15.slice(10)]);
  assert.deepEqual(SD.firstTicks(['A', 'b', 'c'], ['a']), ['A', 'b', 'c'], 'fewer than max: all, case ignored');
  assert.deepEqual(SD.firstTicks(['a', 'b', 'c'], ['A', 'B'], 2), ['a', 'c'], 'unused first, then topped up, in list order');
  assert.equal(SD.restButton(5), 'Set next week with the other 5 words');
  assert.equal(SD.restButton(1), 'Set next week with the other 1 word');
});

test('nextDefaults: 0, 1 and 3 children', () => {
  const lists = [{ id: OID, name: 'A', words: ['island', 'quay'], at: 5, to: ['c1', 'c2'] }, { id: OID2, name: 'B', words: ['knife'], at: 9, to: ['c3'] }];
  const none = SD.nextDefaults({ lists, kids: [], today: MON });
  assert.deepEqual(none, { cids: [], test: '2026-11-23', oid: OID2 });
  assert.deepEqual(SD.nextDefaults({ lists: [], kids: [], today: MON }), { cids: [], test: '2026-11-23', oid: '' });
  const d1 = week(W.emptyDoc(), OID + '.paaaaa', ['island'], '2026-11-27', 5);
  const one = SD.nextDefaults({ lists, kids: [{ id: 'c1', d: d1 }], today: MON });
  assert.deepEqual(one.cids, ['c1'], 'a one-child account always ticks that child');
  assert.equal(one.test, '2026-12-04', 'newest grown-up week + 7');
  const d2 = week(W.emptyDoc(), OID + '.pbbbbb', ['quay'], '2026-11-27', 6);
  const three = SD.nextDefaults({ lists, kids: [{ id: 'c1', d: d1 }, { id: 'c2', d: d2 }, { id: 'c3', d: W.emptyDoc() }], today: MON });
  assert.deepEqual(three.cids, ['c1', 'c2'], 'the `to` of the newest list that has a grown-up week');
  assert.equal(three.oid, OID2, 'the newest list is first in the picker');
  assert.equal(three.test, '2026-12-04');
  // a last test already in the past: a week from today
  const past = week(W.emptyDoc(), OID + '.pccccc', ['island'], '2026-11-17', 7);
  assert.equal(SD.nextDefaults({ lists, kids: [{ id: 'c1', d: past }, { id: 'c2', d: W.emptyDoc() }], today: '2026-11-30' }).test, '2026-12-07');
  // a child who left the account is not ticked
  assert.deepEqual(SD.nextDefaults({ lists, kids: [{ id: 'c1', d: d1 }, { id: 'c9', d: W.emptyDoc() }], today: MON }).cids, ['c1']);
});

test('flowList: typed or scanned words make a new list; a chosen list is never changed', () => {
  assert.deepEqual(SD.flowList({ typed: ['quay'], scanned: [], listOid: '', ticked: ['quay', 'island'] }), { make: true, words: ['quay', 'island'] });
  assert.deepEqual(SD.flowList({ typed: [], scanned: ['Quay'], listOid: OID, ticked: ['island', 'quay'] }), { make: true, words: ['island', 'quay'] }, 'mixed sources: a new list from the final ticks');
  assert.deepEqual(SD.flowList({ typed: ['quay'], scanned: [], listOid: OID, ticked: ['island'] }), { make: false, oid: OID }, 'typed word unticked: the list is used as it is');
  assert.deepEqual(SD.flowList({ typed: [], scanned: [], listOid: OID, ticked: ['island'] }), { make: false, oid: OID });
  assert.deepEqual(SD.flowList({ ticked: ['island'] }), { make: false, oid: '' });
  assert.equal(SD.listNameFor('2026-11-24'), 'Week of 24 Nov');
});

test('setProblem: no child, no word, bad date, 30 lists', () => {
  const ok = { cids: ['c1'], words: ['island'], test: '2026-11-27', today: MON, listsCount: 3, needsList: true };
  assert.equal(SD.setProblem(ok), '');
  assert.equal(SD.setProblem({ ...ok, cids: [] }), 'Tick at least one child.');
  assert.equal(SD.setProblem({ ...ok, words: [] }), 'Tick at least one word.');
  assert.equal(SD.setProblem({ ...ok, test: '' }), 'Please choose a test date.');
  assert.equal(SD.setProblem({ ...ok, test: MON }), 'The test date needs to be after today.');
  assert.equal(SD.setProblem({ ...ok, words: LIST15 }), 'A week can have up to 10 words.');
  assert.equal(SD.setProblem({ ...ok, listsCount: 30 }), 'You have 30 word lists. Delete one to make another.');
  assert.equal(SD.setProblem({ ...ok, listsCount: 30, needsList: false }), '');
  assert.equal(SD.LIST_LIMIT_LINE, 'You have 30 word lists. Delete one to make another.');
});

test('previewLines: who, words, date, short week, the returning-words line', () => {
  const p = SD.previewLines({ names: ['Robin', 'Wren'], words: ['a', 'b', 'c'], test: '2026-12-05', today: MON });
  assert.deepEqual(p, { who: 'Robin and Wren', words: '3 words', date: 'Test on Sat 5 Dec', short: '', back: SD.BACK_LINE });
  assert.equal(SD.previewLines({ names: ['Robin'], words: ['a'], test: '2026-11-19', today: MON }).short, SD.SHORT_WEEK_LINE);
  assert.equal(SD.SHORT_WEEK_LINE, P.SHORT_WEEK_LINE);
  assert.equal(SD.previewLines({ names: [], words: [], test: '', today: MON }).date, '');
  assert.equal(SD.BACK_LINE, 'Spellbright may add up to 3 words each child found tricky before.');
});

test('setChange: a week and the list copy, one id, a retry changes nothing', () => {
  const copy = { name: 'School words', words: ['island', 'quay'], src: 'typed' };
  const gid = OID + '.pabc12';
  const args = { gid, name: 'Week of 23 Nov', test: '2026-11-27', words: ['island', 'quay'], oid: OID, copy, copyAt: 42 };
  const r = SD.setChange(W.emptyDoc(), args, { today: MON, now: 100 });
  assert.ok(r.doc.groups[gid]);
  assert.equal(Su.liveOwn(W.setupOf(r.doc))[0].id, OID);
  assert.equal(Su.liveOwn(W.setupOf(r.doc))[0].at, 42, 'the copy keeps the master\'s at');
  const again = SD.setChange(r.doc, args, { today: MON, now: 200 });
  assert.equal(again.doc, r.doc, 'idempotent: the very same doc');
  assert.equal(W.liveGroups(again.doc).length, 1);
  const nolist = SD.setChange(W.emptyDoc(), { gid: 'a.pabc12', name: 'x', test: '2026-11-27', words: ['fruit'] }, { today: MON, now: 1 });
  assert.equal(W.setupOf(nolist.doc).own, undefined);
  assert.match(SD.setChange(W.emptyDoc(), { ...args, words: [] }, { today: MON, now: 1 }).error, /at least one/);
  assert.match(SD.setChange(W.emptyDoc(), { ...args, words: LIST15 }, { today: MON, now: 1 }).error, /up to 10/);
  // 30 copies already: a plain line, no week made
  let full = W.emptyDoc();
  for (let i = 0; i < 30; i++) full = W.withSetup(full, Su.setOwnCopy(W.setupOf(full), 'o' + i, copy, 1).setup);
  const tooMany = SD.setChange(full, args, { today: MON, now: 1 });
  assert.equal(tooMany.error, SD.COPY_ERRORS['too-many']);
});

test('weekChange wraps editGroup: only the given keys; locked weeks refuse words and date, not the name', () => {
  let d = week(W.emptyDoc(), OID + '.pabc12', ['island', 'quay'], '2026-11-27', 5, 'Old');
  const gid = OID + '.pabc12';
  assert.equal(SD.weekChange(d, gid, { name: 'New' }, { today: MON, now: 9 }).doc.groups[gid].name, 'New');
  assert.deepEqual(SD.weekChange(d, gid, { words: ['island'] }, { today: MON, now: 9 }).doc.groups[gid].words, ['island']);
  assert.equal(SD.weekChange(d, gid, { test: '2026-12-02' }, { today: MON, now: 9 }).doc.groups[gid].test, '2026-12-02');
  assert.match(SD.weekChange(d, 'nope', { name: 'x' }, { today: MON, now: 9 }).error, /That week has gone/);
  assert.match(SD.weekChange(d, gid, { name: ' ' }, { today: MON, now: 9 }).error, /give the week a name/);
  d = W.addTry(d, { id: 't1', word: 'island', day: '2026-11-27', group: gid, kind: 't', tries: 0, peeks: 0, clean: true, now: 20 });
  assert.match(SD.weekChange(d, gid, { words: ['quay'] }, { today: '2026-11-27', now: 30 }).error, /test has begun/);
  assert.equal(SD.weekChange(d, gid, { name: 'Renamed' }, { today: '2026-11-27', now: 30 }).doc.groups[gid].name, 'Renamed');
});

test('mayMakeOwnWeek: never (D26, weeks are always a grown-up\'s)', () => {
  assert.equal(C.mayMakeOwnWeek(W.emptyDoc(), MON), false);
  assert.equal(C.mayMakeOwnWeek(week(W.emptyDoc(), 'r0123456789ab', ['fruit'], '2026-11-27', 1), MON), false);
  assert.equal(C.mayMakeOwnWeek(W.starterGroup(W.emptyDoc(), { name: 'S', words: ['fruit'], today: MON }), MON), false);
  const gd = week(W.emptyDoc(), OID + '.pabc12', ['fruit'], '2026-11-27', 1);
  assert.equal(C.mayMakeOwnWeek(gd, MON), false);
  const done = W.addTry(gd, { id: 't1', word: 'fruit', day: '2026-11-27', group: OID + '.pabc12', kind: 't', tries: 0, peeks: 0, clean: true, now: 5 });
  assert.equal(C.mayMakeOwnWeek(done, '2026-11-28'), false, 'even once a grown-up week is over');
  assert.equal(C.homeView({ status: 'none' }, MON).button.href, 'words');
});

test('adultParent: an adult\'s own practice pages go back to Play yourself', () => {
  for (const p of ['chapters', 'custom', 'custom/play', 'tricky', 'progress', 'words', 'words/progress']) assert.equal(adultParent(p), '#/grownups/yourself', p);
  for (const p of ['', 'grownups', 'words/g/x', 'settings', 'words/new']) assert.equal(adultParent(p), '', p);
  assert.equal(adultParent('chapters', 'child'), '');
});

// ---- WP-A2 additions: role letter in the week id, finding words, the preview, the date chips and the length line ----------------
test('weekRole: the role that set a week, from its id', () => {
  assert.equal(SD.weekRole(OID + '.pabc12'), 'parent');
  assert.equal(SD.weekRole(OID + '.uabc12'), 'tutor');
  assert.equal(SD.weekRole('a.tabc12'), 'teacher');
  for (const x of ['p0123456789ab', 'starter', OID, 'a.abc123', OID + '.xabc12', OID + '.pabc1', OID + '.pabc123', '', undefined]) assert.equal(SD.weekRole(x), '', String(x));
  assert.equal(SD.WEEK_ID_RE.test(OID + '.tabc12'), true);
  assert.equal(SD.WEEK_ID_RE.test(OID + '.abc123'), false, 'the 6-hex form never shipped');
});
test('weekId round trip: every role, with and without a list, at most 20 characters, safe as a week key', () => {
  for (const role of ['parent', 'tutor', 'teacher']) for (const oid of [OID, '']) {
    const id = SD.weekId(oid, role, 'a1b2c');
    assert.ok(id.length <= 20, id);
    assert.equal(SD.weekRole(id), role);
    assert.equal(SD.weekListOid(id), oid);
    assert.ok(SD.WEEK_ID_RE.test(id));
    assert.equal(SD.isGrownupWeek(id), true);
    assert.equal(SD.setBy(id, { words: [] }, []), role);
    assert.equal(W.createGroup(W.emptyDoc(), { id, name: 'x', test: '2026-11-23', words: ['fruit'], today: MON, now: 1 }).doc.groups[id].words[0], 'fruit');
  }
});
test('setBy and isByGrownup: roles for new ids, "grown-up" for the older plan id, child only for a child\'s own', () => {
  for (const by of ['parent', 'tutor', 'teacher', 'grown-up']) assert.equal(SD.isByGrownup(by), true, by);
  for (const by of ['app', 'child', '', undefined]) assert.equal(SD.isByGrownup(by), false, String(by));
  assert.equal(SD.setBy('p0123456789ab', { words: [] }, []), 'grown-up');
  assert.equal(SD.setBy('r0123456789ab', { words: ['zebra'] }, [{ words: ['island'] }]), 'child');
});
test('setByWords: the name when there is one, else the role\'s words', () => {
  assert.equal(SD.setByWords('parent', 'Mum'), 'Set by Mum');
  assert.equal(SD.setByWords('teacher', 'Ms Patel'), 'Set by Ms Patel');
  assert.equal(SD.setByWords('tutor', ''), 'Set by your tutor');
  assert.equal(SD.setByWords('teacher'), 'Set by your teacher');
  assert.equal(SD.setByWords('parent', '  '), 'Set by your grown-up');
  assert.equal(SD.setByWords('nobody', ''), 'Set by your grown-up');
  assert.deepEqual(SD.ROLE_WORD, { parent: 'your grown-up', tutor: 'your tutor', teacher: 'your teacher' });
});
const READY = [
  { word: 'island', yearId: 'y3' }, { word: 'iron', yearId: 'y3' }, { word: 'is', yearId: 'y1' }, { word: 'quay', yearId: 'y5' },
  { word: 'bison', yearId: 'y4' }, { word: 'isle', year: 4 }, { word: 'basin', yearId: 'y6' }, { word: 'busy', yearId: 'y3' }, { word: 'busy', yearId: 'y5' },
];
test('findWords (D27): from the 2nd letter; words that start with it first, then words that hold it', () => {
  assert.deepEqual(SD.findWords('is', READY).map((x) => x.word), ['island', 'is', 'isle', 'bison']);
  assert.deepEqual(SD.findWords('IS', READY).map((x) => x.word), ['island', 'is', 'isle', 'bison'], 'case ignored');
  assert.deepEqual(SD.findWords('is', READY)[0], { word: 'island', year: 3 });
  assert.deepEqual(SD.findWords('is', READY)[2], { word: 'isle', year: 4 }, 'a numeric year field works');
  assert.deepEqual(SD.findWords('qu', READY), [{ word: 'quay', year: 5 }]);
  assert.deepEqual(SD.findWords('us', READY).map((x) => x.word), ['busy'], 'a word in two chapters is one match');
  assert.deepEqual(SD.findWords('i', READY), [], 'one letter is not a search');
  assert.deepEqual(SD.findWords('', READY), []);
  assert.deepEqual(SD.findWords(undefined, READY), []);
  assert.deepEqual(SD.findWords('zz', READY), []);
  assert.deepEqual(SD.findWords('is', READY, { limit: 2 }).map((x) => x.word), ['island', 'is']);
  assert.deepEqual(SD.findWords('is', READY, { limit: 0 }), []);
  assert.deepEqual(SD.findWords('  is  ', READY).length, 4, 'spaces ignored');
  assert.deepEqual(SD.findWords('i1s', READY).length, 4, 'digits ignored');
  assert.deepEqual(SD.findWords('is', null), []);
  assert.equal(SD.findWords('is', Array.from({ length: 50 }, (_, i) => ({ word: 'is' + String.fromCharCode(97 + (i % 26)) + i }))).length, 8, 'eight by default');
});
test('sourceOf: ready-made (with its year) or typed, worked out and never stored', () => {
  const find = (w) => READY.find((e) => e.word === w) || null;
  assert.deepEqual(SD.sourceOf('island', find), { kind: 'ready', year: 3 });
  assert.deepEqual(SD.sourceOf('lighthouse', find), { kind: 'typed' });
  assert.deepEqual(SD.sourceOf('island'), { kind: 'typed' }, 'no lookup: typed');
});
test('DATE_CHIPS and chipTest: the test is that many days after the day the week is set', () => {
  assert.deepEqual(SD.DATE_CHIPS, [2, 3, 5, 7]);
  assert.deepEqual(SD.DATE_CHIPS.map(SD.chipLabel), ['In 2 days', 'In 3 days', 'In 5 days', 'In 1 week']);
  assert.equal(SD.chipTest('2026-11-22', 3), '2026-11-25', 'set Sun 22: "In 3 days" is Wed 25');
  assert.equal(SD.chipTest('2026-11-22', 7), '2026-11-29', 'a weekend is not skipped');
  assert.deepEqual(SD.DATE_CHIPS.map((n) => SD.chipTest('2026-11-15', n)), ['2026-11-17', '2026-11-18', '2026-11-20', '2026-11-22']);
});
test('lengthLine: the five lines of BRS 3.4, by days from today to the test', () => {
  const t = (n) => SD.lengthLine('2026-11-15', W.addDays('2026-11-15', n));
  assert.equal(t(1), 'Test tomorrow: all 5 jobs today, about 40 minutes. A later date makes it easier.');
  assert.equal(t(2), 'Quick week: 2 or 3 jobs a day, shorter games.');
  assert.equal(t(3), 'Short week: some days have 2 jobs, shorter games.');
  assert.equal(t(4), 'Short week: some days have 2 jobs, shorter games.');
  for (const n of [5, 6, 7]) assert.equal(t(n), 'One job a day.', 'n=' + n);
  for (const n of [8, 14, 28]) assert.equal(t(n), 'Jobs spread out, with rest days.', 'n=' + n);
  assert.equal(t(0), '');
  assert.equal(t(-3), '');
  assert.equal(SD.lengthLine('2026-11-15', ''), '');
  assert.equal(SD.lengthLine('', '2026-11-20'), '');
  assert.equal(new Set(Object.values(SD.LENGTH_LINES)).size, 5);
});
test('previewFirst: what the child sees first, for the worked example (set Sun 22 Nov, test Wed 25)', () => {
  const p = SD.previewFirst(W.emptyDoc(), { words: ['island', 'quay', 'weight', 'busy'], test: '2026-11-25', name: 'Autumn', by: 'Mum', year: 4 }, '2026-11-22', 'parent');
  assert.equal(p.job, 'Hello words');
  assert.equal(p.opens, 'Sun 22 Nov');
  assert.equal(p.today, true);
  assert.deepEqual(p.words, ['island', 'quay', 'weight']);
  assert.equal(p.setBy, 'Set by Mum');
  assert.equal(p.kind, 'short');
  assert.deepEqual(p.stones.map((s) => [s.id, s.n, s.date]), [['hello', 1, '2026-11-22'], ['fix', 2, '2026-11-22'], ['games', 3, '2026-11-23'], ['story', 4, '2026-11-23'], ['practice', 5, '2026-11-24'], ['test', 6, '2026-11-25'], ['mend', 7, '2026-11-26']]);
  assert.deepEqual(p.stones.map((s) => s.title), ['Hello words', 'Fix it in', 'Game day', 'Story day', 'Practice day', 'Test day', 'Mend and keep']);
  assert.deepEqual(p.days.map((x) => [x.day, x.jobs.map((j) => j.id).join('+')]), [['2026-11-22', 'hello+fix'], ['2026-11-23', 'games+story'], ['2026-11-24', 'practice'], ['2026-11-25', 'test']]);
  assert.equal(p.days[1].jobs[0].games, 4);
  assert.equal(p.days[1].jobs[1].sentences, 2);
  assert.deepEqual(p.back, []);
});
test('previewFirst: role wording when no name; a week that would be refused answers { error }', () => {
  const base = { words: ['island'], test: '2026-11-27' };
  assert.equal(SD.previewFirst(W.emptyDoc(), base, MON, 'teacher').setBy, 'Set by your teacher');
  assert.equal(SD.previewFirst(W.emptyDoc(), base, MON, 'tutor').setBy, 'Set by your tutor');
  assert.equal(SD.previewFirst(W.emptyDoc(), base, MON).setBy, 'Set by your grown-up');
  assert.match(SD.previewFirst(W.emptyDoc(), { ...base, words: [] }, MON).error, /at least one/);
  assert.match(SD.previewFirst(W.emptyDoc(), { ...base, test: MON }, MON).error, /after today/);
  assert.equal(SD.previewFirst(W.emptyDoc(), { ...base, test: '2026-11-17' }, MON).kind, 'quick');
  assert.equal(SD.previewFirst(W.emptyDoc(), { ...base, test: '2026-11-17' }, MON).days[0].jobs.length, 5, 'test tomorrow: all five jobs on day 1');
});
test('previewFirst does not change the child\'s doc, and shows returning words when there are some', () => {
  let d = week(W.emptyDoc(), 'old', ['island', 'quay', 'weight'], '2026-11-20', 1);
  d = W.addTry(d, { id: 'x1', word: 'island', day: '2026-11-18', group: 'old', kind: 'p', tries: 2, peeks: 0, clean: false, now: 5 });
  const before = JSON.stringify(d);
  const p = SD.previewFirst(d, { words: ['busy'], test: '2026-11-27' }, '2026-11-21', 'parent');
  assert.equal(JSON.stringify(d), before);
  assert.ok(Array.isArray(p.back));
});
