// SB5 (WP-A2): the three roles and the name children see (role-doc.js; TR-81, TR-84, TR-100, TR-107). Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as R from '../site/js/role-doc.js';
import * as W from '../site/js/words-doc.js';
import * as Su from '../site/js/setup-doc.js';

const MON = '2026-11-16';
const OID = 'r0123456789ab';
const OID2 = 'rabcdefabcdef';
const week = (d, id, words, test, now, start = MON) => W.createGroup(d, { id, name: 'W ' + id, test, words, today: start, now }).doc;
const kid = (id, name, d = W.emptyDoc()) => ({ id, name, d });
const lists = [
  { id: OID, name: 'Autumn', words: ['island', 'quay'], at: 5, to: ['c1', 'c2'] },
  { id: OID2, name: 'Sea words', words: ['knife'], at: 9, to: ['c3'] },
];
/** A done test: every word right (or the given ones wrong) on the test date. */
function tested(d, gid, test, words, wrong = []) {
  let x = d;
  words.forEach((w, i) => { x = W.addTry(x, { id: gid + w, word: w, day: test, group: gid, kind: 't', tries: wrong.includes(w) ? 1 : 0, peeks: 0, clean: !wrong.includes(w), now: 50 + i }); });
  return x;
}

test('roles: three, unknown is parent, one letter each', () => {
  assert.deepEqual(R.ROLES, ['parent', 'tutor', 'teacher']);
  for (const r of R.ROLES) assert.equal(R.roleOf(r), r);
  for (const x of [undefined, null, '', 'Teacher', 'admin', 3, {}]) assert.equal(R.roleOf(x), 'parent', String(x));
  assert.deepEqual(R.ROLES.map(R.roleLetter), ['p', 'u', 't']);
  assert.equal(R.roleLetter('nobody'), 'p');
});
test('normRole: the saved entry { r, n?, at }', () => {
  assert.deepEqual(R.normRole({ r: 'teacher', n: 'Ms Patel', at: 5 }), { r: 'teacher', n: 'Ms Patel', at: 5 });
  assert.deepEqual(R.normRole({ r: 'tutor', at: 5 }), { r: 'tutor', at: 5 });
  assert.deepEqual(R.normRole({ r: 'tutor', n: 'a@b.com', at: 5 }), { r: 'tutor', at: 5 }, 'a bad name is dropped, the role kept');
  assert.equal(R.normRole({ r: 'boss' }), null);
  assert.equal(R.normRole(null), null);
  assert.equal(R.normRole('parent'), null);
});
test('WORDS: the same keys for every role, every string filled', () => {
  const keys = Object.keys(R.WORDS.parent).sort();
  for (const r of R.ROLES) {
    assert.deepEqual(Object.keys(R.WORDS[r]).sort(), keys, r);
    for (const k of keys) assert.ok(typeof R.WORDS[r][k] === 'function' || typeof R.WORDS[r][k] === 'string', r + '.' + k);
  }
});
test('WORDS: the table in BRS-change-1 1.11', () => {
  const w = R.WORDS;
  assert.deepEqual(R.ROLES.map((r) => w[r].home), ['Your children', 'My learners', 'My class']);
  assert.deepEqual(R.ROLES.map((r) => w[r].set), ['Set a week', 'Set a week', 'Set the class week']);
  assert.deepEqual(R.ROLES.map((r) => w[r].help), ['Help for each child', 'Help for each learner', 'Help for each child']);
  assert.deepEqual(R.ROLES.map((r) => w[r].seen), ['Set by your grown-up', 'Set by your tutor', 'Set by your teacher']);
  assert.deepEqual(R.ROLES.map((r) => w[r].all), ['All children in one table', 'All learners in one table', '']);
  assert.equal(w.teacher.weekPrefix, 'Class week: ');
  assert.equal(w.parent.previewFor('Ada'), 'What Ada will see first');
  assert.equal(w.teacher.previewFor('Ada'), 'What the class will see first');
  assert.equal(w.parent.card, 'My own children');
  assert.equal(w.tutor.card, 'Learners I tutor');
});
test('WORDS: no banned phrase for any role; no "your children" for a tutor or a teacher', () => {
  const BANNED = /\b(own chapter|your lists|word group|group|chapter test|plan a week|share with|shared with)\b/i;
  const strings = (r) => Object.values(R.WORDS[r]).map((v) => (typeof v === 'function' ? v('Ada') : v));
  for (const r of R.ROLES) for (const s of strings(r)) assert.doesNotMatch(s, BANNED, r + ': ' + s);
  for (const r of ['tutor', 'teacher']) for (const s of strings(r)) assert.doesNotMatch(s, /your children/i, r + ': ' + s);
  assert.match(strings('parent').join(' '), /your children/i);
  const src = readFileSync(fileURLToPath(new URL('../site/js/role-doc.js', import.meta.url)), 'utf8');
  const lits = src;
  for (const must of ['My learners', 'My class', 'Set the class week', 'Help for each child', 'Help for each learner']) assert.ok(lits.includes(must), must);
});

