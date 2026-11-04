// "My words" (S1–S3): a player's word groups and every try at them, as one
// saved value: the account key "words" (game "spellbright"), cached on the
// device as "sb.words:<player id>". Signed-in only. Pure: no DOM, no storage;
// the clock comes in as `today` (the device's local date, YYYY-MM-DD) and `now`.
//
//   { v: 1, resetAt,                     ms; "Clear my progress" (0: never)
//     groups:  { [id]: { name, start, test, words, back, at, gone? } },
//     results: [{ id, w: word, d: day, g: group, k: 'p'|'t'|'f', t: wrong
//                 letters, p: peeks, c: clean 1/0, at }],    one per try
//     folded:  { ['<group>|<word>']: { n, t, p, through, days } } }  old tries
//
//   k: 'p' practice, 't' the test, 'f' a fix-up. `back` is the words from
//   earlier groups that came back with this one. `gone` marks a deleted group.
//   `days` keeps what the rules need from folded tries: { [day]: flags }.
//
// MERGE (two devices, or a 409 from the account):
//   · tries: the union by id; every total, star and status is counted from
//     them (and the fold), never added from the two copies;
//   · a group: the copy changed last wins, whole; a deleted group stays
//     deleted until someone changes it later; deleting never loses its tries;
//   · resetAt: the later one; anything before it goes.
// SIZE: a value may be at most 64 KB. Past 48 KB the oldest tries are folded
// (per group and word) until it is under 40 KB, and deleted groups older than
// 90 days are dropped first. Remembered words are not affected by folding.
import { mergeLog, foldOldest } from './account/merge.js';

export const DOC_KEY = 'words';
export const TRIM_AT = 48 * 1024;
export const TRIM_TO = 40 * 1024;
export const MAX_WORDS = 10;
export const MAX_BACK = 3;
export const DEFAULT_DAYS = 7;
export const MAX_DAYS = 28;
export const MAX_NAME = 40;
export const REMEMBER_DAYS = 3; // clean, unaided, on this many different days …
export const REMEMBER_SPAN = 7; // … at least this many days from first to last
export const STARTER_ID = 'starter'; // one id, so two devices make one starter group
const DAY_MS = 86400000;

// What a day of one word in one group came to.
const FIRST = 1; // the first try that day: clean, no peek, no wrong letter
const CLEAN = 2; // spelled clean at some point that day
const TEST_RIGHT = 4;
const TEST_WRONG = 8;
const FIX_FIRST = 16; // a fix-up's first try that day was clean

export const emptyDoc = () => ({ v: 1, resetAt: 0, groups: {}, results: [], folded: {} });
export const sizeOf = (d) => new TextEncoder().encode(JSON.stringify(d)).length;

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const isDay = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
const strings = (x) => (Array.isArray(x) ? x.filter((s) => typeof s === 'string') : []);

// Whatever arrives (an old device, the account): the shape above, or empty.
export function normalise(d) {
  if (!isObj(d) || d.v !== 1) return emptyDoc();
  const out = emptyDoc();
  out.resetAt = num(d.resetAt);
  for (const [id, g] of Object.entries(isObj(d.groups) ? d.groups : {})) {
    if (!isObj(g) || !isDay(g.start) || !isDay(g.test)) continue;
    out.groups[id] = { name: String(g.name || ''), start: g.start, test: g.test, words: strings(g.words), back: strings(g.back), at: num(g.at), ...(g.gone ? { gone: num(g.gone) } : {}) };
  }
  out.results = (Array.isArray(d.results) ? d.results : []).filter((r) => isObj(r) && typeof r.id === 'string' && typeof r.w === 'string'
    && typeof r.g === 'string' && isDay(r.d) && ['p', 't', 'f'].includes(r.k) && num(r.at));
  for (const [key, f] of Object.entries(isObj(d.folded) ? d.folded : {})) {
    if (isObj(f) && key.includes('|')) out.folded[key] = { n: num(f.n), t: num(f.t), p: num(f.p), through: num(f.through), days: isObj(f.days) ? { ...f.days } : {} };
  }
  return out;
}

