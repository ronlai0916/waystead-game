// S2 round 4: grown-up pages leave room under every bar; the Set a week load cannot wait for ever.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (f) => readFileSync(new URL('../site/' + f, import.meta.url), 'utf8');
const SET = read('css/set.css');
const VIEWS = read('js/set-views.js');

test('the Set bar is sticky inside the page (nothing, footer links included, scrolls under it)', () => {
  const rule = /\.st-bar \{([^}]*)\}/.exec(SET)[1];
  assert.match(rule, /position: sticky/);
  assert.doesNotMatch(rule, /position: fixed/);
  assert.match(rule, /var\(--safe-zone\)/);
  assert.match(/\.st-page \{([^}]*)\}/.exec(SET)[1], /padding-bottom: 0/);
});
test('Results share block is in the page, not a sticky bar', () => {
  assert.match(read('css/lists.css'), /\.ls \.ls-bar--static \{ position: static; \}/);
  assert.match(read('js/results-views.js'), /ls-bar ls-bar--static/);
});
test('Set a week and Change a week: the account has 15 s, the side checks 3 s, each falls back', () => {
  assert.match(VIEWS, /const LOAD_MS = 15000;/);
  assert.match(VIEWS, /const SIDE_MS = 3000;/);
  assert.match(VIEWS, /within\(fetch\('data\/patterns\.json'\)[^\n]*SIDE_MS, \{ patterns: \[\] \}\)/);
  assert.match(VIEWS, /within\(ScD\.allowance\(accountOrigin\(location\)\), SIDE_MS, null\)/);
  assert.equal((VIEWS.match(/within\(A\.readMe\(api\), LOAD_MS/g) || []).length, 2);
  assert.doesNotMatch(VIEWS, /await Promise\.all\(\[A\.readMe/);
});
