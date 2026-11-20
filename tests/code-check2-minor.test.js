// SB5 CODE-CHECK-2 minor items that are code (m2, m5, m6, m8, m9, m16).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { forgetPlayer } from '../shared/account/forget.js';
import * as L from '../site/js/lists-doc.js';
import * as D from '../site/js/own-data.js';
import { ABOUT } from '../site/js/views.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const store = (init = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()] }; };

test('m2: sign-out removes sb.setTab:<id> and the sessionStorage hand-offs, and only that player\'s', () => {
  const local = store({ 'sb.setTab:p': 'new', 'sb.setTab:q': 'lists', 'sb.role:p': '{}', 'sb.roleAsk:p': '1', 'sb.t3:p': '1', 'sb.st:p': '{}' });
  const session = store({ 'sb.copyList': '{"words":["a"]}', 'sb.setChapter': 'y4c1', 'sb.scanWords': '{}', 'sb.planWords': '[]', 'sb.selection': '[]' });
  const r = forgetPlayer(local, 'p', session);
  for (const k of ['sb.setTab:p', 'sb.role:p', 'sb.roleAsk:p', 'sb.t3:p', 'sb.st:p']) assert.equal(local.m.has(k), false, k);
  assert.equal(local.m.get('sb.setTab:q'), 'lists', 'another player\'s key stays');
  assert.equal(session.m.size, 0, 'every hand-off is gone');
  assert.ok(r.removed.includes('sb.copyList'));
  forgetPlayer(store(), 'p', null); // no session storage: fine
});

test('m2: every sb.<key>:<id> the site writes to localStorage is in forget.js DATA (new keys cannot be missed)', () => {
  const forget = read('shared/account/forget.js');
  const keys = new Set();
  for (const f of readdirSync(new URL('../site/js/', import.meta.url)).filter((n) => n.endsWith('.js'))) {
    for (const m of read('site/js/' + f).matchAll(/['"](sb\.[A-Za-z0-9]+):['"]/g)) keys.add(m[1]);
  }
  assert.ok(keys.size >= 8, [...keys].join());
  for (const k of keys) assert.ok(forget.includes("'" + k + "'"), k + ' is not forgotten at sign-out');
});

test('m5: the banned phrase "Your lists are here" is gone; a typed word offline says what still works (D15)', () => {
  assert.doesNotMatch(L.OFFLINE_LIST, /Your lists are here/);
  for (const f of readdirSync(new URL('../site/js/', import.meta.url)).filter((n) => n.endsWith('.js'))) assert.doesNotMatch(read('site/js/' + f), /Your lists are here/, f);
  assert.match(D.OWN_WORD_OFFLINE, /Ready-made words still work/);
  assert.match(D.OWN_SAVED_OFFLINE, /children see it after you open Word lists again/);
  for (const f of ['own-views.js', 'scan-views.js', 'set-views.js']) assert.match(read('site/js/' + f), /OWN_WORD_OFFLINE/, f);
});

test('m6: About says each day has one job only for a full week, and does not offer scanning as a given', () => {
  const day = ABOUT.sections.find((s) => s[0] === 'How a day goes')[1];
  assert.match(day, /full week gives each day one job/);
  assert.match(day, /shorter week puts more than one job on some days/);
  assert.doesNotMatch(day, /^Each day has one job/);
  const lists = ABOUT.sections.find((s) => s[0] === 'Word lists')[1];
  assert.doesNotMatch(lists, /or scan a paper/);
  assert.match(lists, /If scanning is switched on for you/);
});

test('m8: a failed statements.json fetch is not kept for the session (own-views loadBank)', async () => {
  const OV = await import('../site/js/own-views.js');
  const real = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls += 1; return { ok: false }; };
    assert.deepEqual(await OV.loadBank(), {});
    await new Promise((r) => setTimeout(r, 5));
    globalThis.fetch = async () => { calls += 1; return { ok: true, json: async () => ({ w: { a: ['x'] } }) }; };
    assert.deepEqual(await OV.loadBank(), { a: ['x'] }, 'the second call tries again');
    assert.equal(calls, 2);
  } finally { globalThis.fetch = real; }
});

test('m9 and m16: oneGame with nothing playable says so (no "<game> done"); own-doc comment shows the 400-byte budget', () => {
  const g = read('site/js/games-views.js');
  assert.match(g, /onNone: \(\) => \{/);
  assert.match(g, /if \(!list\.length && onNone\) \{ onNone\(\); return; \}/);
  assert.doesNotMatch(read('site/js/own-doc.js'), /1,600 bytes/);
});
