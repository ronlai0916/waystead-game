// G9 Bug A: every new game starts from a fresh random seed (never the last
// game's) and its own random game id; finished games are told apart by that id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGame } from '../site/js/engine/game.js';
import { freshStart, resultId, recordResult, emptyStats, mergeStats, summary } from '../site/js/player-data.js';
import { env, ROOT } from './helpers.js';

const PLAYERS = [{ name: 'Player 1' }, { name: 'Fizz', computer: true, strength: 'crazy' }];
const start = (prev, e = env('junior')) => {
  const { seed, gameId } = freshStart(prev);
  return newGame({ board: 'junior', seed, gameId, level: 'year-5', players: PLAYERS }, e);
};

test('50 new games in a row: 50 different seeds, game ids and first racks', () => {
  const e = env('junior');
  const games = [];
  let prev = null;
  for (let i = 0; i < 50; i++) { prev = start(prev, e); games.push(prev); }
  assert.equal(new Set(games.map((g) => g.config.seed)).size, 50);
  assert.equal(new Set(games.map((g) => g.config.gameId)).size, 50);
  assert.equal(new Set(games.map((g) => g.players.map((p) => p.rack.join('')).join('|'))).size, 50);
  for (const g of games) assert.match(g.config.gameId, /^[0-9a-f]{32}$/);
});

test('the next game never reuses the last game\'s seed, even if the random source repeats it', () => {
  const prev = start(null);
  const values = [prev.config.seed, prev.config.seed, 12345, 1, 2, 3, 4];
  let i = 0;
  const random = (n) => Uint32Array.from({ length: n }, () => values[Math.min(i++, values.length - 1)]);
  const next = freshStart(prev, random);
  assert.notEqual(next.seed, prev.config.seed);
  assert.equal(next.seed, 12345);
});

test('set-up makes every new game with freshStart (no seed from the set-up choices or a fixed value)', () => {
  const setup = readFileSync(ROOT + 'site/js/views/setup.js', 'utf8');
  assert.match(setup, /const \{ seed, gameId \} = freshStart\(current && current\.state\);/);
  assert.match(setup, /newGame\(\{ board: choice\.board, seed, gameId,/);
  assert.equal((setup.match(/newGame\(/g) || []).length, 1, 'one place starts a game');
  assert.doesNotMatch(setup, /seed:\s*(\d|choice|prev|last)/);
});

// A finished game, as recordResult sees it.
function finished(seed, gameId, score) {
  const g = newGame({ board: 'junior', seed, ...(gameId ? { gameId } : {}), level: 'year-5', players: PLAYERS }, env('junior'));
  return { ...g, over: true, players: g.players.map((p, i) => ({ ...p, score: i === 0 ? score : 10 })), result: { winners: [0], reason: 'out' } };
}

test('two different games with the same seed are two results; the same game on two devices is one', () => {
  const a = finished(777, 'a'.repeat(32), 120);
  const b = finished(777, 'b'.repeat(32), 90);
  assert.notEqual(resultId(a), resultId(b));
  let s = recordResult(emptyStats(), a, 1000, 'Player 1');
  s = recordResult(s, b, 2000, 'Player 1');
  assert.equal(s.results.length, 2);
  // Each on its own device, then merged (a 409, or a second device).
  const one = recordResult(emptyStats(), a, 1000, 'Player 1');
  const two = recordResult(emptyStats(), b, 2000, 'Player 1');
  assert.equal(summary(mergeStats(one, two)).games, 2);
  // The same game finished on two devices: counted once.
  assert.equal(summary(mergeStats(one, recordResult(emptyStats(), a, 1005, 'Player 1'))).games, 1);
  assert.equal(recordResult(one, a, 3000, 'Player 1'), one, 'recorded once');
});

test('a game from before G9 (no game id) keeps its old id (board + seed), so saved results still match', () => {
  const old = finished(4242, null, 50);
  assert.equal(resultId(old), 'junior-4242');
  const saved = { v: 1, resetAt: 0, folded: {}, results: [{ id: 'junior-4242', at: 1, board: 'junior', players: [{ name: 'Player 1', score: 50, hints: 0 }, { name: 'Fizz', score: 10, computer: 'crazy' }], winners: [0], me: 0 }] };
  assert.equal(recordResult(saved, old, 2, 'Player 1').results.length, 1, 'the same old game is not counted again');
  assert.equal(resultId(finished(4242, 'c'.repeat(32), 50)), 'junior-g' + 'c'.repeat(32));
});
