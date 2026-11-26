// Words in a row (SB6, TR-25; D11, D13, D14; D18-D21, D27). Pure: no page, no storage, no clock, no Math.random.
// The date and the child's facts come in. Step by step only (D13): rows grow 2, 3, 4 ... up to all of the week's
// words (D11), but a size with no group of its own size is skipped (D27: `roundSizes`); the test opens only after a round of EVERY size in `roundSizes` (D14), so progress is kept as step marks that
// trimming can never lose:  `<gid>|rw:<k>`  a finished round,  `<gid>|rw:<k>:<i>`  a finished row group.
// Every number is read from sbs-rules.js. The rows stone writes the `practice` step mark and nothing else of W's.
import * as W from './words-doc.js';
import { RULES } from './sbs-rules.js';
import { seedOf, rng } from './tiles-doc.js';
import { startCode, rungsFor, CODE } from './ladder-doc.js';
import { resumeOf } from './runs-doc.js';

const lc = (w) => String(w).toLowerCase();
/** facts for a word from a Map, a plain object (keyed by word) or a function; null when there is none. */
const factsFor = (facts, word) => {
  if (!facts) return null;
  if (typeof facts === 'function') return facts(word) || facts(lc(word)) || null;
  if (facts instanceof Map) return facts.get(word) || facts.get(lc(word)) || null;
  return facts[word] || facts[lc(word)] || null;
};
const bestOf = (f) => (f ? Math.max(f.best || 0, f.bestToday || 0) : 0);
/** Has this word reached the whole word on its own (D18: rows use words that did)? */
export const reachedAll = (f) => !!f && (!!f.secure || bestOf(f) >= CODE.ALL);

/** The week's test words that did the whole word once (BR-16 AC1), in the week's order. */
export function rowWords(d, g, facts) {
  return g.words.filter((w) => reachedAll(factsFor(facts, w)));
}

/**
 * [2, 3, ... n] without the sizes that would have no group of that size (D27: 9 of 10 words is 8 + 2, because a group of 1 is never made, so
 * a "nines" round would show rows of 8 and 2); [] when n < 2 (a week of one word has no rows). Everything that needs "every size" reads this.
 */
export function roundSizes(n, rules = RULES) {
  const first = rules.rows.first;
  const out = [];
  for (let k = first; k <= n; k += rules.rows.grow) if (splitSizes(n, k).includes(k)) out.push(k);
  return out;
}

/** How n words split into groups of about k, never a group of 1. k >= n: one group. n = 10: k2 5x2; k3 3,3,2,2; k4 4,4,2; k5 5,5; k6 6,4; k9 8,2; k10 10. */
export function splitSizes(n, k) {
  if (n < 1) return [];
  if (k >= n) return [n];
  const q = Math.floor(n / k);
  const r = n % k;
  if (r === 0) return Array(q).fill(k);
  if (r >= 2) return [...Array(q).fill(k), r];
  // r === 1
  if (k === 2) return [...Array(q - 1).fill(2), 3]; // 2 + 1 would leave a lone word: the last group takes three
  return [...Array(q - 1).fill(k), k - 1, 2];
};

const seedNum = (s) => (typeof s === 'number' ? s >>> 0 : seedOf(String(s), ''));
function shuffled(list, r) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const rotate = (a, by) => (a.length ? a.map((_, i) => a[(i + by) % a.length]) : []);
const same = (a, b) => a.length === b.length && a.every((x, i) => lc(x) === lc(b[i]));

/**
 * The row groups of a round: a fixed mixed order (the same for the same week), rotated by the size so a partner is not
 * the same word every round, then cut as splitSizes says. `avoid` (optional) is the order the words were met in R0: the plan never follows it exactly.
 */
export function rowPlan(words, size, seed, { avoid = null, rules = RULES } = {}) {
  if (words.length < 2) return [];
  let order = rotate(shuffled(words, rng(seedNum(seed))), (size - rules.rows.first) % words.length);
  if (avoid && same(order, avoid)) order = rotate(order, 1);
  const out = [];
  let at = 0;
  for (const n of splitSizes(order.length, size)) { out.push(order.slice(at, at + n)); at += n; }
  return out;
}

