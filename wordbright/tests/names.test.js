// Keep other games' names and terms out of Wordbright (PLAN.md section 2).
// The patterns are built from pieces so this file does not match itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.js';

const BANNED = [
  ['scr', 'abble'],
  ['words with', ' friends'],
  ['triple', ' word'],
  ['double', ' letter'],
  ['bin', 'go'],
].map(([a, b]) => new RegExp(a + b, 'i'));

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

test('no banned names or terms anywhere in wordbright/', () => {
  const all = files(ROOT);
  assert.ok(all.length > 10);
  const hits = [];
  for (const f of all) {
    const text = readFileSync(f, 'latin1');
    for (const re of BANNED) if (re.test(text)) hits.push(`${f}: ${re.source}`);
  }
  assert.deepEqual(hits, []);
});
