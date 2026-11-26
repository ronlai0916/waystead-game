// SB6 phase 2 fix round b: the then-game's tries, the failed own-word picture, own words only to A6, no unmade builder sentence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as SD from '../site/js/session-doc.js';
import * as W from '../site/js/words-doc.js';

const src = (f) => readFileSync(new URL('../site/js/' + f, import.meta.url), 'utf8');

test('SF1: triesOf gives the meaning game one try per card: s m, j q, no r, no new kind', () => {
  const s = { ss: 'ss1', stone: 'practice', last: { kind: 'then' } };
  const t = SD.triesOf(s, { results: [{ word: 'build', tries: 2, clean: false }, { word: 'earth', tries: 1, clean: true }] });
  assert.deepEqual(t, [
    { word: 'build', j: 'q', ss: 'ss1', source: 'm', tries: 2, peeks: 0, clean: false },
    { word: 'earth', j: 'q', ss: 'ss1', source: 'm', tries: 1, peeks: 0, clean: true },
  ]);
  assert.deepEqual(SD.triesOf(s, {}), []);
  const day = '2026-11-02';
  let d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week', test: '2026-11-07', words: ['build', 'earth'], today: day, now: Date.parse(day + 'T09:00:00') }).doc;
  const g = W.groupById(d, 'g1');
  t.forEach((x, i) => { d = W.addTry(d, { id: 't' + i, group: 'g1', day, now: 10 + i, kind: W.kindOn(d, g, x.word, day), ...x }); });
  const rows = d.results.filter((r) => r.j === 'q');
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.s === 'm' && r.k === 'p'));
});
test('SF1: the runner writes the meaning game through writeTries, not W.addTry', () => {
  const v = src('sbs-views.js');
  const at = v.indexOf('function showThen');
  const body = v.slice(at, v.indexOf('function showEnd'));
  assert.match(body, /writeTries\(\{ results: res \}/);
  assert.doesNotMatch(body, /addTry/);
});

test('SF2: a failed own-word picture shows no letter inside [data-sbs] or .b6, and keeps it elsewhere', async () => {
  let handler = null;
  const mkEl = (tag) => ({ tag, children: [], dataset: {}, attrs: {}, className: '', textContent: '', setAttribute(k, v) { this.attrs[k] = v; }, append(...c) { this.children.push(...c); } });
  globalThis.document = { addEventListener: (t, f) => { if (t === 'error') handler = f; }, createElement: mkEl };
  await import('../site/js/ui.js?sf2');
  assert.ok(handler);
  const run = (inside) => {
    let swapped = null;
    const img = { tagName: 'IMG', dataset: { ownpic: 'night', letter: 'N', pos: 'noun' }, closest: (sel) => (inside && /data-sbs/.test(sel) ? {} : null), replaceWith: (n) => { swapped = n; } };
    handler({ target: img });
    return swapped;
  };
  const inside = run(true);
  assert.equal(inside.children[0].children.length, 0, 'plain neutral tile');
  const outside = run(false);
  assert.equal(outside.children[0].children[0].textContent, 'N');
  delete globalThis.document;
});

test('SF3: the child runner asks only for own words (curriculum words are filtered out)', () => {
  assert.match(src('sbs-views.js'), /PV\.loadApproved\(g\.words\.filter\(\(w\) => !findEntry\(w\)\)\)/);
});

test('SF4: the builder saves nothing when no level produced a sentence', () => {
  const b = src('builder-views.js');
  const at = b.indexOf('function finish()');
  const body = b.slice(at, b.indexOf('show(levels[0])'));
  assert.doesNotMatch(body, /models\[0\]/);
  assert.match(body, /if \(!result\) \{ leave\(\); if \(opts\.onDone\) opts\.onDone\(null\); return; \}/);
});
