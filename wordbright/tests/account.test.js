// Wordbright and the Waystead account (B4b): signed out, today's keys exactly;
// signed in, the player's saved game, choices (word levels) and finished-game
// results (player-data.js), merged without losing a result, trimmed before
// the size cap, imported once; G6.
// Run: node --test wordbright/tests/
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { memoryStorage, fakeAccount, manualTimers, CHILD_A, KID_A, KID_B } from '../../shared/tests/fake-account.js';

globalThis.localStorage = memoryStorage();
const S = await import('../site/js/store.js');
const D = await import('../site/js/player-data.js');
const { needsSignIn } = await import('../site/js/gate.js');
const { createApi } = await import('../site/js/account/api.js');
const { createSync } = await import('../site/js/account/sync.js');

const A = KID_A.id;
const B = KID_B.id;
beforeEach(() => { localStorage.clear(); S.usePlayer(null); });

// A finished (or running) game state, as the engine saves it.
function game(seed, { over = true, scores = [120, 90], names = ['Sam', 'Ottie'], winners = [0], hintsLeft = 1 } = {}) {
  return {
    version: 1, config: { board: 'junior', seed }, board: 'junior',
    players: names.map((name, i) => (i === 0
      ? { name, level: 'year-4', computer: false, score: scores[i], hints: hintsLeft, rack: [] }
      : { name, level: 'year-4', computer: true, strength: 'normal', score: scores[i], hints: 0, rack: [] })),
    turn: 0, over, result: over ? { winners, penalties: [0, 0], reason: 'out' } : null, history: [],
  };
}
const SETUP = { board: 'junior', helper: true, level: 'year-4', seats: [{ type: 'child', name: 'Sam', level: 'year-4' }] };

test('signed out: exactly today\'s keys and shapes (wb.game, wb.setup); no results are kept', () => {
  S.saveSetup(SETUP);
  S.saveGame(game(7));
  assert.deepEqual(localStorage.keys().sort(), ['wb.game', 'wb.setup']);
  assert.deepEqual(JSON.parse(localStorage.getItem('wb.setup')), SETUP);
  assert.equal(S.savedGame().state.config.seed, 7);
  assert.equal(S.playerStats(), null);
});

test('signed in: the player\'s own keys; a finished game is one result, however often it is saved', () => {
  S.saveGame(game(1, { over: false }));
  const device = localStorage.getItem('wb.game');
  const sent = [];
  S.usePlayer(A, (k) => sent.push(k), 'Sam');
  assert.equal(S.savedGame(), null, 'a new player has no saved game');
  S.saveSetup(SETUP);
  S.saveGame(game(5, { over: false }));
  S.saveGame(game(5));
  S.saveGame(game(5)); // the end screen saving again
  assert.equal(localStorage.getItem('wb.game'), device, 'the device\'s own game is untouched');
  assert.deepEqual(S.lastSetup(), SETUP);
  assert.deepEqual(sent, ['setup', 'game', 'game', 'stats', 'game']);
  assert.deepEqual(S.playerStats(), { games: 1, wins: 1, best: 120 });
  const r = S.readValue(D.STATS).results[0];
  assert.equal(r.me, 0);
  assert.equal(r.players[0].hints, 2, 'hints used: 3 - 1 left');
  assert.equal(r.players[1].computer, 'normal');
});

test('two players on one device: their saved games, choices and results never mix', () => {
  S.usePlayer(A, null, 'Sam');
  S.saveGame(game(10));
  S.saveSetup(SETUP);
  S.usePlayer(B, null, 'Robin');
  assert.equal(S.savedGame(), null);
  assert.equal(S.lastSetup(), null);
  assert.deepEqual(S.playerStats(), { games: 0, wins: 0, best: 0 });
  S.saveGame(game(11, { names: ['Robin', 'Pip'], winners: [1] }));
  S.usePlayer(A, null, 'Sam');
  assert.equal(S.savedGame().state.config.seed, 10);
  assert.deepEqual(S.playerStats(), { games: 1, wins: 1, best: 120 });
});

test('which seat is the player: their name, else the only child seat, else none', () => {
  const kid = (name) => ({ name, computer: false });
  const bot = { name: 'Pip', computer: true };
  assert.equal(D.mySeat([bot, kid('Sam')], 'sam'), 1);
  assert.equal(D.mySeat([kid('Ali'), bot], 'Sam'), 0, 'the only child');
  assert.equal(D.mySeat([kid('Ali'), kid('Jo')], 'Sam'), null, 'two other children: not counted as a win or loss');
});

// ---- merge rules ------------------------------------------------------------------
const at = (iso) => ({ savedAt: iso });

test('merge: the saved game and the choices: the newest wins (a tie keeps this device\'s)', () => {
  const older = { state: game(1, { over: false }), ...at('2026-11-01T10:00:00Z') };
  const newer = { state: game(2, { over: false }), ...at('2026-11-02T10:00:00Z') };
  assert.equal(D.mergeNewest(older, newer), newer);
  assert.equal(D.mergeNewest(newer, older), newer);
  const tie = { ...newer, state: game(3, { over: false }) };
  assert.equal(D.mergeNewest(tie, newer), tie);
  assert.equal(D.mergeNewest(undefined, older), older);
});

