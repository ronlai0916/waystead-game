// Computer players: which move each strength makes (PLAN.md Rev 4).
// Pure, like the engine: no DOM and no clock or Math.random of its own. Any
// chance comes from a seed taken from the game state, so the same position
// always gives the same move (games replay, and the tests can check it).
//
//   Easy    a weak move (about the 30th percentile of scores), sometimes swaps
//   Normal  one of its top 10 moves, at random
//   Hard    the best score
//   Crazy   (G7) score plus what the tiles it keeps are worth next turn
//           (learned from self-play, data/leaves.json); on Junior and
//           Standard it also tries likely racks for the next player and
//           counts their best reply against each of its best moves; near
//           the end of the bag it avoids keeping high-value tiles; with the
//           bag empty it looks three moves ahead (both racks are known)

import { findMoves } from '../engine/movegen.js';
import { computerList, listTier } from '../engine/levels.js';
import { starCheck } from '../engine/game.js';
import { BLANK, rng, tilesLeft, bagTiles } from '../engine/bag.js';
import { RACK_SIZE } from '../engine/score.js';
import { learnedLeave } from './leave.js';

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
    const leave = crazyLeave(ctx);
    let best = moves[0];
    let bestValue = -Infinity;
    for (const m of moves) {
      const value = m.score.total + leave(rackAfter(ctx.rack, m.tiles));
      if (value > bestValue) { best = m; bestValue = value; }
    }
    return best;
  }
  return moves[0]; // hard
}

// ---- Crazy (G7) -----------------------------------------------------------
// Leave values from data/leaves.json (env.leaves, this board's table). Near
// the end of the bag the learned value fades out and the points of the tiles
// kept count against it more and more: with few tiles to draw, a J or a Z
// kept now may never find a place. With the bag empty, tiles left count
// fully against it. Without a table it falls back to the simple leave above.
const ENDGAME_BAG = 7; // bag sizes below this count as "nearly empty"

export function crazyLeave(ctx) {
  const { table, bagLeft, values } = ctx;
  const cache = new Map();
  return (left) => {
    if (!left.length) return 0;
    const key = left.slice().sort().join('');
    let v = cache.get(key);
    if (v !== undefined) return v;
    if (!table) v = leaveValue(left, bagLeft, values);
    else if (bagLeft === 0) v = -stuckPoints(left, values);
    else if (bagLeft >= ENDGAME_BAG) v = learnedLeave(table, left);
    else {
      const f = bagLeft / ENDGAME_BAG; // 1 → 0 as the bag runs out
      v = f * learnedLeave(table, left) - (1 - f) * stuckPoints(left, values);
    }
    cache.set(key, v);
    return v;
  };
}

// Points the tiles would cost if they are still on the rack at the end;
// letters worth 4 or more count half again, as they are the hardest to place.
function stuckPoints(left, values) {
  let sum = 0;
  for (const t of left) {
    const p = t === BLANK ? 0 : values[t] || 0;
    sum += p >= 4 ? p * 1.5 : p;
  }
  return sum;
}

// The tiles nobody can see but this player: the whole bag for this board,
// without the tiles on the board and in this player's rack.
function unseenTiles(state, env, rack) {
  const pool = new Map();
  for (const t of bagTiles(env.tiles, state.board)) pool.set(t, (pool.get(t) || 0) + 1);
  const take = (t) => pool.set(t, (pool.get(t) || 0) - 1);
  for (const cell of state.cells) if (cell) take(cell.blank ? BLANK : cell.letter);
  for (const t of rack) take(t);
  const out = [];
  for (const [t, n] of pool) for (let i = 0; i < n; i++) out.push(t);
  return out;
}

// With the bag empty and one other player, that player's rack is known: it is
// the unseen tiles. Crazy looks three moves ahead (its move, the reply, its
// next move), trying the best few moves each time and passing too. Going out
// ends the game and the other rack counts against its owner; at the end of
// the look-ahead, tiles still held count half against their owner.
const END_ROOT = 10; // Crazy's moves tried first
const END_INNER = 5; // moves tried further on
const END_DEPTH = 3;

