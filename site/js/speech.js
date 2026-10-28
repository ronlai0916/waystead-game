// Audio: the bundled British MP3s when they exist (same voice on every device);
// otherwise the device's own en-GB voice, so the game still talks before the
// MP3s are generated.
import { hasWordAudio, hasLetterAudio, wordAudioUrl, letterAudioUrl } from './data.js';

let current = null;
let gbVoice = null;
let runId = 0;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  gbVoice = voices.find((v) => v.lang === 'en-GB' && /female|serena|kate|sonia|libby|martha/i.test(v.name))
    || voices.find((v) => v.lang === 'en-GB')
    || voices.find((v) => v.lang && v.lang.startsWith('en'))
    || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener('voiceschanged', pickVoice);
}

export function stop() {
  runId += 1;
  if (current) {
    current.pause();
    current = null;
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
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
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve(false);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = rate;
    if (gbVoice) u.voice = gbVoice;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    speechSynthesis.speak(u);
  });
}

async function wordOnce(word) {
  if (hasWordAudio(word)) {
    const ok = await playFile(wordAudioUrl(word));
    if (ok) return true;
  }
  return sayAloud(word, 0.85);
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
