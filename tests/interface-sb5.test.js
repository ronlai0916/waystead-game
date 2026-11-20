// SB5-WP-B: the interface between the app and the Waystead account (TRS TR-73, TRS-change-1 TR-93, TRS-change-2 TR-100/105/107).
// Everything runs against shared/tests/fake-account.js: no network, no clock, no DOM. The frozen 16c pure modules (git 4a8d100) are in
// tests/fixtures/16c/ and are never imported by the site: they stand for a device that has not updated yet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const W = await import('../site/js/words-doc.js');
const Su = await import('../site/js/setup-doc.js');
const Ow = await import('../site/js/own-doc.js');
const SET = await import('../site/js/set-doc.js');
const S = await import('../site/js/store.js');
const A = await import('../site/js/grownups-data.js');
const D = await import('../site/js/own-data.js');
const SD = await import('../site/js/set-data.js');
const SN = await import('../site/js/sentences-data.js');
const RD = await import('../site/js/role-data.js');
const RO = await import('../site/js/role-doc.js');
const { createApi } = await import('../site/js/account/api.js');
const { createPrefsSync, readLook } = await import('../site/js/account/prefs.js');
const { fakeAccount, memoryStorage, manualTimers, ADULT: FAKE_ADULT, CHILD_A } = await import('../shared/tests/fake-account.js');
const W16 = await import('./fixtures/16c/words-doc.js');
const Su16 = await import('./fixtures/16c/setup-doc.js');
const Ow16 = await import('./fixtures/16c/own-doc.js');

const file = (p) => fileURLToPath(new URL('./' + p, import.meta.url));
const fixture = (n) => JSON.parse(readFileSync(file('fixtures/' + n), 'utf8'));
const ORIGIN = 'https://account.example';
const ADULT = '33333333-3333-4333-8333-333333333333';
const uuid = (i) => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
const K = [1, 2, 3].map((i) => uuid(i));
const TODAY = '2026-11-02';
const TEST = '2026-11-09';
const DAY = 86400000;
const at = (day, h = 10) => Date.parse(day + 'T00:00:00Z') + h * 3600000;
const plus = (n) => W.addDays(TODAY, n);
let clock = Date.parse(TODAY + 'T10:00:00Z');
const now = () => (clock += 1000);
const LIST = ['island', 'because', 'friend', 'lantern', 'harbour'];
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body });
const childPath = (id) => '/api/children/' + id + '/game/spellbright/words';

/** n children, a fake account, an api whose fetch can be hooked (`hook.before(url, init)` may answer a response; `hook.delay` is a real pause). */
function setUp(n = 3) {
  mem.clear();
  S.usePlayer(ADULT);
  const acct = fakeAccount();
  const kids = Array.from({ length: n }, (_, i) => uuid(i + 1));
  acct.children = (id) => (id === ADULT ? kids.map((c, i) => ({ id: c, nickname: 'Kid' + i, year: 4, avatar: null })) : []);
  acct.who = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  for (const k of kids) acct.put(k, 'spellbright', 'words', W.emptyDoc());
  const hook = { before: null, delay: 0, flight: 0, peak: 0 };
  const fetch = async (url, init) => {
    hook.flight += 1;
    hook.peak = Math.max(hook.peak, hook.flight);
    try {
      if (hook.delay) await new Promise((r) => setTimeout(r, hook.delay));
      const early = hook.before ? await hook.before(url, init) : null;
      return early || acct.fetch(url, init);
    } finally { hook.flight -= 1; }
  };
  return { acct, kids, hook, api: A.createChildApi({ origin: ORIGIN, fetch }), fetch };
}
const puts = (acct) => acct.calls.filter((c) => c.method === 'PUT' && c.path.startsWith('/api/children/'));
const master = () => Ow.normalise(W.ownOf(S.readWords()));
const childDoc = (acct, id) => W.normalise(acct.get(id, 'spellbright', 'words'));
const weeksOf = (d) => Object.keys(d.groups);
const makeList = async (api, kids, extra = {}) => D.saveOwnChapter(api, { name: 'School words', words: LIST, to: [], ...extra }, { now });

// ---- E1 /api/me: role, childLimit, plan (I-me) -------------------------------------------------------------------------------
test('I-me: role, childLimit and plan are read; absent or bad values give 5 and unknown', async () => {
  assert.deepEqual(A.meFacts({ signedIn: true, kind: 'parent', role: 'teacher', childLimit: 12, plan: 'teacher' }), { role: 'teacher', limit: 12, plan: 'teacher', known: true });
  assert.deepEqual(A.meFacts(FAKE_ADULT), { role: 'parent', limit: 5, plan: 'parent', known: true });
  for (const me of [null, undefined, {}, { signedIn: false }, { signedIn: true, kind: 'child', childLimit: 9, role: 'tutor' }, { signedIn: true, kind: 'parent' }]) {
    assert.deepEqual(A.meFacts(me), { role: '', limit: 5, plan: '', known: false }, JSON.stringify(me));
  }
  for (const bad of [0, -1, 2.5, '9', NaN, null, 5000]) assert.equal(A.meFacts({ signedIn: true, kind: 'parent', childLimit: bad }).limit, 5, String(bad));
  assert.equal(A.meFacts({ signedIn: true, kind: 'parent', role: 'admin', plan: 'gold' }).role, '');
  assert.equal(A.meFacts({ signedIn: true, kind: 'parent', role: 'admin', plan: 'gold' }).plan, '');
  assert.equal(A.childCap(40), 15);
  assert.equal(A.childCap(8), 8);
  assert.equal(A.childCap(undefined), 5);
  const { acct, api } = setUp(1);
  acct.who = { ...acct.who, role: 'tutor', childLimit: 15, plan: 'tutor' };
  assert.deepEqual(await A.readMe(api), { role: 'tutor', limit: 15, plan: 'tutor', known: true });
  acct.who = { ...acct.who, childLimit: undefined, plan: undefined };
  assert.deepEqual(await A.readMe(api), { role: 'tutor', limit: 5, plan: '', known: false });
  acct.meStatus = 503;
  assert.deepEqual(await A.readMe(api), { role: '', limit: 5, plan: '', known: false });
});

// ---- E6/E7 (I-children, I-read, I-404) ---------------------------------------------------------------------------------------------
test('I-children: the shape; a child session or signed out is a problem, never an empty list', async () => {
  const { acct, api, kids } = setUp(3);
  const r = await A.listChildren(api);
  assert.deepEqual(r.children.map((c) => c.id), kids);
  acct.who = { ...acct.who, playingAs: { id: kids[0], nickname: 'Kid0', year: 4, avatar: null } };
  assert.deepEqual(await A.listChildren(api), { problem: 'playing' });
  acct.who = null;
  assert.deepEqual(await A.listChildren(api), { problem: 'signed-out' });
});

test('I-read: a 16c-shaped child value is read whole (groups, tries, setup.own, exams, weekPick)', async () => {
  const { acct, api, kids } = setUp(1);
  const fx = fixture('sb5-16c-child.json');
  acct.put(kids[0], 'spellbright', 'words', fx);
  const c = await A.readChild(api, kids[0]);
  assert.deepEqual(c.words, W.normalise(fx));
  assert.deepEqual(Object.keys(c.words.groups).sort(), Object.keys(fx.groups).sort());
  assert.deepEqual(c.setup.own, fx.setup.own);
  assert.deepEqual(c.setup.exams, fx.setup.exams);
  assert.equal(c.words.weekPick.on, fx.weekPick.on);
  assert.equal(c.words.results.length, fx.results.length);
});

