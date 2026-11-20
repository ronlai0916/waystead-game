// Game mode's four games: the rules with no page in them. Pure; randomness comes
// in as `rand` (Math.random, or a seeded one in the tests). Each game ends a
// word with a pass, { tries, clean }, recorded like any try on the grid
// (W.addTry, source 'g'), so it feeds the stars and "remembered". A pass with a
// mistake brings the same word straight back until it's clean; games don't need
// 3 in a row, so they earn no dots. Meaning match doesn't test spelling: its
// pass has source 'm', can earn the day's star and counts as played.
import * as R from './spell-run.js';
import * as W from './words-doc.js';
import { gapOf, usableMeaning } from './info-doc.js';

// SB5 (WP-A2, TR-91 and TR-101): Fill in the blanks (`fill`) and Mix and match (`mix`) join Game day beside Meaning match, which stays.
// Their rules are below the Meaning match section. Entries for those two games carry text the word-info side has already guarded:
//   { word, sentence?, statements?: string[] }   sentence = a ready-made word's curriculum example; statements = the bank's (or the grown-up's) 2-3.
// Fill in the blanks uses `sentence`, else statements[0]. Mix and match uses statements, and for an entry with no `sentence`
// (an own word, whose Fill sentence IS statements[0]) never statement 0, so one sentence is not met in both games in a week.
//
// Exports (new): gapOf, usableMeaning (from info-doc.js), BLANK, readLine, dayGames(year, kind), levelFor(year), fillItems, fillChoices,
//   fillPass, statementFor(word, n, bank), mixBoards, newBoard, placeCard, boardDone, boardPasses, glowAfter, glowFor.
export { gapOf, usableMeaning };

export const GAMES = {
  missing: { title: 'Missing letters', line: 'Hear the word and fill the gap.' },
  unjumble: { title: 'Unjumble', line: 'Tap the letters in the right order.' },
  match: { title: 'Meaning match', line: 'Pair each word with what it means.' },
  fill: { title: 'Fill in the blanks', line: 'Find the word that fits.' },
  mix: { title: 'Mix and match', line: 'Put each word in its place.' },
  quick: { title: 'Quick-fire', line: 'Spell each word as it\'s spoken. There\'s no rush.' },
};
export const GAME_IDS = Object.keys(GAMES);
export const MATCH_SIZE = 4;
export const MIN_SENTENCE_WORDS = 3; // fill and mix are offered when at least this many of the week's words have usable text

