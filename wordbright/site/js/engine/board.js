// A board, read from board_<id>.json. The size always comes from the file.
// Squares are numbered r * size + c (row and column from 0).
//
// Grid characters: "." plain, "*" start square, anything else a key of
// `squares` (S Spark, G Glow, H Shine, T Star in the shipped boards).

export function loadBoard(json) {
  const size = json.size;
  if (!Number.isInteger(size) || size < 2) throw new Error('Board size missing');
  if (!Array.isArray(json.grid) || json.grid.length !== size || json.grid.some((row) => row.length !== size)) {
    throw new Error(`Board ${json.id}: grid is not ${size} by ${size}`);
  }
  const plain = { name: '', letter: 1, word: 1 };
  const bonus = [];
  const starMarks = new Set();
  json.grid.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === '.') bonus.push(plain);
      else if (ch === '*') { bonus.push(plain); starMarks.add(r * size + c); }
      else if (json.squares && json.squares[ch]) bonus.push(json.squares[ch]);
      else throw new Error(`Board ${json.id}: unknown square "${ch}" at row ${r}, column ${c}`);
    });
  });
  const start = new Set((json.start || []).map(([r, c]) => {
    if (r < 0 || c < 0 || r >= size || c >= size) throw new Error(`Board ${json.id}: start square off the board`);
    return r * size + c;
  }));
  if (!start.size) throw new Error(`Board ${json.id}: no start square`);
  if (start.size !== starMarks.size || [...start].some((i) => !starMarks.has(i))) {
    throw new Error(`Board ${json.id}: start squares and "*" in the grid do not match`);
  }
  return { id: json.id, title: json.title, size, start, bonus };
}

export function onBoard(board, r, c) {
  return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0 && r < board.size && c < board.size;
}

export function isStart(board, r, c) {
  return onBoard(board, r, c) && board.start.has(r * board.size + c);
}

// { name, letter, word } multipliers for a square ({ '', 1, 1 } if plain).
export function squareAt(board, r, c) {
  return board.bonus[r * board.size + c];
}

// An empty board for the game state: one entry per square, null or
// { letter, blank } (blank: true when a blank tile stands for that letter).
export function emptyCells(board) {
  return new Array(board.size * board.size).fill(null);
}
