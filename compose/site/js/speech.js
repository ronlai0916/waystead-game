// Hint words, spoken: the Waystead voice when signed in and online, else the
// device's voice (voice/server.js, voice/voice.js), as in the other games.
import { createSpeaker, savedVoice } from './voice/voice.js';
import { createHear, createHearLine } from './voice/server.js';
import { hasTyped } from './comic-doc.js';

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
const voiceDeps = {
  get speaker() { return getSpeaker(); },
  account: () => accountNow(),
  online: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  savedVoice: () => { try { return savedVoice(globalThis.localStorage); } catch (e) { return ''; } },
  playBlob,
};
const hearWord = createHear(voiceDeps);
const hearLine = createHearLine(voiceDeps);
export function stop() {
  if (current) { current.pause(); current = null; }
  if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
  if (getSpeaker()) getSpeaker().cancel();
  hearWord.cancel();
  hearLine.cancel();
}
export const speak = (word) => { stop(); return hearWord(word, { rate: 0.9 }); };
export const hearSample = () => { stop(); return hearWord('hello'); };

// A whole sentence or caption (Comic Studio): the Waystead voice's sentence
// route (C2-1b), else the device's voice; one word goes the word route. A
// child's own typed words are never sent for a recording (the text would reach
// Google): a line holding any of them, or one marked { own: true }, is spoken by
// the device. useOwnWords() is given the open comic's typed words. Answers true
// when it has been spoken (so a comic can be read line by line), false if it
// was stopped or there is no voice.
let lineRun = 0;
let ownWords = [];
/** A text over 200 characters as its sentences (each still under 200, or whole). */
export function splitLong(t, max = 200) {
  if (t.length <= max) return [t];
  return t.split(/(?<=[.!?]["']?)\s+/).filter(Boolean);
}
export function useOwnWords(bits) { ownWords = Array.isArray(bits) ? bits : []; }
export async function speakLine(text, { own = false } = {}) {
  stop();
  const mine = ++lineRun;
  const t = String(text || '').trim();
  if (!t) return false;
  if (/^[A-Za-z]+$/.test(t)) return !!(await hearWord(t.toLowerCase(), { rate: 0.9 })) && mine === lineRun;
  if (!own && !hasTyped(t, ownWords)) {
    // The server takes 200 characters at most: a longer text (a story start) goes sentence by sentence.
    for (const part of splitLong(t)) {
      if (!(await hearLine(part, { rate: 0.9 })) || mine !== lineRun) return false;
    }
    return true;
  }
  const sp = getSpeaker();
  if (!sp) return false;
  const ok = await sp.speak(t, { rate: 0.9 });
  return !!ok && mine === lineRun;
}
/** Read lines one after another; onLine(i) before each. Stops when stop() is called or a line fails. */
export async function speakLines(lines, onLine = () => {}) {
  const mine = ++lineRun + 1;
  for (let i = 0; i < lines.length; i += 1) {
    onLine(i);
    const ok = await speakLine(lines[i]);
    if (!ok || lineRun !== mine + i) { onLine(-1); return false; }
  }
  onLine(-1);
  return true;
}