test('I-404: an unknown child is a no-child problem', async () => {
  const { api } = setUp(1);
  assert.deepEqual(await A.readChild(api, uuid(99)), { problem: 'no-child' });
  const r = await SD.setWeek(api, { oid: '', cids: [uuid(99)], gids: { [uuid(99)]: 'a.p00001' }, name: 'W', test: TEST, words: LIST, today: TODAY }, { now });
  assert.deepEqual(r.results[uuid(99)], { problem: 'no-child' });
});

// ---- Set a week (I-set, I-set-info, I-set-typed, I-race, I-retry, I-partial, I-413, I-offline) --------------------------------------------------
test('I-set: three children, one PUT each (key words only), a role-letter id, 10 words at most, the copy and the master `to`', async () => {
  const { acct, api, kids } = setUp(3);
  const made = await makeList(api, kids);
  const gids = SD.makeGids(kids, { oid: made.oid, role: 'teacher' });
  for (const g of Object.values(gids)) assert.match(g, /^r[0-9a-f]{12}\.t[0-9a-f]{5}$/);
  assert.ok(Object.values(gids).every((g) => g.length <= 20));
  acct.calls.length = 0;
  const r = await SD.setWeek(api, { oid: made.oid, cids: kids, gids, name: 'Class week', test: TEST, words: LIST, today: TODAY }, { now });
  assert.deepEqual(r.master, { ok: true });
  for (const k of kids) assert.deepEqual(r.results[k], { ok: true });
  const sent = puts(acct);
  assert.equal(sent.length, 3);
  assert.deepEqual(sent.map((c) => c.path).sort(), kids.map(childPath).sort());
  assert.ok(acct.calls.every((c) => !(c.method === 'PUT' && !c.path.endsWith('/words'))));
  for (const k of kids) {
    const d = childDoc(acct, k);
    assert.deepEqual(weeksOf(d), [gids[k]]);
    assert.ok(d.groups[gids[k]].words.length <= 10);
    assert.deepEqual(d.setup.own[made.oid].words, LIST);
    assert.equal(d.setup.own[made.oid].at, master()[made.oid].at);
  }
  assert.ok(kids.every((k) => master()[made.oid].to.includes(k)));
  assert.equal(SET.weekRole(gids[kids[0]]), 'teacher');
});

test('I-set-info: the copy sent in the week PUT carries `info`; the master keeps it', async () => {
  const { acct, api, kids } = setUp(2);
  const info = { lantern: { s: 'We carried a lantern down the dark path.', m: 'a lamp you can carry' } };
  const made = await makeList(api, kids, { info });
  assert.ok(made.ok);
  assert.deepEqual(master()[made.oid].info, info);
  const gids = SD.makeGids(kids, { oid: made.oid, role: 'parent' });
  const r = await SD.setWeek(api, { oid: made.oid, cids: kids, gids, name: 'W', test: TEST, words: LIST, today: TODAY }, { now });
  assert.ok(kids.every((k) => r.results[k].ok));
  for (const k of kids) assert.deepEqual(childDoc(acct, k).setup.own[made.oid].info, info);
  assert.equal(puts(acct).filter((c) => c.path === childPath(kids[0])).length, 1); // the copy rode in the week's PUT
});

test('setOwnCopy carries info through saveOwnChapter (give for practice) and the repair resends a copy that lacks it', async () => {
  const { acct, api, kids } = setUp(2);
  const info = { lantern: { s: 'We carried a lantern down the dark path.' } };
  const made = await D.saveOwnChapter(api, { name: 'Words', words: LIST, to: kids, info }, { now });
  assert.deepEqual(made.notSent, []);
  assert.deepEqual(childDoc(acct, kids[0]).setup.own[made.oid].info, info);
  // a 16c device re-saves the child's value: the copy keeps its `at` and loses `info`
  const stale = W16.normalise(acct.get(kids[0], 'spellbright', 'words'));
  assert.equal(stale.setup.own[made.oid].info, undefined);
  acct.put(kids[0], 'spellbright', 'words', stale);
  assert.equal(D.lacksInfo(master()[made.oid], stale.setup.own[made.oid]), true);
  const r = await D.syncOwn(api, kids.map((id) => ({ id })), { now });
  assert.deepEqual(r.notSent, []);
  assert.deepEqual(childDoc(acct, kids[0]).setup.own[made.oid].info, info);
  const before = puts(acct).length;
  await D.syncOwn(api, kids.map((id) => ({ id })), { now }); // nothing lacks it now: no write
  assert.equal(puts(acct).length, before);
});

test('I-set-typed: the master is saved before any child call; 30 lists give too-many and no child call', async () => {
  const { acct, api, kids, hook } = setUp(2);
  let seen = null;
  hook.before = async (url, init) => { if (init.method === 'PUT' && seen === null) seen = Object.keys(master()).length; return null; };
  const gids = SD.makeGids(kids, { oid: '', role: 'tutor' });
  const words = ['quay', 'weight', 'guard'];
  const r = await SD.setWeekFromWords(api, { words, src: 'typed', name: 'Week of 9 Nov', cids: kids, gids, test: TEST, today: TODAY }, { now });
  assert.equal(seen, 1, 'the list was in the master before the first PUT');
  assert.ok(r.oid && kids.every((k) => r.results[k].ok));
  assert.deepEqual(master()[r.oid].words, words);
  assert.equal(master()[r.oid].name, 'Week of 9 Nov');
  assert.ok(kids.every((k) => master()[r.oid].to.includes(k)));
  // the copy went inside the week's PUT: one PUT per child, no separate copy send
  assert.equal(puts(acct).length, 2);
  for (const k of kids) { const d = childDoc(acct, k); assert.deepEqual(d.setup.own[r.oid].words, words); assert.equal(weeksOf(d).length, 1); }
  // 30 lists
  S.updateWords((d) => W.withOwn(d, { ...W.ownOf(d), ...Object.fromEntries(Array.from({ length: 29 }, (_, i) => ['r' + String(i + 100).padStart(12, '0'), { name: 'L' + i, words: ['quay'], src: 'typed', at: 5 + i, to: [] }])) }));
  assert.equal(Object.keys(master()).length, 30);
  acct.calls.length = 0;
  const full = await SD.setWeekFromWords(api, { words: ['early', 'earth'], src: 'typed', name: 'Another', cids: kids, gids: SD.makeGids(kids, { role: 'tutor' }), test: TEST, today: TODAY }, { now });
  assert.deepEqual(full, { error: 'too-many' });
  assert.equal(acct.calls.length, 0);
  // a week that cannot be made (no date) is refused before the list is saved
  const lists = Object.keys(master()).length;
  const bad = await SD.setWeekFromWords(api, { words: ['early'], src: 'typed', name: 'x', cids: kids, gids: {}, test: '', today: TODAY }, { now });
  assert.equal(bad.error, 'week');
  assert.equal(Object.keys(master()).length, lists);
});

test('I-race: another device writes the child between the read and the PUT: one week, the other device\'s tries kept', async () => {
  const { acct, api, kids, hook } = setUp(1);
  const made = await makeList(api, kids);
  const gids = SD.makeGids(kids, { oid: made.oid, role: 'parent' });
  let raced = false;
  hook.before = async (url, init) => {
    if (!raced && init.method === 'PUT') {
      raced = true;
      const d = W.createGroup(W.emptyDoc(), { id: 'rabcabcabcabc', name: 'Own', test: TEST, words: ['quay'], today: TODAY, now: at(TODAY) }).doc;
      acct.put(kids[0], 'spellbright', 'words', W.addTry(d, { id: 'tt1', word: 'quay', day: TODAY, group: 'rabcabcabcabc', kind: 'p', tries: 0, peeks: 0, clean: true, now: at(TODAY, 11) }));
    }
    return null;
  };
  const r = await SD.setWeek(api, { oid: made.oid, cids: kids, gids, name: 'W', test: TEST, words: LIST, today: TODAY }, { now });
  assert.deepEqual(r.results[kids[0]], { ok: true, updated: true });
  const d = childDoc(acct, kids[0]);
  assert.deepEqual(weeksOf(d).sort(), [gids[kids[0]], 'rabcabcabcabc'].sort());
  assert.equal(d.results.length, 1);
  assert.equal(d.results[0].id, 'tt1');
});

