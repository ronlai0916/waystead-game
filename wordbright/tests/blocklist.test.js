// G7b: slurs found live in the word lists ("kraut", "jewed", …) and the rest of
// their class are blocked (wordbright-design/wordlist/review-2026-11-02.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isWord } from '../site/js/engine/words.js';
import { newGame, act, play } from '../site/js/engine/game.js';
import { computerTurn } from '../site/js/ai/computer.js';
import { shardKey } from '../site/js/meanings.js';
import { env, words, boards, cellsWith, DATA, LIST_IDS } from './helpers.js';

const WORDLIST = fileURLToPath(new URL('../../wordbright-design/wordlist/', import.meta.url));

// Known slurs, with their verb forms, plurals and derived words. None may be
// in the game's word graph at any tier, in any word list, or in the meanings.
const SLURS = `
kraut krauts jew jews jewed jewing jewfish boche boches jerry jerries hun huns hunnish
mick micks mickey mickeys bogtrotter sheeny shylock shylocks marrano
gyp gyps gypped gypping gip gipped gypper gyppers gipper gypster gippo gippos gyppo gypo
welsher welshers welcher papist papists papistry popery papism moonie
kaffir kaffirs kafir mammy mammies golliwog golliwogs darky sambo negress quadroon octoroon
peckerwood gringa abo abos boong lubra bohunk dink dinks slanty slitty cholo chola
dago dagos wop wops ginzo ginzoes wog wogs woggish sawney limey limeys pom poms pommy pommie pommies
paki chink gook jap yid yids coolie greaseball honky whitey pikey gypo
mongol mongols mongoloid retard retarded spaz spazz mong gimp gimps gimped crip crips
schizo nutter nutters nutcase headcase cretin moron
pouf poufs poofter poofters poove fagoting nancy nancies nelly nellie lez bulldike dyke homo queer tranny trannie trannies ladyboy
slapper slappers bint bints tarty harlotry hussy slag skank
minge minging pecker peckers putz assed git gits pillock plonker berk lowlife
cocksucker cocksuckers redskin redskins squaw squaws mulatto mulattoes gringo gringos
welsh welshed welshes welshing fags fagged fagging butch butches queerness sissy sissies hussies floozy floozies
bimbo hos fanny fannies sodding psycho psychos gimpy midget midgets redneck rednecks gypsy gypsies
`.trim().split(/\s+/);

// Ron's 39 from the starter and steady lists (2 Nov 2026), and the 8 he kept.
const RON_BLOCKED = 39;
const RON_KEPT = ['cripple', 'cripples', 'hillbilly', 'hillbillies', 'shyster', 'shysters', 'twerp', 'twerps'];

const listWords = (name) => new Set(readFileSync(WORDLIST + `words_${name}.txt`, 'utf8').split('\n').filter(Boolean));

test('known slurs are in no tier of words_all.dawg', () => {
  const found = SLURS.filter((w) => isWord(w, words, 4));
  assert.deepEqual(found, []);
});

test('known slurs are in none of the five word lists', () => {
  for (const name of LIST_IDS) {
    const list = listWords(name);
    assert.deepEqual(SLURS.filter((w) => list.has(w)), [], name);
  }
});

test('known slurs have no meaning or pronunciation shard entry', () => {
  const keys = new Set(JSON.parse(readFileSync(DATA + 'meanings/index.json', 'utf8')));
  const shards = new Map();
  const found = SLURS.filter((w) => {
    const k = shardKey(w, keys);
    if (!k) return false;
    if (!shards.has(k)) shards.set(k, JSON.parse(readFileSync(DATA + `meanings/${k}.json`, 'utf8')));
    return w in shards.get(k);
  });
  assert.deepEqual(found, []);
});

test('Ron kept 8 words from the review (2 Nov): still playable', () => {
  assert.deepEqual(RON_KEPT.filter((w) => !isWord(w, words, 1)), []);
  assert.equal(SLURS.slice(SLURS.indexOf('cocksucker')).length, RON_BLOCKED);
});

test('the G7b review file is there', () => {
  assert.ok(existsSync(WORDLIST + 'review-2026-11-02.md'));
});

test('a saved game with a now-blocked word on the board still loads and plays', () => {
  const e = env('standard');
  const board = boards.standard;
  let s = newGame({ board: 'standard', seed: 4, level: 'year-5', players: [{ name: 'Ava' }, { name: 'Fizz', computer: true, strength: 'crazy' }] }, e);
  // As saved before G7b: "kraut" was played across the start square.
  const r = Math.floor(Math.min(...board.start) / board.size);
  const c0 = Math.min(...board.start) % board.size;
  s = { ...s, cells: cellsWith(board, ['kraut', r, c0, 'across']) };
  s = JSON.parse(JSON.stringify(s)); // through localStorage
  s.players[0].rack = ['s', 'e', 'a', 't', 'o', 'n', 'r'];
  // A new play that makes the blocked word again is refused…
  const krauts = play(s, [{ r, c: c0 + 5, letter: 's', blank: false }], e);
  assert.equal(krauts.ok, false);
  assert.equal(krauts.error, 'not-a-word');
  // …but an ordinary word next to it is fine,
  const child = computerTurn({ ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, computer: true, strength: 'hard' } : p)) }, e);
  assert.equal(child.action.type, 'play');
  const next = play(s, child.action.tiles, e);
  assert.ok(next.ok, next.message);
  // and the computer plays on from there.
  const res = computerTurn(next.state, e);
  assert.equal(res.action.type, 'play');
  assert.ok(act(next.state, res.action, e).ok);
});
