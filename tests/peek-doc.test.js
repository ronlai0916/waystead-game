import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTEXTS, peekRule, peekMs, PEEK_LABEL } from '../site/js/peek-doc.js';

test('label is Peek', () => assert.equal(PEEK_LABEL, 'Peek'));

test('Normal grid and fix keep today: unlimited, reset', () => {
  for (const c of ['grid', 'fix']) for (const way of ['usual', 'sbs']) for (const profile of ['', 'sen']) {
    assert.deepEqual(peekRule(c, { way, profile }), { allowed: Infinity, after: 'reset' });
  }
});
test('games: unlimited, not-clean', () => {
  for (const c of ['flower', 'missing', 'unjumble', 'quick', 'fill']) for (const way of ['usual', 'sbs']) {
    assert.deepEqual(peekRule(c, { way }), { allowed: Infinity, after: 'not-clean' });
  }
});
test('quiz (Stretch): one', () => assert.deepEqual(peekRule('quiz', { way: 'usual' }), { allowed: 1, after: 'not-clean' }));
test('sbs ladder, row, builder repeat', () => {
  for (const c of ['ladder', 'row', 'builder']) assert.deepEqual(peekRule(c, { way: 'sbs' }), { allowed: Infinity, after: 'repeat' });
});
test('tests: Normal none, sbs one with-peek (D7)', () => {
  assert.equal(peekRule('test', { way: 'usual' }).allowed, 0);
  assert.deepEqual(peekRule('test', { way: 'sbs' }), { allowed: 1, after: 'with-peek' });
  for (const c of ['chapterTest', 'bigTest']) for (const way of ['usual', 'sbs']) assert.equal(peekRule(c, { way }).allowed, 0);
});
test('non-spelling contexts none', () => {
  for (const c of ['match', 'mix', 'fillPick', 'story', 'nonsense']) assert.deepEqual(peekRule(c, { way: 'sbs' }), { allowed: 0, after: 'none' });
});
test('every context answers', () => {
  for (const c of CONTEXTS) for (const way of ['usual', 'sbs']) {
    const r = peekRule(c, { way, profile: 'sen' });
    assert.ok(r.allowed === Infinity || r.allowed === 1 || r.allowed === 0, c);
  }
});
test('peekMs', () => {
  assert.equal(peekMs({ peek: { s: 5 } }, { way: 'usual', input: 'keys' }), 5000);
  assert.equal(peekMs({ peek: { s: 2 } }, { way: 'sbs' }), 2000);
  assert.equal(peekMs({}, { way: 'sbs', input: 'keys' }), 3000);
  assert.equal(peekMs({}, { way: 'usual', input: 'keys' }), 2000);
  assert.equal(peekMs({}, { way: 'usual', input: 'tiles' }), 3000);
  assert.equal(peekMs({ peek: { s: 0 } }, { way: 'usual', input: 'keys' }), 2000);
  assert.equal(peekMs({ peek: { s: 0 } }, { way: 'sbs', input: 'keys' }), 2000);
  assert.equal(peekMs({ peek: { s: 0 } }, { way: 'sbs', input: 'tiles' }), 3000);
  assert.equal(peekMs(undefined, { input: 'tiles' }), 3000);
  assert.equal(peekMs({ way: { m: 'sbs' } }, {}), 3000);
});
