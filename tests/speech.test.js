// G8: a word with no bundled MP3 is spoken with the device's best British
// voice (shared voice/voice.js), after cancelling anything still speaking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage } from '../shared/tests/fake-account.js';

const log = [];
globalThis.window = globalThis;
globalThis.localStorage = memoryStorage();
globalThis.speechSynthesis = {
  getVoices: () => [{ name: 'Zarvox', lang: 'en-US' }, { name: 'Kate', lang: 'en-GB', localService: true }, { name: 'Alex', lang: 'en-US', localService: true }],
  cancel: () => log.push('cancel'),
  speak: (u) => { log.push({ text: u.text, voice: u.voice ? u.voice.name : null, lang: u.lang, rate: u.rate }); queueMicrotask(() => u.onend()); },
  addEventListener() {},
};
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
const fetched = [];
globalThis.fetch = async (url, init) => { fetched.push({ url, credentials: init && init.credentials }); return new Response(new Uint8Array([7, 7]), { status: 200, headers: { 'content-type': 'audio/mpeg' } }); };
const audio = [];
globalThis.Audio = class { constructor(src) { this.src = src; audio.push(src); } play() { queueMicrotask(() => this.onended && this.onended()); return Promise.resolve(); } pause() {} };
globalThis.URL.createObjectURL = () => 'blob:waystead-voice';
globalThis.URL.revokeObjectURL = () => {};
const { speak, useVoiceAccount } = await import('../site/js/speech.js');

test('Hear it (no MP3 for this word): cancel, then the en-GB voice at rate 0.9', async () => {
  assert.equal(await speak('thorough'), true);
  const said = log.filter((x) => typeof x === 'object');
  assert.deepEqual(said, [{ text: 'thorough', voice: 'Kate', lang: 'en-GB', rate: 0.9 }]);
  assert.equal(log[log.indexOf(said[0]) - 1], 'cancel');
});

test('G8c: signed in, a word with no bundled MP3 plays the Waystead recording; the device voice is not used', async () => {
  useVoiceAccount(() => ({ origin: 'https://account.waystead.co.uk', signedIn: true }));
  log.length = 0;
  assert.equal(await speak('thorough'), true);
  assert.deepEqual(fetched, [{ url: 'https://account.waystead.co.uk/api/voice/en-GB-Studio-C/thorough', credentials: 'include' }]);
  assert.deepEqual(audio, ['blob:waystead-voice']);
  assert.deepEqual(log.filter((x) => typeof x === 'object'), []);
  useVoiceAccount(() => null);
});
