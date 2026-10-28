import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, play, swap, pass, replay, checkPlay, rackPoints, act } from '../site/js/engine/game.js';
import { tilesLeft, bagTiles, newBag, draw, putBack } from '../site/js/engine/bag.js';
import { env, tiles, lay, anchor, BOARD_IDS } from './helpers.js';

const PLAYERS = [{ name: 'Ava' }, { name: 'Ben' }];
const config = (board, seed = 7, players = PLAYERS) => ({ board, seed, level: 'year-5', players });

// Empty the bag (keep the racks), so the end of the game can be tested.
function emptyBag(s) {
  s.bag.pos = s.bag.order.length;
  return s;
}

// A small, deterministic move finder for the replay test: tries one or two
// tiles from each square next to a tile (or on a start square) and plays the
// first that works. Blanks are played as E.
function someMove(state, e) {
  const { board } = e;
  const n = board.size;
  const player = state.players[state.turn];
  const rack = player.rack;
  const empty = state.cells.every((x) => x === null);
  const filled = (r, c) => r >= 0 && c >= 0 && r < n && c < n && state.cells[r * n + c];
  const near = (r, c) => filled(r, c + 1) || filled(r + 1, c) || filled(r, c - 1) || filled(r - 1, c);
  const tile = (r, c, t) => ({ r, c, letter: t === '?' ? 'e' : t, blank: t === '?' });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (state.cells[r * n + c]) continue;
      if (empty ? !board.start.has(r * n + c) : !near(r, c)) continue;
      for (let i = 0; i < rack.length; i++) {
        const tries = empty ? [] : [[tile(r, c, rack[i])]];
        for (let j = 0; j < rack.length; j++) {
          if (j === i) continue;
          for (const [dr, dc] of [[0, 1], [1, 0]]) {
            if (r + dr < n && c + dc < n && !state.cells[(r + dr) * n + c + dc]) tries.push([tile(r, c, rack[i]), tile(r + dr, c + dc, rack[j])]);
          }
        }
        for (const t of tries) if (checkPlay(state, t, e).ok) return t;
      }
    }
  }
  return null;
}

function playOut(boardId, seed, players = PLAYERS) {
  const e = env(boardId);
  let s = newGame(config(boardId, seed, players), e);
  for (let i = 0; i < 400 && !s.over; i++) {
    const move = someMove(s, e);
    const res = move ? play(s, move, e)
      : tilesLeft(s.bag) >= 7 ? swap(s, s.players[s.turn].rack.slice(0, 3), e)
        : pass(s, e);
    assert.equal(res.ok, true, res.message);
    s = res.state;
  }
  return s;
}

test('bag: counts from tiles.json, seeded shuffle, draw and put back', () => {
  for (const id of BOARD_IDS) {
    assert.equal(bagTiles(tiles, id).length, tiles.bags[id].total);
    assert.equal(bagTiles(tiles, id).filter((t) => t === '?').length, tiles.bags[id].blanks);
  }
  const a = newBag(tiles, 'standard', 99);
  assert.deepEqual(newBag(tiles, 'standard', 99), a);
  assert.notDeepEqual(newBag(tiles, 'standard', 100).order, a.order);
  assert.deepEqual([...a.order].sort(), bagTiles(tiles, 'standard').sort());
  const d = draw(a, 7);
  assert.equal(d.drawn.length, 7);
  assert.equal(tilesLeft(d.bag), 85);
  assert.equal(a.pos, 0); // the old bag is unchanged
  const back = putBack(d.bag, d.drawn.slice(0, 3));
  assert.equal(tilesLeft(back), 88);
  assert.deepEqual(putBack(d.bag, d.drawn.slice(0, 3)), back);
  assert.throws(() => newBag(tiles, 'standard'), /seed/);
});

