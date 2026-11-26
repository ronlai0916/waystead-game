// What a grown-up reads about a Step-by-step week (SB6, TR-29, BR-30, BR-31). Pure: no page, no storage, no clock.
// Only facts: never a percentage, a score, a level, an age or a comparison. Four statuses, from W.ladderFacts.
import * as W from './words-doc.js';
import { CODE, partOf } from './ladder-doc.js';
import { RULES } from './sbs-rules.js';
import * as Runs from './runs-doc.js';

export const STATUSES = ['got-it', 'all-once', 'climbing', 'not-started'];
/** The words a grown-up sees for each status. */
export const STATUS_TEXT = Object.freeze({
  'got-it': 'On its own',
  'all-once': 'Once on its own',
  climbing: 'Still climbing',
  'not-started': 'Not started',
});

const lc = (w) => String(w).toLowerCase();
const bestOf = (f) => (f ? Math.max(f.best || 0, f.bestToday || 0) : 0);
const cap = (w) => (w ? w[0].toUpperCase() + w.slice(1) : w);
const POSS = { she: 'her', her: 'her', he: 'his', his: 'his', they: 'their', their: 'their' };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekday = (day) => WEEKDAYS[((W.daysBetween('2026-11-22', day) % 7) + 7) % 7]; // 22 Nov 2026 was a Sunday
const list = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

/** 'got-it' (the whole word first go on its own on two different days) | 'all-once' | 'climbing' (met, not yet the whole word) | 'not-started'. */
export function status(facts) {
  if (!facts) return 'not-started';
  if (bestOf(facts) >= CODE.ALL) return facts.secure ? 'got-it' : 'all-once'; // the whole word first: never On its own for a word that was only copied
  if (bestOf(facts) > 0 || (facts.days && facts.days.length) || facts.metOn) return 'climbing';
  return 'not-started';
}

/** "Slips around 'igh'": the spelling parts where slips keep coming back (the same box on two days), else ''. */
export function slipLine(entry, facts) {
  if (!entry || !facts || !facts.usualSpots || !facts.usualSpots.length) return '';
  const parts = [...new Set(facts.usualSpots.map((i) => partOf(entry, i)).filter(Boolean))];
  return parts.length ? 'Slips around ' + list(parts.map((p) => "'" + p + "'")) : '';
}

/** Where the child has got to, in words: best rung code -> "3 letters missing", "the whole word". */
export function bestText(code) {
  if (code >= CODE.ALL) return 'the whole word';
  if (code <= 1) return code === 1 ? 'copying the word' : 'met';
  return plural(code - 1, 'letter', 'letters') + ' missing';
}

/** One line a grown-up reads for a word. `opts`: { pronoun: 'she'|'he'|'they', entry } (entry adds the slip line). */
export function wordLine(name, word, facts, { pronoun = 'they', entry = null } = {}) {
  const st = status(facts);
  const own = POSS[pronoun] || 'their';
  const w = cap(word);
  const slip = slipLine(entry, facts);
  let line;
  if (st === 'got-it') {
    const days = [...new Set((facts.allDays || []).map(weekday))].slice(-2);
    line = w + ': all letters on ' + own + ' own' + (days.length ? ' on ' + list(days) : '') + '. On its own.';
  } else if (st === 'all-once') {
    const day = (facts.allDays || []).slice(-1)[0];
    line = w + ': all letters on ' + own + ' own once' + (day ? ', on ' + weekday(day) : '') + '. One more day like it and it is On its own.';
  } else if (st === 'climbing') {
    line = w + ': ' + (bestOf(facts) < 1 ? (name ? name + ' has met it' : 'met') : (name ? name + ' is up to ' : 'up to ') + bestText(bestOf(facts)) + (bestOf(facts) > 1 ? ' on ' + own + ' own' : '')) + '.';
  } else {
    line = w + ': not started yet.';
  }
  if (st !== 'not-started' && facts.peeksTotal > 0) line += ' ' + plural(facts.peeksTotal, 'Peek', 'Peeks') + ' so far.';
  if (slip) line += ' ' + slip + '.';
  return line;
}

