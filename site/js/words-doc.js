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
//     notes:   [{ id, g: group, w: word, x: sentence, d: day, at }],
//     skips:   [{ id, g: group, w: word, d: day, f: flow, at }],   "Skip for now"
//     weekPick?: { on: boolean, at: ms } }   OPTIONAL (SB3-G): a grown-up's switch, "Your child can choose which
//                                            week to study". Absent = on (today's behaviour); old docs unchanged.
//     setup?:  { help?, profile?, offer?, exams?, own? }  OPTIONAL (SB4): a child's setup (setup-doc.js), written
//                                            by grown-up pages only. Absent = today's behaviour.
//     own?:    { [oid]: { name, words, src, at, gone?, to } }  OPTIONAL (SB4): on a GROWN-UP's words value, their own
//                                            word lists (own-doc.js), sent to children as copies in `setup.own`.
//   Optional fields on a try (SB4, tile help; absent = a keyboard try, as today): lv 1..4 (the tile level used),
//   h: 1 (the tray filled a letter itself), hn (first-letter hints), hr (hears after the first; tests only),
//   pf 'sen'|'top' (the help used, on a k:'t' try only). A try with lv 1..3, h or hn is "assisted": it still earns
//   dots, stars and jobs, but it can't make a word remembered. No new `k`, no new `s`.
//
//   SB6 (Step by step; TRS TR-10..TR-16). Everything is optional and absent = today's behaviour; no new `k`, no new `s`:
//   · group: any unknown field named like /^[a-z][a-zA-Z0-9]{0,11}$/ of at most 1 KB is kept as it is (TR-15). (A `focus` field from an
//     earlier build is such a field: kept, never acted on, D21.)
//   · try: r 1..31 (rung code; the whole-word code is RULES.rungs.allCode = 31, MAX_RUNG), j 'h'|'f'|'w'|'k'|'b'|'m'|'q' (stone), ss (sitting id, 6 chars), sl (slip box indices, at most 5),
//     rw 2..10 (row size), pr 0|1 (a test word spelled after a Peek: right or not); note: bl 1|3|4, hp 1;
//   · steps: '<group>|se:<ss>' (a sitting ended), '<group>|rw:<k>' and '<group>|rw:<k>:<i>' (rows done), '<group>|practice';
//   · top level: aside?: { ['<group>|<word lower case>']: { day: 'YYYY-MM-DD' | '', at } } (SB6 D25): a grown-up sets a stuck word aside for one
//     day (day '' = brought back). Written ONLY by grownups-data setAsideWord; newest `at` wins in merge; dropped once its day has passed.
//   · SB7 (D28-D30): top level `resets?: { [id]: { at, day, g, t: 'words'|'stone'|'week', w?, i?, s? } }`: a grown-up's reset of a Step by step week
//     (reset-doc.js). The reset removes the records at once; the stamp makes the removal win every later merge: records of that group (and words,
//     or stone) with `at` at or before the stamp's `at` are dropped from BOTH copies before they merge (applyResets). Written ONLY by
//     grownups-data resetWeek; a union by id on merge; at most RESET_KEEP stamps, and spent after RESET_DAYS days (trim). Under 4 KB, so an older
//     release keeps it as an unknown key (it does not apply it; the next newer device does).
//   · top level: any other key whose value is a JSON object or array of at most 4 KB is kept (extras) and merged by `.at`.
//   · folded days gain: RUNG slots 1..15 (bits 16..30, thermometer: a clean try at a rung sets every slot up to its own; the whole word
//     sets slot 15, a partial rung saturates at slot 14), and ALL_FIRST (bit 7), ALL_TRIED (bit 6), R_TRY (bit 5); ladderFacts reads them.
//
//   k: 'p' practice, 't' the test, 'f' a fix-up. A practice or fix-up try may
//   also have s: 'x' (Fix it in), 'g' (a spelling game) or 'm' (Meaning match);
//   no s means the grid. Meaning match doesn't test spelling: it can earn the
//   day's star and counts as played, and that's all (see MATCH). `back`
//   is the words from earlier groups that came back with this one. `gone`
//   marks a deleted group.
//   A session is one word, one day, one flow: the grid 'p', Fix it in 'x' or
//   fix-ups 'f'. Its count (3 clean in a row) isn't stored: it's counted from the
//   tries, so it merges with them and another device carries straight on.
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
//   · weekPick: the copy with the later `at` wins (a tie: the larger JSON); absent loses to present. It is not
//     cleared by resetAt: "Clear my progress" keeps it (reset(now, d)), so it can't be used to get round the switch;
//   · setup, own: each merged by its own rules (setup-doc.js, own-doc.js); never cleared by resetAt, and kept by
//     reset(now, d), so "Clear my progress" can't undo a grown-up's setup;
//   · steps: the first time a job was done; clues: the newest; notes, skips: by id.
// SIZE: a value may be at most 64 KB. Past 48 KB the oldest tries are folded
// (per group and word) until it is under 40 KB, and deleted groups older than
// 90 days are dropped first. Remembered words are not affected by folding. `setup` and `own` are never folded:
// only their own old deleted entries go (setup-doc.js, own-doc.js).
import { mergeLog, foldOldest, newest } from './account/merge.js';
import * as Su from './setup-doc.js';
import * as Ow from './own-doc.js';
import { RULES } from './sbs-rules.js';

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
// SB4: remembered from a folded day. A day folded in this release has ERA; RECALL says the day counts towards
// remembered (a first go, or a right test answer, with no tile help). A day folded before has neither bit and counts
// as it always did: FIRST or TEST_RIGHT.
const RECALL = 16384;
const ERA = 32768;
// SB6 (TR-12): the ladder's facts, kept in a folded day so trimming never loses them. SB5 merges keep these bits (they OR folds).
// Bit budget: 1..16 and 256..32768 were used before; 32, 64, 128 and 65536 up were free. Slots take 1<<16 .. 1<<30 (fifteen), the three flags
// take 32, 64 and 128. Bit 31 is never used (it is the sign in JS).
export const MAX_RUNG = 31; // a rung code a try may carry (D20: a word of 20 letters needs partial codes up to 20)
export const ALL_RUNG = (RULES.rungs && Number.isInteger(RULES.rungs.allCode) ? RULES.rungs.allCode : MAX_RUNG); // the whole-word code (31)
const TOP_SLOT = 15;
const slotOf = (r) => (r === ALL_RUNG ? TOP_SLOT : Math.min(r, TOP_SLOT - 1));
const SLOT_BIT = (k) => 1 << (15 + k); // slot 1..15 -> 1<<16 .. 1<<30
const RUNG_BITS = 0x7fff << 16;
const ALL_FIRST = 1 << 7; // the first whole-word try of that word that day was clean, no Peek
const ALL_TRIED = 1 << 6; // a whole-word try was made that day (so a later one is not the first)
const R_TRY = 1 << 5; // any try with a rung was made that day (the word has "met")
// Practise 3 times: 3 clean spellings in a row that day, by flow.
const ROW = { p: 2048, x: 4096, f: 8192 }; // the grid, Fix it in, fix-ups
const ROW_BITS = ROW.p | ROW.x | ROW.f;
// Meaning match on a day: played; played clean (the star). No dot, no first go,
// no remembered, no fix-up, and the day's real first go is still to come.
const MATCH = 256;
const MATCH_CLEAN = 512;
const SPELT = 1024; // someone spelled the word that day
export const ROW_NEEDED = 3;
const SKIP_KEEP_MS = 3 * 86400000; // a skip only matters on its own day
const PROTECT_MS = 24 * 3600 * 1000; // SB6: trim folds the tries from the last 24 hours (or the newest sitting's first try) on last
export const MAX_NOTES = 60; // sentences kept when the value is trimmed
export const MAX_CLUE = 80;
export const MAX_NOTE = 160;