/** The order the words were first met in (the first `j: 'h'` try of each), from the data, so every caller gets the same plan. */
function metOrder(d, g, words) {
  const first = new Map();
  for (const r of d.results) if (r.g === g.id && r.j === 'h' && !first.has(lc(r.w))) first.set(lc(r.w), r.at);
  const seen = words.filter((w) => first.has(lc(w))).sort((a, b) => first.get(lc(a)) - first.get(lc(b)));
  return seen.length === words.length ? seen : null;
}

// ---- marks ---------------------------------------------------------------------------------------
/** The round of this size has its `rw:<size>` mark (D14: marks, not tries). */
export const roundDone = (d, g, size) => !!W.stepDay(d, g, 'rw:' + size);
/** The row group `index` of this size has its `rw:<size>:<index>` mark. */
export const groupDone = (d, g, size, index) => !!W.stepDay(d, g, 'rw:' + size + ':' + index);
/** Every size in `roundSizes` has its mark; a week of one word has no rows and is done at once. */
export function stoneDone(d, g) {
  return roundSizes(g.words.length).every((k) => roundDone(d, g, k));
}

// ---- what the tries say about one word in one round -------------------------------------------------
const cleanAll = (r) => r.r === CODE.ALL && r.c === 1 && !r.t && !r.p;
/** The word's row tries of this size, oldest first. */
const rowTries = (d, g, size, word) => d.results.filter((r) => r.g === g.id && lc(r.w) === lc(word) && r.j === 'w' && r.rw === size)
  .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
/** Did the word reach the whole word cleanly in a row of this size? null when no try is left to say (folded). D22: there is no pass-over: a group stays until every word has. */
export function reachedInRow(d, g, size, word) {
  const t = rowTries(d, g, size, word);
  return t.length ? t.some(cleanAll) : null;
}

/** The step a saved word is at: after a clean try the next rung, after a try that was not clean the same rung again; 0 when the word is done (or has no try). */
export function resumeCode(r, clean, entry) {
  if (!r) return 0;
  const rungs = rungsFor(entry);
  if (clean) {
    if (r >= CODE.ALL) return 0;
    const i = rungs.indexOf(r);
    return i >= 0 && i + 1 < rungs.length ? rungs[i + 1] : 0;
  }
  return rungs.includes(r) ? r : 0;
}
/** D22: where a word in a row was left: the step its newest run of this size is at NOW (after a step-back the rung it went back to; runs-doc), or 0. */
export function rowResume(d, g, size, word, entry) {
  return resumeOf(d.results, g.id, word, entry && entry.word ? entry : word, { size });
}

/** One group of a round: who is still to do it. D22: nobody is passed over. */
export function groupStatus(d, g, size, index, group) {
  if (groupDone(d, g, size, index)) return { done: true, left: [], members: group };
  const left = group.filter((w) => reachedInRow(d, g, size, w) !== true);
  return { done: left.length === 0, left, members: group };
}

/** Where a word starts in a row of this size: from `rows.startAtAllFrom` a word that reached the whole word in the previous round starts there; otherwise one below its best. */
export function rowStart(d, g, size, word, facts, entry, rules = RULES) {
  const f = factsFor(facts, word) || { best: 0, days: [] };
  const resumeAt = rowResume(d, g, size, word, entry);
  if (resumeAt) return resumeAt;
  if (size >= rules.rows.startAtAllFrom) {
    // D27: the previous round is the size before this one in roundSizes (9 is skipped for 10 words), not size - 1
    const sizes = roundSizes(g.words.length, rules);
    const prevSize = sizes[sizes.indexOf(size) - 1];
    if (prevSize !== undefined && prevSize >= rules.rows.first) {
      const prev = reachedInRow(d, g, prevSize, word);
      if (prev === true || (prev === null && roundDone(d, g, prevSize))) return CODE.ALL;
    }
  }
  return startCode({ ...f, best: Math.max(f.best || 0, f.bestToday || 0) }, entry, { inRow: true });
}

/**
 * The first group still to do: smallest round first, so a round is never mixed with the next. { size, group, index, of, left, kept } or null.
 * `skip(word)` (optional): words that cannot be offered now (stuck in this sitting, set aside today). A group whose remaining words are ALL skipped
 * is passed by for now and the next group of the SAME size is offered; the round is not marked and the next size still waits (D14, D22). `left` holds only offerable words.
 */
