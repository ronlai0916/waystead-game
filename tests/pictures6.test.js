// SB6-WP-8a: U-pictures. The pure parts (pictures-doc.js) and the client's own rules (pictures-data.js) with no account behind them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../site/js/pictures-data.js';
import * as P from '../site/js/pictures-doc.js';

const ORIGIN = 'https://account.example';
const rec = (answer = () => ({ status: 200, body: {} })) => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const a = answer(url, init);
    return { ok: a.status >= 200 && a.status < 300, status: a.status, headers: { get: (k) => (a.headers || {})[k] ?? null }, json: async () => a.body };
  };
  return { calls, fetch };
};

test('U-pictures: the flag ships OFF and nothing is requested', async () => {
  assert.equal(D.PICTURES_API, false);
  const { calls, fetch } = rec();
  const p = D.createPictures({ origin: ORIGIN, fetch });
  assert.equal(p.off, true);
  assert.deepEqual(await p.allowance(), { problem: 'off' });
  assert.deepEqual(await p.ask('friend'), { problem: 'off' });
  assert.deepEqual(await p.states(['friend']), { problem: 'off' });
  assert.equal((await p.approved(['friend'])).problem, 'off');
  assert.equal(p.imageUrl('abcdefgh12345678'), '');
  assert.equal(calls.length, 0);
});

test('U-pictures: askable keeps lower-case [a-z]{2,20}, once each', () => {
  assert.deepEqual(D.askable(['Friend', ' because ', 'friend', 'a', 'x'.repeat(21), 'it\'s', 'a1', '', null, 5, 'ab']), ['friend', 'because', 'ab']);
  assert.deepEqual(D.askable('friend'), []);
  assert.equal(D.askable(Array.from({ length: 40 }, (_, i) => 'w' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26)))).length, 40);
});

test('U-pictures: ask sends only the one checked word; swap only on an explicit true', async () => {
  const { calls, fetch } = rec(() => ({ status: 202, body: { word: 'friend', status: 'making', id: 'abcdefgh12345678' } }));
  const p = D.createPictures({ origin: ORIGIN, fetch, enabled: true });
  await p.ask('  Friend ');
  assert.deepEqual(JSON.parse(calls[0].init.body), { word: 'friend' });
  for (const s of [1, 'true', 'yes', {}, [], 0, undefined, null, false]) await p.ask('friend', { swap: s });
  for (const c of calls) assert.deepEqual(JSON.parse(c.init.body), { word: 'friend' }, 'no swap key');
  await p.ask('friend', { swap: true });
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { word: 'friend', swap: true });
  assert.equal(calls.length, 11);
  const n = calls.length;
  assert.deepEqual(await p.ask('no way'), { problem: 'bad-word' });
  assert.deepEqual(await p.ask('A'), { problem: 'bad-word' });
  assert.equal(calls.length, n, 'a bad word is never sent');
  for (const c of calls) { assert.equal(c.init.credentials, 'include'); assert.equal(c.init.mode, 'cors'); assert.equal(c.init.cache, 'no-store'); assert.equal(c.url, ORIGIN + '/api/pictures'); }
});

test('U-pictures: decide sends swap only for "another" and only on an explicit true; A10 needs { yes: true }', async () => {
  const { calls, fetch } = rec(() => ({ status: 200, body: { word: 'friend', status: 'none', change: 4, credits: 1, rate: 4 } }));
  const p = D.createPictures({ origin: ORIGIN, fetch, enabled: true });
  const id = 'abcdefgh12345678';
  await p.decide(id, 'none', { swap: true });
  await p.decide(id, 'use', { swap: true });
  await p.decide(id, 'another', { swap: 'yes' });
  await p.decide(id, 'another');
  assert.deepEqual(calls.map((c) => JSON.parse(c.init.body)), [{ choice: 'none' }, { choice: 'use' }, { choice: 'another' }, { choice: 'another' }]);
  await p.decide(id, 'another', { swap: true });
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { choice: 'another', swap: true });
  assert.deepEqual(await p.decide('bad id!', 'use'), { problem: 'bad-id' });
  assert.deepEqual(await p.decide(id, 'delete'), { problem: 'bad-choice' });
  const n = calls.length;
  for (const a of [undefined, {}, { yes: 1 }, { yes: 'true' }, { yes: false }]) assert.deepEqual(await p.swap(a), { problem: 'not-confirmed' });
  assert.equal(calls.length, n, 'no swap request without yes');
  assert.deepEqual(await p.swap({ yes: true }), { change: 4, credits: 1, rate: 4 });
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { credits: 1 });
  assert.equal(calls.at(-1).url, ORIGIN + '/api/pictures/swap');
});

