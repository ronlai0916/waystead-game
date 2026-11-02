// "Hear" a word: Spellbright's recording for Star words; otherwise, signed in,
// the Waystead voice from the account's voice server (G8c, voice/server.js);
// otherwise, or when it does not answer within 2.5 s, the device's voice
// (voice/voice.js: the best British voice, or the player's choice, sb.voice,
// at rate 0.9). Only ever on a tap.
import { createSpeaker, savedVoice } from '../voice/voice.js';
import { createHear } from '../voice/server.js';

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

// G8c: who is signed in, for the Waystead voice (app.js sets it; null: none).
let accountNow = () => null;
export function useVoiceAccount(fn) { accountNow = fn; }

// Hear can be offered: a device voice, or (signed in and online) the Waystead voice.
export function canSpeak() {
  const s = getSpeaker();
  if (s && s.current()) return true;
  const a = accountNow();
  return !!(a && a.signedIn && (typeof navigator === 'undefined' || navigator.onLine !== false));
}

let playing = null;
let playingUrl = null;
function stopPlaying() {
  if (playing) { playing.pause(); playing = null; }
  if (playingUrl) { URL.revokeObjectURL(playingUrl); playingUrl = null; }
}

// Play a recording's Blob; resolves true when it played to the end.
function playBlob(blob) {
  stopPlaying();
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  playing = a;
  playingUrl = url;
  return new Promise((resolve) => {
    a.onended = () => resolve(true);
    a.onerror = () => resolve(false);
    a.play().then(() => {}, () => resolve(false));
  });
}

const hearWord = createHear({
  get speaker() { return getSpeaker(); },
  account: () => accountNow(),
  online: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  savedVoice: () => { try { return savedVoice(globalThis.localStorage); } catch (e) { return ''; } },
  playBlob,
});

// The look menu's sample for a Waystead voice.
export const hearSample = () => { const s = getSpeaker(); if (s) s.cancel(); return hearWord('hello'); };

export function hear(word, audio) {
  stopPlaying();
  const s = getSpeaker();
  if (s) s.cancel();
  if (!audio) { hearWord(word); return; }
  const a = new Audio(audio);
  playing = a;
  a.play().catch(() => hearWord(word)); // missing or blocked: the Waystead voice, else the device
}
