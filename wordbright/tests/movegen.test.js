import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMoves } from '../site/js/engine/movegen.js';
import { checkMove } from '../site/js/engine/rules.js';
import { scoreMove } from '../site/js/engine/score.js';
import { isWord } from '../site/js/engine/words.js';
import { emptyCells } from '../site/js/engine/board.js';
import { newGame, act, play, starCheck } from '../site/js/engine/game.js';
import { computerTurn } from '../site/js/ai/computer.js';
import { env, cellsWith, BOARD_IDS } from './helpers.js';
import { allMoves, moveKey } from './oracle.js';

const FULL = 2; // tier of the full list (levels.js)

function find(e, cells, rack, extra = {}) {
  return findMoves({ board: e.board, cells, rack, words: e.words, maxTier: FULL, values: e.tiles.values, ...extra });
}

// Ten positions per board, from a seeded game between two computer players
// (the same seed always gives the same positions).
function positions(boardId) {
  const e = env(boardId);
  const players = [{ name: 'A', computer: true, strength: 'hard' }, { name: 'B', computer: true, strength: 'normal' }];
  let s = newGame({ board: boardId, seed: 2026, level: 'year-10', players }, e);
  const out = [];
  while (!s.over && out.length < 10) {
    out.push(s);
    for (let k = 0; k < 2 && !s.over; k++) s = act(s, computerTurn(s, e).action, e).state;
  }
  return out;
}

for (const boardId of BOARD_IDS) {
  test(`${boardId}: on 10 positions every move passes checkMove and play(), with the same score`, () => {
    const e = env(boardId);
    const list = positions(boardId);
    assert.equal(list.length, 10);
    for (const s of list) {
      const player = s.players[s.turn];
      const isStar = starCheck(player, e);
      const check = (w) => isWord(w, e.words, FULL);
      const res = find(e, s.cells, player.rack, { isStar });
      assert.equal(res.rejected, 0);
      assert.equal(res.capped, false);
      for (const m of res.moves) {
        const c = checkMove(e.board, s.cells, m.tiles, check);
        assert.ok(c.ok, c.message);
        assert.deepEqual(scoreMove(e.board, e.tiles.values, c.words, m.tiles.length, isStar), m.score);
      }
      // play() takes the best and a spread of others, scoring them the same.
      const step = Math.max(1, Math.floor(res.moves.length / 15));
      for (let k = 0; k < res.moves.length; k += step) {
        const m = res.moves[k];
        const p = play(s, m.tiles, e);
        assert.ok(p.ok, p.message);
        assert.equal(p.score.total, m.score.total);
      }
      for (let k = 1; k < res.moves.length; k++) assert.ok(res.moves[k - 1].score.total >= res.moves[k].score.total);
    }
  });

  test(`${boardId}: finds every move a brute-force search finds (small racks, real positions)`, () => {
    const e = env(boardId);
    const check = (w) => isWord(w, e.words, FULL);
    positions(boardId).forEach((s, k) => {
      const letters = s.players[s.turn].rack.filter((t) => t !== '?');
      const racks = [letters.slice(0, 3)];
      if (boardId === 'junior' && k % 3 === 0) racks.push(['?', letters[0]]); // with a blank
      for (const rack of racks) {
        const want = allMoves(e.board, s.cells, rack, check);
        const got = find(e, s.cells, rack);
        assert.deepEqual(new Set(got.moves.map((m) => moveKey(m.tiles, e.board.size))), new Set(want.keys()), `rack ${rack.join('')}`);
      }
    });
  });
}

