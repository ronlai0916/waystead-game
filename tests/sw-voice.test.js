// G8c: both games' service workers keep the Waystead voice's MP3s in a
// "voice" cache: cache-first, at most 1,500 files (oldest out first), only a
// 200 audio answer; every other account call goes to the network untouched.
// The worker scripts run here in a sandbox with a fake Cache Storage and fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WORKERS = { spellbright: '../site/sw.js', wordbright: '../wordbright/site/sw.js' };
const ACCOUNT = 'https://account.waystead.co.uk';

function sandbox(file, answer = () => new Response('mp3', { status: 200, headers: { 'content-type': 'audio/mpeg' } })) {
  const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
  const handlers = {};
  const stores = new Map();
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const m = stores.get(name);
      return {
        async match(k) { const r = m.get(typeof k === 'string' ? k : k.url); return r ? r.clone() : undefined; },
        async put(k, r) { m.set(typeof k === 'string' ? k : k.url, r); },
        async keys() { return [...m.keys()].map((u) => new Request(u)); },
        async delete(k) { return m.delete(typeof k === 'string' ? k : k.url); },
        async addAll() {},
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(n) { return stores.delete(n); },
    async match() { return undefined; },
  };
  const calls = [];
  const fetchImpl = async (req) => { calls.push(typeof req === 'string' ? req : req.url); return answer(req); };
  const self = { addEventListener: (t, fn) => { handlers[t] = fn; }, skipWaiting() {}, clients: { claim() {} } };
  const location = new URL(file.includes('wordbright') ? 'https://game.waystead.co.uk/wordbright/sw.js' : 'https://game.waystead.co.uk/spellbright/sw.js');
  new Function('self', 'caches', 'fetch', 'location', 'Response', 'Request', 'URL', src)(self, caches, fetchImpl, location, Response, Request, URL);
  async function get(url, init = {}) {
    let responded = null;
    handlers.fetch({ request: new Request(url, { method: 'GET', ...init }), respondWith: (p) => { responded = p; } });
    return responded ? await responded : 'not-handled';
  }
  return { get, calls, stores };
}

for (const [game, file] of Object.entries(WORKERS)) {
  test(`${game}: a voice recording is fetched once, then served from the "voice" cache with no network call`, async () => {
    const sw = sandbox(file);
    const url = ACCOUNT + '/api/voice/en-GB-Studio-C/rhythm';
    assert.equal((await sw.get(url, { credentials: 'include' })).status, 200);
    assert.deepEqual(sw.calls, [url]);
    const again = await sw.get(url, { credentials: 'include' });
    assert.equal(await again.text(), 'mp3');
    assert.deepEqual(sw.calls, [url], 'the second time: no network call');
    assert.ok(sw.stores.has('voice'));
  });

  test(`${game}: 401, 404, 429 and 503 answers are passed on but never kept`, async () => {
    for (const status of [401, 404, 429, 503]) {
      const sw = sandbox(file, () => Response.json({ fallback: true }, { status }));
      const url = ACCOUNT + '/api/voice/en-GB-Studio-B/yacht';
      assert.equal((await sw.get(url)).status, status);
      await sw.get(url);
      assert.equal(sw.calls.length, 2, `${status}: asked again next time`);
      assert.equal((sw.stores.get('voice') || new Map()).size, 0);
    }
  });

  test(`${game}: at most 1,500 recordings; the oldest go first`, async () => {
    const sw = sandbox(file);
    const word = (i) => 'w' + String.fromCharCode(97 + Math.floor(i / 676) % 26, 97 + Math.floor(i / 26) % 26, 97 + (i % 26));
    for (let i = 0; i < 1503; i++) await sw.get(ACCOUNT + '/api/voice/en-GB-Studio-C/' + word(i));
    const keys = [...sw.stores.get('voice').keys()];
    assert.equal(keys.length, 1500);
    assert.ok(!keys.includes(ACCOUNT + '/api/voice/en-GB-Studio-C/' + word(0)), 'the oldest went');
    assert.ok(keys.includes(ACCOUNT + '/api/voice/en-GB-Studio-C/' + word(1502)));
  });

  test(`${game}: every other account call, and odd voice paths, are not handled (the network, uncached)`, async () => {
    const sw = sandbox(file);
    for (const url of [ACCOUNT + '/api/me', ACCOUNT + '/api/game/wordbright', ACCOUNT + '/avatars/ottie-128.webp',
      ACCOUNT + '/api/voice/en-GB-Studio-C/Rhythm', ACCOUNT + '/api/voice/en-GB-Studio-C/rhythm/x', 'https://evil.example/api/voice/en-GB-Studio-C/rhythm']) {
      assert.equal(await sw.get(url), 'not-handled', url);
    }
    assert.deepEqual(sw.calls, []);
  });
}
