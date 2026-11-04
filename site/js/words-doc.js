// "My words" (S1–S3): a player's word groups and every try at them, as one
// saved value: the account key "words" (game "spellbright"), cached on the
// device as "sb.words:<player id>". Signed-in only. Pure: no DOM, no storage;
// the clock comes in as `today` (the device's local date, YYYY-MM-DD) and `now`.
//
//   { v: 1, resetAt,                     ms; "Clear my progress" (0: never)
//     groups:  { [id]: { name, start, test, words, back, at, gone? } },
//     results: [{ id, w: word, d: day, g: group, k: 'p'|'t'|'f', t: wrong
//                 letters, p: peeks, c: clean 1/0, at }],    one per try
//     folded:  { ['<group>|<word>']: { n, t, p, through, days } },  old tries
//     steps:   { ['<group>|<step>']: { d: day, at } },  Study mode: jobs done
//     clues:   { [word]: { t: text, at } },             memory clues
//     notes:   [{ id, g: group, w: word, x: sentence, d: day, at }] }
//
//   k: 'p' practice, 't' the test, 'f' a fix-up. A practice or fix-up try may
//   also have s: 'x' (Fix it in), 'g' (a spelling game) or 'm' (Meaning match);
//   no s means the grid. Meaning match doesn't test spelling: it can earn the
//   day's star and counts as played, and that's all (see MATCH). `back`
//   is the words from earlier groups that came back with this one. `gone`
//   marks a deleted group.
//   `days` keeps what the rules need from folded tries: { [day]: flags }.
//   SB2 added steps, clues, notes and `s`, still at v: 1, so a device on the
//   old release keeps every try (it only ignores what it doesn't know).
//
// MERGE (two devices, or a 409 from the account):
//   · tries: the union by id; every total, star and status is counted from
//     them (and the fold), never added from the two copies;
//   · a group: the copy changed last wins, whole; a deleted group stays
//     deleted until someone changes it later; deleting never loses its tries;
//   · resetAt: the later one; anything before it goes;
//   · steps: the first time a job was done; clues: the newest; notes: by id.
// SIZE: a value may be at most 64 KB. Past 48 KB the oldest tries are folded
// (per group and word) until it is under 40 KB, and deleted groups older than
// 90 days are dropped first. Remembered words are not affected by folding.
import { mergeLog, foldOldest, newest } from './account/merge.js';

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
// Practise 3 times: a clean pass that day, by where it came from.
const ROUND = { p: 32, x: 64, g: 128 }; // the grid, Fix it in, a game
const ROUND_BITS = Object.values(ROUND);
// Meaning match on a day: played; played clean (the star). No dot, no first go,
// no remembered, no fix-up, and the day's real first go is still to come.
const MATCH = 256;
const MATCH_CLEAN = 512;
const SPELT = 1024; // someone spelled the word that day
export const ROUNDS_NEEDED = 3;
export const MAX_NOTES = 60; // sentences kept when the value is trimmed
export const MAX_CLUE = 80;
export const MAX_NOTE = 160;

export const emptyDoc = () => ({ v: 1, resetAt: 0, groups: {}, results: [], folded: {}, steps: {}, clues: {}, notes: [] });
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
  for (const [key, s] of Object.entries(isObj(d.steps) ? d.steps : {})) {
    if (isObj(s) && key.includes('|') && isDay(s.d) && num(s.at)) out.steps[key] = { d: s.d, at: s.at };
  }
  for (const [w, c] of Object.entries(isObj(d.clues) ? d.clues : {})) {
    if (isObj(c) && typeof c.t === 'string' && num(c.at)) out.clues[w] = { t: c.t, at: c.at };
  }
  out.notes = (Array.isArray(d.notes) ? d.notes : []).filter((x) => isObj(x) && typeof x.id === 'string' && typeof x.g === 'string'
    && typeof x.w === 'string' && typeof x.x === 'string' && isDay(x.d) && num(x.at));
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
/** One try: { id, word, day, group, kind: 'p'|'t'|'f', tries, peeks, clean, source?: 'x'|'g', now }. */
export function addTry(d, { id, word, day, group, kind, tries, peeks, clean, source, now }) {
  return { ...d, results: [...d.results, { id, w: word, d: day, g: group, k: kind, t: tries, p: peeks, c: clean ? 1 : 0, ...(source ? { s: source } : {}), at: now }] };
}
const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);
const unaided = (r) => !!r.c && !r.t && !r.p;
const cellKey = (g, w) => g + '|' + w;
const wordOfKey = (key) => key.slice(key.indexOf('|') + 1);

