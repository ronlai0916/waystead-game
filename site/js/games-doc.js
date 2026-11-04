// Game mode's four games: the rules with no page in them. Pure; randomness comes
// in as `rand` (Math.random, or a seeded one in the tests). Each game ends a
// word with a pass, { tries, clean }, recorded like any try on the grid
// (W.addTry, source 'g'), so it feeds the stars and "remembered". A pass with a
// mistake brings the same word straight back until it's clean; games don't need
// 3 in a row, so they earn no dots. Meaning match doesn't test spelling: its
// pass has source 'm', can earn the day's star and counts as played.
import * as R from './spell-run.js';
import * as W from './words-doc.js';

export const GAMES = {
  missing: { title: 'Missing letters', line: 'Hear the word and fill the gap.' },
  unjumble: { title: 'Unjumble', line: 'Tap the letters in the right order.' },
  match: { title: 'Meaning match', line: 'Pair each word with what it means.' },
  quick: { title: 'Quick-fire', line: 'Spell each word as it\'s spoken. There\'s no rush.' },
};
export const GAME_IDS = Object.keys(GAMES);
export const MATCH_SIZE = 4;

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
export function recordPass(d, g, word, { tries, clean, source = 'g' }, { id, day, now }) {
  return W.addTry(d, { id, word, day, group: g.id, kind: source === 'm' ? 'p' : W.kindOn(d, g, word, day), tries, peeks: 0, clean, source, now });
}

// ---- Missing letters -----------------------------------------------------------------
/** The letters to blank: the tricky ones; else one syllable; else the middle of the word. */
export function blanksFor(entry, rand = Math.random) {
  const w = entry.word;
  const at = entry.tricky ? w.indexOf(entry.tricky) : -1;
  if (at >= 0) return range(at, entry.tricky.length);
  const chunks = entry.chunks || [w];
  if (chunks.length > 1) {
    const k = Math.floor(rand() * chunks.length);
    return range(chunks.slice(0, k).join('').length, chunks[k].length);
  }
  return w.length < 4 ? [1] : range(Math.floor(w.length / 3), Math.ceil(w.length / 3));
}
/** The blanks' letters, typed in turn: wrong ones count, as they do on the grid. */
export const newMissing = (word, blanks) => R.newRun(blanks.map((i) => word[i]).join(''));

// ---- Unjumble ------------------------------------------------------------------------
/** The word's letters out of order (a word of one repeated letter can't be). */
export function jumble(word, rand = Math.random) {
  const letters = [...word];
  for (let i = 0; i < 20; i += 1) {
    const out = shuffled(letters, rand);
    if (out.join('') !== word) return out;
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