// ---- days ----------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const utc = (day) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const dayOf = (ms) => { const x = new Date(ms); return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()); };
/** The device's local date. */
export function localDay(ms) { const x = new Date(ms); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
export const addDays = (day, n) => dayOf(utc(day) + n * DAY_MS);
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY_MS);
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Tue 10 Nov" */
export function dayLabel(day) { const x = new Date(utc(day)); return WEEKDAYS[x.getUTCDay()] + ' ' + x.getUTCDate() + ' ' + MONTHS[x.getUTCMonth()]; }
/** ["Tue", "10"], for the top of a grid column. */
export function dayParts(day) { const x = new Date(utc(day)); return [WEEKDAYS[x.getUTCDay()], String(x.getUTCDate())]; }

// ---- groups --------------------------------------------------------------------
export const liveGroups = (d) => Object.entries(d.groups).filter(([, g]) => !g.gone && g.at > d.resetAt)
  .map(([id, g]) => ({ id, ...g })).sort((a, b) => a.test.localeCompare(b.test) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
export const groupById = (d, id) => liveGroups(d).find((g) => g.id === id) || null;
/** Every row of the practice grid: the group's words, then those back again. */
export const rows = (g) => [...g.words, ...g.back];
export const practiceDays = (g) => { const out = []; for (let x = g.start; x < g.test; x = addDays(x, 1)) out.push(x); return out; };
export const defaultName = (test) => 'Words for ' + dayLabel(test).replace(/^\w+ /, '');
export const defaultTest = (today) => addDays(today, DEFAULT_DAYS);
const uniqueWords = (ws) => { const seen = new Set(); return ws.filter((w) => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); };

function checkTest(test, today, start) {
  if (!isDay(test)) return 'Please choose a test date.';
  if (test <= today) return 'The test date needs to be after today.';
  if (daysBetween(start, test) > MAX_DAYS) return 'Please choose a test date within ' + MAX_DAYS + ' days.';
  return '';
}
function checkWords(words) {
  if (!words.length) return 'Please add at least one word.';
  return words.length > MAX_WORDS ? 'A group can have up to ' + MAX_WORDS + ' words.' : '';
}

/** A new group, with up to 3 words back from earlier groups. Answers { doc, id } or { error }. */
export function createGroup(d, { id, name, test, words, today, now }) {
  const list = uniqueWords(words);
  const when = test || defaultTest(today);
  const error = checkWords(list) || checkTest(when, today, today);
  if (error) return { error };
  const back = returningWords(d, today, list, MAX_BACK);
  const g = { name: String(name || '').trim().slice(0, MAX_NAME) || defaultName(when), start: today, test: when, words: list, back, at: now };
  return { doc: { ...d, groups: { ...d.groups, [id]: g } }, id };
}

/** The first group, made for the player. Its time is the lowest that survives a reset, so anything real from another device wins over it. */
export function starterGroup(d, { name, words, today }) {
  const g = { name, start: today, test: defaultTest(today), words: uniqueWords(words).slice(0, MAX_WORDS), back: [], at: d.resetAt + 1 };
  return { ...d, groups: { ...d.groups, [STARTER_ID]: g } };
}
/** Never made a group, on any device: time for the starter. */
export const needsStarter = (d) => !Object.values(d.groups).some((g) => g.at > d.resetAt);

/** Renaming works any day. The words and the date can change until the test day. */
export function editGroup(d, id, changes, today, now) {
  const g = d.groups[id];
  if (!g || g.gone) return { error: 'That group has gone.' };
  const next = { ...g, at: now };
  if ('name' in changes) {
    const name = String(changes.name || '').trim().slice(0, MAX_NAME);
    if (!name) return { error: 'Please give the group a name.' };
    next.name = name;
  }
  if ('words' in changes || 'test' in changes) {
    const wordsChange = 'words' in changes && JSON.stringify(uniqueWords(changes.words)) !== JSON.stringify(g.words);
    const dateChange = 'test' in changes && changes.test !== g.test;
    if ((wordsChange || dateChange) && !canEdit(g, today)) return { error: 'This group can\'t change now the test day has come.' };
    if ('words' in changes) {
      next.words = uniqueWords(changes.words);
      const error = checkWords(next.words);
      if (error) return { error };
      next.back = g.back.filter((w) => !next.words.includes(w));
    }
    if (dateChange) {
      const error = checkTest(changes.test, today, g.start);
      if (error) return { error };
      next.test = changes.test;
    }
  }
  return { doc: { ...d, groups: { ...d.groups, [id]: next } } };
}
export const canEdit = (g, today) => today < g.test;
/** Its tries stay: they still count towards remembered words. */
export function deleteGroup(d, id, now) {
  const g = d.groups[id];
  return g ? { ...d, groups: { ...d.groups, [id]: { ...g, at: now, gone: now } } } : d;
}

// ---- tries ---------------------------------------------------------------------
/** One try: { id, word, day, group, kind: 'p'|'t'|'f', tries, peeks, clean, now }. */
export function addTry(d, { id, word, day, group, kind, tries, peeks, clean, now }) {
  return { ...d, results: [...d.results, { id, w: word, d: day, g: group, k: kind, t: tries, p: peeks, c: clean ? 1 : 0, at: now }] };
}
const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);
const unaided = (r) => !!r.c && !r.t && !r.p;
const cellKey = (g, w) => g + '|' + w;
const wordOfKey = (key) => key.slice(key.indexOf('|') + 1);