test('I-retry: setting twice with the same ids (a lost answer) still makes one week per child', async () => {
  const { acct, api, kids } = setUp(2);
  const made = await makeList(api, kids);
  const gids = SD.makeGids(kids, { oid: made.oid, role: 'parent' });
  const args = { oid: made.oid, cids: kids, gids, name: 'W', test: TEST, words: LIST, today: TODAY };
  await SD.setWeek(api, args, { now });
  const again = await SD.setWeek(api, args, { now });
  assert.ok(kids.every((k) => again.results[k].ok));
  for (const k of kids) assert.equal(weeksOf(childDoc(acct, k)).length, 1);
});

test('I-partial: one child fails, the others are made; Try again for that child only', async () => {
  const { acct, api, kids, hook } = setUp(3);
  const made = await makeList(api, kids);
  const gids = SD.makeGids(kids, { oid: made.oid, role: 'parent' });
  let broken = true;
  hook.before = async (url, init) => (broken && init.method === 'PUT' && url.includes(kids[1]) ? json(500, { error: 'forced' }) : null);
  const args = { oid: made.oid, cids: kids, gids, name: 'W', test: TEST, words: LIST, today: TODAY };
  const r = await SD.setWeek(api, args, { now });
  assert.deepEqual(r.results[kids[0]], { ok: true });
  assert.deepEqual(r.results[kids[1]], { problem: 'other' });
  assert.deepEqual(r.results[kids[2]], { ok: true });
  assert.equal(weeksOf(childDoc(acct, kids[1])).length, 0);
  const v = (k) => acct.data.get(k).get('spellbright/words').version;
  const v0 = v(kids[0]);
  broken = false;
  const retry = await SD.setWeek(api, { ...args, cids: [kids[1]] }, { now });
  assert.deepEqual(retry.results[kids[1]], { ok: true });
  assert.equal(weeksOf(childDoc(acct, kids[1])).length, 1);
  assert.equal(v(kids[0]), v0, 'child 1 untouched');
});

test('I-413: a PUT the account refuses as too big is a too-big problem and the child is unchanged', async () => {
  const { acct, api, kids, hook } = setUp(1);
  const made = await makeList(api, kids);
  const before = JSON.stringify(acct.get(kids[0], 'spellbright', 'words'));
  hook.before = async (url, init) => (init.method === 'PUT' ? json(413, { error: 'value-too-large' }) : null);
  const r = await SD.setWeek(api, { oid: made.oid, cids: kids, gids: SD.makeGids(kids, { oid: made.oid }), name: 'W', test: TEST, words: LIST, today: TODAY }, { now });
  assert.deepEqual(r.results[kids[0]], { problem: 'too-big' });
  assert.equal(JSON.stringify(acct.get(kids[0], 'spellbright', 'words')), before);
});

test('I-offline: every child is a network problem, no partial week, the master kept on the device', async () => {
  const { acct, api, kids } = setUp(2);
  const made = await makeList(api, kids);
  acct.offline = true;
  const r = await SD.setWeek(api, { oid: made.oid, cids: kids, gids: SD.makeGids(kids, { oid: made.oid }), name: 'W', test: TEST, words: LIST, today: TODAY }, { now });
  for (const k of kids) assert.deepEqual(r.results[k], { problem: 'network' });
  acct.offline = false;
  for (const k of kids) assert.equal(weeksOf(childDoc(acct, k)).length, 0);
  assert.ok(kids.every((k) => master()[made.oid].to.includes(k)));
  // signed out: nothing at all
  S.usePlayer(null);
  assert.deepEqual(await SD.setWeek(api, { oid: made.oid, cids: kids, gids: {}, name: 'W', test: TEST, words: LIST, today: TODAY }, { now }), { results: {}, master: { problem: 'signed-out' } });
});

test('setWeek: a list that is not there changes nothing; a child with no id is an error, not a crash', async () => {
  const { acct, api, kids } = setUp(2);
  const r = await SD.setWeek(api, { oid: 'r000000000000', cids: kids, gids: {}, name: 'W', test: TEST, words: LIST, today: TODAY }, { now });
  assert.deepEqual(r, { results: {}, master: { error: 'not-there' } });
  assert.equal(puts(acct).length, 0);
  const made = await makeList(api, kids);
  const r2 = await SD.setWeek(api, { oid: made.oid, cids: kids, gids: { [kids[0]]: SD.makeGids([kids[0]], { oid: made.oid })[kids[0]] }, name: 'W', test: TEST, words: LIST, today: TODAY }, { now });
  assert.deepEqual(r2.results[kids[0]], { ok: true });
  assert.deepEqual(r2.results[kids[1]], { error: 'no-week-id' });
});

// ---- the name the child sees: `setup.by` (TR-100) ------------------------------------------------------------------------------------------
test('by: written in the SAME PUT as every grown-up write to a child; undefined leaves it, a bad name never removes it, "" removes it', async () => {
  const { acct, api, kids } = setUp(1);
  const k = kids[0];
  const byOf = async () => (await A.readChild(api, k)).setup.by;
  const made = await makeList(api, kids);
  const gids = SD.makeGids(kids, { oid: made.oid, role: 'parent' });
  await SD.setWeek(api, { oid: made.oid, cids: kids, gids, name: 'W', test: TEST, words: LIST, today: TODAY }, { now, by: 'Mum' });
  assert.equal((await byOf()).n, 'Mum');
  const gid = gids[k];
  assert.equal(puts(acct).length, 1, 'one PUT: the week, the copy and the name');
  // change, delete, restore carry the name too
  assert.deepEqual(await SD.changeWeek(api, k, gid, { name: 'Renamed' }, { today: TODAY, now, by: 'Dad' }), { ok: true });
  assert.equal((await byOf()).n, 'Dad');
  assert.equal(childDoc(acct, k).groups[gid].name, 'Renamed');
  assert.deepEqual(await SD.deleteWeek(api, k, gid, { now, by: 'Gran' }), { ok: true });
  assert.equal((await byOf()).n, 'Gran');
  assert.ok(childDoc(acct, k).groups[gid].gone);
  assert.deepEqual(await SD.restoreWeek(api, k, gid, { now }), { ok: true }); // by left alone
  assert.equal((await byOf()).n, 'Gran');
  assert.equal(childDoc(acct, k).groups[gid].gone, undefined);
  // give for practice and delete a list
  await D.saveOwnChapter(api, { oid: made.oid, name: 'School words', words: LIST, to: [k] }, { now, by: 'Mum and Dad' });
  assert.equal((await byOf()).n, 'Mum and Dad');
  // a name that is not clean is ignored
  await D.saveOwnChapter(api, { oid: made.oid, name: 'School words', words: LIST, to: [k] }, { now, by: 'a@b.com' });
  assert.equal((await byOf()).n, 'Mum and Dad');
  assert.deepEqual(await SD.changeWeek(api, k, gid, { name: 'Again' }, { today: TODAY, now, by: '' }), { ok: true });
  assert.equal(await byOf(), undefined);
});

