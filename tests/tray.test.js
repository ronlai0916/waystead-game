// SB4-WP4: the pure parts of the letter tray (site/js/tray.js) and the sentence helper. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Tr from '../site/js/tray.js';
import * as T from '../site/js/tiles-doc.js';
import { canSentence } from '../site/js/sentence.js';

const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const E = (word, tricky) => ({ word, chunks: [word], tricky });
const spec = (word, lv = 2) => T.tilesFor(E(word), lv, T.seedOf(word, '2026-11-13'));

test('labels', () => {
  assert.equal(Tr.tileLabel('p'), 'letter p');
  assert.equal(Tr.gapLabel(2, 4, ''), 'gap 2 of 4, empty');
  assert.equal(Tr.gapLabel(2, 4, 'p'), 'gap 2 of 4, p');
});
test('the screen-reader pattern', () => {
  const s = { letters: [{ ch: 'a', shown: true }, { ch: 'p', shown: false }, { ch: 'p', shown: false }, { ch: 'l', shown: true }, { ch: 'e', shown: true }] };
  assert.equal(Tr.patternOf(s), 'a, gap, gap, l, e');
  assert.equal(Tr.patternOf(s, { 1: 'p' }), 'a, p, gap, l, e');
});
test('box size by word length shrinks, never under 26', () => {
  assert.deepEqual([3, 6, 7, 8, 9, 10, 11, 12, 15].map(Tr.sizeClass), ['tb-40', 'tb-40', 'tb-36', 'tb-36', 'tb-32', 'tb-32', 'tb-28', 'tb-26', 'tb-26']);
});
test('tile rows: at most 6, even', () => {
  assert.deepEqual([4, 6, 7, 8, 9, 12].map((n) => Tr.rowSizes(n)), [[4], [6], [4, 3], [4, 4], [5, 4], [6, 6]]);
  assert.deepEqual(Tr.padRows(['a', 'b', 'c', 'd', 'e', 'f', 'g']).map((r) => r.length), [4, 3]);
});
test('tile rows: at most 5 on a narrow phone, up to 3 rows', () => {
  assert.deepEqual([4, 5, 6, 8, 11, 12, 15].map((n) => Tr.rowSizes(n, 5)), [[4], [5], [3, 3], [4, 4], [4, 4, 3], [4, 4, 4], [5, 5, 5]]);
  assert.ok([4, 5, 6, 8, 11, 12, 15].every((n) => Tr.rowSizes(n, 5).length <= 3));
});
test('the first line shown: a fresh session has no "new way"; a level change has; the capital note keeps its place', () => {
  const lower = spec('apple');
  const cap = { ...lower, word: 'Monday' };
  const store = {};
  globalThis.sessionStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  try {
    assert.equal(Tr.moreFor(lower, 2), '', 'fresh session: no new way');
    assert.equal(Tr.moreFor(lower, 2), '', 'same level');
    assert.equal(Tr.moreFor(lower, 3), Tr.LINES.newWay, 'a different level');
    assert.equal(Tr.moreFor(cap, 3), Tr.LINES.capital, 'capital note when nothing newer');
  } finally { delete globalThis.sessionStorage; }
});
test('the line card holds one line at a time: the lead first, the instruction kept for later', () => {
  const html = Tr.lineHtml('Tap the missing letters.', 'New way to spell today!');
  assert.ok(html.includes('data-base="Tap the missing letters."') && html.includes('data-lead="New way to spell today!"'));
  assert.ok(!html.includes('data-more'));
  assert.ok(/>New way to spell today!<\/p>/.test(html));
  assert.ok(/>Tap the missing letters\.<\/p>/.test(Tr.lineHtml('Tap the missing letters.')));
});
test('the tray and its buttons share one column', () => {
  assert.ok(Tr.colHtml('<i></i>', '<b></b>').startsWith('<div class="traycol"><i></i><b></b>'));
  assert.ok(/tn-12/.test(Tr.boxesHtml(spec('accidentally'))));
});
test('instructions by level', () => {
  assert.equal(Tr.instructionFor(1), 'Tap the missing letters.');
  assert.equal(Tr.instructionFor(3), 'Tap the missing letters.');
  assert.equal(Tr.instructionFor(4), 'Tap the letters to spell the word.');
});
test('markup: gaps, tiles, Back, no style attribute', () => {
  const s = spec('apple');
  const html = Tr.boxesHtml(s, { tricky: 'pp' }) + Tr.trayHtml(s);
  assert.equal((html.match(/class="lgap"/g) || []).length, s.gaps.length);
  assert.equal((html.match(/class="ltile"/g) || []).length, s.tiles.length);
  assert.ok(html.includes('data-back') && html.includes('keyboard keyboard--tray'));
  assert.ok(!/style=/.test(html));
  const fixed = Tr.trayHtml(s, { static: true }) + Tr.boxesHtml(s, { static: true });
  assert.ok(!/<button/.test(fixed));
});
test('no child line holds a banned word', () => {
  const banned = /\b(wrong|fail|failed|incorrect|mistake|late|lost|error)\b|×/i;
  for (const l of Object.values(Tr.LINES)) assert.ok(!banned.test(l), l);
});
test('canSentence needs an example', () => {
  assert.equal(canSentence({ word: 'a', meaning: { example: '' } }), false);
  assert.equal(canSentence({ word: 'a', meaning: { example: 'I saw a bird.' } }), true);
  assert.equal(canSentence(null), false);
});
test('no style attribute in the files WP4 touches', () => {
  for (const f of ['site/js/tray.js', 'site/js/sentence.js', 'site/js/play.js', 'site/js/study-views.js', 'site/js/games-views.js', 'site/js/words-views.js', 'site/js/data.js', 'site/js/views.js']) {
    assert.ok(!/style="/.test(readFileSync(file(f), 'utf8')), f);
    assert.ok(!/<script/.test(readFileSync(file(f), 'utf8')), f + ' script');
  }
});
