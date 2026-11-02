import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, play, replay, hintsLeft, useHint, HINTS_PER_GAME, wordCheck } from '../site/js/engine/game.js';
import { isWord } from '../site/js/engine/words.js';
import { computerList, listTier } from '../site/js/engine/levels.js';
import { computerTurn, chooseMove, leaveValue, rackAfter, timeLimit, crazyLeave } from '../site/js/ai/computer.js';
import { learnedLeave, leaveFeatures } from '../site/js/ai/leave.js';
import { findHint, takeHint } from '../site/js/ai/hint.js';
import { findMoves } from '../site/js/engine/movegen.js';
import { CHARACTERS, STRENGTH_ORDER } from '../site/js/ai/characters.js';
import { env, tiles, leaves, BOARD_IDS } from './helpers.js';

const bot = (strength, level) => ({ name: strength, computer: true, strength, level });

function playOut(boardId, seed, players, level = 'year-5', each = () => {}) {
  const e = env(boardId);
  let s = newGame({ board: boardId, seed, level, players }, e);
  for (let turns = 0; !s.over; turns++) {
    assert.ok(turns < 1000, 'game did not end');
    const res = computerTurn(s, e);
    each(s, res);
    const next = act(s, res.action, e);
    assert.ok(next.ok, next.message);
    s = next.state;
  }
  return s;
}

test('characters: one per strength, Pip Easy, Ottie Normal, Bramble Hard, Fizz Crazy', () => {
  assert.deepEqual(STRENGTH_ORDER.map((k) => CHARACTERS[k].name), ['Pip', 'Ottie', 'Bramble', 'Fizz']);
  assert.deepEqual(STRENGTH_ORDER.map((k) => CHARACTERS[k].animal), ['dormouse', 'otter', 'badger', 'magpie']);
  assert.equal(timeLimit('junior'), 3000);
  assert.equal(timeLimit('large'), 5000);
});

test('band A computer: never a word over 6 letters or outside its list, even next to long words', () => {
  // Bramble at Year 1 (band A) plays a Year 13 player who knows the large list.
  const players = [bot('hard', 'year-1'), bot('crazy', 'year-13')];
  const { list, maxLength } = computerList('year-1');
  assert.equal(maxLength, 6);
  let checked = 0;
  for (const boardId of BOARD_IDS) {
    for (const seed of [1, 2, 3]) {
      const e = env(boardId);
      let s = newGame({ board: boardId, seed, level: 'year-5', players }, e);
      while (!s.over) {
        const res = computerTurn(s, e);
        const next = act(s, res.action, e);
        assert.ok(next.ok, next.message);
        if (s.turn === 0 && res.action.type === 'play') {
          for (const w of next.score.words) {
            assert.ok(w.word.length <= 6, w.word);
            assert.ok(isWord(w.word, e.words, listTier(list)), w.word);
            checked++;
          }
        }
        s = next.state;
      }
    }
  }
  assert.ok(checked > 50);
});

test('every strength finishes games on every board with legal moves only', () => {
  for (const boardId of BOARD_IDS) {
    const players = STRENGTH_ORDER.map((k) => bot(k));
    const s = playOut(boardId, 11, players, 'year-7');
    assert.equal(s.over, true);
  }
});

test('the same position always gives the same computer move', () => {
  const e = env('standard');
  const s = newGame({ board: 'standard', seed: 5, level: 'year-5', players: [bot('normal'), bot('easy')] }, e);
  assert.deepEqual(computerTurn(s, e).action, computerTurn(s, e).action);
});

test('each player keeps their own word level', () => {
  const e = env('junior');
  const s = newGame({ board: 'junior', seed: 3, level: 'year-5', players: [{ name: 'Ava', level: 'year-2' }, { name: 'Ben', level: 'doctor' }, bot('hard', 'year-1')] }, e);
  assert.deepEqual(s.players.map((p) => p.level), ['year-2', 'doctor', 'year-1']);
  // "abaka" is only in the biggest list: every child may play it (C3a), a
  // Year 1 computer does not know it.
  assert.equal(wordCheck(s.players[0], e)('abaka'), true);
  assert.equal(wordCheck(s.players[1], e)('abaka'), true);
  assert.equal(wordCheck(s.players[2], e)('abaka'), false);
  assert.equal(wordCheck(s.players[2], e)('library'), false); // band A computer: up to 6 letters
  assert.deepEqual(s.players.map((p) => p.hints), [HINTS_PER_GAME, HINTS_PER_GAME, 0]);
  assert.equal(s.players[2].strength, 'hard');
  assert.throws(() => newGame({ board: 'junior', seed: 3, level: 'year-5', players: [{ name: 'A' }, { name: 'B', computer: true, strength: 'wild' }] }, e), /Unknown strength/);
});

