// Computer players: which move each strength makes (PLAN.md Rev 4).
// Pure, like the engine: no DOM and no clock or Math.random of its own. Any
// chance comes from a seed taken from the game state, so the same position
// always gives the same move (games replay, and the tests can check it).
//
//   Easy    a weak move (about the 30th percentile of scores), sometimes swaps
//   Normal  one of its top 10 moves, at random
//   Hard    the best score
//   Crazy   the best score plus what the tiles it keeps are worth next turn

import { findMoves } from '../engine/movegen.js';
import { computerList, listTier } from '../engine/levels.js';
import { starCheck } from '../engine/game.js';
import { BLANK, rng, tilesLeft } from '../engine/bag.js';
import { RACK_SIZE } from '../engine/score.js';

// Time cap for one move (ms). The screen adds a short pause so it feels human.
export function timeLimit(boardId) {
  return boardId === 'large' ? 5000 : 3000;
}

const EASY_SWAP = 0.12; // how often Easy swaps when it could play

// A number in [0, 1) for this turn, from the game state.
export function turnRandom(state, salt = 0) {
  const seed = (state.bag.seed ^ Math.imul(state.history.length + 1, 0x9E3779B1) ^ Math.imul(salt + 1, 0x85EBCA6B)) >>> 0;
  return rng(seed);
}

// ---- What the tiles kept for next turn are worth (Crazy) -----------------
// Small numbers on our 1–7 letter values: a blank or an S helps next turn,
// hard letters and doubles get in the way, and a rack wants a mix of vowels.
const KEEP = {
  '?': 6, s: 2, e: 1, r: 0.8, t: 0.6, n: 0.6, l: 0.5, a: 0.5, i: 0.3, d: 0.3, o: 0, h: 0, m: 0, c: -0.3, p: -0.3,
  g: -0.6, b: -0.8, u: -1.2, y: -0.8, f: -1, k: -1.2, w: -1.5, v: -2.5, j: -2.5, x: -1, z: -1.5, q: -4,
};
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

export function leaveValue(left, bagLeft, values) {
  if (!left.length) return 0;
  // Bag empty: whatever is left counts against us at the end.
  if (bagLeft === 0) return -left.reduce((sum, t) => sum + (t === BLANK ? 0 : values[t] || 0), 0);
  let v = 0;
  const seen = new Map();
  let vowels = 0;
  for (const t of left) {
    v += KEEP[t] ?? 0;
    const k = (seen.get(t) || 0) + 1;
    seen.set(t, k);
    if (k > 1 && t !== BLANK) v -= VOWELS.has(t) ? 2 : 1.5;
    if (VOWELS.has(t)) vowels++;
  }
  if (seen.has('q') && !seen.has('u')) v -= 2;
  const consonants = left.length - vowels - (seen.get(BLANK) || 0);
  v -= Math.max(0, Math.abs(vowels - consonants) - 1) * 1.5;
  return v;
}

// The rack without the tiles a move uses.
export function rackAfter(rack, tiles) {
  const left = rack.slice();
  for (const t of tiles) left.splice(left.indexOf(t.blank ? BLANK : t.letter), 1);
  return left;
}

// Tiles to swap when the computer does not play: keep the helpful ones.
function swapTiles(rack, count = rack.length) {
  const ranked = rack.slice().sort((a, b) => (KEEP[a] ?? 0) - (KEEP[b] ?? 0));
  const out = ranked.filter((t) => t !== BLANK && (KEEP[t] ?? 0) < 1).slice(0, count);
  return out.length ? out : ranked.slice(0, Math.min(count, RACK_SIZE));
}

// Pick from `moves` (best first, from findMoves) for this strength.
// ctx: { rack, bagLeft, values, random }. Returns a move, or null to swap.
export function chooseMove(strength, moves, ctx) {
  if (!moves.length) return null;
  const r = ctx.random();
  if (strength === 'easy') {
    if (ctx.bagLeft >= RACK_SIZE && r < EASY_SWAP) return null;
    // About the 30th percentile (between the 20th and 40th), counted from the worst.
    const p = 0.2 + 0.2 * ctx.random();
    return moves[Math.round((1 - p) * (moves.length - 1))];
  }
  if (strength === 'normal') return moves[Math.floor(r * Math.min(10, moves.length))];
  if (strength === 'crazy') {
    let best = moves[0];
    let bestValue = -Infinity;
    for (const m of moves) {
      const value = m.score.total + leaveValue(rackAfter(ctx.rack, m.tiles), ctx.bagLeft, ctx.values);
      if (value > bestValue) { best = m; bestValue = value; }
    }
    return best;
  }
  return moves[0]; // hard
}

// The computer's whole turn. opts: { now, timeLimit } for the time cap.
// Returns { action, move, capped, found }: action is ready for act().
export function computerTurn(state, env, opts = {}) {
  const player = state.players[state.turn];
  if (!player.computer) throw new Error('Not a computer player');
  const { list, maxLength } = computerList(player.level);
  const found = findMoves({
    board: env.board, cells: state.cells, rack: player.rack, words: env.words,
    maxTier: listTier(list), maxLength, values: env.tiles.values, isStar: starCheck(player, env),
    now: opts.now, timeLimit: opts.timeLimit,
  });
  const bagLeft = tilesLeft(state.bag);
  const random = turnRandom(state);
  const move = chooseMove(player.strength, found.moves, { rack: player.rack, bagLeft, values: env.tiles.values, random });
  const info = { capped: found.capped, found: found.moves.length };
  if (move) return { action: { type: 'play', tiles: move.tiles }, move, ...info };
  if (bagLeft >= RACK_SIZE) {
    const count = player.strength === 'easy' && found.moves.length ? 2 + Math.floor(random() * 3) : RACK_SIZE;
    return { action: { type: 'swap', tiles: swapTiles(player.rack, count) }, move: null, ...info };
  }
  return { action: { type: 'pass' }, move: null, ...info };
}