test('pushName: one setup change per child, in turn; same name = no PUT; a failure is silent and the rest go on', async () => {
  const { acct, api, kids, hook } = setUp(3);
  const rs = await SD.readKids(api, kids.map((id) => ({ id })));
  acct.calls.length = 0;
  const r = await SD.pushName(api, rs, 'Ms Patel', { now });
  assert.ok(kids.every((k) => r[k].ok));
  assert.equal(puts(acct).length, 3);
  for (const k of kids) assert.equal(childDoc(acct, k).setup.by.n, 'Ms Patel');
  acct.calls.length = 0;
  const same = await SD.pushName(api, kids.map((id) => ({ id })), 'Ms Patel', { now });
  assert.ok(kids.every((k) => same[k].ok && same[k].unchanged));
  assert.equal(puts(acct).length, 0, 'nobody is written again for the same name');
  // rename with one child failing
  hook.before = async (url, init) => (init.method === 'PUT' && url.includes(kids[1]) ? json(500, { error: 'x' }) : null);
  const re = await SD.pushName(api, rs, 'Mr Lee', { now });
  assert.equal(re[kids[0]].ok, true);
  assert.deepEqual(re[kids[1]], { problem: 'other' });
  assert.equal(re[kids[2]].ok, true);
  assert.equal(childDoc(acct, kids[0]).setup.by.n, 'Mr Lee');
  assert.equal(childDoc(acct, kids[1]).setup.by.n, 'Ms Patel');
  // a bad name touches nothing; '' removes
  acct.calls.length = 0;
  const bad = await SD.pushName(api, rs, 'a@b.com', { now });
  assert.ok(kids.every((k) => bad[k].error === 'bad-name'));
  assert.equal(acct.calls.length, 0);
  hook.before = null;
  await SD.pushName(api, rs, '', { now });
  for (const k of kids) assert.equal((childDoc(acct, k).setup || {}).by, undefined);
});

// ---- 15 children, 5 at a time (S-set-15 in data form) ----------------------------------------------------------------------------------------
test('S-set-15: 15 children, one week each, never more than 5 calls at once, no 429', async () => {
  const { acct, api, kids, hook } = setUp(15);
  hook.delay = 2;
  const made = await makeList(api, kids);
  const gids = SD.makeGids(kids, { oid: made.oid, role: 'teacher' });
  const r = await SD.setWeek(api, { oid: made.oid, cids: kids, gids, name: 'Class week', test: TEST, words: LIST, today: TODAY }, { now, by: 'Ms Patel' });
  assert.deepEqual(r.master, { ok: true });
  assert.ok(kids.every((k) => r.results[k].ok));
  assert.ok(hook.peak <= A.POOL, 'peak in flight ' + hook.peak);
  assert.ok(hook.peak > 1, 'it does run in parallel');
  assert.equal(master()[made.oid].to.length, 15);
  for (const k of kids) assert.deepEqual(weeksOf(childDoc(acct, k)), [gids[k]]);
  // readKids and syncOwn use the pool too
  hook.peak = 0;
  const read = await SD.readKids(api, kids.map((id) => ({ id })));
  assert.equal(read.length, 15);
  assert.ok(read.every((x) => x.d));
  assert.ok(hook.peak <= A.POOL);
  hook.peak = 0;
  await D.syncOwn(api, kids.map((id) => ({ id })), { now });
  assert.ok(hook.peak <= A.POOL);
  // a 16th child cannot widen `to` past the data cap, and is said so
  const more = uuid(16);
  acct.children = (id) => (id === ADULT ? [...kids, more].map((c) => ({ id: c, nickname: 'x', year: 4, avatar: null })) : []);
  acct.put(more, 'spellbright', 'words', W.emptyDoc());
  const r16 = await SD.setWeek(api, { oid: made.oid, cids: [...kids, more], gids: SD.makeGids([...kids, more], { oid: made.oid }), name: 'W2', test: TEST, words: LIST, today: TODAY }, { now });
  assert.equal(r16.master.toCut, 1);
  assert.equal(master()[made.oid].to.length, 15);
  assert.ok(r16.results[more].ok, 'the week itself is still made');
});

test('pool: results keep the items\' order and a lane never runs more than `size` at once', async () => {
  let live = 0;
  let peak = 0;
  const out = await A.pool([5, 4, 3, 2, 1, 0, 6], async (x) => { live += 1; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, x)); live -= 1; return x * 2; }, 3);
  assert.deepEqual(out, [10, 8, 6, 4, 2, 0, 12]);
  assert.equal(peak, 3);
  assert.deepEqual(await A.pool([], async () => 1), []);
});

// ---- 16c compatibility (I-16c-merge, I-by-16c, I-info-16c, I-short-16c) -----------------------------------------------------------------
test('I-16c-merge: SB5-written child doc through the frozen 16c normalise and merge keeps weeks, words, back, copies and exams', async () => {
  const { acct, api, kids } = setUp(1);
  acct.put(kids[0], 'spellbright', 'words', fixture('sb5-16c-child.json'));
  const made = await makeList(api, kids, { info: { lantern: { s: 'We carried a lantern down the dark path.' } } });
  const gids = SD.makeGids(kids, { oid: made.oid, role: 'tutor' });
  await SD.setWeek(api, { oid: made.oid, cids: kids, gids, name: 'New', test: TEST, words: LIST, today: TODAY }, { now, by: 'Sam' });
  const sb5 = acct.get(kids[0], 'spellbright', 'words');
  const old = W16.normalise(sb5);
  assert.ok(old.groups[gids[kids[0]]], 'the dotted group is read by 16c');
  assert.deepEqual(old.groups[gids[kids[0]]].words, LIST);
  assert.deepEqual(Object.keys(old.groups).sort(), Object.keys(W.normalise(sb5).groups).sort());
  assert.deepEqual(old.setup.own[made.oid].words, LIST);
  assert.deepEqual(old.setup.exams, W.normalise(sb5).setup.exams);
  assert.equal(old.results.length, W.normalise(sb5).results.length);
  const merged = W16.merge(old, W16.normalise(fixture('sb5-16c-child.json')));
  assert.ok(merged.groups[gids[kids[0]]] && merged.groups.starter);
  assert.equal(merged.results.length, old.results.length);
  // rollback safety: a 16c-written doc through SB5 normalise + merge changes nothing it already holds
  const fx = fixture('sb5-16c-child.json');
  assert.deepEqual(W.normalise(fx), W16.normalise(fx));
  assert.deepEqual(W.merge(W.normalise(fx), W.normalise(fx)), W16.merge(W16.normalise(fx), W16.normalise(fx)));
  const adult = fixture('sb5-16c-adult.json');
  assert.deepEqual(W.normalise(adult), W16.normalise(adult));
});

test('I-by-16c: a child value with setup.by through the frozen 16c Su.normalise: `by` gone, everything else equal', () => {
  const fx = fixture('sb5-16c-child.json');
  const setup = Su.setBy(fx.setup, 'Ms Patel', 99999999);
  assert.equal(setup.by.n, 'Ms Patel');
  const old = Su16.normalise(setup);
  assert.equal(old.by, undefined);
  const { by, ...rest } = Su.normalise(setup);
  assert.deepEqual(old, rest);
  const doc = W.withSetup(W.normalise(fx), setup);
  const oldDoc = W16.normalise(doc);
  assert.equal(oldDoc.setup.by, undefined);
  assert.deepEqual({ ...oldDoc, setup: undefined }, { ...W.normalise(fx), setup: undefined });
  // and the 16c device that re-saves it, then merges with SB5, never loses the SB5 name (the later `at` is on the SB5 side)
  const mergedBack = W.merge(W.normalise(doc), oldDoc);
  assert.equal(mergedBack.setup.by.n, 'Ms Patel');
  assert.ok(JSON.stringify(Su.byOf(setup)).length <= 60);
});

