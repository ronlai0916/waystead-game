// SB5 M2 (CODE-CHECK-2): Set a week with typed words. "Save in" changes never overwrite another list, and
// "Set a week for <next learner>" reuses the Word list the first Set made (no duplicate per learner).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as V from '../site/js/set-views.js';
import * as W from '../site/js/words-doc.js';
import * as Ow from '../site/js/own-doc.js';

async function harness() {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  globalThis.location = { hash: '', origin: 'https://account.example', hostname: 'localhost', search: '' };
  const { fakeAccount } = await import('../shared/tests/fake-account.js');
  const A = await import('../site/js/grownups-data.js');
  const who = await import('../site/js/who.js');
  const S = await import('../site/js/store.js');
  const Dt = await import('../site/js/data.js');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL('../site/' + u, import.meta.url), 'utf8')) });
  try { await Dt.loadData(); } finally { globalThis.fetch = realFetch; }
  const ADULT = '33333333-3333-4333-8333-333333333333';
  const kids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
  const acct = fakeAccount();
  acct.children = (id) => (id === ADULT ? kids.map((c, i) => ({ id: c, nickname: ['Ada', 'Cy'][i], year: 4, avatar: null })) : []);
  acct.who = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', childLimit: 5, plan: 'parent', playingAs: null };
  who.useWho(() => ({ kind: 'adult', id: ADULT, name: 'Sam' }));
  S.usePlayer(ADULT);
  globalThis.fetch = async (u, i) => (String(u).startsWith('data/') ? { ok: true, json: async () => ({ patterns: [] }) } : acct.fetch(u, i));
  V.useSetTools({ api: A.createChildApi({ origin: 'https://account.example', fetch: (u, i) => acct.fetch(u, i) }) });
  const L = {};
  const main = { innerHTML: '', addEventListener: (t, f) => { L[t] = f; }, removeEventListener() {}, querySelector: () => null };
  const click = (act, data = {}) => L.click({ target: { closest: () => ({ dataset: { act, ...data } }) } });
  const wait = () => new Promise((r) => setTimeout(r, 60));
  const lists = () => Object.values(Ow.live(Ow.normalise(W.ownOf(S.readWords()))));
  const words = Dt.allWords().slice(0, 6).map((w) => w.word);
  return { acct, main, L, click, wait, kids, lists, S, words };
}

test('M2: typed words, Set for Ada then "Set a week for Cy" makes ONE Word list, not one per learner', async () => {
  const h = await harness();
  const stop = V.setWeek(h.main, {});
  await h.wait();
  h.click('tab', { tab: 'new' });
  h.click('typeall');
  h.L.input({ target: { dataset: { text: '' }, value: h.words.slice(0, 3).join('\n') } });
  h.click('next');
  await h.wait();
  assert.match(h.main.innerHTML, /Who and when\?/);
  h.L.change({ target: { dataset: { kid: h.kids[0] }, checked: true } });
  h.click('chip', { days: '5' });
  h.click('set');
  await h.wait(); await h.wait();
  assert.match(h.main.innerHTML, /Week set for Ada/);
  assert.equal(h.lists().length, 1, 'one Word list after the first Set');
  const oid = h.lists()[0].id;
  h.click('another');
  assert.match(h.main.innerHTML, /Who and when\?/);
  h.click('set');
  await h.wait(); await h.wait();
  assert.match(h.main.innerHTML, /Week set for Cy/);
  assert.equal(h.lists().length, 1, 'still one Word list after the second learner');
  assert.equal(h.lists()[0].id, oid);
  if (typeof stop === 'function') stop();
});

test('M2: the typed-list id is reset when "Save in" changes, and never holds an existing list id (source guard)', () => {
  const src = readFileSync(new URL('../site/js/set-views.js', import.meta.url), 'utf8');
  assert.match(src, /dataset\.addto !== undefined\) \{ st\.addTo = t\.value; st\.newOid = null;/);
  assert.doesNotMatch(src, /st\.newOid = into \? st\.addTo/, 'an existing list id must never be kept as the new-list id');
  assert.match(src, /st\.src = \{ kind: 'list', id: oid/, 'after the master is saved the page carries on with that list');
});

// ---- m3: a week id that is already used by a DIFFERENT week is never treated as "already set" ----
import * as SD from '../site/js/set-doc.js';
import * as SX from '../site/js/set-data.js';

test('m3: setChange answers id-taken for a different week under the same id, and "unchanged" only for the same week', () => {
  const today = '2026-11-19';
  const made = W.createGroup(W.emptyDoc(), { id: 'a.p12345', name: 'Week one', test: '2026-11-24', words: ['build', 'earth'], today, now: 1 }).doc;
  assert.equal(SD.setChange(made, { gid: 'a.p12345', name: 'Week one', test: '2026-11-24', words: ['Build', 'earth'] }, { today, now: 2 }).doc, made, 'the same week again: a retry, nothing changes');
  assert.deepEqual(SD.setChange(made, { gid: 'a.p12345', name: 'Other', test: '2026-11-24', words: ['fruit'] }, { today, now: 2 }), { error: SD.ID_TAKEN });
  assert.deepEqual(SD.setChange(made, { gid: 'a.p12345', name: 'Week one', test: '2026-11-26', words: ['build', 'earth'] }, { today, now: 2 }), { error: SD.ID_TAKEN });
});

test('m3: setWeek on a colliding id makes a new id, so the child really gets a second week', async () => {
  const h = await harness();
  const day = '2026-11-19';
  const api = (await import('../site/js/grownups-data.js')).createChildApi({ origin: 'https://account.example', fetch: (u, i) => h.acct.fetch(u, i) });
  const gids = { [h.kids[0]]: 'a.p12345' };
  const base = { oid: '', cids: [h.kids[0]], gids, name: 'One', test: '2026-11-24', words: h.words.slice(0, 2), today: day };
  const r1 = await SX.setWeek(api, base);
  assert.equal(r1.results[h.kids[0]].ok, true);
  assert.equal(gids[h.kids[0]], 'a.p12345', 'no collision: the id is kept');
  const r2 = await SX.setWeek(api, { ...base, name: 'Two', words: h.words.slice(2, 4) });
  assert.equal(r2.results[h.kids[0]].ok, true, JSON.stringify(r2));
  assert.notEqual(gids[h.kids[0]], 'a.p12345', 'the colliding id was replaced');
  assert.match(gids[h.kids[0]], /^a\.p[0-9a-f]{5}$/);
  const r3 = await SX.setWeek(api, { ...base, gids: { ...gids, [h.kids[0]]: 'a.p12345' } });
  assert.equal(r3.results[h.kids[0]].ok, true, 'the first week again under its own id is the idempotent retry');
});
