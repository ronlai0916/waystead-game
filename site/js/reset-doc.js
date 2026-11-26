// A grown-up's resets of a Step by step child's week (SB7, D28-D30). Pure: the date and the time come in; no page, no storage.
// Three sizes, grown-up side only (the child's pages never import this file):
//   (a) restartWords  some of the week's words go back to the start of the ladder (Meet the word)
//   (b) redoStone     one stone starts again for every word (Meet the words, Letter ladder, Meanings, Sentences, Words in a row); the others are kept
//   (c) restartWeek   the whole week goes back to day 1; its words and test date stay
// D30: a reset REMOVES the part's progress and its stars and history (tries, marks, row and round marks, peeks counted, stuck counts and the lines
// of the report, which are all counted from them). Each one removes the records at once AND leaves a stamp (words-doc `resets`) so the removal
// wins every later merge from another device or the server copy. What each reset reaches is in words-doc.js (`applyResets`, the one place).
// Never touched: the test and its results (a week whose test has begun cannot be reset), other weeks, other words, the grown-up's setup, the child's
// Usual-way data of other weeks, clues. A stone reset leaves tries trimming has already folded (they cannot be told apart by stone).
import * as W from './words-doc.js';
import * as K from './sbs-week-doc.js';
import * as Rows from './rows-doc.js';

export const STONES = W.RESET_STONES; // hello, fix, games, story, practice (the test and Mend are not stones to redo)
export const stoneTitle = (s) => (K.STONE_TEXT[s] || { title: s }).title;

// ---- the words a grown-up reads ---------------------------------------------------------------------------
export const RESET_TITLE = 'Start again';
export const RESET_HELP = 'This takes back progress and stars for this week only, and what you pick decides how much: some words, one stone for every word, or the whole week. Other weeks are not touched. It can’t be undone.';
export const BLOCKED_TEST = 'The test has started, so this week cannot be restarted.';
export const WORDS_HEAD = 'Restart words';
export const wordsHelp = (nick) => 'Tick the words to take back to the start. ' + nick + ' meets them again.';
export const WORDS_BUTTON = 'Restart ticked words';
export const STONE_HEAD = 'Redo a stone';
export const STONE_HELP = 'Pick one stone. It starts again for every word. The other stones are kept.';
export const STONE_LABEL = 'Which stone';
export const STONE_BUTTON = 'Redo this stone';
export const WEEK_HEAD = 'Restart the whole week';
export const WEEK_HELP = 'Back to day 1. The words and the test date stay.';
export const WEEK_BUTTON = 'Restart the week';
export const KEEP = 'Keep it';
const quote = (w) => '‘' + w + '’';
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

/** The question before a reset: { title, body, confirm, keep }. */
export function confirmFor(kind, arg) {
  if (kind === 'words') {
    const n = arg.length;
    // D33: after a words restart the child does the Meanings and Sentences stones again, for all the week's words (the others' tries are kept)
    return { title: n === 1 ? 'Restart ' + quote(arg[0]) + '?' : 'Restart ' + plural(n, 'word', 'words') + '?', body: (n === 1 ? 'It starts' : 'They start') + ' again from Meet the word. Meanings and Sentences open again for the week. ' + (n === 1 ? 'Its' : 'Their') + ' progress and stars this week are removed. This can’t be undone.', confirm: 'Restart', keep: KEEP };
  }
  if (kind === 'stone') return { title: 'Redo ' + quote(stoneTitle(arg)) + '?', body: 'This stone’s progress and stars for every word this week are removed. The other stones are kept. This can’t be undone.', confirm: 'Redo', keep: KEEP };
  return { title: 'Restart the whole week?', body: 'Everything this week is removed: all progress, stars and sentences. It goes back to day 1. The words and the test date stay. This can’t be undone.', confirm: 'Restart the week', keep: KEEP };
}
/** The short line after a reset (a toast). */
export function doneLine(kind, arg) {
  if (kind === 'words') return arg.length === 1 ? quote(arg[0]) + ' is back at the start.' : plural(arg.length, 'word is', 'words are') + ' back at the start.';
  if (kind === 'stone') return stoneTitle(arg) + ' starts again.';
  return 'The week starts again at day 1.';
}

// ---- the rules --------------------------------------------------------------------------------------------
/** Why a week cannot be reset now, or ''. Once the app's test has begun for the week, no reset is offered (the test and what follows it are kept). */
export function blockedReason(d, g) {
  if (!g || g.gone) return 'That week has gone.';
  return W.testBegun(d, g) ? BLOCKED_TEST : '';
}

