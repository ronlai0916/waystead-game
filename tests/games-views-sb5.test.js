// SB5 WP-F1: Fill in the blanks and Mix and match views (pure parts run, markup checked from source).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as G from '../site/js/games-doc.js';
import { boardPlay, textEntryFor, mixPool } from '../site/js/games-views.js';

const read = (p) => readFileSync(fileURLToPath(new URL('../' + p, import.meta.url)), 'utf8');
const src = read('site/js/games-views.js');
const css = read('site/css/mix.css');
const bank = JSON.parse(read('site/data/statements.json')).w;

const rows = [['winter', 'The winter is very cold.'], ['build', 'We will build a sandcastle.'], ['open', 'Can you open the door?']];
const entries = rows.map(([word, s]) => ({ word, statements: [s, s + ' ', s] }));
const board = () => ({
  kind: 'statement',
  slots: rows.map(([word, s]) => ({ kind: 'statement', word, scored: true, ...G.gapOf(s, word), text: '', full: s })),
  cards: rows.map(([word]) => ({ word })),
});

test('boardPlay: a card waits in a slot until Check; right stays, wrong goes back', () => {
  const p = boardPlay(board());
  assert.equal(p.canCheck(), false);
  assert.equal(p.place('build', 0), 'held');
  assert.equal(p.place('build', 1), 'held', 'moving a card frees its first slot');
  assert.deepEqual(p.held(), { 1: 'build' });
  p.place('open', 0);
  const r = p.check();
  assert.deepEqual([r.hit, r.miss], [[1], [0]]);
  assert.equal(p.cardState('build'), 'placed');
  assert.equal(p.cardState('open'), 'free');
  assert.equal(p.state().tries.open, 1);
  assert.equal(r.done, false);
});
test('boardPlay: choose toggles, a placed card cannot be chosen, take gives it back', () => {
  const p = boardPlay(board());
  assert.equal(p.choose('winter'), 'winter');
  assert.equal(p.choose('winter'), '');
  p.place('winter', 0);
  assert.equal(p.choose('winter'), '', 'a waiting card is not chosen');
  assert.equal(p.take(0), true);
  assert.equal(p.take(0), false);
});
test('boardPlay: the right card glows after two misses on one slot, the board finishes, passes are source m', () => {
  const p = boardPlay(board());
  p.place('open', 0); p.check();
  p.place('open', 0); const r = p.check();
  assert.deepEqual(r.glow, { slot: 0, word: 'winter' });
  p.place('winter', 0); p.place('build', 1); p.place('open', 2);
  assert.equal(p.check().done, true);
  const ps = p.passes();
  assert.equal(ps.length, 3);
  assert.ok(ps.every((x) => x.source === 'm'));
  assert.equal(ps.find((x) => x.word === 'open').clean, false);
  assert.equal(ps.find((x) => x.word === 'winter').clean, true);
});
test('boardPlay: a board left halfway tells about missed words only', () => {
  const p = boardPlay(board());
  p.place('open', 0); p.check();
  assert.deepEqual(p.partial().map((x) => x.word), ['open']);
  assert.equal(p.partial()[0].clean, false);
});

test('textEntryFor: a ready-made word brings its example and the bank; an own word its info and cache, hidden ids removed', () => {
  const c = { word: 'receive', meaning: { example: 'I did not receive the letter.' } };
  const e = textEntryFor('receive', { bank, curriculum: c });
  assert.equal(e.sentence, 'I did not receive the letter.');
  assert.ok(e.statements.length >= 2);
  const own = textEntryFor('Zebra', { info: { zebra: { s: 'A zebra has stripes.', x: ['b'] } }, cache: { zebra: { s: [{ id: 'a', s: 'The zebra ran.' }, { id: 'b', s: 'A zebra ate.' }] } } });
  assert.equal(own.sentence, 'A zebra has stripes.');
  assert.deepEqual(own.statements, ['The zebra ran.']);
});
test('textEntryFor: an example whose gap does not fit is left out (the bank is used)', () => {
  const e = textEntryFor('quarter', { bank, curriculum: { word: 'quarter', meaning: { example: 'A quarter and a quarter.' } } });
  assert.equal(e.sentence, undefined);
});
test('mixPool: words with fewer than 2 statements sit out; an own word with its sentence needs one', () => {
  const pool = mixPool([{ word: 'winter', statements: ['The winter is cold.'] }, { word: 'build', statements: ['We build.', 'Can you build it?'] },
    { word: 'zebra', own: true, sentence: 'A zebra runs.', statements: ['The zebra ran.'] }, { word: 'open' }]);
  assert.deepEqual(pool.map((e) => e.word), ['build', 'zebra']);
});

test('the pages: pointer events, no HTML5 drag, no inline style attribute, slots and cards are buttons', () => {
  assert.match(src, /pointerdown/); assert.match(src, /setPointerCapture/);
  assert.doesNotMatch(src, /dragstart|draggable|dataTransfer/);
  assert.doesNotMatch(src.slice(src.indexOf('SB5 (WP-F1)')), /style="/);
  assert.match(src, /<button type="button" class="mixslot/);
  assert.match(src, /'Empty: '/); assert.match(src, /'Put ' \+ chosen \+ ' here: '/);
  assert.match(src, /aria-pressed/); assert.match(src, /'Escape'/);
  assert.match(src, /data-fold="slot"/); assert.match(src, /data-fold="keys"/);
});
test('the pages: spoken slot text is the visible sentence with the gap read as blank', () => {
  assert.match(src, /G\.readLine\(s\.before, s\.after\)/);
  assert.equal(G.readLine('The ', ' is cold.'), 'The blank is cold.');
});
test('the pages: Game day by year and week kind; the tests guard hides words; Meaning match is kept', () => {
  assert.match(src, /G\.dayGames\(year, St\.weekKind\(g\)\)/);
  assert.match(src, /St\.hiddenWords/);
  assert.match(src, /hidden: \[\.\.\.ctx\.hidden\]/);
  assert.match(src, /const PLAY = \{ missing, unjumble, match, fill, mix, quick \}/);
  assert.match(src, /meaning: c\.meaning|hasMeaning/);
});
test('mix.css: sizes, fold band, no :has, no sideways scroll rules, tokens only', () => {
  assert.doesNotMatch(css, /:has\(/);
  assert.match(css, /--clear: var\(--bottom-reserve\)/);
  assert.match(css, /\.mixcard \{[^}]*min-width: 64px; min-height: 52px/);
  assert.match(css, /\.mixslot \{[^}]*min-height: 56px/);
  assert.match(css, /touch-action: none/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-f]{3,6}\b/i, 'colours come from tokens');
});
test('a Year 5 board has 4 sentences and 5 cards with a spare, a Year 2 board 3 and 3 (through the pure rules)', () => {
  const es = Array.from({ length: 12 }, (_, i) => { const w = 'word' + String.fromCharCode(97 + i); return { word: w, statements: ['I like ' + w + ' a lot.', 'We saw ' + w + ' today.'] }; });
  const y5 = G.mixBoards(es, G.levelFor(5));
  assert.equal(y5[0].slots.length, 4); assert.equal(y5[0].cards.length, 5);
  const y2 = G.mixBoards(es, G.levelFor(2));
  assert.equal(y2[0].slots.length, 3); assert.equal(y2[0].cards.length, 3);
});
