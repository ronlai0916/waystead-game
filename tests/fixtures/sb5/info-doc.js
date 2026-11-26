// SB5 (WP-A2, TR-91, TR-93, TR-94): the sentence and the meaning a grown-up gives for an own word (a Word list's optional `info`),
// and the rules that keep them safe. A LEAF module: it imports nothing from the other app files except wordcheck.js (itself a leaf),
// so own-doc.js and setup-doc.js (which words-doc.js imports) can clean `info` without an import cycle. games-doc.js re-exports
// `gapOf` and `usableMeaning`. Pure: no DOM, no storage, no clock, no fetch (the word list comes in as `inList`).
//
//   info: { [word]: { s?: sentence, m?: meaning, x?: [hidden statement ids] } }
//
// Exports
//   gapOf(sentence, word)            -> { before, after } when `word` is in `sentence` exactly once as a whole word, else null
//   usableMeaning(meaning, word)     -> false when the meaning is empty or holds the word
//   cleanInfo(info, words, opts)     -> a clean info object, or undefined (never `{}`); opts.isReady(word) drops ready-made words, opts.noBudget skips the size check
//   infoBytes(info)                  -> JSON size in bytes; MAX_INFO_BYTES (400) is the budget per list
//   cleanSentence(s, word), cleanMeaning(m, word) -> the tidied text or ''
//   async checkInfo({ word, s, m }, { inList, findEntry }) -> '' or ONE kind line (every other word must be on the child-safe lists)
//   suggestionFor(lookup, word)      -> { s?, m? } from a Wordbright meanings entry; Wiktionary ('wikt') parts are dropped
//   LINES                            -> the grown-up's lines (needsWord, shorter, longer, everyday, selfMeaning, offline, noSentence)
import { usableWord, weekdayForm } from './wordcheck.js';

