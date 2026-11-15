// SB4: the child's setup read and written through the grown-ups data layer (it lives inside the words value).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as Su from '../site/js/setup-doc.js';
import * as A from '../site/js/grownups-data.js';
import { fakeAccount } from '../shared/tests/fake-account.js';

const KID = '11111111-1111-4111-8111-111111111111';
const ADULT = '33333333-3333-4333-8333-333333333333';
const MON = '2026-11-02';
const at = (day, h = 12) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':00:00Z');
const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));

function setUp() {
  const acct = fakeAccount();
  acct.children = (id) => (id === ADULT ? [{ id: KID, nickname: 'Robin', year: 1, avatar: null }] : []);
  acct.who = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const r = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week', test: '2026-11-09', words: ['fruit', 'earth'], today: MON, now: at(MON) });
  acct.put(KID, 'spellbright', 'words', r.doc);
  return { acct, api: A.createChildApi({ origin: 'https://account.example', fetch: acct.fetch }), doc: r.doc };
}

test('readChild returns the setup, empty when there is none', async () => {
  const { acct, api, doc } = setUp();
  assert.deepEqual((await A.readChild(api, KID)).setup, {});
  acct.put(KID, 'spellbright', 'words', W.withSetup(doc, Su.setHelp({}, 3, 1000, 'Sam')));
  const c = await A.readChild(api, KID);
  assert.equal(c.setup.help.lv, 3);
  assert.equal(c.words.setup.help.by, 'Sam');
});

test('changeSetup writes inside the words value and leaves the rest alone', async () => {
  const { api, doc } = setUp();
  const r = await A.changeSetup(api, KID, (s) => ({ setup: Su.setHelp(s, 2, 5000) }), { now: () => 6000 });
  assert.equal(r.ok, true);
  assert.equal(r.updated, false);
  assert.equal(r.doc.setup.help.lv, 2);
  const c = await A.readChild(api, KID);
  assert.equal(c.setup.help.lv, 2);
  assert.deepEqual(c.words.groups, doc.groups);
  const gone = await A.changeSetup(api, KID, () => ({ setup: {} }));
  assert.equal(gone.ok, true);
  assert.equal('setup' in (await A.readChild(api, KID)).words, false, 'an empty setup removes the field');
  assert.deepEqual(await A.changeSetup(api, KID, () => ({ error: 'too-many' })), { error: 'too-many' });
});

test('changeSetup retries on a 409 and keeps the child\'s newer tries', async () => {
  const { acct, api, doc } = setUp();
  let first = true;
  const racing = { ...api, put: async (id, key, value, version) => {
    if (first) {
      first = false;
      const g = W.groupById(doc, 'g1');
      acct.put(KID, 'spellbright', 'words', W.addTry(doc, { id: 'late1', word: 'fruit', day: MON, group: g.id, kind: 'p', tries: 0, peeks: 0, clean: true, now: at(MON, 13) }));
    }
    return api.put(id, key, value, version);
  } };
  const r = await A.changeSetup(racing, KID, (s) => ({ setup: Su.setProfile(s, 'sen', 9000) }));
  assert.equal(r.ok, true);
  assert.equal(r.updated, true);
  const c = await A.readChild(api, KID);
  assert.equal(c.words.results.length, 1, 'the child\'s try is kept');
  assert.equal(c.setup.profile.p, 'sen');
});

test('changeSetup passes a problem through', async () => {
  const { acct, api } = setUp();
  acct.who = { signedIn: false };
  const r = await A.changeSetup(api, KID, (s) => ({ setup: Su.setHelp(s, 2, 1) }));
  assert.equal(r.problem, 'signed-out');
  const other = await A.changeSetup(api, '99999999-9999-4999-8999-999999999999', (s) => ({ setup: s }));
  assert.ok(other.problem);
});

test('the setting lives in the words value only: no new account key', () => {
  const src = readFileSync(file('site/js/grownups-data.js'), 'utf8');
  assert.doesNotMatch(src, /put\(id, ['"]setup/);
  assert.doesNotMatch(readFileSync(file('site/js/store.js'), 'utf8'), /sb\.setup/);
});
