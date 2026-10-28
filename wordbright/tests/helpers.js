// Shared test set-up: reads the built data from wordbright/site/data/.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadBoard, emptyCells } from '../site/js/engine/board.js';
import { loadWordGraph, isWord } from '../site/js/engine/words.js';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const DATA = fileURLToPath(new URL('../site/data/', import.meta.url));
export const BOARD_IDS = ['junior', 'standard', 'large'];
export const LIST_IDS = ['starter', 'steady', 'full', 'large', 'xlarge'];

const json = (name) => JSON.parse(readFileSync(DATA + name, 'utf8'));

export const tiles = json('tiles.json');
export const starWords = json('star_words.json');
export const boards = Object.fromEntries(BOARD_IDS.map((id) => [id, loadBoard(json(`board_${id}.json`))]));
export const graphs = Object.fromEntries(LIST_IDS.map((id) => [id, loadWordGraph(readFileSync(DATA + `words_${id}.dawg`))]));

export function env(boardId) {
  return { board: boards[boardId], tiles, starWords, graphs };
}

export const fullList = (w) => isWord(w, graphs.full);

// Tiles for a word laid from (r, c). "?" before a letter makes it a blank.
export function lay(word, r, c, dir = 'across') {
  const out = [];
  let k = 0;
  for (let i = 0; i < word.length; i++) {
    const blank = word[i] === '?';
    if (blank) i++;
    out.push({ r: dir === 'down' ? r + k : r, c: dir === 'down' ? c : c + k, letter: word[i], blank });
    k++;
  }
  return out;
}

// Cells with words already on the board: [[word, r, c, dir], …].
export function cellsWith(board, ...words) {
  const cells = emptyCells(board);
  for (const [word, r, c, dir] of words) {
    for (const t of lay(word, r, c, dir)) cells[t.r * board.size + t.c] = { letter: t.letter, blank: t.blank };
  }
  return cells;
}

// The first start square (row, column), read from the board.
export function anchor(board) {
  const i = Math.min(...board.start);
  return [Math.floor(i / board.size), i % board.size];
}
