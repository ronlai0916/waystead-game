// Audio: the bundled British MP3s when they exist (same voice on every device);
// otherwise the device's voice, chosen by voice/voice.js (G8): the best
// British voice, or the player's own choice from the look menu (sb.voice).
import { hasWordAudio, hasLetterAudio, wordAudioUrl, letterAudioUrl } from './data.js';
import { createSpeaker } from './voice/voice.js';

let current = null;
let runId = 0;
let speaker = null;

// The one speaker (null on a device that cannot speak).
export function getSpeaker() {
  if (!speaker && typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance === 'function') speaker = createSpeaker();
  return speaker;
}

export function stop() {
  runId += 1;
  if (current) {
    current.pause();
    current = null;
  }
  if (getSpeaker()) getSpeaker().cancel();
}

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
  return sayAloud(word, 0.9);
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
