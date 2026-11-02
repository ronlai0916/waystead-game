// G8c: "Hear" with the Waystead voice (shared/voice/server.js) and the Voice
// menu's Waystead items (shared/voice/menu.js), with a fake fetch and a fake
// device speaker: no network, no account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERVER_DEFAULT, DEVICE_BEST, SERVER_TIMEOUT_MS, createHear, fetchRecording, serverVoiceFor, voiceUrl } from '../voice/server.js';
import { voiceItemsHtml, tickedVoice, wireVoiceMenu, serverNeeds } from '../voice/menu.js';
import { createPrefsSync } from '../account/prefs.js';
import { createApi } from '../account/api.js';
import { fakeAccount, memoryStorage, CHILD_A, KID_A } from './fake-account.js';

const ACCOUNT = 'https://account.waystead.co.uk';
const v = (name, lang) => ({ name, lang, localService: true, voiceURI: name });
const VOICES = [v('Daniel', 'en-GB'), v('Serena (Premium)', 'en-GB'), v('Samantha', 'en-US')];
const mp3 = () => new Response(new Uint8Array([0x49, 0x44, 0x33]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });

function setup({ answer = mp3, signedIn = true, online = true, saved = '', play = true } = {}) {
  const fetched = [];
  const played = [];
  const spoken = [];
  const hear = createHear({
    speaker: { speak: async (w) => { spoken.push(w); return true; } },
    account: () => ({ origin: ACCOUNT, signedIn }),
    online: () => online,
    savedVoice: () => saved,
    fetchImpl: async (url, init) => { fetched.push({ url, init }); return answer(url); },
    playBlob: async (blob) => { played.push(blob.size); return play; },
  });
  return { hear, fetched, played, spoken };
}

test('signed in: the Waystead recording is fetched with credentials and played (female by default)', async () => {
  const t = setup();
  assert.equal(await t.hear('rhythm'), 'server');
  assert.equal(t.fetched[0].url, ACCOUNT + '/api/voice/en-GB-Studio-C/rhythm');
  assert.equal(t.fetched[0].init.credentials, 'include');
  assert.deepEqual(t.played, [3]);
  assert.deepEqual(t.spoken, [], 'the device voice is not used');
  const male = setup({ saved: 'en-GB-Studio-B' });
  await male.hear('yacht');
  assert.equal(male.fetched[0].url, ACCOUNT + '/api/voice/en-GB-Studio-B/yacht');
});

test('each failure falls back to the device voice at once: 404, 429, 503, a network error, a blob that will not play', async () => {
  for (const [name, answer, play] of [
    ['404', () => Response.json({ error: 'not-found' }, { status: 404 }), true],
    ['429', () => Response.json({ fallback: true }, { status: 429 }), true],
    ['503', () => Response.json({ fallback: true }, { status: 503 }), true],
    ['network', () => { throw new TypeError('Failed to fetch'); }, true],
    ['not audio', () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }), true],
    ['will not play', mp3, false],
  ]) {
    const t = setup({ answer, play });
    assert.equal(await t.hear('rhythm'), 'device', name);
    assert.deepEqual(t.spoken, ['rhythm'], name);
  }
});

test('no answer within 2.5 s: null (the device voice), and the request is aborted', async () => {
  assert.equal(SERVER_TIMEOUT_MS, 2500);
  let fire = null;
  let waited = 0;
  let aborted = false;
  let resolveFetch = null;
  const p = fetchRecording(ACCOUNT + '/api/voice/en-GB-Studio-C/rhythm', {
    fetchImpl: (url, init) => new Promise((resolve) => { resolveFetch = resolve; init.signal.addEventListener('abort', () => { aborted = true; }); }),
    setTimer: (fn, ms) => { fire = fn; waited = ms; return 1; },
    clearTimer: () => {},
  });
  assert.equal(waited, 2500);
  fire(); // 2.5 s pass with no answer
  assert.equal(await p, null);
  assert.ok(aborted, 'the request is aborted');
  resolveFetch(mp3()); // a late answer changes nothing
});

test('signed out or offline: the device voice, with no request at all; a device voice chosen on purpose too', async () => {
  for (const opts of [{ signedIn: false }, { online: false }, { saved: DEVICE_BEST }, { saved: 'Daniel' }]) {
    const t = setup(opts);
    assert.equal(await t.hear('sin'), 'device', JSON.stringify(opts));
    assert.deepEqual(t.fetched, []);
  }
  assert.equal(serverVoiceFor('', { signedIn: true }), SERVER_DEFAULT);
  assert.equal(serverVoiceFor('en-GB-Studio-B', { signedIn: true }), 'en-GB-Studio-B');
  assert.equal(serverVoiceFor('en-GB-Studio-B', { signedIn: false }), null);
  assert.equal(voiceUrl(ACCOUNT, 'en-GB-Studio-C', 'eke'), ACCOUNT + '/api/voice/en-GB-Studio-C/eke');
});