// SB6 (TR-15): top-level keys this release knows; any other key with a small JSON object or array is kept.
const TOP = ['v', 'resetAt', 'groups', 'results', 'folded', 'steps', 'clues', 'notes', 'skips', 'weekPick', 'setup', 'own', 'aside', 'resets'];
const TOP_NAME = /^[A-Za-z][A-Za-z0-9_]{0,23}$/;
export const MAX_EXTRA = 4096; // bytes of JSON for one unknown top-level key
const GROUP_KNOWN = ['name', 'start', 'test', 'words', 'back', 'at', 'gone'];
const GROUP_NAME = /^[a-z][a-zA-Z0-9]{0,11}$/;
export const MAX_GROUP_EXTRA = 1024; // bytes of JSON for one unknown group field
const jbytes = (x) => new TextEncoder().encode(JSON.stringify(x)).length;
const lc = (w) => String(w).toLowerCase();

export const emptyDoc = () => ({ v: 1, resetAt: 0, groups: {}, results: [], folded: {}, steps: {}, clues: {}, notes: [], skips: [] });
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
    const words = strings(g.words);
    out.groups[id] = { name: String(g.name || ''), start: g.start, test: g.test, words, back: strings(g.back), at: num(g.at), ...(g.gone ? { gone: num(g.gone) } : {}) };
    for (const [f, v] of Object.entries(g)) { // SB6 (TR-15): a group field this release does not know, kept as it is
      if (!GROUP_KNOWN.includes(f) && GROUP_NAME.test(f) && v !== undefined && jbytes(v) <= MAX_GROUP_EXTRA) out.groups[id][f] = v;
    }
  }
  out.results = (Array.isArray(d.results) ? d.results : []).filter((r) => isObj(r) && typeof r.id === 'string' && typeof r.w === 'string'
    && typeof r.g === 'string' && isDay(r.d) && ['p', 't', 'f'].includes(r.k) && num(r.at));
  for (const [key, f] of Object.entries(isObj(d.folded) ? d.folded : {})) {
    if (isObj(f) && key.includes('|')) out.folded[key] = { n: num(f.n), t: num(f.t), p: num(f.p), through: num(f.through), days: isObj(f.days) ? { ...f.days } : {} };
  }
  for (const [key, s] of Object.entries(isObj(d.steps) ? d.steps : {})) {
    // SB7 (FIX-2): a row group mark ('rw:<k>:<i>') may carry `h`, a short hash of the words of its group when it was done, so it counts only for that same set of words
    if (isObj(s) && key.includes('|') && isDay(s.d) && num(s.at)) out.steps[key] = { d: s.d, at: s.at, ...(typeof s.h === 'string' && /^[a-z0-9]{1,10}$/.test(s.h) ? { h: s.h } : {}) };
  }
  for (const [w, c] of Object.entries(isObj(d.clues) ? d.clues : {})) {
    if (isObj(c) && typeof c.t === 'string' && num(c.at)) out.clues[w] = { t: c.t, at: c.at };
  }
  out.notes = (Array.isArray(d.notes) ? d.notes : []).filter((x) => isObj(x) && typeof x.id === 'string' && typeof x.g === 'string'
    && typeof x.w === 'string' && typeof x.x === 'string' && isDay(x.d) && num(x.at));
  out.skips = (Array.isArray(d.skips) ? d.skips : []).filter((x) => isObj(x) && typeof x.id === 'string' && typeof x.g === 'string'
    && typeof x.w === 'string' && typeof x.f === 'string' && isDay(x.d) && num(x.at));
  if (isObj(d.weekPick) && typeof d.weekPick.on === 'boolean' && num(d.weekPick.at)) out.weekPick = { on: d.weekPick.on, at: d.weekPick.at };
  const setup = Su.normalise(d.setup);
  if (!Su.isEmpty(setup)) out.setup = setup;
  const own = Ow.normalise(d.own);
  if (!Ow.isEmpty(own)) out.own = own;
  const aside = cleanAside(d.aside);
  if (aside) out.aside = aside;
  const resets = cleanResets(d.resets);
  if (resets) out.resets = resets;
  for (const [k, v] of Object.entries(d)) { // SB6 (TR-15): a top-level key this release does not know, kept as it is
    if (!TOP.includes(k) && TOP_NAME.test(k) && v !== null && typeof v === 'object' && jbytes(v) <= MAX_EXTRA) out[k] = v;
  }
  return out.resets ? applyResets(out) : out; // SB7: whoever reads a copy (a grown-up's page, an older device's save) sees the resets applied
}

// ---- SB6 (D25): a grown-up sets a stuck word aside for today --------------------------------------------------------------
const asideKey = (gid, word) => gid + '|' + String(word).toLowerCase();
function cleanAside(a) {
  if (!isObj(a)) return null;
  const out = {};
  for (const [key, e] of Object.entries(a)) {
    if (!/^[^|]+\|[^|]+$/.test(key) || key.length > 80 || !isObj(e) || !num(e.at) || !(e.day === '' || isDay(e.day))) continue;
    out[key] = { day: e.day, at: e.at };
  }
  return Object.keys(out).length ? out : null;
}
/** An entry is spent once its day has passed (a brought-back mark: three days after it was made). */
const asideLive = (e, today, now) => (e.day ? e.day >= today : now - e.at < 3 * DAY_MS);
/** Is this word set aside by a grown-up for `day`? */
export const isSetAside = (d, gid, word, day) => { const e = d && d.aside && d.aside[asideKey(gid, word)]; return !!e && !!e.day && e.day === day; };
/**
 * A grown-up sets a word aside for `day` ('YYYY-MM-DD'), or brings it back (day ''). Answers the new words value. WRITTEN ONLY by
 * grownups-data setAsideWord (a child's device never calls this). `at` always goes up so the change wins the merge; spent entries go.
 */
export function setAside(d, gid, word, day, now) {
  if (typeof gid !== 'string' || !gid || gid.includes('|') || typeof word !== 'string' || !word.trim() || word.includes('|') || !(day === '' || isDay(day))) return d;
  const key = asideKey(gid, word.trim());
  const prev = (d.aside || {})[key];
  const today = localDay(now);
  const kept = Object.fromEntries(Object.entries(d.aside || {}).filter(([k, e]) => k !== key && asideLive(e, today, now)));
  return { ...d, aside: { ...kept, [key]: { day, at: Math.max(now, (prev ? prev.at : 0) + 1) } } };
}

