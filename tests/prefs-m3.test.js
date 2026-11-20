// SB5 M3 (CODE-CHECK-2): a role chosen offline (or before the prefs were read) reaches the account later, and a failed prefs
// read followed by a save never wipes other apps' saved settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const RD = await import('../site/js/role-data.js');
const { createApi } = await import('../site/js/account/api.js');
const { createPrefsSync } = await import('../site/js/account/prefs.js');
const { fakeAccount, memoryStorage, manualTimers, ADULT } = await import('../shared/tests/fake-account.js');
const ORIGIN = 'https://account.example';

function device(acct, storage = memoryStorage(), fetchFn = null) {
  const api = createApi({ origin: ORIGIN, fetch: fetchFn || acct.fetch });
  const timers = manualTimers();
  const prefs = createPrefsSync({ api, storage, playerId: ADULT.id, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  let t = 1000;
  const store = RD.createRoleStore({ storage, playerId: ADULT.id, prefs, now: () => (t += 10) });
  return { api, timers, prefs, store, storage };
}
const acctRole = (acct) => (acct.prefs.get(ADULT.id) || { prefs: {} }).prefs.sbRole;
const newAccount = () => { const a = fakeAccount(); a.who = { ...ADULT }; return a; };
const offlineFetch = async () => { throw new TypeError('offline'); };

test('M3: a role chosen OFFLINE and a closed tab reaches the account on the next load', async () => {
  const acct = newAccount();
  acct.prefs.set(ADULT.id, { theme: 'dark', dayStyle: 'paint', prefs: { saved: 1, voice: '', wbThing: { keep: 1 } } });
  const storage = memoryStorage();
  const off = device(acct, storage, offlineFetch);
  assert.equal(off.store.set('teacher', 'Ms Patel').ok, true);
  await off.timers.run(); // the push fails offline
  assert.equal(acctRole(acct), undefined);
  // next day: a new page, same device storage, online
  const on = device(acct, storage);
  assert.equal(on.store.get().r, 'teacher', 'the device copy is there at first paint');
  await on.prefs.pull();
  assert.deepEqual(acctRole(acct).r, 'teacher');
  assert.equal(acctRole(acct).n, 'Ms Patel');
  assert.deepEqual(acct.prefs.get(ADULT.id).prefs.wbThing, { keep: 1 }, 'the other app\'s extra is kept');
});

test('M3: a device role the account lacks (older build, or lost queue) is sent once the prefs have been read', async () => {
  const acct = newAccount();
  const storage = memoryStorage();
  storage.setItem(RD.ROLE_KEY + ADULT.id, JSON.stringify({ r: 'tutor', n: 'Sam', at: 5000 }));
  const d = device(acct, storage);
  assert.equal(d.store.get().r, 'tutor');
  await d.timers.run();
  assert.equal(acctRole(acct), undefined, 'nothing is sent before the prefs are read (that could wipe other settings)');
  await d.prefs.pull();
  d.store.get(); // the page asks again after the pull (app.js does this on the wa:prefs event)
  await d.timers.run();
  assert.deepEqual(acctRole(acct), { r: 'tutor', n: 'Sam', at: 5000 });
  // a newer account copy is never overwritten by an older device copy
  const acct2 = newAccount();
  acct2.prefs.set(ADULT.id, { theme: 'system', dayStyle: 'garden', prefs: { saved: 1, voice: '', sbRole: { r: 'teacher', at: 9000 } } });
  const storage2 = memoryStorage();
  storage2.setItem(RD.ROLE_KEY + ADULT.id, JSON.stringify({ r: 'tutor', at: 5000 }));
  const d2 = device(acct2, storage2);
  await d2.prefs.pull(); d2.store.get(); await d2.timers.run();
  assert.equal(acctRole(acct2).r, 'teacher');
  assert.equal(d2.store.get().r, 'teacher');
});

test('M3: a FAILED prefs read followed by a save never wipes other apps\' saved settings', async () => {
  const acct = newAccount();
  const saved = { theme: 'dark', dayStyle: 'paint', prefs: { saved: 1, voice: 'Ava', wbThing: { keep: 1 }, other: { a: [1, 2] } } };
  acct.prefs.set(ADULT.id, JSON.parse(JSON.stringify(saved)));
  const storage = memoryStorage();
  storage.setItem('wa.prefs:' + ADULT.id, 'dirty'); // a change waits from an earlier visit
  const d = device(acct, storage);
  acct.failNext = { status: 500, times: 1 };
  assert.equal(await d.prefs.pull(), 'later', 'the read failed: no save');
  d.store.set('parent', 'Mum');
  acct.calls.length = 0;
  await d.timers.run(); // the debounce fires: the read is tried again first
  const puts = acct.calls.filter((c) => /PUT/.test(JSON.stringify(c)));
  assert.ok(puts.length <= 1);
  assert.deepEqual(acct.prefs.get(ADULT.id).prefs.wbThing, { keep: 1 });
  assert.deepEqual(acct.prefs.get(ADULT.id).prefs.other, { a: [1, 2] });
  assert.equal(acctRole(acct).r, 'parent');
  // and while the read keeps failing, no PUT at all is made
  const acct2 = newAccount();
  acct2.prefs.set(ADULT.id, JSON.parse(JSON.stringify(saved)));
  const d2 = device(acct2, memoryStorage());
  acct2.failNext = { status: 500, times: 5 };
  d2.store.set('teacher', 'Ms Patel');
  acct2.calls.length = 0;
  await d2.timers.run();
  assert.equal(acct2.calls.filter((c) => /PUT/.test(JSON.stringify(c))).length, 0, 'no save while the prefs could not be read');
  assert.deepEqual(acct2.prefs.get(ADULT.id), saved, 'the account\'s prefs are exactly as they were');
  acct2.failNext = null;
  await d2.prefs.pull();
  assert.deepEqual(acct2.prefs.get(ADULT.id).prefs.wbThing, { keep: 1 });
  assert.equal(acctRole(acct2).r, 'teacher');
});

test('M3: sign-out forgets the waiting extras, and the synced copies of prefs.js are identical', async () => {
  const { forgetPlayer } = await import('../shared/account/forget.js');
  const s = memoryStorage();
  s.setItem('wa.prefs.mine:p', '{"sbRole":null}'); s.setItem('sb.setTab:p', 'new'); s.setItem('sb.role:p', '{}');
  const r = forgetPlayer(s, 'p');
  for (const k of ['wa.prefs.mine:p', 'sb.setTab:p', 'sb.role:p']) assert.ok(r.removed.includes(k), k);
  const base = readFileSync(new URL('../shared/account/prefs.js', import.meta.url), 'utf8');
  for (const p of ['site/js/account', 'wordbright/site/js/account', 'hub/site/home-assets/js/account', 'compose/site/js/account']) {
    for (const f of ['prefs.js', 'forget.js', 'boot.js']) {
      assert.equal(readFileSync(new URL('../' + p + '/' + f, import.meta.url), 'utf8'), readFileSync(new URL('../shared/account/' + f, import.meta.url), 'utf8'), p + '/' + f);
    }
  }
  assert.ok(base.length > 0);
});