test('U-pictures: a child session makes no grown-up call; approved() and imageUrl work', async () => {
  const { calls, fetch } = rec(() => ({ status: 200, body: { items: [{ word: 'friend', id: 'abcdefgh12345678', credits: 9, unlimited: true }] } }));
  for (const child of [true, () => true]) {
    const p = D.createPictures({ origin: ORIGIN, fetch, enabled: true, child });
    const id = 'abcdefgh12345678';
    const all = [p.allowance(), p.ask('friend'), p.ask('friend', { swap: true }), p.swap({ yes: true }), p.states(['friend']), p.decide(id, 'use'), p.decideAll([id]), p.remove('friend'), p.family(), p.redeem('ABCD-EFGH-IJKL')];
    for (const r of await Promise.all(all)) assert.deepEqual(r, { problem: 'playing' });
    assert.equal(calls.length, 0);
    const m = await p.approved(['friend']);
    assert.deepEqual([...m], [['friend', 'abcdefgh12345678']]);
    assert.equal(m.problem, undefined);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, ORIGIN + '/api/pictures/approved?words=friend');
    assert.equal(p.imageUrl(id), ORIGIN + '/api/pictures/image/' + id);
    calls.length = 0;
  }
  let flip = false;
  const p = D.createPictures({ origin: ORIGIN, fetch, enabled: true, child: () => flip });
  assert.notDeepEqual(await p.remove('friend'), { problem: 'playing' });
  flip = true;
  assert.deepEqual(await p.remove('friend'), { problem: 'playing' });
});

test('U-pictures: states, approved and decideAll batch by 15; imageUrl refuses odd ids', async () => {
  const words = Array.from({ length: 33 }, (_, i) => 'wor' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26)));
  const { calls, fetch } = rec((url) => ({ status: 200, body: { items: [] } }));
  const p = D.createPictures({ origin: ORIGIN, fetch, enabled: true });
  await p.states(words);
  await p.approved(words);
  assert.equal(calls.length, 6);
  for (const c of calls) assert.ok(decodeURIComponent(c.url.split('words=')[1]).split(',').length <= 15);
  calls.length = 0;
  const ids = Array.from({ length: 31 }, (_, i) => 'id' + String(i).padStart(8, '0'));
  await p.decideAll(ids);
  assert.deepEqual(calls.map((c) => JSON.parse(c.init.body).ids.length), [15, 15, 1]);
  for (const bad of ['', 'a', '../x', 'abc/def12345', null, 12345678, 'x'.repeat(65)]) assert.equal(p.imageUrl(bad), '', String(bad));
});

test('U-pictures: the 404 rules (feature routes are off; a missing picture or code is not)', async () => {
  const id = 'abcdefgh12345678';
  let status = 404;
  const { fetch } = rec(() => ({ status, body: { error: 'not-found' } }));
  const p1 = D.createPictures({ origin: ORIGIN, fetch, enabled: true });
  assert.deepEqual(await p1.decide(id, 'use'), { problem: 'gone' });
  assert.deepEqual(await p1.remove('friend'), { problem: 'gone' });
  assert.deepEqual(await p1.decideAll([id]), { problem: 'gone' });
  assert.deepEqual(await p1.redeem('ABCD-EFGH-IJKL'), { problem: 'bad-code' });
  assert.equal(p1.off, false);
  assert.deepEqual(await p1.ask('friend'), { problem: 'off' });
  assert.equal(p1.off, true);
  assert.deepEqual(await p1.allowance(), { problem: 'off' });
  const p2 = D.createPictures({ origin: ORIGIN, fetch, enabled: true });
  assert.deepEqual(await p2.allowance(), { problem: 'off' });
  assert.equal(p2.imageUrl(id), '');
});

