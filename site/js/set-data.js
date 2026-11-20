// SB5-WP-B (TR-15, TR-16, TR-30c, TR-71, TR-72, TRS-change-2 TR-100/TR-107): the account writes for "Set a week". No DOM: the account
// comes in as `api` (grownups-data.js createChildApi), the clock as `now`, and the signed-in player's words value is the one in store.js.
//
// One PUT per child: the week, the list's copy (with its `info`) and the name the child sees (`setup.by`) go in the SAME change function,
// so a child's value is saved whole or not at all and nothing the child did meanwhile is lost (a 409 re-reads and redoes the change).
// Children are read and written at most 5 at a time (15 children stay under the account's 429 busy).
//
// Answers always say what happened per child, never an empty answer: { ok, updated } | { error } (the plan itself is wrong) | { problem }
// (problemOf: network, signed-out, playing, no-child, too-big, busy, other).
import * as S from './store.js';
import * as W from './words-doc.js';
import * as Ow from './own-doc.js';
import * as Su from './setup-doc.js';
import * as SET from './set-doc.js';
import * as A from './grownups-data.js';
import { saveOwnMaster } from './own-data.js';

const NO_GIDS = 'no-week-id';

/** Five lower-case hex characters, for a week id. The random source is passed in so a test is deterministic. */
export function hex5(rand = () => globalThis.crypto.getRandomValues(new Uint8Array(3))) {
  return [...rand()].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 5);
}
/**
 * One week id per ticked child, made once per open form and reused on every retry (idempotent, TR-12): `<oid>.<role letter><5 hex>`
 * (`a.` when the words came from no list). role = 'parent' | 'tutor' | 'teacher'. Answers { [cid]: gid }.
 */
export function makeGids(cids, { oid = '', role = 'parent', rand } = {}) {
  return Object.fromEntries((cids || []).map((c) => [c, SET.weekId(oid, role, hex5(rand))]));
}

/** Read each child (5 at a time): [{ id, d, setup, progress, version } | { id, problem }]. For the defaults and the children step. */
export async function readKids(api, kids) {
  const rs = await A.pool(kids, (k) => A.readChild(api, k.id));
  return kids.map((k, i) => (rs[i].problem ? { id: k.id, problem: rs[i].problem } : { id: k.id, d: rs[i].words, setup: rs[i].setup, progress: rs[i].progress, version: rs[i].version }));
}

const brief = (r) => (r.ok ? { ok: true, ...(r.updated ? { updated: true } : {}), ...(r.unchanged ? { unchanged: true } : {}) } : r.error ? { error: r.error } : { problem: r.problem });

/**
 * The master's `to` becomes `to` plus the ticked children (up to 15, the data cap). Nothing is written when they are all there.
 * Answers { ok, entry, toCut } | { error: 'not-there' } | { problem }.
 */
function widenTo(oid, cids, now) {
  const own = Ow.normalise(W.ownOf(S.readWords()));
  const e = own[oid];
  if (!e || e.gone) return { error: 'not-there' };
  const to = [...new Set([...e.to, ...cids])];
  const kept = to.slice(0, Ow.MAX_TO);
  if (kept.length === e.to.length && kept.every((c, i) => c === e.to[i])) return { ok: true, entry: e, toCut: to.length - kept.length };
  const made = saveOwnMaster({ oid, name: e.name, words: e.words, src: e.src, to: kept }, { now });
  if (!made.ok) return made.error ? { error: made.error } : { problem: made.problem };
  return { ok: true, entry: made.entry, toCut: to.length - kept.length };
}

/**
 * TR-15. For each ticked child ONE write: the week (10-word rule, date rule), the list's copy with its `info` when the week came from a
 * list, and `by`. A week already there (a retry after an unseen success) comes back unchanged. First the master's `to` becomes
 * `to` + the ticked children; if that fails nothing is sent to any child.
 * params: { oid ('' = no list), cids, gids: { [cid]: gid }, name, test, words, today }. opts: { now, by } (`by` = the name the child sees).
 * Answers { results: { [cid]: { ok } | { error } | { problem } }, master: { ok, toCut } | { error } | { problem } }.
 */
export async function setWeek(api, { oid = '', cids = [], gids = {}, name, test, words, today }, { now = () => Date.now(), by } = {}) {
  if (!S.currentPlayer()) return { results: {}, master: { problem: 'signed-out' } };
  let copy = null;
  let copyAt = 0;
  let master = { ok: true };
  if (oid) {
    const w = widenTo(oid, cids, now);
    if (!w.ok) return { results: {}, master: w.error ? { error: w.error } : { problem: w.problem } };
    master = { ok: true, ...(w.toCut ? { toCut: w.toCut } : {}) };
    copy = { name: w.entry.name, words: w.entry.words, src: w.entry.src, ...(w.entry.info ? { info: w.entry.info } : {}) };
    copyAt = w.entry.at;
  }
  const rs = await A.pool(cids, (cid) => {
    const gid = gids[cid];
    if (!gid) return Promise.resolve({ error: NO_GIDS });
    const once = (g) => A.changeWords(api, cid, (d) => SET.setChange(d, { gid: g, name, test, words, oid, copy, copyAt }, { today, now: now() }), { now, by });
    return once(gid).then(async (r) => {
      // a collision with another week of this child (SET.ID_TAKEN): make a new id, up to 3 times, and tell the caller through `gids`
      for (let i = 0; i < 3 && r && r.error === SET.ID_TAKEN; i += 1) {
        gids[cid] = gid.slice(0, -5) + hex5();
        r = await once(gids[cid]);
      }
      return r;
    });
  });
  return { results: Object.fromEntries(cids.map((c, i) => [c, brief(rs[i])])), master };
}

