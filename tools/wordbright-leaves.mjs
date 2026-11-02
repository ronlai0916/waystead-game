// Rack-leave values for Wordbright's Crazy computer player (G7), learned from
// self-play with our own tile bags, boards and word lists (no outside data).
//
//   node tools/wordbright-leaves.mjs                 # all boards (a few minutes, all cores)
//   node tools/wordbright-leaves.mjs --games 200     # quicker, rougher table
//
// How: Hard plays Hard in seeded games at a mix of word levels. At each turn
// with a full bag behind it, we take the mover's rack, keep a random handful
// of its tiles (the "leave"), draw the rest from the tiles the mover cannot
// see (bag + other racks), and record the best score the move finder finds
// on that board. A ridge regression over the leave's letters, doubles,
// triples, letter pairs and vowel/consonant mix then says how many points
// each part of a leave is worth next turn, against drawing fresh tiles.
// Writes wordbright/site/data/leaves.json (one table per board).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { loadBoard } from '../wordbright/site/js/engine/board.js';
import { loadWordGraph } from '../wordbright/site/js/engine/words.js';
import { newGame, act, starCheck } from '../wordbright/site/js/engine/game.js';
import { computerList, listTier } from '../wordbright/site/js/engine/levels.js';
import { findMoves } from '../wordbright/site/js/engine/movegen.js';
import { rng, tilesLeft, BLANK } from '../wordbright/site/js/engine/bag.js';
import { RACK_SIZE } from '../wordbright/site/js/engine/score.js';
import { leaveFeatures, LEAVE_LETTERS } from '../wordbright/site/js/ai/leave.js';

const DATA = fileURLToPath(new URL('../wordbright/site/data/', import.meta.url));
const json = (name) => JSON.parse(readFileSync(DATA + name, 'utf8'));
const BOARDS = ['junior', 'standard', 'large'];
// A spread of word levels (bands A, B, C, E, G, I), so one table fits them all.
const LEVELS = ['year-1', 'year-3', 'year-5', 'year-6', 'year-10', 'degree', 'doctor'];
const SAMPLES_PER_TURN = 4;

