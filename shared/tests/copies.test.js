// Each site serves its own copy of shared/account/ (tools/sync-shared.mjs).
// A copy that differs, is missing, or has an extra file fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SOURCE = ROOT + 'shared/account/';
const files = readdirSync(SOURCE).filter((f) => f.endsWith('.js')).sort();

for (const target of ['site/js/account/', 'wordbright/site/js/account/', 'hub/site/home-assets/js/account/']) {
  test(target + ' is an exact copy of shared/account/ (run node tools/sync-shared.mjs)', () => {
    assert.deepEqual(readdirSync(ROOT + target).sort(), files);
    for (const f of files) assert.ok(readFileSync(ROOT + target + f).equals(readFileSync(SOURCE + f)), target + f + ' differs');
  });
}

test('every shared file says it is a copy, and how to change it', () => {
  for (const f of files) assert.match(readFileSync(SOURCE + f, 'utf8'), /THIS FILE IS A COPY: edit shared\/account\/ and run `node tools\/sync-shared\.mjs`/, f);
});

test('nothing in the account client logs, or keeps a token, email or session id', () => {
  for (const f of files) {
    const code = readFileSync(SOURCE + f, 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /console\./, f + ' logs');
    assert.doesNotMatch(code, /sessionToken|document\.cookie|\.email\b/, f);
  }
});