// ---- names (TR-100) -------------------------------------------------------------------------------------------
test('cleanName: names pass (any alphabet), everything else is refused', () => {
  for (const ok of ['Mum', 'Dad', 'Zoë', 'Siân', 'Seán', 'Ms Patel', "Mr O'Neil", 'Auntie Jo', 'Mary-Jane', 'Dr. Who Is', '  Ms   Patel  ', 'Åsa', 'Żaneta']) assert.ok(R.cleanName(ok), ok);
  assert.equal(R.cleanName('  Ms   Patel  '), 'Ms Patel', 'spaces collapsed');
  for (const bad of ['a@b.com', 'Mum1', 'www.x', 'www.example', 'http://x.y', 'one two three four', 'a'.repeat(25), '', '   ', '1Mum', '-Mum', '.Mum', "'Mum", 'Mum!', 'Mum<b>', undefined, null, 5, 'Mum\nDad is here']) assert.equal(R.cleanName(bad), '', String(bad));
  assert.equal(R.cleanName('a'.repeat(24)), 'a'.repeat(24), '24 letters is the limit');
  assert.equal(R.cleanName('One Two Three'), 'One Two Three', 'three words');
  assert.equal(R.NAME_LINE, 'Please use a name only, like Mum or Ms Patel.');
  assert.deepEqual(R.CHIPS, ['Mum', 'Dad', 'Grandma', 'Grandad']);
  for (const c of R.CHIPS) assert.equal(R.cleanName(c), c);
});
test('nameHint: a tutor starts with the first word of the account name; a parent and a teacher with nothing', () => {
  assert.equal(R.nameHint('tutor', 'Sam Green'), 'Sam');
  assert.equal(R.nameHint('tutor', '  Sam   Green '), 'Sam');
  assert.equal(R.nameHint('tutor', 'Zoë'), 'Zoë');
  assert.equal(R.nameHint('tutor', 'sam99 Green'), '', 'a digit: not a name');
  assert.equal(R.nameHint('tutor', ''), '');
  assert.equal(R.nameHint('tutor', undefined), '');
  assert.equal(R.nameHint('tutor', 'a@b.com'), '', 'an email is never pre-filled');
  assert.equal(R.nameHint('parent', 'Sam Green'), '');
  assert.equal(R.nameHint('teacher', 'Sam Green'), '');
  assert.equal(R.nameHint('nobody', 'Sam Green'), '', 'unknown role is a parent');
});
test('the child\'s copy of the name: setup.by is the same rule', () => {
  assert.equal(R.cleanName, Su.cleanName, 'one rule, defined where the child\'s data is cleaned');
  assert.equal(R.NAME_LINE, Su.NAME_LINE);
});

