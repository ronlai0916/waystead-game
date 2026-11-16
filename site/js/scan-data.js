// SB4-WP8: the three scan calls. Not shared/account/api.js, which is JSON-only: the photo goes as raw bytes.
// Nothing here logs, stores or caches an answer or the photo. Every call answers { ok, status, data, timedOut? }:
// data is null when the body is not JSON; status is 0 on a network error or a timeout.
import { TIMEOUT_MS } from './scan-doc.js';

async function call(url, init, signal) {
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, TIMEOUT_MS);
  const onAbort = () => ctl.abort();
  if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener('abort', onAbort, { once: true }); }
  try {
    const res = await fetch(url, { ...init, credentials: 'include', mode: 'cors', cache: 'no-store', signal: ctl.signal });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    const out = { ok: res.ok, status: res.status, data };
    const ra = res.headers && typeof res.headers.get === 'function' ? Number(res.headers.get('Retry-After')) : NaN;
    if (Number.isFinite(ra) && ra > 0 && ra <= 7200) out.retryAfter = ra; // seconds, from a 429; a longer wait is not shown as a time
    return out;
  } catch (e) {
    if (timedOut) return { ok: false, status: 0, data: null, timedOut: true };
    if (signal && signal.aborted) return { ok: false, status: 0, data: null, aborted: true };
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

const join = (origin, path) => String(origin || '').replace(/\/+$/, '') + path;

export const allowance = (origin, { signal } = {}) => call(join(origin, '/api/scan/allowance'), { method: 'GET' }, signal);

export const consent = (origin, version, { signal } = {}) => call(join(origin, '/api/scan/consent'), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version }),
}, signal);

/** `blob` is the shrunk JPEG itself: the raw body, no JSON, no base64. */
export const scanWords = (origin, blob, { signal } = {}) => call(join(origin, '/api/scan/words'), {
  method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob,
}, signal);

// ---- the words that cross a page change (a sign-in, or "Type the words instead"): sessionStorage, read once ----
export const SCAN_WORDS_KEY = 'sb.scanWords';
const HAND_RE = /^[A-Za-z][A-Za-z']{0,24}$/;
const handWords = (words) => (Array.isArray(words) ? words.filter((w) => typeof w === 'string' && HAND_RE.test(w)).slice(0, 15) : []);

/** Keep up to 15 usable words for the page `to` ('editor' or 'scan'). Never a name, never the photo. */
export function giveScanWords(storage, to, words) {
  storage = storage || globalThis.sessionStorage;
  const w = handWords(words);
  try {
    if (!w.length) { storage.removeItem(SCAN_WORDS_KEY); return false; }
    storage.setItem(SCAN_WORDS_KEY, JSON.stringify({ to, words: w }));
    return true;
  } catch (e) { return false; }
}

/** Read once: the words handed to page `to`, or null. The key is removed whatever it held. */
export function takeScanWords(storage, to) {
  storage = storage || globalThis.sessionStorage;
  let raw = null;
  try { raw = storage.getItem(SCAN_WORDS_KEY); storage.removeItem(SCAN_WORDS_KEY); } catch (e) { return null; }
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || v.to !== to) return null;
    const words = handWords(v.words);
    return words.length ? words : null;
  } catch (e) { return null; }
}

/** Remove the hand-off only if it was written for page `to` (a page that wrote words for itself and was left). */
export function dropScanWords(storage, to) {
  storage = storage || globalThis.sessionStorage;
  try {
    const v = JSON.parse(storage.getItem(SCAN_WORDS_KEY));
    if (v && typeof v === 'object' && v.to === to) storage.removeItem(SCAN_WORDS_KEY);
  } catch (e) { /* nothing to drop */ }
}
