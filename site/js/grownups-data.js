// Grown-ups: reading and changing a child's Spellbright data, for an adult
// signed in as themselves. Nothing here is kept on the adult's device: each page
// asks the account, and a child's words stay in memory while it's on show.
//
// The routes are the Waystead account's (its README; since waystead-account 2204de9):
//
//   GET /api/children                             { children: [{ id, nickname, year, avatar }] }
//   GET /api/children/:id/game/spellbright        { game, items }, as /api/game/:game
//   PUT /api/children/:id/game/spellbright/:key   { value, version }, as /api/game/:game/:key
//
// All three: 401 signed out; 403 adult-session-required for a child's session or
// an adult playing as a child; 404 no-such-child for anyone who isn't this adult's.
// CHILD_DATA_API turns Plan and Dashboard off again, should that ever be needed.
//
// Fetch with credentials: 'include' only, as the account client does.
import * as W from './words-doc.js';
import { normalise as normaliseProgress } from './progress-doc.js';

export const CHILD_DATA_API = true;
const GAME = 'spellbright';

export function createChildApi({ origin, fetch: doFetch = (...a) => globalThis.fetch(...a) }) {
  async function call(method, path, body) {
    const init = { method, credentials: 'include', mode: 'cors', cache: 'no-store', headers: {} };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    try {
      const res = await doFetch(origin + path, init);
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: null };
    }
  }
  const child = (id) => '/api/children/' + encodeURIComponent(id) + '/game/' + GAME;
  return {
    children: () => call('GET', '/api/children'),
    game: (id) => call('GET', child(id)),
    put: (id, key, value, version) => call('PUT', child(id) + '/' + encodeURIComponent(key), { value, version }),
  };
}

/**
 * Why a call failed, for the page to say so. Never an empty answer: a failure
 * mustn't look like "no children yet".
 *   'network' 'signed-out' 'playing' 'no-child' 'too-big' 'busy' 'other'
 */
export function problemOf(r) {
  const error = r.data && r.data.error;
  if (r.status === 0) return 'network';
  if (r.status === 401) return 'signed-out';
  if (r.status === 403 && error === 'adult-session-required') return 'playing';
  if (r.status === 404 && error === 'no-such-child') return 'no-child';
  if (r.status === 413) return 'too-big';
  if (r.status === 429) return 'busy';
  return 'other';
}

/** { children } or { problem }. */
export async function listChildren(api) {
  const r = await api.children();
  return r.ok && r.data && Array.isArray(r.data.children) ? { children: r.data.children } : { problem: problemOf(r) };
}

/** { words, progress, version } for a child of this adult, or { problem }. */
export async function readChild(api, id) {
  const r = await api.game(id);
  if (!r.ok || !r.data || typeof r.data.items !== 'object') return { problem: problemOf(r) };
  const item = r.data.items[W.DOC_KEY];
  const p = r.data.items.progress;
  return { words: W.normalise(item ? item.value : null), progress: normaliseProgress(p ? p.value : null), version: item ? item.version : 0 };
}

/**
 * Change the child's words: change(doc) answers { doc } or { error }. A 409 means
 * the child's device saved first: the change is made again on that newer copy,
 * so nothing they did is lost, and `updated` says so. One value, one PUT: it
 * saves whole or not at all. Answers { ok: true, doc, updated }, { error } (the
 * plan itself is wrong) or { problem }.
 */
export async function changeWords(api, id, change, { tries = 4, now = () => Date.now() } = {}) {
  let updated = false;
  for (let i = 0; i < tries; i += 1) {
    const c = await readChild(api, id);
    if (c.problem) return { problem: c.problem };
    const r = change(c.words);
    if (r.error) return { error: r.error };
    const value = W.trim(W.normalise(r.doc), now());
    const put = await api.put(id, W.DOC_KEY, value, c.version);
    if (put.ok) return { ok: true, doc: value, updated };
    if (put.status !== 409) return { problem: problemOf(put) };
    updated = true;
  }
  return { problem: 'busy' };
}
