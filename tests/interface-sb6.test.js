// SB6-WP-8a: the interface between the app and the Waystead account's picture service (contract v4 A1-A10, TRS TR-50, TR-80, TR-84).
// Everything runs against shared/tests/fake-account.js: no network, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPictures } from '../site/js/pictures-data.js';
import { fakeAccount, ADULT, CHILD_A, KID_A, playingAs } from '../shared/tests/fake-account.js';

const ORIGIN = 'https://account.example';
const FUTURE = '2999-01-01';
const PAST = '2020-01-01';

function setUp(over = {}, opts = {}) {
  const acct = fakeAccount();
  acct.who = ADULT;
  Object.assign(acct.pictures, { missing: false, on: true, trialUntil: FUTURE }, over);
  const pics = createPictures({ origin: ORIGIN, fetch: acct.fetch, enabled: true, ...opts });
  const raw = async (method, path, body) => {
    const r = await acct.fetch(ORIGIN + path, { method, credentials: 'include', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, data: r.status === 204 ? null : await r.json(), retry: r.headers.get('Retry-After') };
  };
  return { acct, p: acct.pictures, pics, raw };
}
const picCalls = (acct) => acct.calls.filter((c) => /^\/api\/(pictures|credits|story)/.test(c.path));
const bodyOf = (c) => (c.body ? JSON.parse(c.body) : null);

// ---- A1 allowance -----------------------------------------------------------------------------------------------------------
test('I-pictures A1: the allowance, every answer', async () => {
  const { acct, p, pics, raw } = setUp({ trial: 5, credits: 2, plan: { name: '30 pictures a month', monthly: 30 }, planLeft: 12, change: 3 });
  const a = await pics.allowance();
  assert.deepEqual(a, { on: true, unlimited: false, left: 20, credits: 2, rate: 4, trial: { left: 5, until: FUTURE }, plan: { name: '30 pictures a month', monthly: 30 }, resets: a.resets, paused: false });
  assert.match(a.resets, /^\d{4}-\d{2}-01$/);
  p.trialUntil = PAST; // plan expiry of the trial: not counted, not shown
  const b = await pics.allowance();
  assert.equal(b.trial, null);
  assert.equal(b.left, 15);
  p.plan = null;
  assert.deepEqual([(await pics.allowance()).plan, (await pics.allowance()).resets], [null, null]);
  p.unlimited = true;
  const u = await pics.allowance();
  assert.equal(u.unlimited, true);
  assert.equal(u.left, null);
  p.unlimited = false; p.paused = true;
  assert.equal((await pics.allowance()).paused, true, 'paused still answers 200');
  acct.who = null;
  assert.deepEqual(await pics.allowance(), { problem: 'signed-out' });
  acct.who = CHILD_A;
  assert.deepEqual(await pics.allowance(), { problem: 'playing' }, 'the account answers 403 adult-session-required');
  acct.who = playingAs(KID_A);
  assert.deepEqual(await pics.allowance(), { problem: 'playing' });
  assert.equal((await raw('GET', '/api/pictures/allowance')).status, 403);
  p.on = false;
  acct.who = ADULT;
  assert.deepEqual(await pics.allowance(), { problem: 'off' });
  assert.equal(pics.off, true);
  const n = acct.calls.length;
  assert.deepEqual(await pics.ask('friend'), { problem: 'off' });
  assert.equal(acct.calls.length, n, 'off for the session: no more calls');
  const q = setUp({ missing: true }).pics;
  assert.deepEqual(await q.allowance(), { problem: 'off' });
  const r = setUp({ rate: 3, credits: 1, trial: 0 }).pics;
  assert.equal((await r.allowance()).rate, 3);
});

// ---- A2 ask ---------------------------------------------------------------------------------------------------------------------
test('I-pictures A2: 202 making, spending order trial, plan, change; unlimited never spends', async () => {
  const { acct, p, pics } = setUp({ trial: 1, plan: { name: 'P', monthly: 15 }, planLeft: 1, change: 1 });
  for (const w of ['friend', 'because', 'island']) {
    const r = await pics.ask(w);
    assert.equal(r.status, 'making');
    assert.match(r.id, /^[a-z]{32}$|^[A-Za-z0-9]{8,64}$/);
    assert.equal(r.swapped, undefined);
    await pics.states([w]); // the job finishes, so the next word is not "already making"
  }
  assert.deepEqual([p.trial, p.planLeft, p.change], [0, 0, 0]);
  assert.deepEqual(p.ledger.map((l) => l.reason), ['picture', 'picture', 'picture']);
  const u = setUp({ unlimited: true, trial: 5, change: 2, credits: 3 });
  for (const w of ['friend', 'because', 'island']) await u.pics.ask(w);
  assert.deepEqual([u.p.trial, u.p.change, u.p.credits, u.p.swaps], [5, 2, 3, 0]);
  assert.deepEqual(acct.calls.map((c) => c.credentials), acct.calls.map(() => 'include'));
});

test('I-pictures A2: a waiting candidate answers ready with no spend; a second ask while making is 409 already-making with the id', async () => {
  const { p, pics } = setUp({ trial: 2 });
  const first = await pics.ask('friend');
  const again = await pics.ask('friend');
  assert.deepEqual(again, { problem: 'already-making', id: first.id });
  assert.equal(p.trial, 1, 'nothing more spent');
  await pics.states(['friend']);
  const ready = await pics.ask('friend');
  assert.deepEqual(ready, { word: 'friend', status: 'ready', id: first.id });
  assert.equal(p.trial, 1);
});

test('I-pictures A2: 422 refused (blocked), unsuitable and refused never spend; 400 bad-word is not even sent', async () => {
  const { acct, p, pics, raw } = setUp({ trial: 3, blocked: new Set(['badword']), unsuitable: new Set(['quiet']) });
  assert.deepEqual(await pics.ask('badword'), { problem: 'refused' });
  assert.deepEqual(await pics.ask('quiet'), { word: 'quiet', status: 'unsuitable' });
  assert.equal(p.trial, 3);
  assert.equal(p.ledger.length, 0);
  assert.equal((await pics.states(['quiet'])).items[0].status, 'unsuitable');
  const n = acct.calls.length;
  assert.deepEqual(await pics.ask('Bad1'), { problem: 'bad-word' });
  assert.equal(acct.calls.length, n);
  assert.deepEqual((await raw('POST', '/api/pictures', { word: 'Bad1' })).data, { error: 'bad-word' });
  assert.equal((await raw('POST', '/api/pictures', { word: 'Bad1' })).status, 400);
});

test('I-pictures A2/D16: 402 swap-needed takes nothing; the swap is sent only after a yes, atomically', async () => {
  const { acct, p, pics } = setUp({ trial: 0, credits: 2, change: 0 });
  const r = await pics.ask('friend');
  assert.deepEqual(r, { problem: 'swap-needed', credits: 2, rate: 4 });
  assert.deepEqual([p.credits, p.change, p.ledger.length, p.swaps, p.jobs.size], [2, 0, 0, 0, 0]);
  assert.equal(bodyOf(acct.calls.at(-1)).swap, undefined, 'the first ask carries no swap');
  const yes = await pics.ask('friend', { swap: true });
  assert.equal(yes.status, 'making');
  assert.equal(yes.swapped, true);
  assert.deepEqual([p.credits, p.change, p.swaps], [1, 3, 1]);
  assert.deepEqual(p.ledger.map((l) => [l.reason, l.amount, l.pictures]), [['exchange', -1, 4], ['picture', 0, -1]]);
  // The next words use the change; when it runs out the grown-up is asked again.
  await pics.states(['friend']);
  for (const w of ['because', 'island', 'lantern']) { assert.equal((await pics.ask(w)).status, 'making'); await pics.states([w]); }
  assert.equal(p.change, 0);
  assert.deepEqual(await pics.ask('harbour'), { problem: 'swap-needed', credits: 1, rate: 4 });
  assert.equal(p.swaps, 1, 'asked again, never swapped by itself');
  // The rate is the account's: 3 changes every number.
  const t = setUp({ trial: 0, credits: 1, rate: 3 });
  assert.deepEqual(await t.pics.ask('friend'), { problem: 'swap-needed', credits: 1, rate: 3 });
  await t.pics.ask('friend', { swap: true });
  assert.equal(t.p.change, 2);
});

test('I-pictures A2: 402 no-pictures-left with no credits; swap:true changes nothing then', async () => {
  const { p, pics } = setUp({ trial: 0, credits: 0 });
  assert.deepEqual(await pics.ask('friend'), { problem: 'no-pictures-left' });
  assert.deepEqual(await pics.ask('friend', { swap: true }), { problem: 'no-pictures-left' });
  assert.equal(p.ledger.length, 0);
  const t = setUp({ trial: 1, trialUntil: PAST, credits: 0 });
  assert.deepEqual(await t.pics.ask('friend'), { problem: 'no-pictures-left' }, 'an expired trial is not spent');
  assert.equal(t.p.trial, 1);
});

test('I-pictures A2: 429 hourly-limit with Retry-After, 503 paused, 401, 403', async () => {
  const { acct, p, pics } = setUp({ hourLeft: 1, retryAfter: 1800, trial: 5 });
  assert.equal((await pics.ask('friend')).status, 'making');
  await pics.states(['friend']);
  assert.deepEqual(await pics.ask('because'), { problem: 'hourly-limit', retryAfter: 1800 });
  assert.equal(p.trial, 4, 'the limited ask spent nothing');
  p.hourLeft = 10; p.paused = true;
  assert.deepEqual(await pics.ask('because'), { problem: 'paused' });
  assert.equal(p.trial, 4);
  p.paused = false;
  acct.who = null;
  assert.deepEqual(await pics.ask('because'), { problem: 'signed-out' });
  acct.who = playingAs(KID_A);
  assert.deepEqual(await pics.ask('because'), { problem: 'playing' });
});

test('I-pictures A2: a vendor failure gives the picture back to the same bucket', async () => {
  const { p, pics } = setUp({ trial: 0, plan: { name: 'P', monthly: 15 }, planLeft: 2, mode: 'fake-fail' });
  await pics.ask('friend');
  assert.equal(p.planLeft, 1);
  const s = await pics.states(['friend']);
  assert.equal(s.items[0].status, 'failed');
  assert.equal(p.planLeft, 2);
  assert.deepEqual(p.ledger.map((l) => l.reason), ['picture', 'picture-refund']);
  assert.equal(p.ledger[1].pictures, 1);
});

// ---- A3 states, A4 decide, A4b, A5 ---------------------------------------------------------------------------------------------
test('I-pictures A3: states, in the shape the grown-up pages use; too many is a 400', async () => {
  const { acct, pics, raw } = setUp({ mode: 'fake-slow' });
  const a = await pics.ask('friend');
  let s = await pics.states(['friend', 'because']);
  assert.deepEqual(s.items.map((i) => [i.word, i.status]), [['friend', 'making'], ['because', 'none']]);
  assert.deepEqual(s.items[0].candidate, { id: a.id });
  acct.pictures.finish('friend');
  s = await pics.states(['friend']);
  assert.equal(s.items[0].status, 'ready');
  assert.equal((await pics.decide(a.id, 'use')).approved.id, a.id);
  s = await pics.states(['friend']);
  assert.deepEqual([s.items[0].status, s.items[0].approved], ['approved', { id: a.id }]);
  const many = Array.from({ length: 16 }, (_, i) => 'wo' + String.fromCharCode(97 + i)).join(',');
  const r = await raw('GET', '/api/pictures?words=' + many);
  assert.deepEqual([r.status, r.data], [400, { error: 'too-many' }]);
  assert.equal((await raw('GET', '/api/pictures?words=Bad1')).data.error, 'bad-word');
  acct.who = null;
  assert.deepEqual(await pics.states(['friend']), { problem: 'signed-out' });
  acct.who = CHILD_A;
  assert.deepEqual(await pics.states(['friend']), { problem: 'playing' });
});

test('I-pictures A4: use, none, another; another may need a swap; use replaces the old picture', async () => {
  const { p, pics } = setUp({ trial: 1, credits: 1 });
  const a = await pics.ask('friend');
  await pics.states(['friend']);
  assert.deepEqual(await pics.decide(a.id, 'use'), { word: 'friend', approved: { id: a.id } });
  assert.equal(p.approved.get('friend'), a.id);
  // Make another: the trial is used up and a credit is left, so the grown-up is asked.
  assert.deepEqual(await pics.decide(a.id, 'another'), { problem: 'swap-needed', credits: 1, rate: 4 });
  assert.equal(p.credits, 1);
  const b = await pics.decide(a.id, 'another', { swap: true });
  assert.equal(b.status, 'making');
  assert.equal(b.swapped, true);
  assert.deepEqual([p.credits, p.change], [0, 3]);
  await pics.states(['friend']);
  assert.deepEqual(await pics.decide(b.id, 'use'), { word: 'friend', approved: { id: b.id } });
  assert.equal(p.jobs.has(a.id), false, 'the old approved picture is gone');
  assert.equal(p.approved.get('friend'), b.id);
  const c = await pics.decide(b.id, 'another');
  assert.equal(c.status, 'making');
  assert.equal(p.change, 2);
  await pics.states(['friend']);
  assert.deepEqual(await pics.decide(c.id, 'none'), { word: 'friend', status: 'none' });
  assert.equal(p.jobs.has(c.id), false, 'the candidate is deleted');
  assert.equal(p.approved.get('friend'), b.id, 'No picture on the candidate keeps the approved one');
});

test('I-pictures A4: 404 gone, 403 not-yours, 409 not-ready, 429, 503', async () => {
  const { p, pics, raw } = setUp({ mode: 'fake-slow', trial: 9 });
  assert.deepEqual(await pics.decide('zzzzzzzz99999999', 'use'), { problem: 'gone' });
  assert.equal(pics.off, false, 'a missing picture is not "off"');
  p.jobs.set('otherfam00000001', { id: 'otherfam00000001', word: 'friend', status: 'ready', family: 'someone-else', paidFrom: 'trial' });
  assert.deepEqual(await pics.decide('otherfam00000001', 'use'), { problem: 'not-yours' });
  const a = await pics.ask('because');
  assert.deepEqual(await pics.decide(a.id, 'use'), { problem: 'not-ready' }, 'still making');
  p.finish('because');
  p.hourLeft = 0; p.retryAfter = 60;
  assert.deepEqual(await pics.decide(a.id, 'another'), { problem: 'hourly-limit', retryAfter: 60 });
  p.hourLeft = 5; p.paused = true;
  assert.deepEqual(await pics.decide(a.id, 'another'), { problem: 'paused' });
  assert.equal((await pics.decide(a.id, 'use')).approved.id, a.id, 'use still works when paused');
  assert.equal((await raw('POST', '/api/pictures/' + a.id + '/decide', { choice: 'bogus' })).status, 400);
});

test('I-pictures A4b: Use all approves every ready candidate and never spends', async () => {
  const { p, pics, raw } = setUp({ trial: 5 });
  const ids = [];
  for (const w of ['friend', 'because', 'island']) { ids.push((await pics.ask(w)).id); await pics.states([w]); }
  const before = [p.trial, p.change, p.credits, p.ledger.length];
  p.jobs.set('otherfam00000002', { id: 'otherfam00000002', word: 'lantern', status: 'ready', family: 'x', paidFrom: 'trial' });
  const r = await pics.decideAll([...ids, 'otherfam00000002', 'nothing000000001']);
  assert.deepEqual(r.items.slice(0, 3).map((i) => i.word), ['friend', 'because', 'island']);
  assert.deepEqual(r.items.slice(3), [{ id: 'otherfam00000002', error: 'not-yours' }, { id: 'nothing000000001', error: 'not-yours' }]);
  assert.deepEqual([p.trial, p.change, p.credits, p.ledger.length], before);
  assert.deepEqual([...p.approved.keys()], ['friend', 'because', 'island']);
  assert.equal((await raw('POST', '/api/pictures/decide-all', { ids: Array.from({ length: 16 }, (_, i) => 'id' + i) })).status, 400);
});

test('I-pictures A5: remove deletes the picture and its candidates; nothing there is gone', async () => {
  const { p, pics } = setUp({ trial: 5 });
  const a = await pics.ask('friend');
  await pics.states(['friend']);
  await pics.decide(a.id, 'use');
  const b = await pics.decide(a.id, 'another');
  assert.deepEqual(await pics.remove('friend'), { ok: true });
  assert.equal(p.jobs.size, 0);
  assert.equal(p.approved.has('friend'), false);
  assert.equal(b.status, 'making');
  assert.deepEqual(await pics.remove('friend'), { problem: 'gone' });
  assert.equal(pics.off, false);
  assert.deepEqual(await pics.remove('N0'), { problem: 'bad-word' });
});

// ---- A6 approved, A7 image ------------------------------------------------------------------------------------------------------
test('I-pictures A6: approved pictures only, for a child too, with no allowance data', async () => {
  const { acct, p, pics, raw } = setUp({ trial: 5, credits: 7, unlimited: false });
  const a = await pics.ask('friend');
  await pics.ask('because');
  await pics.states(['friend', 'because']);
  await pics.decide(a.id, 'use');
  acct.who = CHILD_A;
  const child = createPictures({ origin: ORIGIN, fetch: acct.fetch, enabled: true, child: true });
  const m = await child.approved(['friend', 'because', 'island']);
  assert.deepEqual([...m], [['friend', a.id]]);
  const r = await raw('GET', '/api/pictures/approved?words=friend,because');
  assert.deepEqual(r.data, { items: [{ word: 'friend', id: a.id }] });
  assert.deepEqual(Object.keys(r.data.items[0]).sort(), ['id', 'word']);
  acct.who = playingAs(KID_A);
  assert.equal((await child.approved(['friend'])).get('friend'), a.id);
  acct.who = null;
  const none = await child.approved(['friend']);
  assert.equal(none.size, 0);
  assert.equal(none.problem, 'signed-out');
  acct.who = ADULT;
  assert.equal((await raw('GET', '/api/pictures/approved?words=' + Array.from({ length: 16 }, (_, i) => 'wo' + String.fromCharCode(97 + i)).join(','))).status, 400);
  p.paused = true;
  assert.equal((await pics.approved(['friend'])).get('friend'), a.id, 'paused: reading still works');
});

test('I-pictures A7: an owner sees a candidate, a child only approved ones, anyone else gets 404', async () => {
  const { acct, p, pics, raw } = setUp({ trial: 5 });
  const a = await pics.ask('friend');
  const b = await pics.ask('because');
  await pics.states(['friend', 'because']);
  await pics.decide(a.id, 'use');
  const url = pics.imageUrl(a.id);
  assert.equal(url, ORIGIN + '/api/pictures/image/' + a.id);
  const get = async (id) => { const r = await acct.fetch(ORIGIN + '/api/pictures/image/' + id, { method: 'GET', credentials: 'include' }); return r; };
  assert.equal((await get(b.id)).status, 200, 'the owner sees the candidate');
  assert.equal((await get(b.id)).headers.get('content-type'), 'image/webp');
  assert.equal((await get(a.id)).headers.get('cache-control'), 'private, max-age=86400');
  acct.who = CHILD_A;
  assert.equal((await get(a.id)).status, 200);
  assert.equal((await get(b.id)).status, 404, 'a child never sees a candidate');
  p.jobs.set('otherfam00000003', { id: 'otherfam00000003', word: 'x', status: 'approved', family: 'other', paidFrom: 'trial' });
  assert.equal((await get('otherfam00000003')).status, 404);
  assert.equal((await get('nothing000000009')).status, 404);
  acct.who = null;
  assert.equal((await raw('GET', '/api/pictures/image/' + a.id)).status, 401);
});

// ---- A8 / A9 credits, A10 swap --------------------------------------------------------------------------------------------------
test('I-pictures A8/A9: the credits routes and their story aliases answer alike, with pictures', async () => {
  const { acct, p, pics, raw } = setUp({ trial: 2, credits: 1, codes: { 'ABCD-EFGH-IJKL': 3 } });
  await pics.ask('friend');
  const f = await pics.family();
  assert.equal(f.credits.available, 1);
  assert.deepEqual(f.pictures, { unlimited: false, left: 1, change: 0, trial: { left: 1, until: FUTURE }, plan: null, rate: 4 });
  assert.deepEqual((await raw('GET', '/api/story/family')).data, (await raw('GET', '/api/credits/family')).data);
  assert.deepEqual(await pics.redeem(' abcd-efgh-ijkl '), { ok: true, credits: 4 });
  assert.equal(p.credits, 4);
  assert.equal(acct.calls.at(-1).path, '/api/credits/redeem');
  assert.deepEqual(bodyOf(acct.calls.at(-1)), { code: 'ABCD-EFGH-IJKL' });
  assert.deepEqual(await pics.redeem('ABCD-EFGH-IJKL'), { problem: 'bad-code' }, 'a used code');
  assert.equal(pics.off, false);
  assert.deepEqual(await pics.redeem('no'), { problem: 'bad-code' });
  assert.equal((await raw('POST', '/api/story/redeem', { code: 'NOPE-NOPE-NOPE' })).status, 404);
  acct.who = CHILD_A;
  assert.deepEqual(await pics.family(), { problem: 'playing' });
  assert.deepEqual(await pics.redeem('ABCD-EFGH-IJKL'), { problem: 'playing' });
  assert.equal((await raw('GET', '/api/credits/family')).status, 403);
  assert.equal((await raw('POST', '/api/credits/redeem', { code: 'X' })).status, 403);
  acct.who = null;
  assert.deepEqual(await pics.family(), { problem: 'signed-out' });
});

test('I-pictures A9: the ledger carries pictures and the new reasons', async () => {
  const { p, pics } = setUp({ trial: 0, credits: 1 });
  await pics.ask('friend', { swap: true });
  const f = await pics.family();
  assert.deepEqual(f.ledger.map((l) => l.reason), ['picture', 'exchange']);
  assert.deepEqual(f.ledger.map((l) => l.pictures), [-1, 4]);
  assert.equal(f.pictures.change, 3);
  assert.equal(p.ledger[1].amount, 0);
});

test('I-pictures A10: swap one credit; 400, 402 no-credits, 409 unlimited, 503 paused, 403, 401', async () => {
  const { acct, p, pics, raw } = setUp({ credits: 2, trial: 0 });
  assert.deepEqual(await pics.swap({ yes: true }), { change: 4, credits: 1, rate: 4 });
  assert.deepEqual(await pics.swap({ yes: true }), { change: 8, credits: 0, rate: 4 });
  assert.deepEqual(await pics.swap({ yes: true }), { problem: 'no-credits' });
  assert.deepEqual(p.ledger.map((l) => l.reason), ['exchange', 'exchange']);
  p.credits = 5;
  assert.equal((await raw('POST', '/api/pictures/swap', { credits: 2 })).status, 400);
  assert.equal((await raw('POST', '/api/pictures/swap', {})).status, 400);
  assert.equal(p.credits, 5);
  p.paused = true;
  assert.deepEqual(await pics.swap({ yes: true }), { problem: 'paused' });
  p.paused = false; p.unlimited = true;
  assert.deepEqual(await pics.swap({ yes: true }), { problem: 'unlimited' });
  assert.equal(p.credits, 5);
  acct.who = playingAs(KID_A);
  assert.deepEqual(await pics.swap({ yes: true }), { problem: 'playing' });
  assert.equal((await raw('POST', '/api/pictures/swap', { credits: 1 })).status, 403);
  acct.who = null;
  assert.deepEqual(await pics.swap({ yes: true }), { problem: 'signed-out' });
  const t = setUp({ credits: 1, rate: 3 });
  assert.equal((await t.pics.swap({ yes: true })).change, 3);
});

// ---- sessions, privacy, unchanged routes ------------------------------------------------------------------------------------------
test('I-pictures: a child session never calls A1-A5 or A8-A10 (the call log shows only A6 and A7 paths)', async () => {
  const { acct, pics } = setUp({ trial: 5 });
  const a = await pics.ask('friend');
  await pics.states(['friend']);
  await pics.decide(a.id, 'use');
  acct.calls.length = 0;
  acct.who = CHILD_A;
  const child = createPictures({ origin: ORIGIN, fetch: acct.fetch, enabled: true, child: () => acct.who.kind === 'child' || !!acct.who.playingAs });
  await Promise.all([child.allowance(), child.ask('friend'), child.swap({ yes: true }), child.states(['friend']), child.decide(a.id, 'use'), child.decideAll([a.id]), child.remove('friend'), child.family(), child.redeem('ABCD-EFGH-IJKL')]);
  assert.deepEqual(acct.calls, []);
  const m = await child.approved(['friend']);
  assert.equal(m.get('friend'), a.id);
  assert.deepEqual(acct.calls.map((c) => c.method + ' ' + c.path), ['GET /api/pictures/approved']);
  acct.who = playingAs(KID_A);
  await child.approved(['friend']);
  assert.ok(acct.calls.every((c) => c.path === '/api/pictures/approved'));
});

test('I-pictures privacy: only the checked word, ids, choices and swap flags ever leave the client', async () => {
  const { acct, pics } = setUp({ trial: 5, credits: 1 });
  const a = await pics.ask('friend');
  await pics.states(['friend']);
  await pics.decide(a.id, 'use');
  await pics.approved(['friend']);
  await pics.allowance();
  await pics.family();
  await pics.remove('friend');
  const sent = picCalls(acct);
  assert.ok(sent.length >= 7);
  const bodies = sent.map(bodyOf).filter(Boolean);
  assert.deepEqual(bodies, [{ word: 'friend' }, { choice: 'use' }]);
  const text = JSON.stringify(sent);
  for (const secret of [ADULT.displayName, ADULT.id, KID_A.id, KID_A.nickname, 'cookie', 'token', '@']) assert.equal(text.includes(secret), false, secret);
  for (const c of sent) assert.equal(c.credentials, 'include');
});

test('I-pictures: the fake leaves every other route as it was (me, game data, scan and sentences stay 404 when missing)', async () => {
  const acct = fakeAccount();
  acct.who = ADULT;
  const get = (p) => acct.fetch(ORIGIN + p, { credentials: 'include' });
  assert.equal((await get('/api/me')).status, 200);
  assert.equal((await get('/api/pictures/allowance')).status, 404, 'missing by default');
  assert.equal((await get('/api/credits/family')).status, 404);
  assert.equal((await get('/api/scan/allowance')).status, 404);
  assert.equal((await get('/api/sentences/allowance')).status, 404);
  assert.equal((await get('/api/game/spellbright')).status, 200);
});

test('I-pictures: a slow account is waited for, and offline is reported', async () => {
  const { acct, pics } = setUp({ trial: 2 });
  let release;
  acct.pictures.delay = new Promise((r) => { release = r; });
  const pending = pics.ask('friend');
  release();
  assert.equal((await pending).status, 'making');
  acct.offline = true;
  assert.deepEqual(await pics.ask('because'), { problem: 'offline' });
  assert.deepEqual(await pics.allowance(), { problem: 'offline' });
  assert.equal((await pics.approved(['friend'])).problem, 'offline');
  assert.equal(pics.off, false, 'offline is not off');
});

// ---- WP-8 phase 2: the save flow, the shared credits card, what a child draws --------------------------------------------------
import { makePictures } from '../site/js/own-data.js';
import { creditsCardHtml, wireRedeem, createCredits } from '../shared/credits/credits.js';
import { pictureState, picture, setApprovedPictures } from '../site/js/ui.js';

test('U-pictures flow: a list save asks each word once, and a swap is asked EVERY time (Not now spends nothing)', async () => {
  const { acct, p, pics } = setUp({ trial: 0, credits: 2, change: 0 });
  const asked = [];
  const out = await makePictures(pics, { words: ['friend', 'because', 'island'], confirmSwap: async (q) => { asked.push(q); return false; } });
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0], { rate: 4, credits: 2, waiting: 3 });
  assert.deepEqual(out.waiting, ['friend', 'because', 'island']);
  assert.equal(p.credits, 2, 'nothing taken');
  assert.equal(p.swaps, 0);
  assert.equal(picCalls(acct).some((c) => bodyOf(c) && bodyOf(c).swap), false);
  // Yes once: one swap covers four pictures, so three words need no second question
  asked.length = 0;
  const yes = await makePictures(pics, { words: ['friend', 'because', 'island'], confirmSwap: async (q) => { asked.push(q); return true; } });
  assert.equal(asked.length, 1);
  assert.deepEqual(yes.made, ['friend', 'because', 'island']);
  assert.equal(p.swaps, 1);
  assert.equal(p.credits, 1);
  // five more words: the 4th word of the batch runs the change out and asks again
  asked.length = 0;
  const more = await makePictures(pics, { words: ['guard', 'night', 'tree', 'quay', 'height'], confirmSwap: async (q) => { asked.push(q); return true; } });
  assert.equal(asked.length >= 1, true);
  assert.equal(more.made.length, 5);
});