test('I-info-16c: `info` is dropped by 16c (copy and master) and nothing else is: every word, list, week and try kept', () => {
  const info = { lantern: { s: 'We carried a lantern down the dark path.', m: 'a lamp you can carry' } };
  const copy = Su.setOwnCopy({}, 'r0123456789ab', { name: 'School words', words: ['island', 'lantern', 'harbour'], src: 'typed', info }, 50).setup;
  assert.deepEqual(copy.own.r0123456789ab.info, info);
  const old = Su16.normalise(copy);
  assert.equal(old.own.r0123456789ab.info, undefined);
  assert.deepEqual(old.own.r0123456789ab, { name: 'School words', words: ['island', 'lantern', 'harbour'], src: 'typed', at: 50 });
  const own = Ow.set({}, 'r0123456789ab', { name: 'School words', words: ['island', 'lantern', 'harbour'], src: 'typed', to: [uuid(1), uuid(2), uuid(3), uuid(4), uuid(5), uuid(6), uuid(7)], info }, 60).own;
  assert.deepEqual(own.r0123456789ab.info, info);
  const oldOwn = Ow16.normalise(own);
  assert.equal(oldOwn.r0123456789ab.info, undefined);
  assert.deepEqual(oldOwn.r0123456789ab.words, ['island', 'lantern', 'harbour']);
  assert.equal(oldOwn.r0123456789ab.to.length, 5, '16c cuts `to` to 5 when it re-saves (known, transient)');
  assert.equal(own.r0123456789ab.to.length, 7);
  // a whole 16c-shaped adult value with new fields: weeks and tries are equal after 16c
  const adult = W.withOwn(W.normalise(fixture('sb5-16c-adult.json')), own);
  const oldAdult = W16.normalise(adult);
  assert.deepEqual(oldAdult.groups, W.normalise(adult).groups);
  assert.deepEqual(oldAdult.results, W.normalise(adult).results);
  assert.equal(Object.keys(oldAdult.own).length, Object.keys(W.normalise(adult).own).length);
});

test('I-short-16c: a 3-day week played half on 16c modules, half on SB5: the same job every day, the same test day, the same hidden words', () => {
  const T0 = '2026-11-02';
  const test = W.addDays(T0, 3);
  const words = ['island', 'quay', 'weight', 'guard'];
  const hidden = (M, d, day) => new Set(M.liveGroups(d).filter((g) => M.jobFor(d, g, day) === 'test').flatMap((g) => g.words.map((w) => w.toLowerCase())));
  let d16 = W16.createGroup(W16.emptyDoc(), { id: 'a.p00001', name: 'Short', test, words, today: T0, now: at(T0, 8) }).doc;
  let d5 = W.createGroup(W.emptyDoc(), { id: 'a.p00001', name: 'Short', test, words, today: T0, now: at(T0, 8) }).doc;
  assert.deepEqual(d16, d5);
  let n = 0;
  const play = (M, d, day, id) => {
    let x = d;
    for (const w of words) {
      for (let h = 0; h < 3; h++) x = M.addTry(x, { id: id + (n++), word: w, day, group: 'a.p00001', kind: 'p', tries: 0, peeks: 0, clean: true, now: at(day, 9 + h) });
      x = M.addTry(x, { id: id + (n++), word: w, day, group: 'a.p00001', kind: 'p', tries: 0, peeks: 0, clean: true, source: 'm', now: at(day, 13) });
    }
    return { ...x, steps: { ...x.steps, ['a.p00001|' + ['hello', 'fix', 'games', 'story', 'practice'][Math.min(4, W.daysBetween(T0, day))]]: at(day, 14) } };
  };
  for (let i = 0; i <= 4; i++) {
    const day = W.addDays(T0, i);
    // days 0-1 are played with the 16c modules, days 2-4 with SB5; the doc crosses over through JSON as an account PUT would
    const first = i < 2;
    d16 = play(W16, d16, day, 'x');
    d5 = play(W, d5, day, 'x');
    const carried = JSON.parse(JSON.stringify(first ? d16 : d5));
    d16 = W16.normalise(carried);
    d5 = W.normalise(carried);
    const g16 = W16.liveGroups(d16)[0];
    const g5 = W.liveGroups(d5)[0];
    assert.equal(W16.jobFor(d16, g16, day), W.jobFor(d5, g5, day), 'job on ' + day);
    assert.deepEqual([...hidden(W16, d16, day)], [...hidden(W, d5, day)], 'hidden on ' + day);
    assert.equal(W16.jobLeft(d16, g16, day, 'p') && W16.jobLeft(d16, g16, day, 'p').length, W.jobLeft(d5, g5, day, 'p') && W.jobLeft(d5, g5, day, 'p').length);
  }
  assert.equal(W.jobFor(d5, W.liveGroups(d5)[0], test), W16.jobFor(d16, W16.liveGroups(d16)[0], test));
});

// ---- size (I-size, I-size-15) --------------------------------------------------------------------------------------------------------------
function played(M, d, gid, words, start) {
  let n = 0;
  let x = d;
  for (const w of words) {
    for (const [off, kind, src, k] of [[4, 'p', undefined, 3], [5, 'p', undefined, 3], [5, 'f', undefined, 1], [3, 'p', 'm', 2], [4, 'p', 'g', 1], [6, 't', undefined, 1]]) {
      for (let j = 0; j < k; j++) x = M.addTry(x, { id: gid.slice(-6) + w.slice(0, 3) + off + kind + (n++), word: w, day: W.addDays(start, off), group: gid, kind, tries: j % 2, peeks: 0, clean: j % 2 === 0, source: src, now: at(W.addDays(start, off), 9 + j) });
    }
  }
  return x;
}
// 'full info' = as many words as the per-list budget (MAX_INFO_BYTES, 400, D46) allows, each with a sentence and a meaning
const INFO_ALL = (words) => Object.fromEntries(words.map((w) => [w, { s: 'We saw the ' + w + ' near the old stone bridge by the river.', m: 'a thing that you can see and touch' }]));
const INFO_FULL = (words) => {
  for (let k = words.length; k >= 0; k--) {
    const info = INFO_ALL(words.slice(0, k));
    if (!k || new TextEncoder().encode(JSON.stringify(info)).length <= 400) return info;
  }
  return {};
};

test('I-size: two fully played dotted weeks + 3 list copies stay under 48 KB and trim changes nothing observable', () => {
  const ids = ['r0123456789ab.t12345', 'r0123456789ab.u54321'];
  const ten = ['island', 'because', 'friend', 'lantern', 'harbour', 'quay', 'weight', 'guard', 'height', 'orchard'];
  let d = W.emptyDoc();
  d = W.createGroup(d, { id: ids[0], name: 'One', test: '2026-11-09', words: ten, today: '2026-11-02', now: 1 }).doc;
  d = W.createGroup(d, { id: ids[1], name: 'Two', test: '2026-11-16', words: ten.slice().reverse(), today: '2026-11-09', now: 2 }).doc;
  d = played(W, d, ids[0], ten, '2026-11-02');
  d = played(W, d, ids[1], ten, '2026-11-09');
  let su = {};
  for (let i = 0; i < 3; i++) su = Su.setOwnCopy(su, 'r00000000000' + i, { name: 'List ' + i, words: ten.slice(0, 5).concat(['a' + i + 'bcd', 'e' + i + 'fgh', 'i' + i + 'jkl', 'm' + i + 'nop', 'q' + i + 'rst']), src: 'typed', info: INFO_FULL(['a' + i + 'bcd', 'e' + i + 'fgh']) }, 10 + i).setup;
  d = W.withSetup(d, Su.setBy(su, 'Ms Patel', 20));
  const size = W.sizeOf(d);
  assert.ok(size < W.TRIM_AT, 'size ' + size);
  const t = W.trim(d, at('2026-11-20'));
  assert.equal(JSON.stringify(t), JSON.stringify(d));
  // the heavy case: pad to over the line; what the child sees (job, dots, test results) is the same after trim
  let heavy = d;
  for (let i = 0; i < 700; i++) heavy = W.addTry(heavy, { id: 'pad' + i, word: ten[i % 10], day: W.addDays('2026-11-02', 4 + (i % 2)), group: ids[0], kind: 'p', tries: 0, peeks: 0, clean: true, now: at('2026-11-06', 9) + i });
  assert.ok(W.sizeOf(heavy) > W.TRIM_AT);
  const th = W.trim(heavy, at('2026-11-20'));
  assert.ok(W.sizeOf(th) <= W.TRIM_AT);
  const g = (x, id) => ({ id, ...x.groups[id] });
  for (const id of ids) {
    assert.deepEqual(W.testResults(th, g(th, id)), W.testResults(heavy, g(heavy, id)));
    assert.equal(W.jobFor(th, g(th, id), '2026-11-20'), W.jobFor(heavy, g(heavy, id), '2026-11-20'));
    for (const w of ten) assert.equal(W.dots(th, g(th, id), w, '2026-11-06'), W.dots(heavy, g(heavy, id), w, '2026-11-06'), id + ' ' + w);
  }
});

