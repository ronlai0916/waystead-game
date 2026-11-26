// SB6 WP-6: the runner's pure parts (site/js/sbs-views.js). Run: node --test tests/sbs-views.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../site/js/sbs-views.js';
import * as W from '../site/js/words-doc.js';
import * as Runs from '../site/js/runs-doc.js';
import * as L from '../site/js/ladder-doc.js';
import { entryFor } from '../site/js/word-info.js';

const DAY = '2026-11-02';
const mk = (words = ['build', 'earth']) => W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week', test: '2026-11-07', words, today: DAY, now: Date.parse(DAY + 'T09:00:00') }).doc;
const E = (w) => ({ word: w, chunks: [w] });

test('the module imports without a DOM and exports the contract names', () => {
  for (const n of ['sbsStone', 'rungScreen', 'rowScreen', 'firstThenCard', 'breakScreen', 'endCard', 'previewRung', 'STEP_TEXT', 'STONE_TEXT', 'sbsCtx']) assert.ok(V[n], n);
});
test('every sentence a child reads here is 8 words or fewer, with none of the banned words', () => {
  for (const [k, v] of Object.entries(V.STEP_TEXT)) {
    assert.ok(v.split(/\s+/).length <= 8, k + ': ' + v);
    assert.doesNotMatch(v, /\b(wrong|fail|failed|incorrect|mistake|late|lost|error)\b/i, k);
  }
});
test('ctx.resume is Runs.resumeOf with the stone (Meet, Letter ladder, Mend), pinned', () => {
  let d = mk();
  const g = W.groupById(d, 'g1');
  const entryOf = (w) => entryFor(w) || E(w);
  const now = Date.parse(DAY + 'T10:00:00');
  for (const stone of ['hello', 'fix', 'mend']) {
    const j = { hello: 'h', fix: 'f', mend: 'm' }[stone];
    let x = d;
    x = W.addTry(x, { id: 'a' + stone, word: 'build', day: DAY, group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, source: 'g', now, j, r: 3, ss: 'abc123' });
    const ctx = V.sbsCtx({ d: x, g: W.groupById(x, 'g1'), step: stone, day: DAY, entryOf });
    const want = Runs.resumeOf(x.results || [], 'g1', 'build', entryOf('build'), { stone });
    assert.equal(ctx.resume('build'), want, stone);
    assert.equal(ctx.resume('earth'), Runs.resumeOf(x.results || [], 'g1', 'earth', entryOf('earth'), { stone }), stone + ' (no tries)');
    assert.equal(typeof ctx.setAside, 'function');
  }
  void g;
});
test('rows stone: ctx.rows is built with rowsCtx and resume is 0', () => {
  const d = mk(['build', 'earth', 'fruit']);
  const ctx = V.sbsCtx({ d, g: W.groupById(d, 'g1'), step: 'practice', day: DAY, entryOf: (w) => entryFor(w) || E(w) });
  assert.ok(ctx.rows);
  assert.equal(ctx.resume('build'), 0);
});
test('groupLens: a short word is one line; a long one splits at a chunk boundary, not inside the tricky run', () => {
  assert.deepEqual(V.groupLens({ word: 'build', chunks: ['build'] }), [5]);
  const l = V.groupLens({ word: 'because', chunks: ['be', 'cause'] });
  assert.equal(l.reduce((a, b) => a + b, 0), 7);
  assert.equal(l.length, 2);
  assert.equal(l[0], 2);
});
test('boxesHtml: gaps are boxes, other letters are shown, no inline style', () => {
  const h = V.boxesHtml({ word: 'earth', chunks: ['earth'] }, [1, 3]);
  assert.equal((h.match(/class="lgap"/g) || []).length, 2);
  assert.equal((h.match(/lshown/g) || []).length, 3);
  assert.doesNotMatch(h, /style=/);
});
test('lineFor: one instruction per rung', () => {
  const e = E('earth');
  assert.equal(V.lineFor(e, L.CODE.COPY), V.STEP_TEXT.copy);
  assert.equal(V.lineFor(e, L.CODE.ALL), V.STEP_TEXT.all);
  assert.equal(V.lineFor(e, L.CODE.ALL, { check: true }), V.STEP_TEXT.check);
});
