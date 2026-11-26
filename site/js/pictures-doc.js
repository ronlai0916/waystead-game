// SB6-WP-8a (TRS v2 TR-51): word pictures, the pure parts. No DOM, no network, no storage; the strings a grown-up reads.
// A child never sees any of this (allowance, credits, plans, trials): it is grown-up copy only.
import { askable } from './pictures-data.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const plural = (n, one, many) => (n === 1 ? one : many);
const nat = (x) => (Number.isInteger(x) && x >= 0 ? x : 0);
const pics = (n) => n + ' word ' + plural(n, 'picture', 'pictures');
const creds = (n) => n + ' story ' + plural(n, 'credit', 'credits');
const dateWords = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof iso === 'string' ? iso : '');
  return m && +m[2] >= 1 && +m[2] <= 12 ? String(+m[3]) + ' ' + MONTHS[+m[2] - 1] : '';
};

/** Anything the pages hold their states in -> Map(word -> item): a Map, an object keyed by word, or A3's items array. */
export function byWord(states) {
  const out = new Map();
  if (states instanceof Map) { for (const [w, it] of states) out.set(w, typeof it === 'string' ? { word: w, status: it } : { word: w, ...it }); return out; }
  if (Array.isArray(states)) { for (const it of states) if (it && typeof it.word === 'string') out.set(it.word, it); return out; }
  if (states && typeof states === 'object') { for (const [w, it] of Object.entries(states)) out.set(w, typeof it === 'string' ? { word: w, status: it } : { word: w, ...it }); }
  return out;
}

const asSet = (x) => (typeof x === 'function' ? null : new Set((x instanceof Set ? [...x] : Array.isArray(x) ? x : []).map((w) => String(w).toLowerCase())));
const isMade = (readyMade) => { const s = asSet(readyMade); return typeof readyMade === 'function' ? (w) => !!readyMade(w) : (w) => s.has(w); };

/**
 * The own words to ask a picture for: in list order, once each, askable, with no ready-made picture and no state yet.
 * `ownLists`: an array of lists ({ words: [...] } or [words]) or the own-lists object (id -> { words }); `readyMade`: a function, Set or array of words;
 * `states`: see byWord. A word with ANY state (even none, unsuitable or failed) is not asked again by itself: the grown-up decides.
 */
export function wordsToAsk(ownLists, readyMade, states) {
  const lists = Array.isArray(ownLists) ? ownLists : ownLists && typeof ownLists === 'object' ? Object.values(ownLists) : [];
  const all = lists.flatMap((l) => (Array.isArray(l) ? l : l && Array.isArray(l.words) ? l.words : []));
  const made = isMade(readyMade);
  const known = byWord(states);
  return askable(all).filter((w) => !made(w) && !known.has(w));
}

/** One word's state for its row: 'making' | 'check' | 'in-use' | 'unsuitable' | 'none' | 'failed'. A candidate waiting beside an approved picture is 'check'. */
export function rowState(word, states) {
  const it = byWord(states).get(word);
  if (!it) return 'none';
  if (it.status === 'making') return 'making';
  if (it.status === 'ready') return 'check';
  if (it.status === 'approved') return it.candidate && it.candidate.id ? 'check' : 'in-use';
  if (it.status === 'unsuitable') return 'unsuitable';
  if (it.status === 'failed') return 'failed';
  return 'none';
}

/** The grid page's model: pictures to check (with the id to Use or Make another), making, in use, and the rest; `checkIds` is for Use all (A4b). */
export function gridModel(states) {
  const m = { check: [], making: [], inUse: [], unsuitable: [], failed: [], none: [], checkIds: [], anyMaking: false };
  for (const [word, it] of byWord(states)) {
    const s = rowState(word, states);
    if (s === 'check') { const id = it.candidate && it.candidate.id ? it.candidate.id : null; if (id) { m.check.push({ word, id }); m.checkIds.push(id); } }
    else if (s === 'making') m.making.push(word);
    else if (s === 'in-use') m.inUse.push({ word, id: it.approved && it.approved.id ? it.approved.id : null });
    else if (s === 'unsuitable') m.unsuitable.push(word);
    else if (s === 'failed') m.failed.push(word);
    else m.none.push(word);
  }
  m.anyMaking = m.making.length > 0;
  return m;
}

/** An unlimited account: said once, with what it covers, so the story credits below it do not read as a contradiction (UAT). */
export const UNLIMITED_LINE = 'No limit on word pictures.';
export const UNLIMITED_HELP = 'Word pictures never use story credits. Story credits are for Story Adventure.';

/** The first line on the Word pictures card (A1, grown-up only). */
export function allowanceLine(a) {
  if (!a || a.on !== true) return '';
  if (a.paused) return 'Word pictures are paused for now. Pictures already made still work.';
  if (a.unlimited) return UNLIMITED_LINE;
  const left = nat(a.left);
  const credits = nat(a.credits);
  if (left > 0) {
    if (credits > 0) return pics(left) + ' left. You also have ' + creds(credits) + '.';
    return pics(left) + ' left' + (a.plan || a.trial ? ' this month' : '') + '.';
  }
  if (credits > 0) return 'No pictures left. You have ' + creds(credits) + ': use 1 for ' + pics(nat(a.rate)) + '.';
  const again = a.plan ? dateWords(a.resets) : '';
  return 'No pictures left. Redeem a code' + (again ? ', or wait for your plan to start again on ' + again : '') + '.';
}

/** The trial line (free pictures and when they end), or '' when there is no trial. */
export function trialLine(a) {
  const t = a && a.trial;
  if (!t || !nat(t.left) || !dateWords(t.until)) return '';
  return 'Free trial: ' + pics(nat(t.left)) + ' until ' + dateWords(t.until) + '.';
}

/** The plan line: "Plan: 30 pictures a month" or "No plan". */
export function planLine(a) {
  return a && a.plan && nat(a.plan.monthly) ? (a.plan.name || 'Plan') + ': ' + nat(a.plan.monthly) + ' pictures a month' : 'No plan';
}

/** D16: the question, always with the account's rate (A1 / the 402), never a number of our own. '' when the rate is not a whole number of at least 1. */
export function swapQuestion(rate) {
  return Number.isInteger(rate) && rate >= 1 ? 'Use 1 story credit for ' + rate + ' more word ' + plural(rate, 'picture', 'pictures') + '?' : '';
}

/** BR-19 AC3: the first time pictures are offered on a device. */
export const firstTimeLine = 'Pictures are made by an AI picture service from the word only. We never send a child’s name or anything a child typed.';

/**
 * Which waiting words the new pictures cover, in list order: `gained` pictures cover the first `gained` words; the rest still wait (the grown-up is asked
 * again if credits remain, every swap is asked). { covered: [...], waiting: [...] }.
 */
export function queueAfterSwap(words, gained) {
  const list = askable(words);
  const n = nat(gained);
  return { covered: list.slice(0, n), waiting: list.slice(n) };
}