test('how each strength picks', () => {
  const moves = Array.from({ length: 50 }, (_, k) => ({ tiles: [], score: { total: 100 - k } }));
  const ctx = (seed) => ({ rack: [], bagLeft: 0, values: tiles.values, random: (() => { let x = seed; return () => (x = (x * 9301 + 49297) % 233280) / 233280; })() });
  assert.equal(chooseMove('hard', moves, ctx(1)), moves[0]);
  for (let seed = 1; seed < 40; seed++) {
    assert.ok(moves.indexOf(chooseMove('normal', moves, ctx(seed))) < 10);
    const easy = chooseMove('easy', moves, ctx(seed));
    const rank = moves.indexOf(easy) / (moves.length - 1); // 0 best, 1 worst
    assert.ok(rank >= 0.6 && rank <= 0.8, `easy picked rank ${rank}`); // 20th–40th percentile
  }
  assert.equal(chooseMove('hard', [], ctx(1)), null);
});

test('rack leave: blanks and S are worth keeping, Q without U is not; empty bag counts points left', () => {
  const v = tiles.values;
  assert.ok(leaveValue(['?', 's', 'e'], 50, v) > leaveValue(['q', 'v', 'v'], 50, v));
  assert.ok(leaveValue(['q', 'u'], 50, v) > leaveValue(['q', 'i'], 50, v));
  assert.equal(leaveValue(['q', 'a'], 0, v), -(v.q + v.a));
  assert.deepEqual(rackAfter(['a', '?', 'b'], [{ letter: 'x', blank: true }, { letter: 'b', blank: false }]), ['a']);
});

test('learned leave table (data/leaves.json): one per board, empty leave 0, blank worth keeping, Q wants U', () => {
  for (const boardId of BOARD_IDS) {
    const t = leaves[boardId];
    assert.ok(t && Object.keys(t).length > 100, boardId);
    assert.equal(learnedLeave(t, []), 0);
    assert.ok(learnedLeave(t, ['?']) > 3, `${boardId}: blank`);
    assert.ok(learnedLeave(t, ['?']) > learnedLeave(t, ['v']), boardId);
    assert.ok(learnedLeave(t, ['e', 'r', 's', 't']) > learnedLeave(t, ['a', 'e', 'i', 'o']), `${boardId}: too many vowels`);
    if (boardId !== 'junior') assert.ok(learnedLeave(t, ['q', 'u']) > learnedLeave(t, ['q', 'i']), `${boardId}: Q without U`); // no Q in the Junior bag
  }
  assert.deepEqual(leaveFeatures(['s', 'e', '?', 'e']), ['1?', '1e', '2e', '1s', 'p?e', 'p?s', 'pes', 'vc2-1']);
});

test('Crazy near the end: kept tiles cost more as the bag runs out; with it empty, points left count (half again for 4+)', () => {
  const t = leaves.standard;
  const at = (bagLeft) => crazyLeave({ table: t, bagLeft, values: tiles.values });
  assert.equal(at(0)(['k', 'e']), -(tiles.values.k * 1.5 + tiles.values.e));
  assert.equal(at(40)(['k', 'e']), learnedLeave(t, ['k', 'e']));
  assert.ok(at(2)(['w']) < at(2)(['e']));
  assert.ok(at(2)(['w']) < at(6)(['w']));
  // Without a table (older data), Crazy falls back to the simple leave.
  assert.equal(crazyLeave({ table: null, bagLeft: 50, values: tiles.values })(['q', 'u']), leaveValue(['q', 'u'], 50, tiles.values));
});

test('Crazy: same position gives the same move, and it keeps to the time cap on a slow device', () => {
  const e = env('standard');
  let s = newGame({ board: 'standard', seed: 9, level: 'year-5', players: [bot('hard'), bot('crazy')] }, e);
  for (let k = 0; k < 5; k++) s = act(s, computerTurn(s, e).action, e).state;
  assert.equal(s.players[s.turn].strength, 'crazy');
  const a = computerTurn(s, e);
  assert.deepEqual(a.action, computerTurn(s, e).action);
  assert.ok(act(s, a.action, e).ok);
  // A clock that moves 20 ms every time it is read: about 150 reads fit in 3 s.
  let t = 0;
  let last = 0;
  const now = () => (last = (t += 20));
  const slow = computerTurn(s, e, { now, timeLimit: 3000 });
  assert.ok(act(s, slow.action, e).ok);
  assert.ok(last <= 3000 + 200, `took ${last} ms`);
});