function endgameMove(state, env, moves, search) {
  const me = state.players[state.turn];
  const other = state.players[(state.turn + 1) % 2];
  const theirs = unseenTiles(state, env, me.rack);
  if (theirs.length !== other.rack.length) return null; // should not happen; be safe
  const values = env.tiles.values;
  const points = (rack) => rack.reduce((sum, t) => sum + (t === BLANK ? 0 : values[t] || 0), 0);
  const size = state.size;
  const place = (cells, m) => {
    const out = cells.slice();
    for (const t of m.tiles) out[t.r * size + t.c] = { letter: t.letter, blank: t.blank };
    return out;
  };
  let timedOut = false;
  // Best result for the side to move (its points minus the other's from here
  // on). side 0 is Crazy (it searches with `search.me`), side 1 the other.
  const value = (cells, racks, side, depth, passes, found = null) => {
    const [mine, yours] = side === 0 ? racks : [racks[1], racks[0]];
    if (passes >= 2) return points(yours) - points(mine); // both stuck: the game ends
    if (depth === 0) return (points(yours) - points(mine)) / 2;
    const list = found || (side === 0 ? search.me : search.other)(cells, mine);
    if (list === null) { timedOut = true; return 0; }
    const ranked = list.moves.map((m) => {
      const left = rackAfter(mine, m.tiles);
      return { m, left, guess: m.score.total + (left.length ? -points(left) / 2 : points(yours)) };
    }).sort((a, b) => b.guess - a.guess).slice(0, found ? END_ROOT : END_INNER);
    const flip = (r) => (side === 0 ? [r, yours] : [yours, r]);
    // Passing is tried further on; at the top Crazy always plays a move if it has one.
    let best = found ? -Infinity : -value(cells, flip(mine), 1 - side, depth - 1, passes + 1);
    for (const { m, left } of ranked) {
      if (timedOut) break;
      const v = !left.length ? m.score.total + points(yours)
        : m.score.total - value(place(cells, m), flip(left), 1 - side, depth - 1, 0);
      if (v > best) { best = v; if (found) bestMove = m; }
    }
    return best;
  };
  let bestMove = null;
  value(state.cells, [me.rack, theirs], 0, END_DEPTH, 0, { moves });
  return timedOut ? null : bestMove;
}

// Before the bag is empty Crazy cannot see the next player's rack, so it
// tries some: racks drawn (from the turn's seed) from the tiles it cannot
// see, and takes off the mean of the next player's best reply to each of its
// best moves. This is what makes it careful about opening Star and Shine
// squares. Each round tries SIM_ROUND racks (the same racks for every move
// still in), then the weaker half of the moves drop out:
// 12 moves × 8 racks, 6 × 8, 3 × 8. It stops early at the soft time budget.
export const SIM_MOVES = 12;
const SIM_ROUND = 8;
const SIM_KEEP = [12, 6, 3];
export const SIM_BUDGET = 0.4; // share of the time cap
// Boards where looking at replies helps (G7 bot games). On Large there is
// nearly always a good reply wherever Crazy plays, so it only adds noise:
// Crazy won 36 of 50 against Hard without it, 28 of 50 with it.
export const SIMULATE = { junior: true, standard: true, large: false };

