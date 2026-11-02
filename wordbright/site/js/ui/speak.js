// "Hear" a word: Spellbright's recording for Star words, otherwise the
// device's voice, chosen by voice/voice.js (G8): the best British voice, or
// the player's own choice from the look menu (sb.voice), at rate 0.9. Only
// ever on a tap.
import { createSpeaker } from '../voice/voice.js';

let speaker = null;
// The one speaker (null on a device that cannot speak).
export function getSpeaker() {
  if (!speaker && typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance === 'function') speaker = createSpeaker();
  return speaker;
}

// Calls back when the device's voices are known (they may arrive later).
export function onVoices(cb) {
  const s = getSpeaker();
  return s ? s.onVoices(cb) : () => {};
}

export function canSpeak() {
  const s = getSpeaker();
  return !!(s && s.current());
}

function say(word) {
  const s = getSpeaker();
  if (s) s.speak(word);
}

let playing = null;
export function hear(word, audio) {
  if (playing) { playing.pause(); playing = null; }
  const s = getSpeaker();
  if (s) s.cancel();
  if (!audio) { say(word); return; }
  const a = new Audio(audio);
  playing = a;
  a.play().catch(() => say(word)); // missing or blocked: the device voice instead
}
