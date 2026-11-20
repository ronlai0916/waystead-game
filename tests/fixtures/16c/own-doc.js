// SB4: a grown-up's own word lists (the masters), kept inside the grown-up's own
// words value at `words.own` (no new account key). Each is sent to up to five
// children as a copy in the child's setup (setup-doc.js `own`). Pure: no DOM, no
// storage; `now` comes in.
//
//   { [oid]: { name 1..40, words: [1..15], src: 'typed'|'scan', at, gone?: ms, to: [childId, ≤5] } }
//
// MERGE: per id, the later `at` wins (a tie: the larger JSON). A deleted list is
// kept as `gone` for 30 days (a grown-up can bring it back), then trim drops it.

export const MAX_LISTS = 30;
export const MAX_WORDS = 15;
export const MAX_TO = 5;
export const MAX_NAME = 40;
export const UNDELETE_DAYS = 30;
const DAY = 86400000;

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const pos = (x) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);
const isWord = (w) => typeof w === 'string' && /^[A-Za-z]{1,20}$/.test(w);
const name40 = (s) => (typeof s === 'string' ? s.trim().slice(0, MAX_NAME) : '');
const uniq = (a) => { const seen = new Set(); return a.filter((w) => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); };

function clean(e) {
  if (!isObj(e) || !pos(e.at)) return null;
  const name = name40(e.name);
  const words = uniq((Array.isArray(e.words) ? e.words : []).filter(isWord)).slice(0, MAX_WORDS);
  if (!name || !words.length || !['typed', 'scan'].includes(e.src)) return null;
  const to = [...new Set((Array.isArray(e.to) ? e.to : []).filter((c) => typeof c === 'string' && c))].slice(0, MAX_TO);
  return { name, words, src: e.src, at: e.at, ...(pos(e.gone) ? { gone: pos(e.gone) } : {}), to };
}

export function normalise(x) {
  const out = {};
  if (!isObj(x)) return out;
  for (const [id, e] of Object.entries(x)) {
    const c = clean(e);
    if (c) out[id] = c;
  }
  return out;
}
export const isEmpty = (x) => Object.keys(normalise(x)).length === 0;

export function merge(a, b) {
  const x = normalise(a);
  const y = normalise(b);
  const out = {};
  for (const id of new Set([...Object.keys(x), ...Object.keys(y)])) {
    const p = x[id];
    const q = y[id];
    out[id] = !p ? q : !q ? p : q.at > p.at || (q.at === p.at && JSON.stringify(q) > JSON.stringify(p)) ? q : p;
  }
  return out;
}
export function trim(x, now) {
  return Object.fromEntries(Object.entries(normalise(x)).filter(([, e]) => !e.gone || now - e.gone <= UNDELETE_DAYS * DAY));
}

export const live = (x) => Object.entries(normalise(x)).filter(([, e]) => !e.gone)
  .map(([id, e]) => ({ id, ...e })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
export const deleted = (x, now) => Object.entries(normalise(x)).filter(([, e]) => e.gone && now - e.gone < UNDELETE_DAYS * DAY)
  .map(([id, e]) => ({ id, ...e })).sort((a, b) => b.gone - a.gone || a.id.localeCompare(b.id));

const nextAt = (prev, now) => Math.max(now, (prev ? prev.at : 0) + 1);

/** Make or edit a list (the oid never changes). Answers { own } or { error: 'too-many' | 'no-words' | 'too-many-words' | 'no-name' }. */
export function set(x, oid, { name, words, src, to }, now) {
  const own = isObj(x) ? x : {};
  const prev = own[oid];
  const n = name40(name);
  if (!n) return { error: 'no-name' };
  const list = uniq((Array.isArray(words) ? words : []).map((w) => (typeof w === 'string' ? w.trim() : w)).filter(isWord));
  if (!list.length) return { error: 'no-words' };
  if (list.length > MAX_WORDS) return { error: 'too-many-words' };
  if (live(own).filter((e) => e.id !== oid).length >= MAX_LISTS) return { error: 'too-many' };
  const e = { name: n, words: list, src: src === 'scan' ? 'scan' : 'typed', at: nextAt(prev, now), to: [...new Set((Array.isArray(to) ? to : []).filter((c) => typeof c === 'string' && c))].slice(0, MAX_TO) };
  return { own: { ...own, [oid]: e } };
}
export function drop(x, oid, now) {
  const own = isObj(x) ? x : {};
  const e = own[oid];
  return e && !e.gone ? { ...own, [oid]: { ...e, at: nextAt(e, now), gone: now } } : own;
}
/** Bring a deleted list back inside 30 days. Answers { own } or { error: 'too-many' | 'not-there' }. */
export function restore(x, oid, now) {
  const own = isObj(x) ? x : {};
  const e = own[oid];
  if (!e || !e.gone || now - e.gone >= UNDELETE_DAYS * DAY) return { error: 'not-there' };
  if (live(own).length >= MAX_LISTS) return { error: 'too-many' };
  const { gone, ...kept } = e;
  return { own: { ...own, [oid]: { ...kept, at: nextAt(e, now) } } };
}

// ---- sending to children ----------------------------------------------------------
/**
 * One row for each list and child it concerns. childSetups = { [childId]: setup value }.
 *   'behind': the child should have it (in `to`, list live) but has no live copy, or an older one
 *   'remove': the child has a live copy but is not in `to`, or the list is gone
 *   'sent':   in step
 */
export function delivery(master, childSetups) {
  const own = isObj(master) ? master : {};
  const kids = isObj(childSetups) ? childSetups : {};
  const out = [];
  for (const [oid, m] of Object.entries(own)) {
    const ids = new Set([...(m.to || []), ...Object.keys(kids)]);
    for (const childId of ids) {
      const copy = ((kids[childId] && kids[childId].own) || {})[oid];
      const has = !!copy && !copy.gone;
      const want = !m.gone && (m.to || []).includes(childId);
      if (want) out.push({ oid, childId, state: !has || copy.at < m.at ? 'behind' : 'sent' });
      else if (has) out.push({ oid, childId, state: 'remove' });
    }
  }
  return out;
}

/**
 * A live copy on a child with no master entry at all becomes a master entry (`to` = the children holding it):
 * the repair after an old app dropped the grown-up's field. Answers the new own map.
 */
export function adopt(master, childSetups, now) {
  const own = isObj(master) ? { ...master } : {};
  const kids = isObj(childSetups) ? childSetups : {};
  const found = new Map();
  for (const [childId, s] of Object.entries(kids)) {
    for (const [oid, c] of Object.entries((s && s.own) || {})) {
      if (c.gone || oid in own) continue;
      const f = found.get(oid);
      if (!f) found.set(oid, { copy: c, to: [childId] });
      else { f.to.push(childId); if (c.at > f.copy.at) f.copy = c; }
    }
  }
  let added = live(own).length;
  for (const [oid, { copy, to }] of found) {
    if (added >= MAX_LISTS) break;
    const e = clean({ ...copy, to: to.slice(0, MAX_TO), at: copy.at || now });
    if (e) { own[oid] = e; added += 1; }
  }
  return own;
}
