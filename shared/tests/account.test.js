// The shared Waystead Account client (shared/account/), against a fake API
// (fake-account.js): who is playing, the chip, the offline queue, 401, 409,
// the look, the one-time import, and the G6 switch.
// Run: node --test shared/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../account/api.js';
import { createSession } from '../account/session.js';
import { createSync } from '../account/sync.js';
import { createPrefsSync } from '../account/prefs.js';
import { playerFromMe, cachedPlayer, PLAYER_KEY, playerKey } from '../account/player.js';
import { chipHtml } from '../account/chip.js';
import { offerImport, importKey } from '../account/importer.js';
import { REQUIRE_SIGN_IN, mustSignIn, signInUrl, accountOrigin, ACCOUNT_ORIGIN } from '../account/config.js';
import { startAccount } from '../account/boot.js';
import { forgetPlayer, withoutSignedOut } from '../account/forget.js';
import { gateFor, gateHtml, gateCard, GATE_TEXT } from '../account/gate.js';
import { fakeAccount, memoryStorage, manualTimers, ADULT, KID_A, KID_B, CHILD_A, playingAs } from './fake-account.js';

const ORIGIN = 'https://account.waystead.co.uk';
const HERE = 'https://game.waystead.co.uk/spellbright/#/y34/ch01';

function setup(who = null) {
  const acct = fakeAccount();
  acct.who = who;
  const storage = memoryStorage();
  const api = createApi({ origin: ORIGIN, fetch: acct.fetch });
  return { acct, storage, api, session: createSession({ api, storage, origin: ORIGIN }) };
}

// A doc as the games use: one JSON value, merged as a union of `results` by id.
function doc(storage, key) {
  return {
    read: () => { const v = storage.getItem(key); return v === null ? undefined : JSON.parse(v); },
    write: (v) => storage.setItem(key, JSON.stringify(v)),
    merge: (a, b) => {
      const byId = new Map([...(a.results || []), ...(b.results || [])].map((r) => [r.id, r]));
      return { results: [...byId.values()].sort((x, y) => x.at - y.at) };
    },
  };
}
const add = (storage, key, id, at) => {
  const cur = JSON.parse(storage.getItem(key) || '{"results":[]}');
  storage.setItem(key, JSON.stringify({ results: [...cur.results, { id, at }] }));
};

// ---- who is playing -------------------------------------------------------------

test('signed out: no player, nothing cached, the chip offers sign-in back to this page', async () => {
  const t = setup(null);
  const r = await t.session.refresh();
  assert.equal(r.player, null);
  assert.equal(t.storage.getItem(PLAYER_KEY), null);
  const html = chipHtml(null, ORIGIN, HERE);
  assert.match(html, />Sign in<\/span>/);
  assert.ok(html.includes('href="' + ORIGIN + '/signin?return=' + encodeURIComponent(HERE).replace(/&/g, '&amp;') + '"'));
  assert.equal(playerKey('sb.progress', null), 'sb.progress', 'signed out: today\'s key unchanged');
});

test('an adult, a child, and an adult playing as a child are each the right player', () => {
  assert.deepEqual(playerFromMe(ADULT, ORIGIN), { id: ADULT.id, name: 'Alex Green', avatar: null, kind: 'adult', canSwitch: true });
  assert.deepEqual(playerFromMe(CHILD_A, ORIGIN),
    { id: KID_A.id, name: 'Sam', avatar: ORIGIN + '/avatars/ottie-128.webp', kind: 'child', canSwitch: false });
  assert.deepEqual(playerFromMe(playingAs(KID_B), ORIGIN),
    { id: KID_B.id, name: 'Robin', avatar: ORIGIN + '/avatars/fizz-128.webp', kind: 'child', canSwitch: true });
  assert.equal(playerFromMe({ signedIn: false }, ORIGIN), null);
  assert.equal(playerFromMe({ signedIn: true, kind: 'child', id: 'not-a-uuid', nickname: 'x' }, ORIGIN), null);
  assert.equal(playerFromMe({ ...CHILD_A, avatar: '../../evil' }, ORIGIN).avatar, null, 'only a plain avatar id makes a picture URL');
});

test('only the player id, name and picture URL are kept on the device; no token, email or session id', async () => {
  const t = setup({ ...ADULT, email: 'alex@example.test', sessionToken: 'secret-ish' });
  await t.session.refresh();
  assert.deepEqual(JSON.parse(t.storage.getItem(PLAYER_KEY)), { id: ADULT.id, name: 'Alex Green', avatar: null });
  assert.deepEqual(t.storage.keys(), [PLAYER_KEY]);
  for (const c of t.acct.calls) assert.equal(c.credentials, 'include');
});