// ---- the Menu --------------------------------------------------------------------------------------------------
test('menuRows: ids and addresses per role', () => {
  const ids = (r) => R.menuRows(r).map((x) => x.id);
  assert.deepEqual(ids('parent'), ['children', 'lists', 'set', 'yourself', 'games']);
  assert.deepEqual(ids('tutor'), ['children', 'lists', 'set', 'help', 'yourself', 'games']);
  assert.deepEqual(ids('teacher'), ['children', 'lists', 'set', 'help', 'yourself', 'games']);
  const href = (r, id) => R.menuRows(r).find((x) => x.id === id).href;
  for (const r of R.ROLES) {
    assert.equal(href(r, 'children'), '#/grownups');
    assert.equal(href(r, 'lists'), '#/grownups/own');
    assert.equal(href(r, 'set'), '#/grownups/set');
    assert.equal(href(r, 'yourself'), '#/grownups/yourself');
    assert.equal(href(r, 'games'), '../');
  }
  assert.equal(href('tutor', 'help'), '#/grownups/help');
  const title = (r, id) => R.menuRows(r).find((x) => x.id === id).title;
  assert.deepEqual(R.ROLES.map((r) => title(r, 'children')), ['Children', 'My learners', 'My class']);
  assert.deepEqual(R.ROLES.map((r) => title(r, 'set')), ['Set a week', 'Set a week', 'Set the class week']);
  assert.equal(title('tutor', 'help'), 'Help for each learner');
  assert.equal(title('teacher', 'help'), 'Help for each child');
  assert.deepEqual(R.menuRows('nobody'), R.menuRows('parent'));
  for (const r of R.ROLES) for (const row of R.menuRows(r)) assert.ok(row.title && row.sub && row.href && row.id, r + row.id);
  assert.ok(!R.menuRows('teacher').some((x) => /results/i.test(x.title)), 'no Results row for any role');
});
test('menuRows hands back its own copies', () => {
  R.menuRows('parent')[0].title = 'Changed';
  assert.equal(R.menuRows('parent')[0].title, 'Children');
});