const isMatch = (r) => r.s === 'm';
// The first go of a day is the first time the word is spelled.
const firstOf = (days, day) => !(day in days) || (!!(days[day] & MATCH) && !(days[day] & SPELT));
function flagsOf(r, first) {
  if (isMatch(r)) return MATCH | (unaided(r) ? MATCH_CLEAN : 0);
  const test = r.k === 't' ? (r.c ? TEST_RIGHT : TEST_WRONG) : 0;
  const fix = first && r.k === 'f' && unaided(r) ? FIX_FIRST : 0;
  const round = r.k === 'p' && unaided(r) ? ROUND[r.s || 'p'] || 0 : 0;
  return (first && unaided(r) ? FIRST : 0) | (r.c ? CLEAN : 0) | test | fix | round | SPELT;
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
    for (const [day, flags] of Object.entries(f.days)) if (!(flags & MATCH) || flags & SPELT) m[day] = !!m[day] || !!(flags & (FIRST | TEST_RIGHT));
  }
  for (const r of [...d.results].sort(byTime)) {
    const key = cellKey(r.g, r.w);
    if (!cells.has(key)) cells.set(key, {});
    const c = cells.get(key);
    const first = firstOf(c, r.d);
    c[r.d] = (c[r.d] || 0) | flagsOf(r, first);
    if (isMatch(r)) continue;
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
  if (!(f & CLEAN)) return f & MATCH_CLEAN && !(f & SPELT) ? 'clean' : 'todo';
  return f & FIRST ? 'clean' : 'help';
}
/** Done for today: spelled clean at some point today. */
export const doneOn = (d, g, w, day) => !!(flagsOn(ledger(d), g, w, day) & CLEAN);
/** A star for each word done clean, the first time of that day. */
export function starsOn(d, g, day, L = ledger(d)) {
  return rows(g).filter((w) => cell(d, g, w, day, L) === 'clean').length;
}

/** A try away from the grid: after the test, a word still to fix counts as a fix-up. */
export const kindOn = (d, g, w, day) => (day >= g.test && fixups(d, g).includes(w) ? 'f' : 'p');
/** The words the practice grid hasn't had a clean pass at today. */
export function gridLeft(d, g, day, L = ledger(d)) { return rows(g).filter((w) => !(flagsOn(L, g, w, day) & ROUND.p)); }
/** The first day the grid had every word: the Practice day's round. */
export function gridRoundDay(d, g, L = ledger(d)) {
  const days = new Set(rows(g).flatMap((w) => Object.keys(L.cells.get(cellKey(g.id, w)) || {})));
  return [...days].sort().find((day) => !gridLeft(d, g, day, L).length) || '';
}

// ---- practise 3 times --------------------------------------------------------------
/**
 * Clean rounds before the test, at most 3. Each place counts once a day: Fix
 * it in, the grid, and games (however many are played that day).
 */
export function dots(d, g, w, L = ledger(d)) {
  const days = L.cells.get(cellKey(g.id, w)) || {};
  const n = Object.entries(days).filter(([day]) => day < g.test)
    .reduce((sum, [, flags]) => sum + ROUND_BITS.filter((b) => flags & b).length, 0);
  return Math.min(n, ROUNDS_NEEDED);
}
export function allDots(d, g) { const L = ledger(d); return rows(g).map((w) => ({ word: w, dots: dots(d, g, w, L), back: g.back.includes(w) })); }
/** Only the group's own words are in the test, so only they need their 3. */
export function readyForTest(d, g) { const L = ledger(d); return g.words.every((w) => dots(d, g, w, L) >= ROUNDS_NEEDED); }

