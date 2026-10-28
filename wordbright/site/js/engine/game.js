// A whole game. The state is plain JSON (it can be saved, sent to a server
// and checked there with this same code). Every action returns a new state;
// the old one is never changed.
//
// env (not saved, the same on every device):
//   { board: loadBoard(...), tiles: tiles.json, starWords: star_words.json,
//     graphs: { starter, steady, full, large, xlarge } }  (loadWordGraph(...);
//     only the lists the players' levels use are needed)
//
// Actions: { type: 'play', tiles: [{ r, c, letter, blank }] }
//          { type: 'swap', tiles: ['e', '?'] }   ('?' is a blank)
//          { type: 'pass' }
// See wordbright-design/board/rules.md.

import { emptyCells } from './board.js';
import { BLANK, newBag, draw, putBack, tilesLeft } from './bag.js';
import { isWord } from './words.js';
import { checkMove } from './rules.js';
import { RACK_SIZE, scoreMove, tilePoints } from './score.js';
import { playerList, computerList, starSet } from './levels.js';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
// The game ends after this many full rounds in which nobody scores.
export const NO_SCORE_ROUNDS = 3;

const HINTS = {
  'game-over': 'The game has finished.',
  'not-in-rack': 'You can only use tiles from your rack.',
  'swap-none': 'Choose at least one tile to swap.',
  'bag-low': 'You can swap only while the bag has at least 7 tiles.',
};

function fail(state, error) {
  return { ok: false, error, message: HINTS[error], state };
}

// config: { board: 'standard', seed: 12345, level: 'year-5',
//           players: [{ name, level?, computer? }] }  (2–4 players)
export function newGame(config, env) {
  if (config.board !== env.board.id) throw new Error(`env.board is "${env.board.id}", not "${config.board}"`);
  const n = (config.players || []).length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error(`A game needs ${MIN_PLAYERS}–${MAX_PLAYERS} players`);
  let bag = newBag(env.tiles, config.board, config.seed);
  const players = config.players.map((p) => {
    const dealt = draw(bag, RACK_SIZE);
    bag = dealt.bag;
    return { name: p.name, level: p.level || config.level, computer: !!p.computer, rack: dealt.drawn, score: 0 };
  });
  for (const p of players) playerList(p.level); // throws on an unknown level
  return {
    version: 1,
    config: structuredClone(config),
    board: config.board,
    size: env.board.size,
    cells: emptyCells(env.board),
    bag,
    players,
    turn: 0,
    scoreless: 0, // turns in a row with no score (passes, swaps, 0-point plays)
    over: false,
    result: null,
    history: [],
  };
}

// The word check for this player: a child plays their level's list; a
// computer player is checked against the list it knows.
export function wordCheck(player, env) {
  const { list, maxLength } = player.computer ? computerList(player.level) : playerList(player.level);
  const graph = env.graphs[list];
  if (!graph) throw new Error(`Word list "${list}" is not loaded`);
  return (word) => isWord(word, graph, maxLength);
}

export function starCheck(player, env) {
  const stars = starSet(player.level, env.starWords || []);
  return (word) => stars.has(word);
}

export function rackPoints(rack, env) {
  return rack.reduce((sum, t) => sum + tilePoints(env.tiles.values, t, t === BLANK), 0);
}

// The rack without `used` (letters, '?' for blanks), or null if they are not all there.
function takeFromRack(rack, used) {
  const left = rack.slice();
  for (const t of used) {
    const i = left.indexOf(t);
    if (i < 0) return null;
    left.splice(i, 1);
  }
  return left;
}

function nextTurn(s) {
  s.turn = (s.turn + 1) % s.players.length;
}

// A turn that scored nothing: end the game after three full rounds of them.
function noScore(s, env) {
  s.scoreless += 1;
  if (s.scoreless >= NO_SCORE_ROUNDS * s.players.length) finish(s, 'no-score', env);
  else nextTurn(s);
}

