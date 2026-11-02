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
const { speak } = await import('../site/js/speech.js');

test('Hear it (no MP3 for this word): cancel, then the en-GB voice at rate 0.9', async () => {
  assert.equal(await speak('thorough'), true);
  const said = log.filter((x) => typeof x === 'object');
  assert.deepEqual(said, [{ text: 'thorough', voice: 'Kate', lang: 'en-GB', rate: 0.9 }]);
  assert.equal(log[log.indexOf(said[0]) - 1], 'cancel');
});
