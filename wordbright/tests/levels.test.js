import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, level, playerList, computerList, starSet, LISTS } from '../site/js/engine/levels.js';
import { starWords } from './helpers.js';

test('16 word levels: Year 1 … Year 13, Degree, Master, Doctor', () => {
  assert.equal(LEVELS.length, 16);
  assert.deepEqual(LEVELS.slice(0, 2).map((l) => l.label), ['Year 1', 'Year 2']);
  assert.deepEqual(LEVELS.slice(-3).map((l) => l.label), ['Degree', 'Master', 'Doctor']);
  assert.throws(() => level('year-14'), /Unknown word level/);
});

test('the Rev 4 table, row by row', () => {
  const rows = {
    // level: [band, computer list, computer max length, player list (xlarge at every level, C3a)]
    'year-1': ['A', 'starter', 6, 'xlarge'],
    'year-2': ['A', 'starter', 6, 'xlarge'],
    'year-3': ['B', 'starter', undefined, 'xlarge'],
    'year-4': ['B', 'starter', undefined, 'xlarge'],
    'year-5': ['C', 'steady', undefined, 'xlarge'],
    'year-6': ['C', 'steady', undefined, 'xlarge'],
    'year-7': ['D', 'steady', undefined, 'xlarge'],
    'year-9': ['D', 'steady', undefined, 'xlarge'],
    'year-10': ['E', 'full', undefined, 'xlarge'],
    'year-11': ['E', 'full', undefined, 'xlarge'],
    'year-12': ['F', 'full', undefined, 'xlarge'],
    'year-13': ['F', 'full', undefined, 'xlarge'],
    degree: ['G', 'large', undefined, 'xlarge'],
    master: ['H', 'large', undefined, 'xlarge'],
    doctor: ['I', 'xlarge', undefined, 'xlarge'],
  };
  for (const [id, [band, comp, max, mine]] of Object.entries(rows)) {
    assert.equal(level(id).band, band, id);
    assert.deepEqual(computerList(id), max ? { list: comp, maxLength: max } : { list: comp }, id);
    assert.deepEqual(playerList(id), { list: mine }, id);
    assert.ok(comp in LISTS && mine in LISTS);
  }
});

test('star_words.json has one entry per word, with "years" as a list', () => {
  assert.equal(starWords.length, 316);
  assert.equal(new Set(starWords.map((s) => s.word)).size, 316);
  assert.ok(starWords.every((s) => Array.isArray(s.years) && s.years.length > 0));
  assert.deepEqual(starWords.find((s) => s.word === 'busy').years, ['2', '3-4']);
});

test('Star words per band', () => {
  const size = (id) => starSet(id, starWords).size;
  assert.ok(starSet('year-1', starWords).has('said'));
  assert.ok(!starSet('year-1', starWords).has('build'));
  assert.ok(starSet('year-3', starWords).has('build'));
  assert.ok(!starSet('year-5', starWords).has('build'));
  assert.ok(starSet('year-5', starWords).has('according'));
  assert.ok(starSet('year-1', starWords).has('busy') && starSet('year-3', starWords).has('busy')); // in Y2 and Y3–4
  assert.equal(size('year-7'), 316);
  assert.equal(size('year-12'), size('year-7'));
  assert.equal(size('degree'), 0);
  assert.equal(size('doctor'), 0);
});