test('the chip, signed in: picture and name; Switch player for an adult, never for a child', () => {
  const child = playerFromMe(CHILD_A, ORIGIN);
  const html = chipHtml(child, ORIGIN, HERE);
  assert.match(html, /<img class="playerchip__face" src="https:\/\/account\.waystead\.co\.uk\/avatars\/ottie-128\.webp"/);
  assert.match(html, />Sam</);
  assert.doesNotMatch(html, /Switch player/);
  assert.match(html, /href="https:\/\/account\.waystead\.co\.uk\/child"[^>]*>.*My account/s);
  const kid = chipHtml(playerFromMe(playingAs(KID_B), ORIGIN), ORIGIN, HERE);
  assert.ok(kid.includes('href="' + ORIGIN + '/play?return=' + encodeURIComponent(HERE).replace(/&/g, '&amp;') + '"'), 'Switch player returns here');
  const adult = chipHtml(playerFromMe(ADULT, ORIGIN), ORIGIN, HERE);
  assert.match(adult, /playerchip__initial[^>]*>A</);
  assert.ok(adult.includes('href="' + ORIGIN + '/signout?return=' + encodeURIComponent(HERE).replace(/&/g, '&amp;') + '"'), 'Sign out asks on /signout, then returns here');
  const evil = chipHtml({ id: KID_A.id, name: '<img src=x onerror=alert(1)>', avatar: null }, ORIGIN, HERE);
  assert.doesNotMatch(evil, /<img src=x/);
});

test('a switch of player mid-session is noticed, and the two players\' caches never mix', async () => {
  const t = setup(playingAs(KID_A));
  const seen = [];
  t.session.on((e) => seen.push(e.reason));
  await t.session.refresh();
  const keyA = playerKey('sb.progress', t.session.player.id);
  add(t.storage, keyA, 'a1', 1);
  t.acct.who = playingAs(KID_B); // "Switch player" on /play
  await t.session.refresh();
  assert.deepEqual(seen, ['signin', 'switch']);
  const keyB = playerKey('sb.progress', t.session.player.id);
  assert.notEqual(keyA, keyB);
  assert.equal(t.storage.getItem(keyB), null, 'B starts with nothing of A\'s');
  add(t.storage, keyB, 'b1', 2);
  assert.deepEqual(JSON.parse(t.storage.getItem(keyA)).results.map((r) => r.id), ['a1'], 'A\'s progress is untouched');
});

test('offline at start: the cached player stays; nothing is cleared', async () => {
  const t = setup(CHILD_A);
  await t.session.refresh();
  t.acct.offline = true;
  const again = createSession({ api: t.api, storage: t.storage, origin: ORIGIN });
  assert.equal(again.player.id, KID_A.id, 'drawn from the cache at once');
  const r = await again.refresh();
  assert.equal(r.offline, true);
  assert.equal(again.player.id, KID_A.id);
});

// ---- sync: queue, 401, 409, caps -------------------------------------------------

function syncFor(t, playerId, extra = {}) {
  const timers = manualTimers();
  const key = playerKey('sb.progress', playerId);
  const expired = [];
  const sync = createSync({
    api: t.api, game: 'spellbright', storage: t.storage, playerId, docs: { progress: doc(t.storage, key) },
    onExpired: () => expired.push(1), setTimer: timers.setTimer, clearTimer: timers.clearTimer, ...extra,
  });
  return { sync, timers, key, expired };
}

test('write-through with a debounce: a burst of changes is one request', async () => {
  const t = setup(CHILD_A);
  const s = syncFor(t, KID_A.id);
  for (let i = 0; i < 5; i++) { add(t.storage, s.key, 'r' + i, i + 1); s.sync.changed('progress'); }
  assert.equal(t.acct.calls.filter((c) => c.method === 'PUT').length, 0, 'nothing sent yet');
  await s.timers.run();
  assert.equal(t.acct.calls.filter((c) => c.method === 'PUT').length, 1);
  assert.equal(t.acct.get(KID_A.id, 'spellbright', 'progress').results.length, 5);
  assert.deepEqual(s.sync.pending, []);
});

