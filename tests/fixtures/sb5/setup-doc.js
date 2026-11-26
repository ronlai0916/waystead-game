// SB4: a child's setup, kept inside the child's words value at `words.setup`
// (no new account key). Written only by grown-up pages. Pure: no DOM, no storage,
// no clock: `now` comes in as an argument. Imports nothing from words-doc.
//
//   { help?:    { lv: 1..5, at, by? },                  tile help (5 = keyboard)
//     profile?: { p: 'sen'|'normal'|'top', at, by? },   how the tests are run
//     offer?:   { quiz: boolean, exam: boolean, at },   which checks are offered
//     exams?:   { [eid]: { name, words[1..20], from[], date: 'YYYY-MM-DD', at, gone?, reopen? } },
//     own?:     { [oid]: { name, words[1..15], src: 'typed'|'scan', at, gone?, info? } } }   copies of a grown-up's lists
//     by?:      { n: 'Mum', at }    SB5 (D34): the name the grown-up chose, which the child sees as "Set by Mum"
//
// SB5 additions (WP-A2): own[oid].info (TR-93: the grown-up's sentences and meanings, cleaned by info-doc.js cleanInfo) and `by`
// (TR-100: cleanName, setBy). 16c devices drop both on re-save; nothing else is lost.
//
// Every part is optional: absent means today's behaviour. MERGE: help, profile,
// offer: the later `at` wins (a tie: the larger JSON; absent loses to present);
// exams and own: per id, the later `at` wins. A reset time never clears any of it.
// SIZE: trim drops own copies gone for over 30 days and exams gone for over 90.

import { cleanInfo } from './info-doc.js';

export const TILES_LIVE = true; // SB4-B: letter tiles are on
export const MAX_EXAMS = 10;
export const MAX_OWN = 30;
export const MAX_EXAM_WORDS = 20;
export const MAX_OWN_WORDS = 15;
export const MAX_NAME = 40;
const DAY = 86400000;
const PROFILES = ['sen', 'normal', 'top'];

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const pos = (x) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);
const isWord = (w) => typeof w === 'string' && /^[A-Za-z]{1,20}$/.test(w);
const isDay = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
const name40 = (s) => (typeof s === 'string' ? s.trim().slice(0, MAX_NAME) : '');
const by = (s) => name40(s);
const wordsOf = (a, max) => (Array.isArray(a) ? a.filter(isWord).slice(0, max) : []);
const j = (x) => JSON.stringify(x);

function stamp(x, at) { return { ...x, at }; }
function cleanEntry(e, extra) {
  if (!isObj(e)) return null;
  const at = pos(e.at);
  if (!at) return null;
  return extra(e, at);
}
function cleanExam(e) {
  return cleanEntry(e, (x, at) => {
    const name = name40(x.name);
    const words = wordsOf(x.words, MAX_EXAM_WORDS);
    if (!name || !words.length || !isDay(x.date)) return null;
    const from = (Array.isArray(x.from) ? x.from.filter((s) => typeof s === 'string' && s.length > 0 && s.length <= 60) : []).slice(0, 20);
    return { name, words, from, date: x.date, at, ...(pos(x.gone) ? { gone: pos(x.gone) } : {}), ...(pos(x.reopen) ? { reopen: pos(x.reopen) } : {}) };
  });
}
function cleanOwn(e) {
  return cleanEntry(e, (x, at) => {
    const name = name40(x.name);
    const words = wordsOf(x.words, MAX_OWN_WORDS);
    if (!name || !words.length || !['typed', 'scan'].includes(x.src)) return null;
    const info = cleanInfo(x.info, words);
    return { name, words, src: x.src, at, ...(info ? { info } : {}), ...(pos(x.gone) ? { gone: pos(x.gone) } : {}) };
  });
}

