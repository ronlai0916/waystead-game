// Hints: a good move for the child whose turn it is (3 per child per game).
// It uses the words a computer at the child's level knows (not rarer ones),
// and picks one of the 5 best moves at random. Pure, like computer.js.
//
// A hint that finds nothing is not used up.

import { findMoves } from '../engine/movegen.js';
import { computerList, listTier } from '../engine/levels.js';
import { starCheck, useHint, hintsLeft } from '../engine/game.js';
import { turnRandom } from './computer.js';

const TOP = 5;

// The hint move for this turn, or null. opts: { now, timeLimit }.
export function findHint(state, env, opts = {}) {
  const player = state.players[state.turn];
  const { list, maxLength } = computerList(player.level);
  const found = findMoves({
    board: env.board, cells: state.cells, rack: player.rack, words: env.words,
    maxTier: listTier(list), maxLength, values: env.tiles.values, isStar: starCheck(player, env),
    now: opts.now, timeLimit: opts.timeLimit,
  });
  if (!found.moves.length) return null;
  const random = turnRandom(state, 1);
  return found.moves[Math.floor(random() * Math.min(TOP, found.moves.length))];
}

// Find a hint and use one up. Returns { ok: true, state, move } or
// { ok: false, error: 'no-move' | 'no-hints', state } (state unchanged).
export function takeHint(state, env, opts = {}) {
  if (hintsLeft(state.players[state.turn]) <= 0) return { ok: false, error: 'no-hints', state };
  const move = findHint(state, env, opts);
  if (!move) return { ok: false, error: 'no-move', state };
  const res = useHint(state);
  return res.ok ? { ok: true, state: res.state, move } : res;
}