test('offline: changes wait in the queue (kept on the device), then flush when back online', async () => {
  const t = setup(CHILD_A);
  t.acct.offline = true;
  const s = syncFor(t, KID_A.id);
  add(t.storage, s.key, 'r1', 1);
  s.sync.changed('progress');
  await s.timers.run();
  assert.deepEqual(s.sync.pending, ['progress']);
  // The tab closes; a new page on this device picks the queue up.
  const s2 = syncFor(t, KID_A.id);
  assert.deepEqual(s2.sync.pending, ['progress']);
  t.acct.offline = false;
  await s2.sync.flush(); // 'online' or visibilitychange
  assert.deepEqual(s2.sync.pending, []);
  assert.deepEqual(t.acct.get(KID_A.id, 'spellbright', 'progress').results.map((r) => r.id), ['r1']);
});

test('409: the newer stored copy is fetched and merged, and no result is lost', async () => {
  const t = setup(CHILD_A);
  const s = syncFor(t, KID_A.id);
  add(t.storage, s.key, 'here-1', 1);
  s.sync.changed('progress');
  await s.timers.run();
  // Another device saves meanwhile (version 2), then this one adds a result.
  const there = t.acct.get(KID_A.id, 'spellbright', 'progress');
  t.acct.put(KID_A.id, 'spellbright', 'progress', { results: [...there.results, { id: 'there-1', at: 2 }] });
  add(t.storage, s.key, 'here-2', 3);
  s.sync.changed('progress');
  await s.timers.run();
  assert.deepEqual(t.acct.get(KID_A.id, 'spellbright', 'progress').results.map((r) => r.id), ['here-1', 'there-1', 'here-2']);
  assert.deepEqual(JSON.parse(t.storage.getItem(s.key)).results.map((r) => r.id), ['here-1', 'there-1', 'here-2']);
  assert.ok(t.acct.calls.some((c) => c.method === 'PUT') && s.sync.versions.progress === 3);
});

test('pull: the account copy merges into this device\'s, and what only this device had is sent', async () => {
  const t = setup(CHILD_A);
  t.acct.put(KID_A.id, 'spellbright', 'progress', { results: [{ id: 'there', at: 1 }] });
  const s = syncFor(t, KID_A.id);
  add(t.storage, s.key, 'here', 2);
  const updated = [];
  const s2 = syncFor(t, KID_A.id, { onUpdated: (k) => updated.push(...k) });
  await s2.sync.pull();
  assert.deepEqual(updated, ['progress']);
  assert.deepEqual(t.acct.get(KID_A.id, 'spellbright', 'progress').results.map((r) => r.id), ['there', 'here']);
  void s;
});

test('401 mid-game: the session is dropped to signed out, nothing on the device is lost, and the queue waits', async () => {
  const t = setup(CHILD_A);
  await t.session.refresh();
  const events = [];
  t.session.on((e) => events.push(e.reason));
  const s = syncFor(t, KID_A.id, { onExpired: () => t.session.expired() });
  t.acct.who = null; // the session ended on the server
  add(t.storage, s.key, 'mid-game', 1);
  s.sync.changed('progress');
  await s.timers.run();
  assert.deepEqual(events, ['expired']);
  assert.equal(t.session.player, null);
  assert.equal(t.storage.getItem(PLAYER_KEY), null);
  assert.deepEqual(JSON.parse(t.storage.getItem(s.key)).results.map((r) => r.id), ['mid-game'], 'local state kept');
  assert.deepEqual(s.sync.pending, ['progress'], 'sent when the same player signs in again');
  // Signing in again as the same child: a new page's sync sends it.
  t.acct.who = CHILD_A;
  await syncFor(t, KID_A.id).sync.flush();
  assert.deepEqual(t.acct.get(KID_A.id, 'spellbright', 'progress').results.map((r) => r.id), ['mid-game']);
});

test('a value over the 64 KB cap is never sent: it stays on this device', async () => {
  const t = setup(CHILD_A);
  const s = syncFor(t, KID_A.id);
  t.storage.setItem(s.key, JSON.stringify({ results: [{ id: 'big', at: 1, pad: 'x'.repeat(70000) }] }));
  s.sync.changed('progress');
  await s.timers.run();
  assert.equal(t.acct.calls.filter((c) => c.method === 'PUT').length, 0);
  assert.deepEqual(s.sync.localOnly, ['progress']);
});

test('prepare() trims before sending, so the cap is not reached', async () => {
  const t = setup(CHILD_A);
  const s = syncFor(t, KID_A.id);
  const d = doc(t.storage, s.key);
  const s2 = createSync({
    api: t.api, game: 'spellbright', storage: t.storage, playerId: KID_A.id, setTimer: s.timers.setTimer, clearTimer: s.timers.clearTimer,
    docs: { progress: { ...d, prepare: (v) => ({ results: v.results.slice(-10) }) } },
  });
  t.storage.setItem(s.key, JSON.stringify({ results: Array.from({ length: 3000 }, (_, i) => ({ id: 'r' + i, at: i + 1, pad: 'xxxxxxxxxx' })) }));
  s2.changed('progress');
  await s.timers.run();
  assert.equal(t.acct.get(KID_A.id, 'spellbright', 'progress').results.length, 10);
});

