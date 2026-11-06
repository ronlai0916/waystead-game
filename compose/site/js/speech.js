// Hint words, spoken: the Waystead voice when signed in and online, else the
// device's voice (voice/server.js, voice/voice.js), as in the other games.
import { createSpeaker, savedVoice } from './voice/voice.js';
import { createHear } from './voice/server.js';

let speaker = null;
let current = null;
let currentUrl = null;
export function getSpeaker() {
  if (!speaker && typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance === 'function') speaker = createSpeaker();
  return speaker;
}
let accountNow = () => null;
export function useVoiceAccount(fn) { accountNow = fn; }

function playBlob(blob) {
  currentUrl = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const a = new Audio(currentUrl);
    current = a;
    a.onended = () => resolve(true);
    a.onerror = () => resolve(false);
    a.play().catch(() => resolve(false));
  });
}
const hearWord = createHear({
  get speaker() { return getSpeaker(); },
  account: () => accountNow(),
  online: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  savedVoice: () => { try { return savedVoice(globalThis.localStorage); } catch (e) { return ''; } },
  playBlob,
});
export function stop() {
  if (current) { current.pause(); current = null; }
  if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
  if (getSpeaker()) getSpeaker().cancel();
  hearWord.cancel();
}
export const speak = (word) => { stop(); return hearWord(word, { rate: 0.9 }); };
export const hearSample = () => { stop(); return hearWord('hello'); };
