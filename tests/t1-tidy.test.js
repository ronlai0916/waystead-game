// SB5 T1 tidy-up (23 Nov): the small leftovers of the user tests, each as a test. The browser halves are in tools/smoke-sb5/t1-pages.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as L from '../site/js/lists-doc.js';
import * as V from '../site/js/set-views.js';
import { createRoleStore } from '../site/js/role-data.js';

const src = (p) => readFileSync(new URL('../site/' + p, import.meta.url), 'utf8');
const OWN = src('js/own-views.js');
const GV = src('js/grownups-views.js');
const DEV = src('css/device.css');
const GUC = src('css/grownups.css');
const SETC = src('css/set.css');
const APPJS = src('js/app.js');
const BANNED = /\b(wrong|fail|failed|incorrect|mistake|late|lost|error)\b/i;

test('1: a child on a 411 px screen or less gets a full-width keyboard with 2 px gaps and keys at least 32 wide and 48 high', () => {
  const m = /@media \(max-width: 411px\) \{[^}]*body\.is-child \.keyboard\.keyboard[\s\S]*?\n\}/.exec(DEV);
  assert.ok(m, 'the 411 px block');
  assert.match(m[0], /width: 100vw !important/);
  assert.match(m[0], /gap: 2px/);
  assert.match(m[0], /\(100cqw - 22px\) \/ 10/);
  assert.match(m[0], /min-width: 32px/);
  assert.match(m[0], /:not\(\.keyboard--tray\)/);
  // the arithmetic: 10 keys and 9 gaps of 2 px, 2 px at each edge
  const key = (w) => (w - 22) / 10;
  assert.ok(key(360) > 33.5 && key(360) < 34);
  assert.ok(key(375) > 35 && key(390) > 36.5);
});

test('4: the name chips are tighter on a phone so Mum, Dad, Grandma and Grandad share a line at 390 px', () => {
  assert.match(GUC, /@media \(max-width: 480px\) \{\s*\.gu \.gh-namechips \{ gap: 4px; \}\s*\.gu \.gh-chipbtn \{ padding: 0 8px; \}/);
  assert.match(GUC, /\.gu \.gh-namechips \{ display: flex; flex-wrap: wrap;/, 'and they still wrap when there is no room');
});

test('5: the Add another week / Replace it radios take the style button colour, not the browser blue', () => {
  assert.match(SETC, /\.st-row input \{[^}]*accent-color: var\(--accent\)/);
  const h = V.kidsHtml({ kids: [{ id: 'a', nickname: 'Ada', on: true, small: '' }], title: 'Children', many: 'children', busy: [{ id: 'a', legend: 'Ada already has a week', replace: false }] });
  assert.match(h, /<label class="st-row[^"]*"><input type="radio"/);
});

test('6: a tap while a word is checked is queued with a status, and a later edit empties the status line', () => {
  assert.match(OWN, /if \(busy\) \{ waiting\.push\(text\); say\(L\.CHECKING_LINE\); return; \}/);
  assert.match(OWN, /const clearSay = \(\) => \{ live\.textContent = ''; \}/);
  assert.match(OWN, /if \(!\['pick', 'addnew', 'fix', 'remove'\]\.includes\(act\)\) clearSay\(\);/);
  assert.match(OWN, /body\.addEventListener\('input', \(ev\) => \{\s*const t = ev\.target;\s*clearSay\(\);/);
  assert.match(OWN, /body\.addEventListener\('change', \(ev\) => \{ clearSay\(\);/);
  assert.match(L.CHECKING_LINE, /checking the last word/);
});

test('7: the list page has two delete buttons with two different names', () => {
  assert.equal(L.PAGE.deleteList, 'Delete this list');
  const confirms = [...OWN.matchAll(/\{ id: 'yes', label: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(confirms.length >= 2);
  for (const c of confirms) { assert.equal(c, 'Yes, delete it'); assert.notEqual(c, L.PAGE.deleteList); }
  assert.doesNotMatch(OWN, /label: 'Delete this list'/);
});

test('8: the home legend is a key with a label, not a row of filters', () => {
  assert.match(GV, /data-stonekey><b class="gh-key__t">Key:<\/b> /);
  assert.match(GV, /aria-hidden="true"><\/span>Done /);
  assert.match(GUC, /\.gu \.gh-key__t \{/);
  assert.doesNotMatch(GV, /data-stonekey[^>]*>(?:(?!<\/p>).)*<button/);
});

test('9: the type-or-paste box says commas work too', () => {
  assert.equal(L.COPY.wordsLabel, 'Words, one on each line or with commas');
  assert.match(src('js/set-views.js'), /typeLabel: 'Words, one on each line or with commas'/);
  assert.match(OWN, /Words, one on each line or with commas<\/label>/);
  assert.doesNotMatch(L.COPY.wordsLabel, BANNED);
});

test('10: the pupil ticks on Who and when say what they do', () => {
  const base = { kids: [{ id: 'a', nickname: 'Ada', on: true, small: '' }, { id: 'b', nickname: 'Ben', on: false, small: '' }], title: 'Learner', many: 'learners', busy: [] };
  assert.match(V.kidsHtml({ ...base, one: 'learner' }), /<p class="st-help" data-tickhelp>Tick each learner who should get this week\.<\/p>/);
  assert.match(V.kidsHtml({ ...base, one: 'child in your class' }), /Tick each child in your class who should get this week\./);
  assert.doesNotMatch(V.kidsHtml(base), /data-tickhelp/);
  assert.doesNotMatch('Tick each child who should get this week.', BANNED);
});

// Round 2 (checker S1): the role page is asked for only after the account's prefs were read, by the router AND by the grown-ups page.
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } }; };
test('S1: with the prefs not yet read (/api/me answered first) nobody is asked; once read, a role found there means never; none there means ask', () => {
  const extras = {};
  const prefs = { loaded: false, extra: (k) => extras[k] || null };
  const store = createRoleStore({ storage: mem(), playerId: 'p1', prefs });
  assert.equal(store.shouldAsk(), true, 'the device knows nothing');
  assert.equal(store.askState(), 'wait', 'prefs still on their way: not asked');
  extras.sbRole = { r: 'teacher', n: 'Ms Patel', at: 5 };
  prefs.loaded = true;
  assert.equal(store.askState(), 'no', 'the account had a role: never asked');
  const none = createRoleStore({ storage: mem(), playerId: 'p2', prefs: { loaded: true, extra: () => null } });
  assert.equal(none.askState(), 'ask', 'read, and no role anywhere');
  assert.equal(createRoleStore({ storage: mem(), playerId: 'p3', prefs: null }).askState(), 'wait', 'no sync yet');
});
test('S1: landing() and grownups() both use askState (one rule, not two)', () => {
  assert.match(APPJS, /state = r\.askState\(\)/);
  assert.doesNotMatch(APPJS, /r\.shouldAsk\(\)/);
  assert.match(GV, /export function needsRole\(\) \{ const s = AC\.roleStore\(\); return !!s && s\.askState\(\) === 'ask'; \}/);
  assert.doesNotMatch(GV, /s\.shouldAsk\(\)/);
});
