// The device voice for "Hear" in Spellbright and Wordbright (G8): the best
// British voice this device has, or the player's own choice (sb.voice, shared
// by both games and saved to their account with the look).
// THIS FILE IS A COPY: edit shared/voice/ and run `node tools/sync-shared.mjs`.
//
// Best = en-GB first; then voices marked Premium, Enhanced or Natural; then
// known good ones (Apple Serena, Kate, Daniel, Stephanie, Oliver; Chrome's
// Google UK English; Microsoft's UK voices); then voices on the device (they
// work offline). Novelty voices (Bubbles, Zarvox, Eddy, Grandma …) are never
// used. With no British voice, the best English one, and a tip on adding one.

export const VOICE_KEY = 'sb.voice';
export const RATE = 0.9;

const NOVELTY = new Set(['albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news', 'jester', 'organ',
  'pipe organ', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox', 'deranged', 'hysterical', 'eddy', 'flo', 'grandma',
  'grandpa', 'reed', 'rocko', 'sandy', 'shelley', 'fred', 'junior', 'ralph', 'kathy', 'princess', 'bruce', 'agnes', 'vicki',
  'victoria']);
const KNOWN_GOOD = /^(serena|kate|daniel|stephanie|oliver|martha|arthur|google uk english (female|male)|microsoft (libby|sonia|ryan|maisie|thomas|hollie|olivia|alfie|bella|elliot|ethan|noah|oliver|abbi))\b/i;

export const langOf = (v) => String((v && v.lang) || '').replace('_', '-').toLowerCase();
export const isBritish = (v) => langOf(v) === 'en-gb';
const isEnglish = (v) => /^en(-|$)/.test(langOf(v));
// "Eddy (English (UK))", "Grandma (English (US))": the name before any bracket.
const baseName = (v) => String((v && v.name) || '').replace(/\s*\(.*$/, '').trim().toLowerCase();
export const isNovelty = (v) => NOVELTY.has(baseName(v)) || /com\.apple\.eloquence\./i.test(String(v.voiceURI || ''));

function score(v) {
  const name = String(v.name || '') + ' ' + String(v.voiceURI || ''); // Safari: com.apple.voice.premium.en-GB.Serena
  let s = isBritish(v) ? 1000 : 0;
  if (/premium/i.test(name)) s += 300;
  else if (/enhanced|natural|neural/i.test(name)) s += 200;
  if (KNOWN_GOOD.test(name)) s += 100;
  if (v.localService) s += 10;
  if (v.default) s += 1;
  return s;
}

// Every English voice worth offering, best first.
export function rankVoices(voices) {
  return [...(voices || [])].filter((v) => v && isEnglish(v) && !isNovelty(v))
    .sort((a, b) => score(b) - score(a) || String(a.name).localeCompare(String(b.name)));
}

// The voice to use: the saved one if this device has it, else the best.
export function pickVoice(voices, saved = '') {
  const ranked = rankVoices(voices);
  return (saved && ranked.find((v) => v.name === saved)) || ranked[0] || null;
}

// The choices for the Voice menu after "Best voice" ('' = automatic): the next
// few, never the best voice itself (it is named on "Best voice").
export function voiceChoices(voices, max = 4) {
  const ranked = rankVoices(voices);
  const british = ranked.filter(isBritish);
  return (british.length ? british : ranked).slice(1, max + 1).map((v) => ({ id: v.name, label: voiceLabel(v) }));
}
export const voiceLabel = (v) => String(v.name).replace(/^(Google|Microsoft)\s+/, '').replace(/\s+Online\s*\(Natural\).*$/, ' (Natural)').replace(/\s+-\s+English.*$/, '');

// The one-line tip when the device has no British voice (null when it has one).
export function voiceTip(voices, nav = {}) {
  if (!voices || !voices.length || rankVoices(voices).some(isBritish)) return null;
  const ua = String(nav.userAgent || '');
  const touchMac = /Macintosh/.test(ua) && Number(nav.maxTouchPoints) > 1;
  if (/iPhone|iPad|iPod/.test(ua) || touchMac) return 'For a British voice: Settings → Accessibility → Spoken Content → Voices → English (UK).';
  if (/Macintosh/.test(ua)) return 'For a British voice: System Settings → Accessibility → Spoken Content → Manage Voices.';
  return 'For a British voice, add an English (UK) voice in this device’s speech settings.';
}

// G9: steps for adding British voices, for this kind of device (shown under
// the Voice menu when the device has only one British voice).
export function deviceKind(nav = {}) {
  const ua = String(nav.userAgent || '');
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && Number(nav.maxTouchPoints) > 1)) return 'ios';
  if (/Macintosh/.test(ua)) return 'mac';
  return 'other';
}
export const MORE_VOICE_STEPS = {
  ios: 'Settings → Accessibility → Spoken Content → Voices → English → English (UK), then download Serena (Premium) or Kate (Enhanced).',
  mac: 'System Settings → Accessibility → Spoken Content → System voice → Manage Voices → English (United Kingdom).',
  other: 'Open this device’s speech or language settings and add another English (UK) voice.',
};
export const britishCount = (voices) => rankVoices(voices).filter(isBritish).length;

export function savedVoice(storage) {
  try { const v = storage.getItem(VOICE_KEY); return typeof v === 'string' && v.length <= 100 ? v : ''; } catch (e) { return ''; }
}
// Save the choice ('' = Best voice). 'wa:look' sends it to the account with the look.
export function saveVoice(storage, name, win = typeof window !== 'undefined' ? window : null) {
  try { if (name) storage.setItem(VOICE_KEY, String(name).slice(0, 100)); else storage.removeItem(VOICE_KEY); } catch (e) { /* private mode */ }
  if (win && typeof win.dispatchEvent === 'function' && typeof CustomEvent === 'function') win.dispatchEvent(new CustomEvent('wa:look'));
}

// A speaker over the device's speechSynthesis. speak() always cancels what is
// playing first, and never waits: iOS only speaks inside the tap itself.
export function createSpeaker({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance,
  storage = globalThis.localStorage } = {}) {
  const voices = () => { try { return synth ? synth.getVoices() || [] : []; } catch (e) { return []; } };
  let keep = null; // Chrome drops an utterance's events if nothing holds it
  const listeners = new Set();
  if (synth && typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', () => listeners.forEach((fn) => fn()));

  function say(text, rate, voice, retry) {
    return new Promise((resolve) => {
      const u = new Utterance(text);
      u.lang = voice ? voice.lang : 'en-GB';
      if (voice) u.voice = voice;
      u.rate = rate;
      keep = u;
      u.onend = () => resolve(true);
      u.onerror = (e) => {
        // A network voice (Chrome's Google UK English) fails offline: the best one on the device instead.
        const local = retry && voice && !voice.localService && e && e.error !== 'interrupted' && e.error !== 'canceled'
          ? rankVoices(voices()).find((v) => v.localService) : null;
        if (local) { synth.cancel(); resolve(say(text, rate, local, false)); } else resolve(false);
      };
      synth.speak(u);
    });
  }

  return {
    get available() { return !!(synth && Utterance); },
    voices,
    // The voice speak() uses now (null before the device lists any: then the
    // device's default for en-GB).
    current: () => pickVoice(voices(), savedVoice(storage)),
    speak(text, { rate = RATE } = {}) {
      if (!synth || !Utterance) return Promise.resolve(false);
      synth.cancel();
      return say(text, rate, pickVoice(voices(), savedVoice(storage)), true);
    },
    cancel() { if (synth) synth.cancel(); },
    // Calls back when the device's voices are listed (Safari lists them late).
    onVoices(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
