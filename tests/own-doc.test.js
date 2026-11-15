// SB4 a grown-up's own word lists (site/js/own-doc.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Ow from '../site/js/own-doc.js';
import * as Su from '../site/js/setup-doc.js';

const DAY = 86400000;
const mk = (o = {}) => ({ name: 'Trip', words: ['cat', 'dog'], src: 'typed', to: ['k1'], ...o });

test('limits: 15 words, 30 live lists, a name, words', () => {
  const words = Array.from({ length: 15 }, (_, i) => 'w' + 'abcdefghijklmno'[i]);
  assert.ok(Ow.set({}, 'a', mk({ words }), 100).own);
  assert.deepEqual(Ow.set({}, 'a', mk({ words: [...words, 'extra'] }), 100), { error: 'too-many-words' });
  assert.deepEqual(Ow.set({}, 'a', mk({ words: [] }), 100), { error: 'no-words' });
  assert.deepEqual(Ow.set({}, 'a', mk({ name: '   ' }), 100), { error: 'no-name' });
  let own = {};
  for (let i = 0; i < Ow.MAX_LISTS; i += 1) own = Ow.set(own, 'o' + i, mk({ name: 'L' + i }), 100 + i).own;
  assert.deepEqual(Ow.set(own, 'new', mk(), 500), { error: 'too-many' });
  assert.ok(Ow.set(own, 'o3', mk({ name: 'Edit' }), 500).own, 'an edit is fine');
  assert.ok(Ow.set(Ow.drop(own, 'o1', 600), 'new', mk(), 700).own, 'a deleted one makes room');
  assert.equal(Ow.live(own).length, 30);
});

test('edit keeps the oid, bumps at, and de-duplicates words case-insensitively', () => {
  let own = Ow.set({}, 'a', mk({ words: ['Cat', 'cat', 'CAT', 'dog'] }), 1000).own;
  assert.deepEqual(own.a.words, ['Cat', 'dog']);
  own = Ow.set(own, 'a', mk({ name: 'Renamed', to: ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'] }), 10).own;
  assert.deepEqual(Object.keys(own), ['a']);
  assert.equal(own.a.at, 1001);
  assert.equal(own.a.to.length, 5);
  assert.equal(own.a.name, 'Renamed');
});

test('soft delete and restore inside 30 days; gone after', () => {
  const t0 = 100 * DAY;
  let own = Ow.set({}, 'a', mk(), t0).own;
  own = Ow.drop(own, 'a', t0 + DAY);
  assert.equal(Ow.live(own).length, 0);
  assert.equal(Ow.deleted(own, t0 + 2 * DAY).length, 1);
  const back = Ow.restore(own, 'a', t0 + 10 * DAY).own;
  assert.equal(Ow.live(back).length, 1);
  assert.ok(back.a.at > own.a.at);
  assert.equal('gone' in back.a, false);
  assert.equal(Ow.deleted(own, t0 + DAY + 31 * DAY).length, 0);
  assert.equal(Ow.restore(own, 'a', t0 + DAY + 31 * DAY).error, 'not-there');
  assert.deepEqual(Object.keys(Ow.trim(own, t0 + DAY + 31 * DAY)), []);
  assert.deepEqual(Object.keys(Ow.trim(own, t0 + DAY + 29 * DAY)), ['a']);
  assert.equal(Ow.restore({}, 'zz', 5).error, 'not-there');
  const two = Ow.drop(Ow.drop(Ow.set(Ow.set({}, 'a', mk(), 1).own, 'b', mk({ name: 'B' }), 1).own, 'a', 100), 'b', 200);
  assert.deepEqual(Ow.deleted(two, 300).map((e) => e.id), ['b', 'a'], 'newest first');
});

test('merge per id, normalise and isEmpty', () => {
  const a = Ow.set({}, 'x', mk({ name: 'Old' }), 100).own;
  const b = Ow.set({}, 'x', mk({ name: 'New' }), 200).own;
  assert.equal(Ow.merge(a, b).x.name, 'New');
  assert.equal(Ow.merge(b, a).x.name, 'New');
  assert.equal(Ow.merge(a, Ow.drop(a, 'x', 300)).x.gone, 300);
  assert.deepEqual(Ow.merge(null, a), a);
  assert.equal(Ow.isEmpty({ x: { name: '', words: [], at: 1 } }), true);
  assert.equal(Ow.isEmpty(a), false);
});

test('delivery: sent, behind, remove', () => {
  const master = Ow.set({}, 'o1', mk({ to: ['k1', 'k2'] }), 100).own;
  const copy = (at, gone) => ({ own: { o1: { name: 'Trip', words: ['cat', 'dog'], src: 'typed', at, ...(gone ? { gone } : {}) } } });
  const rows = Ow.delivery(master, { k1: copy(100), k2: {}, k3: copy(100) });
  const by = Object.fromEntries(rows.map((r) => [r.childId, r.state]));
  assert.deepEqual(by, { k1: 'sent', k2: 'behind', k3: 'remove' });
  assert.equal(Ow.delivery(master, { k1: copy(50), k2: copy(100, 9) }).find((r) => r.childId === 'k1').state, 'behind', 'an older copy');
  assert.equal(Ow.delivery(master, { k1: copy(50), k2: copy(100, 9) }).find((r) => r.childId === 'k2').state, 'behind', 'a dropped copy');
  const gone = Ow.drop(master, 'o1', 400);
  const g = Ow.delivery(gone, { k1: copy(100), k2: {} });
  assert.deepEqual(g, [{ oid: 'o1', childId: 'k1', state: 'remove' }]);
  assert.deepEqual(Ow.delivery({}, { k1: {} }), []);
  // a real round trip through setup-doc
  let k1 = {};
  k1 = Su.setOwnCopy(k1, 'o1', master.o1, master.o1.at).setup;
  assert.equal(Ow.delivery(master, { k1, k2: {} }).find((r) => r.childId === 'k1').state, 'sent');
});

test('adopt: a copy with no master becomes one; gone masters are not re-adopted', () => {
  const c = (at, gone) => ({ own: { lost: { name: 'Lost list', words: ['cat'], src: 'scan', at, ...(gone ? { gone } : {}) } } });
  const m = Ow.adopt({}, { k1: c(50), k2: c(70), k3: {} }, 999);
  assert.deepEqual(m.lost.to, ['k1', 'k2']);
  assert.equal(m.lost.name, 'Lost list');
  assert.equal(m.lost.at, 70);
  assert.equal(Ow.delivery(m, { k1: c(50), k2: c(70) }).filter((r) => r.state === 'sent').length, 1, 'k2 has the newest copy; k1 is behind');
  const known = Ow.set({}, 'lost', mk(), 5).own;
  assert.deepEqual(Ow.adopt(known, { k1: c(50) }, 9), known);
  assert.deepEqual(Ow.adopt(Ow.drop(known, 'lost', 6), { k1: c(50) }, 9).lost.gone, 6);
  assert.deepEqual(Ow.adopt({}, { k1: c(50, 60) }, 9), {});
});
