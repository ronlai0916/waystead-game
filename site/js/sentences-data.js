// SB5-WP-B (TRS-change-2 TR-105 section 6.7): the client of the sentence server on the Waystead account. No DOM, no secret, no model call:
// the account writes and checks the statements; this file only asks for them and CHECKS THEM AGAIN before the app may use one.
//
// SHIPS OFF: `SENTENCES_API = false` means no request is ever made (the grown-up's panel shows "Write your own", the typing fallback, and a
// child's own words simply sit out of the statement games). The switch is turned on by hand when Ron approves the server (deploy checklist);
// even then every answer is gated by the account's allowance (`on: false` / paused / used up -> typing). A 404 (routes not there) means off.
// Every call: credentials 'include', mode 'cors', cache 'no-store', a 30 second time-out. Nothing is logged or stored here except the
// child's small cache (`sb.st:<playerId>`, convenience only, try/catch).
import { gapOf } from './info-doc.js';

export const SENTENCES_API = false;
export const TIMEOUT_MS = 30000;
export const MAX_WORDS = 15;
export const WORD_RE = /^[a-z]{2,20}$/;
const ID_RE = /^[A-Za-z0-9_.:-]{1,24}$/;
const SENT_RE = /^[A-Z][A-Za-z ,.!?'-]{5,139}$/;

/** The words the server will take, as it takes them: lower-case, `[a-z]{2,20}`, once each, at most 15. Anything else is left out. */
export function askable(words) {
  const seen = new Set();
  const out = [];
  for (const w of Array.isArray(words) ? words : []) {
    const k = typeof w === 'string' ? w.trim().toLowerCase() : '';
    if (WORD_RE.test(k) && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out.slice(0, MAX_WORDS);
}

/** One statement from the server, kept only if it is the shape and the rules the app relies on: id, one sentence, the word once as a whole word. */
export function cleanStatement(x, word) {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !ID_RE.test(x.id) || typeof x.s !== 'string') return null;
  if (!SENT_RE.test(x.s) || /[.!?]./.test(x.s.slice(0, -1)) || !/[.!?]$/.test(x.s)) return null;
  if (/\d|@|:\/\/|www\./i.test(x.s)) return null;
  if (!gapOf(x.s, word)) return null;
  return { id: x.id, s: x.s };
}
const cleanList = (list, word) => (Array.isArray(list) ? list.map((x) => cleanStatement(x, word)).filter(Boolean).slice(0, 3) : []);

/** The statements that are not hidden by the grown-up (`info[word].x`, ids). */
export const visible = (statements, hiddenIds = []) => (statements || []).filter((s) => !(hiddenIds || []).includes(s.id));

export function createSentences({ origin, fetch: doFetch = (...a) => globalThis.fetch(...a), enabled = SENTENCES_API, timeoutMs = TIMEOUT_MS } = {}) {
  let off = !enabled; // the session's own kill switch: a 404 or `paused` or `on:false` answer stops further asks

  async function call(method, path, body) {
    if (off) return { ok: false, status: 0, off: true, data: null };
    const ctl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
    const init = { method, credentials: 'include', mode: 'cors', cache: 'no-store', headers: {}, signal: ctl.signal };
    if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    try {
      const res = await doFetch(String(origin).replace(/\/+$/, '') + path, init);
      let data = null;
      if (res.status !== 204) { try { data = await res.json(); } catch (e) { data = null; } }
      const ra = res.headers && typeof res.headers.get === 'function' ? Number(res.headers.get('Retry-After')) : NaN;
      return { ok: res.ok, status: res.status, data, ...(Number.isFinite(ra) && ra > 0 ? { retryAfter: ra } : {}) };
    } catch (e) {
      return { ok: false, status: 0, data: null, ...(timedOut ? { timedOut: true } : {}) };
    } finally { clearTimeout(timer); }
  }

  /** Why a call did not give statements, as one word for the page: it then shows "Write your own". */
  function problemOf(r) {
    const err = r.data && r.data.error;
    if (r.off) return 'off';
    if (r.timedOut) return 'timeout';
    if (r.status === 0) return 'offline';
    if (r.status === 404) { off = true; return 'off'; }
    if (r.status === 503) return 'paused';
    if (r.status === 401) return 'signed-out';
    if (r.status === 403) return err === 'adult-session-required' ? 'playing' : 'forbidden';
    if (r.status === 413) return 'too-many';
    if (r.status === 429) return err === 'hourly-limit' ? 'hourly-limit' : 'monthly-limit';
    return 'other';
  }
  const fail = (r) => ({ problem: problemOf(r), ...(r.retryAfter ? { retryAfter: r.retryAfter } : {}) });

  return {
    get off() { return off; },
    /** { on, left, limit, hourLeft, paused } when the grown-up may ask now, else { on: false, why }. Never counts. */
    async allowance() {
      const r = await call('GET', '/api/sentences/allowance');
      if (!r.ok || !r.data) return { on: false, why: problemOf(r) };
      const d = r.data;
      const n = (x) => (Number.isInteger(x) && x >= 0 ? x : 0);
      if (d.on !== true) { off = true; return { on: false, why: 'off' }; }
      if (d.paused === true) return { on: false, why: 'paused' };
      if (n(d.left) === 0) return { on: false, why: 'monthly-limit', left: 0, limit: n(d.limit) };
      if (n(d.hourLeft) === 0) return { on: false, why: 'hourly-limit', left: n(d.left), limit: n(d.limit) };
      return { on: true, left: n(d.left), limit: n(d.limit), hourLeft: n(d.hourLeft), paused: false };
    },
    /**
     * Ask for statements for these words (a grown-up, as themselves): { items: [{ word, status, statements }], left } or { problem }.
     * Bank hits are free; each new word counts once. A word `writing` is still being written: ask again with fetchFor later.
     * Statements are checked here again; a word whose statements all fail is `failed` (the typing fallback).
     */
    async askFor(words) {
      const list = askable(words);
      if (!list.length) return { items: [], left: null };
      const r = await call('POST', '/api/sentences', { words: list });
      if (!r.ok || !r.data || !Array.isArray(r.data.items)) return fail(r);
      const items = [];
      for (const it of r.data.items) {
        if (!it || typeof it.word !== 'string' || !list.includes(it.word)) continue;
        const status = ['ok', 'partial', 'writing', 'refused', 'failed'].includes(it.status) ? it.status : 'failed';
        const statements = cleanList(it.statements, it.word);
        items.push({ word: it.word, status: status === 'ok' || status === 'partial' ? (statements.length ? status : 'failed') : status, statements });
      }
      return { items, left: Number.isInteger(r.data.left) ? r.data.left : null };
    },
    /** Read only, never writes, never counts (any signed-in player, a child's device too): { items: { [word]: statements } } or { problem }. */
    async fetchFor(words) {
      const list = askable(words);
      if (!list.length) return { items: {} };
      const r = await call('GET', '/api/sentences?words=' + encodeURIComponent(list.join(',')));
      if (!r.ok || !r.data || !Array.isArray(r.data.items)) return fail(r);
      const items = {};
      for (const it of r.data.items) {
        if (!it || typeof it.word !== 'string' || !list.includes(it.word)) continue;
        const s = cleanList(it.statements, it.word);
        if (s.length) items[it.word] = s;
      }
      return { items };
    },
    /** A grown-up flags a statement (hides it for them). Answers { ok } or { problem }. */
    async report(id) {
      if (typeof id !== 'string' || !ID_RE.test(id)) return { problem: 'bad-id' };
      const r = await call('POST', '/api/sentences/report', { id });
      return r.ok || r.status === 204 ? { ok: true } : fail(r);
    },
  };
}

// ---- the child's cache: `sb.st:<playerId>` = { [word]: { s: [{id, s}], at } }, at most 200 words, oldest out (TR-105 6.7) -----------
export const CACHE_KEY = 'sb.st:';
export const CACHE_MAX = 200;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function readCache(storage, playerId) {
  let raw = null;
  try { raw = JSON.parse(storage.getItem(CACHE_KEY + playerId)); } catch (e) { return {}; }
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [w, e] of Object.entries(raw)) {
    if (!WORD_RE.test(w) || !e || !Array.isArray(e.s) || !Number.isFinite(e.at)) continue;
    const s = cleanList(e.s, w);
    if (s.length) out[w] = { s, at: e.at };
  }
  return out;
}
/** Put fetched statements in the cache (`items` = fetchFor's items); words asked and not answered are noted with no statements so they are not asked again today. */
export function mergeCache(cache, asked, items, now) {
  const next = { ...cache };
  for (const w of asked) if (items[w]) next[w] = { s: items[w], at: now }; else if (!next[w]) next[w] = { s: [], at: now };
  const keep = Object.entries(next).sort((a, b) => b[1].at - a[1].at).slice(0, CACHE_MAX);
  return Object.fromEntries(keep);
}
export function writeCache(storage, playerId, cache) {
  try { storage.setItem(CACHE_KEY + playerId, JSON.stringify(cache)); return true; } catch (e) { return false; }
}
/** Which of these words to ask for now: not in the cache, or asked more than a day ago. */
export const needFetch = (cache, words, now) => askable(words).filter((w) => !cache[w] || now - cache[w].at >= DAY_MS);