// Hand-made positions; the best moves were found with the brute-force search.
test('known best moves', () => {
  const junior = env('junior');
  let res = find(junior, emptyCells(junior.board), ['j', 'u', 'm', 'p', 'e', 'd']);
  assert.equal(res.moves[0].score.total, 32);
  assert.equal(res.moves[0].score.words[0].word, 'jumped');

  const standard = env('standard');
  const garden = cellsWith(standard.board, ['garden', 6, 4, 'across']);
  res = find(standard, garden, ['f', 'l', 'o', 'w', 'e', 'r']);
  assert.equal(res.moves[0].score.total, 56);
  assert.ok(['glower', 'golfer'].includes(res.moves[0].score.words[0].word));
  assert.deepEqual(res.moves.filter((m) => m.score.total === 56).map((m) => m.score.words[0].word).sort(), ['glower', 'golfer']);

  const large = env('large');
  const cells = cellsWith(large.board, ['river', 9, 8, 'across'], ['boat', 6, 10, 'down']);
  res = find(large, cells, ['q', 'u', 'i', 'e', 't']);
  assert.equal(res.moves[0].score.total, 67);
  assert.deepEqual(res.moves[0].tiles.map((t) => t.letter).join(''), 'quiet');
  assert.ok(res.moves[1].score.total < 67);
});

test('blanks: both ways are found, and a blank scores 0', () => {
  const e = env('junior');
  const res = find(e, emptyCells(e.board), ['?', 'a', 't']);
  const cat = res.moves.filter((m) => m.score.words[0].word === 'cat' && m.tiles.length === 3);
  assert.ok(cat.length > 0);
  for (const m of cat) {
    const c = m.tiles.find((t) => t.letter === 'c');
    assert.equal(c.blank, true);
  }
  // Two blanks: words with no real letters at all.
  const two = find(e, emptyCells(e.board), ['?', '?']);
  assert.ok(two.moves.length > 0);
  assert.ok(two.moves.every((m) => m.score.total === 0));
  // A blank standing for a letter the rack also has: both versions are moves.
  const both = find(e, emptyCells(e.board), ['?', 'o', 'o', 'n']);
  const moon = both.moves.filter((m) => m.score.words[0].word === 'moon');
  assert.ok(moon.some((m) => m.tiles.filter((t) => t.blank).length === 1));
});

test('tier and length limits: only words of the list, and no longer than allowed', () => {
  const e = env('standard');
  const cells = cellsWith(e.board, ['garden', 6, 4, 'across']);
  const rack = ['f', 'l', 'o', 'w', 'e', 'r', 's'];
  for (const [tier, maxLength] of [[0, 6], [0, Infinity], [1, Infinity], [4, Infinity]]) {
    const res = findMoves({ board: e.board, cells, rack, words: e.words, maxTier: tier, maxLength, values: e.tiles.values });
    assert.equal(res.rejected, 0);
    assert.ok(res.moves.length > 0);
    for (const m of res.moves) {
      for (const w of m.score.words) {
        assert.ok(w.word.length <= maxLength, w.word);
        assert.ok(isWord(w.word, e.words, tier), w.word);
      }
    }
  }
  // A bigger list finds more moves.
  const count = (t) => find(e, cells, rack, { maxTier: t }).moves.length;
  assert.ok(count(0) < count(2) && count(2) < count(4));
});

test('time cap: stops early and returns the best found so far', () => {
  const e = env('large');
  const cells = cellsWith(e.board, ['river', 9, 8, 'across'], ['boat', 6, 10, 'down']);
  let t = 0;
  const now = () => (t += 1); // every look at the clock is 1 ms later
  const capped = find(e, cells, ['s', '?', 'e', 'r', 'a', 't', '?'], { now, timeLimit: 30 });
  const full = find(e, cells, ['s', '?', 'e', 'r', 'a', 't', '?']);
  assert.equal(capped.capped, true);
  assert.equal(full.capped, false);
  assert.ok(capped.moves.length > 0 && capped.moves.length < full.moves.length);
  for (let k = 1; k < capped.moves.length; k++) assert.ok(capped.moves[k - 1].score.total >= capped.moves[k].score.total);
});

test('no moves: an empty list, not an error', () => {
  const e = env('junior');
  assert.deepEqual(find(e, emptyCells(e.board), ['q', 'q', 'q']).moves, []);
  assert.deepEqual(find(e, emptyCells(e.board), []).moves, []);
});