// ---- who needs help ------------------------------------------------------------------------------------------------
test('needsHelp: a finished test under 6 of 10 right', () => {
  const words = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8', 'i9', 'j0'].map((w) => w.replace(/\d/, 'x'));
  const ws = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'ii', 'jj'];
  void words;
  let d = week(W.emptyDoc(), 'g', ws, '2026-11-20', 1);
  d = tested(d, 'g', '2026-11-20', ws, ws.slice(0, 5));
  const r = R.needsHelp({ d, week: W.groupById(d, 'g'), sent: true, toPractise: [] }, '2026-11-21');
  assert.deepEqual(r.map((x) => x.why), ['test']);
  assert.equal(r[0].line, 'Test 5 of 10');
  assert.deepEqual(R.needsHelp({ d, week: W.groupById(d, 'g'), sent: true }, '2026-11-21').map((x) => x.why), ['test', 'words'], 'the 5 that slipped are also words to practise');
  let d6 = week(W.emptyDoc(), 'g', ws, '2026-11-20', 1);
  d6 = tested(d6, 'g', '2026-11-20', ws, ws.slice(0, 4));
  assert.deepEqual(R.needsHelp({ d: d6, week: W.groupById(d6, 'g'), sent: true, toPractise: [] }, '2026-11-21'), [], '6 of 10 is enough');
  const g = W.groupById(d6, 'g');
  assert.deepEqual(R.needsHelp({ d: week(W.emptyDoc(), 'g', ws, '2026-11-20', 1), week: g, sent: true }, MON), [], 'a test not done is not a reason');
});
test('needsHelp: 3 or more words to practise again, 2 or more jobs waiting, week not sent', () => {
  assert.deepEqual(R.needsHelp({ toPractise: ['a', 'b'] }), [], 'two words is not enough');
  const w3 = R.needsHelp({ toPractise: ['aa', 'bb', 'cc'] });
  assert.deepEqual(w3, [{ why: 'words', line: '3 words to practise again' }]);
  assert.equal(R.needsHelp({ toPractise: Array(4).fill('x') })[0].line, '4 words to practise again');
  assert.deepEqual(R.needsHelp({ sent: false }), [{ why: 'notsent', line: 'Week not sent yet' }]);
  assert.deepEqual(R.needsHelp({ sent: true }), []);
  assert.deepEqual(R.needsHelp({}), []);
  assert.deepEqual(R.needsHelp(null), []);
  // jobs: a week set on Mon 16, today Thu 19 and nothing done: hello and fix have gone by (2 waiting)
  const d = week(W.emptyDoc(), 'g', ['aa', 'bb'], '2026-11-23', 1);
  const day = (n) => W.addDays(MON, n);
  const waiting = (n) => R.needsHelp({ d, week: W.groupById(d, 'g') }, day(n));
  assert.deepEqual(waiting(0), []);
  assert.deepEqual(waiting(1), [], 'one job waiting is not 2');
  assert.deepEqual(waiting(2).map((x) => x.why), ['jobs']);
  assert.match(waiting(2)[0].line, /^\d jobs waiting$/);
});
test('needsHelp: reasons come in a fixed order; with no today the jobs reason is skipped; words that slipped in the test count when none are given', () => {
  const ws = ['aa', 'bb', 'cc', 'dd'];
  let d = week(W.emptyDoc(), 'g', ws, '2026-11-18', 1);
  d = tested(d, 'g', '2026-11-18', ws, ['aa', 'bb', 'cc']);
  const all = R.needsHelp({ d, week: W.groupById(d, 'g'), sent: false }, '2026-11-19');
  assert.deepEqual(all.map((x) => x.why), ['test', 'words', 'notsent'].filter((x) => all.some((y) => y.why === x)));
  assert.equal(all[0].why, 'test');
  assert.equal(all[all.length - 1].why, 'notsent');
  assert.equal(all.find((x) => x.why === 'words').line, '3 words to practise again', 'the three that slipped');
  assert.ok(!R.needsHelp({ d, week: W.groupById(d, 'g') }).some((x) => x.why === 'jobs'));
});
test('helpList: only children with a reason, in the order given, never ranked; NOBODY_LINE', () => {
  const kids = [{ id: 'a', name: 'Ada', toPractise: ['x', 'y', 'z'] }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Cy', sent: false }];
  const h = R.helpList(kids, MON);
  assert.deepEqual(h.map((x) => x.id), ['a', 'c']);
  assert.equal(h[0].name, 'Ada');
  assert.deepEqual(R.helpList([{ id: 'b', name: 'Ben' }], MON), []);
  assert.deepEqual(R.helpList(undefined), []);
  assert.equal(R.NOBODY_LINE, 'Nobody needs extra help this week.');
});

// ---- the home ---------------------------------------------------------------------------------------------------------
test('homeOrder: a parent and a teacher see the account order, untouched', () => {
  const kids = [kid('z', 'Zed'), kid('a', 'Ada'), kid('m', 'May')];
  for (const r of ['parent', 'teacher', 'nobody']) assert.deepEqual(R.homeOrder(r, kids, MON).map((k) => k.id), ['z', 'a', 'm']);
  assert.notEqual(R.homeOrder('parent', kids, MON), kids, 'a copy');
  assert.deepEqual(R.homeOrder('tutor', [], MON), []);
  assert.deepEqual(R.homeOrder('tutor', undefined, MON), []);
});
test('homeOrder: a tutor sees test due, then jobs waiting, then words to go over, then name', () => {
  // due: set Mon 9, test Fri 13, all jobs done by Thu 12; today Fri 13
  let due = week(W.emptyDoc(), 'g', ['aa', 'bb'], '2026-11-13', 1, '2026-11-09');
  const gd = W.groupById(due, 'g');
  for (const s of W.STUDY_JOBS) due = W.markStep(due, gd, s, '2026-11-12', 5);
  const behind = week(W.emptyDoc(), 'g', ['aa', 'bb'], '2026-11-20', 1, '2026-11-09'); // nothing done, days gone
  const fine = week(W.emptyDoc(), 'g', ['aa', 'bb'], '2026-11-20', 1, '2026-11-13');
  const today = '2026-11-13';
  const kids = [
    kid('n', 'Nell', fine),
    { ...kid('w', 'Wes', fine), toPractise: ['x'] },
    kid('j', 'Jo', behind),
    kid('d', 'Dee', due),
    kid('b', 'Abe', fine),
  ];
  assert.deepEqual(R.homeOrder('tutor', kids, today).map((k) => k.name), ['Dee', 'Jo', 'Wes', 'Abe', 'Nell']);
  assert.deepEqual(kids.map((k) => k.id), ['n', 'w', 'j', 'd', 'b'], 'the input is not reordered');
  assert.deepEqual(R.homeOrder('tutor', [kid('q', 'Quin'), kid('p', 'Pat')], today).map((k) => k.name), ['Pat', 'Quin'], 'no data: by name');
});
test('teacherSteps: three ticks from data that exists', () => {
  const t = (a) => R.teacherSteps(a).map((s) => s.done);
  assert.deepEqual(t({}), [false, false, false]);
  assert.deepEqual(t({ lists: [{ id: 'a' }] }), [true, false, false]);
  assert.deepEqual(t({ lists: [{ id: 'a' }], weeks: [{ done: false }] }), [true, true, false]);
  assert.deepEqual(t({ lists: [{ id: 'a' }], weeks: [{ done: true }] }), [true, false, false], 'a finished week is not running');
  assert.deepEqual(t({ lists: [{ id: 'a' }], weeks: [{}], openedResults: true }), [true, true, true]);
  assert.deepEqual(t({ openedResults: true }), [false, false, true]);
  const full = R.teacherSteps({ lists: [{ id: 'a' }], weeks: [{}], openedResults: true });
  assert.deepEqual(full.map((s) => s.n), [1, 2, 3]);
  assert.deepEqual(full.map((s) => s.title), ['Make the class list', 'Set the class week', 'See who needs help']);
  assert.ok(full.every((s) => s.allDone === true));
  assert.ok(R.teacherSteps({}).every((s) => s.allDone === false));
});

// ---- Set a week defaults -------------------------------------------------------------------------------------------------
test('setDefaults, teacher: every child ticked, one date, "Class week: <list>", no tricky words, title "Set the class week"', () => {
  const kids = [kid('c1', 'Ada'), kid('c2', 'Ben'), kid('c3', 'Cy')];
  const r = R.setDefaults('teacher', { kids, lists, today: MON });
  assert.deepEqual(r.cids, ['c1', 'c2', 'c3']);
  assert.equal(r.oid, OID2);
  assert.equal(r.name, 'Class week: Sea words');
  assert.equal(r.tricky, false);
  assert.equal(r.title, 'Set the class week');
  assert.equal(r.test, '2026-11-23');
  assert.equal(R.setDefaults('teacher', { kids: [kid('c1', 'Ada')], lists, today: MON }).tricky, false, 'not even for one child');
  assert.deepEqual(R.setDefaults('teacher', { kids: [], lists: [], today: MON }), { cids: [], test: '2026-11-23', oid: '', tricky: false, name: '', title: 'Set the class week' });
});
test('setDefaults, tutor: ONE learner; the learner\'s own lists first; a week after that learner\'s last week', () => {
  const running = week(W.emptyDoc(), OID + '.u12345', ['island'], '2026-11-27', 1);
  const kids = [kid('c1', 'Ada', running), kid('c2', 'Ben'), kid('c3', 'Cy')];
  const first = R.setDefaults('tutor', { kids, lists, today: MON });
  assert.deepEqual(first.cids, ['c2'], 'the first learner with no week running');
  assert.equal(first.oid, OID, 'Ben\'s list (the one given to him)');
  assert.equal(first.title, 'Set a week');
  assert.equal(first.tricky, true, 'one learner: tricky words offered');
  assert.equal(first.name, '');
  const from = R.setDefaults('tutor', { kids, lists, today: MON, from: 'c3' });
  assert.deepEqual(from.cids, ['c3']);
  assert.equal(from.oid, OID2, 'Cy\'s own list');
  const ada = R.setDefaults('tutor', { kids, lists, today: MON, from: 'c1' });
  assert.deepEqual(ada.cids, ['c1']);
  assert.equal(ada.test, '2026-12-04', 'a week after Ada\'s last test');
  assert.equal(R.setDefaults('tutor', { kids, lists, today: MON, from: 'gone' }).cids.length, 1, 'an unknown learner falls back to the first free one');
  const all = [kid('c1', 'Ada', running)];
  assert.deepEqual(R.setDefaults('tutor', { kids: all, lists, today: MON }).cids, ['c1'], 'everyone busy: the first');
  assert.deepEqual(R.setDefaults('tutor', { kids: [], lists, today: MON }).cids, []);
  const noOwn = R.setDefaults('tutor', { kids: [kid('c9', 'Zed')], lists, today: MON });
  assert.equal(noOwn.oid, OID2, 'no list of his own: the newest list');
});
test('setDefaults, parent: a child card ticks that child; else last time\'s children (set-doc nextDefaults)', () => {
  const d1 = week(W.emptyDoc(), OID + '.p11111', ['island'], '2026-11-27', 5);
  const kids = [kid('c1', 'Ada', d1), kid('c2', 'Ben', week(W.emptyDoc(), OID + '.p22222', ['quay'], '2026-11-27', 6)), kid('c3', 'Cy')];
  const bar = R.setDefaults('parent', { kids, lists, today: MON });
  assert.deepEqual(bar.cids, ['c1', 'c2']);
  assert.equal(bar.test, '2026-12-04');
  assert.equal(bar.title, 'Set a week');
  assert.equal(bar.tricky, false, 'two children: no tricky words');
  const card = R.setDefaults('parent', { kids, lists, today: MON, from: 'c3' });
  assert.deepEqual(card.cids, ['c3']);
  assert.equal(card.tricky, true);
  assert.deepEqual(R.setDefaults('parent', { kids: [kid('c1', 'Ada')], lists, today: MON }).cids, ['c1'], 'one child: always ticked');
  assert.deepEqual(R.setDefaults('parent', { kids, lists, today: MON, from: 'nobody' }).cids, ['c1', 'c2'], 'an unknown card is ignored');
  assert.equal(bar.name, '');
});
test('nextLearner: the next learner with no week running; none for a teacher or when everyone has one', () => {
  const busy = week(W.emptyDoc(), OID + '.u12345', ['island'], '2026-11-27', 1);
  const kids = [kid('c1', 'Ada'), kid('c2', 'Ben', busy), kid('c3', 'Cy'), kid('c4', 'Di')];
  assert.equal(R.nextLearner('tutor', kids, ['c1']).id, 'c3', 'Ben has a week; Ada was just set');
  assert.equal(R.nextLearner('tutor', kids, []).id, 'c1');
  assert.equal(R.nextLearner('tutor', kids, ['c1', 'c3']).id, 'c4');
  assert.equal(R.nextLearner('tutor', kids, ['c1', 'c3', 'c4']), null);
  assert.equal(R.nextLearner('teacher', kids, []), null);
  assert.equal(R.nextLearner('parent', kids, ['c1']).id, 'c3', 'a parent\'s sibling');
  assert.equal(R.nextLearner('tutor', [], []), null);
  assert.equal(R.nextLearner('tutor', undefined), null);
  const done = tested(busy, OID + '.u12345', '2026-11-27', ['island']);
  assert.equal(R.nextLearner('tutor', [kid('c2', 'Ben', done)], []).id, 'c2', 'a week whose test is done is not running');
});

// ---- the child limit ---------------------------------------------------------------------------------------------------
test('limitLine: "3 of 5 children", "3 of 15 learners", "5 of 15 children in your class"', () => {
  assert.equal(R.limitLine('parent', 3, 5), '3 of 5 children');
  assert.equal(R.limitLine('tutor', 3, 15), '3 of 15 learners');
  assert.equal(R.limitLine('teacher', 5, 15), '5 of 15 children in your class');
  assert.equal(R.limitLine('nobody', 1, 5), '1 of 5 children');
});
test('atLimitLine and the ask link', () => {
  assert.equal(R.atLimitLine('parent', 5, 5), 'Your plan holds 5 children.');
  assert.equal(R.atLimitLine('tutor', 15, 15), 'Your plan holds 15 learners.');
  assert.equal(R.atLimitLine('teacher', 8, 5), 'You have 8 children in your class and your plan holds 5.');
  assert.equal(R.atLimitLine('teacher', 5, 5), 'Your plan holds 5 children.');
  assert.equal(R.ASK_MORE, 'Ask for more places');
});
test('role-doc makes no data change: it only reads', () => {
  const d = week(W.emptyDoc(), 'g', ['aa', 'bb'], '2026-11-23', 1);
  const before = JSON.stringify(d);
  R.needsHelp({ d, week: W.groupById(d, 'g') }, '2026-11-20');
  R.homeOrder('tutor', [kid('a', 'A', d)], '2026-11-20');
  R.setDefaults('tutor', { kids: [kid('a', 'A', d)], lists, today: MON });
  assert.equal(JSON.stringify(d), before);
});