/**
 * TR-16. Typed or scanned words become a Word list first (the master only: its copy goes inside each child's week PUT, TR-71), then setWeek.
 * params: setWeek's (no oid) + { words, src: 'typed' | 'scan', listName (default: name), info }. A list at the limit (or any list error) answers
 * { error } before any child call; a week that cannot be made (date, words) answers { error: 'week', line } before the list is saved.
 * Answers setWeek's answer plus { oid }, or { error } | { problem }.
 */
export async function setWeekFromWords(api, { words, src = 'typed', name, listName, info, cids = [], gids = {}, test, today, addTo = '' }, opts = {}) {
  if (!S.currentPlayer()) return { problem: 'signed-out' };
  const line = SET.setProblem({ cids, words, test, today });
  if (line) return { error: 'week', line };
  const now = opts.now || (() => Date.now());
  const isReady = opts.isReady || null;
  let made;
  if (addTo) { // the typed words join a chosen list (its name, children and sentences stay)
    const into = Ow.normalise(W.ownOf(S.readWords()))[addTo];
    if (!into || into.gone) return { error: 'not-there' };
    const lc = (w) => String(w).toLowerCase();
    const merged = [...into.words, ...words.filter((w) => !into.words.some((x) => lc(x) === lc(w)))];
    if (merged.length > Ow.MAX_WORDS) return { error: 'too-many-words' };
    made = saveOwnMaster({ oid: addTo, name: into.name, words: merged, src: into.src, to: [...new Set([...into.to, ...cids])].slice(0, Ow.MAX_TO), info: into.info }, { now, isReady });
  } else made = saveOwnMaster({ name: listName || name, words, src, to: cids.slice(0, Ow.MAX_TO), info }, { now, isReady });
  if (!made.ok) return made.error ? { error: made.error } : { problem: made.problem };
  // The week ids were made before the list had an id ('a.<role letter><5 hex>'): they now carry the list's id, so the weeks can be tied to it.
  const withList = Object.fromEntries(cids.map((c) => { const g = gids[c]; return [c, typeof g === 'string' && g.startsWith('a.') ? SET.weekId(made.oid, g.charAt(2), g.slice(3)) : g]; }));
  const r = await setWeek(api, { oid: made.oid, cids, gids: withList, name, test, words, today }, opts);
  return { ...r, oid: made.oid, gids: withList };
}

// ---- change, delete and bring back a week (TR-18): one child's own group, so one child per call -----------------------
/** Change this child's week (only the keys given: words, test, name). Answers { ok } | { error } | { problem }. */
export async function changeWeek(api, cid, gid, changes, { today, now = () => Date.now(), by } = {}) {
  return brief(await A.changeWords(api, cid, (d) => SET.weekChange(d, gid, changes, { today, now: now() }), { now, by }));
}
/** Delete this child's week (it can be brought back for 30 days; its tries stay). */
export async function deleteWeek(api, cid, gid, { now = () => Date.now(), by } = {}) {
  return brief(await A.changeWords(api, cid, (d) => (d.groups && d.groups[gid] ? { doc: W.deleteGroup(d, gid, now()) } : { error: 'That week has gone.' }), { now, by }));
}
/** Bring a deleted week back (a live week with the same words and test date refuses it kindly). */
export async function restoreWeek(api, cid, gid, { now = () => Date.now(), by } = {}) {
  return brief(await A.changeWords(api, cid, (d) => W.restoreGroup(d, gid, now()), { now, by }));
}

// ---- the name the child sees (TR-100) ---------------------------------------------------------------------------
/**
 * After a name change (00b Save): one setup change per child, one after another (E7 + E8, the 409 retry as ever). A child who already has
 * the name is not written again (checked on a fresh read inside the change, never on a stale one). n = '' takes the name away. Failures are silent: the next
 * write to that child carries the name. Answers { [cid]: { ok } | { error } | { problem } }.
 */
export async function pushName(api, kids, n, { now = () => Date.now() } = {}) {
  const name = n === '' ? '' : Su.cleanName(n);
  const out = {};
  if (n !== '' && !name) return Object.fromEntries(kids.map((k) => [k.id, { error: 'bad-name' }]));
  for (const k of kids) {
    out[k.id] = brief(await A.changeSetup(api, k.id, (s) => ({ setup: Su.setBy(s, name, now()) }), { now, skipSame: true }));
  }
  return out;
}