const tenUuids = Array.from({ length: 15 }, (_, i) => uuid(i + 1));
const wordsOf = (l) => Array.from({ length: 15 }, (_, i) => 'wordl' + String.fromCharCode(97 + (l % 26)) + String.fromCharCode(97 + i) + 'x');
function bigAdult(lists, withInfoWords) {
  let own = {};
  for (let l = 0; l < lists; l++) {
    const words = wordsOf(l);
    let r;
    for (let k = Math.min(withInfoWords, 15); k >= 0; k--) {
      r = Ow.set(own, 'r' + String(l).padStart(12, '0'), { name: 'List number ' + l + ' of the term', words, src: 'typed', to: tenUuids, info: INFO_FULL(words.slice(0, k)) }, 1000 + l);
      if (!r.error) break;
    }
    own = r.own;
  }
  let d = W.emptyDoc();
  const ten = wordsOf(0).slice(0, 10);
  d = W.createGroup(d, { id: 'r000000000000.t12345', name: 'Wk', test: '2026-11-09', words: ten, today: '2026-11-02', now: 1 }).doc;
  // the adult's own play ("Play yourself") is light: one practice day, 3 tries a word (the children's weeks are in their own values)
  ten.forEach((w, i) => { for (let j = 0; j < 3; j++) d = W.addTry(d, { id: 'a' + i + j, word: w, day: '2026-11-06', group: 'r000000000000.t12345', kind: 'p', tries: 0, peeks: 0, clean: true, now: at('2026-11-06', 9) + i * 10 + j }); });
  return W.withOwn(d, own);
}

test('I-size-15: 30 lists shared with 15 children and a played week stay inside the account limits (no info)', () => {
  const d = bigAdult(30, 0);
  const size = W.sizeOf(d);
  assert.ok(size < W.TRIM_AT, 'adult value ' + size);
  assert.equal(Object.values(Ow.normalise(d.own))[0].to.length, 15);
});

test('I-size-15: 30 lists of 15 own words at the full info budget (400 bytes), 15 children and a played week stay under the 48 KB line', () => {
  const d = bigAdult(30, 15);
  const size = W.sizeOf(d);
  assert.ok(size < W.TRIM_AT, 'adult value ' + size);
  const first = Object.values(Ow.normalise(d.own))[0];
  assert.ok(Object.keys(first.info).length >= 1, 'some words do carry info');
  assert.ok(new TextEncoder().encode(JSON.stringify(first.info)).length <= 400);
  assert.equal(first.to.length, 15);
});

test('I-size-15: a child value with 10 full-info copies and two played weeks stays under 48 KB; 15 PUT bodies stay under the account limit', async () => {
  const ten = wordsOf(0).slice(0, 10);
  let d = W.emptyDoc();
  d = W.createGroup(d, { id: 'r000000000000.t12345', name: 'One', test: '2026-11-09', words: ten, today: '2026-11-02', now: 1 }).doc;
  d = W.createGroup(d, { id: 'r000000000000.t54321', name: 'Two', test: '2026-11-16', words: ten, today: '2026-11-09', now: 2 }).doc;
  d = played(W, d, 'r000000000000.t12345', ten, '2026-11-02');
  d = played(W, d, 'r000000000000.t54321', ten, '2026-11-09');
  let su = {};
  for (let i = 0; i < 10; i++) {
    const words = wordsOf(i);
    let info = INFO_FULL(words);
    let r = Su.setOwnCopy(su, 'r00000000000' + (i % 10), { name: 'List number ' + i + ' of the term', words, src: 'typed', info }, 10 + i);
    su = r.setup;
  }
  d = W.withSetup(d, Su.setBy(su, 'Ms Patel', 99));
  assert.ok(W.sizeOf(d) < W.TRIM_AT, 'child value ' + W.sizeOf(d));
  // 15 children each get a week through the fake account with the 64 KB check on
  const { acct, api, kids } = setUp(15);
  const made = await makeList(api, kids, { name: 'Class list', words: wordsOf(1), info: { [wordsOf(1)[0]]: { s: 'We saw the ' + wordsOf(1)[0] + ' near the old bridge.' } } });
  for (const k of kids) acct.put(k, 'spellbright', 'words', d);
  acct.calls.length = 0;
  const r = await SD.setWeek(api, { oid: made.oid, cids: kids, gids: SD.makeGids(kids, { oid: made.oid, role: 'teacher' }), name: 'Class', test: '2026-11-23', words: wordsOf(1).slice(0, 10), today: TODAY }, { now, by: 'Ms Patel' });
  assert.ok(kids.every((k) => r.results[k].ok), JSON.stringify(r.results));
  for (const c of puts(acct)) assert.ok(c.body.length < 64 * 1024 && JSON.parse(c.body).value && new TextEncoder().encode(JSON.stringify(JSON.parse(c.body).value)).length < W.TRIM_AT + 4096);
});

// ---- the sentence server (I-sentences) ----------------------------------------------------------------------------------------------------
const sent = (extra = {}) => {
  const acct = fakeAccount();
  acct.who = { ...FAKE_ADULT };
  Object.assign(acct.sentences, { missing: false, on: true }, extra);
  const client = SN.createSentences({ origin: ORIGIN, fetch: acct.fetch, enabled: true });
  return { acct, client };
};

test('sentences ship OFF: with the default switch no request is ever made', async () => {
  assert.equal(SN.SENTENCES_API, false);
  const acct = fakeAccount();
  acct.who = { ...FAKE_ADULT };
  acct.sentences.missing = false;
  acct.sentences.on = true;
  const c = SN.createSentences({ origin: ORIGIN, fetch: acct.fetch });
  assert.deepEqual(await c.allowance(), { on: false, why: 'off' });
  assert.deepEqual(await c.askFor(['lighthouse']), { problem: 'off' });
  assert.deepEqual(await c.fetchFor(['lighthouse']), { problem: 'off' });
  assert.equal(acct.calls.length, 0);
});

test('I-sentences: allowance never counts; POST counts a new word once; GET never counts; bank hits are free', async () => {
  const { acct, client } = sent();
  assert.deepEqual(await client.allowance(), { on: true, left: 60, limit: 60, hourLeft: 20, paused: false });
  assert.equal(acct.sentences.left, 60);
  const r = await client.askFor(['Lighthouse', 'lighthouse', 'harbour']);
  assert.deepEqual(r.items.map((i) => [i.word, i.status, i.statements.length]), [['lighthouse', 'ok', 3], ['harbour', 'ok', 3]]);
  assert.equal(r.left, 58);
  assert.equal(acct.sentences.left, 58);
  const again = await client.askFor(['lighthouse', 'harbour']);
  assert.equal(again.left, 58);
  assert.deepEqual(acct.sentences.events, ['lighthouse', 'harbour']);
  const got = await client.fetchFor(['lighthouse', 'nothere']);
  assert.deepEqual(Object.keys(got.items), ['lighthouse']);
  assert.equal(acct.sentences.left, 58);
  assert.ok(acct.calls.every((c) => c.credentials === 'include'));
  assert.deepEqual(await client.report('lighthouse:1'), { ok: true });
  assert.deepEqual(await client.report('bad id!'), { problem: 'bad-id' });
});