function simulateMove(state, env, moves, ctx, search, random, stop) {
  const me = state.players[state.turn];
  const other = state.players[(state.turn + 1) % state.players.length];
  const leave = crazyLeave(ctx);
  let ranked = moves.map((m) => ({ m, v: m.score.total + leave(rackAfter(me.rack, m.tiles)), cells: null, reply: 0, n: 0 }))
    .sort((a, b) => b.v - a.v).slice(0, SIM_MOVES);
  if (ranked.length < 2) return ranked.length ? ranked[0].m : null;
  const unseen = unseenTiles(state, env, me.rack);
  const n = Math.min(other.rack.length, unseen.length);
  for (const c of ranked) {
    c.cells = state.cells.slice();
    for (const t of c.m.tiles) c.cells[t.r * state.size + t.c] = { letter: t.letter, blank: t.blank };
  }
  const mean = (c) => (c.n ? c.v - c.reply / c.n : c.v);
  for (const keep of SIM_KEEP) {
    ranked = ranked.slice(0, keep);
    for (let k = 0; k < SIM_ROUND; k++) {
      const pool = unseen.slice();
      for (let i = 0; i < n; i++) {
        const j = i + Math.floor(random() * (pool.length - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const rack = pool.slice(0, n);
      const replies = [];
      for (const c of ranked) {
        const r = stop() ? null : search(c.cells, rack);
        if (r === null) break; // out of time
        replies.push(r.moves.length ? r.moves[0].score.total : 0);
      }
      if (replies.length < ranked.length) return ranked.slice().sort((a, b) => mean(b) - mean(a))[0].m;
      replies.forEach((x, i) => { ranked[i].reply += x; ranked[i].n++; });
    }
    ranked.sort((a, b) => mean(b) - mean(a));
  }
  return ranked[0].m;
}

// The best tiles to keep when swapping (never all of them): { tiles, value }.
function bestKeep(rack, leave) {
  let best = { tiles: [], value: 0 };
  const n = rack.length;
  for (let mask = 0; mask < (1 << n) - 1; mask++) {
    const tiles = rack.filter((_, i) => mask & (1 << i));
    const value = leave(tiles);
    if (value > best.value) best = { tiles, value };
  }
  return best;
}

// The computer's whole turn. opts: { now, timeLimit } for the time cap.
// Returns { action, move, capped, found }: action is ready for act().
export function computerTurn(state, env, opts = {}) {
  const player = state.players[state.turn];
  if (!player.computer) throw new Error('Not a computer player');
  // One time cap for the whole turn, the end-game look-ahead included.
  const started = opts.now ? opts.now() : 0;
  const deadline = opts.now && opts.timeLimit ? started + opts.timeLimit : Infinity;
  const { list, maxLength } = computerList(player.level);
  const found = findMoves({
    board: env.board, cells: state.cells, rack: player.rack, words: env.words,
    maxTier: listTier(list), maxLength, values: env.tiles.values, isStar: starCheck(player, env),
    now: opts.now, timeLimit: opts.timeLimit,
  });
  const bagLeft = tilesLeft(state.bag);
  const random = turnRandom(state);
  const ctx = { rack: player.rack, bagLeft, values: env.tiles.values, random, table: env.leaves || null };
  let move = null;
  if (player.strength === 'crazy' && found.moves.length) {
    const other = state.players[(state.turn + 1) % state.players.length];
    // The next player's words: Crazy does not know a child's, so it uses its own.
    const otherList = other.computer ? computerList(other.level) : { list, maxLength };
    const searchWith = (who, words) => (cells, rack) => {
      if (opts.now && opts.now() > deadline) return null;
      return findMoves({
        board: env.board, cells, rack, words: env.words, maxTier: listTier(words.list), maxLength: words.maxLength,
        values: env.tiles.values, isStar: starCheck(who, env), now: opts.now, timeLimit: opts.timeLimit ? Math.max(1, deadline - opts.now()) : undefined,
      });
    };
    const search = searchWith(other, otherList);
    if (bagLeft === 0 && state.players.length === 2) {
      move = endgameMove(state, env, found.moves, { me: searchWith(player, { list, maxLength }), other: search });
    } else if (bagLeft > 0 && SIMULATE[state.board] !== false) {
      const soft = opts.now && opts.timeLimit ? started + opts.timeLimit * SIM_BUDGET : Infinity;
      move = simulateMove(state, env, found.moves, ctx, search, turnRandom(state, 2), () => opts.now && opts.now() > soft);
    }
  }
  if (!move) move = chooseMove(player.strength, found.moves, ctx);
  const info = { capped: found.capped, found: found.moves.length };
  if (player.strength === 'crazy' && ctx.table && bagLeft >= RACK_SIZE) {
    // Crazy swaps when the tiles it would keep are worth more than any play.
    const leave = crazyLeave(ctx);
    const keep = bestKeep(player.rack, leave);
    const moveValue = move ? move.score.total + leave(rackAfter(player.rack, move.tiles)) : -Infinity;
    if (keep.value > moveValue) {
      const tiles = rackAfter(player.rack, keep.tiles.map((t) => ({ letter: t, blank: t === BLANK })));
      if (tiles.length) return { action: { type: 'swap', tiles }, move: null, ...info };
    }
  }
  if (move) return { action: { type: 'play', tiles: move.tiles }, move, ...info };
  if (bagLeft >= RACK_SIZE) {
    const count = player.strength === 'easy' && found.moves.length ? 2 + Math.floor(random() * 3) : RACK_SIZE;
    return { action: { type: 'swap', tiles: swapTiles(player.rack, count) }, move: null, ...info };
  }
  return { action: { type: 'pass' }, move: null, ...info };
}
