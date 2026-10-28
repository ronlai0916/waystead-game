// Bot-vs-bot games for Wordbright's computer players (C3).
//
//   node tools/wordbright-bots.mjs                 # the full run (C3 report)
//   node tools/wordbright-bots.mjs --games 20      # quicker: 20 games per pair and board
//   node tools/wordbright-bots.mjs --level year-3  # word level for every bot (default year-5)
//
// Per board, three pairs play seeded games (Easy v Hard, Normal v Crazy, and
// Hard v Crazy head to head, since the first two pairs face different
// opponents), with the first turn alternating. Junior and Standard: 200 games
// per pair; Large: 50. Prints mean score per strength, win rate, move times, how often
// the time cap was hit, and crashes or illegal moves (both must be 0).
// Uses the same engine, move finder and time caps as the game.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadBoard } from '../wordbright/site/js/engine/board.js';
import { loadWordGraph } from '../wordbright/site/js/engine/words.js';
import { newGame, act } from '../wordbright/site/js/engine/game.js';
import { computerTurn, timeLimit } from '../wordbright/site/js/ai/computer.js';

const DATA = fileURLToPath(new URL('../wordbright/site/data/', import.meta.url));
const json = (name) => JSON.parse(readFileSync(DATA + name, 'utf8'));
const tiles = json('tiles.json');
const starWords = json('star_words.json');
const words = loadWordGraph(readFileSync(DATA + 'words_all.dawg'));

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};
const LEVEL = arg('level', 'year-5');
const GAMES = arg('games', null);
const PLAN = [
  ['junior', GAMES ? Number(GAMES) : 200],
  ['standard', GAMES ? Number(GAMES) : 200],
  ['large', GAMES ? Math.max(1, Math.round(Number(GAMES) / 4)) : 50],
];
const PAIRS = [['easy', 'hard'], ['normal', 'crazy'], ['hard', 'crazy']];
const NAMES = { easy: 'Easy', normal: 'Normal', hard: 'Hard', crazy: 'Crazy' };
const now = () => performance.now();

function playGame(boardId, env, a, b, seed) {
  const first = seed % 2 === 0 ? [a, b] : [b, a];
  const players = first.map((strength) => ({ name: NAMES[strength], computer: true, strength }));
  let s = newGame({ board: boardId, seed, level: LEVEL, players }, env);
  const out = { times: [], capped: 0, illegal: 0, swaps: 0 };
  for (let turns = 0; !s.over; turns++) {
    if (turns > 2000) throw new Error('game did not end');
    const t0 = now();
    const res = computerTurn(s, env, { now, timeLimit: timeLimit(boardId) });
    out.times.push(now() - t0);
    if (res.capped) out.capped++;
    if (res.action.type === 'swap') out.swaps++;
    const next = act(s, res.action, env);
    if (!next.ok) { out.illegal++; s = act(s, { type: 'pass' }, env).state; continue; }
    s = next.state;
  }
  out.scores = Object.fromEntries(first.map((strength, i) => [strength, s.players[i].score]));
  out.winners = s.result.winners.map((i) => first[i]);
  return out;
}

const pad = (v, n) => String(v).padStart(n);
console.log(`Word level ${LEVEL}. Times are per computer move (move finder + choice), without the screen's pause.\n`);
console.log('| Board | Pair | Games | Mean score | Wins (draws) | Mean move | Slowest move | Cap hit | Swaps | Crashes | Illegal |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
const byStrength = {};
for (const [boardId, games] of PLAN) {
  const env = { board: loadBoard(json(`board_${boardId}.json`)), tiles, starWords, words };
  for (const [a, b] of PAIRS) {
    const sum = { [a]: 0, [b]: 0 };
    const wins = { [a]: 0, [b]: 0 };
    let draws = 0;
    let times = [];
    let capped = 0;
    let illegal = 0;
    let crashes = 0;
    let swaps = 0;
    for (let g = 0; g < games; g++) {
      const seed = 1000 + g;
      try {
        const r = playGame(boardId, env, a, b, seed);
        sum[a] += r.scores[a];
        sum[b] += r.scores[b];
        if (r.winners.length > 1) draws++; else wins[r.winners[0]]++;
        times = times.concat(r.times);
        capped += r.capped;
        illegal += r.illegal;
        swaps += r.swaps;
      } catch (err) {
        crashes++;
        console.error(`${boardId} ${a} v ${b} seed ${seed}: ${err.stack}`);
      }
    }
    const done = games - crashes;
    for (const k of [a, b]) {
      byStrength[k] = byStrength[k] || {};
      const t = byStrength[k][boardId] || { sum: 0, games: 0 };
      byStrength[k][boardId] = { sum: t.sum + sum[k], games: t.games + done };
    }
    const mean = times.reduce((x, y) => x + y, 0) / times.length;
    console.log(`| ${boardId} | ${NAMES[a]} v ${NAMES[b]} | ${games} | ${(sum[a] / done).toFixed(0)} v ${(sum[b] / done).toFixed(0)}`
      + ` | ${wins[a]} v ${wins[b]} (${draws}) | ${mean.toFixed(1)} ms | ${Math.max(...times).toFixed(0)} ms`
      + ` | ${capped} of ${times.length} | ${swaps} | ${crashes} | ${illegal} |`);
  }
}

console.log('\nMean score per strength, over all its games on that board (opponents differ, so the Hard v Crazy row above is the fairer comparison of those two):');
console.log('| Strength | ' + PLAN.map(([b]) => b).join(' | ') + ' |');
console.log('|---|' + PLAN.map(() => '---|').join(''));
for (const k of ['easy', 'normal', 'hard', 'crazy']) {
  console.log(`| ${NAMES[k]} | ` + PLAN.map(([b]) => pad((byStrength[k][b].sum / byStrength[k][b].games).toFixed(0), 4)).join(' | ') + ' |');
}