test('I-sentences: a child device may read (200) but not ask (403 playing); more than 15 words is 413 at the server and cut to 15 by the client', async () => {
  const { acct, client } = sent();
  await client.askFor(['lighthouse']);
  acct.who = { ...CHILD_A };
  assert.deepEqual(Object.keys((await client.fetchFor(['lighthouse'])).items), ['lighthouse']);
  assert.deepEqual(await client.askFor(['harbour']), { problem: 'playing' });
  acct.who = { ...FAKE_ADULT, playingAs: { id: CHILD_A.id, nickname: 'Sam', year: 4, avatar: null } };
  assert.deepEqual(await client.askFor(['harbour']), { problem: 'playing' });
  acct.who = { ...FAKE_ADULT };
  const sixteen = Array.from({ length: 16 }, (_, i) => 'word' + String.fromCharCode(97 + i) + 'x');
  const raw = await acct.fetch(ORIGIN + '/api/sentences', { method: 'POST', credentials: 'include', body: JSON.stringify({ words: sixteen }) });
  assert.equal(raw.status, 413);
  const rawGet = await acct.fetch(ORIGIN + '/api/sentences?words=' + sixteen.join(','), { credentials: 'include' });
  assert.equal(rawGet.status, 413);
  assert.equal(SN.askable(sixteen).length, 15);
  assert.deepEqual(SN.askable(['ok', 'a', 'Bad1', 'has space', 'toolongtoolongtoolongtoolong', 5, null, 'fine']), ['ok', 'fine']);
  acct.who = null;
  assert.deepEqual(await client.askFor(['harbour']), { problem: 'signed-out' });
});

test('I-sentences: the server\'s modes (fail, slow, dirty) and limits come back as the typing fallback, never as a bad sentence', async () => {
  let { acct, client } = sent({ mode: 'fake-fail' });
  assert.deepEqual((await client.askFor(['lighthouse'])).items, [{ word: 'lighthouse', status: 'failed', statements: [] }]);
  ({ acct, client } = sent({ mode: 'fake-slow' }));
  assert.deepEqual((await client.askFor(['lighthouse'])).items, [{ word: 'lighthouse', status: 'writing', statements: [] }]);
  ({ acct, client } = sent({ mode: 'fake-dirty' }));
  const dirty = (await client.askFor(['lighthouse'])).items[0];
  assert.equal(dirty.statements.length, 0, 'every dirty statement fails the check again');
  assert.equal(dirty.status, 'failed');
  ({ acct, client } = sent({ left: 0 }));
  assert.deepEqual(await client.allowance(), { on: false, why: 'monthly-limit', left: 0, limit: 60 });
  assert.deepEqual(await client.askFor(['lighthouse']), { problem: 'monthly-limit' });
  ({ acct, client } = sent({ hourLeft: 0, retryAfter: 600 }));
  assert.equal((await client.allowance()).why, 'hourly-limit');
  assert.deepEqual(await client.askFor(['lighthouse']), { problem: 'hourly-limit', retryAfter: 600 });
  ({ acct, client } = sent({ paused: true }));
  assert.equal((await client.allowance()).why, 'paused');
  assert.deepEqual(await client.askFor(['lighthouse']), { problem: 'paused' });
});

test('sentences: the kill switch (on:false, or the routes missing) stops every later ask; offline and a slow server are time-outs, not hangs', async () => {
  let { acct, client } = sent({ on: false });
  assert.deepEqual(await client.allowance(), { on: false, why: 'off' });
  assert.equal(client.off, true);
  const calls = acct.calls.length;
  assert.deepEqual(await client.askFor(['lighthouse']), { problem: 'off' });
  assert.equal(acct.calls.length, calls, 'no more calls once it is off');
  ({ acct, client } = sent({ missing: true }));
  assert.equal((await client.allowance()).why, 'off');
  ({ acct, client } = sent());
  acct.offline = true;
  assert.deepEqual(await client.askFor(['lighthouse']), { problem: 'offline' });
  assert.equal(client.off, false, 'offline does not switch it off');
  const slow = SN.createSentences({ origin: ORIGIN, enabled: true, timeoutMs: 20, fetch: (url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  assert.deepEqual(await slow.askFor(['lighthouse']), { problem: 'timeout' });
  assert.deepEqual(await slow.fetchFor(['lighthouse']), { problem: 'timeout' });
});

test('sentences: cleanStatement and the hidden ids; the child cache keeps 200 words, asks once a day, survives bad storage', () => {
  assert.deepEqual(SN.cleanStatement({ id: 'a:1', s: 'We looked at the lighthouse together.' }, 'lighthouse'), { id: 'a:1', s: 'We looked at the lighthouse together.' });
  for (const bad of [null, {}, { id: 'a b', s: 'We looked at the lighthouse together.' }, { id: 'a:1', s: 'we looked at the lighthouse together.' }, { id: 'a:1', s: 'We saw 3 lighthouse boats today.' },
    { id: 'a:1', s: 'The lighthouse and the lighthouse.' }, { id: 'a:1', s: 'No gap word in this one.' }, { id: 'a:1', s: 'Go to www.x.com for the lighthouse.' }, { id: 'a:1', s: 'One lighthouse. Two sentences.' }]) assert.equal(SN.cleanStatement(bad, 'lighthouse'), null, JSON.stringify(bad));
  const list = [{ id: 'a:1', s: 'x' }, { id: 'a:2', s: 'y' }];
  assert.deepEqual(SN.visible(list, ['a:1']), [{ id: 'a:2', s: 'y' }]);
  assert.deepEqual(SN.visible(list), list);
  const st = memoryStorage();
  assert.deepEqual(SN.readCache(st, 'p1'), {});
  const s1 = [{ id: 'w:1', s: 'We looked at the lighthouse together.' }];
  let cache = SN.mergeCache({}, ['lighthouse', 'nothere'], { lighthouse: s1 }, 1000);
  assert.deepEqual(cache.nothere, { s: [], at: 1000 });
  assert.equal(SN.writeCache(st, 'p1', cache), true);
  assert.deepEqual(SN.readCache(st, 'p1').lighthouse, { s: s1, at: 1000 });
  assert.equal(SN.readCache(st, 'p1').nothere, undefined, 'a word with no statements is not read back as one');
  assert.deepEqual(SN.needFetch(cache, ['lighthouse', 'harbour'], 1000 + 3600000), ['harbour']);
  assert.deepEqual(SN.needFetch(cache, ['lighthouse'], 1000 + SN.DAY_MS), ['lighthouse']);
  let big = {};
  for (let i = 0; i < 250; i++) big = SN.mergeCache(big, ['w' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26))], { ['w' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26))]: s1.map((x) => x) }, i);
  assert.ok(Object.keys(big).length <= SN.CACHE_MAX);
  const broken = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  assert.deepEqual(SN.readCache(broken, 'p1'), {});
  assert.equal(SN.writeCache(broken, 'p1', cache), false);
  const junk = memoryStorage();
  junk.setItem(SN.CACHE_KEY + 'p1', '{"lighthouse":{"s":"no","at":5},"UP":1,"harbour":{"s":[{"id":"x","s":"bad"}],"at":5}}');
  assert.deepEqual(SN.readCache(junk, 'p1'), {});
});

