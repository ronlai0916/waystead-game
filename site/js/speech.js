// Audio: the bundled British MP3s when they exist (same voice on every device);
// otherwise, signed in, the Waystead voice from the account's voice server
// (G8c, voice/server.js); otherwise, or when it does not answer within 2.5 s,
// the device's voice, chosen by voice/voice.js (G8): the best British voice,
// or the player's own choice from the look menu (sb.voice). Letters are
// always the bundled MP3 or the device's voice.
import { hasWordAudio, hasLetterAudio, wordAudioUrl, letterAudioUrl } from './data.js';
import { createSpeaker, savedVoice } from './voice/voice.js';
import { createHear } from './voice/server.js';

let current = null;
let runId = 0;
let speaker = null;

// The one speaker (null on a device that cannot speak).
export function getSpeaker() {
  if (!speaker && typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance === 'function') speaker = createSpeaker();
  return speaker;
}

// G8c: who is signed in, for the Waystead voice (app.js sets it; null: none).
let accountNow = () => null;
export function useVoiceAccount(fn) { accountNow = fn; }
let currentUrl = null;

export function stop() {
  runId += 1;
  if (current) {
    current.pause();
    current = null;
  }
  if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
  if (getSpeaker()) getSpeaker().cancel();
  if (typeof hearWord !== 'undefined') hearWord.cancel();
}

// A Waystead recording's Blob; resolves true when it played to the end.
function playBlob(blob) {
  const url = URL.createObjectURL(blob);
  currentUrl = url;
  return playFile(url);
}

const hearWord = createHear({
  get speaker() { return getSpeaker(); },
  account: () => accountNow(),
  online: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  savedVoice: () => { try { return savedVoice(globalThis.localStorage); } catch (e) { return ''; } },
  playBlob,
});

// The look menu's sample for a Waystead voice.
export const hearSample = () => { stop(); return hearWord('hello'); };

function playFile(url) {
  return new Promise((resolve) => {
    const a = new Audio(url);
    current = a;
    a.onended = () => resolve(true);
    a.onerror = () => resolve(false);
    a.play().catch(() => resolve(false));
  });
}

function sayAloud(text, rate) {
  const sp = getSpeaker();
  return sp ? sp.speak(text, { rate }) : Promise.resolve(false);
}

async function wordOnce(word) {
  if (hasWordAudio(word)) {
    const ok = await playFile(wordAudioUrl(word));
    if (ok) return true;
  }
  return !!(await hearWord(word, { rate: 0.9 }));
}
async function letterOnce(L) {
  if (hasLetterAudio(L)) {
    const ok = await playFile(letterAudioUrl(L));
    if (ok) return true;
  }
  return sayAloud(L.toUpperCase(), 0.75);
}

export function speak(word) {
  stop();
  return wordOnce(word);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Spell the word letter by letter, then say it whole. onLetter(i) highlights
// letter i (or -1 when finished). Stops early if anything else starts playing.
export async function spellOut(word, onLetter) {
  stop();
  const mine = runId;
  const letters = [...word];
  for (let i = 0; i < letters.length; i += 1) {
    if (mine !== runId) return;
    onLetter(i);
    await letterOnce(letters[i]);
    await sleep(320);
  }
  if (mine !== runId) return;
  onLetter(-1);
  await sleep(250);
  if (mine !== runId) return;
  await wordOnce(word);
}