test('U-pictures: an allowance with on other than true is off; odd values are cleaned', async () => {
  let body = { on: false };
  const { fetch } = rec(() => ({ status: 200, body }));
  const p = D.createPictures({ origin: ORIGIN, fetch, enabled: true });
  assert.deepEqual(await p.allowance(), { problem: 'off' });
  assert.equal(p.off, true);
  body = { on: true, unlimited: false, left: '9', credits: -1, rate: 4.5, trial: { left: 2, until: 'tomorrow' }, plan: { name: 5 }, resets: 'x', paused: 'yes' };
  const q = D.createPictures({ origin: ORIGIN, fetch, enabled: true });
  assert.deepEqual(await q.allowance(), { on: true, unlimited: false, left: 0, credits: 0, rate: 0, trial: null, plan: null, resets: null, paused: false });
  body = { on: true, unlimited: true, left: 3, credits: 2, rate: 4, trial: null, plan: null, resets: null, paused: false };
  assert.equal((await D.createPictures({ origin: ORIGIN, fetch, enabled: true }).allowance()).left, null);
});

test('U-pictures: the time-out is reported and abandons the request', async () => {
  const fetch = (url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));
  const p = D.createPictures({ origin: ORIGIN, fetch, enabled: true, timeoutMs: 20 });
  assert.deepEqual(await p.ask('friend'), { problem: 'timeout' });
});

// ---- pictures-doc.js ----------------------------------------------------------------------------------------------------------
test('U-pictures-doc: wordsToAsk', () => {
  const lists = [{ words: ['Friend', 'because', 'island'] }, { words: ['island', 'lantern', 'cat'] }];
  assert.deepEqual(P.wordsToAsk(lists, () => false, {}), ['friend', 'because', 'island', 'lantern', 'cat']);
  assert.deepEqual(P.wordsToAsk(lists, (w) => w === 'because', new Map([['cat', { status: 'none' }]])), ['friend', 'island', 'lantern']);
  assert.deepEqual(P.wordsToAsk({ a: { words: ['friend'] }, b: { words: ['harbour'] } }, new Set(['friend']), [{ word: 'harbour', status: 'making' }]), []);
  assert.deepEqual(P.wordsToAsk([['cat', 'dog']], ['dog'], {}), ['cat']);
  assert.deepEqual(P.wordsToAsk(null, null, null), []);
});