const lc = (w) => String(w).toLowerCase();
export const SKEW_MS = 10 * 60000; // how far ahead of the grown-up's clock a stamp may be dated (a child's clock a little fast)
export const FULL = 'Too many restarts are saved for this child just now. Try again in a few days.';
/**
 * The stamp's time: now, or later than anything of the week already written (a device whose clock runs a little ahead), so the copy in hand is
 * cleared whole. Never more than SKEW_MS (10 minutes) ahead of now: a record from a wildly wrong clock stays (it is newer than the stamp, as a
 * later try is), visibly, rather than pushing the stamp into the future, where it would never be spent and would swallow every real try made
 * before that date. The price: a try made on a device whose clock is behind the stamp, in the minutes just after a reset, can be taken too.
 */
function stampAt(d, g, now) {
  let at = now;
  for (const r of d.results) if (r.g === g.id && r.at > at) at = r.at;
  for (const n of d.notes) if (n.g === g.id && n.at > at) at = n.at;
  for (const [key, s] of Object.entries(d.steps)) if (key.startsWith(g.id + '|') && s.at > at) at = s.at;
  return Math.min(at, now + SKEW_MS);
}
const hash = (text) => { let h = 2166136261; for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
/** One id per stamp: the time, the kind and a hash of what it reaches; if that id is taken (the same reset twice in one millisecond), one millisecond later. */
function put(d, g, x, tag, now, today) {
  let at = stampAt(d, g, now);
  const body = { day: today, g: g.id, ...x };
  const make = () => 'x' + at.toString(36) + tag + hash(JSON.stringify(body));
  while ((d.resets || {})[make()]) at += 1;
  const next = W.addReset(d, make(), { at, ...body });
  return next ? W.applyResets(next) : null;
}
function liveWeek(d, gid) {
  const g = W.groupById(d, gid);
  if (!g) return { error: 'That week has gone.' };
  const why = blockedReason(d, g);
  return why ? { error: why } : { g };
}

/** (a) These words of the week go back to the start of the ladder. Answers { doc, words } or { error }. */
export function restartWords(d, gid, words, { now, today }) {
  const w = liveWeek(d, gid);
  if (w.error) return w;
  const rows = W.rows(w.g);
  const picked = [];
  for (const x of words || []) {
    const hit = rows.find((r) => lc(r) === lc(x));
    if (hit && !picked.includes(hit)) picked.push(hit);
  }
  if (!picked.length) return { error: 'Pick at least one word.' };
  const facts = (x) => K.factsOf(d, w.g, x, today);
  const r = Rows.rowKeysOf(d, w.g, facts, picked);
  const body = { t: 'words', w: picked.map(lc), i: picked.map((x) => rows.indexOf(x)), r };
  // the row group marks that stay are tied to their own words first, because the plan may be reshaped when a restarted word climbs back in (FIX-2)
  const tagged = Rows.tagMarks(d, w.g, new Map(w.g.words.map((x) => [x, facts(x)])));
  const doc = put(tagged, w.g, body, 'w', now, today);
  if (!doc) return { error: FULL };
  // the same words again with nothing of theirs done since (an earlier stamp already covers them): a new stamp would remove nothing, so none is added
  const again = Object.values(tagged.resets || {}).some((x) => x.g === w.g.id && x.t === 'words' && picked.every((p) => x.w.includes(lc(p))));
  if (again) {
    const { resets: _a, ...was } = tagged;
    const { resets: _b, ...now2 } = doc;
    if (JSON.stringify(was) === JSON.stringify(now2)) return { doc: tagged, words: picked };
  }
  return { doc, words: picked };
}

/** (b) One stone starts again for every word. Answers { doc, stone } or { error }. */
export function redoStone(d, gid, stone, { now, today }) {
  if (!STONES.includes(stone)) return { error: 'Pick a stone.' };
  const w = liveWeek(d, gid);
  if (w.error) return w;
  const doc = put(d, w.g, { t: 'stone', s: stone }, stone, now, today);
  return doc ? { doc, stone } : { error: FULL };
}

/**
 * (c) The whole week starts again at day 1: everything of the week goes, its words and test date stay. Day 1 is today (as a week set now would be),
 * unless the test date has come, when the start stays. Answers { doc } or { error }.
 */
export function restartWeek(d, gid, { now, today }) {
  const w = liveWeek(d, gid);
  if (w.error) return w;
  let doc = put(d, w.g, { t: 'week' }, 'k', now, today);
  if (!doc) return { error: FULL };
  if (today < w.g.test && w.g.start < today) {
    const g = doc.groups[gid];
    doc = { ...doc, groups: { ...doc.groups, [gid]: { ...g, start: today, at: Math.max(now, g.at + 1) } } };
  }
  return { doc };
}
