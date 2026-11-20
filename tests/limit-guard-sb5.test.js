// SB5 M4 (CODE-CHECK-2): RELEASE GATE. The child limit stays 5 in the client unless the account says more, because grown-up devices
// on the 16c build cut a list's `to` back to 5 when they re-save. Do NOT raise these numbers. Ship a childLimit above 5 from the
// account only after every 16c grown-up device has updated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as A from '../site/js/grownups-data.js';
import * as Ow from '../site/js/own-doc.js';

const adult = (extra = {}) => ({ signedIn: true, kind: 'parent', ...extra });

test('M4: with no account answer, no childLimit, or a bad one, the limit is 5 (never more)', () => {
  assert.equal(A.DEFAULT_LIMIT, 5);
  for (const me of [null, undefined, {}, adult(), adult({ childLimit: null }), adult({ childLimit: 0 }), adult({ childLimit: 'ten' }), adult({ childLimit: 7.5 }), adult({ childLimit: 1001 }),
    { signedIn: false, kind: 'parent', childLimit: 12 }, { signedIn: true, kind: 'child', childLimit: 12 }]) {
    assert.equal(A.meFacts(me).limit, 5, JSON.stringify(me));
    assert.equal(A.meFacts(me).known, false);
  }
  for (const l of [undefined, null, 0, -1, NaN, '9']) assert.equal(A.childCap(l), 5, String(l));
});

test('M4: only an account that says more raises it, and never past the data cap of 15', () => {
  assert.equal(A.meFacts(adult({ childLimit: 3 })).limit, 3);
  assert.equal(A.meFacts(adult({ childLimit: 8 })).limit, 8);
  assert.equal(A.childCap(8), 8);
  assert.equal(A.childCap(500), Ow.MAX_TO);
  assert.equal(Ow.MAX_TO, 15);
});

test('M4: the release gate is written beside DEFAULT_LIMIT, and no other client file sets its own bigger default', () => {
  const src = readFileSync(new URL('../site/js/grownups-data.js', import.meta.url), 'utf8');
  assert.match(src, /RELEASE GATE[\s\S]{0,700}export const DEFAULT_LIMIT = 5;/);
  for (const f of ['set-views.js', 'own-views.js', 'own-data.js', 'grownups-views.js', 'lists-doc.js']) {
    const t = readFileSync(new URL('../site/js/' + f, import.meta.url), 'utf8');
    assert.doesNotMatch(t, /\b(childLimit|limit)\s*[:=]\s*(?:[6-9]|1\d)\b/, f + ' must not hard-code a limit above 5');
  }
});
