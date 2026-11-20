// SB5 S7: the FAT defects. F-1 grown-up pages offline, F-2 a second device never asks the role again, m1..m4.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const who = await import('../site/js/who.js');
const RD = await import('../site/js/role-data.js');
const RO = await import('../site/js/role-doc.js');
const L = await import('../site/js/lists-doc.js');
const SV = await import('../site/js/set-views.js');
const { createApi } = await import('../site/js/account/api.js');
const { createPrefsSync } = await import('../site/js/account/prefs.js');
const { forgetPlayer } = await import('../site/js/account/forget.js');
const { fakeAccount, memoryStorage, manualTimers, ADULT } = await import('../shared/tests/fake-account.js');
const src = (p) => readFileSync(new URL('../site/' + p, import.meta.url), 'utf8');
const APP = src('js/app.js');
const GV = src('js/grownups-views.js');
const SETV = src('js/set-views.js');

const ID = '11111111-1111-4111-8111-111111111111';
const CACHED = { id: ID, name: 'Sam', avatar: null }; // the cached player has no kind
let reachNow = 'unknown';
let marks = new Set();
const setup = (player, reach, marked) => { reachNow = reach; marks = new Set(marked ? [ID] : []); who.useWho(() => player, () => Promise.resolve(), { reach: () => reachNow, adultMark: (id) => marks.has(id) }); };
const fakeMain = () => {
  const m = { innerHTML: '', contains: () => true, querySelector(sel) { return sel === '[data-who-wait]' && m.innerHTML.includes('data-who-wait') ? {} : sel === '[data-who-retry]' && m.innerHTML.includes('data-who-retry') ? { addEventListener() {} } : null; } };
  return m;
};

// ---- F-1 ----
test('F-1 rule: a cached player is an adult only while offline AND this device last heard /api/me say grown-up', () => {
  setup(CACHED, 'offline', true);
  assert.equal(who.kind(), 'adult');
  assert.equal(who.isAdult(), true);
  setup(CACHED, 'offline', false);
  assert.equal(who.kind(), 'unknown', 'a child (or anyone not confirmed) is never an adult');
  setup(CACHED, 'unknown', true);
  assert.equal(who.kind(), 'unknown', 'not offline yet: wait for the answer');
  setup(CACHED, 'online', true);
  assert.equal(who.kind(), 'unknown', 'online and no kind cannot happen; still never an adult');
  setup({ ...CACHED, kind: 'child', canSwitch: false }, 'offline', true);
  assert.equal(who.kind(), 'child', 'a live child answer wins over any mark');
  setup(null, 'offline', true);
  assert.equal(who.kind(), 'none');
});

test('F-1: offline with no confirmed adult: the offline page at once, no data and no spinner; Try again is there', async () => {
  const GVm = await import('../site/js/grownups-views.js');
  setup(CACHED, 'offline', false);
  const m = fakeMain();
  assert.equal(GVm.adultOnly(m), false);
  assert.match(m.innerHTML, /data-offline-who/);
  assert.match(m.innerHTML, /You are offline/);
  assert.match(m.innerHTML, /Sign in again when you are back online/);
  assert.match(m.innerHTML, /data-who-retry/);
  assert.doesNotMatch(m.innerHTML, /Checking who is here/);
});

test('F-1: offline with a confirmed adult: the page is allowed (device data), nothing is blocked', async () => {
  const GVm = await import('../site/js/grownups-views.js');
  setup(CACHED, 'offline', true);
  const m = fakeMain();
  assert.equal(GVm.adultOnly(m), true);
});