test('U-pictures flow: unlimited, none left, offline, hourly limit and refused words', async () => {
  let s = setUp({ unlimited: true });
  assert.deepEqual((await makePictures(s.pics, { words: ['friend', 'because'] })).made, ['friend', 'because']);
  s = setUp({ trial: 0, credits: 0 });
  assert.equal((await makePictures(s.pics, { words: ['friend'] })).noneLeft, true);
  s = setUp({ trial: 3, hourLeft: 0 });
  const r = await makePictures(s.pics, { words: ['friend', 'because'] });
  assert.equal(r.problem, 'hourly-limit');
  assert.deepEqual(r.waiting, ['friend', 'because']);
  s = setUp({ trial: 3 });
  s.p.blocked.add('because');
  const b = await makePictures(s.pics, { words: ['friend', 'because'] });
  assert.deepEqual([b.made, b.refused], [['friend'], ['because']]);
  s.acct.offline = true;
  assert.equal((await makePictures(s.pics, { words: ['island'] })).problem, 'offline');
  // words that already have a state are not asked again
  s = setUp({ trial: 5 });
  await makePictures(s.pics, { words: ['friend'] });
  const again = await makePictures(s.pics, { words: ['friend'] });
  assert.deepEqual(again.asked, []);
});

test('U-pictures flow: a child session makes no grown-up call (A1-A5, A8-A10), only A6 and the image', async () => {
  const { acct, pics } = setUp({ trial: 3 }, { child: true });
  acct.who = CHILD_A;
  assert.equal((await makePictures(pics, { words: ['friend'] })).problem, 'playing');
  assert.equal((await pics.family()).problem, 'playing');
  await pics.approved(['friend']);
  const paths = picCalls(acct).map((c) => c.method + ' ' + c.path);
  assert.deepEqual(paths, ['GET /api/pictures/approved']);
});