for (const id of BOARD_IDS) {
  test(`${id}: new game deals 7 tiles each from the board's bag`, () => {
    for (const players of [PLAYERS, [...PLAYERS, { name: 'Cal' }], [...PLAYERS, { name: 'Cal' }, { name: 'Dee', computer: true }]]) {
      const s = newGame(config(id, 3, players), env(id));
      assert.ok(s.players.every((p) => p.rack.length === 7 && p.score === 0));
      assert.equal(tilesLeft(s.bag), tiles.bags[id].total - 7 * players.length);
      assert.equal(s.cells.length, s.size * s.size);
      assert.deepEqual(JSON.parse(JSON.stringify(s)), s); // plain JSON
    }
    assert.throws(() => newGame(config(id, 3, [{ name: 'Solo' }]), env(id)), /2–4 players/);
    assert.throws(() => newGame(config(id, 3, [...PLAYERS, ...PLAYERS, { name: 'Five' }]), env(id)), /2–4 players/);
  });

  test(`${id}: tiles must come from the rack; turns go round`, () => {
    const e = env(id);
    const [r0, c0] = anchor(e.board);
    const s = newGame(config(id), e);
    s.players[0].rack = ['c', 'a', 't', 'e', 'e', 'e', 'e'];
    assert.equal(play(s, lay('cot', r0, c0), e).error, 'not-in-rack');
    assert.equal(play(s, lay('c?at', r0, c0), e).error, 'not-in-rack'); // no blank in the rack
    const bad = play(s, lay('cta', r0, c0), e);
    assert.equal(bad.error, 'not-a-word');
    assert.equal(bad.state, s);
    const before = JSON.stringify(s);
    const res = play(s, lay('cat', r0, c0), e);
    assert.equal(res.ok, true);
    assert.equal(JSON.stringify(s), before); // the old state is not changed
    assert.equal(res.state.turn, 1);
    assert.equal(res.state.players[0].rack.length, 7);
    assert.equal(tilesLeft(res.state.bag), tilesLeft(s.bag) - 3);
    assert.deepEqual(res.state.players[0].rack.slice(0, 4), ['e', 'e', 'e', 'e']);
  });

  test(`${id}: swap needs at least 7 tiles in the bag`, () => {
    const e = env(id);
    const s = newGame(config(id), e);
    const rack = s.players[0].rack;
    const ok = swap(s, rack.slice(0, 2), e);
    assert.equal(ok.ok, true);
    assert.equal(tilesLeft(ok.state.bag), tilesLeft(s.bag));
    assert.equal(ok.state.players[0].rack.length, 7);
    assert.equal(ok.state.turn, 1);
    assert.equal(swap(s, [], e).error, 'swap-none');
    s.players[0].rack = ['a', 'a', 'a', 'a', 'a', 'a', 'a'];
    assert.equal(swap(s, ['z'], e).error, 'not-in-rack');
    s.bag.pos = s.bag.order.length - 7;
    assert.equal(swap(s, ['a'], e).ok, true); // exactly 7 left: allowed
    s.bag.pos += 1;
    const refused = swap(s, ['a'], e);
    assert.equal(refused.ok, false);
    assert.equal(refused.error, 'bag-low');
    assert.match(refused.message, /at least 7/);
  });

  test(`${id}: game ends when the bag is empty and a rack is used up; rack points are taken off`, () => {
    const e = env(id);
    const [r0, c0] = anchor(e.board);
    const s = emptyBag(newGame(config(id), e));
    s.players[0].rack = ['a', 't'];
    s.players[1].rack = ['q', 'z', '?', 'e'];
    const res = play(s, lay('at', r0, c0), e);
    assert.equal(res.ok, true);
    const end = res.state;
    assert.equal(end.over, true);
    assert.equal(end.result.reason, 'out');
    assert.deepEqual(end.result.penalties, [0, 7 + 6 + 0 + 1]);
    assert.deepEqual(end.result.scores, [res.score.total, 0]); // 0 − 14 stops at 0
    assert.deepEqual(end.result.winners, [0]);
    assert.equal(play(end, lay('e', r0 + 1, c0), e).error, 'game-over');
    assert.equal(pass(end, e).error, 'game-over');
  });

  test(`${id}: a rack used up while the bag still has tiles does not end the game`, () => {
    const e = env(id);
    const [r0, c0] = anchor(e.board);
    const s = newGame(config(id), e);
    s.players[0].rack = ['a', 't'];
    const res = play(s, lay('at', r0, c0), e);
    assert.equal(res.state.over, false);
    assert.equal(res.state.players[0].rack.length, 7);
  });

  test(`${id}: rack points are taken off, but no score goes below 0`, () => {
    const e = env(id);
    const s = emptyBag(newGame(config(id), e));
    s.players[0].score = 20;
    s.players[0].rack = ['q', 'e'];       // 8 points: 20 → 12
    s.players[1].score = 5;
    s.players[1].rack = ['z', 'x', 'e'];  // 13 points: 5 → 0, not −8
    let t = s;
    for (let i = 0; i < 6; i++) t = pass(t, e).state;
    assert.deepEqual(t.result.penalties, [8, 13]);
    assert.deepEqual(t.result.scores, [12, 0]);
    assert.deepEqual(t.players.map((p) => p.score), [12, 0]);
    assert.deepEqual(t.result.winners, [0]);
  });

  test(`${id}: three full rounds with no score end the game (passes and swaps both count)`, () => {
    const e = env(id);
    const players = [...PLAYERS, { name: 'Cal' }];
    let s = newGame(config(id, 5, players), e);
    for (let i = 0; i < 8; i++) {
      const rack = s.players[s.turn].rack;
      s = (i % 2 ? swap(s, rack.slice(0, 2), e) : pass(s, e)).state;
    }
    assert.equal(s.over, false);
    assert.equal(s.scoreless, 8);
    s = pass(s, e).state;
    assert.equal(s.over, true);
    assert.equal(s.result.reason, 'no-score');
    const pens = s.players.map((p) => rackPoints(p.rack, e));
    assert.deepEqual(s.result.penalties, pens);
    assert.deepEqual(s.result.scores, [0, 0, 0]);
  });

  test(`${id}: players who only swap end the game after three rounds`, () => {
    const e = env(id);
    let s = newGame(config(id, 11), e);
    let turns = 0;
    while (!s.over) {
      const res = swap(s, s.players[s.turn].rack.slice(), e); // swap the whole rack
      assert.equal(res.ok, true, res.message);
      s = res.state;
      turns++;
    }
    assert.equal(turns, 3 * 2);
    assert.equal(s.result.reason, 'no-score');
    assert.ok(s.history.every((h) => h.type === 'swap'));
  });

  test(`${id}: a scoring play resets the count; a 0-point play counts as no score`, () => {
    const e = env(id);
    const [r0, c0] = anchor(e.board);
    let s = newGame(config(id), e);
    s.players[0].rack = ['?', '?', 'e', 'e', 'e', 'e', 'e'];
    for (let i = 0; i < 5; i++) s = pass(s, e).state;
    assert.equal(s.scoreless, 5);
    s.turn = 0;
    // Two blanks as A and T, on the start square and the plain square beside it: 0 points.
    const zero = play(s, [{ r: r0, c: c0, letter: 'a', blank: true }, { r: r0, c: c0 + 1, letter: 't', blank: true }], e);
    assert.equal(zero.ok, true, zero.message);
    assert.equal(zero.score.total, 0);
    assert.equal(zero.state.over, true); // the sixth no-score turn of two players
    s.players[0].rack = ['a', 't', 'e', 'e', 'e', 'e', 'e'];
    const scored = play(s, lay('at', r0, c0), e);
    assert.ok(scored.score.total > 0);
    assert.equal(scored.state.scoreless, 0);
    assert.equal(scored.state.over, false);
  });

  test(`${id}: a seeded game replays identically`, () => {
    const a = playOut(id, 2026);
    const b = playOut(id, 2026);
    assert.deepEqual(a, b);
    assert.ok(a.history.filter((h) => h.type === 'play').length >= 3, 'some words were played');
    assert.deepEqual(replay(a.config, a.history, env(id)), a);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
    assert.notDeepEqual(newGame(config(id, 2027), env(id)).players, newGame(config(id, 2026), env(id)).players);
    assert.equal(a.over, true);
    // Every tile is accounted for: board + racks + bag = the whole bag.
    const onBoard = a.cells.filter(Boolean).map((x) => (x.blank ? '?' : x.letter));
    const all = onBoard.concat(...a.players.map((p) => p.rack), a.bag.order.slice(a.bag.pos));
    assert.deepEqual(all.sort(), bagTiles(tiles, id).sort());
    // Scores add up: sum of moves minus penalties.
    a.players.forEach((p, i) => {
      const moves = a.history.filter((h) => h.player === i && h.type === 'play').reduce((t, h) => t + h.score, 0);
      assert.equal(p.score, Math.max(0, moves - a.result.penalties[i]));
    });
  });
}

test('a computer player is checked against the list it knows', () => {
  const e = env('standard');
  const s = newGame({ board: 'standard', seed: 1, level: 'year-1', players: [{ name: 'Pip', computer: true }, { name: 'Ava' }] }, e);
  s.players[0].rack = ['l', 'i', 'b', 'r', 'a', 'r', 'y'];
  s.players[1].rack = ['l', 'i', 'b', 'r', 'a', 'r', 'y'];
  // Band A: the computer knows words up to 6 letters; the child may play the full list.
  assert.equal(play(s, lay('library', 6, 0), e).error, 'not-a-word');
  const child = act({ ...s, turn: 1 }, { type: 'play', tiles: lay('library', 6, 0) }, e);
  assert.equal(child.ok, true);
});
