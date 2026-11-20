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
import * as Su from './setup-doc.js';
import * as Ow from './own-doc.js';
import { ROLES } from './role-doc.js';
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
    me: () => call('GET', '/api/me'),
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

// ---- SB5 (TR-107, TR-100): what /api/me says about this grown-up, and how many children are read or written at once ----------
/** Children read or written at the same time (TRS-change-2 TR-107): 15 children, 5 at a time, stays under the account's 429 busy. */
export const POOL = 5;
/**
 * The child limit when the account does not say (before the account sends `childLimit`). MUST STAY 5.
 * RELEASE GATE (CODE-CHECK-2 M4): a list given to more than 5 children is cut back to 5 by any grown-up device still on the 16c
 * build (own-doc.js), and its copies for children 6-15 then flap between "sent" and "removed". So the client never goes above 5 on
 * its own: only an account that sends `childLimit` > 5 raises it (meFacts), and the account must not do that until every 16c
 * grown-up device has updated (deploy checklist). tests/limit-guard-sb5.test.js pins this.
 */
export const DEFAULT_LIMIT = 5;

/** Do `run(item, i)` for every item, at most `size` at a time, and answer the results in the items' order. */
export async function pool(items, run, size = POOL) {
  const out = new Array(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await run(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, lane));
  return out;
}

/**
 * What a /api/me answer says that the app uses (E1): { role, limit, plan, known }.
 *   role  'parent' | 'tutor' | 'teacher' pre-chooses the role card (read only: Spellbright never writes the account role), else ''.
 *   limit the number of children this grown-up may have (`childLimit`, a whole number from 1), else 5.
 *   plan  the account's plan, one of the three role words, else '' (unknown). `known` is true when the account sent a usable `childLimit`.
 * Anything but a signed-in grown-up gives the defaults.
 */
export function meFacts(me) {
  const adult = !!me && typeof me === 'object' && me.signedIn === true && me.kind === 'parent';
  const lim = adult && Number.isInteger(me.childLimit) && me.childLimit >= 1 && me.childLimit <= 1000 ? me.childLimit : null;
  return {
    role: adult && ROLES.includes(me.role) ? me.role : '',
    limit: lim || DEFAULT_LIMIT,
    plan: adult && ROLES.includes(me.plan) ? me.plan : '',
    known: lim !== null,
  };
}
/** How many children a list may be shared with, and a week set for, at most: the account's limit up to the data cap (15). */
export const childCap = (limit) => Math.min(Number.isInteger(limit) && limit >= 1 ? limit : DEFAULT_LIMIT, Ow.MAX_TO);
/** { role, limit, plan, known } from the account, or the defaults when it cannot be reached (never an empty answer). */
export async function readMe(api) {
  const r = await api.me();
  return r.ok ? meFacts(r.data) : meFacts(null);
}

/** { children } or { problem }. */
export async function listChildren(api) {
  const r = await api.children();
  return r.ok && r.data && Array.isArray(r.data.children) ? { children: r.data.children } : { problem: problemOf(r) };
}

/** { words, setup, progress, version } for a child of this adult, or { problem }. */
export async function readChild(api, id) {
  const r = await api.game(id);
  if (!r.ok || !r.data || typeof r.data.items !== 'object') return { problem: problemOf(r) };
  const item = r.data.items[W.DOC_KEY];
  const p = r.data.items.progress;
  const words = W.normalise(item ? item.value : null);
  return { words, setup: W.setupOf(words), progress: normaliseProgress(p ? p.value : null), version: item ? item.version : 0 };
}

/**
 * Change the child's words: change(doc) answers { doc } or { error }. A 409 means
 * the child's device saved first: the change is made again on that newer copy,
 * so nothing they did is lost, and `updated` says so. One value, one PUT: it
 * saves whole or not at all. Answers { ok: true, doc, updated }, { error } (the
 * plan itself is wrong) or { problem }.
 */
export async function changeWords(api, id, change, { tries = 4, now = () => Date.now(), by, skipSame = false } = {}) {
  let updated = false;
  for (let i = 0; i < tries; i += 1) {
    const c = await readChild(api, id);
    if (c.problem) return { problem: c.problem };
    const r = change(c.words);
    if (r.error) return { error: r.error };
    let doc = r.doc;
    // SB5 (TR-100): the name the child sees travels in the SAME write as the change. `by` undefined leaves it alone;
    // a name is set only when it differs; '' takes it away; a name that is not a clean name is ignored (never removes one).
    if (typeof by === 'string' && (by === '' || Su.cleanName(by))) doc = W.withSetup(doc, Su.setBy(W.setupOf(doc), by, now()));
    const value = W.trim(W.normalise(doc), now());
    if (skipSame && JSON.stringify(value) === JSON.stringify(c.words)) return { ok: true, doc: value, updated, unchanged: true };
    const put = await api.put(id, W.DOC_KEY, value, c.version);
    if (put.ok) return { ok: true, doc: value, updated };
    if (put.status !== 409) return { problem: problemOf(put) };
    updated = true;
  }
  return { problem: 'busy' };
}

/**
 * Change the child's setup (SB4): change(setup) answers { setup } or { error }. It is kept inside the child's words
 * value, so this is changeWords with the same 409 retry and the same answers ({ ok, doc, updated }, { error }, { problem }).
 */
export function changeSetup(api, id, change, opts) {
  return changeWords(api, id, (words) => {
    const r = change(W.setupOf(words));
    return r.error ? { error: r.error } : { doc: W.withSetup(words, r.setup) };
  }, opts);
}