// ---- SB7 (D28-D30): a grown-up's resets of a Step by step week -------------------------------------------------------------------
// A reset removes records; a STAMP keeps them removed. A stamp is { at, day, g, t, ... } and means: of group `g`, everything of this reach
// that was written at or before `at` is gone, on every device, whatever a later merge brings in.
//   t 'week'   everything of the week except the test: tries, sentences, step marks, skips, set-aside marks, folded days
//   t 'words'  the same, for the words in `w` (lower case); `i` holds their places in the week's list (for the part marks 'hello:<i>', 'fix:<i>')
//              plus the stone marks that say "every word is done" (hello, fix, practice), Meanings (games, games:*) and Sentences (story), so those
//              stones are not done until the restarted word has done them again (D32), and the row round marks (rw:<size>); a row group mark
//              (rw:<size>:<index>) goes only for the groups that held a picked word when it was reset (`r`: '<size>:<index>'); other rows stay
//   t 'stone'  `s` = hello | fix | games | story | practice: that stone's tries, marks and sentences, for every word
// The test (k 't') and the Usual-way study of other weeks are never reached. Tries already folded by trimming cannot be told apart by stone,
// so a stone reset leaves folded days (a week and word reset takes them).
export const RESET_KEEP = 24; // stamps kept
export const RESET_BYTES = 3600; // the stamps' JSON in bytes: under MAX_EXTRA (4096), so an older release keeps the key whole
export const RESET_DAYS = 45; // a stamp is spent this long after it was made
export const RESET_STONES = ['hello', 'fix', 'games', 'story', 'practice'];
const RESET_TYPES = ['words', 'stone', 'week'];
const STONE_OF_J = { h: 'hello', f: 'fix', w: 'practice' };
const isGid = (x) => typeof x === 'string' && x.length >= 1 && x.length <= 64 && !x.includes('|');
const ROW_KEY = /^\d{1,2}:\d{1,3}$/;
/** The stamps that are well formed, whatever their number or size. */
function validResets(r) {
  if (!isObj(r)) return {};
  const out = {};
  for (const [id, e] of Object.entries(r)) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || !isObj(e) || !(num(e.at) > 0) || !isDay(e.day) || !isGid(e.g) || !RESET_TYPES.includes(e.t)) continue;
    const x = { at: e.at, day: e.day, g: e.g, t: e.t };
    if (e.t === 'words') {
      const w = (Array.isArray(e.w) ? e.w : []).filter((v) => typeof v === 'string' && v && v.length <= 40 && !v.includes('|')).map(lc).slice(0, MAX_WORDS);
      if (!w.length) continue;
      x.w = w;
      x.i = (Array.isArray(e.i) ? e.i : []).filter((v) => Number.isInteger(v) && v >= 0 && v < 100).slice(0, MAX_WORDS + MAX_BACK);
      x.r = (Array.isArray(e.r) ? e.r : []).filter((v) => typeof v === 'string' && ROW_KEY.test(v)).slice(0, 40); // row groups ('<size>:<index>') that held a picked word
    } else if (e.t === 'stone') {
      if (!RESET_STONES.includes(e.s)) continue;
      x.s = e.s;
    }
    out[id] = x;
  }
  return out;
}
/**
 * Fit stamps into RESET_KEEP stamps and RESET_BYTES. A stamp is never dropped because a newer one covers it (FIX-3): a child device still on
 * 25b merges `resets` by the bigger copy, not by union, so a newer map must always be a superset of the older one (and so also bigger).
 * Stamps go only when spent (trim, RESET_DAYS) or over the cap: then the oldest go and are answered in `lost`. Only a reset that is being
 * MADE refuses on that (addReset), so a reset is never taken back by making a new one; a merge of two devices' stamps can still overflow,
 * then the oldest go (the known limit).
 */
export function fitResets(all) {
  const order = Object.keys(all).sort((a, b) => all[b].at - all[a].at || (a < b ? -1 : 1));
  const kept = {};
  const lost = [];
  for (const id of order) {
    if (Object.keys(kept).length < RESET_KEEP && jbytes({ ...kept, [id]: all[id] }) <= RESET_BYTES) kept[id] = all[id];
    else lost.push(id);
  }
  return { kept, lost };
}
function cleanResets(r) {
  const { kept } = fitResets(validResets(r));
  return Object.keys(kept).length ? kept : null;
}
/** The stone each sitting ('<group>|<ss>') belongs to, from the ladder tries in it (one sitting is one stone). */
export function sittingStones(results) {
  const out = new Map();
  for (const r of results) {
    const st = STONE_OF_J[r.j];
    if (st && isSitting(r.ss) && !out.has(r.g + '|' + r.ss)) out.set(r.g + '|' + r.ss, st);
  }
  return out;
}
const STONE_STEP = {
  hello: (k) => k === 'hello' || /^hello:\d+$/.test(k),
  fix: (k) => k === 'fix' || /^fix:\d+$/.test(k),
  games: (k) => k === 'games' || k.startsWith('games:'),
  story: (k) => k === 'story' || k.startsWith('story:'),
  practice: (k) => k === 'practice' || k.startsWith('rw:'),
};
const STONE_TRY = {
  hello: (r, st) => r.j === 'h' || ((r.j === 'k' || r.j === 'q') && st === 'hello'),
  fix: (r, st) => r.j === 'f' || ((r.j === 'k' || r.j === 'q') && st === 'fix'),
  practice: (r, st) => r.j === 'w' || ((r.j === 'k' || r.j === 'q') && st === 'practice'),
  games: (r) => !r.j && r.k === 'p' && (r.s === 'm' || (r.s === 'g' && !Number.isInteger(r.r))),
  story: (r) => r.j === 'b',
};
const hasWord = (x, w) => x.w.includes(lc(w));
/** Does the stamp reach this try? (`stoneOf`: the sitting's stone, or ''.) */
export function resetReachesTry(x, r, stoneOf = '') {
  if (r.g !== x.g || r.at > x.at || r.k === 't') return false;
  if (x.t === 'week') return true;
  if (x.t === 'words') return hasWord(x, r.w);
  return STONE_TRY[x.s](r, stoneOf);
}
/** Does the stamp reach this step mark (the part after '<group>|')? */
export function resetReachesStep(x, step, stoneOf = '') {
  if (x.t === 'week') return true;
  if (x.t === 'words') {
    const m = /^(?:hello|fix):(\d+)$/.exec(step);
    const row = /^rw:(\d+):(\d+)$/.exec(step);
    // a row group mark goes only where a picked word was in that group; the round marks ('rw:<size>') and 'practice' go so the rows come round again
    if (row) return x.r.includes(row[1] + ':' + row[2]);
    // D32: Meanings (games, games:*) and Sentences (story, story:*) go too, so those stones are not done until the restarted word has done them again
    return step === 'hello' || step === 'fix' || step === 'practice' || /^rw:\d+$/.test(step) || STONE_STEP.games(step) || STONE_STEP.story(step) || (!!m && x.i.includes(Number(m[1])));
  }
  return STONE_STEP[x.s](step) || (step.startsWith('se:') && stoneOf === x.s);
}
/**
 * The words value with every record a stamp reaches taken out. `ssStone` is sittingStones(...) (merge passes both copies' tries, so a
 * check or game of a sitting whose ladder tries only one copy holds is still told apart). Anything newer than the stamp is kept.
 */
