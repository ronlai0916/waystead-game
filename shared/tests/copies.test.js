// Each site serves its own copy of shared/account/ and shared/voice/
// (tools/sync-shared.mjs). A copy that differs, is missing, or has an extra
// file fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SETS } from '../../tools/sync-shared.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

for (const { source, targets } of SETS) {
  const files = readdirSync(ROOT + source).filter((f) => f.endsWith('.js')).sort();
  for (const target of targets) {
    test(target + ' is an exact copy of ' + source + ' (run node tools/sync-shared.mjs)', () => {
      assert.deepEqual(readdirSync(ROOT + target).sort(), files);
      for (const f of files) assert.ok(readFileSync(ROOT + target + f).equals(readFileSync(ROOT + source + f)), target + f + ' differs');
    });
  }
  test('every file in ' + source + ' says it is a copy, and how to change it', () => {
    const re = new RegExp('THIS FILE IS A COPY: edit ' + source.replace(/\//g, '\\/') + ' and run `node tools\\/sync-shared\\.mjs`');
    for (const f of files) assert.match(readFileSync(ROOT + source + f, 'utf8'), re, f);
  });
  test('nothing in ' + source + ' logs, or keeps a token, email or session id', () => {
    for (const f of files) {
      const code = readFileSync(ROOT + source + f, 'utf8').replace(/\/\/.*$/gm, '');
      assert.doesNotMatch(code, /console\./, f + ' logs');
      assert.doesNotMatch(code, /sessionToken|document\.cookie|\.email\b/, f);
    }
  });
}
