// A word's run through the ladder, rebuilt from the tries it left (SB6, D22, D25, D26). Pure: no page, no storage, no clock, no Math.random.
// ONE place says how many step-backs a word made and where it was left, for the session (live run), the grown-up's "Stuck word" lines and
// the resume step: `ladder-doc replay` over a sitting's tries (the same afterTry the session uses), then `runInfo` on the run.
// D26: a slip at Copy repeats Copy and is never a step-back, so it never counts towards stuck.
import { RULES } from './sbs-rules.js';
import { rungsFor, replay } from './ladder-doc.js';

const lc = (w) => String(w).toLowerCase();
const LADDER_J = ['h', 'f', 'm'];
const isSitting = (x) => typeof x === 'string' && /^[a-z0-9]{6}$/.test(x);
const entryOf = (word) => ({ word: lc(word), chunks: [lc(word)] }); // the rung list needs only the letters

/** Step-backs it takes to be stuck (RULES.stuck.backs). */
export const stuckAfter = (rules = RULES) => (rules.stuck && rules.stuck.backs) || 3;

/** From a run (live, or rebuilt by replay): { backs, stuck, done, resumeCode }. resumeCode is the step the child is at NOW (after a step-back: the rung it went back to), 0 when the word is done. */
export function runInfo(run, rules = RULES) {
  const backs = (run && run.backs) || 0;
  const done = !!(run && run.done);
  return { backs, stuck: backs >= stuckAfter(rules), done, resumeCode: !run || done ? 0 : run.code };
}

/** Rebuild one run from tries [{ r, t, p, ... }] in order (the first try's rung is where the run began). null when there are none. */
export function runOfTries(tries, entry) {
  if (!tries.length) return null;
  const e = typeof entry === 'string' ? entryOf(entry) : entry;
  return replay(tries, e, rungsFor(e), tries[0].r);
}

/**
 * The runs a word made, one per sitting and stone (or row size), oldest first: [{ ss, j, rw, day, at, tries, run, info }].
 * Only the ladder's own tries (Meet, Letter ladder, Mend, rows); checks and the builder are not part of a run.
 */
export function wordRuns(results, gid, word, entry = word) {
  const groups = new Map();
  for (const r of results) {
    if (r.g !== gid || lc(r.w) !== lc(word) || !isSitting(r.ss) || !Number.isInteger(r.r)) continue;
    if (!(r.j === 'w' || LADDER_J.includes(r.j))) continue;
    const key = r.ss + '|' + (r.j === 'w' ? 'w' + r.rw : 'l');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const out = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    const run = runOfTries(list, entry);
    const last = list[list.length - 1];
    out.push({ ss: last.ss, j: last.j, rw: last.j === 'w' ? last.rw : 0, day: last.d, at: last.at, tries: list, run, info: runInfo(run) });
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * D22: the step a word was left at in its newest run of this stone: opts { stone: 'hello'|'fix'|'mend' } or { size } for a row size.
 * The step it went BACK to after a step-back, the next rung after a clean try, 0 when the run finished (or there is none). The runner passes it as ctx.resume.
 */
export function resumeOf(results, gid, word, entry, { stone = 'hello', size = 0 } = {}) {
  const j = size ? 'w' : { hello: 'h', fix: 'f', mend: 'm' }[stone] || 'h';
  const runs = wordRuns(results, gid, word, entry).filter((x) => (size ? x.j === 'w' && x.rw === size : x.j === j));
  return runs.length ? runs[runs.length - 1].info.resumeCode : 0;
}
