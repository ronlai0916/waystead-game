// Grown-ups: a child's compose data, through the account's /api/children routes
// (as Spellbright's grownups-data.js). 401 signed out; 403 adult-session-required
// for a child's session or an adult playing as a child; 404 no-such-child.
// Nothing here is kept on the adult's device.
import * as W from './writing-doc.js';
import * as K from './comic-doc.js';

const GAME = 'compose';

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
export async function listChildren(api) {
  const r = await api.children();
  return r.ok && r.data && Array.isArray(r.data.children) ? { children: r.data.children } : { problem: problemOf(r) };
}
/** { writing, comics, marks, settings, versions } or { problem }. */
export async function readChild(api, id) {
  const r = await api.game(id);
  if (!r.ok || !r.data || typeof r.data.items !== 'object') return { problem: problemOf(r) };
  const it = r.data.items;
  const v = (k) => (it[k] ? it[k].value : null);
  return {
    writing: W.normalise(v(W.DOC_KEY)), comics: K.normaliseComics(v(K.COMICS_KEY)), marks: W.normaliseMarks(v(W.MARKS_KEY)), settings: W.normaliseSettings(v(W.SETTINGS_KEY)),
    versions: Object.fromEntries(Object.entries(it).map(([k, x]) => [k, x.version])),
  };
}
/**
 * Change one of the parent's values. change(child) answers the new value, or
 * { error }. A 409 means someone saved first: it's made again on the newer copy.
 */
export async function changeValue(api, id, key, change, { tries = 4 } = {}) {
  let updated = false;
  for (let i = 0; i < tries; i += 1) {
    const c = await readChild(api, id);
    if (c.problem) return { problem: c.problem };
    const value = change(c);
    if (value.error) return { error: value.error };
    const put = await api.put(id, key, value, c.versions[key] || 0);
    if (put.ok) return { ok: true, value, updated };
    if (put.status !== 409) return { problem: problemOf(put) };
    updated = true;
  }
  return { problem: 'busy' };
}
export const setAiFeedback = (api, id, on, now) => changeValue(api, id, W.SETTINGS_KEY, () => ({ v: 1, aiFeedback: !!on, at: now }));
export function saveMark(api, id, pieceId, fields, now) {
  return changeValue(api, id, W.MARKS_KEY, (c) => { const r = W.setMark(c.marks, pieceId, fields, now); return r.error ? r : r.doc; });
}