// ---- the look ---------------------------------------------------------------------

test('prefs: a first sign-in saves this device\'s look; later the account\'s look is applied here', async () => {
  const t = setup(CHILD_A);
  t.storage.setItem('sb.theme', 'dark');
  t.storage.setItem('sb.dayStyle', 'paint');
  let applied = 0;
  const p = createPrefsSync({ api: t.api, storage: t.storage, playerId: KID_A.id, applyLook: () => { applied++; } });
  assert.equal(await p.pull(), 'saved');
  assert.deepEqual(t.acct.prefs.get(KID_A.id), { theme: 'dark', dayStyle: 'paint', prefs: { saved: 1, voice: '' } });
  // On another device, with another look: the account's wins, with no change sent.
  const other = memoryStorage();
  other.setItem('sb.theme', 'light');
  const p2 = createPrefsSync({ api: t.api, storage: other, playerId: KID_A.id, applyLook: () => { applied++; } });
  assert.equal(await p2.pull(), 'applied');
  assert.equal(other.getItem('sb.theme'), 'dark');
  assert.equal(other.getItem('sb.dayStyle'), 'paint');
  assert.equal(applied, 1);
});

test('prefs (G8): the voice (sb.voice) is saved with the look and follows the player; a look from before G8 keeps this device\'s voice', async () => {
  const t = setup(CHILD_A);
  t.storage.setItem('sb.voice', 'Serena (Premium)');
  const p = createPrefsSync({ api: t.api, storage: t.storage, playerId: KID_A.id });
  assert.equal(await p.pull(), 'saved');
  assert.equal(t.acct.prefs.get(KID_A.id).prefs.voice, 'Serena (Premium)');
  const other = memoryStorage();
  let applied = 0;
  assert.equal(await createPrefsSync({ api: t.api, storage: other, playerId: KID_A.id, applyLook: () => { applied++; } }).pull(), 'applied');
  assert.equal(other.getItem('sb.voice'), 'Serena (Premium)');
  assert.equal(applied, 1);
  // "Best voice" again: no sb.voice key, and '' on the account.
  t.storage.removeItem('sb.voice');
  assert.equal(await p.push(), 'saved');
  assert.equal(t.acct.prefs.get(KID_A.id).prefs.voice, '');
  assert.equal(await createPrefsSync({ api: t.api, storage: other, playerId: KID_A.id }).pull(), 'applied');
  assert.equal(other.getItem('sb.voice'), null);
  // An account look saved before G8 (no voice): this device's voice stays, and is sent.
  t.acct.prefs.set(KID_A.id, { theme: 'dark', dayStyle: 'paint', prefs: { saved: 1 } });
  other.setItem('sb.voice', 'Daniel');
  assert.equal(await createPrefsSync({ api: t.api, storage: other, playerId: KID_A.id }).pull(), 'saved');
  assert.equal(other.getItem('sb.voice'), 'Daniel');
  assert.equal(t.acct.prefs.get(KID_A.id).prefs.voice, 'Daniel');
});

