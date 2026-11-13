// SB4-WP1: one school year at a time (chapters-doc.js and data.js). The old ids never change; they have a new home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as Ch from '../site/js/chapters-doc.js';

const real = JSON.parse(readFileSync(new URL('../site/data/curriculum.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/sb4-year12.json', import.meta.url), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const OLD = [];
for (let i = 1; i <= 10; i++) OLD.push('y34-ch' + String(i).padStart(2, '0'));
for (let i = 1; i <= 10; i++) OLD.push('y56-ch' + String(i).padStart(2, '0'));
const built = Ch.buildYears(clone(real));

test('every one of the 20 old ids keeps its id and has a home', () => {
  assert.deepEqual(built.live, ['y3', 'y4', 'y5', 'y6']);
  for (const id of OLD) assert.ok(built.byId.get(id), id);
  const ch = built.byId.get('y34-ch07');
  assert.deepEqual([ch.yearId, ch.slug, ch.n, ch.index], ['y4', 'ch02', 2, 1]);
  assert.equal(built.byId.get('y34-ch05').yearId, 'y3');
  assert.equal(built.byId.get('y56-ch06').yearId, 'y6');
  for (const y of built.live) {
    assert.equal(built.byYear[y].length, 5);
    built.byYear[y].forEach((c, i) => assert.deepEqual([c.n, c.slug], [i + 1, 'ch0' + (i + 1)]));
  }
  assert.equal(built.byYear.y1, undefined);
});

test('a chapter with no year takes it from its block', () => {
  const c = clone(real);
  for (const b of ['year_3_4', 'year_5_6']) for (const ch of c[b].chapters) delete ch.year;
  const b = Ch.buildYears(c);
  assert.equal(b.byId.get('y34-ch06').yearId, 'y4');
  assert.equal(b.byId.get('y56-ch01').yearId, 'y5');
});

test('legacyHref: all 20 ids, with a suffix, and the two bare years', () => {
  for (const id of OLD) {
    const [blk, slug] = id.split('-');
    const ch = built.byId.get(id);
    const want = '#/' + ch.yearId + '/' + ch.slug;
    assert.deepEqual(Ch.legacyHref(blk + '/' + slug, built.byId), { href: want }, id);
    assert.deepEqual(Ch.legacyHref(blk + '/' + slug + '/study', built.byId), { href: want + '/study' }, id);
    assert.deepEqual(Ch.legacyHref(blk + '/' + slug + '/test', built.byId), { href: want + '/test' }, id);
  }
  assert.deepEqual(Ch.legacyHref('y34/ch07', built.byId), { href: '#/y4/ch02' });
  assert.deepEqual(Ch.legacyHref('y56/ch03/quick/fruit', built.byId), { href: '#/y5/ch03/quick/fruit' });
  assert.deepEqual(Ch.legacyHref('y34', built.byId), { href: '#/chapters', remember: 'y3' });
  assert.deepEqual(Ch.legacyHref('y56', built.byId), { href: '#/chapters', remember: 'y5' });
  for (const p of ['', 'y3', 'y3/ch01', 'chapters', 'y34x', 'y34/ch11', 'y34/chapter', 'words/y34']) assert.equal(Ch.legacyHref(p, built.byId), null, p);
});

test('mapRemembered', () => {
  const live = ['y3', 'y4', 'y5', 'y6'];
  assert.equal(Ch.mapRemembered('y34', live), 'y3');
  assert.equal(Ch.mapRemembered('y56', live), 'y5');
  assert.equal(Ch.mapRemembered('y4', live), 'y4');
  assert.equal(Ch.mapRemembered('y1', live), '');
  assert.equal(Ch.mapRemembered('junk', live), '');
  assert.equal(Ch.mapRemembered('', live), '');
  assert.equal(Ch.mapRemembered('y1', ['y1', 'y2', ...live]), 'y1');
});

test('yearTabs: a grown-up sees every live year; a child sees their year and the next', () => {
  const four = ['y3', 'y4', 'y5', 'y6'];
  const six = ['y1', 'y2', ...four];
  assert.deepEqual(Ch.yearTabs(0, true, four), { main: four, more: [] });
  assert.deepEqual(Ch.yearTabs(4, true, six), { main: six, more: [] });
  assert.deepEqual(Ch.yearTabs(0, false, four), { main: four, more: [] }, 'a year not known yet');
  assert.deepEqual(Ch.yearTabs(3, false, four), { main: ['y3', 'y4'], more: ['y5', 'y6'] });
  assert.deepEqual(Ch.yearTabs(4, false, four), { main: ['y4', 'y5'], more: ['y3', 'y6'] });
  assert.deepEqual(Ch.yearTabs(6, false, four), { main: ['y5', 'y6'], more: ['y3', 'y4'] });
  assert.deepEqual(Ch.yearTabs(1, false, four), { main: ['y3', 'y4'], more: ['y5', 'y6'] }, 'Year 1 before year_1 exists');
  assert.deepEqual(Ch.yearTabs(1, false, six), { main: ['y1', 'y2'], more: ['y3', 'y4', 'y5', 'y6'] }, 'and after');
  assert.deepEqual(Ch.yearTabs(2, false, six), { main: ['y2', 'y3'], more: ['y1', 'y4', 'y5', 'y6'] });
  assert.deepEqual(Ch.yearTabs(6, false, six), { main: ['y5', 'y6'], more: ['y1', 'y2', 'y3', 'y4'] });
});

test('pickYear: remembered, else the child\'s year, else the year being worked in, else Year 3', () => {
  const live = ['y3', 'y4', 'y5', 'y6'];
  const v = (o) => Object.fromEntries(live.map((y) => [y, { mode: o[y] || 'start' }]));
  assert.equal(Ch.pickYear('y5', v({ y3: 'carry' }), 3, live), 'y5');
  assert.equal(Ch.pickYear('', v({ y3: 'carry' }), 4, live), 'y4');
  assert.equal(Ch.pickYear('', v({ y3: 'carry' }), 1, live), 'y3', 'Year 1 clamps to the first live year');
  assert.equal(Ch.pickYear('', v({ y3: 'carry' }), 6, live), 'y6');
  assert.equal(Ch.pickYear('', v({ y3: 'done', y4: 'carry', y5: 'carry' }), 0, live), 'y4');
  assert.equal(Ch.pickYear('', v({}), 0, live), 'y3');
  assert.equal(Ch.pickYear('y2', v({}), 0, live), 'y3', 'a remembered year that is not live is ignored');
  assert.equal(Ch.pickYear('', v({}), 1, ['y1', 'y2', ...live]), 'y1');
});

test('chapterName takes off "Chapter N — "', () => {
  assert.equal(Ch.chapterName({ title: 'Chapter 1 — First steps' }), 'First steps');
  assert.equal(Ch.chapterName({ title: 'Chapter 12 - Silent letters' }), 'Silent letters');
  assert.equal(Ch.chapterName({ title: 'Plain title' }), 'Plain title');
  assert.equal(Ch.chapterName(built.byId.get('y34-ch07')), real.year_3_4.chapters[6].title.replace(/^Chapter \d+ — /, ''));
});

test('sourceLine and patternLabel say exactly this', () => {
  assert.equal(Ch.sourceLine(3), 'From the Years 3 and 4 statutory word list (we split it into two years)');
  assert.equal(Ch.sourceLine(4, 'statutory'), 'From the Years 3 and 4 statutory word list (we split it into two years)');
  assert.equal(Ch.sourceLine(5), 'From the Years 5 and 6 statutory word list (we split it into two years)');
  assert.equal(Ch.sourceLine(6, 'statutory'), 'From the Years 5 and 6 statutory word list (we split it into two years)');
  assert.equal(Ch.sourceLine(1, 'cew'), 'Year 1 common exception words (statutory)');
  assert.equal(Ch.sourceLine(2, 'cew'), 'Year 2 common exception words (statutory)');
  assert.equal(Ch.patternLabel(1, 'ff, ll'), "Pattern words: our examples for the Year 1 rule 'ff, ll'");
  assert.equal(Ch.patternLabel(2, 'ti says sh'), "Pattern words: our examples for the Year 2 rule 'ti says sh'");
  assert.equal(Ch.patternLabel(4, 'silent b'), "Pattern words: our examples for the Years 3 and 4 rule 'silent b'");
  assert.equal(Ch.patternLabel(6, 'ough'), "Pattern words: our examples for the Years 5 and 6 rule 'ough'");
  assert.equal(Ch.APOSTROPHE_NOTE, 'Not included yet: words with an apostrophe.');
});

test('with the Year 1 and 2 blocks: six years are live, and busy keeps its old entry', async () => {
  const b = Ch.buildYears(clone(fixture));
  assert.deepEqual(b.live, ['y1', 'y2', 'y3', 'y4', 'y5', 'y6']);
  assert.equal(b.byId.get('y1-ch02').n, 2);
  assert.equal(b.byId.get('y2-ch01').slug, 'ch01');
  const text = JSON.stringify(fixture);
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(text), status: 200 });
  const D = await import('../site/js/data.js');
  await D.loadData();
  assert.deepEqual(D.liveYears(), ['y1', 'y2', 'y3', 'y4', 'y5', 'y6']);
  const ids = D.chaptersOf('busy');
  assert.equal(ids.length, 2);
  assert.ok(ids.includes('y2-ch01') && ids.some((id) => id.startsWith('y34-')));
  const old = fixture.year_3_4.chapters.flatMap((c) => c.words.map((w) => ({ w, c }))).find((x) => x.w.word === 'busy');
  assert.equal(D.entry('busy').chapterId, old.c.id, 'the old entry (it has the audio and the picture) wins');
  assert.equal(D.entry('busy').yearId, old.c.year === 3 ? 'y3' : 'y4');
  assert.deepEqual(D.chaptersOf('nonesuch'), []);
  assert.equal(D.chapterTitle(D.chapterById('y34-ch06')).n, 1, 'n is the place in the year');
  assert.equal(D.chapters('y4')[0].id, 'y34-ch06');
  assert.equal(D.chapterBySlug('y6', 'ch05').id, 'y56-ch10');
  assert.equal(D.defaultYear(), 'y3');
});

test('copy: nothing in the site says "Year N list" (the lists cover two years)', () => {
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const files = [...walk(new URL('../site/js', import.meta.url).pathname).filter((p) => p.endsWith('.js')),
    ...readdirSync(new URL('../site/data', import.meta.url).pathname).filter((f) => f.endsWith('.json')).map((f) => join(new URL('../site/data', import.meta.url).pathname, f))];
  assert.ok(files.length > 20);
  for (const f of files) assert.doesNotMatch(readFileSync(f, 'utf8'), /Year [3-6] list/, f);
});