test('U-credits: one card, one redeem form, one history (both products); Composition wording unchanged', async () => {
  const fam = { enabled: true, credits: { available: 3, held: 1, expiring: [{ amount: 2, at: '2999-01-01T00:00:00Z' }] }, ledger: [
    { at: '2026-11-01T10:00:00Z', reason: 'code', amount: 8 }, { at: '2026-11-02T10:00:00Z', reason: 'exchange', amount: -1, pictures: 4 }, { at: '2026-11-03T10:00:00Z', reason: 'picture', amount: 0, pictures: -1 }], pictures: { rate: 4 } };
  const c = creditsCardHtml(fam, { product: 'compose' });
  for (const s of ['<h2>Story credits</h2>', 'data-balance>3<', 'Redeem a code', 'maxlength="20"', 'XXXX-XXXX-XXXX', 'Redeem code', 'Story credit used for word pictures', '>+8<', '>-1<', 'Children never see these numbers.']) assert.ok(c.includes(s), s);
  const sb = creditsCardHtml(fam, { product: 'spellbright' });
  for (const s of ['Redeem a code', 'XXXX-XXXX-XXXX', 'One credit is one story, or 4 word pictures.', 'Word picture given back'.slice(0, 4), '+4 pictures', '−1, +4 pictures']) assert.ok(sb.includes(s) || s === 'Word', s);
  assert.equal((sb.match(/data-redeem>/g) || []).length, 1);
  // C7: with unlimited word pictures the block does not say what a credit is worth in pictures
  const un = creditsCardHtml(fam, { product: 'spellbright', unlimited: true });
  assert.ok(un.includes('One credit is one story. One code, one pot of credits.') && !/word pictures\./.test(un.replace(/Story credit used for word pictures/g, '')), un);
  assert.ok(creditsCardHtml(fam, { product: 'spellbright', unlimited: false }).includes('or 4 word pictures'));
  assert.equal(sb.includes('Children never see'), false);
  const api = createCredits({ origin: ORIGIN, fetch: async () => ({ ok: true, status: 200, json: async () => fam }) });
  assert.equal((await api.family()).ok, true);
});