test('Crazy v Hard on every board: legal moves only, and with the bag empty Crazy plays when it can', () => {
  for (const boardId of BOARD_IDS) {
    let endgame = 0;
    for (const seed of [1, 2]) {
      playOut(boardId, seed, [bot('crazy'), bot('hard')], 'year-5', (s, res) => {
        if (s.players[s.turn].strength === 'crazy' && s.bag.pos === s.bag.order.length && res.found) {
          endgame++;
          assert.equal(res.action.type, 'play');
        }
      });
    }
    assert.ok(endgame > 0, `${boardId}: no end-game moves seen`);
  }
});

// ---- Hints ---------------------------------------------------------------

function childGame(boardId = 'standard', seed = 21) {
  const e = env(boardId);
  return { e, s: newGame({ board: boardId, seed, level: 'year-5', players: [{ name: 'Ava', level: 'year-3' }, bot('normal')] }, e) };
}

test('hints: 3, then 2, 1, 0, and no more', () => {
  const { e, s: s0 } = childGame();
  let s = s0;
  assert.equal(hintsLeft(s.players[0]), 3);
  for (const left of [2, 1, 0]) {
    const res = takeHint(s, e);
    assert.equal(res.ok, true);
    assert.ok(res.move);
    s = res.state;
    assert.equal(hintsLeft(s.players[0]), left);
    assert.equal(s.turn, 0); // a hint is not a turn
  }
  const none = takeHint(s, e);
  assert.equal(none.ok, false);
  assert.equal(none.error, 'no-hints');
  assert.equal(none.state, s);
  assert.equal(useHint(s).ok, false);
  // Hints are saved in the history, so a replay keeps the count.
  assert.equal(hintsLeft(replay(s.config, s.history, e).players[0]), 0);
});

test('hints: no move found does not use a hint', () => {
  const { e, s: s0 } = childGame('junior');
  const s = structuredClone(s0);
  s.players[0].rack = ['q', 'q', 'q', 'q', 'q', 'q', 'q'];
  assert.equal(findHint(s, e), null);
  const res = takeHint(s, e);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'no-move');
  assert.equal(hintsLeft(res.state.players[0]), 3);
  assert.equal(res.state.history.length, 0);
});

test('hints: the move is legal for the child and uses only words a computer at their level knows', () => {
  const { list, maxLength } = computerList('year-3');
  for (const boardId of BOARD_IDS) {
    for (const seed of [21, 22, 23]) {
      const { e, s } = childGame(boardId, seed);
      const res = takeHint(s, e);
      assert.equal(res.ok, true);
      const p = play(res.state, res.move.tiles, e);
      assert.ok(p.ok, p.message);
      assert.equal(p.score.total, res.move.score.total);
      for (const w of res.move.score.words) assert.ok(isWord(w.word, e.words, listTier(list), maxLength), w.word);
    }
  }
});

test('hints: picked from the 5 best moves; computers have none; works on an empty board', () => {
  const { e, s } = childGame('junior', 4);
  assert.ok(s.cells.every((c) => c === null));
  const move = findHint(s, e);
  assert.ok(move);
  const all = findMoves({ board: e.board, cells: s.cells, rack: s.players[0].rack, words: e.words, maxTier: listTier(computerList('year-3').list), values: e.tiles.values });
  const top = all.moves.slice(0, 5).map((m) => m.score.total);
  assert.ok(move.score.total >= Math.min(...top));
  assert.equal(hintsLeft(s.players[1]), 0);
});

// ---- End screen: who celebrates -------------------------------------------
import { celebration } from '../site/js/views/end.js';

test('end screen: a winning computer celebrates; else the first computer cheers; children only: nobody', () => {
  const st = (players, winners) => ({ players, result: { winners } });
  const ava = { name: 'Ava' };
  const ben = { name: 'Ben' };
  const pip = { name: 'Pip', computer: true, strength: 'easy' };
  const fizz = { name: 'Fizz', computer: true, strength: 'crazy' };
  assert.deepEqual(celebration(st([ava, pip, fizz], [2])), { player: fizz, won: true });
  assert.deepEqual(celebration(st([ava, pip, fizz], [0])), { player: pip, won: false });
  assert.deepEqual(celebration(st([ava, fizz], [0, 1])), { player: fizz, won: true }); // a draw with a computer
  assert.equal(celebration(st([ava, ben], [1])), null);
});