export const MAX_INFO_BYTES = 400;
export const MAX_SENTENCE_CHARS = 90;
export const MAX_MEANING_CHARS = 70;
export const SENTENCE_WORDS = [4, 15];
export const MEANING_WORDS = [2, 12];
const TEXT_RE = /^[A-Za-z ,.!?'’-]+$/;
const ID_RE = /^[A-Za-z0-9_.:-]{1,24}$/;
const MAX_HIDDEN_IDS = 5;

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tidy = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const apostrophes = (s) => String(s).replace(/’/g, '\'');
const wordCount = (s) => (s ? s.split(' ').length : 0);
const lc = (w) => String(w).toLowerCase();

/** `word` as a whole word: not touching a letter, apostrophe or hyphen on either side (so "dog's" and "well-known" do not hold "dog" or "well"). */
const wholeRe = (word, flags = 'gi') => new RegExp('(^|[^A-Za-z\'-])(' + esc(word) + ')(?![A-Za-z\'-])', flags);

/** { before, after } when the word is in the sentence exactly once as a whole word (case does not matter), else null. */
export function gapOf(sentence, word) {
  const s = apostrophes(sentence == null ? '' : sentence);
  const w = apostrophes(word == null ? '' : word);
  if (!s || !w) return null;
  const hits = [...s.matchAll(wholeRe(w))];
  if (hits.length !== 1) return null;
  const at = hits[0].index + hits[0][1].length;
  const raw = String(sentence);
  return { before: raw.slice(0, at), after: raw.slice(at + w.length) };
}

/** A meaning that can stand in a board or a hint: not empty, and it does not hold the word it explains. */
export function usableMeaning(meaning, word) {
  const m = tidy(meaning);
  if (!m) return false;
  const w = tidy(word);
  return !w || !wholeRe(w, 'i').test(apostrophes(m));
}

/** The sentence a grown-up may give: the right length, plain letters, the word once. Else ''. */
export function cleanSentence(s, word) {
  const t = tidy(s);
  const n = wordCount(t);
  if (!t || t.length > MAX_SENTENCE_CHARS || n < SENTENCE_WORDS[0] || n > SENTENCE_WORDS[1] || !TEXT_RE.test(t) || !gapOf(t, word)) return '';
  return t;
}
/** The meaning a grown-up may give: the right length, plain letters, not naming the word. Else ''. */
export function cleanMeaning(m, word) {
  const t = tidy(m);
  const n = wordCount(t);
  if (!t || t.length > MAX_MEANING_CHARS || n < MEANING_WORDS[0] || n > MEANING_WORDS[1] || !TEXT_RE.test(t) || !usableMeaning(t, word)) return '';
  return t;
}

/**
 * Clean a list's `info` against the list's words: only keys that are words of the list (matched without case, saved in the list's
 * spelling) and, when `isReady` is given, not ready-made words. Anything that fails its rules is dropped. Answers undefined when
 * nothing is left, or when the whole thing is over the size budget (never an empty object).
 */
export function cleanInfo(info, words, { isReady = null, noBudget = false } = {}) {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return undefined;
  const spelling = new Map((Array.isArray(words) ? words : []).filter((w) => typeof w === 'string').map((w) => [lc(w), w]));
  const out = {};
  for (const [key, e] of Object.entries(info)) {
    const word = spelling.get(lc(key));
    if (!word || !e || typeof e !== 'object' || (isReady && isReady(word))) continue;
    const one = {};
    const s = cleanSentence(e.s, word);
    const m = cleanMeaning(e.m, word);
    if (s) one.s = s;
    if (m) one.m = m;
    const x = Array.isArray(e.x) ? [...new Set(e.x.filter((id) => typeof id === 'string' && ID_RE.test(id)))].slice(0, MAX_HIDDEN_IDS) : [];
    if (x.length) one.x = x;
    if (Object.keys(one).length) out[word] = one;
  }
  if (!Object.keys(out).length || (!noBudget && infoBytes(out) > MAX_INFO_BYTES)) return undefined;
  return out;
}
export const infoBytes = (info) => (info ? new TextEncoder().encode(JSON.stringify(info)).length : 0);

// ---- the grown-up's lines ------------------------------------------------------------------------------
export const LINES = {
  needsWord: (word) => 'Please use ' + word + ' once, spelled just like that.',
  shorter: 'Make it a little shorter.',
  longer: 'Make it a little longer.',
  everyday: 'Please use everyday words only (no names or numbers).',
  selfMeaning: 'The meaning should not use the word itself.',
  offline: 'Adding a sentence needs a connection. Your list is saved.',
  noSentence: (n) => n + ' of your own words ' + (n === 1 ? 'has no sentence yet.' : 'have no sentences yet.'),
};

// ---- the safety check (TR-94) --------------------------------------------------------------------------
const START = /(^|[.!?]\s+)$/;
/** The words of a text to check, each with whether it starts a sentence. Contractions are read as their base word (don't -> do, can't -> can, dog's -> dog). */
function pieces(text) {
  const out = [];
  const re = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
  const n = apostrophes(text);
  let m;
  while ((m = re.exec(n))) {
    const first = START.test(n.slice(0, m.index));
    let token = m[0];
    if (/n't$/i.test(token)) token = token.slice(0, -3).replace(/^ca$/i, 'can').replace(/^wo$/i, 'will');
    token.split('-').forEach((part, i) => {
      const [base, ...rest] = part.split('\'');
      out.push({ w: base, first: first && i === 0 });
      for (const r of rest) if (!/^(s|ll|re|ve|d|m|t)$/i.test(r)) out.push({ w: r, first: false });
    });
  }
  return out;
}
const isAddress = (t) => /@|:\/\/|www|\w\.\w/i.test(t);

/**
 * '' when a grown-up's sentence and meaning are safe to show, else ONE kind line.
 * Every word other than `word` must be one the child-safe lists know (the curriculum through findEntry, or Wordbright's list through
 * inList, sync or async). A name, a number or a web address fails. With no `inList` (offline) a word the curriculum does not know
 * cannot be checked: LINES.offline.
 */
export async function checkInfo({ word, s, m } = {}, { inList = null, findEntry = () => null } = {}) {
  const w = tidy(word);
  const sentence = s == null ? '' : tidy(s);
  const meaning = m == null ? '' : tidy(m);
  if (!sentence && !meaning) return '';
  for (const t of [sentence, meaning]) {
    if (!t) continue;
    if (t.length > Math.max(MAX_SENTENCE_CHARS, MAX_MEANING_CHARS)) return LINES.shorter;
    if (/[0-9]/.test(t) || isAddress(t) || !TEXT_RE.test(t)) return LINES.everyday;
  }
  if (sentence) {
    if (sentence.length > MAX_SENTENCE_CHARS || wordCount(sentence) > SENTENCE_WORDS[1]) return LINES.shorter;
    if (wordCount(sentence) < SENTENCE_WORDS[0]) return LINES.longer;
    if (!gapOf(sentence, w)) return LINES.needsWord(w);
  }
  if (meaning) {
    if (meaning.length > MAX_MEANING_CHARS || wordCount(meaning) > MEANING_WORDS[1]) return LINES.shorter;
    if (wordCount(meaning) < MEANING_WORDS[0]) return LINES.longer;
    if (!usableMeaning(meaning, w)) return LINES.selfMeaning;
  }
  const seen = new Map();
  for (const t of [sentence, meaning]) {
    if (!t) continue;
    for (const { w: piece, first } of pieces(t)) {
      if (lc(piece) === lc(w)) continue;
      if (/^(a|i)$/i.test(piece)) continue; // 'a' and 'I' are words but too short for the lists
      if (piece !== piece.toLowerCase() && !first && piece !== 'I' && !weekdayForm(piece)) return LINES.everyday; // a capital inside a sentence: a name
      const key = lc(piece);
      if (!seen.has(key)) seen.set(key, piece);
    }
  }
  const unknown = [];
  for (const key of seen.keys()) if (!findEntry(key) && !weekdayForm(key)) unknown.push(key);
  if (unknown.length && typeof inList !== 'function') return LINES.offline;
  const known = new Map();
  for (const key of unknown) known.set(key, !!(await inList(key)));
  for (const key of seen.keys()) {
    if (!usableWord(key, { findEntry, inList: (x) => known.get(x) === true })) return LINES.everyday;
  }
  return '';
}

/**
 * What Wordbright's meanings gave for a word, as { s?, m? } the grown-up may take with "Use this". `lookup` is the entry
 * ({ m, e, p, src }) or the Map `lookup()` answers (then `word` picks the entry). A Wiktionary part (src 'wikt') is never offered,
 * and a part that fails the same rules as a typed one is left out.
 */
export function suggestionFor(lookup, word) {
  const entry = lookup instanceof Map ? lookup.get(word) : lookup;
  if (!entry || typeof entry !== 'object' || entry.src === 'wikt') return {};
  const out = {};
  const s = cleanSentence(entry.e, word);
  const m = cleanMeaning(entry.m, word);
  if (s) out.s = s;
  if (m) out.m = m;
  return out;
}
