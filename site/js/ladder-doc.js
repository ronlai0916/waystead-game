// The Step-by-step ladder (SB6, TR-21, TR-22, TR-23, with D18). Pure: no page, no storage, no clock,
// no Math.random. The word, the day and the child's facts come in.
//
// Strict ladder (D18): code 0 Meet, 1 Copy, 2..7 = 1..6 letters missing (rung k hides exactly k
// letters, no rung skipped), 8 = the whole word. A short word of n letters hides up to n - 1, then
// the whole word. Hide order: sounded-out letters first (final consonant, consonants, vowels), then
// the tricky part's letters one at a time, then index 0 last. A usual slip spot is hidden a rung earlier.
import { RULES } from './sbs-rules.js';
import { seedOf, rng, tilesFor, fillableOf, trickyAt } from './tiles-doc.js';

export const CODE = { MEET: 0, COPY: 1, ALL: RULES.rungs.allCode };

const nOf = (entry) => fillableOf(entry.word).length;

/** The rung codes for a word: [0, 1, 2 ... n, ALL] (n - 1 letters missing at most). 'cat' -> [0,1,2,3,31]; 'a' -> [0,1,31]. */
export function rungsFor(entry) {
  const n = nOf(entry); // at most 30 letters, so every partial code (k + 1) is below ALL = 31
  const out = [CODE.MEET, CODE.COPY];
  for (let k = 1; k <= Math.max(0, n - 1); k += 1) out.push(k + 1);
  out.push(CODE.ALL);
  return out;
}

/** The middle rung: 1 + ceil(n / 2), or ALL when ceil(n / 2) >= n. */
export function middleCode(entry) {
  const n = nOf(entry);
  const k = Math.ceil(n / 2);
  return k >= n ? CODE.ALL : 1 + k;
}

const shuffled = (list, r) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// the tricky part's box indices (the entry's own, else the first known grapheme), or []
function trickyIndices(entry) {
  const F = fillableOf(entry.word);
  const word = entry.word;
  let t = trickyAt(word, entry.tricky).filter((i) => F.includes(i));
  if (!entry.tricky || !t.length) {
    t = [];
    const lower = word.toLowerCase();
    const list = [...RULES.hide.tricky].sort((a, b) => b.length - a.length);
    let best = -1;
    let bestG = '';
    for (const g of list) {
      const at = lower.indexOf(g);
      if (at < 0) continue;
      if (best < 0 || at < best || (at === best && g.length > bestG.length)) { best = at; bestG = g; }
    }
    if (best >= 0) t = Array.from({ length: bestG.length }, (_, i) => best + i).filter((i) => F.includes(i));
  }
  return t.length > 0 && t.length < F.length ? t : [];
}

/** The hide order as units of box indices. D18: every unit is ONE letter. */
export function unitsOf(entry, { day = '', usual = [] } = {}) {
  const chars = [...entry.word];
  const F = fillableOf(entry.word);
  const T = trickyIndices(entry);
  const inT = new Set(T);
  const r = rng(seedOf(entry.word, day));
  const sounded = F.filter((i) => i !== 0 && !inT.has(i));
  const isVowel = (i) => RULES.hide.vowels.includes(chars[i].toLowerCase());
  const last = F[F.length - 1];
  const finalC = sounded.includes(last) && !isVowel(last) ? [last] : [];
  const cons = shuffled(sounded.filter((i) => !finalC.includes(i) && !isVowel(i)), r);
  const vows = shuffled(sounded.filter((i) => isVowel(i)), r);
  const order = [...finalC, ...cons, ...vows];
  const slipUp = [...new Set(usual)].filter((i) => order.includes(i)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const i of slipUp) {
    const at = order.indexOf(i);
    if (at > 0) { order[at] = order[at - 1]; order[at - 1] = i; }
  }
  const tail = T.filter((i) => i !== 0);
  order.push(...tail);
  if (F.includes(0)) order.push(0);
  return order.map((i) => [i]);
}

/** Box indices that are gaps at a rung (sorted). [] for Meet; every fillable letter for Copy and R-all. */
export function gapsAt(entry, code, { day = '', usual = [] } = {}) {
  const F = fillableOf(entry.word);
  if (code === CODE.MEET) return [];
  if (code === CODE.COPY || code >= CODE.ALL) return [...F];
  const k = Math.min(code - 1, Math.max(0, F.length - 1));
  const units = unitsOf(entry, { day, usual });
  return units.slice(0, k).map((u) => u[0]).sort((a, b) => a - b);
}

/** The tiles-doc spec for a rung, plus { code, glowAfter, model }. null for Meet. */
export function traySpec(entry, code, { day = '', usual = [], lexicon = new Set(), input = 'tiles' } = {}) {
  if (code === CODE.MEET) return null;
  const T = RULES.tray;
  const mid = middleCode(entry);
  let rule;
  let level;
  let model = false;
  if (code === CODE.COPY) { rule = { alts: T.copy.alts, glowAfter: T.copy.glowAfter, distractors: T.copy.distractors }; level = T.levelLow; model = T.copy.model; }
  else if (code >= CODE.ALL) { rule = T.high; level = T.levelAll; }
  else if (code >= mid) { rule = T.high; level = T.levelHigh; }
  else { rule = T.low; level = T.levelLow; }
  const gaps = gapsAt(entry, code, { day, usual });
  const spec = tilesFor(entry, level, seedOf(entry.word, day), { profile: 'sen', lexicon, gaps, extra: rule.distractors, alts: rule.alts });
  if (!spec) return null;
  return { ...spec, code, glowAfter: rule.glowAfter, model, input };
}