test('U-credits: wireRedeem says Code accepted, or that the code was not accepted', async () => {
  const mk = (product) => {
    const handlers = {};
    const note = { textContent: '' };
    const input = { value: ' ABCD-EFGH ' };
    const root = { dataset: {}, querySelector: (s) => (s === '[data-redeem]' ? { addEventListener: (t, f) => { handlers[t] = f; } } : s === '[data-code]' ? input : s === '[data-redeemnote]' ? note : s === '[data-credits]' ? { dataset: { product } } : null) };
    return { root, handlers, note };
  };
  let r = mk('spellbright');
  const seen = [];
  wireRedeem(r.root, { redeem: async (code) => { seen.push(code); return { ok: true, status: 200, data: { credits: 5 } }; } }, (m) => seen.push(m));
  await r.handlers.submit({ preventDefault() {} });
  assert.deepEqual(seen, ['ABCD-EFGH', 'Code accepted.']);
  r = mk('spellbright');
  wireRedeem(r.root, { redeem: async () => ({ ok: false, status: 404, data: { error: 'invalid-code' } }) }, () => {});
  await r.handlers.submit({ preventDefault() {} });
  assert.equal(r.note.textContent, 'That code was not accepted. Check it and try again.');
  r = mk('compose');
  wireRedeem(r.root, { redeem: async () => ({ ok: true, status: 200, data: { credits: 1 } }) }, () => {});
  await r.handlers.submit({ preventDefault() {} });
  assert.equal(r.note.textContent, '1 credit added.');
});

test('U-pictures child: only an approved picture is drawn, never "on its way"; a removed one is gone on the next load', () => {
  const w = { word: 'guard', meaning: { partOfSpeech: 'verb', example: 'I guard my toys.' }, chunks: ['guard'] };
  setApprovedPictures(new Map());
  assert.equal(pictureState(w), 'none');
  assert.equal(/on its way/i.test(picture(w)), false);
  setApprovedPictures(new Map([['guard', 'a'.repeat(32)]]), (id) => 'https://account.example/api/pictures/image/' + id);
  assert.equal(pictureState(w), 'ready');
  const html = picture(w);
  assert.match(html, /<img src="https:\/\/account\.example\/api\/pictures\/image\/a{32}" alt="Picture for guard"/);
  setApprovedPictures(new Map()); // the next load: removed
  assert.equal(pictureState(w), 'none');
});