test('F-1: while the account has not answered the wait is 8 s at most, then the offline page (both page families)', async () => {
  const GVm = await import('../site/js/grownups-views.js');
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    setup(CACHED, 'unknown', false);
    for (const v of ['gu', 'st']) {
      const m = fakeMain();
      who.unknownCard(m, v);
      assert.match(m.innerHTML, /Just a moment/);
      mock.timers.tick(who.WHO_WAIT_MS - 1);
      assert.match(m.innerHTML, /Just a moment/, 'still waiting just before 8 s');
      mock.timers.tick(1);
      assert.match(m.innerHTML, /You are offline/);
      assert.match(m.innerHTML, /data-who-retry/);
    }
    assert.ok(who.WHO_WAIT_MS <= 8000);
    // a page that moved on is never overwritten
    const m2 = fakeMain();
    who.unknownCard(m2, 'gu');
    m2.contains = () => false;
    m2.innerHTML = 'other page';
    mock.timers.tick(9000);
    assert.equal(m2.innerHTML, 'other page');
    void GVm;
  } finally { mock.timers.reset(); }
});

test('F-1: both guards use it, the app marks adults only from a live answer and sign-out forgets the mark', () => {
  assert.match(GV, /if \(kind\(\) === 'unknown'\) \{ unknownCard\(main, 'gu'\); return false; \}/);
  assert.match(SETV, /if \(kind\(\) === 'unknown'\) \{ unknownCard\(main, 'st'\); return false; \}/);
  assert.doesNotMatch(GV + SETV, /Checking who is here/);
  assert.match(APP, /lsSet\(ADULT_KEY \+ player\.id, k === 'adult' \? '1' : null\)/);
  assert.match(APP, /adultMark: \(id\) => lsGet\(ADULT_KEY \+ id\) === '1'/);
  const s = memoryStorage();
  s.setItem('sb.adult:' + ID, '1'); s.setItem('wa.player', '{}');
  forgetPlayer(s, ID);
  assert.equal(s.getItem('sb.adult:' + ID), null);
});