test('merge: finished games are a union by id; games, wins and best are counted, never added', () => {
  let here = D.emptyStats();
  let there = D.emptyStats();
  here = D.recordResult(here, game(1), 1000, 'Sam');
  there = D.recordResult(there, game(1), 1000, 'Sam'); // the same game, seen on both
  here = D.recordResult(here, game(2, { winners: [1], scores: [60, 80] }), 2000, 'Sam');
  there = D.recordResult(there, game(3, { scores: [150, 20] }), 3000, 'Sam');
  const m = D.mergeStats(here, there);
  assert.deepEqual(m.results.map((r) => r.id), ['junior-1', 'junior-2', 'junior-3']);
  assert.deepEqual(D.summary(m), { games: 3, wins: 2, best: 150 });
  assert.deepEqual(D.mergeStats(m, here), m, 'merging again changes nothing');
});

test('size cap: past 48 KB the oldest results fold into one total until under 40 KB; games and wins kept', () => {
  let s = D.emptyStats();
  for (let i = 0; i < 400; i++) {
    s = D.recordResult(s, game(i, { names: ['Sam', 'Ottie', 'Bramble', 'Fizz'], scores: [100 + (i % 50), 90, 80, 70], winners: [i % 3 === 0 ? 0 : 1] }), 1000 + i, 'Sam');
  }
  assert.ok(D.sizeOf(s) > D.TRIM_AT, D.sizeOf(s) + ' bytes');
  const before = D.summary(s);
  const t = D.trimStats(s);
  assert.ok(D.sizeOf(t) <= D.TRIM_TO);
  assert.deepEqual(D.summary(t), before);
  assert.deepEqual(D.summary(D.mergeStats(t, s)), before, 'an untrimmed copy elsewhere is not counted twice');
  assert.deepEqual(D.recordResult(t, game(3), 1003, 'Sam'), t, 'a folded game saved again is not a new result');
});

test('import: the device\'s game and choices; a finished one becomes a result; the player\'s own choices win', () => {
  const add = D.fromDevice({ state: game(9), savedAt: '2026-11-01T09:00:00Z' }, SETUP, 'Sam', Date.now());
  assert.deepEqual(D.summary(add.stats), { games: 1, wins: 1, best: 120 });
  const mine = { setup: { ...SETUP, board: 'large' }, savedAt: '2026-10-01T00:00:00Z' };
  assert.equal(D.mergeNewest(mine, add.setup).setup.board, 'large');
  assert.deepEqual(D.fromDevice(null, null, 'Sam', 1), {});
});

// ---- a finished game reaches the account ----------------------------------------
test('a finished Wordbright game saves to the account (fake API), with the result merged on 409', async () => {
  const acct = fakeAccount();
  acct.who = CHILD_A;
  const timers = manualTimers();
  const api = createApi({ origin: 'https://account.waystead.co.uk', fetch: acct.fetch });
  const value = (key, merge, prepare) => ({ read: () => S.readValue(key, A), write: (v) => S.writeValue(key, v, A), merge, ...(prepare ? { prepare } : {}) });
  const sync = createSync({
    api, game: 'wordbright', storage: localStorage, playerId: A, setTimer: timers.setTimer, clearTimer: timers.clearTimer,
    docs: { game: value('game', D.mergeNewest), setup: value('setup', D.mergeNewest), stats: value('stats', D.mergeStats, D.trimStats) },
  });
  S.usePlayer(A, (k) => sync.changed(k), 'Sam');
  // Another device finished a game meanwhile.
  acct.put(A, 'wordbright', 'stats', D.recordResult(D.emptyStats(), game(100, { scores: [200, 10] }), 500, 'Sam'));
  S.saveGame(game(101));
  await timers.run();
  const stats = acct.get(A, 'wordbright', 'stats');
  assert.deepEqual(stats.results.map((r) => r.id).sort(), ['junior-100', 'junior-101']);
  assert.deepEqual(D.summary(stats), { games: 2, wins: 2, best: 200 });
  assert.equal(acct.get(A, 'wordbright', 'game').state.config.seed, 101);
  assert.deepEqual(S.playerStats(), { games: 2, wins: 2, best: 200 }, 'and this device has both');
});

// ---- G6 -----------------------------------------------------------------------------
test('REQUIRE_SIGN_IN on (G6): New game and Continue game need a signed-in player; the other pages never', () => {
  for (const p of ['new', 'play']) {
    assert.equal(needsSignIn(p, null), true, 'on: ' + p);
    assert.equal(needsSignIn(p, null, false), false, 'off: ' + p);
    assert.equal(needsSignIn(p, { id: A }), false);
  }
  for (const p of ['', 'end', 'rules', 'about']) assert.equal(needsSignIn(p, null), false, p);
});

test('G6: the router shows the gate card for a play route (account/gate.js), with a return URL to this game', () => {
  const app = readFileSync(fileURLToPath(new URL('../site/js/app.js', import.meta.url)), 'utf8');
  assert.match(app, /account\.gate\(path, isPlayPath\(path\)\)/);
  assert.match(app, /gateHtml\(gateCard\(answer, navigator\.onLine\), signInUrl\(account\.origin, location\.href\)\)/);
  assert.match(app, /here: currentPath/);
});