test('prefs: a change is sent after a pause; offline, it waits; "Match device" is system', async () => {
  const t = setup(CHILD_A);
  const timers = manualTimers();
  const p = createPrefsSync({ api: t.api, storage: t.storage, playerId: KID_A.id, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  t.acct.offline = true;
  p.changed();
  await timers.run();
  assert.equal(p.pending, true);
  t.acct.offline = false;
  await p.flush();
  assert.equal(p.pending, false);
  assert.equal(t.acct.prefs.get(KID_A.id).theme, 'system');
});

// ---- the one-time import ------------------------------------------------------------

function importer(answer) {
  const local = memoryStorage();
  const tab = memoryStorage();
  const asked = [];
  const imported = [];
  const run = (player, more = {}) => offerImport({
    local, tab, player, game: 'spellbright', hasDeviceProgress: () => true,
    ask: async (p) => { asked.push(p.name); return answer; },
    importNow: async (id) => { imported.push(id); },
    ...more,
  });
  return { local, tab, asked, imported, run };
}
const SAM = { id: KID_A.id, name: 'Sam', avatar: ORIGIN + '/avatars/ottie-128.webp' };

test('import, Yes: merged once, marked done, never asked again for that player', async () => {
  const im = importer('yes');
  assert.equal(await im.run(SAM), 'imported');
  assert.equal(await im.run(SAM), 'done');
  assert.deepEqual(im.asked, ['Sam']);
  assert.deepEqual(im.imported, [KID_A.id]);
  assert.equal(im.local.getItem(importKey(KID_A.id, 'spellbright')), 'done');
});

test('import, Not now: not asked again in this tab, asked on a later visit', async () => {
  const im = importer('later');
  assert.equal(await im.run(SAM), 'later');
  assert.equal(await im.run(SAM), 'later');
  assert.deepEqual(im.asked, ['Sam']);
  im.tab.clear(); // a later visit
  await im.run(SAM);
  assert.deepEqual(im.asked, ['Sam', 'Sam']);
  assert.deepEqual(im.imported, []);
});

test('import, Never on this device: asked once only, nothing imported', async () => {
  const im = importer('never');
  assert.equal(await im.run(SAM), 'never');
  im.tab.clear();
  assert.equal(await im.run(SAM), 'never');
  assert.deepEqual(im.asked, ['Sam']);
  assert.deepEqual(im.imported, []);
});

test('import: never asked with nothing to import; never into a player who changed while asking', async () => {
  const im = importer('yes');
  assert.equal(await im.run(SAM, { hasDeviceProgress: () => false }), 'nothing');
  assert.equal(await im.run(SAM, { stillPlayer: () => false }), 'changed');
  assert.deepEqual(im.imported, []);
  assert.equal(await im.run(null), 'nothing');
});

// ---- G6 and config -----------------------------------------------------------------

test('REQUIRE_SIGN_IN is on (G6, 2 Nov 2026); mustSignIn and the sign-in URL', () => {
  assert.equal(REQUIRE_SIGN_IN, true);
  assert.equal(mustSignIn(null), true);
  assert.equal(mustSignIn(null, false), false);
  assert.equal(mustSignIn(SAM), false);
  assert.equal(signInUrl(ORIGIN, HERE), ORIGIN + '/signin?return=' + encodeURIComponent(HERE));
  assert.equal(accountOrigin({ hostname: 'game.waystead.co.uk' }), ACCOUNT_ORIGIN);
  assert.equal(accountOrigin({ hostname: 'localhost' }), 'http://localhost:3000');
});

// ---- the page glue (boot.js) ---------------------------------------------------------

function fakePage(acct, local = memoryStorage()) {
  const handlers = {};
  const on = (target) => (type, fn) => { (handlers[target + type] ||= []).push(fn); };
  const win = { location: { hostname: 'game.waystead.co.uk', href: HERE }, localStorage: local, sessionStorage: memoryStorage(), addEventListener: on('win'), navigator: { onLine: true } };
  win.history = { state: null, replaceState: (_s, _t, url) => { win.location.href = url; } };
  const doc = { visibilityState: 'visible', addEventListener: on('doc') };
  const fire = async (key) => { for (const fn of handlers[key] || []) await fn(); };
  return { win, doc, local, fire };
}

test('boot: the cached player is used before /api/me answers; a switch re-points the store and redraws', async () => {
  const acct = fakeAccount();
  acct.who = playingAs(KID_B);
  const page = fakePage(acct);
  page.local.setItem(PLAYER_KEY, JSON.stringify({ id: KID_A.id, name: 'Sam', avatar: null }));
  const uses = [];
  let redraws = 0;
  const a = startAccount({ win: page.win, doc: page.doc, fetch: acct.fetch, usePlayer: (p) => uses.push(p ? p.id : null), redraw: () => { redraws++; } });
  assert.deepEqual(uses, [KID_A.id], 'the first draw already uses the cached player');
  await a.ready;
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(uses, [KID_A.id, KID_B.id]);
  assert.equal(redraws, 1);
  assert.equal(cachedPlayer(page.local).id, KID_B.id);
});

test('boot: signed out on the server while not playing: back to today\'s keys; while playing: kept until the next visit', async () => {
  for (const playing of [false, true]) {
    const acct = fakeAccount();
    const page = fakePage(acct);
    page.local.setItem(PLAYER_KEY, JSON.stringify({ id: KID_A.id, name: 'Sam', avatar: null }));
    const uses = [];
    const a = startAccount({ win: page.win, doc: page.doc, fetch: acct.fetch, usePlayer: (p) => uses.push(p ? p.id : null), busy: () => playing });
    await a.ready;
    assert.deepEqual(uses, playing ? [KID_A.id] : [KID_A.id, null]);
    assert.equal(cachedPlayer(page.local), null, 'next visit: signed out');
  }
});

test('boot: the look changing sends it to the account', async () => {
  const acct = fakeAccount();
  acct.who = CHILD_A;
  const page = fakePage(acct);
  const a = startAccount({ win: page.win, doc: page.doc, fetch: acct.fetch });
  await a.ready;
  await new Promise((r) => setTimeout(r, 0));
  page.local.setItem('sb.theme', 'light');
  await page.fire('winwa:look');
  await page.fire('docvisibilitychange'); // still visible: a pull
  page.doc.visibilityState = 'hidden';
  await page.fire('docvisibilitychange'); // hidden: flush now
  assert.equal(acct.prefs.get(KID_A.id).theme, 'light');
});

// ---- signing out: ?signedout=1 forgets the player; a 401 keeps everything ----------

const SAM_CACHE = { id: KID_A.id, name: 'Sam', avatar: null };
function samsDevice(local, { queued = [] } = {}) {
  const A = KID_A.id;
  local.setItem(PLAYER_KEY, JSON.stringify(SAM_CACHE));
  for (const k of ['sb.progress:', 'wb.game:', 'wb.setup:', 'wb.stats:']) local.setItem(k + A, '{"sam":1}');
  local.setItem('wa.prefs:' + A, 'dirty');
  local.setItem('wa.import:' + A + ':spellbright', 'done');
  local.setItem('wa.import:' + A + ':wordbright', 'never');
  local.setItem('wa.sync:' + A + ':spellbright', JSON.stringify({ ver: { progress: 3 }, dirty: [], local: {} }));
  local.setItem('wa.sync:' + A + ':wordbright', JSON.stringify({ ver: { stats: 2 }, dirty: queued, local: {} }));
  // Someone else's, and the device's own signed-out progress: never touched.
  local.setItem('sb.progress:' + KID_B.id, '{"robin":1}');
  local.setItem('wa.sync:' + KID_B.id + ':spellbright', '{"ver":{},"dirty":[]}');
  local.setItem('sb.progress', '{"device":1}');
  local.setItem('sb.theme', 'dark');
}
const OTHERS = ['sb.progress', 'sb.progress:' + KID_B.id, 'sb.theme', 'wa.sync:' + KID_B.id + ':spellbright'];

test('?signedout=1 and /api/me signed out: the player\'s copies go, the queue with unsent changes stays, the URL is cleaned', async () => {
  const acct = fakeAccount(); // nobody signed in
  const page = fakePage(acct);
  samsDevice(page.local, { queued: ['stats'] });
  page.win.location.href = 'https://game.waystead.co.uk/wordbright/?board=junior&signedout=1#/new';
  const uses = [];
  const a = startAccount({ win: page.win, doc: page.doc, fetch: acct.fetch, usePlayer: (p) => uses.push(p ? p.id : null), busy: () => true });
  await a.ready;
  const left = page.local.keys().sort();
  assert.deepEqual(left, [...OTHERS, 'wa.sync:' + KID_A.id + ':wordbright', 'wb.stats:' + KID_A.id].sort(),
    'gone: sb.progress, wb.game, wb.setup, wa.prefs, wa.import:*, the empty wa.sync, wa.player');
  assert.equal(page.win.location.href, 'https://game.waystead.co.uk/wordbright/?board=junior#/new');
  assert.deepEqual(uses, [KID_A.id, null], 'back to today\'s keys at once, even on a game screen');
});

test('?signedout=1 with an empty queue: nothing of the player is left at all', () => {
  const local = memoryStorage();
  samsDevice(local);
  const r = forgetPlayer(local, KID_A.id);
  assert.deepEqual(r.kept, []);
  assert.deepEqual(local.keys().sort(), [...OTHERS].sort());
  assert.equal(withoutSignedOut('https://game.waystead.co.uk/?signedout=1'), 'https://game.waystead.co.uk/');
});

test('?signedout=1 but /api/me says someone is signed in: nothing is deleted (the URL is still cleaned)', async () => {
  const acct = fakeAccount();
  acct.who = CHILD_A; // e.g. signed straight back in
  const page = fakePage(acct);
  samsDevice(page.local);
  const before = page.local.keys().sort();
  page.win.location.href = 'https://game.waystead.co.uk/spellbright/?signedout=1';
  const a = startAccount({ win: page.win, doc: page.doc, fetch: acct.fetch });
  await a.ready;
  assert.deepEqual(page.local.keys().sort(), before);
  assert.equal(page.win.location.href, 'https://game.waystead.co.uk/spellbright/');
});

test('?signedout=1 while offline: nothing is deleted and the URL is kept for the next try', async () => {
  const acct = fakeAccount();
  acct.offline = true;
  const page = fakePage(acct);
  samsDevice(page.local);
  const before = page.local.keys().sort();
  page.win.location.href = 'https://game.waystead.co.uk/spellbright/?signedout=1';
  await startAccount({ win: page.win, doc: page.doc, fetch: acct.fetch }).ready;
  assert.deepEqual(page.local.keys().sort(), before);
  assert.match(page.win.location.href, /signedout=1/);
});

test('a plain 401 (an expired session, no ?signedout=1) keeps every copy: only wa.player goes', async () => {
  const acct = fakeAccount(); // the session ended on the server
  const page = fakePage(acct);
  samsDevice(page.local);
  const before = page.local.keys().filter((k) => k !== PLAYER_KEY).sort();
  const a = startAccount({ win: page.win, doc: page.doc, fetch: acct.fetch });
  await a.ready;
  assert.deepEqual(page.local.keys().sort(), before);
});

// ---- G6: login before play ------------------------------------------------------------

test('gateFor: play routes need a player; other pages never; a known player plays even offline', () => {
  const on = { flag: true };
  assert.equal(gateFor({ ...on, play: false, player: null, reach: 'online' }), 'play', 'home and For parents stay open');
  assert.equal(gateFor({ ...on, play: true, player: null, reach: 'online' }), 'signin');
  assert.equal(gateFor({ ...on, play: true, player: SAM, reach: 'offline' }), 'play', 'cached player, offline');
  assert.equal(gateFor({ ...on, play: true, player: null, reach: 'offline' }), 'offline');
  assert.equal(gateFor({ ...on, play: true, player: null, reach: 'unknown' }), 'wait');
  assert.equal(gateFor({ ...on, play: true, player: null, reach: 'online', finishing: true }), 'play', 'finish this game');
  assert.equal(gateFor({ flag: false, play: true, player: null, reach: 'online' }), 'play', 'flag off: as before');
  assert.equal(gateCard('offline', false), 'offline');
  assert.equal(gateCard('offline', true), 'down', 'online but the service is down');
  assert.equal(gateCard('signin', true), 'signin');
});

test('the "Sign in to play" card: the friendly line, and sign-in with a return URL to this game', () => {
  const game = 'https://game.waystead.co.uk/wordbright/#/new?board=junior';
  const html = gateHtml('signin', signInUrl(ORIGIN, game));
  assert.match(html, /<h1>Sign in to play<\/h1>/);
  assert.ok(html.includes(GATE_TEXT.signin.line));
  assert.equal(GATE_TEXT.signin.line, 'Sign in to play — your progress is saved to your account.');
  assert.ok(html.includes('href="' + ORIGIN + '/signin?return=' + encodeURIComponent(game) + '"'));
  assert.doesNotMatch(html, /style=|<script/);
  assert.ok(gateHtml('offline').includes('You need to be online the first time you sign in'));
  assert.match(gateHtml('offline'), /data-gate-retry/);
  assert.match(gateHtml('down'), /data-gate-retry/);
  assert.doesNotMatch(gateHtml('wait'), /btn/);
});

test('session reach: online when /api/me answers (a 401 too: signed out); offline on a network error or a 5xx', async () => {
  for (const [setupFn, reach, player] of [
    [(a) => { a.who = CHILD_A; }, 'online', KID_A.id],
    [() => {}, 'online', null],
    [(a) => { a.meStatus = 401; }, 'online', null],
    [(a) => { a.offline = true; }, 'offline', null],
    [(a) => { a.meStatus = 503; }, 'offline', null],
  ]) {
    const { acct, session } = setup();
    setupFn(acct);
    assert.equal(session.reach, 'unknown');
    await session.refresh();
    assert.equal(session.reach, reach);
    assert.equal(session.player ? session.player.id : null, player);
  }
});

function gatePage({ who = null, cached = false, offline = false, meStatus = 0, onLine = true } = {}) {
  const acct = fakeAccount();
  acct.who = who;
  acct.offline = offline;
  acct.meStatus = meStatus;
  const page = fakePage(acct);
  page.win.navigator.onLine = onLine;
  const A = KID_A.id;
  if (cached) page.local.setItem(PLAYER_KEY, JSON.stringify(SAM_CACHE));
  const state = { path: 'play', redraws: 0, onChange: null };
  const a = startAccount({
    win: page.win, doc: page.doc, fetch: acct.fetch, game: 'wordbright',
    docs: (id) => ({ game: doc(page.local, 'wb.game:' + id) }),
    usePlayer: (p, onChange) => { state.onChange = onChange; },
    busy: () => state.path === 'play', here: () => state.path, redraw: () => { state.redraws++; },
  });
  const queued = () => (JSON.parse(page.local.getItem('wa.sync:' + A + ':wordbright') || '{"dirty":[]}').dirty);
  return { acct, page, a, state, A, queued };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('G6 signed out and online: play routes show "Sign in to play"; the home page and For parents stay open', async () => {
  const { a } = gatePage();
  assert.equal(a.gate('new', true), 'wait', 'before /api/me answers');
  await a.ready;
  assert.equal(a.gate('new', true), 'signin');
  assert.equal(a.gate('play', true), 'signin', 'a deep link into a game too');
  for (const p of ['', 'about', 'rules']) assert.equal(a.gate(p, false), 'play', p);
});

test('G6 signed in: plays straight away from the cached player, before /api/me answers', async () => {
  const { a } = gatePage({ who: CHILD_A, cached: true });
  assert.equal(a.gate('play', true), 'play');
  await a.ready;
  assert.equal(a.gate('new', true), 'play');
});

test('G6 offline with a player cached on this device: they play, and progress waits in the queue', async () => {
  const { a, state, queued, page, A } = gatePage({ who: CHILD_A, cached: true, offline: true, onLine: false });
  await a.ready;
  assert.equal(a.session.reach, 'offline');
  assert.equal(a.gate('play', true), 'play');
  add(page.local, 'wb.game:' + A, 'move-1', 1);
  state.onChange('game');
  await a.sync.flush();
  assert.deepEqual(queued(), ['game'], 'kept for when the device is back online');
});

test('G6 offline with nobody cached: "You need to be online the first time you sign in"; back online, sign-in', async () => {
  const { a, acct, page, state } = gatePage({ offline: true, onLine: false });
  assert.equal(a.gate('new', true), 'offline', 'the device says offline: no wait');
  await a.ready;
  assert.equal(a.gate('new', true), 'offline');
  assert.equal(gateCard(a.gate('new', true), page.win.navigator.onLine), 'offline');
  acct.offline = false;
  page.win.navigator.onLine = true;
  state.path = 'new';
  await page.fire('winonline');
  await tick();
  assert.equal(a.gate('new', true), 'signin');
  assert.equal(state.redraws, 1, 'the card is drawn again');
});

test('G6 the account service down (5xx): like offline; a child already signed in here is not locked out', async () => {
  const kid = gatePage({ who: CHILD_A, cached: true, meStatus: 503 });
  await kid.a.ready;
  assert.equal(kid.a.gate('play', true), 'play');
  assert.equal(cachedPlayer(kid.page.local).id, KID_A.id, 'the cached player is kept');
  const nobody = gatePage({ meStatus: 503 });
  await nobody.a.ready;
  assert.equal(nobody.a.gate('new', true), 'offline');
  assert.equal(gateCard(nobody.a.gate('new', true), true), 'down');
});

test('G6 a 401 mid-game: they finish this game (progress queued), then sign in before the next one', async () => {
  const { a, acct, state, queued, page, A } = gatePage({ who: CHILD_A, cached: true });
  await a.ready;
  await tick();
  acct.who = null; // the session ends on the server
  add(page.local, 'wb.game:' + A, 'move-1', 1);
  state.onChange('game');
  await a.sync.flush(); // answers 401
  assert.equal(a.session.player, null);
  assert.equal(a.gate('play', true), 'play', 'this game goes on');
  add(page.local, 'wb.game:' + A, 'move-2', 2);
  state.onChange('game');
  assert.deepEqual(queued(), ['game'], 'queued for when they sign in again');
  state.path = 'end';
  assert.equal(a.gate('end', false), 'play', 'the final scores');
  state.path = 'new';
  assert.equal(a.gate('new', true), 'signin', 'the next game asks them to sign in');
  state.path = 'play';
  assert.equal(a.gate('play', true), 'signin', 'and the game they left is not open either');
  assert.deepEqual(queued(), ['game'], 'still queued');
});

test('G6 a 401 mid-game in Spellbright: "Play again" on the same page after the game ends asks to sign in', async () => {
  const { a, acct, state, page, A } = gatePage({ who: CHILD_A, cached: true });
  await a.ready;
  await tick();
  acct.who = null;
  add(page.local, 'wb.game:' + A, 'word-1', 1);
  state.onChange('game');
  await a.sync.flush();
  assert.equal(a.gate('play', true), 'play');
  await page.fire('winwa:finished'); // the game's last word is done
  assert.equal(a.gate('play', true), 'signin');
});
