// C2-1b: the reason step's joining tiles (they put the start of the sentence in
// the box) and the guard that keeps a child's typed words off the voice server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../site/js/comic-doc.js';

const spec = { feel: { who: 'maya', fits: ['sad'] }, speech: [{ who: 'Maya', says: 'Oh no!' }] };
const JOINS = ['because', 'so', 'when'];
const base = K.whyBase({ feel: { face: 'sad', word: 'heartbroken' } }, spec);

test('the start is the feeling sentence without its full stop, then the joining word and a space', () => {
  assert.equal(base, 'Maya felt heartbroken');
  assert.equal(K.whyStart(base, 'because'), 'Maya felt heartbroken because ');
});

test('tapping a joining word fills an empty box; tapping another swaps it and keeps what was typed', () => {
  let box = K.swapJoin('', base, JOINS, 'because');
  assert.equal(box, 'Maya felt heartbroken because ');
  box += 'her kite flew away';
  box = K.swapJoin(box, base, JOINS, 'when');
  assert.equal(box, 'Maya felt heartbroken when her kite flew away');
  assert.equal(K.swapJoin(box, base, JOINS, 'so'), 'Maya felt heartbroken so her kite flew away');
  assert.equal(K.swapJoin('Maya felt heartbroken', base, JOINS, 'so'), 'Maya felt heartbroken so ');
  assert.equal(K.swapJoin('her kite flew away', base, JOINS, 'because'), 'Maya felt heartbroken because her kite flew away', "the child's words are kept, with the start in front");
  assert.equal(K.swapJoin('maya felt heartbroken because it rained', base, JOINS, 'when'), 'Maya felt heartbroken when it rained', 'any case');
});

test('reading the box: the joining word and the reason, whatever the child did with it', () => {
  assert.deepEqual(K.readWhy('Maya felt heartbroken because her kite flew away.', base, JOINS), { join: 'because', why: 'her kite flew away' });
  assert.deepEqual(K.readWhy('Maya felt heartbroken when  it rained ', base, JOINS), { join: 'when', why: 'it rained' });
  assert.deepEqual(K.readWhy('Maya felt heartbroken it rained', base, JOINS, 'so'), { join: 'so', why: 'it rained' }, 'joining word deleted: the last one tapped');
  assert.deepEqual(K.readWhy('so she cried', base, JOINS), { join: 'so', why: 'she cried' }, 'start deleted: a joining word at the front still counts');
  assert.deepEqual(K.readWhy('her kite flew away', base, JOINS), { join: 'because', why: 'her kite flew away' });
  assert.deepEqual(K.readWhy('Maya felt heartbroken because ', base, JOINS), { join: 'because', why: '' }, 'nothing typed yet');
  const p = { feel: { word: 'heartbroken', ...K.readWhy('Maya felt heartbroken because her kite flew away', base, JOINS) } };
  assert.equal(K.feelSentence(p, spec), 'Maya felt heartbroken because her kite flew away.', 'the panel reads the whole sentence');
});

test("a child's typed words are found as whole words; lines made from our tiles are not", () => {
  const c = {
    kind: 'task',
    panels: [
      { text: '', word: 'shiny', feel: { word: 'sad', why: 'her kite flew away' }, say: { i: 0 } },
      { text: 'The kite got stuck in a big tree', feel: { word: 'tired' }, say: { who: 'Sam', text: 'Help me please' } },
      {}, {},
    ],
  };
  const bits = K.typedBits(c);
  assert.deepEqual(bits.sort(), ['help me please', 'her kite flew away', 'shiny', 'the kite got stuck in a big tree'].sort());
  assert.ok(K.hasTyped('Maya flew her shiny kite.', bits));
  assert.ok(K.hasTyped('Maya felt sad because her kite flew away.', bits));
  assert.ok(K.hasTyped('"Help me, please!" said Sam.', bits));
  assert.equal(K.hasTyped('Maya felt tired.', ['red']), false, 'not inside another word');
  assert.equal(K.hasTyped('Sam flew the kite in the park.', bits), false);
  assert.equal(K.hasTyped('anything', []), false);
});

test('an own story: a chosen card or title is ours, a typed one is the child\'s', () => {
  const c = { kind: 'own', spark: { problem: 'Kofi lost the ball.', solution: 'My nan found it at the shop' }, title: 'Kofi and the Ball', panels: [{ cap: { text: 'Kofi lost the ball.' }, say: { text: 'Oh no!' } }, {}, {}, {}] };
  const fixed = new Set(['Kofi lost the ball.', 'Oh no!', ...K.ownTitleIdeas('Kofi', 'the ball', 'the park')]);
  assert.deepEqual(K.typedBits(c, fixed), ['my nan found it at the shop']);
  assert.deepEqual(K.ownTitleIdeas('Kofi', 'the ball', 'the park'), ['Kofi and the Ball', 'The Missing Ball', 'A Day at the Park', "Kofi's Big Adventure"]);
});
