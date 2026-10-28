// C3a: children play the whole word list at every level, and a grown-up can
// allow a missing word on this device (env.allowed). Computers and hints
// never use allowed words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, play, checkPlay, wordCheck, allowableWords, ALLOWABLE } from '../site/js/engine/game.js';
import { LEVELS, playerList, computerList, listTier, PLAYER_LIST } from '../site/js/engine/levels.js';
import { isWord, wordTier } from '../site/js/engine/words.js';
import { findHint } from '../site/js/ai/hint.js';
import { env, lay, anchor } from './helpers.js';

const e = env('junior');
const [r0, c0] = anchor(e.board);

// A game where it is the child's turn, with a rack we choose.
function withRack(rack, level = 'year-1', extra = {}) {
  const s = structuredClone(newGame({ board: 'junior', seed: 1, level, players: [{ name: 'Ava' }, { name: 'Pip', computer: true, strength: 'easy' }] }, e));
  s.players[0].rack = rack;
  return { s, env: { ...e, ...extra } };
}

test('children may play the whole list (xlarge) at every level', () => {
  for (const l of LEVELS) assert.deepEqual(playerList(l.id), { list: 'xlarge' }, l.id);
  assert.equal(PLAYER_LIST, 'xlarge');
  // "abaka" is only in the xlarge list: a Year 1 child may play it.
  assert.equal(wordTier('abaka', e.words), listTier('xlarge'));
  const { s } = withRack(['a', 'b', 'a', 'k', 'a', 'e', 'e']);
  const res = play(s, lay('abaka', r0, c0 - 2), e);
  assert.ok(res.ok, res.message);
});

test('computer and hint lists stay by level', () => {
  const pip = newGame({ board: 'junior', seed: 1, level: 'year-1', players: [{ name: 'Ava' }, { name: 'Pip', computer: true, strength: 'easy' }] }, e).players[1];
  assert.equal(wordCheck(pip, e)('abaka'), false);
  assert.deepEqual(computerList('year-1'), { list: 'starter', maxLength: 6 });
  // A Year 1 child's hint never suggests a word outside the Year 1 computer list.
  const { s } = withRack(['a', 'b', 'a', 'k', 'a', 'e', 'e']);
  const hint = findHint(s, e);
  assert.ok(hint);
  for (const w of hint.score.words) assert.ok(isWord(w.word, e.words, listTier('starter'), 6), w.word);
});

test('a word that is not in the list: allowableWords offers it, and allowing it lets the play through', () => {
  const { s } = withRack(['q', 'z', 'x', 'a', 'e', 'e', 'e']);
  const tiles = lay('qzx', r0, c0 - 1);
  const refused = play(s, tiles, e);
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'not-a-word');
  assert.deepEqual(allowableWords(s, tiles, e), ['qzx']);

  const mine = { ...e, allowed: new Set(['qzx']) };
  assert.ok(checkPlay(s, tiles, mine).ok);
  const res = play(s, tiles, mine);
  assert.ok(res.ok, res.message);
  assert.equal(res.score.words[0].word, 'qzx');
  assert.equal(allowableWords(s, tiles, mine), null); // nothing left to allow
});

test('allowableWords: only when unknown words are the sole reason', () => {
  const { s } = withRack(['q', 'z', 'x', 'a', 'e', 'e', 'e']);
  assert.equal(allowableWords(s, lay('qzx', 0, 0), e), null); // misses the start square
  assert.equal(allowableWords(s, [{ r: r0, c: c0, letter: 'q', blank: false }, { r: r0, c: c0 + 2, letter: 'z', blank: false }], e), null); // gap
  assert.equal(allowableWords(s, lay('qqq', r0, c0 - 1), e), null); // not in the rack
  assert.equal(allowableWords(s, lay('axe', r0, c0 - 1), e), null); // already a word ("ax" is not: American)
  assert.ok(ALLOWABLE.test('ab') && ALLOWABLE.test('a'.repeat(20)));
  assert.ok(!ALLOWABLE.test('a') && !ALLOWABLE.test('a'.repeat(21)) && !ALLOWABLE.test('Qzx') && !ALLOWABLE.test('q-x'));
});

test('allowed words count for children only: never for computers or hints', () => {
  const extra = { allowed: new Set(['qzx']) };
  const { s, env: mine } = withRack(['q', 'z', 'x', 'q', 'z', 'x', 'q'], 'year-5', extra);
  const comp = { ...s.players[1], rack: ['q', 'z', 'x'] };
  assert.equal(wordCheck(s.players[0], mine)('qzx'), true);
  assert.equal(wordCheck(comp, mine)('qzx'), false);
  assert.equal(findHint(s, mine), null); // the hint does not find QZX
  const compTurn = structuredClone(s);
  compTurn.turn = 1;
  compTurn.players[1].rack = ['q', 'z', 'x', 'q', 'z', 'x', 'q'];
  assert.equal(play(compTurn, lay('qzx', r0, c0 - 1), mine).ok, false);
  assert.equal(allowableWords(compTurn, lay('qzx', r0, c0 - 1), mine), null);
});