test('a second tap while the first recording is on its way: only the second word is heard', async () => {
  let release = null;
  const t = setup({ answer: (url) => (url.endsWith('/first') ? new Promise((r) => { release = () => r(mp3()); }) : mp3()) });
  const first = t.hear('first');
  const second = await t.hear('second');
  release();
  assert.equal(await first, false);
  assert.equal(second, 'server');
  assert.deepEqual(t.played, [3], 'played once, for the second word');
});

// ---- the Voice menu ---------------------------------------------------------------------

test('the menu: Waystead voices first; greyed "needs sign-in" signed out, "needs internet" offline', () => {
  const on = voiceItemsHtml(VOICES, { signedIn: true, online: true });
  assert.match(on, /^<li[^>]*data-voice="en-GB-Studio-C"[^>]*>.*Waystead voice — female.*<li[^>]*data-voice="en-GB-Studio-B"[^>]*>.*Waystead voice — male/);
  assert.doesNotMatch(on, /aria-disabled/);
  assert.match(on, /data-voice="@device"[^>]*>.*Best British voice \(Serena, Premium\)/);
  const out = voiceItemsHtml(VOICES, { signedIn: false, online: true });
  assert.equal((out.match(/aria-disabled="true"/g) || []).length, 2);
  assert.match(out, /Waystead voice — female<span class="thememenu__needs"> — needs sign-in<\/span>/);
  assert.match(voiceItemsHtml(VOICES, { signedIn: true, online: false }), /needs internet/);
  assert.equal(serverNeeds(null), 'sign-in');
  assert.doesNotMatch(voiceItemsHtml(VOICES), /Waystead/, 'a page with no account: no Waystead voices');
});

test('the tick is the voice that will speak', () => {
  const on = { signedIn: true, online: true };
  const off = { signedIn: false, online: true };
  assert.equal(tickedVoice(VOICES, '', on), 'en-GB-Studio-C', 'signed in, no choice: Waystead female');
  assert.equal(tickedVoice(VOICES, 'en-GB-Studio-B', on), 'en-GB-Studio-B');
  assert.equal(tickedVoice(VOICES, 'en-GB-Studio-B', off), DEVICE_BEST, 'signed out: the device');
  assert.equal(tickedVoice(VOICES, DEVICE_BEST, on), DEVICE_BEST);
  assert.equal(tickedVoice(VOICES, 'Daniel', on), 'Daniel');
});

test('choosing: a Waystead voice is saved (sb.voice) and says hello; a greyed one does nothing; and it syncs through /api/prefs', async () => {
  const storage = memoryStorage();
  const items = [];
  const list = { set innerHTML(h) { items.length = 0; for (const m of h.matchAll(/data-voice="([^"]*)"/g)) items.push({ dataset: { voice: m[1] }, setAttribute() {} }); }, querySelectorAll: () => items, querySelector: () => null };
  const menu = { querySelector: (s) => (s === '[data-voice-list]' ? list : null), querySelectorAll: () => [] };
  let state = { signedIn: false, online: true };
  const samples = [];
  const spoken = [];
  const speaker = { available: true, voices: () => VOICES, onVoices() {}, speak: (t) => spoken.push(t), current: () => VOICES[0] };
  const vm = wireVoiceMenu(menu, speaker, { storage, nav: {}, server: () => state, hearSample: (id) => samples.push(id) });
  assert.equal(vm.items()[0].dataset.voice, 'en-GB-Studio-C');
  vm.pick('en-GB-Studio-C');
  assert.equal(storage.getItem('sb.voice'), null, 'greyed: nothing saved');
  assert.deepEqual(samples, []);
  state = { signedIn: true, online: true };
  vm.redraw();
  vm.pick('en-GB-Studio-B');
  assert.equal(storage.getItem('sb.voice'), 'en-GB-Studio-B');
  assert.deepEqual(samples, ['en-GB-Studio-B']);
  vm.pick(DEVICE_BEST);
  assert.equal(storage.getItem('sb.voice'), DEVICE_BEST);
  assert.equal(spoken.length, 1, 'the device voice says its sample');
  // Synced like the look: the account keeps prefs.voice, another device gets it.
  const acct = fakeAccount();
  acct.who = CHILD_A;
  const api = createApi({ origin: ACCOUNT, fetch: acct.fetch });
  storage.setItem('sb.voice', 'en-GB-Studio-B');
  assert.equal(await createPrefsSync({ api, storage, playerId: KID_A.id }).pull(), 'saved');
  assert.equal(acct.prefs.get(KID_A.id).prefs.voice, 'en-GB-Studio-B');
  const other = memoryStorage();
  await createPrefsSync({ api, storage: other, playerId: KID_A.id }).pull();
  assert.equal(other.getItem('sb.voice'), 'en-GB-Studio-B');
});
