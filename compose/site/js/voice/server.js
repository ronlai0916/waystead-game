// The Waystead voice (G8c): British recordings made by the account's voice
// server (GET <account>/api/voice/<voiceId>/<word>, MP3), for "Hear" when a
// player is signed in. Sentences (C2-1b, Comic Studio): POST
// <account>/api/voice/<voiceId>/s with {"text"}; the text goes in the body so
// it never appears in a URL or a log, and only every word on the voice
// allow-list (or a comic's names) is spoken. Anything else — signed out, offline, no answer within
// 2.5 s, a 404/429/503 or a network error — and the device's own voice speaks
// at once (voice.js).
// THIS FILE IS A COPY: edit shared/voice/ and run `node tools/sync-shared.mjs`.
//
// sb.voice (shared by both games, saved with the look):
//   ''                 the default: the Waystead female voice when signed in,
//                      the best device voice when not;
//   'en-GB-Studio-C'   Waystead voice — female;   'en-GB-Studio-B'  — male;
//   '@device'          the best device voice, chosen on purpose;
//   anything else      that device voice's name (voice.js).

export const SERVER_VOICES = [
  { id: 'en-GB-Studio-C', label: 'Waystead voice — female' },
  { id: 'en-GB-Studio-B', label: 'Waystead voice — male' },
];
export const SERVER_DEFAULT = 'en-GB-Studio-C';
export const DEVICE_BEST = '@device';
export const SERVER_TIMEOUT_MS = 2500;
/** A new sentence takes longer to make than a word. */
export const SENTENCE_TIMEOUT_MS = 5000;
export const SENTENCE_MAX = 200;

export const isServerVoice = (id) => SERVER_VOICES.some((v) => v.id === id);

/** The recording's address on the account service. */
export const voiceUrl = (origin, voice, word) => origin + '/api/voice/' + voice + '/' + encodeURIComponent(word);

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** "Class 4" → "Class four": the voice server speaks words only, so a number of up to two digits is sent as words. */
export function spokenNumbers(text) {
  return String(text).replace(/(^|[^0-9A-Za-z])([0-9]{1,2})(?![0-9A-Za-z])/g, (m, pre, d) => {
    const n = Number(d);
    return pre + (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''));
  });
}

/** Where a sentence is asked for (POST). */
export const sentenceUrl = (origin, voice) => origin + '/api/voice/' + voice + '/s';

/**
 * The server voice to try for this choice, or null for the device's voice.
 * signedIn: someone is signed in (the cached player counts); online: the
 * device's network flag.
 */
export function serverVoiceFor(saved, { signedIn, online = true }) {
  if (!signedIn || online === false) return null;
  if (!saved) return SERVER_DEFAULT;
  return isServerVoice(saved) ? saved : null;
}

/**
 * The recording as a Blob, or null (any failure: the caller speaks with the
 * device's voice). Credentials go with it (the account's session cookie).
 */
export async function fetchRecording(url, { fetchImpl = (...a) => globalThis.fetch(...a), timeoutMs = SERVER_TIMEOUT_MS,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t), init = {} } = {}) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  const late = new Promise((resolve) => { timer = setTimer(() => { if (ctrl) ctrl.abort(); resolve(null); }, timeoutMs); });
  const got = (async () => {
    try {
      const res = await fetchImpl(url, { credentials: 'include', mode: 'cors', ...init, ...(ctrl ? { signal: ctrl.signal } : {}) });
      if (!res || res.status !== 200) return null;
      const type = (res.headers && res.headers.get ? res.headers.get('content-type') : '') || '';
      if (!/^audio\//.test(type)) return null;
      const blob = await res.blob();
      return blob && blob.size ? blob : null;
    } catch (e) {
      return null; // offline, refused, aborted
    }
  })();
  try {
    return await Promise.race([got, late]);
  } finally {
    clearTimer(timer);
  }
}

/**
 * Hear one word: the Waystead voice when it answers in time, else the device.
 * deps: { speaker (voice.js createSpeaker), storage, account() -> { origin, signedIn } | null,
 *         online() -> bool, fetchImpl?, playBlob(blob) -> Promise<bool> }.
 * Resolves 'server', 'device' or false (nothing could speak).
 */
export function createHear(deps) {
  let run = 0;
  const hearWord = async function hearWord(word, { rate } = {}) {
    const mine = ++run;
    const acct = deps.account ? deps.account() : null;
    const saved = deps.savedVoice ? deps.savedVoice() : '';
    const voice = acct ? serverVoiceFor(saved, { signedIn: !!acct.signedIn, online: deps.online ? deps.online() : true }) : null;
    if (voice) {
      const blob = await fetchRecording(voiceUrl(acct.origin, voice, word), deps.fetchImpl ? { fetchImpl: deps.fetchImpl, ...(deps.timer || {}) } : (deps.timer || {}));
      if (mine !== run) return false; // another word was tapped meanwhile
      if (blob && (await deps.playBlob(blob))) return 'server';
    }
    if (mine !== run) return false;
    const sp = deps.speaker;
    if (!sp) return false;
    return (await sp.speak(word, rate ? { rate } : {})) ? 'device' : false;
  };
  // Forget a recording still on its way (the page changed, or Stop).
  hearWord.cancel = () => { run += 1; };
  return hearWord;
}

/**
 * Hear a sentence (Comic Studio): the Waystead voice when it answers in time,
 * else the device. The same deps as createHear. Recordings already fetched
 * this visit are kept in memory (at most 40), so reading a comic again needs
 * no request. Resolves 'server', 'device' or false.
 */
export function createHearLine(deps) {
  let run = 0;
  const kept = new Map();
  const hearLine = async function hearLine(text, { rate } = {}) {
    const mine = ++run;
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return false;
    const acct = deps.account ? deps.account() : null;
    const saved = deps.savedVoice ? deps.savedVoice() : '';
    const voice = acct && t.length <= SENTENCE_MAX ? serverVoiceFor(saved, { signedIn: !!acct.signedIn, online: deps.online ? deps.online() : true }) : null;
    if (voice) {
      const key = voice + '\n' + t;
      let blob = kept.get(key) || null;
      if (!blob) {
        blob = await fetchRecording(sentenceUrl(acct.origin, voice), {
          timeoutMs: SENTENCE_TIMEOUT_MS, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}), ...(deps.timer || {}),
          init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: spokenNumbers(t) }) },
        });
        if (blob) { kept.set(key, blob); if (kept.size > 40) kept.delete(kept.keys().next().value); }
      }
      if (mine !== run) return false;
      if (blob && (await deps.playBlob(blob))) return 'server';
    }
    if (mine !== run) return false;
    const sp = deps.speaker;
    if (!sp) return false;
    return (await sp.speak(t, rate ? { rate } : {})) ? 'device' : false;
  };
  hearLine.cancel = () => { run += 1; };
  return hearLine;
}