if (!isMainThread) {
  const { boardId, from, to } = workerData;
  const tiles = json('tiles.json');
  const env = { board: loadBoard(json(`board_${boardId}.json`)), tiles, starWords: json('star_words.json'), words: loadWordGraph(readFileSync(DATA + 'words_all.dawg')) };
  const out = [];
  for (let seed = from; seed < to; seed++) {
    const level = LEVELS[seed % LEVELS.length];
    const players = [0, 1].map((i) => ({ name: 'Hard ' + i, computer: true, strength: 'hard' }));
    let s = newGame({ board: boardId, seed, level, players }, env);
    const random = rng(seed * 7919 + 13);
    const { list, maxLength } = computerList(level);
    const maxTier = listTier(list);
    for (let turns = 0; !s.over && turns < 400; turns++) {
      const me = s.players[s.turn];
      const found = findMoves({ board: env.board, cells: s.cells, rack: me.rack, words: env.words, maxTier, maxLength, values: tiles.values, isStar: starCheck(me, env) });
      if (tilesLeft(s.bag) >= RACK_SIZE && me.rack.length === RACK_SIZE) {
        // How open the board is: the best score with the mover's own rack.
        const open = found.moves.length ? found.moves[0].score.total : 0;
        const unseen = s.bag.order.slice(s.bag.pos).concat(...s.players.filter((p) => p !== me).map((p) => p.rack));
        for (let k = 0; k < SAMPLES_PER_TURN; k++) {
          const keepN = Math.floor(random() * RACK_SIZE); // 0–6 tiles kept
          const rack = me.rack.slice();
          for (let i = rack.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [rack[i], rack[j]] = [rack[j], rack[i]]; }
          const keep = rack.slice(0, keepN);
          const pool = unseen.slice();
          const next = keep.slice();
          while (next.length < RACK_SIZE && pool.length) next.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
          const best = findMoves({ board: env.board, cells: s.cells, rack: next, words: env.words, maxTier, maxLength, values: tiles.values, isStar: starCheck(me, env) });
          out.push([keep.sort().join(''), best.moves.length ? best.moves[0].score.total : 0, open]);
        }
      }
      const move = found.moves[0];
      const action = move ? { type: 'play', tiles: move.tiles } : (tilesLeft(s.bag) >= RACK_SIZE ? { type: 'swap', tiles: me.rack.slice() } : { type: 'pass' });
      s = act(s, action, env).state;
    }
  }
  parentPort.postMessage(out);
} else {
  const args = process.argv.slice(2);
  const arg = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };
  const GAMES = { junior: 6000, standard: 4000, large: 1500 };
  if (arg('games')) for (const b of BOARDS) GAMES[b] = Number(arg('games'));
  const threads = availableParallelism();

  const gather = (boardId) => {
    const games = GAMES[boardId];
    const per = Math.ceil(games / threads);
    const jobs = [];
    for (let t = 0; t < threads; t++) {
      const from = 50000 + t * per;
      const to = 50000 + Math.min(games, (t + 1) * per);
      if (from >= to) continue;
      jobs.push(new Promise((resolve, reject) => {
        const w = new Worker(fileURLToPath(import.meta.url), { workerData: { boardId, from, to } });
        w.on('message', resolve);
        w.on('error', reject);
      }));
    }
    return Promise.all(jobs).then((parts) => parts.flat());
  };

  // Ridge regression: minimise |Xw - y|² + λ|w|² (the intercept is not shrunk).
  // Column 1 is how open the board was (a number, not 0/1): it soaks up
  // much of the noise and is not part of the table.
  function fit(samples) {
    const names = new Map();
    const rows = samples.map(([leave]) => leaveFeatures(leave.split('')).map((f) => {
      if (!names.has(f)) names.set(f, names.size + 2);
      return names.get(f);
    }));
    const n = names.size + 2; // 0 is the intercept, 1 the openness
    const A = Array.from({ length: n }, () => new Float64Array(n));
    const b = new Float64Array(n);
    samples.forEach(([, y, open], k) => {
      const idx = [0, 1, ...rows[k]];
      const val = [1, open, ...rows[k].map(() => 1)];
      for (let p = 0; p < idx.length; p++) {
        b[idx[p]] += val[p] * y;
        for (let q = 0; q < idx.length; q++) A[idx[p]][idx[q]] += val[p] * val[q];
      }
    });
    const lambda = 20;
    for (let i = 2; i < n; i++) A[i][i] += lambda;
    // Solve A w = b (A is symmetric positive definite): Gaussian elimination.
    for (let c = 0; c < n; c++) {
      const p = A[c][c];
      for (let r = c + 1; r < n; r++) {
        const f = A[r][c] / p;
        if (!f) continue;
        for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    const w = new Float64Array(n);
    for (let r = n - 1; r >= 0; r--) {
      let sum = b[r];
      for (let k = r + 1; k < n; k++) sum -= A[r][k] * w[k];
      w[r] = sum / A[r][r];
    }
    const table = {};
    for (const [f, i] of names) table[f] = Math.round(w[i] * 10) / 10;
    // Make the empty leave worth 0: everything is against drawing a fresh rack.
    const base = table['vc0-0'] || 0;
    for (const f of Object.keys(table)) if (f.startsWith('vc')) table[f] = Math.round((table[f] - base) * 10) / 10;
    for (const f of Object.keys(table)) if (table[f] === 0) delete table[f];
    return { intercept: Math.round((w[0] + base) * 10) / 10, openness: Math.round(w[1] * 100) / 100, table };
  }

  const out = { about: 'Rack-leave values for the Crazy computer player, from self-play (tools/wordbright-leaves.mjs). Built, do not edit.', letters: LEAVE_LETTERS };
  for (const boardId of BOARDS) {
    const t0 = Date.now();
    const samples = await gather(boardId);
    const { intercept, openness, table } = fit(samples);
    out[boardId] = table;
    const show = (k) => (table[k] ?? 0).toFixed(1);
    console.log(`${boardId}: ${GAMES[boardId]} games, ${samples.length} samples, ${((Date.now() - t0) / 1000).toFixed(0)} s; fresh rack scores ${intercept} + ${openness} × openness`);
    console.log('  singles: ' + LEAVE_LETTERS.map((l) => `${l} ${show('1' + l)}`).join(', '));
  }
  writeFileSync(DATA + 'leaves.json', JSON.stringify(out) + '\n');
  console.log('Wrote wordbright/site/data/leaves.json');
}
