// Move finder for computer players and hints. Pure: no DOM, no clock of its
// own (the caller passes `now` for the time cap), so it runs the same in
// Node, in a Web Worker, and later on a server.
//
// The method is Appel and Jacobson's (1988): for every "anchor" (an empty
// square next to a tile, or a start square on an empty board) build the part
// of the word to its left from the rack, then extend it to the right along
// the word graph. Cross-checks say which letters may go on each square
// without making a bad word the other way. The graph's tier bits let the
// search skip words the player does not know (rarer lists) early.
//
// Every move found is checked again with rules.js and scored with score.js,
// so a move it returns is always one play() accepts.

import { LAST, TIER_SHIFT, REACH_SHIFT, CHILD_SHIFT } from './words.js';
import { checkMove } from './rules.js';
import { scoreMove } from './score.js';
import { isWord } from './words.js';
import { BLANK } from './bag.js';

const ALL = (1 << 26) - 1;
const CHECK_EVERY = 2048; // look at the clock every so many steps

// opts: {
//   board, cells, rack: ['a', '?', …], words: the word graph,
//   maxTier: highest tier of word allowed (levels.js listTier), maxLength?,
//   values: letter values (tiles.json), isStar?(word),
//   timeLimit?: ms, now?: () => ms   (both needed for the time cap)
// }
// Returns { moves, capped, steps, rejected }: moves best first, each
// { tiles: [{ r, c, letter, blank }], score: scoreMove(...) }.
// capped: the time cap was reached, so `moves` is the best found so far.
// rejected: candidates checkMove refused and were dropped (the tests expect 0).
export function findMoves(opts) {
  const { board, cells, rack, words, values } = opts;
  const maxTier = opts.maxTier;
  const maxLength = opts.maxLength || Infinity;
  const isStar = opts.isStar || (() => false);
  const n = board.size;
  const edges = words.edges;
  const deadline = opts.now && opts.timeLimit ? opts.now() + opts.timeLimit : Infinity;

  const counts = new Array(26).fill(0);
  let blanks = 0;
  for (const t of rack) {
    if (t === BLANK) blanks++;
    else counts[t.charCodeAt(0) - 97]++;
  }

  const code = new Int8Array(n * n).fill(-1);
  cells.forEach((cell, i) => { if (cell) code[i] = cell.letter.charCodeAt(0) - 97; });
  const empty = cells.every((cell) => cell === null);

  const check = (word) => isWord(word, words, maxTier, maxLength);
  const seen = new Set();
  const moves = [];
  let steps = 0;
  let capped = false;
  let rejected = 0;

  // Walk the graph from `node` through letter codes; -1 if there is no path.
  // Returns the last edge index.
  function walk(node, letters) {
    let e = -1;
    for (let k = 0; k < letters.length; k++) {
      if (k && !node) return -1;
      e = -1;
      for (let i = node; i < edges.length; i++) {
        if ((edges[i] & 31) === letters[k]) { e = i; break; }
        if (edges[i] & LAST) break;
      }
      if (e < 0) return -1;
      node = edges[e] >>> CHILD_SHIFT;
    }
    return e;
  }

  // Letters allowed on empty square i when the word across it runs along
  // (dr, dc). ALL when there are no tiles that way.
  function crossMask(r, c, dr, dc) {
    const before = [];
    const after = [];
    for (let rr = r - dr, cc = c - dc; rr >= 0 && cc >= 0 && code[rr * n + cc] >= 0; rr -= dr, cc -= dc) before.unshift(code[rr * n + cc]);
    for (let rr = r + dr, cc = c + dc; rr < n && cc < n && code[rr * n + cc] >= 0; rr += dr, cc += dc) after.push(code[rr * n + cc]);
    if (!before.length && !after.length) return ALL;
    if (before.length + 1 + after.length > maxLength) return 0;
    let node = 0;
    if (before.length) {
      const e = walk(0, before);
      if (e < 0) return 0;
      node = edges[e] >>> CHILD_SHIFT;
      if (!node) return 0;
    }
    let mask = 0;
    for (let i = node; i < edges.length; i++) {
      const e = edges[i];
      if (((e >>> REACH_SHIFT) & 7) <= maxTier) {
        if (!after.length) {
          if (((e >>> TIER_SHIFT) & 7) <= maxTier) mask |= 1 << (e & 31);
        } else {
          const child = e >>> CHILD_SHIFT;
          const last = child ? walk(child, after) : -1;
          if (last >= 0 && ((edges[last] >>> TIER_SHIFT) & 7) <= maxTier) mask |= 1 << (e & 31);
        }
      }
      if (e & LAST) break;
    }
    return mask;
  }

  const filledAt = (r, c) => r >= 0 && c >= 0 && r < n && c < n && code[r * n + c] >= 0;
  const anchor = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (code[i] >= 0) continue;
      if (empty ? board.start.has(i) : filledAt(r - 1, c) || filledAt(r + 1, c) || filledAt(r, c - 1) || filledAt(r, c + 1)) anchor[i] = 1;
    }
  }

  function record(tiles) {
    const key = tiles.map((t) => t.r * n + t.c + (t.blank ? '?' : '') + t.letter).sort().join(',');
    if (seen.has(key)) return;
    seen.add(key);
    const res = checkMove(board, cells, tiles, check);
    if (!res.ok) { rejected++; return; }
    moves.push({ tiles, score: scoreMove(board, values, res.words, tiles.length, isStar) });
  }

  // One direction: across (lines are rows) or down (lines are columns).
  for (const across of [true, false]) {
    if (capped) break;
    const at = across ? (line, pos) => line * n + pos : (line, pos) => pos * n + line;
    const rc = across ? (line, pos) => ({ r: line, c: pos }) : (line, pos) => ({ r: pos, c: line });
    // The cross word runs the other way.
    const mask = new Int32Array(n * n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (code[r * n + c] < 0) mask[r * n + c] = across ? crossMask(r, c, 1, 0) : crossMask(r, c, 0, 1);
      }
    }

    for (let line = 0; line < n && !capped; line++) {
      const left = []; // left-part tiles: { letter code, blank }
      const right = []; // tiles placed from the anchor on: { pos, code, blank }
      let anchorPos = 0;

      const tick = () => {
        if (++steps % CHECK_EVERY === 0 && opts.now() > deadline) capped = true;
        return capped;
      };

      const save = () => {
        const tiles = [];
        left.forEach((t, k) => tiles.push({ ...rc(line, anchorPos - left.length + k), letter: String.fromCharCode(97 + t.code), blank: t.blank }));
        for (const t of right) tiles.push({ ...rc(line, t.pos), letter: String.fromCharCode(97 + t.code), blank: t.blank });
        record(tiles);
      };

      // node: first edge of the current graph node (0 with len > 0: no more letters).
      // lastTier: tier of the word the letters so far make (7 = none).
      const extendRight = (node, pos, len, lastTier) => {
        if (deadline !== Infinity && tick()) return;
        const i = pos < n ? at(line, pos) : -1;
        if (i < 0 || code[i] < 0) {
          if (pos > anchorPos && lastTier <= maxTier && len >= 2) save();
          if (i < 0 || (len > 0 && !node) || len >= maxLength) return;
          const m = mask[i];
          if (!m) return;
          for (let k = node; k < edges.length; k++) {
            const e = edges[k];
            const L = e & 31;
            if ((m & (1 << L)) && ((e >>> REACH_SHIFT) & 7) <= maxTier) {
              const child = e >>> CHILD_SHIFT;
              const tier = (e >>> TIER_SHIFT) & 7;
              if (counts[L]) {
                counts[L]--; right.push({ pos, code: L, blank: false });
                extendRight(child, pos + 1, len + 1, tier);
                right.pop(); counts[L]++;
              }
              if (blanks) {
                blanks--; right.push({ pos, code: L, blank: true });
                extendRight(child, pos + 1, len + 1, tier);
                right.pop(); blanks++;
              }
            }
            if (e & LAST) break;
          }
        } else {
          if ((len > 0 && !node) || len >= maxLength) return;
          for (let k = node; k < edges.length; k++) {
            const e = edges[k];
            if ((e & 31) === code[i]) {
              if (((e >>> REACH_SHIFT) & 7) <= maxTier) extendRight(e >>> CHILD_SHIFT, pos + 1, len + 1, (e >>> TIER_SHIFT) & 7);
              return;
            }
            if (e & LAST) return;
          }
        }
      };

      // Left parts made only of rack tiles, on empty squares that are not anchors.
      const leftPart = (node, limit) => {
        extendRight(node, anchorPos, left.length, 7);
        if (!limit || capped || (left.length && !node) || left.length + 1 >= maxLength) return;
        for (let k = node; k < edges.length; k++) {
          const e = edges[k];
          const L = e & 31;
          if (((e >>> REACH_SHIFT) & 7) <= maxTier) {
            const child = e >>> CHILD_SHIFT;
            if (counts[L]) {
              counts[L]--; left.push({ code: L, blank: false });
              leftPart(child, limit - 1);
              left.pop(); counts[L]++;
            }
            if (blanks) {
              blanks--; left.push({ code: L, blank: true });
              leftPart(child, limit - 1);
              left.pop(); blanks++;
            }
          }
          if (e & LAST) break;
        }
      };

      for (let pos = 0; pos < n && !capped; pos++) {
        const i = at(line, pos);
        if (!anchor[i]) continue;
        anchorPos = pos;
        if (pos > 0 && code[at(line, pos - 1)] >= 0) {
          // The tiles already to the left are the start of the word.
          let start = pos - 1;
          while (start > 0 && code[at(line, start - 1)] >= 0) start--;
          const letters = [];
          for (let p = start; p < pos; p++) letters.push(code[at(line, p)]);
          if (letters.length >= maxLength) continue;
          const e = walk(0, letters);
          if (e < 0 || ((edges[e] >>> REACH_SHIFT) & 7) > maxTier) continue;
          const node = edges[e] >>> CHILD_SHIFT;
          if (node) extendRight(node, pos, letters.length, 7);
        } else {
          let limit = 0;
          for (let p = pos - 1; p >= 0 && code[at(line, p)] < 0 && !anchor[at(line, p)]; p--) limit++;
          leftPart(0, Math.min(limit, rack.length - 1));
        }
      }
    }
  }

  moves.sort((a, b) => b.score.total - a.score.total);
  return { moves, capped, steps, rejected };
}
