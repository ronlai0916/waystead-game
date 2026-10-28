// Brute force for the move-finder tests: tries every way to lay the rack's
// tiles in a line and keeps what checkMove accepts. Slow, so small racks only.
import { checkMove } from '../site/js/engine/rules.js';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export function moveKey(tiles, n) {
  return tiles.map((t) => t.r * n + t.c + (t.blank ? '?' : '') + t.letter).sort().join(',');
}

// Every distinct ordering of k tiles from the rack (a multiset).
function orderings(rack, k) {
  const out = [];
  const used = new Array(rack.length).fill(false);
  const pick = [];
  const go = () => {
    if (pick.length === k) { out.push(pick.slice()); return; }
    const tried = new Set();
    rack.forEach((t, i) => {
      if (used[i] || tried.has(t)) return;
      tried.add(t); used[i] = true; pick.push(t); go(); pick.pop(); used[i] = false;
    });
  };
  go();
  return out;
}

// Expand blanks ("?") into every letter.
function lettered(order) {
  let all = [[]];
  for (const t of order) {
    const next = [];
    for (const prev of all) {
      if (t === '?') for (const l of LETTERS) next.push([...prev, { letter: l, blank: true }]);
      else next.push([...prev, { letter: t, blank: false }]);
    }
    all = next;
  }
  return all;
}

export function allMoves(board, cells, rack, isWord) {
  const n = board.size;
  const found = new Map();
  const perK = [];
  for (let k = 1; k <= rack.length; k++) perK[k] = orderings(rack, k).flatMap(lettered);
  for (const [dr, dc] of [[0, 1], [1, 0]]) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (cells[r * n + c]) continue;
        // The empty squares from (r, c) on, along the line.
        const squares = [];
        for (let rr = r, cc = c; rr < n && cc < n; rr += dr, cc += dc) if (!cells[rr * n + cc]) squares.push([rr, cc]);
        for (let k = 1; k <= Math.min(rack.length, squares.length); k++) {
          for (const tiles of perK[k]) {
            const placed = tiles.map((t, j) => ({ r: squares[j][0], c: squares[j][1], letter: t.letter, blank: t.blank }));
            const key = moveKey(placed, n);
            if (found.has(key)) continue;
            if (checkMove(board, cells, placed, isWord).ok) found.set(key, placed);
          }
        }
      }
    }
  }
  return found;
}