const range = (from, n) => Array.from({ length: n }, (_, i) => from + i);
export function shuffled(list, rand = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/**
 * Going through a game's words: a pass with a mistake keeps the word at the
 * front; a clean one takes it off; a skip sends it to the end.
 */
export const afterPass = (list, clean) => (clean ? list.slice(1) : list);
export const afterSkip = (list) => [...list.slice(1), list[0]];
export const passOf = (run) => ({ tries: run.tries, clean: R.isClean(run) });
/** A game's pass into the saved value. */
export function recordPass(d, g, word, { tries, clean, source = 'g', lv, h }, { id, day, now }) {
  return W.addTry(d, { id, word, day, group: g.id, kind: source === 'm' ? 'p' : W.kindOn(d, g, word, day), tries, peeks: 0, clean, source, now, lv, h });
}

// ---- Missing letters -----------------------------------------------------------------
const isCapital = (ch) => ch !== ch.toLowerCase() && ch === ch.toUpperCase();
/**
 * The letters to blank: the tricky ones; else one syllable; else the middle of the word.
 * A one-letter word blanks its letter, a two-letter word its second; a capital is never blanked.
 */
export function blanksFor(entry, rand = Math.random) {
  const w = entry.word;
  const raw = rawBlanks(entry, rand);
  const lower = raw.filter((i) => !isCapital(w[i]));
  if (lower.length || (w.length === 1 && raw.length)) return lower.length ? lower : raw;
  const next = [...w].findIndex((ch, i) => i >= (raw[0] || 0) && !isCapital(ch));
  const any = next >= 0 ? next : [...w].findIndex((ch) => !isCapital(ch));
  return any >= 0 ? [any] : raw;
}
function rawBlanks(entry, rand) {
  const w = entry.word;
  if (w.length === 1) return [0];
  if (w.length === 2) return [1];
  const at = entry.tricky ? w.indexOf(entry.tricky) : -1;
  if (at >= 0) return range(at, entry.tricky.length);
  const chunks = entry.chunks || [w];
  if (chunks.length > 1) {
    const k = Math.floor(rand() * chunks.length);
    return range(chunks.slice(0, k).join('').length, chunks[k].length);
  }
  return w.length < 4 ? [1] : range(Math.floor(w.length / 3), Math.ceil(w.length / 3));
}
/** Games that need two letters or more to make sense ("a" and "I" can't be gapped, jumbled or typed on a flower). */
const NEEDS_LETTERS = ['flower', 'missing', 'unjumble'];
export const playable = (entry, game) => !(NEEDS_LETTERS.includes(game) && [...entry.word].length < 2);
/** The games to offer for a chapter's words. */
export function gamesFor(entries, chapter = {}, games = GAME_IDS) {
  const defined = entries.filter((e) => e.meaning && e.meaning.definition).length;
  return games.filter((g) => {
    if (g === 'match') return !chapter.noMatch && defined >= MATCH_SIZE;
    if (g === 'fill') return entries.filter((e) => fillText(e)).length >= MIN_SENTENCE_WORDS;
    if (g === 'mix') return entries.filter((e) => mixStatements(e, 0).length).length >= MIN_SENTENCE_WORDS;
    if (NEEDS_LETTERS.includes(g)) return entries.some((e) => playable(e, g));
    return true;
  });
}
/** The blanks' letters, typed in turn: wrong ones count, as they do on the grid. */
export const newMissing = (word, blanks) => R.newRun(blanks.map((i) => word[i]).join(''));

// ---- Unjumble ------------------------------------------------------------------------
/**
 * The word's letters out of order (a word of one repeated letter can't be). A capital
 * stays where it is ("Monday" keeps its M first); only the other letters move.
 */
export function jumble(word, rand = Math.random) {
  const letters = [...word];
  const moving = letters.map((ch, i) => i).filter((i) => !isCapital(letters[i]));
  for (let i = 0; i < 20; i += 1) {
    const out = [...letters];
    shuffled(moving.map((k) => letters[k]), rand).forEach((ch, n) => { out[moving[n]] = ch; });
    if (out.join('') !== word) return out;
  }
  // a stuck shuffle (two letters, an unlucky `rand`): swap the first two different movable letters
  const a = moving.find((k) => letters[k] !== letters[moving[0]]);
  if (a !== undefined) {
    const out = [...letters];
    [out[moving[0]], out[a]] = [out[a], out[moving[0]]];
    return out;
  }
  return letters;
}

// ---- Meaning match -------------------------------------------------------------------
/**
 * Rounds of 4 cards. `entries` are the words to score, each with a meaning;
 * a short last round is filled with words already played, then `spare` ones,
 * which aren't scored.
 */
export function matchRounds(entries, spare = [], rand = Math.random) {
  const list = shuffled(entries, rand);
  const out = [];
  for (let i = 0; i < list.length; i += MATCH_SIZE) {
    const own = list.slice(i, i + MATCH_SIZE);
    const fill = [...list.slice(0, i), ...shuffled(spare, rand)].filter((e, n, all) => !own.some((o) => o.word === e.word) && all.findIndex((x) => x.word === e.word) === n);
    const cards = [...own.map((e) => ({ word: e.word, meaning: e.meaning.definition, scored: true })),
      ...fill.slice(0, MATCH_SIZE - own.length).map((e) => ({ word: e.word, meaning: e.meaning.definition, scored: false }))];
    out.push({ cards: shuffled(cards, rand), meanings: shuffled(cards.map((c) => c.meaning), rand) });
  }
  return out;
}
export const newMatch = () => ({ matched: [], wrong: {} });
/** One pairing: { state, hit }. A wrong pairing counts against the word that was chosen. */
export function pickMatch(state, round, word, meaning) {
  const card = round.cards.find((c) => c.word === word);
  if (!card || state.matched.includes(word)) return { state, hit: false };
  if (card.meaning === meaning) return { state: { ...state, matched: [...state.matched, word] }, hit: true };
  return { state: { ...state, wrong: { ...state.wrong, [word]: (state.wrong[word] || 0) + 1 } }, hit: false };
}
export const matchDone = (state, round) => state.matched.length === round.cards.length;
/** The scored words' passes, once the round is done. */
export const matchPasses = (state, round) => round.cards.filter((c) => c.scored).map((c) => ({ word: c.word, tries: state.wrong[c.word] || 0, clean: !state.wrong[c.word], source: 'm' }));

// ---- Quick-fire ----------------------------------------------------------------------
/** The gentle timer's length. It runs out with a kind word and nothing else: time plays no part in a pass. */
export const quickSeconds = (word) => 8 + word.length;
export function quickPass(word, typed) {
  const right = R.checkAnswer(word, typed);
  return { tries: right ? 0 : 1, clean: right };
}

// ---- Game day by year and week kind (TR-101, BRS-change-2 2.2) -------------------------------------------
/**
 * The games Game day plays, in order. kind = St.weekKind(g): 'full' | 'short' | 'quick' (anything else is full).
 * Drop order when shorter: Quick-fire, Unjumble, Fill in the blanks, Meaning match; Missing letters and Mix and match never go.
 * Years 1-2: full 4, short 3, quick 2. Years 3-6 and an unknown year: full 6, short 4, quick 2.
 */
export function dayGames(year, kind = 'full') {
  const young = year === 1 || year === 2;
  if (kind === 'quick') return ['missing', 'mix'];
  if (kind === 'short') return young ? ['missing', 'match', 'mix'] : ['missing', 'match', 'fill', 'mix'];
  return young ? ['missing', 'match', 'fill', 'mix'] : ['missing', 'unjumble', 'match', 'fill', 'mix', 'quick'];
}

/**
 * How hard Fill in the blanks and Mix and match are, by the child's year (TR-91 as changed by TR-101).
 *   fill: 'pick' (choose a card; `choices` cards) or 'spell' (type the word), items = sentences per round
 *   boards: the kinds of the boards (statements only, for every year); cards: slots per board; spare: one extra card that fits nowhere (Years 5-6)
 * An unknown year gets the Years 3-4 level.
 */
export function levelFor(year) {
  if (year === 1 || year === 2) return { fill: 'pick', choices: 3, items: 5, boards: ['statement', 'statement'], cards: 3 };
  if (year === 5 || year === 6) return { fill: 'spell', items: 6, boards: ['statement', 'statement'], cards: 4, spare: true };
  return { fill: 'pick', choices: 4, items: 6, boards: ['statement', 'statement'], cards: 4, lookAlike: true };
}

// ---- shared bits -------------------------------------------------------------------------------------
const lc = (w) => String(w).toLowerCase();
const setOf = (x) => new Set(Array.from(x || [], lc));
const tokensOf = (text) => (String(text).toLowerCase().replace(/’/g, '\'').match(/[a-z]+(?:'[a-z]+)*/g) || []);
const mentions = (text, hid) => hid.size > 0 && tokensOf(text).some((t) => hid.has(t) || hid.has(t.split('\'')[0]));
const countOf = (x) => {
  if (!x) return () => 0;
  if (x instanceof Map) return (w) => x.get(w) || x.get(lc(w)) || 0;
  if (x instanceof Set || Array.isArray(x)) { const s = setOf(x); return (w) => (s.has(lc(w)) ? 1 : 0); }
  return (w) => x[w] || x[lc(w)] || 0;
};
const uniqueWords = (list) => { const seen = new Set(); return list.filter((e) => { const k = lc(e.word); if (seen.has(k)) return false; seen.add(k); return true; }); };
/** A gap shows as this in every text the child reads. */
export const BLANK = '_____';
/** The line read aloud: the sentence with the gap said as "blank". */
export const readLine = (before, after) => (before + 'blank' + after).replace(/\s+/g, ' ').trim();

const usableList = (list, word) => (Array.isArray(list) ? list.filter((t) => typeof t === 'string' && gapOf(t, word)) : []);
/** Fill in the blanks' text for an entry: its sentence, else its first statement; '' when it has none that holds the word once. */
function fillText(e) {
  if (!e || !e.word) return '';
  if (typeof e.sentence === 'string' && gapOf(e.sentence, e.word)) return e.sentence;
  if (e.sentence) return '';
  return usableList(e.statements, e.word)[0] || '';
}
/** Mix and match's statements for an entry: usable ones; an entry with no `sentence` leaves its first one to Fill in the blanks. */
function mixStatements(e, n) {
  if (!e || !e.word) return [];
  const all = usableList(e.statements, e.word);
  const list = e.sentence ? all : all.slice(1);
  return list.length ? [rotate(list, n)] : [];
}
const rotate = (list, n) => list[(((Math.trunc(n) || 0) % list.length) + list.length) % list.length];

/**
 * The statement for a word on a given turn: the (n mod count)-th of the word's usable statements. `bank` is the statements file
 * ({ _meta, w: { word: [..] } }), its `w` map, or a plain { word: [..] } map; keys are lower case. Pure, nothing stored, so every
 * device gives the same statement on the same turn. '' when the word has none.
 */
export function statementFor(word, n, bank) {
  const map = bank && bank._meta && bank.w ? bank.w : bank || {};
  const list = usableList(map[lc(word)] || map[word], word);
  return list.length ? rotate(list, n) : '';
}

const shape = (e, text, scored) => {
  const g = gapOf(text, e.word);
  return { kind: 'statement', text: g.before + BLANK + g.after, before: g.before, after: g.after, full: text, word: e.word, scored };
};

// ---- Fill in the blanks (TR-91) -----------------------------------------------------------------------
/**
 * The sentences for one round: week words whose text holds the word once, not hidden (and no text that names a hidden word),
 * those done fewest times today first (ties in `rand`'s order), up to level.items. doneToday: a Map, an object of counts, or a list of words.
 * -> [{ kind: 'statement', word, text (the gap drawn), before, after, full, scored: true }]
 */
export function fillItems(entries, level, { hidden = [], doneToday = null } = {}, rand = Math.random) {
  const hid = setOf(hidden);
  const done = countOf(doneToday);
  const ok = uniqueWords(entries || []).map((e) => ({ e, t: fillText(e) })).filter((x) => x.t && !hid.has(lc(x.e.word)) && !mentions(x.t, hid));
  const order = shuffled(ok, rand).map((x, i) => ({ ...x, i })).sort((a, b) => done(a.e.word) - done(b.e.word) || a.i - b.i);
  return order.slice(0, (level && level.items) || 6).map((x) => shape(x.e, x.t, true));
}
/**
 * The cards for one sentence (pick mode): the answer and (choices - 1) other week words, shuffled. With level.lookAlike, words that
 * start with the same two letters come first among the others. Never a hidden word, never the answer twice. [] in spell mode.
 */
export function fillChoices(item, weekWords, level, hidden = [], rand = Math.random) {
  if (!level || level.fill !== 'pick') return [];
  const hid = setOf(hidden);
  const key = lc(item.word);
  const seen = new Set([key]);
  const others = (weekWords || []).filter((w) => { const k = lc(w); if (seen.has(k) || hid.has(k)) return false; seen.add(k); return true; });
  const like = level.lookAlike ? others.filter((w) => lc(w).slice(0, 2) === key.slice(0, 2)) : [];
  const rest = others.filter((w) => !like.includes(w));
  const chosen = [...shuffled(like, rand), ...shuffled(rest, rand)].slice(0, Math.max(0, (level.choices || 3) - 1));
  return shuffled([item.word, ...chosen], rand);
}
/**
 * The pass for one sentence, ready for recordPass: a pick is source 'm' (as Meaning match: it can earn the day's star, never "remembered");
 * a spelled gap is source 'g' (as Missing letters), with the tile help `lv` and `h` when given.
 */
export function fillPass(item, { tries = 0, spelled = false, lv, h } = {}) {
  const base = { word: item.word, tries, clean: !tries };
  return spelled ? { ...base, source: 'g', ...(lv ? { lv } : {}), ...(h ? { h } : {}) } : { ...base, source: 'm' };
}

// ---- Mix and match (TR-91, TR-101) --------------------------------------------------------------------
export const glowAfter = 2; // misses on one slot before the right card glows
/**
 * The boards for one round. entries: the week's words (with `statements`); exclude: words already used in Fill in the blanks today
 * (used last); spare: other words (unscored) that fill a short board; hidden; n: which statement turn this is (days since the week began
 * plus rounds already played, see statementFor). Boards = level.boards.length of level.cards slots each; with level.spare (Years 5-6) a
 * board also has one spare card, another week word that fits nowhere on it.
 * -> [{ kind: 'statement', slots: [{ kind, text, before, after, full, word, scored }], cards: [{ word, spare? }] }]
 */
export function mixBoards(entries, level, { exclude = [], spare = [], hidden = [], n = 0 } = {}, rand = Math.random) {
  const lv = level || levelFor();
  const hid = setOf(hidden);
  const ex = setOf(exclude);
  const pick = (e) => { const t = mixStatements(e, n)[0]; return t && !hid.has(lc(e.word)) && !mentions(t, hid) ? { e, t } : null; };
  const pool = uniqueWords(entries || []).map(pick).filter(Boolean);
  const ordered = [...shuffled(pool.filter((x) => !ex.has(lc(x.e.word))), rand), ...shuffled(pool.filter((x) => ex.has(lc(x.e.word))), rand)];
  const used = new Set(ordered.map((x) => lc(x.e.word)));
  const spares = shuffled(uniqueWords(spare || []).map(pick).filter((x) => x && !used.has(lc(x.e.word))), rand);
  const per = lv.cards || 4;
  const boards = [];
  for (let b = 0; b < lv.boards.length; b += 1) {
    const own = ordered.slice(b * per, (b + 1) * per);
    if (!own.length) break;
    const slots = own.map((x) => shape(x.e, x.t, true));
    while (slots.length < per && spares.length) { const x = spares.shift(); slots.push(shape(x.e, x.t, false)); }
    boards.push({ kind: 'statement', slots: shuffled(slots, rand) });
  }
  const onBoard = new Set(boards.flatMap((b) => b.slots.map((s) => lc(s.word))));
  const everyone = uniqueWords([...(entries || []), ...(spare || [])]).filter((e) => !hid.has(lc(e.word)));
  for (const board of boards) {
    const here = new Set(board.slots.map((s) => lc(s.word)));
    const cards = board.slots.map((s) => ({ word: s.word }));
    if (lv.spare) {
      const free = everyone.filter((e) => !here.has(lc(e.word)));
      const pickFrom = free.filter((e) => !onBoard.has(lc(e.word)));
      const choice = shuffled(pickFrom.length ? pickFrom : free, rand)[0];
      if (choice) cards.push({ word: choice.word, spare: true });
    }
    board.cards = shuffled(cards, rand);
  }
  return boards;
}
/** A fresh board's state: cards placed by slot, tries charged to the card's word, misses counted by slot (for the glow). */
export const newBoard = () => ({ placed: {}, tries: {}, misses: {} });
/**
 * Put a card in a slot: { state, hit }. A right card stays; a wrong one goes back and adds 1 to tries[word] (and 1 to the slot's misses).
 * A filled slot, a card already placed, or a card not on the board changes nothing.
 */
export function placeCard(state, board, word, slotIndex) {
  const slot = board.slots[slotIndex];
  const inTray = board.cards.some((c) => lc(c.word) === lc(word));
  const placed = Object.values(state.placed).some((w) => lc(w) === lc(word));
  if (!slot || !inTray || placed || state.placed[slotIndex] !== undefined) return { state, hit: false };
  if (lc(slot.word) === lc(word)) return { state: { ...state, placed: { ...state.placed, [slotIndex]: slot.word } }, hit: true };
  return {
    state: { ...state, tries: { ...state.tries, [word]: (state.tries[word] || 0) + 1 }, misses: { ...state.misses, [slotIndex]: ((state.misses || {})[slotIndex] || 0) + 1 } },
    hit: false,
  };
}
export const boardDone = (state, board) => board.slots.every((_, i) => state.placed[i] !== undefined);
/** The slot (lowest first) with glowAfter misses that is still empty, and the card that fits it: { slot, word }, or null. */
export function glowFor(state, board) {
  const i = board.slots.findIndex((s, k) => state.placed[k] === undefined && ((state.misses || {})[k] || 0) >= glowAfter);
  return i < 0 ? null : { slot: i, word: board.slots[i].word };
}
/** The scored slots' passes once the board is done (source 'm'; a word is clean when none of its drops missed). */
export const boardPasses = (state, board) => board.slots.filter((s) => s.scored).map((s) => ({ word: s.word, tries: state.tries[s.word] || 0, clean: !state.tries[s.word], source: 'm' }));
