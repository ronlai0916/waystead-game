// SB4-WP4: D.lexicon() holds every curriculum word, lower case. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const site = (p) => fileURLToPath(new URL('../site/' + p, import.meta.url));
globalThis.fetch = async (url) => {
  const path = site(String(url));
  try { const body = readFileSync(path, 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; } catch (e) { return { ok: false, status: 404, json: async () => ({}) }; }
};
const D = await import('../site/js/data.js');
await D.loadData();

test('the lexicon holds every curriculum word in lower case', () => {
  const lex = D.lexicon();
  const words = D.allWords().map((e) => e.word);
  assert.ok(words.length > 100);
  for (const w of words) assert.ok(lex.has(w.toLowerCase()), w);
  for (const w of lex) assert.equal(w, w.toLowerCase());
  assert.ok(lex.has('their') && lex.has('there'), 'homophones are in');
});
test('built once', () => { assert.equal(D.lexicon(), D.lexicon()); });
