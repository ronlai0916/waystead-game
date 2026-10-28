// Scores: the three worked examples in F3_examples.md (23, 36, 60), played
// through the whole engine, plus hand-worked moves on each board.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, play } from '../site/js/engine/game.js';
import { checkMove } from '../site/js/engine/rules.js';
import { scoreMove } from '../site/js/engine/score.js';
import { env, boards, tiles, fullList, lay, cellsWith } from './helpers.js';

// A two-player game on `boardId` where player 1 holds `rack`.
function gameWith(boardId, rack, level = 'year-3', cells = null) {
  const e = env(boardId);
  const s = newGame({ board: boardId, seed: 1, level, players: [{ name: 'Ava' }, { name: 'Ben' }] }, e);
  s.players[0].rack = [...rack];
  if (cells) s.cells = cells;
  return [s, e];
}

// Score `tiles` on a board holding `existing` words, at a Star-word level.
function score(boardId, existing, placed, stars = []) {
  const b = boards[boardId];
  const res = checkMove(b, cellsWith(b, ...existing), placed, fullList);
  assert.equal(res.ok, true, res.message);
  return scoreMove(b, tiles.values, res.words, placed.length, (w) => stars.includes(w));
}

test('Example 1 — Standard, first move BUILD scores 23', () => {
  const [s, e] = gameWith('standard', 'buildxx');
  const res = play(s, lay('build', 6, 2), e);
  assert.equal(res.ok, true, res.message);
  assert.equal(res.score.total, 23);
  assert.equal(res.score.starBonus, 5);
  assert.equal(res.state.players[0].score, 23);
});

test('Example 2 — Standard, SPINE down through the I of BUILD scores 36', () => {
  const [s1, e] = gameWith('standard', 'buildxx');
  const s2 = play(s1, lay('build', 6, 2), e).state;
  s2.players[1].rack = ['s', 'p', 'n', 'e', 'q', 'q', 'q'];
  const res = play(s2, [{ r: 4, c: 4, letter: 's' }, { r: 5, c: 4, letter: 'p' }, { r: 7, c: 4, letter: 'n' }, { r: 8, c: 4, letter: 'e' }], e);
  assert.equal(res.ok, true, res.message);
  assert.deepEqual(res.score.words.map((w) => w.word), ['spine']);
  assert.equal(res.score.total, 36);
});

test('Example 3 — Large, first move LIBRARY (all 7 tiles) scores 60', () => {
  const [s, e] = gameWith('large', 'library');
  const res = play(s, lay('library', 9, 7), e);
  assert.equal(res.ok, true, res.message);
  assert.equal(res.score.fullRack, 30);
  assert.equal(res.score.starBonus, 5);
  assert.equal(res.score.total, 60);
});

test('Junior — BUILD across the middle row scores 27, then CAB on a Shine scores 16', () => {
  // B on Glow (3×3) + U 3 + I 2 + L 2 + D on Glow (2×3) = 22, +5 Star word.
  const [s, e] = gameWith('junior', 'buildxx');
  const r1 = play(s, lay('build', 4, 2), e);
  assert.equal(r1.score.total, 27);
  // C on Shine, A plain, B already there: (3 + 2 + 3) × 2.
  r1.state.players[1].rack = ['c', 'a', 'x', 'x', 'x', 'x', 'x'];
  const r2 = play(r1.state, lay('ca', 2, 2, 'down'), e);
  assert.equal(r2.ok, true, r2.message);
  assert.deepEqual(r2.score.words.map((w) => w.word), ['cab']);
  assert.equal(r2.score.total, 16);
});

test('Star square triples the word; Spark doubles the letter (Junior)', () => {
  // AT already at (1,2)-(1,3); C on the Star at (1,1): (3 + 2 + 2) × 3.
  assert.equal(score('junior', [['at', 1, 2, 'across']], lay('c', 1, 1)).total, 21);
  // IT at (0,1)-(0,2); S on the Spark at (0,3): 2 + 2 + 1×2.
  assert.equal(score('junior', [['it', 0, 1, 'across']], lay('s', 0, 3)).total, 6);
});

test('bonus squares count only when the tile is first placed', () => {
  // BUILD already on the Glow; adding S: 3 + 3 + 2 + 2 + 2 + 1.
  assert.equal(score('standard', [['build', 6, 2, 'across']], lay('s', 6, 7)).total, 13);
});

test('a blank scores 0, even on a Glow square', () => {
  const [s, e] = gameWith('standard', '?uildxx');
  const res = play(s, lay('?build', 6, 2), e);
  assert.equal(res.ok, true, res.message);
  assert.equal(res.score.total, 0 + 3 + 2 + 2 + 2 + 5);
  assert.deepEqual(res.state.cells[6 * 13 + 2], { letter: 'b', blank: true });
});

test('a Star word made as a cross word earns +5 too', () => {
  // HEAR across from (6,3). T at (6,7) and O at (7,7) make TO (down) and HEART (across).
  const res = score('standard', [['hear', 6, 3, 'across']], lay('to', 6, 7, 'down'), ['heart']);
  assert.deepEqual(res.words.map((w) => [w.word, w.points, w.star]), [['to', 4, false], ['heart', 10, true]]);
  assert.equal(res.total, 19);
});

test('Star words count only at levels that include their year', () => {
  const at = (level) => {
    const [s, e] = gameWith('standard', 'buildxx', level);
    return play(s, lay('build', 6, 2), e).score.total;
  };
  assert.equal(at('year-3'), 23);  // band B: Year 3–4 list
  assert.equal(at('year-1'), 18);  // band A: Year 1–2 words only
  assert.equal(at('year-5'), 18);  // band C: Year 5–6 list
  assert.equal(at('year-8'), 23);  // band D: all KS1–2 lists
  assert.equal(at('degree'), 18);  // band G: no Star words
});

test('full-rack bonus only for all 7 tiles', () => {
  const placed = lay('library', 9, 7);
  const b = boards.large;
  const res = checkMove(b, cellsWith(b), placed, fullList);
  assert.equal(scoreMove(b, tiles.values, res.words, 7).fullRack, 30);
  assert.equal(scoreMove(b, tiles.values, res.words, 6).fullRack, 0);
});
