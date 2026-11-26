// The sentence builder's rules (SB6, TR-27, BR-17, BR-18). Pure: no page, no storage, no clock, no fetch, no Math.random.
// The bank (data/builder.json, TR-60), the statements and the child's facts come in as arguments.
//
// Levels: 1 Choose the cards, 2 Find the missing word, 3 Put it in order, 4 Make your own (optional).
// Text comes only from our own lists (BR-18): the grown-up's own sentence for an own word (`info`), the curriculum example,
// the statement bank, statements already fetched from the account, and the builder bank. A child's typed words are checked on the
// device and are never sent anywhere (voiceOk is false for them, so the device's voice speaks them).
import { RULES } from './sbs-rules.js';
import { gapOf } from './info-doc.js';
import { MIN_SENTENCE } from './study-doc.js';
import { mentionsHidden } from './test-guard.js';
import { checkTyped, wordsOf } from './safe-text.js';
import { seedOf, rng } from './tiles-doc.js';

export const LEVEL_NAMES = { 1: 'Make a sentence', 2: 'Find the word', 3: 'Put it in order', 4: 'Make your own' };
/** Level 4 is "Make your own?": offered, never needed. */
export const OPTIONAL_LEVELS = Object.freeze([4]);
export const MAX_OWN_CHARS = 160; // words-doc MAX_NOTE
export const LINES = Object.freeze({
  safe: 'Try a different word.',
  more: 'Add a few more words.',
  short: 'Make it a little shorter.',
  useWord: (word) => 'Use the word ' + word + '.',
  order: 'Nearly. Look again.',
});

// ---- which levels ---------------------------------------------------------------------------
/**
 * The levels a child is given: Step by step Years 1-2 [1]; Years 3-6 [1, 2, 3, 4] (4 is optional: OPTIONAL_LEVELS);
 * the Usual way [1, 3] ("Help me build it", BR-34). `rules` is RULES.builder.
 */
export function levelsFor(year, way, rules = RULES.builder) {
  if (way !== 'sbs') return [...(rules.normalLevels || [1, 3])];
  const y = Number(year) || 0;
  const base = y >= 1 && y <= 2 ? rules.levels.y12 : rules.levels.y36;
  return y >= 3 || !y ? [...base, 4] : [...base];
}

// ---- level 1: frames ------------------------------------------------------------------------------
const lc = (s) => String(s || '').toLowerCase();
const POS = { noun: 'noun', n: 'noun', verb: 'verb', v: 'verb', adjective: 'adjective', adj: 'adjective', a: 'adjective', s: 'adjective', adverb: 'adverb', adv: 'adverb', r: 'adverb' };
/** The bank group a word belongs to: noun, verb, adjective, adverb, else other (determiner, pronoun, preposition, conjunction, number, unknown). */
export const groupOf = (entry) => POS[lc(entry && entry.meaning && entry.meaning.partOfSpeech)] || 'other';

/** The bank's entry for a word (exact key, else case-insensitive), or null. */
export function wordEntryIn(bank, word) {
  const w = (bank && bank.w) || {};
  if (w[word]) return w[word];
  const k = Object.keys(w).find((x) => lc(x) === lc(word));
  return k ? w[k] : null;
}

const SLOT = /\{([a-z])\}/g;
const framesOf = (bank, group) => ((bank && bank.frames && bank.frames[group]) || []);
const findFrame = (bank, id) => { for (const g of Object.keys((bank && bank.frames) || {})) { const f = bank.frames[g].find((x) => x.id === id); if (f) return f; } return null; };
const cardsOf = (f) => Object.values(f.s || {}).flat();
/** A frame is skipped when the target is also one of its cards ("The box was in the box"). */
const clash = (f, word) => cardsOf(f).some((c) => lc(c) === lc(word));
const fitsYear = (f, year) => !year || !f.y || (year >= f.y[0] && year <= f.y[1]);

