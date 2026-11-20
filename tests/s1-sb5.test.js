// SB5 S1 (round 4): child-side defects found in a real browser, pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as St from '../site/js/study-doc.js';
import * as W from '../site/js/words-doc.js';

const root = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');

test('a child with no week: roomState has no comeBack and Today copes (it crashed on r.comeBack.map)', () => {
  const r = St.roomState(W.emptyDoc(), '2026-11-16');
  assert.equal(r.status, 'none');
  assert.equal(r.comeBack, undefined, 'the shape the view must cope with');
  const src = read('site/js/child-views.js');
  assert.match(src, /\(r\.comeBack \|\| \[\]\)\.map/);
  assert.doesNotMatch(src, /[^(]r\.comeBack\.map/);
});

test('every stylesheet has balanced braces (a stray } swallowed the rule after it, so .backlink lost its 48 px height)', () => {
  const files = [...readdirSync(root('site/css')).filter((f) => f.endsWith('.css')).map((f) => 'site/css/' + f), ...readdirSync(root('site/css/styles')).map((f) => 'site/css/styles/' + f)];
  for (const f of files) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
    let depth = 0;
    css.split('\n').forEach((line, i) => {
      depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      assert.ok(depth >= 0, f + ' line ' + (i + 1) + ': a closing brace with nothing open');
    });
    assert.equal(depth, 0, f + ': unclosed braces');
  }
});

test('the Today footer ends above the 110 px band: its negative bottom margin is gone', () => {
  const css = read('site/css/child.css');
  assert.doesNotMatch(css, /\.today__foot \{[^}]*margin-bottom: calc\(-1/);
});

test('the fold harness checks letter keys at 32 x 48 and tiles and controls at 44 x 48 (D11)', () => {
  const src = read('tools/smoke-sb5/fold.mjs');
  assert.match(src, /m\.lw < 32 \|\| m\.lh < 48/);
  assert.match(src, /m\.tw < 44 \|\| m\.th < 48/);
});

test('phone fold compaction: keys 48 high and at least 32 wide, no pop-up room, in child.css', () => {
  const css = read('site/css/child.css');
  const block = css.slice(css.indexOf('SB5 S1 (round 4): FOLD'));
  assert.ok(block.length > 800);
  assert.match(block, /max-width: 600px\) and \(max-height: 820px\)/);
  assert.match(block, /min-width: 32px; height: 48px/);
  assert.doesNotMatch(block, /:has\(/);
});
