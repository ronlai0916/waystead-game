// SB4-WP13: an address with a bad %-piece never throws. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import { safeDecode } from '../site/js/chapters-doc.js';
import { testGuard } from '../site/js/test-guard.js';
import { jobTitle } from '../site/js/child-doc.js';

const JS = fileURLToPath(new URL('../site/js/', import.meta.url));
const BAD = ['%', '%25%', '%E0%A4%A', '%E0', '%C0%80', '%zz'];

test('safeDecode: a good piece decodes, a bad one is empty, nothing throws', () => {
  assert.equal(safeDecode('r%31'), 'r1');
  assert.equal(safeDecode('a%20b'), 'a b');
  assert.equal(safeDecode('plain'), 'plain');
  for (const b of BAD) assert.equal(safeDecode(b), '', b);
});

test('the test guard and the top-bar title take a bad group piece without throwing', () => {
  const d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week', test: '2026-11-09', words: ['fruit', 'earth'], today: '2026-11-02', now: Date.parse('2026-11-02T12:00:00Z') }).doc;
  for (const b of BAD) {
    assert.doesNotThrow(() => testGuard('words/g/:gid', { gid: b }, d, '2026-11-10', () => []), b);
    assert.doesNotThrow(() => jobTitle('words/g/' + b + '/test', d, '2026-11-10'), b);
  }
});

test('no page decodes an address piece without a guard', () => {
  for (const f of readdirSync(JS, { recursive: true }).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(JS + f, 'utf8');
    for (const [i, line] of src.split('\n').entries()) {
      if (!/decodeURI(Component)?\(/.test(line)) continue;
      const ok = /export (function|const) safeDecode/.test(line) || /try \{[^}]*decodeURI/.test(line);
      assert.ok(ok, f + ':' + (i + 1) + ' decodes without a guard: ' + line.trim().slice(0, 100));
    }
  }
});
