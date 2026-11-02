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
const { hear, canSpeak } = await import('../site/js/ui/speak.js');

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
