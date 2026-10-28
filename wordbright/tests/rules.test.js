// Hand-made legal and illegal moves, run on every board. Positions are
// counted from the board's first start square (r0, c0), so the same cases
// fit 9x9, 13x13 and 20x20.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMove } from '../site/js/engine/rules.js';
import { emptyCells } from '../site/js/engine/board.js';
import { boards, fullList, lay, cellsWith, anchor, BOARD_IDS } from './helpers.js';

function cases(board) {
  const [r0, c0] = anchor(board);
  const n = board.size;
  const empty = () => emptyCells(board);
  const withCat = () => cellsWith(board, ['cat', r0, c0, 'across']);
  return [
    // First move, empty board
    ['first word across from the start', empty, lay('cat', r0, c0), true],
    ['first word down from the start', empty, lay('cat', r0, c0, 'down'), true],
    ['first word ending on the start', empty, lay('cat', r0, c0 - 2), true],
    ['first word missing the start', empty, lay('cat', r0 + 2, c0), 'no-start'],
    ['first word next to the start but not on it', empty, lay('cat', r0 - 1, c0), 'no-start'],
    ['one tile on the start', empty, lay('a', r0, c0), 'too-short'],
    ['tiles not in one line', empty, [{ r: r0, c: c0, letter: 'a' }, { r: r0 + 1, c: c0 + 1, letter: 't' }], 'not-in-line'],
    ['a gap in the word', empty, [...lay('ca', r0, c0), { r: r0, c: c0 + 3, letter: 't' }], 'gap'],
    ['not a word', empty, lay('cta', r0, c0), 'not-a-word'],
    ['US spelling refused', empty, lay('color', r0, c0 - 2), 'not-a-word'],
    ['off the board (right edge)', empty, [{ r: r0, c: n - 1, letter: 'a' }, { r: r0, c: n, letter: 't' }], 'off-board'],
    ['off the board (top edge)', empty, [{ r: -1, c: c0, letter: 'a' }, { r: 0, c: c0, letter: 't' }], 'off-board'],
    ['two tiles on one square', empty, [{ r: r0, c: c0, letter: 'a' }, { r: r0, c: c0, letter: 't' }], 'same-square'],
    ['no tiles', empty, [], 'no-tiles'],
    ['capital letter', empty, [{ r: r0, c: c0, letter: 'A' }, { r: r0, c: c0 + 1, letter: 't' }], 'bad-letter'],
    ['blank as a letter', empty, lay('?cat', r0, c0), true],
    // CAT already across from the start
    ['add S to make CATS', withCat, lay('s', r0, c0 + 3), true],
    ['add a blank S to make CATS', withCat, lay('?s', r0, c0 + 3), true],
    ['CAB down from the C', withCat, lay('ab', r0 + 1, c0, 'down'), true],
    ['BAT down through the A', withCat, [{ r: r0 - 1, c: c0 + 1, letter: 'b' }, { r: r0 + 1, c: c0 + 1, letter: 't' }], true],
    ['NO under AT (cross words AN, TO)', withCat, lay('no', r0 + 1, c0 + 1), true],
    ['AT under CA: cross word CA is not a word', withCat, lay('at', r0 + 1, c0), 'not-a-word'],
    ['one tile making CATX', withCat, lay('x', r0, c0 + 3), 'not-a-word'],
    ['word not joined to the board', withCat, lay('dog', r0 + 3, c0), 'not-joined'],
    ['tile on a filled square', withCat, lay('cats', r0, c0), 'occupied'],
    ['gap below the C', withCat, [{ r: r0 + 1, c: c0, letter: 'a' }, { r: r0 + 3, c: c0, letter: 'b' }], 'gap'],
    ['L-shape next to CAT', withCat, [{ r: r0 + 1, c: c0, letter: 'a' }, { r: r0 + 2, c: c0 + 1, letter: 'b' }], 'not-in-line'],
  ];
}

for (const id of BOARD_IDS) {
  const board = boards[id];
  const list = cases(board);
  test(`${id}: ${list.length} hand-made moves`, async (t) => {
    assert.ok(list.length >= 20);
    for (const [name, cells, tiles, want] of list) {
      await t.test(name, () => {
        const res = checkMove(board, cells(), tiles, fullList);
        if (want === true) assert.equal(res.ok, true, res.message);
        else {
          assert.equal(res.ok, false);
          assert.equal(res.error, want, res.message);
          assert.ok(res.message.length > 0);
        }
      });
    }
  });
}

test('words found: main word first, then cross words', () => {
  const b = boards.standard;
  const res = checkMove(b, cellsWith(b, ['cat', 6, 6, 'across']), lay('no', 7, 7), fullList);
  assert.equal(res.ok, true);
  assert.equal(res.dir, 'across');
  assert.deepEqual(res.words.map((w) => [w.word, w.main]), [['no', true], ['an', false], ['to', false]]);
});

test('a single tile can make words both ways', () => {
  const b = boards.standard;
  // CAT across from (6,6), and an O at (7,9). An S at (6,9) makes CATS and SO.
  const cells = cellsWith(b, ['cat', 6, 6, 'across'], ['o', 7, 9, 'across']);
  const res = checkMove(b, cells, lay('s', 6, 9), fullList);
  assert.equal(res.ok, true);
  assert.deepEqual(res.words.map((w) => [w.word, w.main]), [['cats', true], ['so', false]]);
  // An O under the T makes only a down word: TO.
  const down = checkMove(b, cellsWith(b, ['cat', 6, 6, 'across']), lay('o', 7, 8), fullList);
  assert.equal(down.ok, true);
  assert.equal(down.dir, 'down');
  assert.deepEqual(down.words.map((w) => w.word), ['to']);
});

test('Large: the first word may touch just one of the four start squares', () => {
  const b = boards.large;
  const empty = emptyCells(b);
  assert.equal(checkMove(b, empty, lay('cat', 9, 10), fullList).ok, true);   // covers (9,10) only
  assert.equal(checkMove(b, empty, lay('cat', 10, 7), fullList).ok, true);   // ends on (10,9)
  assert.equal(checkMove(b, empty, lay('cat', 10, 9, 'down'), fullList).ok, true); // covers (10,9) only
  assert.equal(checkMove(b, empty, lay('cat', 9, 8), fullList).ok, true);    // covers two
  assert.equal(checkMove(b, empty, lay('cat', 9, 11), fullList).error, 'no-start'); // just right of the block
  assert.equal(checkMove(b, empty, lay('cat', 8, 9), fullList).error, 'no-start');  // just above the block
  assert.equal(checkMove(b, empty, lay('cat', 11, 8, 'down'), fullList).error, 'no-start');
});