// ---- jobs done, clues, sentences ---------------------------------------------------
const stepKey = (g, step) => g + '|' + step;
export const stepDay = (d, g, step) => (d.steps[stepKey(g.id, step)] || { d: '' }).d;
/** The first time counts. `step` may be a part of a job, 'fix:2'. */
export function markStep(d, g, step, day, now) {
  const key = stepKey(g.id, step);
  return d.steps[key] ? d : { ...d, steps: { ...d.steps, [key]: { d: day, at: now } } };
}
/** One clue a word; an empty one takes it away. */
export function setClue(d, word, text, now) {
  const t = String(text || '').trim().slice(0, MAX_CLUE);
  return { ...d, clues: { ...d.clues, [word]: { t, at: now } } };
}
export const clueFor = (d, word) => (d.clues[word] || { t: '' }).t;
export function addNote(d, { id, group, word, text, day, now }) {
  return { ...d, notes: [...d.notes, { id, g: group, w: word, x: String(text).trim().slice(0, MAX_NOTE), d: day, at: now }] };
}
export const notesFor = (d, g) => d.notes.filter((x) => x.g === g.id);

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
export const testDayOf = (results) => results.reduce((m, x) => (x.result && x.result.day > m ? x.result.day : m), '');
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
  if (today <= testDayOf(results)) return 'wait';
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
    // Not before its test, and not while its test is due: those words stay out of sight.
    if (today < g.test || jobFor(d, g, today) === 'test') { rows(g).forEach((w) => skip.add(w)); continue; }
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
  const spelt = rs.filter((r) => !isMatch(r)); // a wrong pairing isn't a wrong letter
  return { tries: spelt.reduce((n, r) => n + r.t, f ? f.t : 0), peeks: spelt.reduce((n, r) => n + r.p, f ? f.p : 0), any: rs.length > 0 || !!f };
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
  const played = new Set([...L.cells.keys()].map(wordOfKey));
  return { remembered: [...L.days.keys()].filter((w) => rememberedIn(L, w)).length, practised: played.size, firstGoes, clean, independent: firstGoes ? Math.round((clean / firstGoes) * 100) : 0 };
}
export const anyTries = (d) => d.results.length > 0 || Object.keys(d.folded).length > 0;

// ---- merge, trim, reset ----------------------------------------------------------
const LOG = {
  group: (r) => cellKey(r.g, r.w),
  // A fold or a try. Only the day flags: a try already counted must not count twice.
  absorb(f, r) {
    const days = { ...f.days };
    if (r.days) for (const [day, flags] of Object.entries(r.days)) days[day] = (days[day] || 0) | flags;
    else days[r.d] = (days[r.d] || 0) | flagsOf(r, firstOf(days, r.d));
    return { ...f, days };
  },
  emptyFold: () => ({ n: 0, t: 0, p: 0, through: 0, days: {} }),
};

export function merge(a, b) {
  const x = normalise(a);
  const y = normalise(b);
  const log = mergeLog(x, y, LOG);
  const out = { ...emptyDoc(), resetAt: log.resetAt, groups: {}, results: log.results, folded: log.folded };
  for (const id of new Set([...Object.keys(x.groups), ...Object.keys(y.groups)])) {
    const p = x.groups[id];
    const q = y.groups[id];
    const g = !p ? q : !q ? p : q.at > p.at || (q.at === p.at && JSON.stringify(q) > JSON.stringify(p)) ? q : p;
    if (g.at > out.resetAt) out.groups[id] = g;
  }
  const later = (x) => x.at > out.resetAt;
  for (const key of new Set([...Object.keys(x.steps), ...Object.keys(y.steps)])) {
    const s = [x.steps[key], y.steps[key]].filter(Boolean).sort((p, q) => p.at - q.at)[0];
    if (later(s)) out.steps[key] = s;
  }
  for (const w of new Set([...Object.keys(x.clues), ...Object.keys(y.clues)])) {
    const c = newest(x.clues[w], y.clues[w], (v) => v.at);
    if (later(c)) out.clues[w] = c;
  }
  const notes = new Map([...x.notes, ...y.notes].filter(later).map((n) => [n.id, n]));
  out.notes = [...notes.values()].sort(byTime);
  return out;
}

export function trim(d, now) {
  if (sizeOf(d) <= TRIM_AT) return d;
  const groups = Object.fromEntries(Object.entries(d.groups).filter(([, g]) => !g.gone || now - g.gone < 90 * DAY_MS));
  // A job's part marks ('fix:2') only say where to carry on: once the job is done they can go.
  const steps = Object.fromEntries(Object.entries(d.steps).filter(([key]) => key.slice(0, key.indexOf('|')) in groups
    && !(key.includes(':') && key.slice(0, key.indexOf(':')) in d.steps)));
  return foldOldest({ ...d, groups, steps, notes: [...d.notes].sort(byTime).slice(-MAX_NOTES) }, { target: TRIM_TO, sizeOf, ...LOG, tally: (f, r) => (isMatch(r) ? f : { ...f, t: f.t + r.t, p: f.p + r.p }) });
}

export const reset = (now) => ({ ...emptyDoc(), resetAt: now });
