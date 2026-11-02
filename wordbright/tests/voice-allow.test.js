// G9b: data/voice-allow.txt, the words the account's voice server may record:
// every playable word and Spellbright's curriculum words, sorted, then a sha256 line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DATA, ROOT } from './helpers.js';

const text = readFileSync(DATA + 'voice-allow.txt', 'ascii');

test('voice-allow.txt: every playable word and every Spellbright word (not the few with another game\'s name), sorted, lower case, a–z', () => {
  const lines = text.split('\n');
  assert.equal(lines.pop(), '', 'ends with a newline');
  const sha = lines.pop();
  const xlarge = readFileSync(ROOT + '../wordbright-design/wordlist/words_xlarge.txt', 'utf8').split('\n').filter(Boolean);
  const cur = JSON.parse(readFileSync(ROOT + '../site/data/curriculum.json', 'utf8'));
  const spell = ['year_3_4', 'year_5_6'].flatMap((k) => cur[k].chapters.flatMap((c) => c.words.map((w) => w.word.toLowerCase())));
  const NAMES = new RegExp(['scr', 'abble'].join('') + '|' + ['bin', 'go'].join(''));
  const want = [...new Set([...xlarge, ...spell])].filter((w) => !NAMES.test(w)).sort();
  assert.deepEqual(lines, want);
  assert.ok(lines.every((w) => /^[a-z]{1,20}$/.test(w)));
  assert.ok(['sin', 'rhythm', 'necessary', 'february'].every((w) => lines.includes(w)));
  // The last line: sha256 of all the lines above it.
  const body = lines.map((w) => w + '\n').join('');
  assert.equal(sha, 'sha256:' + createHash('sha256').update(body, 'ascii').digest('hex'));
});

test('voice-allow.txt holds no blocked word, and the service worker never keeps it', () => {
  const lines = new Set(text.split('\n'));
  for (const w of ['lewd', 'cuckold', 'suicide', 'kraut', 'testicles']) assert.ok(!lines.has(w), w);
  const sw = readFileSync(ROOT + 'site/sw.js', 'utf8');
  assert.match(sw, /if \(url\.pathname\.endsWith\('\/data\/voice-allow\.txt'\)\) return;/);
  assert.doesNotMatch(sw.slice(sw.indexOf('const SHELL'), sw.indexOf('];', sw.indexOf('const SHELL'))), /voice-allow/);
});