function flagsOf(r, first) {
  const test = r.k === 't' ? (r.c ? TEST_RIGHT : TEST_WRONG) : 0;
  const fix = first && r.k === 'f' && unaided(r) ? FIX_FIRST : 0;
  return (first && unaided(r) ? FIRST : 0) | (r.c ? CLEAN : 0) | test | fix;
}

// Everything the rules read, from the fold and the tries:
//   cells: group|word -> { day: flags };  days: word -> { day: counts towards remembered }
function ledger(d) {
  const cells = new Map();
  const days = new Map();
  const dayMap = (w) => { if (!days.has(w)) days.set(w, {}); return days.get(w); };
  for (const [key, f] of Object.entries(d.folded)) {
    cells.set(key, { ...f.days });
    const m = dayMap(wordOfKey(key));
    for (const [day, flags] of Object.entries(f.days)) m[day] = !!m[day] || !!(flags & (FIRST | TEST_RIGHT));
  }
  for (const r of [...d.results].sort(byTime)) {
    const key = cellKey(r.g, r.w);
    if (!cells.has(key)) cells.set(key, {});
    const c = cells.get(key);
    const first = !(r.d in c);
    c[r.d] = first ? flagsOf(r, true) : c[r.d] | flagsOf(r, false);
    const m = dayMap(r.w);
    if (!(r.d in m)) m[r.d] = unaided(r);
    if (r.k === 't' && r.c) m[r.d] = true; // a word right in the test always counts
  }
  return { cells, days };
}
const flagsOn = (L, g, w, day) => (L.cells.get(cellKey(g.id, w)) || {})[day] || 0;

/** One grid cell: 'clean', 'help' (done, after a mistake or a peek) or 'todo'. */
export function cell(d, g, w, day, L = ledger(d)) {
  const f = flagsOn(L, g, w, day);
  if (!(f & CLEAN)) return 'todo';
  return f & FIRST ? 'clean' : 'help';
}
/** Done for today: spelled clean at some point today. */
export const doneOn = (d, g, w, day) => cell(d, g, w, day) !== 'todo';
/** A star for each word done clean, the first time of that day. */
export function starsOn(d, g, day, L = ledger(d)) {
  return rows(g).filter((w) => cell(d, g, w, day, L) === 'clean').length;
}