/** The frames that may be used for this word: its own listed frames (a word in the bank), else the frames with no `sp` flag for its group, else the other group's. */
export function framesFor(entry, bank, { year = 0 } = {}) {
  const word = entry.word;
  const own = wordEntryIn(bank, word);
  let list;
  if (own && Array.isArray(own.f) && own.f.length) list = own.f.map((id) => findFrame(bank, id)).filter(Boolean);
  else {
    const g = groupOf(entry);
    list = framesOf(bank, g).filter((f) => !f.sp);
    if (!list.length) list = framesOf(bank, 'other').filter((f) => !f.sp);
  }
  list = list.filter((f) => !clash(f, word));
  const byYear = list.filter((f) => fitsYear(f, year));
  return byYear.length ? byYear : list;
}

/**
 * One frame for the word -> { id, parts: [{ text } | { slot: 'w', cards: [word] } | { slot: 'a', cards: [3] }] }, or null.
 * `seed` (a number) picks one of the usable frames; the same seed gives the same frame. `opts.skip` lists ids not to use.
 */
export function frameFor(entry, bank, seed = 0, { year = 0, skip = [] } = {}) {
  if (!entry || !entry.word || !bank) return null;
  const all = framesFor(entry, bank, { year });
  const list = all.filter((f) => !skip.includes(f.id));
  const f = (list.length ? list : all)[Math.abs(Math.trunc(Number(seed) || 0)) % Math.max(1, (list.length ? list : all).length)];
  if (!f) return null;
  const parts = [];
  let at = 0;
  for (const m of f.t.matchAll(SLOT)) {
    if (m.index > at) parts.push({ text: f.t.slice(at, m.index) });
    parts.push(m[1] === 'w' ? { slot: 'w', cards: [entry.word] } : { slot: m[1], cards: [...((f.s || {})[m[1]] || [])] });
    at = m.index + m[0].length;
  }
  if (at < f.t.length) parts.push({ text: f.t.slice(at) });
  return { id: f.id, parts };
}

const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** The sentence a frame makes. picks = { a: 'cat', b: '...' }; the target slot always holds the target word. An unpicked slot stays as "...". */
export function sentenceOf(frame, picks = {}) {
  if (!frame) return '';
  const s = frame.parts.map((p) => {
    if (p.text !== undefined) return p.text;
    return p.slot === 'w' ? p.cards[0] : (picks[p.slot] || '...');
  }).join('').replace(/\s+/g, ' ').trim();
  return capital(s);
}
/** True when every non-target slot has a pick that is one of its cards. */
export const complete = (frame, picks = {}) => !!frame && frame.parts.every((p) => p.text !== undefined || p.slot === 'w' || p.cards.includes(picks[p.slot]));

// ---- levels 2 and 3: model sentences ---------------------------------------------------------------
const wordsIn = (s) => String(s).split(/\s+/).filter((x) => /[A-Za-z]/.test(x)).length;
/** A sentence a child may be given as a model: one sentence, the word once as a whole word, 4 to 14 words, and none of the week's due words. */
export function usableModel(sentence, word, hidden) {
  const s = String(sentence == null ? '' : sentence).replace(/\s+/g, ' ').trim();
  if (!s || !/[.!?]$/.test(s) || /[.!?]./.test(s.slice(0, -1))) return false;
  if (!/^[A-Za-z][A-Za-z ,.!?'’-]*$/.test(s)) return false;
  const n = wordsIn(s);
  if (n < MIN_SENTENCE || n > 14) return false;
  if (!gapOf(s, word)) return false;
  if (hidden && hidden.size && mentionsHidden(s, new Set([...hidden].filter((h) => lc(h) !== lc(word))))) return false;
  return true;
}
const textOf = (x) => (typeof x === 'string' ? x : x && typeof x.s === 'string' ? x.s : '');

/**
 * Every model sentence for the word, best first (BR-18 AC1 order): the grown-up's own sentence for an own word (info), the curriculum
 * example, the statement bank and fetched statements (`statements`: strings or { s }), the builder bank's `m`. Test-due words are never in one.
 */
export function modelsFor(entry, { bank, statements = [], info, hidden } = {}) {
  const word = entry && entry.word;
  if (!word) return [];
  const out = [];
  const add = (s) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); if (t && !out.includes(t) && usableModel(t, word, hidden)) out.push(t); };
  const own = info && (typeof info === 'string' ? info : info.s);
  add(own);
  add(entry.meaning && entry.meaning.example);
  for (const s of statements || []) add(textOf(s));
  const b = wordEntryIn(bank, word);
  if (b) add(b.m);
  return out;
}
/** The first model sentence ('' when there is none): the level 2 source. `nth` picks a later one (level 3 uses another when there is one). */
export function modelFor(entry, ctx = {}, nth = 0) {
  const list = modelsFor(entry, ctx);
  return list[Math.min(nth, Math.max(0, list.length - 1))] || '';
}
/** { before, after } with the word taken out, or null (the word must be in it once as a whole word). */
export function missingWord(model, word) { return gapOf(model, word); }