/** Counts of each status, for "Who needs help" (groups by these four). statuses: strings from status(). */
export function tally(statuses) {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const s of statuses) if (s in out) out[s] += 1;
  return out;
}

/** The sittings of a week, oldest first: [{ ss, day, minutes, words, finished }]. Minutes = from the first try to the end mark (or the last try), rounded up, at least 1. Old sittings may be folded away. */
export function sittings(d, g) {
  const by = new Map();
  for (const r of d.results) {
    if (r.g !== g.id || !/^[a-z0-9]{6}$/.test(r.ss || '')) continue;
    if (!by.has(r.ss)) by.set(r.ss, []);
    by.get(r.ss).push(r);
  }
  const out = [];
  for (const [ss, tries] of by) {
    tries.sort((a, b) => a.at - b.at);
    const mark = d.steps[g.id + '|se:' + ss];
    const end = mark && mark.at ? mark.at : tries[tries.length - 1].at;
    out.push({ ss, day: tries[0].d, start: tries[0].at, minutes: Math.max(1, Math.ceil((end - tries[0].at) / 60000)), words: new Set(tries.map((x) => lc(x.w))).size, finished: !!mark });
  }
  return out.sort((a, b) => a.start - b.start).map(({ start, ...x }) => x);
}

/**
 * The test for a grown-up: { spelled: [word], keep: [word], withPeek: ['night: spelled with a peek' | 'night: with a peek'] }.
 * A word asked with a Peek is in withPeek (and not in the pass mark); its first answer is the one that stands. A word whose try was folded away comes from W.testResults.
 */
export function testLines(d, g) {
  const out = { spelled: [], keep: [], withPeek: [] };
  for (const { word, result } of W.testResults(d, g)) {
    const t = d.results.filter((r) => r.g === g.id && r.k === 't' && lc(r.w) === lc(word)).sort((a, b) => a.at - b.at)[0];
    if (t && t.p >= 1) out.withPeek.push(word + (t.pr === 1 ? ': spelled with a peek' : ': with a peek'));
    else if (result && result.right) out.spelled.push(word);
    else if (result) out.keep.push(word);
  }
  return out;
}

/** BR-31: offer the usual way when every word was on its own (On its own) in each of the last two weeks. `childWeeks`: one array of statuses (or facts) per week, oldest first. */
export function tryUsualWay(childWeeks) {
  const weeks = (childWeeks || []).filter((w) => Array.isArray(w) && w.length);
  if (weeks.length < 2) return false;
  const st = (x) => (typeof x === 'string' ? x : status(x));
  return weeks.slice(-2).every((w) => w.every((x) => st(x) === 'got-it'));
}

/**
 * D25: words that got stuck, for the grown-up: a word whose run (one sitting, one stone or row size) made `stuck.backs` (3) step-backs, in the
 * last `days` days, and has not been spelled whole and clean since. The run is REBUILT with ladder-doc `replay` (runs-doc `wordRuns`), the same
 * afterTry the session used, so the step-backs are the ones the session counted (D26: a slip at Copy is never one).
 * -> [{ word, day }] newest first. The data holds no "stuck" mark.
 */
export function stuckWords(d, g, today, { days = 3, rules = RULES } = {}) {
  const out = new Map();
  for (const w of g.words) {
    for (const run of Runs.wordRuns(d.results, g.id, w)) {
      if (!Runs.runInfo(run.run, rules).stuck || W.daysBetween(run.day, today) > days) continue;
      const whole = d.results.some((r) => r.g === g.id && lc(r.w) === lc(w) && r.r === CODE.ALL && r.c === 1 && !r.t && !r.p && r.at > run.at
        && (run.j === 'w' ? r.j === 'w' && r.rw === run.rw : !r.j || ['h', 'f', 'm'].includes(r.j)));
      if (whole) continue;
      if (!out.has(lc(w)) || out.get(lc(w)) < run.day) out.set(lc(w), run.day);
    }
  }
  return [...out].map(([word, day]) => ({ word, day })).sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.word < b.word ? -1 : 1));
}
/** "Stuck word: night" lines for the grown-up (words stuck today or lately and not yet spelled clean). */
export const stuckLines = (d, g, today, opts) => stuckWords(d, g, today, opts).map((x) => 'Stuck word: ' + x.word);