test('U-pictures-doc: rowState and gridModel', () => {
  const states = [
    { word: 'a1', status: 'making' }, { word: 'b1', status: 'ready', candidate: { id: 'c0000001' } }, { word: 'c1', status: 'approved', approved: { id: 'c0000002' } },
    { word: 'd1', status: 'approved', approved: { id: 'c0000003' }, candidate: { id: 'c0000004' } }, { word: 'e1', status: 'unsuitable' }, { word: 'f1', status: 'failed' }, { word: 'g1', status: 'none' },
  ];
  assert.deepEqual(['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'zz'].map((w) => P.rowState(w, states)), ['making', 'check', 'in-use', 'check', 'unsuitable', 'failed', 'none', 'none']);
  const g = P.gridModel(states);
  assert.deepEqual(g.check, [{ word: 'b1', id: 'c0000001' }, { word: 'd1', id: 'c0000004' }]);
  assert.deepEqual(g.checkIds, ['c0000001', 'c0000004']);
  assert.deepEqual(g.making, ['a1']);
  assert.deepEqual(g.inUse, [{ word: 'c1', id: 'c0000002' }]);
  assert.equal(g.anyMaking, true);
  assert.equal(P.gridModel({}).anyMaking, false);
  assert.equal(P.rowState('b1', { b1: 'ready' }), 'check', 'an object of plain statuses works too');
});

test('U-pictures-doc: allowanceLine (grown-up copy)', () => {
  const base = { on: true, unlimited: false, left: 12, credits: 0, rate: 4, trial: null, plan: { name: 'P', monthly: 15 }, resets: '2026-12-01', paused: false };
  assert.equal(P.allowanceLine({ ...base, unlimited: true, left: null }), 'No limit on word pictures.');
  assert.match(P.UNLIMITED_HELP, /never use story credits/);
  assert.equal(P.allowanceLine(base), '12 word pictures left this month.');
  assert.equal(P.allowanceLine({ ...base, left: 1 }), '1 word picture left this month.');
  assert.equal(P.allowanceLine({ ...base, left: 3, credits: 2 }), '3 word pictures left. You also have 2 story credits.');
  assert.equal(P.allowanceLine({ ...base, left: 3, credits: 1, plan: null }), '3 word pictures left. You also have 1 story credit.');
  assert.equal(P.allowanceLine({ ...base, left: 3, plan: null }), '3 word pictures left.');
  assert.equal(P.allowanceLine({ ...base, left: 0 }), 'No pictures left. Redeem a code, or wait for your plan to start again on 1 December.');
  assert.equal(P.allowanceLine({ ...base, left: 0, plan: null }), 'No pictures left. Redeem a code.');
  assert.equal(P.allowanceLine({ ...base, left: 0, credits: 2 }), 'No pictures left. You have 2 story credits: use 1 for 4 word pictures.');
  assert.match(P.allowanceLine({ ...base, paused: true }), /paused/);
  assert.equal(P.allowanceLine(null), '');
  assert.equal(P.trialLine({ trial: { left: 5, until: '2026-12-24' } }), 'Free trial: 5 word pictures until 24 December.');
  assert.equal(P.trialLine({ trial: null }), '');
  assert.equal(P.planLine({ plan: { name: 'Plus', monthly: 30 } }), 'Plus: 30 pictures a month');
  assert.equal(P.planLine({ plan: null }), 'No plan');
});

test('U-pictures-doc: the swap question uses the account\'s rate, never a fixed number', () => {
  assert.equal(P.swapQuestion(4), 'Use 1 story credit for 4 more word pictures?');
  assert.equal(P.swapQuestion(3), 'Use 1 story credit for 3 more word pictures?');
  assert.equal(P.swapQuestion(1), 'Use 1 story credit for 1 more word picture?');
  for (const bad of [0, -1, 2.5, '4', null, undefined, NaN]) assert.equal(P.swapQuestion(bad), '', String(bad));
  assert.match(P.firstTimeLine, /from the word only/);
  assert.match(P.firstTimeLine, /never send a child.s name or anything a child typed/);
});

test('U-pictures-doc: queueAfterSwap covers the first words in list order', () => {
  assert.deepEqual(P.queueAfterSwap(['aa', 'bb', 'cc', 'dd', 'ee'], 4), { covered: ['aa', 'bb', 'cc', 'dd'], waiting: ['ee'] });
  assert.deepEqual(P.queueAfterSwap(['aa', 'bb'], 4), { covered: ['aa', 'bb'], waiting: [] });
  assert.deepEqual(P.queueAfterSwap(['aa', 'aa', 'bb'], 1), { covered: ['aa'], waiting: ['bb'] });
  assert.deepEqual(P.queueAfterSwap(['aa', 'bb'], 0), { covered: [], waiting: ['aa', 'bb'] });
  assert.deepEqual(P.queueAfterSwap(['aa'], -3), { covered: [], waiting: ['aa'] });
});