// ---- remembered ----------------------------------------------------------------
function rememberedIn(L, w) {
  const good = Object.entries(L.days.get(w) || {}).filter(([, ok]) => ok).map(([day]) => day).sort();
  return good.length >= REMEMBER_DAYS && daysBetween(good[0], good[good.length - 1]) >= REMEMBER_SPAN;
}
export const isRemembered = (d, w) => rememberedIn(ledger(d), w);
export function goodDays(d, w) { return Object.entries(ledger(d).days.get(w) || {}).filter(([, ok]) => ok).map(([day]) => day).sort(); }

// ---- the test --------------------------------------------------------------------
/** The word's test result: { right, day }, or null. The first answer stands. */
function testOf(d, L, g, w) {
  const flags = L.cells.get(cellKey(g.id, w)) || {};
  const r = d.results.filter((x) => x.k === 't' && x.g === g.id && x.w === w).sort(byTime)[0];
  const folded = Object.keys((d.folded[cellKey(g.id, w)] || {}).days || {}).sort().find((day) => flags[day] & (TEST_RIGHT | TEST_WRONG));
  if (folded) return { right: !!(d.folded[cellKey(g.id, w)].days[folded] & TEST_RIGHT), day: folded };
  return r ? { right: !!r.c, day: r.d } : null;
}
export function testResults(d, g) {
  const L = ledger(d);
  return g.words.map((w) => ({ word: w, result: testOf(d, L, g, w) }));
}
/** Words still to answer: one go each, so a test left halfway carries on. */
export const testLeft = (d, g) => testResults(d, g).filter((x) => !x.result).map((x) => x.word);
export const testDone = (d, g) => testLeft(d, g).length === 0;
const testDay = (results) => results.reduce((m, x) => (x.result && x.result.day > m ? x.result.day : m), '');
export const slipped = (d, g) => testResults(d, g).filter((x) => x.result && !x.result.right).map((x) => x.word);

/** The words still to fix: slipped, and not yet spelled clean at the first go of a day. */
export function fixups(d, g) {
  const L = ledger(d);
  return slipped(d, g).filter((w) => !Object.values(L.cells.get(cellKey(g.id, w)) || {}).some((f) => f & FIX_FIRST));
}

// ---- today's job ---------------------------------------------------------------
// 'practise' · 'test' · 'wait' (tested today: fix-ups come tomorrow) ·
// 'fixups' · 'fixed-today' (all done for today, some come back tomorrow) · 'finished'
export function jobFor(d, g, today) {
  if (today < g.test) return 'practise';
  const results = testResults(d, g);
  if (results.some((x) => !x.result)) return 'test';
  if (!results.some((x) => !x.result.right)) return 'finished';
  if (today <= testDay(results)) return 'wait';
  const left = fixups(d, g);
  if (!left.length) return 'finished';
  return left.every((w) => doneOn(d, g, w, today)) ? 'fixed-today' : 'fixups';
}
/** The group to show first: the soonest with something left to do, else the newest. */
export function currentGroup(d, today) {
  const all = liveGroups(d);
  return all.find((g) => jobFor(d, g, today) !== 'finished') || all[all.length - 1] || null;
}

// ---- words that come back --------------------------------------------------------
/**
 * Up to `limit` words from earlier groups that aren't remembered yet: the ones
 * that slipped in a test first, then those with the fewest good days, oldest
 * group first. A group still before its test keeps its own words.
 */
export function returningWords(d, today, exclude = [], limit = MAX_BACK) {
  const L = ledger(d);
  const out = new Map();
  const skip = new Set(exclude);
  for (const g of liveGroups(d)) {
    if (today < g.test) { rows(g).forEach((w) => skip.add(w)); continue; }
    const missed = new Set(slipped(d, g));
    rows(g).forEach((w, i) => { if (!out.has(w)) out.set(w, { w, missed: missed.has(w), order: out.size + i / 100 }); });
  }
  const goodCount = (w) => Object.values(L.days.get(w) || {}).filter(Boolean).length;
  return [...out.values()].filter((x) => !skip.has(x.w) && !rememberedIn(L, x.w))
    .sort((a, b) => Number(b.missed) - Number(a.missed) || goodCount(a.w) - goodCount(b.w) || a.order - b.order)
    .slice(0, limit).map((x) => x.w);
}

