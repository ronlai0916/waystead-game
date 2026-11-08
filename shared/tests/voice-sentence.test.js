// C2-1b: a whole sentence in the Waystead voice (shared/voice/server.js
// createHearLine), with a fake fetch and a fake device speaker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SENTENCE_TIMEOUT_MS, SENTENCE_MAX, createHearLine, sentenceUrl, spokenNumbers } from '../voice/server.js';

const ACCOUNT = 'https://account.waystead.co.uk';
const mp3 = () => new Response(new Uint8Array([0x49, 0x44, 0x33]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });

function setup({ answer = mp3, signedIn = true, online = true, saved = '' } = {}) {
  const fetched = [];
  const played = [];
  const spoken = [];
  const hear = createHearLine({
    speaker: { speak: async (w) => { spoken.push(w); return true; } },
    account: () => ({ origin: ACCOUNT, signedIn }),
    online: () => online,
    savedVoice: () => saved,
    fetchImpl: async (url, init) => { fetched.push({ url, init }); return answer(url); },
    playBlob: async (blob) => { played.push(blob.size); return true; },
  });
  return { hear, fetched, played, spoken };
}

test('a sentence is POSTed as JSON with credentials (never in the URL) and played', async () => {
  const t = setup();
  assert.equal(await t.hear('Why did Maya feel  heartbroken?'), 'server');
  assert.equal(t.fetched[0].url, ACCOUNT + '/api/voice/en-GB-Studio-C/s');
  assert.equal(sentenceUrl(ACCOUNT, 'en-GB-Studio-B'), ACCOUNT + '/api/voice/en-GB-Studio-B/s');
  const init = t.fetched[0].init;
  assert.equal(init.method, 'POST');
  assert.equal(init.credentials, 'include');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(init.body), { text: 'Why did Maya feel heartbroken?' });
  assert.ok(!t.fetched[0].url.includes('Maya'));
  assert.deepEqual(t.spoken, []);
  assert.equal(SENTENCE_TIMEOUT_MS, 5000);
});

test('heard again this visit: played from memory, no second request', async () => {
  const t = setup();
  await t.hear('The wind is so strong!');
  await t.hear('The wind is so strong!');
  assert.equal(t.fetched.length, 1);
  assert.deepEqual(t.played, [3, 3]);
});

test('404 (a word not allowed), 503, a network error, signed out, offline, too long: the device voice', async () => {
  for (const [name, o, text] of [
    ['404', { answer: () => Response.json({ error: 'not-found' }, { status: 404 }) }, 'Maya felt glum.'],
    ['503', { answer: () => Response.json({ fallback: true }, { status: 503 }) }, 'Maya felt glum.'],
    ['network', { answer: () => { throw new TypeError('Failed to fetch'); } }, 'Maya felt glum.'],
    ['signed out', { signedIn: false }, 'Maya felt glum.'],
    ['offline', { online: false }, 'Maya felt glum.'],
    ['device chosen', { saved: '@device' }, 'Maya felt glum.'],
    ['too long', {}, 'a '.repeat(SENTENCE_MAX)],
  ]) {
    const t = setup(o);
    assert.equal(await t.hear(text), 'device', name);
    assert.equal(t.spoken.length, 1, name);
    if (['signed out', 'offline', 'device chosen', 'too long'].includes(name)) assert.equal(t.fetched.length, 0, name + ': no request');
  }
});

test('small numbers are sent as words (the server speaks words only); bigger ones and words with digits stay', async () => {
  assert.equal(spokenNumbers('Class 4 had ever had.'), 'Class four had ever had.');
  assert.equal(spokenNumbers('0, 13, 20 and 47'), 'zero, thirteen, twenty and forty-seven');
  assert.equal(spokenNumbers('In 2026 at 3pm, Y3'), 'In 2026 at 3pm, Y3');
  const t = setup();
  await t.hear('the children in Class 4');
  assert.deepEqual(JSON.parse(t.fetched[0].init.body), { text: 'the children in Class four' });
});
