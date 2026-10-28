// Loads the game data. Word graphs are big, so only the list a game needs is
// fetched, and each one only once.
import { loadBoard } from './engine/board.js';
import { loadWordGraph } from './engine/words.js';

export const BOARD_IDS = ['junior', 'standard', 'large'];

// Expected length for 2–4 children, pass-and-play (wordbright-design/board/F3_examples.md).
export const BOARD_MINUTES = { junior: 20, standard: 36, large: 68 };

const cache = new Map();

function once(key, load) {
  if (!cache.has(key)) cache.set(key, load().catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key);
}

async function fetchOk(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(path + ': ' + r.status);
  return r;
}

const json = (path) => once(path, () => fetchOk(path).then((r) => r.json()));

export const boardJson = (id) => json('data/board_' + id + '.json');
export const board = (id) => once('board:' + id, () => boardJson(id).then(loadBoard));
export const tiles = () => json('data/tiles.json');
export const starWords = () => json('data/star_words.json');
export const wordGraph = (list) => once('graph:' + list, () => fetchOk('data/words_' + list + '.dawg').then((r) => r.arrayBuffer()).then(loadWordGraph));

// Everything the engine needs for one game: the board, tiles, Star words and
// the word lists in `lists` (by name, e.g. ['full']).
export async function gameEnv(boardId, lists) {
  const [b, t, s, graphs] = await Promise.all([
    board(boardId), tiles(), starWords(),
    Promise.all(lists.map(wordGraph)),
  ]);
  return { board: b, tiles: t, starWords: s, graphs: Object.fromEntries(lists.map((l, i) => [l, graphs[i]])) };
}
