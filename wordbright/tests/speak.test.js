// G8: "Hear" in Wordbright speaks the word with the device's best British
// voice (shared voice/voice.js), cancelling anything still speaking first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage } from '../../shared/tests/fake-account.js';

const log = [];
let voices = [];
globalThis.localStorage = memoryStorage();
globalThis.speechSynthesis = {
  getVoices: () => voices,
  cancel: () => log.push('cancel'),
  speak: (u) => log.push({ text: u.text, voice: u.voice ? u.voice.name : null, lang: u.lang, rate: u.rate }),
  addEventListener() {},
};
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
// G8c: a fake account voice server, Audio and object URLs.
const fetched = [];
let serverAnswer = () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
globalThis.fetch = async (url, init) => { fetched.push({ url, credentials: init && init.credentials }); return serverAnswer(); };
const audio = [];
globalThis.Audio = class { constructor(src) { this.src = src; audio.push(src); } play() { queueMicrotask(() => this.onended && this.onended()); return Promise.resolve(); } pause() {} };
globalThis.URL.createObjectURL = () => 'blob:waystead-voice';
globalThis.URL.revokeObjectURL = () => {};
const { hear, canSpeak, useVoiceAccount } = await import('../site/js/ui/speak.js');
const settle = () => new Promise((r) => setTimeout(r, 10));

const v = (name, lang) => ({ name, lang, localService: true, voiceURI: name });

test('Hear: cancel, then speak with an en-GB voice at rate 0.9 (never a novelty voice)', () => {
  assert.equal(canSpeak(), false, 'no voices listed yet: Hear stays hidden');
  voices = [v('Bubbles', 'en-US'), v('Eddy (English (UK))', 'en-GB'), v('Samantha', 'en-US'), v('Daniel', 'en-GB'), v('Serena (Premium)', 'en-GB')];
  assert.equal(canSpeak(), true);
  hear('rhythm', '');
  const said = log.filter((x) => typeof x === 'object');
  assert.deepEqual(said, [{ text: 'rhythm', voice: 'Serena (Premium)', lang: 'en-GB', rate: 0.9 }]);
  assert.equal(log[log.indexOf(said[0]) - 1], 'cancel', 'cancel() right before speak()');
});

test('Hear: the voice chosen in the look menu (sb.voice) when this device has it', () => {
  log.length = 0;
  localStorage.setItem('sb.voice', 'Daniel');
  hear('colonel', '');
  assert.deepEqual(log.filter((x) => typeof x === 'object'), [{ text: 'colonel', voice: 'Daniel', lang: 'en-GB', rate: 0.9 }]);
  localStorage.removeItem('sb.voice');
});

test('G8c: signed in, Hear plays the Waystead recording (fetched with credentials); on a 503 the device voice at once', async () => {
  useVoiceAccount(() => ({ origin: 'https://account.waystead.co.uk', signedIn: true }));
  log.length = 0;
  hear('sin', '');
  await settle();
  assert.deepEqual(fetched.at(-1), { url: 'https://account.waystead.co.uk/api/voice/en-GB-Studio-C/sin', credentials: 'include' });
  assert.equal(audio.at(-1), 'blob:waystead-voice');
  assert.deepEqual(log.filter((x) => typeof x === 'object'), [], 'the device voice is not used');
  serverAnswer = () => Response.json({ fallback: true }, { status: 503 });
  hear('pus', '');
  await settle();
  assert.deepEqual(log.filter((x) => typeof x === 'object').map((x) => x.text), ['pus']);
  // Signed out: the device voice, and no request.
  useVoiceAccount(() => ({ origin: 'https://account.waystead.co.uk', signedIn: false }));
  const before = fetched.length;
  log.length = 0;
  hear('ren', '');
  await settle();
  assert.equal(fetched.length, before);
  assert.deepEqual(log.filter((x) => typeof x === 'object').map((x) => x.text), ['ren']);
  useVoiceAccount(() => null);
});