/** The spelling part a box belongs to, for the grown-up's line ("igh"); the letter itself otherwise. */
export function partOf(entry, index) {
  const T = trickyIndices(entry);
  const chars = [...entry.word];
  if (T.includes(index)) return T.map((i) => chars[i]).join('').toLowerCase();
  return (chars[index] || '').toLowerCase();
}

// ---- The state machine ------------------------------------------------------------------
const posIn = (rungs, code) => {
  let p = 0;
  for (let i = 0; i < rungs.length; i += 1) if (rungs[i] <= code) p = i;
  return p;
};
const rungBelow = (rungs, code, steps) => {
  // `steps` rungs below `code` in this list, never below R1 Copy
  const p = posIn(rungs, code);
  const from = rungs[p] === code ? p : p + 1;
  return rungs[Math.max(1, Math.min(from - steps, rungs.length - 1))];
};
const rungAtMost = (rungs, code) => rungs[Math.max(1, posIn(rungs, code))];

/**
 * Where a word starts in a sitting. `facts` is from W.ladderFacts (its `best` is a rung code). D22: a word in progress
 * resumes at its exact saved step: pass `resumeAt` (the rung code the last unfinished try left it at); there is no parking.
 */
export function startCode(facts, entry, { inRow = false, resumeAt = 0 } = {}) {
  const rungs = rungsFor(entry);
  if (resumeAt >= CODE.COPY && rungs.includes(resumeAt)) return resumeAt;
  const met = facts && (facts.best > 0 || (facts.days && facts.days.length) || facts.metOn);
  if (!met) return inRow ? CODE.COPY : CODE.MEET;
  if (facts.secure) return CODE.ALL;
  const best = Math.max(1, facts.best || 1);
  if (inRow) return rungBelow(rungs, best, 1);
  const last = facts.lastSitting;
  return rungBelow(rungs, best, last && last.peekedEvery ? 2 : 1);
}

export function newWordRun(entry, start) {
  return { word: entry.word, code: start, start, cleanStreak: 0, slipRungs: [], repeat: false, backs: 0, peekedRungs: [], dropped: false, passed: [], done: false, endedClean: false, line: '' };
}

const step = (run, extra) => ({ ...run, ...extra });

/**
 * One try finished. `tries` = wrong letters in that try, `peeks` = Peeks used. A rung gets a first go and one repeat
 * (D19). Clean (no slip, no Peek) moves up to the next rung in `rungs`: nothing is skipped. A first go that is not
 * clean repeats once ('Once more...' after a slip, no line after a Peek alone); 2 slips on a first go go back one rung.
 * D22, NO PARKING: a repeat that is not clean (slip or Peek) goes back one rung EVERY time, never below Copy; at Copy a
 * try that is not clean repeats Copy (every letter is shown, so a clean try is always reachable). 'done' only after the
 * whole word is spelled clean. Returns { run, next: 'up' | 'repeat' | 'back' | 'done', line }. `run.code` is always the
 * step the child is at, so a sitting that stops mid-word can resume there. `run.endedClean` says whether THIS try was clean.
 */
export function afterTry(run, input, rungs) {
  const out = afterTryInner(run, input, rungs);
  // D25: `stuck: true` on the try whose step-back is the word's RULES.stuck.backs-th in this sitting
  return out.next === 'back' && out.run.backs === RULES.stuck.backs ? { ...out, stuck: true } : out;
}
function afterTryInner(run, { tries = 0, peeks = 0, entry }, rungs) {
  const code = run.code;
  const L = RULES.lines;
  const clean = tries === 0 && peeks === 0;
  const finish = (r, next, line = '') => ({ run: { ...r, endedClean: clean, line, last: next }, next, line });
  const top = rungs[rungs.length - 1];
  const p = posIn(rungs, code);
  const nextRung = rungs[Math.min(p + 1, rungs.length - 1)];
  const lowest = rungs.length > 1 ? rungs[1] : rungs[0];
  const slipRungs = tries > 0 && !run.slipRungs.includes(code) ? [...run.slipRungs, code] : run.slipRungs;
  const peekedRungs = peeks > 0 && !run.peekedRungs.includes(code) ? [...run.peekedRungs, code] : run.peekedRungs;
  const base = { slipRungs, peekedRungs };
  const back = (r, to) => finish(step(r, { ...base, code: to, backs: r.backs + 1, repeat: false, cleanStreak: 0 }), 'back', L.back);
  const again = (r) => finish(step(r, { ...base, repeat: true, cleanStreak: 0 }), 'repeat', tries > 0 ? L.repeat : '');

  if (clean) {
    if (code === top) return finish(step(run, { ...base, passed: [...run.passed, code], done: true, repeat: false, cleanStreak: run.cleanStreak + 1 }), 'done');
    return finish(step(run, { ...base, passed: [...run.passed, code], code: nextRung, repeat: false, cleanStreak: run.cleanStreak + 1 }), 'up');
  }
  if (code === CODE.ALL && run.start === CODE.ALL && !run.dropped && tries > 0) {
    // a secure word that slips at the whole word drops to the middle rung for this sitting
    return finish(step(run, { ...base, code: rungAtMost(rungs, middleCode(entry)), dropped: true, backs: run.backs + 1, repeat: false, cleanStreak: 0 }), 'back', L.back);
  }
  if (code <= lowest) return again(run); // Copy: not clean, so Copy again
  if (run.repeat || tries >= RULES.slip.back) return back(run, rungs[Math.max(1, p - 1)]);
  return again(run); // a first go with 1 slip, or a Peek alone: one repeat
}

/** Rebuild a run from a sitting's tries for one word: [{ t: slips, p: peeks }] in order. */
export function replay(tries, entry, rungs, start) {
  let run = newWordRun(entry, start);
  for (const t of tries) {
    if (run.done) break;
    run = afterTry(run, { tries: t.t || 0, peeks: t.p || 0, entry }, rungs).run;
  }
  return run;
}
