// Is a move allowed? Pure: takes the board, the cells (game state) and the
// tiles placed this turn, and says which words the move makes.
//
// A placement is { r, c, letter, blank }: letter "a"–"z"; blank true when a
// blank tile stands for that letter. isWord(word) is the player's word check.
//
// Result: { ok: true, dir, words } or { ok: false, error, message, word? }.
// Each word is { word, main, squares: [{ r, c, letter, blank, placed }] }.
// `message` is a kind hint for the child.

import { onBoard, isStart } from './board.js';

const HINTS = {
  'no-tiles': 'Put at least one tile on the board.',
  'bad-letter': 'Each tile needs a letter from a to z.',
  'off-board': 'That tile is off the board.',
  'same-square': 'Two tiles are on the same square.',
  'occupied': 'That square already has a tile.',
  'not-in-line': 'Put your tiles in one straight line, across or down.',
  'gap': 'Your tiles need to touch, with no gaps.',
  'no-start': 'The first word must cover the start square.',
  'not-joined': 'Your word must join a word on the board.',
  'too-short': 'Make a word of at least two letters.',
  'not-a-word': 'is not in our word list. Try another word.',
};

function fail(error, word) {
  const message = word ? `"${word.toUpperCase()}" ${HINTS[error]}` : HINTS[error];
  return word ? { ok: false, error, message, word } : { ok: false, error, message };
}

function boardIsEmpty(cells) {
  return cells.every((cell) => cell === null);
}

// The run of tiles through (r, c) in direction (dr, dc), with this turn's
// tiles laid on top of the board.
function runThrough(board, cells, placed, r, c, dr, dc) {
  const at = (rr, cc) => {
    if (!onBoard(board, rr, cc)) return null;
    const p = placed.get(rr * board.size + cc);
    if (p) return { r: rr, c: cc, letter: p.letter, blank: !!p.blank, placed: true };
    const cell = cells[rr * board.size + cc];
    return cell ? { r: rr, c: cc, letter: cell.letter, blank: !!cell.blank, placed: false } : null;
  };
  let sr = r;
  let sc = c;
  while (at(sr - dr, sc - dc)) { sr -= dr; sc -= dc; }
  const squares = [];
  for (let sq = at(sr, sc); sq; sq = at(sq.r + dr, sq.c + dc)) squares.push(sq);
  return squares;
}

export function checkMove(board, cells, placements, isWord) {
  if (!Array.isArray(placements) || placements.length === 0) return fail('no-tiles');
  const placed = new Map();
  for (const p of placements) {
    if (typeof p.letter !== 'string' || !/^[a-z]$/.test(p.letter)) return fail('bad-letter');
    if (!onBoard(board, p.r, p.c)) return fail('off-board');
    const i = p.r * board.size + p.c;
    if (placed.has(i)) return fail('same-square');
    if (cells[i]) return fail('occupied');
    placed.set(i, p);
  }

  const rows = new Set(placements.map((p) => p.r));
  const cols = new Set(placements.map((p) => p.c));
  let dir;
  if (placements.length === 1) dir = null;
  else if (rows.size === 1) dir = 'across';
  else if (cols.size === 1) dir = 'down';
  else return fail('not-in-line');

  // No gaps: every square between the first and last tile is filled.
  if (dir) {
    const [dr, dc] = dir === 'across' ? [0, 1] : [1, 0];
    const first = placements.reduce((a, p) => (p.r * dr + p.c * dc < a.r * dr + a.c * dc ? p : a));
    const run = runThrough(board, cells, placed, first.r, first.c, dr, dc);
    if (!placements.every((p) => run.some((sq) => sq.r === p.r && sq.c === p.c))) return fail('gap');
  }

  // Main word along the line, then one cross word per tile (if 2+ letters).
  // A single tile's main word is across if it makes one, otherwise down.
  const p0 = placements[0];
  const words = [];
  const add = (squares, main) => {
    if (squares.length >= 2) words.push({ word: squares.map((s) => s.letter).join(''), main, squares });
  };
  if (dir) {
    const [dr, dc] = dir === 'across' ? [0, 1] : [1, 0];
    add(runThrough(board, cells, placed, p0.r, p0.c, dr, dc), true);
    for (const p of placements) add(runThrough(board, cells, placed, p.r, p.c, dc, dr), false);
  } else {
    const across = runThrough(board, cells, placed, p0.r, p0.c, 0, 1);
    const down = runThrough(board, cells, placed, p0.r, p0.c, 1, 0);
    dir = across.length >= 2 || down.length < 2 ? 'across' : 'down';
    if (dir === 'across') { add(across, true); add(down, false); } else { add(down, true); }
  }

  if (boardIsEmpty(cells)) {
    if (!placements.some((p) => isStart(board, p.r, p.c))) return fail('no-start');
    if (placements.length < 2) return fail('too-short');
  } else if (!words.some((w) => w.squares.some((s) => !s.placed))) {
    return fail('not-joined');
  }

  for (const w of words) if (!isWord(w.word)) return fail('not-a-word', w.word);
  return { ok: true, dir, words };
}
