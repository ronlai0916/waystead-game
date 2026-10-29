// "Hear" a word: Spellbright's recording for Star words, otherwise the
// device's English voice (British if it has one). Only ever on a tap.

let voice = null; // the chosen voice, once the device has listed its voices
const synth = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;

function pickVoice() {
  if (!synth()) return null;
  const voices = synth().getVoices();
  voice = voices.find((v) => /^en[-_]GB$/i.test(v.lang))
    || voices.find((v) => /^en\b/i.test(v.lang))
    || null;
  return voice;
}

// Calls back when the device's voices are known (they may arrive later).
export function onVoices(cb) {
  const s = synth();
  if (!s) return () => {};
  pickVoice();
  const again = () => { pickVoice(); cb(); };
  s.addEventListener('voiceschanged', again);
  return () => s.removeEventListener('voiceschanged', again);
}

export function canSpeak() {
  return !!(voice || pickVoice());
}

function say(word) {
  if (!canSpeak()) return;
  const u = new SpeechSynthesisUtterance(word);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.9;
  synth().cancel();
  synth().speak(u);
}

let playing = null;
export function hear(word, audio) {
  if (playing) { playing.pause(); playing = null; }
  if (!audio) { say(word); return; }
  const a = new Audio(audio);
  playing = a;
  a.play().catch(() => say(word)); // missing or blocked: the device voice instead
}