// ---- progress --------------------------------------------------------------------
function totals(d, g, w) {
  const f = d.folded[cellKey(g.id, w)];
  const rs = d.results.filter((r) => r.g === g.id && r.w === w);
  return { tries: rs.reduce((n, r) => n + r.t, f ? f.t : 0), peeks: rs.reduce((n, r) => n + r.p, f ? f.p : 0), any: rs.length > 0 || !!f };
}
/** 'remembered' · 'test passed' · 'practising' · 'new' */
function statusIn(d, L, g, w) {
  if (rememberedIn(L, w)) return 'remembered';
  const t = testOf(d, L, g, w);
  if (t && t.right) return 'test passed';
  return totals(d, g, w).any ? 'practising' : 'new';
}
export function groupProgress(d, g) {
  const L = ledger(d);
  const words = rows(g).map((w) => ({ word: w, back: g.back.includes(w), status: statusIn(d, L, g, w), ...totals(d, g, w) }));
  return {
    words,
    tries: words.reduce((n, x) => n + x.tries, 0),
    peeks: words.reduce((n, x) => n + x.peeks, 0),
    stars: practiceDays(g).map((day) => ({ day, stars: starsOn(d, g, day, L) })),
    of: words.length,
  };
}
/** Plain counts. firstGoes: a word on a day; clean: those spelled clean and unaided at the first go. */
export function overall(d) {
  const L = ledger(d);
  let firstGoes = 0;
  let clean = 0;
  for (const m of L.days.values()) for (const ok of Object.values(m)) { firstGoes += 1; if (ok) clean += 1; }
  return { remembered: [...L.days.keys()].filter((w) => rememberedIn(L, w)).length, practised: L.days.size, firstGoes, clean, independent: firstGoes ? Math.round((clean / firstGoes) * 100) : 0 };
}
export const anyTries = (d) => d.results.length > 0 || Object.keys(d.folded).length > 0;

// ---- merge, trim, reset ----------------------------------------------------------
const LOG = {
  group: (r) => cellKey(r.g, r.w),
  // A fold or a try. Only the day flags: a try already counted must not count twice.
  absorb(f, r) {
    const days = { ...f.days };
    if (r.days) for (const [day, flags] of Object.entries(r.days)) days[day] = (days[day] || 0) | flags;
    else days[r.d] = r.d in days ? days[r.d] | flagsOf(r, false) : flagsOf(r, true);
    return { ...f, days };
  },
  emptyFold: () => ({ n: 0, t: 0, p: 0, through: 0, days: {} }),
};

export function merge(a, b) {
  const x = normalise(a);
  const y = normalise(b);
  const log = mergeLog(x, y, LOG);
  const out = { v: 1, resetAt: log.resetAt, groups: {}, results: log.results, folded: log.folded };
  for (const id of new Set([...Object.keys(x.groups), ...Object.keys(y.groups)])) {
    const p = x.groups[id];
    const q = y.groups[id];
    const g = !p ? q : !q ? p : q.at > p.at || (q.at === p.at && JSON.stringify(q) > JSON.stringify(p)) ? q : p;
    if (g.at > out.resetAt) out.groups[id] = g;
  }
  return out;
}

export function trim(d, now) {
  if (sizeOf(d) <= TRIM_AT) return d;
  const groups = Object.fromEntries(Object.entries(d.groups).filter(([, g]) => !g.gone || now - g.gone < 90 * DAY_MS));
  return foldOldest({ ...d, groups }, { target: TRIM_TO, sizeOf, ...LOG, tally: (f, r) => ({ ...f, t: f.t + r.t, p: f.p + r.p }) });
}

export const reset = (now) => ({ ...emptyDoc(), resetAt: now });
