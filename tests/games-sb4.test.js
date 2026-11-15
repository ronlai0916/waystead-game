// SB4-WP2: one-letter words and capitals in the games rules. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../site/js/games-doc.js';

function seeded(seed = 7) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const entry = (word, chunks = [word], tricky, def) => ({ word, chunks, tricky, meaning: def === null ? undefined : { definition: def || word + ' means this' } });

test('blanksFor: one-letter, two-letter and capitals', () => {
  assert.deepEqual(G.blanksFor(entry('a'), seeded()), [0]);
  assert.deepEqual(G.blanksFor(entry('I'), seeded()), [0]);
  assert.deepEqual(G.blanksFor(entry('to'), seeded()), [1]);
  assert.deepEqual(G.blanksFor(entry('Mr'), seeded()), [1]);
  for (let s = 1; s < 30; s += 1) {
    const b = G.blanksFor(entry('Monday', ['Mon', 'day']), seeded(s));
    assert.ok(b.length && !b.includes(0), JSON.stringify(b));
  }
  assert.deepEqual(G.blanksFor(entry('build', ['build'], 'ui')), [1, 2]);
});
test('playable', () => {
  for (const g of ['flower', 'missing', 'unjumble']) { assert.equal(G.playable(entry('a'), g), false); assert.equal(G.playable(entry('to'), g), true); }
  assert.equal(G.playable(entry('a'), 'quick'), true);
  assert.equal(G.playable(entry('a'), 'match'), true);
});
test('gamesFor', () => {
  const four = ['one', 'two', 'three', 'four'].map((w) => entry(w));
  assert.deepEqual(G.gamesFor(four), ['missing', 'unjumble', 'match', 'quick']);
  assert.deepEqual(G.gamesFor(four, { noMatch: true }), ['missing', 'unjumble', 'quick']);
  assert.deepEqual(G.gamesFor(four.slice(0, 3)), ['missing', 'unjumble', 'match', 'quick'].filter((g) => g !== 'match'));
  const three = [entry('one'), entry('two'), entry('three'), entry('four', ['four'], undefined, null)];
  assert.ok(!G.gamesFor(three).includes('match'));
  const ones = [entry('a'), entry('I'), entry('a'), entry('I')];
  assert.deepEqual(G.gamesFor(ones), ['match', 'quick']);
  assert.deepEqual(G.gamesFor(ones, { noMatch: true }), ['quick']);
});
test('jumble keeps a capital in place and ends for two letters', () => {
  for (let s = 1; s < 30; s += 1) {
    const j = G.jumble('Monday', seeded(s));
    assert.equal(j[0], 'M'); assert.notEqual(j.join(''), 'Monday');
    assert.equal([...j].sort().join(''), [...'Monday'].sort().join(''));
  }
  assert.deepEqual(G.jumble('I', seeded()), ['I']);
  assert.notEqual(G.jumble('to', () => 0.99).join(''), 'to');
  assert.deepEqual(G.jumble('Mr', seeded()), ['M', 'r']);
});
