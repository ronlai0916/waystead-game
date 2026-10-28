// Points for a move, from the words rules.js found.
// Spark ×2 letter, Glow ×3 letter, Shine ×2 word, Star ×3 word — only for
// tiles placed this turn. Word squares in one word multiply together.
// Blanks score 0. +5 for each Star word made (main or cross word).
// +30 for using all 7 tiles in one turn (the full-rack bonus).

import { squareAt } from './board.js';

export const RACK_SIZE = 7;
export const STAR_BONUS = 5;
export const FULL_RACK_BONUS = 30;

export function tilePoints(values, letter, blank) {
  return blank ? 0 : values[letter] || 0;
}

export function scoreWord(board, values, word) {
  let points = 0;
  let times = 1;
  for (const s of word.squares) {
    const sq = s.placed ? squareAt(board, s.r, s.c) : null;
    points += tilePoints(values, s.letter, s.blank) * (sq ? sq.letter : 1);
    if (sq) times *= sq.word;
  }
  return points * times;
}

// words: from checkMove. tilesPlaced: how many tiles this turn.
// isStar(word): is it a Star word at this player's level?
export function scoreMove(board, values, words, tilesPlaced, isStar = () => false) {
  const list = words.map((w) => ({ word: w.word, main: w.main, points: scoreWord(board, values, w), star: !!isStar(w.word) }));
  const starBonus = list.filter((w) => w.star).length * STAR_BONUS;
  const fullRack = tilesPlaced === RACK_SIZE ? FULL_RACK_BONUS : 0;
  const total = list.reduce((sum, w) => sum + w.points, 0) + starBonus + fullRack;
  return { total, words: list, starBonus, fullRack };
}