export function nextRow(d, g, today, facts, { rules = RULES, skip = null } = {}) {
  const words = rowWords(d, g, facts);
  const avoid = metOrder(d, g, words);
  for (const size of roundSizes(g.words.length, rules)) {
    if (roundDone(d, g, size)) continue;
    const plan = rowPlan(words, size, seedOf(g.id + '|rows', ''), { avoid, rules });
    let open = false;
    for (let i = 0; i < plan.length; i += 1) {
      const st = groupStatus(d, g, size, i, plan[i]);
      if (st.done) continue;
      open = true;
      const left = skip ? st.left.filter((w) => !skip(w)) : st.left;
      if (!left.length) continue;
      return { size, group: st.members, index: i, of: plan.length, left, kept: st.members.filter((w) => !st.left.includes(w)) };
    }
    if (open) return null; // this size still has work (or only words that cannot be offered now): the next size waits
  }
  return null;
}

/**
 * The step marks the runner should write now, in order, at a safe point: a finished group `rw:<k>:<i>`, a finished
 * round `rw:<k>` (also a round with nothing to do), and `practice` once every size is done. Calling it again after
 * writing gives the next ones. Never anything else.
 */
export function marksToWrite(d, g, today, facts, { rules = RULES } = {}) {
  const words = rowWords(d, g, facts);
  const avoid = metOrder(d, g, words);
  const out = [];
  const have = (step) => !!W.stepDay(d, g, step);
  let all = true;
  for (const size of roundSizes(g.words.length, rules)) {
    if (roundDone(d, g, size)) continue;
    const plan = rowPlan(words, size, seedOf(g.id + '|rows', ''), { avoid, rules });
    let complete = true;
    for (let i = 0; i < plan.length; i += 1) {
      if (groupDone(d, g, size, i)) continue;
      if (groupStatus(d, g, size, i, plan[i]).done) { if (!have('rw:' + size + ':' + i)) out.push('rw:' + size + ':' + i); } else complete = false;
    }
    if (!complete) { all = false; break; }
    out.push('rw:' + size);
  }
  if (all && !have('practice')) out.push('practice');
  return out;
}

const SIZE_NAME = { 2: 'Pairs', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens' };
export const sizeName = (k) => SIZE_NAME[k] || k + 's';
/** For the grown-up: "Pairs done. Threes done. Fours to do. Then up to tens." Up to the first size still to do. */
export function rowsLine(d, g) {
  const sizes = roundSizes(g.words.length);
  if (!sizes.length) return 'No rows this week: there is only one word.';
  const parts = [];
  for (const k of sizes) {
    if (roundDone(d, g, k)) { parts.push(sizeName(k) + ' done.'); continue; }
    parts.push(sizeName(k) + ' to do.');
    const last = sizes[sizes.length - 1];
    if (k < last) parts.push('Then up to ' + sizeName(last).toLowerCase() + '.');
    break;
  }
  return parts.join(' ');
}

/** How many groups of the size now being done can be offered (a group of stuck or set-aside words is not counted): the "First: N rows" number. */
function offerable(d, g, today, facts, skip, rules = RULES) {
  const first = nextRow(d, g, today, facts, { rules, skip });
  if (!first) return 0;
  const words = rowWords(d, g, facts);
  const plan = rowPlan(words, first.size, seedOf(g.id + '|rows', ''), { avoid: metOrder(d, g, words), rules });
  let n = 0;
  for (let i = 0; i < plan.length; i += 1) {
    const st = groupStatus(d, g, first.size, i, plan[i]);
    if (!st.done && st.left.some((w) => !skip || !skip(w))) n += 1;
  }
  return n;
}

/** What the session needs for rows: the next group, where a word starts, and how many groups are left in the round. Built from the current value, so the runner makes a new one after writing tries and marks. */
export function rowsCtx(d, g, today, facts, entryOf) {
  return {
    next: (skip) => nextRow(d, g, today, facts, { skip }),
    start: (size, word) => rowStart(d, g, size, word, facts, entryOf(word)),
    plan: (skip) => offerable(d, g, today, facts, skip),
  };
}
