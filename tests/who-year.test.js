// SB4: childYear(), the signed-in child's school year on the child's device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useWho, childYear } from '../site/js/who.js';

const ID = '22222222-2222-4222-8222-222222222222';
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};
const as = (p) => useWho(() => p);

test('a child with a year: that year, and it is remembered', () => {
  store.clear();
  as({ id: ID, name: 'Sam', kind: 'child', canSwitch: false, year: 1 });
  assert.equal(childYear(), 1);
  assert.equal(store.get('sb.year:' + ID), '1');
});

test('an adult playing as a child with a year counts too', () => {
  store.clear();
  as({ id: ID, name: 'Sam', kind: 'child', canSwitch: true, year: 5 });
  assert.equal(childYear(), 5);
});

test('a cached player (no kind, no year) reads the remembered year; none remembered is 0', () => {
  store.clear();
  as({ id: ID, name: 'Sam', avatar: null });
  assert.equal(childYear(), 0);
  store.set('sb.year:' + ID, '4');
  assert.equal(childYear(), 4);
  store.set('sb.year:' + ID, '9');
  assert.equal(childYear(), 0, 'a bad stored value is ignored');
  as({ id: ID, name: 'Sam', kind: 'child', canSwitch: false });
  store.set('sb.year:' + ID, '2');
  assert.equal(childYear(), 2, 'a live child with no year also reads it');
});

test('a live year replaces the remembered one', () => {
  store.clear();
  store.set('sb.year:' + ID, '3');
  as({ id: ID, name: 'Sam', kind: 'child', canSwitch: false, year: 4 });
  assert.equal(childYear(), 4);
  assert.equal(store.get('sb.year:' + ID), '4');
});

test('an adult and a signed-out visitor: 0, even with a remembered year', () => {
  store.clear();
  store.set('sb.year:' + ID, '4');
  as({ id: ID, name: 'Alex', kind: 'adult', canSwitch: true });
  assert.equal(childYear(), 0);
  as(null);
  assert.equal(childYear(), 0);
});

test('storage that throws: the live year still answers, otherwise 0', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  as({ id: ID, name: 'Sam', kind: 'child', canSwitch: false, year: 3 });
  assert.equal(childYear(), 3);
  as({ id: ID, name: 'Sam', kind: 'child', canSwitch: false });
  assert.equal(childYear(), 0);
  globalThis.localStorage = saved;
});

// ---- the SB4 Year 1/2 fixture (tests/fixtures/sb4-year12.json) -------------------------
import { readFileSync } from 'node:fs';

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const fixture = load('./fixtures/sb4-year12.json');
const real = load('../site/data/curriculum.json');
const BLOCKS = { year_1: [1], year_2: [2], year_3_4: [3, 4], year_5_6: [5, 6] };

test('fixture: every word\'s chunks join to the word (the check data.js makes at load), capitals included', () => {
  let n = 0;
  for (const block of Object.keys(BLOCKS)) {
    for (const ch of fixture[block].chapters) {
      for (const w of ch.words) { assert.equal(w.chunks.join(''), w.word, w.word); n += 1; }
    }
  }
  assert.equal(n, 237 + 0, "all words checked");
});

test('fixture: the real chapters keep their content and gain a year; the new ones have the new shape', () => {
  for (const block of ['year_3_4', 'year_5_6']) {
    fixture[block].chapters.forEach((ch, i) => {
      const { year, ...rest } = ch;
      const { year: realYear, ...realRest } = real[block].chapters[i]; // WP1: the real file carries the year too
      assert.deepEqual(rest, realRest);
      assert.equal(realYear, year, ch.id);
      assert.equal(year, BLOCKS[block][i < 5 ? 0 : 1], ch.id);
    });
  }
  const ids = ['year_1', 'year_2'].flatMap((b) => fixture[b].chapters.map((c) => c.id));
  assert.deepEqual(ids, ['y1-ch01', 'y1-ch02', 'y2-ch01']);
  assert.equal(fixture.year_1.chapters[0].noMatch, true);
  for (const b of ['year_1', 'year_2']) {
    for (const ch of fixture[b].chapters) {
      assert.equal(ch.year, BLOCKS[b][0]);
      assert.ok(ch.title && ch.focus && ch.description);
      for (const w of ch.words) {
        assert.ok(['cew', 'pattern'].includes(w.set), w.word);
        assert.ok(w.ipa && w.meaning.partOfSpeech && w.meaning.definition && w.meaning.example, w.word);
      }
    }
  }
  const [c1, c2] = fixture.year_1.chapters;
  assert.deepEqual(c1.words.map((w) => w.word), ['the', 'a', 'I', 'is', 'his', 'off', 'well', 'miss', 'back']);
  assert.deepEqual(c2.words.map((w) => w.word), ['today', 'pull', 'full', 'Monday', 'Tuesday', 'Sunday']);
  assert.deepEqual(fixture.year_2.chapters[0].words.map((w) => w.word), ['any', 'many', 'busy', 'Mr', 'Mrs', 'Christmas', 'station', 'motion', 'fiction']);
});

test('fixture: busy is the Year 3/4 entry\'s fields exactly', () => {
  const find = (c) => c.year_3_4.chapters.flatMap((ch) => ch.words).find((w) => w.word === 'busy');
  const { set, ...busy } = fixture.year_2.chapters[0].words.find((w) => w.word === 'busy');
  assert.equal(set, 'cew');
  assert.deepEqual(busy, find(real));
});
