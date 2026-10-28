import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadBoard, isStart, squareAt, onBoard } from '../site/js/engine/board.js';
import { boards, DATA } from './helpers.js';

const raw = (id) => JSON.parse(readFileSync(DATA + `board_${id}.json`, 'utf8'));

for (const id of ['junior', 'standard', 'large']) {
  test(`${id}: size and start squares come from the file`, () => {
    const json = raw(id);
    const b = boards[id];
    assert.equal(b.size, json.size);
    assert.equal(b.bonus.length, json.size * json.size);
    assert.equal(b.start.size, json.start.length);
    for (const [r, c] of json.start) assert.equal(isStart(b, r, c), true);
    assert.equal(onBoard(b, b.size - 1, b.size - 1), true);
    assert.equal(onBoard(b, b.size, 0), false);
    assert.equal(onBoard(b, 0, -1), false);
  });
}

test('start squares: one on Junior and Standard, the 2x2 block on Large', () => {
  assert.equal(boards.junior.start.size, 1);
  assert.equal(boards.standard.start.size, 1);
  assert.equal(boards.large.start.size, 4);
  const L = boards.large;
  assert.deepEqual([...L.start].sort((a, b) => a - b), [9 * 20 + 9, 9 * 20 + 10, 10 * 20 + 9, 10 * 20 + 10]);
});

test('square names and multipliers', () => {
  const s = boards.standard;
  assert.deepEqual(squareAt(s, 6, 2), { name: 'Glow', letter: 3, word: 1 });
  assert.deepEqual(squareAt(s, 4, 4), { name: 'Shine', letter: 1, word: 2 });
  assert.deepEqual(squareAt(s, 1, 1), { name: 'Star', letter: 1, word: 3 });
  assert.deepEqual(squareAt(s, 0, 2), { name: 'Spark', letter: 2, word: 1 });
  assert.equal(squareAt(s, 6, 6).word, 1); // the start square has no bonus
});

test('a board of any size loads; bad boards are refused', () => {
  const tiny = { id: 'tiny', size: 3, start: [[1, 1]], squares: {}, grid: ['...', '.*.', '...'] };
  assert.equal(loadBoard(tiny).size, 3);
  assert.throws(() => loadBoard({ ...tiny, grid: ['...', '.*.'] }), /not 3 by 3/);
  assert.throws(() => loadBoard({ ...tiny, start: [[0, 0]] }), /do not match/);
  assert.throws(() => loadBoard({ ...tiny, grid: ['..X', '.*.', '...'] }), /unknown square/);
  assert.throws(() => loadBoard({ ...tiny, start: [] }), /no start/);
});