function finish(s, reason, env) {
  const penalties = s.players.map((p) => rackPoints(p.rack, env));
  s.players.forEach((p, i) => { p.score = Math.max(0, p.score - penalties[i]); }); // never below 0
  const best = Math.max(...s.players.map((p) => p.score));
  s.over = true;
  s.result = {
    reason, // 'out' (bag empty, a rack used up) or 'no-score' (three rounds with no score)
    penalties,
    scores: s.players.map((p) => p.score),
    winners: s.players.map((p, i) => (p.score === best ? i : -1)).filter((i) => i >= 0),
  };
}

// Would this play be allowed? Same answer as play(), without making it.
export function checkPlay(state, tiles, env) {
  const player = state.players[state.turn];
  if (!takeFromRack(player.rack, tiles.map((t) => (t.blank ? BLANK : t.letter)))) return fail(state, 'not-in-rack');
  return checkMove(env.board, state.cells, tiles, wordCheck(player, env));
}

export function play(state, tiles, env) {
  if (state.over) return fail(state, 'game-over');
  const placed = (tiles || []).map((t) => ({ r: t.r, c: t.c, letter: t.letter, blank: !!t.blank }));
  const player0 = state.players[state.turn];
  const rack = takeFromRack(player0.rack, placed.map((t) => (t.blank ? BLANK : t.letter)));
  if (!rack) return fail(state, 'not-in-rack');
  const check = checkMove(env.board, state.cells, placed, wordCheck(player0, env));
  if (!check.ok) return { ...check, state };

  const s = structuredClone(state);
  const player = s.players[s.turn];
  const score = scoreMove(env.board, env.tiles.values, check.words, placed.length, starCheck(player, env));
  for (const t of placed) s.cells[t.r * s.size + t.c] = { letter: t.letter, blank: t.blank };
  const refill = draw(s.bag, RACK_SIZE - rack.length);
  s.bag = refill.bag;
  player.rack = rack.concat(refill.drawn);
  player.score += score.total;
  s.history.push({ type: 'play', player: s.turn, tiles: placed, words: score.words, score: score.total });
  if (tilesLeft(s.bag) === 0 && player.rack.length === 0) finish(s, 'out', env);
  else if (score.total === 0) noScore(s, env);
  else { s.scoreless = 0; nextTurn(s); }
  return { ok: true, state: s, score, words: check.words };
}

export function swap(state, tiles, env) {
  if (state.over) return fail(state, 'game-over');
  if (!Array.isArray(tiles) || tiles.length === 0) return fail(state, 'swap-none');
  if (tilesLeft(state.bag) < RACK_SIZE) return fail(state, 'bag-low');
  const rack = takeFromRack(state.players[state.turn].rack, tiles);
  if (!rack) return fail(state, 'not-in-rack');

  const s = structuredClone(state);
  const fresh = draw(s.bag, tiles.length);
  s.bag = putBack(fresh.bag, tiles);
  s.players[s.turn].rack = rack.concat(fresh.drawn);
  s.history.push({ type: 'swap', player: s.turn, tiles: tiles.slice() });
  noScore(s, env);
  return { ok: true, state: s };
}

export function pass(state, env) {
  if (state.over) return fail(state, 'game-over');
  const s = structuredClone(state);
  s.history.push({ type: 'pass', player: s.turn });
  noScore(s, env);
  return { ok: true, state: s };
}

export function act(state, action, env) {
  if (action.type === 'play') return play(state, action.tiles, env);
  if (action.type === 'swap') return swap(state, action.tiles, env);
  if (action.type === 'pass') return pass(state, env);
  throw new Error(`Unknown action "${action.type}"`);
}

// Play a saved game again from its config and history.
export function replay(config, history, env) {
  let state = newGame(config, env);
  for (const action of history) {
    const res = act(state, action, env);
    if (!res.ok) throw new Error(`Replay failed at move ${state.history.length + 1}: ${res.error}`);
    state = res.state;
  }
  return state;
}