// ---- F-2 ----
const newAccount = () => { const a = fakeAccount(); a.who = { ...ADULT }; return a; };
function secondDevice(acct, fetchFn) {
  const storage = memoryStorage();
  const api = createApi({ origin: 'https://account.example', fetch: fetchFn || acct.fetch });
  const timers = manualTimers();
  const seen = [];
  let prefs = null;
  prefs = createPrefsSync({ api, storage, playerId: ADULT.id, setTimer: timers.setTimer, clearTimer: timers.clearTimer, onRead: () => seen.push(prefs.extra('sbRole')) });
  const store = RD.createRoleStore({ storage, playerId: ADULT.id, prefs });
  return { storage, prefs, store, timers, seen };
}
test('F-2: a second device has no role of its own but the account has one: nobody is asked, the role is copied to the device', async () => {
  const acct = newAccount();
  acct.prefs.set(ADULT.id, { theme: 'system', dayStyle: 'garden', prefs: { saved: 1, sbRole: { r: 'teacher', n: 'Ms Patel', at: 1795000000000 } } });
  const d = secondDevice(acct);
  assert.equal(d.store.shouldAsk(), true, 'before the prefs are read the device knows nothing (the app must not ask yet)');
  assert.equal(d.prefs.loaded, false);
  await d.prefs.pull();
  assert.equal(d.prefs.loaded, true);
  assert.equal(d.store.shouldAsk(), false, 'after the read: never asked');
  assert.equal(d.store.get().r, 'teacher');
  assert.equal(JSON.parse(d.storage.getItem('sb.role:' + ADULT.id)).n, 'Ms Patel', 'copied to this device');
  assert.equal(d.seen[0] && d.seen[0].r, 'teacher', 'the wa:prefs listener now sees the account role (read after the extras are set)');
  await d.timers.run();
  assert.equal(acct.prefs.get(ADULT.id).prefs.sbRole.r, 'teacher', 'the account role is untouched');
});
test('F-2: the app asks only after the prefs were READ; the role page leaves when a role arrives and Continue never writes a default over it', () => {
  assert.match(APP, /if \(prefs\.loaded !== true\) \{/);
  assert.match(APP, /if \(!prefs\) return false;/);
  assert.doesNotMatch(APP, /let rolePulled = false/);
  assert.match(GV, /window\.addEventListener\('wa:prefs', onPrefs\)/);
  assert.match(GV, /if \(first && !pickedByHand && store\.get\(\)\) \{ done\(\); return; \}/);
  assert.match(GV, /window\.removeEventListener\('wa:prefs', onPrefs\)/);
});
test('F-2: nothing is asked when the prefs cannot be read, and a role chosen by hand is still saved', async () => {
  const acct = newAccount();
  const d = secondDevice(acct, async () => { throw new TypeError('offline'); });
  assert.equal(await d.prefs.pull(), 'later');
  assert.equal(d.prefs.loaded, false, 'the app does not ask while loaded is false');
  const r = d.store.set('tutor', '');
  assert.equal(r.ok, true);
  assert.equal(d.store.get().r, 'tutor');
});

// ---- m1 ----
test('m1: the tutor ask page says learners and pupil\'s pages', () => {
  assert.equal(RO.placesLine('tutor', 2, 5), 'You have 2 of 5 learners.');
  assert.match(GV, /data-places>' \+ esc\(RD\.placesLine\(role, n, me\.limit\)\)/);
  assert.match(GV, /role === 'tutor' \? 'a pupil’s' : 'a child’s'/);
  assert.doesNotMatch(GV, /' of ' \+ me\.limit \+ ' places\./);
});

// ---- m2 ----
test('m2: an unticked word stays in the list, unticked, until Save', () => {
  const on = SV.wordsBlockHtml({ words: ['one', 'three'], shown: ['one', 'two', 'three'], msg: '' });
  const boxes = [...on.matchAll(/<input type="checkbox" data-wk([^>]*)>/g)].map((x) => x[1]);
  assert.equal(boxes.length, 3);
  assert.match(boxes[0], /checked/);
  assert.doesNotMatch(boxes[1], /checked/);
  assert.match(boxes[1], /value="two"/);
  assert.match(on, /<span>two<\/span>/);
  assert.doesNotMatch(SV.wordsBlockHtml({ words: ['a'], msg: '' }), /Remove/);
  assert.match(SETV, /shown: \[\.\.\.g\.words\]/);
  assert.match(SETV, /st\.shown\.push\(r\.word\)/);
});

// ---- m3 ----
test('m3: offline the card never says "Not given to anyone yet"', () => {
  assert.equal(L.offlineLine(0), 'Not known while offline');
  assert.match(L.offlineLine(2), /^Given for practice/);
  assert.match(src('js/own-views.js'), /if \(offline\) return L\.offlineLine\(e\.to\.length\);/);
});

// ---- m4 ----
test('m4: a prefs save refused with 413 stops: no retry on later changes, one message', async () => {
  const acct = newAccount();
  acct.prefs.set(ADULT.id, { theme: 'system', dayStyle: 'garden', prefs: { saved: 1 } });
  let puts = 0;
  const f = async (u, i) => { if (i && i.method === 'PUT' && String(u).endsWith('/api/prefs')) { puts++; return { ok: false, status: 413, headers: { get: () => null }, json: async () => ({}) }; } return acct.fetch(u, i); };
  const storage = memoryStorage();
  const timers = manualTimers();
  let refused = 0;
  const prefs = createPrefsSync({ api: createApi({ origin: 'https://account.example', fetch: f }), storage, playerId: ADULT.id, setTimer: timers.setTimer, clearTimer: timers.clearTimer, onRefused: () => refused++ });
  await prefs.pull();
  prefs.setExtra('sbRole', { r: 'parent', at: 1 });
  await timers.run();
  assert.equal(puts, 1);
  assert.equal(refused, 1);
  assert.equal(prefs.refused, true);
  for (let i = 0; i < 4; i++) { prefs.setExtra('sbRole', { r: 'tutor', at: 10 + i }); await timers.run(); }
  assert.equal(puts, 1, 'never retried on later changes');
  assert.equal(refused, 1, 'said once');
  assert.equal(storage.getItem('wa.prefs:' + ADULT.id), null, 'nothing waits to be sent');
  assert.match(APP, /wa:prefs-refused/);
  assert.match(APP, /import \{ toast \} from '\.\/ui\.js'/);
});