// ---- the role: prefs.sbRole (I-prefs-role) -------------------------------------------------------------------------------------------------
function roleSetUp() {
  const acct = fakeAccount();
  acct.who = { ...FAKE_ADULT };
  const api = createApi({ origin: ORIGIN, fetch: acct.fetch });
  const timers = manualTimers();
  const storage = memoryStorage();
  const prefs = createPrefsSync({ api, storage, playerId: FAKE_ADULT.id, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  let t = 1000;
  const store = RD.createRoleStore({ storage, playerId: FAKE_ADULT.id, prefs, now: () => (t += 10) });
  return { acct, api, timers, storage, prefs, store, clock: () => t };
}
const accountRole = (acct) => (acct.prefs.get(FAKE_ADULT.id) || { prefs: {} }).prefs.sbRole;

test('I-prefs-role: role and name are saved in prefs.sbRole, kept by a later look push and by a 16c-shaped prefs push', async () => {
  const { acct, api, timers, storage, prefs, store } = roleSetUp();
  assert.equal(store.get(), null);
  assert.equal(store.role(), 'parent');
  assert.equal(store.shouldAsk(), true);
  const r = store.set('tutor', 'Sam');
  assert.equal(r.ok, true);
  assert.equal(store.role(), 'tutor');
  assert.equal(store.name(), 'Sam');
  assert.ok(JSON.parse(storage.getItem(RD.ROLE_KEY + FAKE_ADULT.id)).r === 'tutor', 'the device copy is written at once');
  await timers.run();
  assert.deepEqual(accountRole(acct), { r: 'tutor', n: 'Sam', at: r.entry.at });
  assert.equal(store.shouldAsk(), false);
  // a look change pushed later keeps it
  storage.setItem('sb.theme', 'night');
  prefs.changed();
  await timers.run();
  assert.equal(accountRole(acct).r, 'tutor');
  // a 16c-shaped push (reads the prefs, spreads them, writes them back) keeps it
  const got = await api.getPrefs();
  await api.putPrefs({ theme: got.data.theme, dayStyle: got.data.dayStyle, prefs: { ...got.data.prefs, saved: 1, voice: '' } });
  assert.equal(accountRole(acct).n, 'Sam');
  // the role change writes sbRole only: no words or child call at all
  acct.calls.length = 0;
  store.set('teacher');
  await timers.run();
  assert.ok(acct.calls.every((c) => c.path === '/api/prefs'), 'only /api/prefs: ' + acct.calls.map((c) => c.path));
  assert.equal(store.name(), 'Sam', 'the name stays when only the role changes');
  assert.equal(accountRole(acct).r, 'teacher');
});

test('role store: another device reads the account copy; the newer `at` wins; a bad name or role changes nothing; "Not now" waits 7 days', async () => {
  const a = roleSetUp();
  a.store.set('teacher', 'Ms Patel');
  await a.timers.run();
  // device B: empty device copy, same account
  const apiB = createApi({ origin: ORIGIN, fetch: a.acct.fetch });
  const timersB = manualTimers();
  const storageB = memoryStorage();
  const prefsB = createPrefsSync({ api: apiB, storage: storageB, playerId: FAKE_ADULT.id, setTimer: timersB.setTimer, clearTimer: timersB.clearTimer });
  let tB = 5000;
  const storeB = RD.createRoleStore({ storage: storageB, playerId: FAKE_ADULT.id, prefs: prefsB, now: () => (tB += 1) });
  assert.equal(storeB.get(), null, 'before the pull: nothing');
  await prefsB.pull();
  assert.equal(storeB.role(), 'teacher');
  assert.equal(storeB.name(), 'Ms Patel');
  assert.equal(JSON.parse(storageB.getItem(RD.ROLE_KEY + FAKE_ADULT.id)).r, 'teacher', 'written back to the device for first paint');
  // account older than the device copy: the device wins
  storageB.setItem(RD.ROLE_KEY + FAKE_ADULT.id, JSON.stringify({ r: 'parent', n: 'Mum', at: 9e12 }));
  assert.equal(storeB.role(), 'parent');
  assert.equal(storeB.name(), 'Mum');
  // refusals
  const before = storeB.get();
  assert.deepEqual(storeB.set('tutor', 'a@b.com'), { error: RO.NAME_LINE });
  assert.deepEqual(storeB.set('tutor', 'Mum1'), { error: RO.NAME_LINE });
  assert.deepEqual(storeB.set('tutor', 'x'.repeat(30)), { error: RO.NAME_LINE });
  assert.deepEqual(storeB.set('king'), { error: 'bad-role' });
  assert.deepEqual(storeB.get(), before);
  assert.equal(storeB.set('parent', '').entry.n, undefined, 'an empty name removes the name');
  // Not now
  const c = roleSetUp();
  let t = 1e9;
  const store = RD.createRoleStore({ storage: c.storage, playerId: FAKE_ADULT.id, prefs: null, now: () => t });
  assert.equal(store.shouldAsk(), true);
  store.notNow();
  assert.equal(store.shouldAsk(), false);
  t += RD.ASK_AGAIN_MS - 1;
  assert.equal(store.shouldAsk(), false);
  t += 2;
  assert.equal(store.shouldAsk(), true);
  assert.equal(store.openedResults(), false);
  store.markOpenedResults();
  assert.equal(store.openedResults(), true);
});

test('role store: with no prefs sync (offline-only) or broken storage it still answers; setExtra refusing is reported', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const s = RD.createRoleStore({ storage: broken, playerId: 'p', prefs: null, now: () => 5 });
  assert.equal(s.get(), null);
  assert.equal(s.role(), 'parent');
  assert.equal(s.set('tutor', 'Sam').error, undefined, 'a device that cannot store still takes the change in memory-less form');
  const refusing = RD.createRoleStore({ storage: memoryStorage(), playerId: 'p', prefs: { extra: () => undefined, setExtra: () => false }, now: () => 5 });
  assert.deepEqual(refusing.set('tutor', 'Sam'), { error: 'not-saved' });
});

// ---- the whole file: only known calls (I-only-known-calls) ---------------------------------------------------------------------------------
test('I-only-known-calls: every call these modules make matches E1-E11 or the sentence routes', async () => {
  const { acct, api, kids } = setUp(3);
  await A.readMe(api);
  await A.listChildren(api);
  const made = await makeList(api, kids, { info: { lantern: { s: 'We carried a lantern down the dark path.' } } });
  const gids = SD.makeGids(kids, { oid: made.oid, role: 'parent' });
  await SD.setWeek(api, { oid: made.oid, cids: kids, gids, name: 'W', test: TEST, words: LIST, today: TODAY }, { now, by: 'Mum' });
  await SD.changeWeek(api, kids[0], gids[kids[0]], { name: 'R' }, { today: TODAY, now });
  await SD.pushName(api, kids.map((id) => ({ id })), 'Dad', { now });
  await D.syncOwn(api, kids.map((id) => ({ id })), { now });
  acct.sentences.missing = false;
  acct.sentences.on = true;
  const c = SN.createSentences({ origin: ORIGIN, fetch: acct.fetch, enabled: true });
  await c.allowance(); await c.askFor(['lighthouse']); await c.fetchFor(['lighthouse']); await c.report('lighthouse:1');
  const known = [
    ['GET', /^\/api\/me$/], ['GET', /^\/api\/children$/], ['GET', /^\/api\/children\/[^/]+\/game\/spellbright$/],
    ['PUT', /^\/api\/children\/[^/]+\/game\/spellbright\/words$/],
    ['GET', /^\/api\/sentences(\/allowance)?$/], ['POST', /^\/api\/sentences(\/report)?$/],
  ];
  for (const c2 of acct.calls) assert.ok(known.some(([m, re]) => m === c2.method && re.test(c2.path)), c2.method + ' ' + c2.path);
  assert.ok(acct.calls.every((c2) => c2.credentials === 'include'));
});
