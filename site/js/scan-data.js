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
    return { ok: res.ok, status: res.status, data };
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