export function applyResets(d, resets = d.resets, ssStone = sittingStones(d.results)) {
  const list = Object.values(resets || {});
  if (!list.length) return d;
  const stoneOfTry = (r) => ssStone.get(r.g + '|' + r.ss) || '';
  const results = d.results.filter((r) => !list.some((x) => resetReachesTry(x, r, stoneOfTry(r))));
  const steps = Object.fromEntries(Object.entries(d.steps).filter(([key, s]) => {
    const at = key.indexOf('|');
    const gid = key.slice(0, at);
    const step = key.slice(at + 1);
    const ss = step.startsWith('se:') ? ssStone.get(gid + '|' + step.slice(3)) || '' : '';
    return !list.some((x) => x.g === gid && s.at <= x.at && resetReachesStep(x, step, ss));
  }));
  const notes = d.notes.filter((n) => !list.some((x) => x.g === n.g && n.at <= x.at && (x.t === 'week' || (x.t === 'words' && hasWord(x, n.w)) || (x.t === 'stone' && x.s === 'story'))));
  const skips = d.skips.filter((k) => !list.some((x) => x.g === k.g && k.at <= x.at && (x.t === 'week' || (x.t === 'words' && hasWord(x, k.w)))));
  const folded = {};
  for (const [key, f] of Object.entries(d.folded)) {
    const at = key.indexOf('|');
    const gid = key.slice(0, at);
    const word = key.slice(at + 1);
    const hit = list.filter((x) => x.g === gid && x.t !== 'stone' && (x.t === 'week' || hasWord(x, word)));
    let keep = f;
    for (const x of hit) {
      if (!keep) break;
      if (keep.through <= x.at) keep = null; // folded entirely before the reset
      else keep = { ...keep, days: Object.fromEntries(Object.entries(keep.days).filter(([day]) => day >= x.day)) }; // folded across it: the days before the reset's day go
    }
    if (keep) folded[key] = keep;
  }
  const out = { ...d, results, steps, notes, skips, folded };
  if (d.aside) {
    const aside = Object.fromEntries(Object.entries(d.aside).filter(([key, e]) => {
      const gid = key.slice(0, key.indexOf('|'));
      const word = key.slice(key.indexOf('|') + 1);
      return !list.some((x) => x.g === gid && e.at <= x.at && x.t !== 'stone' && (x.t === 'week' || hasWord(x, word)));
    }));
    if (Object.keys(aside).length) out.aside = aside; else delete out.aside;
  }
  return out;
}
/** The newest stamp that reaches a word of a group (a week or a words reset; with `hello`, a redo of Meet too): the time its own facts start from, or 0. */
export function resetFloor(d, gid, word, { hello = false } = {}) {
  let at = 0;
  for (const x of Object.values((d && d.resets) || {})) {
    if (x.g !== gid) continue;
    if (x.t === 'week' || (x.t === 'words' && hasWord(x, word)) || (hello && x.t === 'stone' && x.s === 'hello')) at = Math.max(at, x.at);
  }
  return at;
}
/** A stamp for the doc: the same id twice is one stamp. Answers the doc with it added, or null when it cannot be kept without losing an older stamp. */
export function addReset(d, id, stamp) {
  const all = validResets({ ...(d.resets || {}), [id]: stamp });
  const { kept, lost } = fitResets(all);
  if (lost.length) return null;
  const { resets, ...rest } = d;
  return Object.keys(kept).length ? { ...rest, resets: kept } : rest;
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
  return words.length > MAX_WORDS ? 'A week can have up to ' + MAX_WORDS + ' words.' : '';
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

/**
 * Renaming works any day. The words and the date can change until the app's test has begun for the group
 * (canEdit: any test result recorded), not only until the test date (SB3-C2). A new date must be after today.
 * Practice is kept: tries are counted per group and word, so a word that stays keeps its dots; a word taken out
 * stops counting for this group (its tries are never deleted); a word added starts fresh.
 */
export function editGroup(d, id, changes, today, now) {
  const g = d.groups[id];
  if (!g || g.gone) return { error: 'That week has gone.' };
  const next = { ...g, at: Math.max(now, g.at + 1) }; // never ties with the stored copy (as delete and restore)
  if ('name' in changes) {
    const name = String(changes.name || '').trim().slice(0, MAX_NAME);
    if (!name) return { error: 'Please give the week a name.' };
    next.name = name;
  }
  if ('words' in changes || 'test' in changes) {
    const wordsChange = 'words' in changes && JSON.stringify(uniqueWords(changes.words)) !== JSON.stringify(g.words);
    const dateChange = 'test' in changes && changes.test !== g.test;
    if ((wordsChange || dateChange) && !canEdit(d, { ...g, id })) return { error: 'This week can\'t change now the test has begun.' };
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
/** The app's test has begun for this group: any of its words has a test result. */
export const testBegun = (d, g) => testResults(d, g).some((x) => x.result);
/** The words and the test date may change until the test has begun. The name any time. */
export const canEdit = (d, g) => !testBegun(d, g);
/**
 * The child's own form keeps the older, stricter rule: words and date only before the test date, and while the test
 * has not begun. From the test date a child may rename or delete only. (A grown-up uses canEdit.)
 */
export const canEditAsChild = (d, g, today) => today < g.test && canEdit(d, g);
/** Its tries stay: they still count towards remembered words. */
export function deleteGroup(d, id, now) {
  const g = d.groups[id];
  return g ? { ...d, groups: { ...d.groups, [id]: { ...g, at: Math.max(now, g.at + 1), gone: now } } } : d;
}
export const UNDELETE_DAYS = 30;
/** Weeks deleted in the last 30 days, newest first (a grown-up can bring one back). */
export const deletedGroups = (d, now) => Object.entries(d.groups).filter(([, g]) => g.gone && g.at > d.resetAt && now - g.gone < UNDELETE_DAYS * DAY_MS)
  .map(([id, g]) => ({ id, ...g })).sort((a, b) => b.gone - a.gone || a.id.localeCompare(b.id));
const sameWords = (a, b) => JSON.stringify(a.map((w) => w.toLowerCase()).sort()) === JSON.stringify(b.map((w) => w.toLowerCase()).sort());
/**
 * Bring a deleted group back: only `gone` is cleared, and `at` goes up so it wins the merge. Refused kindly when a
 * live group already has the same test date and words. Answers { doc } or { error }.
 */
export function restoreGroup(d, id, now) {
  const g = d.groups[id];
  if (!g || !g.gone) return { error: 'That week isn\'t in the deleted list.' };
  if (liveGroups(d).some((x) => x.test === g.test && sameWords(x.words, g.words))) return { error: 'There is already a week with these words and this test date.' };
  const { gone, ...kept } = g;
  return { doc: { ...d, groups: { ...d.groups, [id]: { ...kept, at: Math.max(now, g.at + 1, gone + 1) } } } };
}

// ---- tries ---------------------------------------------------------------------
/** One try: { id, word, day, group, kind: 'p'|'t'|'f', tries, peeks, clean, source?: 'x'|'g', now }. */
export const JOBS = ['h', 'f', 'w', 'k', 'b', 'm', 'q']; // SB6 `j`: Meet, Letter ladder, rows, quick check, builder level 2, Mend, Practice-page game
export const MAX_SLIPS = 5;
export const MAX_BOX = 19;
/** SB6: a list of slip box indices as stored (distinct integers 0..19, ascending, at most 5), or [] when none is valid. */
export const cleanSlips = (a) => (Array.isArray(a) ? [...new Set(a.filter((i) => Number.isInteger(i) && i >= 0 && i <= MAX_BOX))].sort((x, y) => x - y).slice(0, MAX_SLIPS) : []);
const isSitting = (x) => typeof x === 'string' && /^[a-z0-9]{6}$/.test(x);
export function addTry(d, { id, word, day, group, kind, tries, peeks, clean, source, now, lv, h, hn, hr, pf, r, j, ss, sl, rw, pr }) {
  // SB6 (TR-13): a test word spelled after a Peek is { c: 0, p >= 1, pr } so it is out of the pass mark and goes to "keep practising".
  // `pr` counts only when a Peek really happened (peeks >= 1): it is never invented, and then `c` is forced to 0.
  const peeked = kind === 't' && peeks >= 1 && (pr === 0 || pr === 1);
  if (peeked) clean = false;
  const sbs = {
    ...(Number.isInteger(r) && r >= 1 && r <= MAX_RUNG ? { r } : {}),
    ...(JOBS.includes(j) ? { j } : {}),
    ...(isSitting(ss) ? { ss } : {}),
    ...(cleanSlips(sl).length ? { sl: cleanSlips(sl) } : {}),
    ...(Number.isInteger(rw) && rw >= 2 && rw <= 10 ? { rw } : {}),
    ...(peeked ? { pr } : {}),
  };
  // SB4 optional fields: written only when set, never undefined or 0. Absent = a keyboard try.
  const extra = {
    ...(Number.isInteger(lv) && lv >= 1 && lv <= 4 ? { lv } : {}),
    ...(h ? { h: 1 } : {}),
    ...(hn > 0 ? { hn } : {}),
    ...(hr > 0 ? { hr } : {}),
    ...(kind === 't' && (pf === 'sen' || pf === 'top') ? { pf } : {}),
  };
  return { ...d, results: [...d.results, { id, w: word, d: day, g: group, k: kind, t: tries, p: peeks, c: clean ? 1 : 0, ...(source ? { s: source } : {}), ...extra, ...sbs, at: now }] };
}
const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);
const unaided = (r) => !!r.c && !r.t && !r.p;
/** Tile help (SB4): the letters were mostly given (lv 1..3), the tray filled one, or a first-letter hint. Absent fields: a keyboard try. */
export const assisted = (r) => (r.lv >= 1 && r.lv <= 3) || !!r.h || r.hn > 0;
/** Unaided and not assisted: this counts towards remembered. */
export const recall = (r) => unaided(r) && !assisted(r) && !(Number.isInteger(r.r) && r.r >= 1 && r.r < ALL_RUNG); // SB6 (M4): a try at a rung below the whole word (a Copy, a gap) is practice, never recall
const cellKey = (g, w) => g + '|' + w;
const wordOfKey = (key) => key.slice(key.indexOf('|') + 1);

const isMatch = (r) => r.s === 'm';
// The first go of a day is the first time the word is spelled.
const firstOf = (days, day) => !(day in days) || (!!(days[day] & MATCH) && !(days[day] & SPELT));
const validRung = (r) => Number.isInteger(r.r) && r.r >= 1 && r.r <= MAX_RUNG;
// SB6 (TR-12): the rung bits of one try. `prev` is what the day already holds (for ALL_FIRST: the first rung-8 try that day).
/** The bits of slots 1..k (k 1..15), without relying on 32-bit wrap: slot 1 is bit 16, slot 15 is bit 30. */
const thermometer = (k) => (0x7fff >> (TOP_SLOT - k)) << 16;
function rungBits(r, first, prev, rec) {
  if (!validRung(r)) return rec && r.k !== 't' ? RUNG_BITS : 0; // a Normal keyboard or level-4 first go is R-all on its own
  let bits = R_TRY;
  if (unaided(r)) bits |= thermometer(slotOf(r.r)); // slots 1 .. its own
  if (r.r === ALL_RUNG) {
    bits |= ALL_TRIED;
    if (unaided(r) && !(prev & ALL_TRIED)) bits |= ALL_FIRST;
  }
  return bits;
}
function flagsOf(r, first, prev = 0) {
  if (isMatch(r)) return MATCH | (unaided(r) ? MATCH_CLEAN : 0);
  const test = r.k === 't' ? (r.c ? TEST_RIGHT : TEST_WRONG) : 0;
  const fix = first && r.k === 'f' && unaided(r) ? FIX_FIRST : 0;
  const rec = (first && recall(r)) || (r.k === 't' && r.c && !assisted(r)) ? RECALL : 0;
  return (first && unaided(r) ? FIRST : 0) | (r.c ? CLEAN : 0) | test | fix | SPELT | ERA | rec | rungBits(r, first, prev, !!((first && recall(r)) && r.k !== 't'));
}
/** A day folded before SB4 has no ERA bit: bring it up (it counted FIRST or TEST_RIGHT) so it can join a newer one. */
const eraOf = (flags) => (!flags || flags & ERA ? flags : flags | ERA | (flags & (FIRST | TEST_RIGHT) ? RECALL : 0));
const countsFold = (flags) => (flags & ERA ? !!(flags & RECALL) : !!(flags & (FIRST | TEST_RIGHT)));

/** The flow a try belongs to: 'p', 'x', 'f', or '' for a game or the test. */
export function flowOf(r) {
  if (r.k === 'f') return r.s ? '' : 'f';
  if (r.k !== 'p') return '';
  return r.s === 'x' ? 'x' : r.s ? '' : 'p';
}
const runKey = (g, w, day, flow) => cellKey(g, w) + '|' + day + '|' + flow;

// Everything the rules read, from the fold and the tries:
//   cells: group|word -> { day: flags };  days: word -> { day: counts towards remembered }
//   runs: group|word|day|flow -> clean spellings in a row (a mistake or peek: 0)
function ledger(d) {
  const cells = new Map();
  const runs = new Map();
  const days = new Map();
  const dayMap = (w) => { if (!days.has(w)) days.set(w, {}); return days.get(w); };
  for (const [key, f] of Object.entries(d.folded)) {
    cells.set(key, { ...f.days });
    const m = dayMap(wordOfKey(key));
    for (const [day, flags] of Object.entries(f.days)) if (!(flags & MATCH) || flags & SPELT) m[day] = !!m[day] || countsFold(flags);
  }
  for (const r of [...d.results].sort(byTime)) {
    const key = cellKey(r.g, r.w);
    if (!cells.has(key)) cells.set(key, {});
    const c = cells.get(key);
    const first = firstOf(c, r.d);
    c[r.d] = (c[r.d] || 0) | flagsOf(r, first, c[r.d] || 0);
    const flow = flowOf(r);
    if (flow) {
      const k = runKey(r.g, r.w, r.d, flow);
      const had = runs.get(k) || 0;
      const n = had >= ROW_NEEDED ? had : unaided(r) ? had + 1 : 0; // done stays done
      runs.set(k, n);
      if (n >= ROW_NEEDED) c[r.d] |= ROW[flow];
    }
    if (isMatch(r)) continue;
    const m = dayMap(r.w);
    if (!(r.d in m)) m[r.d] = recall(r);
    if (r.k === 't' && r.c && !assisted(r)) m[r.d] = true; // a word right in the test always counts (unless tiles helped)
  }
  return { cells, days, runs };
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

// ---- practise 3 times --------------------------------------------------------------
/** How far today's session has got: 0 to 3. A mistake or a peek takes it back to 0, until it has reached 3. */
export function sessionCount(d, g, w, day, flow, L = ledger(d)) {
  return flagsOn(L, g, w, day) & ROW[flow] ? ROW_NEEDED : L.runs.get(runKey(g.id, w, day, flow)) || 0;
}
export const sessionDone = (d, g, w, day, flow, L = ledger(d)) => sessionCount(d, g, w, day, flow, L) >= ROW_NEEDED;
const reachedOn = (L, g, w, flow) => Object.entries(L.cells.get(cellKey(g.id, w)) || {}).filter(([, f]) => f & ROW[flow]).map(([day]) => day).sort();
/** Has this word had a whole session in this flow, on any day? */
const reached = (L, g, w, flow) => reachedOn(L, g, w, flow).length > 0;
// The first day any of the group's words was answered in the test, or '' (not begun).
function testBegan(L, g) {
  const days = g.words.flatMap((w) => Object.entries(L.cells.get(cellKey(g.id, w)) || {}).filter(([, f]) => f & (TEST_RIGHT | TEST_WRONG)).map(([day]) => day));
  return days.length ? days.sort()[0] : '';
}
// Practice counts for the test until the test begins. A test never begins before its date, so for a
// group done on time this is "before the test date"; while the study jobs catch up, later days count too.
const beforeTest = (L, g, day) => { const t = testBegan(L, g); return !t || day < t; };
/** Before the test, in Fix it in or on the grid. */
function practised(L, g, w) { return [...reachedOn(L, g, w, 'p'), ...reachedOn(L, g, w, 'x')].some((day) => beforeTest(L, g, day)); }

/** The words a job still needs. Fix-ups go by the day; the others carry over, so a job left halfway keeps what's done. */
export function jobLeft(d, g, day, flow, L = ledger(d)) {
  if (flow === 'f') return fixups(d, g).filter((w) => !sessionDone(d, g, w, day, 'f', L));
  return rows(g).filter((w) => !reached(L, g, w, flow));
}
/** The day a Fix it in or grid job was finished: every word has had its session. */
export function roundDay(d, g, flow, L = ledger(d)) {
  const days = rows(g).map((w) => reachedOn(L, g, w, flow)[0]);
  return days.length && days.every(Boolean) ? [...days].sort().at(-1) : '';
}
/** The dots: 3 once a word has had a whole session before the test, else today's count. */
export function dots(d, g, w, day, L = ledger(d)) {
  if (practised(L, g, w)) return ROW_NEEDED;
  return beforeTest(L, g, day) ? Math.max(sessionCount(d, g, w, day, 'p', L), sessionCount(d, g, w, day, 'x', L)) : 0;
}
export function allDots(d, g, day) { const L = ledger(d); return rows(g).map((w) => ({ word: w, dots: dots(d, g, w, day, L), back: g.back.includes(w) })); }
/** Only the group's own words are in the test, so only they need their session. */
export function readyForTest(d, g) { const L = ledger(d); return g.words.every((w) => practised(L, g, w)); }

// ---- skip for now ------------------------------------------------------------------
export function addSkip(d, { id, group, word, day, flow, now }) {
  return { ...d, skips: [...d.skips, { id, g: group, w: word, d: day, f: flow, at: now }] };
}
const skipTime = (d, g, w, day, flow) => d.skips.filter((s) => s.g === g.id && s.w === w && s.d === day && s.f === flow).reduce((t, s) => Math.max(t, s.at), 0);
/** The order to go through a list: as it stands, then today's skipped words, last skipped last. */
export function inTurn(d, g, list, day, flow) {
  const when = new Map(list.map((w) => [w, skipTime(d, g, w, day, flow)]));
  return [...list.filter((w) => !when.get(w)), ...list.filter((w) => when.get(w)).sort((a, b) => when.get(a) - when.get(b))];
}
/** What's left of a job, in turn. */
export const queue = (d, g, day, flow) => inTurn(d, g, jobLeft(d, g, day, flow), day, flow);
/** Today's "Come back to this" words, with the flow each belongs to. */
export function comeBack(d, g, day) {
  const L = ledger(d);
  const out = [];
  for (const flow of ['x', 'p', 'f']) {
    const left = new Set(jobLeft(d, g, day, flow, L));
    for (const w of inTurn(d, g, [...left], day, flow)) if (skipTime(d, g, w, day, flow)) out.push({ word: w, flow });
  }
  return out;
}

// ---- jobs done, clues, sentences ---------------------------------------------------
const stepKey = (g, step) => g + '|' + step;
export const stepDay = (d, g, step) => (d.steps[stepKey(g.id, step)] || { d: '' }).d;
/** The first time counts. `step` may be a part of a job, 'fix:2'. */
export function markStep(d, g, step, day, now, h = '') {
  const key = stepKey(g.id, step);
  return d.steps[key] ? d : { ...d, steps: { ...d.steps, [key]: { d: day, at: now, ...(h ? { h } : {}) } } };
}
/** One clue a word; an empty one takes it away. */
export function setClue(d, word, text, now) {
  const t = String(text || '').trim().slice(0, MAX_CLUE);
  return { ...d, clues: { ...d.clues, [word]: { t, at: now } } };
}
export const clueFor = (d, word) => (d.clues[word] || { t: '' }).t;
/** A sentence. SB6: bl 1|3|4 (the builder level) and hp 1 ("Show me" was used: with help) are written only when set. */
export function addNote(d, { id, group, word, text, day, now, bl, hp }) {
  const sbs = { ...(bl === 1 || bl === 3 || bl === 4 ? { bl } : {}), ...(hp ? { hp: 1 } : {}) };
  return { ...d, notes: [...d.notes, { id, g: group, w: word, x: String(text).trim().slice(0, MAX_NOTE), d: day, ...sbs, at: now }] };
}
export const notesFor = (d, g) => d.notes.filter((x) => x.g === g.id);

// ---- remembered ----------------------------------------------------------------
function rememberedIn(L, w) {
  const good = Object.entries(L.days.get(w) || {}).filter(([, ok]) => ok).map(([day]) => day).sort();
  return good.length >= REMEMBER_DAYS && daysBetween(good[0], good[good.length - 1]) >= REMEMBER_SPAN;
}
export const isRemembered = (d, w) => rememberedIn(ledger(d), w);
export function goodDays(d, w) { return Object.entries(ledger(d).days.get(w) || {}).filter(([, ok]) => ok).map(([day]) => day).sort(); }

// ---- SB6: the ladder's facts about a word (TR-12) ----------------------------------------
const SECURE_DAYS = (RULES.secure && RULES.secure.days) || 2;
const SIDE_JOBS = ['w', 'k', 'b', 'q']; // stones that are not the ladder itself
const KEEP_SLIPS = (RULES.slip && RULES.slip.keep) || 5;
const USUAL_DAYS = (RULES.slip && RULES.slip.usualDays) || 2;
/** The highest rung a day's flags say the child reached on their own: the rung bits, else R-all for a recall day, else 1 for a clean first go that was assisted (a day an older device folded), else 0. */
function rungOfDay(flags) {
  if (flags & MATCH && !(flags & SPELT)) return 0;
  for (let k = TOP_SLOT; k >= 1; k -= 1) if (flags & SLOT_BIT(k)) return k === TOP_SLOT ? ALL_RUNG : k;
  if (flags & R_TRY) return 0;
  if (countsFold(flags)) return ALL_RUNG; // RECALL (or, on a day folded before SB4, FIRST or a right test answer)
  return flags & FIRST ? 1 : 0;
}
/**
 * What the ladder needs to know about a word, across every week it is in, from the tries and the folded days:
 *   best        highest rung reached on its own on a day before `today` (0 = none); bestToday: the same for today
 *   allDays     days the whole word was spelled first go on its own (rung 8 first, or a recall)
 *   secure      allDays on RULES.secure.days different days: "Got it"
 *   metOn       the first day a try had a rung ('' = not met); days: every such day, oldest first
 *   peeksTotal, slipsTotal   over every try (and every fold) of the word, Meaning match left out
 *   resume      { r, clean, day, ss } of the newest ladder try of the word (from unfolded tries; rows, checks and builder tries are not the ladder), else null:
 *               r is the exact saved step (the rung code tried), clean is true when that try had no slip and no Peek. The next sitting resumes a word
 *               in progress at this step (D22: nothing is parked)
 *   lastSitting { ss, day, peekedEvery, slipRungs } for the newest sitting (`ss`) that has a try of this word, else null
 *               peekedEvery: every rung 2..7 tried in the sitting had a Peek on some try (at least one such rung)
 *               slipRungs: the distinct rungs with a slip in the sitting, ascending
 *   slipSpots   box indices of the last RULES.slip.keep slips on unfolded tries, newest first, each once (holds no letter)
 *   usualSpots  of those slips, the indices seen on RULES.slip.usualDays different days, ascending
 */
export function ladderFacts(d, word, today, L = ledger(d)) {
  const w = lc(word);
  const days = new Map(); // day -> flags, all weeks
  let peeksTotal = 0;
  let slipsTotal = 0;
  for (const [key, cell] of L.cells) {
    if (lc(wordOfKey(key)) !== w) continue;
    for (const [day, flags] of Object.entries(cell)) days.set(day, (days.get(day) || 0) | flags);
  }
  for (const [key, f] of Object.entries(d.folded)) if (lc(wordOfKey(key)) === w) { peeksTotal += f.p; slipsTotal += f.t; }
  const mine = d.results.filter((r) => lc(r.w) === w && !isMatch(r)).sort(byTime);
  for (const r of mine) { peeksTotal += num(r.p); slipsTotal += num(r.t); }
  let best = 0;
  let bestToday = 0;
  const allDays = [];
  const met = [];
  for (const [day, flags] of [...days].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const rung = rungOfDay(flags);
    if (day < today) best = Math.max(best, rung); else if (day === today) bestToday = Math.max(bestToday, rung);
    if (flags & (ALL_FIRST | RECALL)) allDays.push(day);
    if (flags & (R_TRY | RUNG_BITS)) met.push(day);
  }
  // the newest sitting
  const sat = mine.filter((r) => isSitting(r.ss));
  let lastSitting = null;
  if (sat.length) {
    const ss = sat[sat.length - 1].ss;
    const tries = sat.filter((r) => r.ss === ss);
    const rungs = tries.filter(validRung).filter((r) => !SIDE_JOBS.includes(r.j)); // the ladder's own tries (rows, checks, builder are not)
    const slipRungs = [...new Set(rungs.filter((r) => r.t > 0).map((r) => r.r))].sort((a, b) => a - b);
    const hidden = [...new Set(rungs.filter((r) => r.r >= 2 && r.r < ALL_RUNG).map((r) => r.r))];
    lastSitting = {
      ss,
      day: tries[tries.length - 1].d,
      peekedEvery: hidden.length > 0 && hidden.every((k) => rungs.some((r) => r.r === k && r.p > 0)),
      slipRungs,
    };
  }
  const ladder = mine.filter((r) => validRung(r) && !SIDE_JOBS.includes(r.j));
  const last = ladder.length ? ladder[ladder.length - 1] : null;
  const resume = last ? { r: last.r, clean: unaided(last), day: last.d, ss: isSitting(last.ss) ? last.ss : '' } : null;
  const window = [];
  for (const r of [...mine].reverse()) {
    for (const i of cleanSlips(r.sl)) window.push({ i, day: r.d });
    if (window.length >= KEEP_SLIPS) break;
  }
  const spots = window.slice(0, KEEP_SLIPS);
  const slipSpots = [...new Set(spots.map((x) => x.i))];
  const usualSpots = slipSpots.filter((i) => new Set(spots.filter((x) => x.i === i).map((x) => x.day)).size >= USUAL_DAYS).sort((a, b) => a - b);
  return { best, bestToday, allDays, secure: allDays.length >= SECURE_DAYS, metOn: met[0] || '', days: met, peeksTotal, slipsTotal, resume, lastSitting, slipSpots, usualSpots };
}

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

/** The words still to fix: slipped, and no day yet with a clean first go and a whole session. */
export function fixups(d, g) {
  const L = ledger(d);
  return slipped(d, g).filter((w) => !Object.values(L.cells.get(cellKey(g.id, w)) || {}).some((f) => f & FIX_FIRST && f & ROW.f));
}

// ---- the study week's jobs before the test ------------------------------------------
// Study mode (study-doc.js) has five jobs before the test. They are read here
// because they decide when the test is due, and so when the words are hidden.
export const STUDY_JOBS = ['hello', 'fix', 'games', 'story', 'practice'];
/** The day a study job was finished, or ''. Practice day is a whole round of the grid; Fix it in a mark or a whole round of it. */
export function studyJobDay(d, g, step) {
  if (step === 'practice') return roundDay(d, g, 'p') || stepDay(d, g, 'practice');
  if (step === 'fix') return stepDay(d, g, 'fix') || roundDay(d, g, 'x');
  return stepDay(d, g, step);
}
/** Every study job before the test is done. */
export const studyDone = (d, g) => STUDY_JOBS.every((s) => studyJobDay(d, g, s));

// ---- today's job ---------------------------------------------------------------
// 'practise' · 'test' · 'wait' (tested today: fix-ups come tomorrow) ·
// 'fixups' · 'fixed-today' (all done for today, some come back tomorrow) · 'finished'
// The test is due (and its words hidden) from its date, once every study job is
// done; until then it's still 'practise', so the jobs can catch up. A test
// already begun (left halfway) stays due, so no word shows mid-test.
// This is the one place that says the test is due: test-guard.js, the lists,
// Game mode and Study mode all ask here.
export function jobFor(d, g, today) {
  if (today < g.test) return 'practise';
  const results = testResults(d, g);
  if (results.some((x) => !x.result)) return results.some((x) => x.result) || studyDone(d, g) ? 'test' : 'practise';
  if (!results.some((x) => !x.result.right)) return 'finished';
  if (today <= testDayOf(results)) return 'wait';
  const left = fixups(d, g);
  if (!left.length) return 'finished';
  return left.every((w) => sessionDone(d, g, w, today, 'f')) ? 'fixed-today' : 'fixups';
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
    // Not before its test (or while its jobs catch up), and not while its test is due: those words stay out of sight.
    if (['practise', 'test'].includes(jobFor(d, g, today))) { rows(g).forEach((w) => skip.add(w)); continue; }
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
    if (r.days) {
      for (const [day, flags] of Object.entries(r.days)) {
        // two folds of one day: if either is from this release, both are read as such
        const both = days[day] && (days[day] & ERA) !== (flags & ERA) ? [eraOf(days[day]), eraOf(flags)] : [days[day] || 0, flags];
        days[day] = both[0] | both[1];
      }
    } else days[r.d] = eraOf(days[r.d] || 0) | flagsOf(r, firstOf(days, r.d), days[r.d] || 0);
    return { ...f, days };
  },
  emptyFold: () => ({ n: 0, t: 0, p: 0, through: 0, days: {} }),
};

// SB6: at an equal `at` the copy with more in it wins (longer JSON, then the larger text), so a copy that has `focus` beats one that lost it.
const biggerJson = (q, p) => { const a = JSON.stringify(q); const b = JSON.stringify(p); return a.length > b.length || (a.length === b.length && a > b); };
export function merge(a, b) {
  let x = normalise(a);
  let y = normalise(b);
  // SB7: a grown-up's reset wins: both copies lose what the union of their stamps reaches, then they merge
  const stamps = cleanResets({ ...(x.resets || {}), ...(y.resets || {}) });
  if (stamps) {
    const ssStone = sittingStones([...x.results, ...y.results]);
    x = applyResets(x, stamps, ssStone);
    y = applyResets(y, stamps, ssStone);
  }
  const log = mergeLog(x, y, LOG);
  const out = { ...emptyDoc(), resetAt: log.resetAt, groups: {}, results: log.results, folded: log.folded };
  for (const id of new Set([...Object.keys(x.groups), ...Object.keys(y.groups)])) {
    const p = x.groups[id];
    const q = y.groups[id];
    const g = !p ? q : !q ? p : q.at > p.at || (q.at === p.at && biggerJson(q, p)) ? q : p;
    if (g.at > out.resetAt) out.groups[id] = g;
  }
  const later = (x) => x.at > out.resetAt;
  for (const key of new Set([...Object.keys(x.steps), ...Object.keys(y.steps)])) {
    const s = [x.steps[key], y.steps[key]].filter(Boolean).sort((p, q) => p.at - q.at || (q.h ? 1 : 0) - (p.h ? 1 : 0))[0]; // the first time it was done; at a tie the copy that knows its words
    if (later(s)) out.steps[key] = s;
  }
  for (const w of new Set([...Object.keys(x.clues), ...Object.keys(y.clues)])) {
    const c = newest(x.clues[w], y.clues[w], (v) => v.at);
    if (later(c)) out.clues[w] = c;
  }
  const byId = (list) => [...new Map(list.filter(later).map((n) => [n.id, n])).values()].sort(byTime);
  out.notes = byId([...x.notes, ...y.notes]);
  out.skips = byId([...x.skips, ...y.skips]);
  const wp = [x.weekPick, y.weekPick].filter(Boolean).sort((p, q) => q.at - p.at || (JSON.stringify(q) > JSON.stringify(p) ? 1 : -1))[0];
  if (wp) out.weekPick = wp;
  const setup = Su.merge(x.setup, y.setup);
  if (!Su.isEmpty(setup)) out.setup = setup;
  const own = Ow.merge(x.own, y.own);
  if (!Ow.isEmpty(own)) out.own = own;
  const aside = {};
  for (const k of new Set([...Object.keys(x.aside || {}), ...Object.keys(y.aside || {})])) {
    const p = (x.aside || {})[k];
    const q = (y.aside || {})[k];
    aside[k] = !p ? q : !q ? p : q.at > p.at || (q.at === p.at && biggerJson(q, p)) ? q : p;
  }
  if (Object.keys(aside).length) out.aside = aside;
  if (stamps) out.resets = stamps;
  // SB6 (TR-15): a key this release does not know
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (TOP.includes(k)) continue;
    const p = x[k];
    const q = y[k];
    const at = (v) => (v && typeof v === 'object' && !Array.isArray(v) && typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : null);
    // the larger `.at`; at a tie, or when one has none, the larger JSON (the same rule as groups), so every device ends on one copy
    const v = p === undefined ? q : q === undefined ? p : at(p) !== null && at(q) !== null && at(p) !== at(q) ? (at(q) > at(p) ? q : p) : biggerJson(q, p) ? q : p;
    if (at(v) !== null && at(v) <= out.resetAt) continue; // a reset wins by time
    out[k] = v;
  }
  return out;
}

export function trim(d, now) {
  if (d.resets) { // SB7: a stamp is spent RESET_DAYS days after it was made
    const live = Object.fromEntries(Object.entries(d.resets).filter(([, x]) => now - x.at < RESET_DAYS * DAY_MS));
    if (Object.keys(live).length !== Object.keys(d.resets).length) {
      const { resets, ...rest } = d;
      d = Object.keys(live).length ? { ...rest, resets: live } : rest;
    }
  }
  if (d.aside) { // a set-aside mark is spent once its day has passed
    const today = localDay(now);
    const live = Object.fromEntries(Object.entries(d.aside).filter(([, e]) => asideLive(e, today, now)));
    if (Object.keys(live).length !== Object.keys(d.aside).length) {
      const { aside, ...rest } = d;
      d = Object.keys(live).length ? { ...rest, aside: live } : rest;
    }
  }
  if (sizeOf(d) <= TRIM_AT) return d;
  const groups = Object.fromEntries(Object.entries(d.groups).filter(([, g]) => !g.gone || now - g.gone < 90 * DAY_MS));
  // A job's part marks ('fix:2') only say where to carry on: once the job is done they can go.
  // SB6: a sitting mark ('se:<ss>') goes with a deleted group; row marks ('rw:…') of a live group never go (the test reads them).
  const steps = Object.fromEntries(Object.entries(d.steps).filter(([key]) => key.slice(0, key.indexOf('|')) in groups
    && !(key.includes(':') && key.slice(0, key.indexOf(':')) in d.steps)
    && !(key.slice(key.indexOf('|') + 1).startsWith('se:') && groups[key.slice(0, key.indexOf('|'))].gone)));
  const L = ledger(d);
  const base = { ...d, groups, steps, notes: [...d.notes].sort(byTime).slice(-MAX_NOTES), skips: d.skips.filter((s) => now - s.at < SKIP_KEEP_MS) };
  const fold = { target: TRIM_TO, ...LOG, tally: (f, r) => (isMatch(r) ? f : { ...f, t: f.t + r.t, p: f.p + r.p }) };
  // SB6 (TR-16): the tries of the last 24 hours and of the newest sitting are folded last: the ladder reads them unfolded (slip spots,
  // the last sitting). First fold the older ones as far as that gets under the target; only then, if still over, everything oldest first.
  const sittings = d.results.filter((r) => isSitting(r.ss)).sort(byTime);
  const lastSs = sittings.length ? sittings[sittings.length - 1].ss : '';
  // A time SUFFIX is guarded, so folding stays strictly oldest-first (the shared merge drops any try at or before a fold's `through`).
  const lastStart = lastSs ? Math.min(...sittings.filter((r) => r.ss === lastSs).map((r) => r.at)) : Infinity;
  const from = Math.min(now - PROTECT_MS, lastStart);
  const guarded = (r) => r.at >= from;
  const recent = base.results.filter(guarded);
  const first = foldOldest({ ...base, results: base.results.filter((r) => !guarded(r)) }, { ...fold, sizeOf: (x) => sizeOf({ ...x, results: [...x.results, ...recent] }) });
  const out = foldOldest({ ...first, results: [...first.results, ...recent] }, { ...fold, sizeOf });
  // A session reached 3 from a run of tries: folding keeps that, not the run.
  const folded = Object.fromEntries(Object.entries(out.folded).map(([key, f]) => {
    const cell = L.cells.get(key) || {};
    return [key, { ...f, days: Object.fromEntries(Object.entries(f.days).map(([day, flags]) => [day, flags | ((cell[day] || 0) & ROW_BITS)])) }];
  }));
  const kept = { ...out, folded };
  delete kept.setup;
  delete kept.own;
  const setup = Su.trim(d.setup, now);
  if (!Su.isEmpty(setup)) kept.setup = setup;
  const own = Ow.trim(d.own, now);
  if (!Ow.isEmpty(own)) kept.own = own;
  return kept;
}

/** Clear my progress. A grown-up's week-choice switch is not progress: it is kept (SB3-G), so a reset never gives a child the choice back. */
export const reset = (now, prev) => ({ ...emptyDoc(), resetAt: now, ...(prev && prev.weekPick ? { weekPick: prev.weekPick } : {}), ...(prev && prev.setup ? { setup: prev.setup } : {}), ...(prev && prev.own ? { own: prev.own } : {}) });

// ---- SB4: setup and own lists (the field is kept exactly like weekPick) ----------------
export const setupOf = (d) => (d && d.setup) || {};
/** The words value with this setup; the field goes when it is empty. */
export function withSetup(d, su) {
  const { setup, ...rest } = d;
  return Su.isEmpty(su) ? rest : { ...rest, setup: su };
}
export const ownOf = (d) => (d && d.own) || {};
export function withOwn(d, own) {
  const { own: old, ...rest } = d;
  return Ow.isEmpty(own) ? rest : { ...rest, own };
}

// ---- SB4: how much tile help a word has had, and whether a level is ready to go up --------------
/** Over the group's tries for the word: the lowest level used (5 = keyboard), tries the tray helped, hints, hears. */
export function helpOf(d, g, w) {
  const rs = d.results.filter((r) => r.g === g.id && r.w === w && !isMatch(r));
  return {
    minLv: rs.reduce((m, r) => Math.min(m, r.lv >= 1 && r.lv <= 4 ? r.lv : 5), 5),
    helped: rs.filter((r) => r.h).length,
    hints: rs.reduce((n, r) => n + (r.hn > 0 ? r.hn : 0), 0),
    hears: rs.reduce((n, r) => n + (r.hr > 0 ? r.hr : 0), 0),
  };
}
/** At least 80% of the group's words have, on some day and flow, 3 unaided tries in a row all at level `lv` (absent lv = 5). */
export function levelReady(d, g, lv) {
  const runs = new Map();
  const got = new Set();
  const inGroup = new Set(g.words);
  for (const r of [...d.results].sort(byTime)) {
    if (r.g !== g.id || !inGroup.has(r.w) || r.k === 't') continue;
    const flow = flowOf(r);
    if (!flow) continue;
    const k = runKey(r.g, r.w, r.d, flow);
    const here = unaided(r) && (r.lv >= 1 && r.lv <= 4 ? r.lv : 5) === lv;
    const n = here ? (runs.get(k) || 0) + 1 : 0;
    runs.set(k, n);
    if (n >= ROW_NEEDED) got.add(r.w);
  }
  return g.words.length > 0 && got.size * 5 >= g.words.length * 4;
}

// ---- the grown-up's week-choice switch (SB3-G) ----------------------------------------
/** True unless a grown-up switched it off. Absent field = on. */
export const weekPickOn = (d) => !(d && d.weekPick && d.weekPick.on === false);
/** Set the switch; `at` always goes up, so this change wins the merge. */
export const setWeekPick = (d, on, now) => ({ ...d, weekPick: { on: !!on, at: Math.max(now, (d.weekPick ? d.weekPick.at : 0) + 1) } });
/** Only a grown-up (who.js kind 'adult') may delete a week; a child never, and an unknown player never. */
/** The words page's link to the edit form: a child only where their own rules allow a change, and never a word "delete"; '' = no link. */
export function editLinkLabel(d, g, today, kind) {
  if (canEditAsChild(d, g, today)) return 'Change this week';
  return kind === 'adult' ? 'Rename or delete' : ''; // a child and an unknown player are treated alike: never the word "delete"
}
/** Only a grown-up may clear a player's progress (it wipes every week): never a child, never an unknown player. */
export const mayClearProgress = (kind) => kind === 'adult';
export const mayDeleteWeek = (kind) => kind === 'adult';