// ---- the grown-up's chosen name (TR-100) -------------------------------------------------------------
export const NAME_LINE = 'Please use a name only, like Mum or Ms Patel.';
/** The name a child may see: trimmed, spaces collapsed, 1 to 24 characters, 1 to 3 words, letters (any alphabet), spaces, ' . -, starting with a letter; no @, web address or digit. Else ''. */
export function cleanName(s) {
  const t = typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
  if (!/^\p{L}[\p{L} '’.\-]{0,23}$/u.test(t)) return '';
  if (t.split(' ').length > 3 || /@|:\/\/|www\.|\d/i.test(t)) return '';
  return t;
}

/** Whatever arrives: a clean setup value, or {}. Each bad part is dropped. */
export function normalise(x) {
  if (!isObj(x)) return {};
  const out = {};
  if (isObj(x.help) && Number.isInteger(x.help.lv) && x.help.lv >= 1 && x.help.lv <= 5 && pos(x.help.at)) {
    out.help = { lv: x.help.lv, at: x.help.at, ...(by(x.help.by) ? { by: by(x.help.by) } : {}) };
  }
  if (isObj(x.profile) && PROFILES.includes(x.profile.p) && pos(x.profile.at)) {
    out.profile = { p: x.profile.p, at: x.profile.at, ...(by(x.profile.by) ? { by: by(x.profile.by) } : {}) };
  }
  if (isObj(x.offer) && typeof x.offer.quiz === 'boolean' && typeof x.offer.exam === 'boolean' && pos(x.offer.at)) {
    out.offer = { quiz: x.offer.quiz, exam: x.offer.exam, at: x.offer.at };
  }
  if (isObj(x.by) && cleanName(x.by.n) && pos(x.by.at)) out.by = { n: cleanName(x.by.n), at: x.by.at };
  for (const [field, clean] of [['exams', cleanExam], ['own', cleanOwn]]) {
    if (!isObj(x[field])) continue;
    const m = {};
    for (const [id, e] of Object.entries(x[field])) {
      const c = clean(e);
      if (c) m[id] = c;
    }
    if (Object.keys(m).length) out[field] = m;
  }
  return out;
}
export const isEmpty = (x) => Object.keys(normalise(x)).length === 0;

// ---- what the app does with it ----------------------------------------------------
/** The tile level to use: 1..5 (5 = keyboard). Not live: always 5. */
export function effectiveLevel(setup, year, live = TILES_LIVE) {
  if (!live) return 5;
  const h = helpOf(setup);
  if (h) return h.lv;
  if (year === 1) return 2;
  if (year === 2) return 3;
  return 5;
}
export function effectiveProfile(setup, live = TILES_LIVE) {
  if (!live) return 'normal';
  const p = profileOf(setup);
  return p ? p.p : 'normal';
}
export function offers(setup) {
  const o = isObj(setup) && isObj(setup.offer) ? setup.offer : {};
  return { quiz: o.quiz !== false, exam: o.exam !== false };
}

// ---- reads ------------------------------------------------------------------------
export const helpOf = (x) => (isObj(x) && isObj(x.help) ? x.help : null);
export const profileOf = (x) => (isObj(x) && isObj(x.profile) ? x.profile : null);
export const liveExams = (x) => Object.entries((isObj(x) && x.exams) || {}).filter(([, e]) => !e.gone)
  .map(([id, e]) => ({ id, ...e })).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
export const liveOwn = (x) => Object.entries((isObj(x) && x.own) || {}).filter(([, e]) => !e.gone)
  .map(([id, e]) => ({ id, ...e })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

// ---- merge and trim ---------------------------------------------------------------
// The later `at` wins; a tie goes to the larger JSON; absent loses to present.
function later(p, q) {
  if (!p) return q;
  if (!q) return p;
  return q.at > p.at || (q.at === p.at && j(q) > j(p)) ? q : p;
}
export function merge(a, b) {
  const x = normalise(a);
  const y = normalise(b);
  const out = {};
  for (const f of ['help', 'profile', 'offer', 'by']) {
    const v = later(x[f], y[f]);
    if (v) out[f] = v;
  }
  for (const f of ['exams', 'own']) {
    const m = {};
    for (const id of new Set([...Object.keys(x[f] || {}), ...Object.keys(y[f] || {})])) m[id] = later((x[f] || {})[id], (y[f] || {})[id]);
    if (Object.keys(m).length) out[f] = m;
  }
  return out;
}
export function trim(x, now) {
  const s = normalise(x);
  const out = { ...s };
  for (const [f, days] of [['own', 30], ['exams', 90]]) {
    if (!s[f]) continue;
    const m = Object.fromEntries(Object.entries(s[f]).filter(([, e]) => !e.gone || now - e.gone <= days * DAY));
    if (Object.keys(m).length) out[f] = m; else delete out[f];
  }
  return out;
}

// ---- changes (each returns a new value) -------------------------------------------
const next = (prev, now) => Math.max(now, (prev ? prev.at : 0) + 1);
const base = (x) => (isObj(x) ? x : {});
export function setHelp(x, lv, now, who) {
  const s = base(x);
  return { ...s, help: { lv, at: next(s.help, now), ...(by(who) ? { by: by(who) } : {}) } };
}
export function setProfile(x, p, now, who) {
  const s = base(x);
  return { ...s, profile: { p, at: next(s.profile, now), ...(by(who) ? { by: by(who) } : {}) } };
}
export function setOffer(x, { quiz, exam }, now) {
  const s = base(x);
  return { ...s, offer: { quiz: !!quiz, exam: !!exam, at: next(s.offer, now) } };
}
/** Answers { setup } or { error: 'too-many' | 'bad' }. Editing keeps `reopen`; it brings a dropped exam back. */
export function setExam(x, eid, { name, words, from, date }, now) {
  const s = base(x);
  const prev = (s.exams || {})[eid];
  if (liveExams(s).filter((e) => e.id !== eid).length >= MAX_EXAMS) return { error: 'too-many' };
  const e = cleanExam({ name, words, from, date, at: next(prev, now), ...(prev && prev.reopen ? { reopen: prev.reopen } : {}) });
  if (!e) return { error: 'bad' };
  return { setup: { ...s, exams: { ...(s.exams || {}), [eid]: e } } };
}
export function dropExam(x, eid, now) {
  const s = base(x);
  const e = (s.exams || {})[eid];
  return e ? { ...s, exams: { ...s.exams, [eid]: { ...e, at: next(e, now), gone: now } } } : s;
}
export function reopenExam(x, eid, now) {
  const s = base(x);
  const e = (s.exams || {})[eid];
  return e ? { ...s, exams: { ...s.exams, [eid]: { ...e, at: next(e, now), reopen: now } } } : s;
}
/** A copy of a grown-up's list on this child. It keeps the master's `at`. Answers { setup } or { error }. */
export function setOwnCopy(x, oid, { name, words, src, info }, at) {
  const s = base(x);
  if (liveOwn(s).filter((e) => e.id !== oid).length >= MAX_OWN) return { error: 'too-many' };
  const e = cleanOwn({ name, words, src, info, at });
  if (!e) return { error: 'bad' };
  return { setup: { ...s, own: { ...(s.own || {}), [oid]: e } } };
}
export function dropOwnCopy(x, oid, now) {
  const s = base(x);
  const e = (s.own || {})[oid];
  return e ? { ...s, own: { ...s.own, [oid]: { ...e, at: next(e, now), gone: now } } } : s;
}
/** SB5: set (or, with n === '', remove) the name the child sees. Unchanged when the name is the same. Answers the new setup. */
export function setBy(x, n, now) {
  const s = base(x);
  const name = cleanName(n);
  if (!name) {
    if (!s.by) return s;
    const { by: gone, ...rest } = s;
    return rest;
  }
  if (s.by && s.by.n === name) return s;
  return { ...s, by: { n: name, at: next(s.by, now) } };
}
export const byOf = (x) => (isObj(x) && isObj(x.by) ? x.by : null);
