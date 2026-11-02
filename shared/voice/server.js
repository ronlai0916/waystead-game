// The Waystead voice (G8c): British recordings made by the account's voice
// server (GET <account>/api/voice/<voiceId>/<word>, MP3), for "Hear" when a
// player is signed in. Anything else — signed out, offline, no answer within
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

export const isServerVoice = (id) => SERVER_VOICES.some((v) => v.id === id);

/** The recording's address on the account service. */
export const voiceUrl = (origin, voice, word) => origin + '/api/voice/' + voice + '/' + encodeURIComponent(word);

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
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t) } = {}) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  const late = new Promise((resolve) => { timer = setTimer(() => { if (ctrl) ctrl.abort(); resolve(null); }, timeoutMs); });
  const got = (async () => {
    try {
      const res = await fetchImpl(url, { credentials: 'include', mode: 'cors', ...(ctrl ? { signal: ctrl.signal } : {}) });
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
