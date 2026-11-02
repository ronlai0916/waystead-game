// A signed-in player's Wordbright data, as three saved values (game
// "wordbright" in the Waystead account), each cached on the device under the
// player's id. Signed out, store.js keeps today's keys (wb.game, wb.setup)
// exactly as they were. Pure: no DOM, no storage, no clock (callers pass `now`).
//
//   "game"   wb.game:<id>    { state, savedAt }   the saved game (state null: none)
//   "setup"  wb.setup:<id>   { setup, savedAt }   the last new-game choices,
//                                                 with each seat's word level
//   "stats"  wb.stats:<id>   { v: 1, resetAt, results, folded }
//            results: one per finished game, { id, at, board, players:
//            [{ name, score, level, computer, hints }], winners, me }
//            (hints: hints used; me: the seat this player had, or null)
//
// MERGE (two devices, or a 409 from the account):
//   · game, setup: the newest savedAt wins (a tie keeps this device's);
//   · stats: finished games are merged by id, so a result is never lost and
//     never counted twice; games, wins and best score are counted from the
//     results, never added from two copies. G9: the id is the board and the
//     game's own random id, made when it starts (config.gameId), so two
//     different games can never share one; a game from before G9 keeps its
//     old id (board + seed), as already saved.
// SIZE: past 48 KB the oldest results are folded into one total (games,
// wins, best score) until the value is under 40 KB. A saved game too big for
// the account's 64 KB stays on this device only (account/sync.js).
import { mergeLog, foldOldest, newest } from './account/merge.js';
import { HINTS_PER_GAME } from './engine/game.js';

export const GAME = 'game';
export const SETUP = 'setup';
export const STATS = 'stats';
export const TRIM_AT = 48 * 1024;
export const TRIM_TO = 40 * 1024;

export const sizeOf = (d) => new TextEncoder().encode(JSON.stringify(d)).length;
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const time = (v) => (v && Date.parse(v.savedAt)) || 0;

// ---- game, setup: newest wins ---------------------------------------------------
export const mergeNewest = (a, b) => newest(a, b, time);

// ---- stats ------------------------------------------------------------------------
export const emptyStats = () => ({ v: 1, resetAt: 0, results: [], folded: {} });

export function normaliseStats(d) {
  if (!isObj(d) || d.v !== 1) return emptyStats();
  const f = isObj(d.folded) && isObj(d.folded.all) ? d.folded.all : null;
  return {
    v: 1,
    resetAt: num(d.resetAt),
    results: (Array.isArray(d.results) ? d.results : []).filter((r) => isObj(r) && typeof r.id === 'string' && num(r.at) && Array.isArray(r.players)),
    folded: f ? { all: { n: num(f.n), wins: num(f.wins), best: num(f.best), through: num(f.through) } } : {},
  };
}

// Which seat is this player's: the child seat with their name, else the
// only child seat; null when that can't be told (two children, other names).
export function mySeat(players, name) {
  const kids = players.map((p, i) => [p, i]).filter(([p]) => !p.computer);
  const want = String(name || '').trim().toLowerCase();
  const byName = kids.find(([p]) => String(p.name || '').trim().toLowerCase() === want);
  if (want && byName) return byName[1];
  return kids.length === 1 ? kids[0][1] : null;
}

export const resultId = (state) => {
  const c = state.config || {};
  return typeof c.gameId === 'string' && /^[0-9a-f]{16,32}$/.test(c.gameId) ? state.board + '-g' + c.gameId : state.board + '-' + num(c.seed);
};

// G9: how a new game starts: a fresh random seed (never the last game's) and a
// random game id. random(n) gives n random 32-bit numbers (crypto by default).
export function freshStart(prev, random = (n) => globalThis.crypto.getRandomValues(new Uint32Array(n))) {
  const last = prev && prev.config ? prev.config.seed : null;
  let seed = random(1)[0];
  for (let i = 0; seed === last && i < 8; i++) seed = random(1)[0];
  const gameId = [...random(4)].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  return { seed, gameId };
}

export function resultOf(state, at, name) {
  const players = state.players.map((p) => ({
    name: String(p.name || '').slice(0, 40), score: num(p.score), level: p.level,
    ...(p.computer ? { computer: p.strength || 'normal' } : { hints: HINTS_PER_GAME - num(p.hints) }),
  }));
  return { id: resultId(state), at, board: state.board, players, winners: (state.result && state.result.winners) || [], me: mySeat(state.players, name) };
}

const won = (r) => r.me != null && r.winners.includes(r.me);
const myScore = (r) => (r.me != null && r.players[r.me] ? num(r.players[r.me].score) : 0);
const LOG = {
  group: () => 'all',
  absorb: (f, r) => ({ ...f, best: Math.max(num(f.best), typeof r.best === 'number' ? r.best : myScore(r)) }),
  tally: (f, r) => ({ ...f, wins: num(f.wins) + (won(r) ? 1 : 0) }),
  emptyFold: () => ({ n: 0, wins: 0, best: 0, through: 0 }),
};

// A finished game, once (saving the same game again changes nothing).
export function recordResult(stats, state, at, name) {
  if (!state || !state.over) return stats;
  const id = resultId(state);
  const f = stats.folded.all;
  if (stats.results.some((r) => r.id === id) || (f && at <= f.through)) return stats;
  return { ...stats, results: [...stats.results, resultOf(state, at, name)] };
}

export function mergeStats(a, b) {
  const x = normaliseStats(a);
  const y = normaliseStats(b);
  return { v: 1, ...mergeLog(x, y, LOG) };
}

export function trimStats(d) {
  return sizeOf(d) <= TRIM_AT ? d : foldOldest(d, { target: TRIM_TO, sizeOf, ...LOG });
}

export function summary(d) {
  const s = normaliseStats(d);
  const f = s.folded.all || LOG.emptyFold();
  return {
    games: f.n + s.results.length,
    wins: f.wins + s.results.filter(won).length,
    best: Math.max(f.best, ...s.results.map(myScore), 0),
  };
}

// Today's signed-out keys, as values to merge into a player's ("Save this
// device's progress"): the saved game (and, if it has finished, its result)
// and the new-game choices (dated 0, so the player's own choices win).
export function fromDevice(game, setup, name, now) {
  const out = {};
  if (game && game.state) {
    out.game = { state: game.state, savedAt: game.savedAt || new Date(now).toISOString() };
    if (game.state.over) out.stats = recordResult(emptyStats(), game.state, Date.parse(game.savedAt) || now, name);
  }
  if (setup) out.setup = { setup, savedAt: new Date(0).toISOString() };
  return out;
}