// ---- level 3: cards ------------------------------------------------------------------------------
const SMALL = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'is', 'was', 'my', 'our', 'we', 'i', 'it', 'and', 'for', 'with', 'by', 'up', 'he', 'she', 'his', 'her', 'its', 'your', 'their', 'they', 'you']);
/**
 * The sentence as 4 to 6 cards: the words, with small words joined to the next word when there are more than `max` words.
 * -> { cards: [{ id, text, first?, last? }], answer: [ids], end: '.' } in order, or null when it makes fewer than `min` cards.
 * The card text carries no sentence-end mark; `first` marks the capital, `last` the full stop (the screen shows "Aa" and "End .").
 */
export function orderCards(sentence, { min = RULES.builder.orderCards.min, max = RULES.builder.orderCards.max } = {}) {
  const s = String(sentence || '').replace(/\s+/g, ' ').trim();
  const m = /^(.*?)([.!?])$/.exec(s);
  if (!m) return null;
  let chunks = m[1].split(' ').filter(Boolean);
  if (chunks.length < min) return null;
  // join the smallest neighbours until there are at most `max` cards
  while (chunks.length > max) {
    let at = -1;
    for (let i = 0; i < chunks.length - 1; i += 1) if (SMALL.has(lc(chunks[i]).replace(/[^a-z']/g, ''))) { at = i; break; }
    if (at < 0) { // no small word left: join the shortest adjacent pair
      let best = 1e9;
      for (let i = 0; i < chunks.length - 1; i += 1) { const l = chunks[i].length + chunks[i + 1].length; if (l < best) { best = l; at = i; } }
    }
    chunks = [...chunks.slice(0, at), chunks[at] + ' ' + chunks[at + 1], ...chunks.slice(at + 2)];
  }
  if (chunks.length < min) return null;
  const cards = chunks.map((text, i) => ({ id: 'c' + i, text, ...(i === 0 ? { first: true } : {}), ...(i === chunks.length - 1 ? { last: true } : {}) }));
  return { cards, answer: cards.map((c) => c.id), end: m[2] };
}
/** The cards in a fixed shuffled order, never the answer's order (when there is more than one different card). Same seed, same order. */
export function shuffleCards(cards, seed = 0) {
  const r = rng(seedOf(cards.map((c) => c.text).join('|'), String(seed)));
  const same = (a) => a.every((c, i) => c.id === cards[i].id);
  const distinct = new Set(cards.map((c) => c.text)).size > 1;
  let a = [...cards];
  for (let tries = 0; tries < 20; tries += 1) {
    a = [...cards];
    for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (!distinct || !same(a)) break;
  }
  if (distinct && same(a)) a = [...cards.slice(1), cards[0]];
  return a;
}
const textsOf = (cards, ids) => ids.map((id) => cards.find((c) => c.id === id).text);
/** True when the placed card ids read as the sentence (two cards with the same text are the same card). */
export function orderRight(cards, answer, placed) {
  return placed.length === answer.length && textsOf(cards, placed).join('|') === textsOf(cards, answer).join('|');
}
/** How many cards from the start are in the right place. */
export function rightPrefix(cards, answer, placed) {
  let n = 0;
  while (n < placed.length && n < answer.length && cards.find((c) => c.id === placed[n]).text === cards.find((c) => c.id === answer[n]).text) n += 1;
  return n;
}
/** The card that goes next after the right start (an unplaced card with that text), or null when the sentence is complete. */
export function nextCard(cards, answer, placed) {
  const n = rightPrefix(cards, answer, placed);
  if (n >= answer.length) return null;
  const want = cards.find((c) => c.id === answer[n]).text;
  const keep = new Set(placed.slice(0, n));
  const c = cards.find((x) => x.text === want && !keep.has(x.id));
  return c ? c.id : null;
}

// ---- level 4: the child's own words -------------------------------------------------------------
const wordRe = (word) => new RegExp('(^|[^a-z])' + lc(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es|ed|d|ing)?($|[^a-z])');
/**
 * '' when the sentence will do, else ONE kind line. `safe` is an isKnown(word) function, or { isKnown, extra: [words] }.
 * An unknown word and a refused one get the same answer (BR-18 AC3). Checked first; then length, then the week's word.
 */
export function checkOwn(text, word, safe) {
  const raw = String(text == null ? '' : text);
  const isKnown = typeof safe === 'function' ? safe : safe && typeof safe.isKnown === 'function' ? safe.isKnown : () => false;
  const extra = (safe && Array.isArray(safe.extra) ? safe.extra : []).concat(word ? [word] : []);
  if (/[0-9@]|:\/\/|www\./i.test(raw)) return LINES.safe;
  const r = checkTyped(raw, isKnown, { extra, max: MAX_OWN_CHARS, minWords: 1 });
  if (r.unknown.length) return LINES.safe;
  if (r.tooLong) return LINES.short;
  const n = wordsOf(raw).length;
  if (n < MIN_SENTENCE) return LINES.more;
  if (word && !wordRe(word).test(raw.toLowerCase())) return LINES.useWord(word);
  return '';
}

/** May this sentence be spoken by the Waystead voice? Never when the child typed any of it; else every word must be on the allow-list (a Set of lower-case words). */
export function voiceOk(sentence, allowSet, { typed = false } = {}) {
  if (typed) return false;
  const s = String(sentence || '').replace(/[‘’]/g, "'").trim();
  if (!s || [...s].length > 200 || !/^[A-Za-z .,!?'\-:;]+$/.test(s)) return false;
  const words = s.toLowerCase().match(/[a-z]+(?:'[a-z]+)*/g) || [];
  if (!words.length || !allowSet || typeof allowSet.has !== 'function') return false;
  return words.every((w) => w === 'a' || w === 'i' || allowSet.has(w));
}

// ---- which levels can be made ---------------------------------------------------------------------
/**
 * The levels that can be made for this word, in order (BR-17 AC6). Level 1 needs a frame, 2 a model with the word once, 3 a model that makes 4-6 cards, 4 always.
 * At least one level always remains: when none can be made, level 4 (the child's own sentence, tapped or typed) is left.
 */
export function usableLevels(levels, entry, ctx = {}) {
  const models = modelsFor(entry, ctx);
  const ok = (lv) => {
    if (lv === 1) return !!frameFor(entry, ctx.bank, 0, { year: ctx.year });
    if (lv === 2) return models.length > 0;
    if (lv === 3) return models.some((m) => !!orderCards(m));
    return lv === 4;
  };
  const out = levels.filter(ok);
  return out.length ? out : [4];
}
