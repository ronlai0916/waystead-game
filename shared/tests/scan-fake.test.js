// The fake account's /api/scan/* routes (SB4): every branch, in the order the real endpoint will use.
// Run: node --test shared/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeAccount, ADULT, CHILD_A, KID_A, playingAs } from './fake-account.js';

const ORIGIN = 'https://account.waystead.co.uk';
const mk = (who, over = {}) => {
  const a = fakeAccount();
  a.who = who;
  Object.assign(a.scan, { missing: false, on: true }, over);
  return a;
};
const get = (a, p) => a.fetch(ORIGIN + p, { credentials: 'include' });
const post = (a, p, body, type = 'application/json') => a.fetch(ORIGIN + p, { method: 'POST', credentials: 'include', headers: { 'Content-Type': type }, body });
const words = (a, bytes = Buffer.alloc(10, 1), type = 'image/jpeg') => post(a, '/api/scan/words', bytes, type);
const consented = (over) => mk(ADULT, { consent: { at: 'x', version: 'v1' }, ...over });

test('missing (the default): every scan route is a 404', async () => {
  const a = fakeAccount();
  a.who = ADULT;
  for (const r of [await get(a, '/api/scan/allowance'), await post(a, '/api/scan/consent', '{"version":"v1"}'), await words(a)]) {
    assert.equal(r.status, 404);
    assert.deepEqual(await r.json(), { error: 'not-found' });
  }
});

test('allowance: the numbers, the first of next month, the vendor', async () => {
  const a = mk(ADULT);
  const r = await get(a, '/api/scan/allowance');
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.deepEqual({ ...b, resetsOn: 0 }, { on: true, left: 20, limit: 20, hourLeft: 5, resetsOn: 0, paused: false, consent: null, consentVersion: 'v1', vendor: 'Test vendor' });
  assert.match(b.resetsOn, /^\d{4}-\d{2}-01$/);
  const now = new Date();
  assert.ok(new Date(b.resetsOn + 'T00:00:00Z') > now);
});

test('consent: stores the version and shows in the allowance', async () => {
  const a = mk(ADULT);
  const r = await post(a, '/api/scan/consent', JSON.stringify({ version: 'v1' }));
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.consent.version, 'v1');
  assert.ok(b.consent.at);
  assert.equal((await (await get(a, '/api/scan/allowance')).json()).consent.version, 'v1');
});

test('words: signed out 401; a child, or an adult playing as one, 403', async () => {
  assert.equal((await words(mk(null))).status, 401);
  for (const who of [CHILD_A, playingAs(KID_A)]) {
    const r = await words(mk(who));
    assert.equal(r.status, 403);
    assert.deepEqual(await r.json(), { error: 'adult-session-required' });
  }
});

test('words: off 404, paused 503, consent 412 (none, or another version)', async () => {
  assert.equal((await words(consented({ on: false }))).status, 404);
  const p = await words(consented({ paused: true }));
  assert.equal(p.status, 503);
  assert.deepEqual(await p.json(), { error: 'scan-paused' });
  for (const consent of [null, { at: 'x', version: 'v0' }]) {
    const r = await words(mk(ADULT, { consent }));
    assert.equal(r.status, 412);
    assert.deepEqual(await r.json(), { error: 'consent-required', version: 'v1' });
  }
});

test('words: not a JPEG 415, over 2 MB 413 (exactly 2,097,152 is fine)', async () => {
  const t = await words(consented(), Buffer.alloc(5), 'image/png');
  assert.equal(t.status, 415);
  assert.deepEqual(await t.json(), { error: 'bad-image' });
  const big = await words(consented(), Buffer.alloc(2097153), 'image/jpeg');
  assert.equal(big.status, 413);
  assert.deepEqual(await big.json(), { error: 'image-too-large' });
  assert.equal((await words(consented(), Buffer.alloc(2097152))).status, 200);
});

test('words: the hourly limit 429 with Retry-After, then the monthly one', async () => {
  const h = await words(consented({ hourLeft: 0 }));
  assert.equal(h.status, 429);
  assert.deepEqual(await h.json(), { error: 'hourly-limit' });
  assert.ok(h.headers.get('Retry-After'));
  const m = await words(consented({ left: 0 }));
  assert.equal(m.status, 429);
  const b = await m.json();
  assert.equal(b.error, 'monthly-limit');
  assert.match(b.resetsOn, /^\d{4}-\d{2}-01$/);
});

test('words: a scan counts one, answers the words, and the picture is never kept', async () => {
  const a = consented();
  const r = await words(a, Buffer.alloc(100, 7));
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.deepEqual(b.words, ['friend', 'because', 'island']);
  assert.equal(b.left, 19);
  assert.equal(a.scan.hourLeft, 4);
  const call = a.calls.at(-1);
  assert.deepEqual(call, { method: 'POST', path: '/api/scan/words', credentials: 'include', bytes: 100, type: 'image/jpeg' });
  assert.ok(!('body' in call));
});

test('words: reply() sets the answer; a string body is text; limits still count', async () => {
  const a = consented({ reply: (bytes, type) => ({ status: 200, body: { words: [String(bytes.length), type], left: 1 } }) });
  assert.deepEqual((await (await words(a, Buffer.alloc(3))).json()).words, ['3', 'image/jpeg']);
  assert.equal(a.scan.left, 19);
  const t = consented({ reply: () => ({ status: 502, body: '<html>Bad gateway</html>' }) });
  const r = await words(t);
  assert.equal(r.status, 502);
  assert.equal(await r.text(), '<html>Bad gateway</html>');
});
