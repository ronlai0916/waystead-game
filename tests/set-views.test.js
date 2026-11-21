// SB5 (WP-D): the Set a week page. Pure markup renderers and helpers are read as strings; the page is checked in source and CSS.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as V from '../site/js/set-views.js';
import * as SD from '../site/js/set-doc.js';
import * as St from '../site/js/study-doc.js';
import * as W from '../site/js/words-doc.js';

const SRC = readFileSync(new URL('../site/js/set-views.js', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('../site/css/set.css', import.meta.url), 'utf8');
const TODAY = '2026-11-22';
const TEST = '2026-11-27';

test('the button names who it is for, by role', () => {
  assert.equal(V.setButton('parent', ['Ben']), 'Set a week for Ben');
  assert.equal(V.setButton('parent', ['Ada', 'Cy']), 'Set a week for 2 children');
  assert.equal(V.setButton('tutor', ['Ben']), 'Set a week for Ben');
  assert.equal(V.setButton('teacher', ['A', 'B']), 'Set the class week');
});
test('the line over the button', () => {
  const b = (o) => V.barLine({ role: 'parent', names: ['Ben'], count: 1, total: 3, start: TODAY, test: TEST, today: TODAY, ...o });
  assert.equal(b({}), 'Ben: Sun 22 to Fri 27 Nov (in 5 days)');
  assert.equal(b({ test: '2026-11-23' }), 'Ben: test tomorrow, Mon 23 Nov');
  assert.equal(b({ names: [] }), '');
  assert.equal(V.barLine({ role: 'teacher', names: ['A'], count: 5, total: 5, start: TODAY, test: TEST, today: TODAY }), 'All 5 children · test Fri 27 Nov');
});
test('D34: "Ada will see: Set by Mum" takes the name from the role', () => {
  assert.equal(V.willSeeLine('Ada', 'parent', 'Mum'), 'Ada will see: Set by Mum');
  assert.match(V.doneSub(['Ada'], 'teacher', 'Ms Patel'), /^Each child will see: Set by Ms Patel\.$/);
});
test('D39: the five date chips, one is on, and the picked date opens a date field', () => {
  const h = V.datesHtml({ today: TODAY, test: SD.chipTest(TODAY, 5), pick: false });
  assert.equal((h.match(/data-act="chip"/g) || []).length, 4);
  assert.match(h, /Pick a date/);
  assert.equal((h.match(/aria-pressed="true"/g) || []).length, 1);
  assert.doesNotMatch(h, /type="date"/);
  assert.match(V.datesHtml({ today: TODAY, test: '2026-12-01', pick: false }), /type="date"/);
});
test('the length line is plain help, and "test tomorrow" is an amber note that never blocks', () => {
  assert.match(V.lengthHtml(TODAY, '2026-11-23'), /class="st-warn/);
  assert.equal(V.lengthHtml(TODAY, '2026-11-23').includes('disabled'), false);
  const calm = V.lengthHtml(TODAY, '2026-11-29');
  assert.ok(!calm || calm.includes('st-help'));
});
test('D23: the preview is "What Ben will see first" with the day by day list and a sheet', () => {
  const kid = { nickname: 'Ben', year: 3, d: W.emptyDoc() };
  const m = V.previewModel({ role: 'parent', by: 'Mum', today: TODAY, test: TEST, words: ['fruit', 'group', 'build', 'early'], name: 'X', kids: [kid] });
  assert.ok(m && !m.error);
  assert.equal(m.heading, 'What Ben will see first');
  const html = V.previewHtml(m);
  assert.match(html, /What Ben will see first/);
  assert.match(html, /Ben will see: Set by Mum/);
  assert.match(html, /Day by day/);
  assert.match(html, /See what Ben will see first/);
  const sheet = V.sheetHtml(m);
  assert.match(sheet, /role="dialog" aria-modal="true"/);
  assert.match(sheet, /data-act="closesheet"/);
  assert.match(sheet, /Hello, Ben!/);
});
test('the preview is nothing until there are words, a child and a date', () => {
  assert.equal(V.previewModel({ role: 'parent', today: TODAY, test: TEST, words: [], kids: [{ nickname: 'Ben', d: W.emptyDoc() }] }), null);
  assert.equal(V.previewModel({ role: 'parent', today: TODAY, test: '', words: ['a'], kids: [{ nickname: 'Ben', d: W.emptyDoc() }] }), null);
});
test('D45: the children group never shows more places than the plan holds', () => {
  const kids = Array.from({ length: 9 }, (_, i) => ({ id: 'c' + i }));
  assert.equal(V.shownKids(kids, 5).length, 5);
  assert.equal(V.shownKids(kids, 0).length, 0);
  assert.equal(V.shownKids(kids.slice(0, 2), 5).length, 2);
});
test('children group: all row, busy choice, limit line', () => {
  const h = V.kidsHtml({ kids: [{ id: 'a', nickname: 'Ada', on: true, small: '' }, { id: 'b', nickname: 'Cy', on: false, small: '' }, { id: 'c', nickname: 'Ben', on: true, small: '' }], title: 'Children', many: 'children', showAll: true, ticked: 2, allLine: '2 ticked', busy: [{ id: 'b', legend: 'Cy already has next week', replace: false }], limit: { line: '3 of 3 children', tail: ' on your plan.', ask: true, href: '#x' } });
  assert.match(h, /All 3 children/);
  assert.match(h, /data-all/);
  assert.match(h, /Replace it/);
  assert.match(h, /Ask for more places/);
  assert.equal(V.kidsHtml({ kids: [] }), '');
});
test('done pages: one child, several, partial, teacher', () => {
  const base = { role: 'parent', ok: [{ id: 'a', name: 'Ben', from: TODAY, test: TEST, gid: 'g' }], failed: [], test: TEST, sameTest: true, weekName: 'X', line: 'first 10 words', by: 'Mum', rest: ['wear', 'whether'], oid: 'r0123456789ab', notSet: [], notSetIds: [], links: { change: '#/grownups/child/a/plan/g' }, next: null, count: 1, total: 1 };
  const one = V.doneHtml(base);
  assert.match(one, /Week set for Ben/);
  assert.match(one, /Ben’s test is on Fri 27 Nov/);
  assert.match(one, /Ben will see: Set by Mum/);
  assert.match(one, /2 words are not in this week/);
  assert.match(one, /Set next week with the other 2/);
  const two = V.doneHtml({ ...base, ok: [base.ok[0], { id: 'b', name: 'Cy', from: TODAY, test: TEST, gid: 'h' }], rest: [] });
  assert.match(two, /Week set for Ben and Cy/);
  assert.match(two, /Their test is on Fri 27 Nov/);
  const part = V.doneHtml({ ...base, failed: [{ id: 'b', name: 'Cy', line: 'Nothing changed for Cy.' }], rest: [] });
  assert.match(part, /Couldn’t set Cy’s week/);
  assert.match(part, /Try again for Cy/);
  const t = V.doneHtml({ ...base, role: 'teacher', rest: [], count: 5, total: 5 });
  assert.match(t, /Class week set/);
  assert.match(t, /The class test is on Fri 27 Nov/);
  assert.match(t, /Each child will see: Set by /);
});
test('rename page: help, full and error', () => {
  const m = { title: '', sub: 'x', value: 'ab', help: 'Up to 40 letters.', error: '', useList: '', locked: false, backLabel: 'Ada', saveLine: 'x' };
  assert.match(V.renameHtml(m), /Rename this week/);
  assert.match(V.renameHtml({ ...m, value: 'x'.repeat(40) }), /40 letters, the most\./);
  const e = V.renameHtml({ ...m, error: 'Please give the week a name.', useList: 'Class 4 spellings' });
  assert.match(e, /Please give the week a name\./);
  assert.match(e, /Use the list’s name: Class 4 spellings/);
  assert.match(V.renameHtml({ ...m, locked: true }), /The test has started\./);
});
test('markup escapes what a grown-up types', () => {
  const h = V.wbwHtml({ find: '<img onerror=x>', msg: '', listName: '"><b>', words: [{ word: '<i>', source: 'Typed by you' }], suggest: [] });
  assert.doesNotMatch(h, /<img onerror/);
  assert.doesNotMatch(h, /value=""><b>/);
  assert.doesNotMatch(h, /<i>[a-z]*<\/i>/);
});
test('typed word suggestions offer the new word and the ready-made match with its year', () => {
  const h = V.suggHtml([{ word: 'bell', year: 4 }], 'bel');
  assert.match(h, /Year 4/);
  assert.match(h, /Add “bel” as a new word/);
  assert.match(h, /Not from a list/);
});
test('trim page: the 10 limit disables an unticked box', () => {
  const words = Array.from({ length: 15 }, (_, i) => 'w' + i);
  const h = V.trimHtml({ label: 'Class 4 spellings', words, ticked: words.slice(0, 10) });
  assert.match(h, /10 of 10 ticked/);
  assert.match(h, /10 ticked, a full week\. Untick one to swap a word\./);
  assert.match(h, /Done: use these 10/);
  assert.equal((h.match(/data-tick[^>]*disabled/g) || []).length, 5);
  assert.match(h, /data-addword[^>]*disabled/); // 15 words: a list holds up to 15, so no more can be added
});
test('week size line', () => {
  assert.equal(V.weekSizeLine(['a', 'b', 'c'], ['a', 'b', 'c']), '3 words');
  assert.equal(V.weekSizeLine(['a', 'b', 'c'], ['a', 'b']), 'first 2 words');
  assert.equal(V.weekSizeLine(['a', 'b', 'c'], ['a', 'c']), '2 of 3 words');
});
test('the Day by day list leaves nothing out of a plan', () => {
  const p = SD.previewFirst(W.emptyDoc(), { words: ['fruit', 'group', 'build'], test: TEST, name: 'X', by: 'Mum', year: 3 }, TODAY, 'parent');
  assert.ok(!p.error);
  const h = V.dayByDayHtml(p);
  assert.match(h, /<li><b>Sun<\/b> /);
  assert.match(h, /Test/);
  assert.ok(St.STEP_TEXT.mend.title.length);
});

// ---- the page's source and its CSS ----
test('no inline style attribute and no :has() in the source or the CSS', () => {
  assert.doesNotMatch(SRC, /\sstyle\s*=/);
  assert.doesNotMatch(SRC, /\.style\b/);
  assert.doesNotMatch(CSS, /:has\(/);
});
test('every CSS selector belongs to the page', () => {
  const sel = CSS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/:where\([^)]*\)/g, '').replace(/@media[^{]*\{/g, '').split('{').map((b) => b.split('}').pop().trim()).filter((s) => s && !/^[a-z-]+\s*:/.test(s));
  for (const s of sel.join(',').split(',').map((x) => x.trim()).filter(Boolean)) assert.match(s, /\.st-/, s);
});
test('the bar clears the bottom band and targets are 48px', () => {
  assert.match(CSS, /--safe-zone: var\(--bottom-reserve\)/);
  assert.match(CSS, /\.st-bar \{[^}]*var\(--safe-zone\)/);
  assert.match(CSS, /@media \(min-width: 720px\) and \(min-height: 600px\) \{ \.st-page \{ --safe-zone: 0px/);
  for (const c of ['.st-back', '.st-seg button', '.st-row', '.st-dates button', '.st-tog', '.st-sug']) assert.ok(CSS.includes(c), c);
  assert.ok((CSS.match(/min-height: 48px|min-height: 56px/g) || []).length >= 8);
  assert.match(CSS, /\.st-dates \{[^}]*repeat\(5, minmax\(0, 1fr\)\)/);
});
test('the sheet is a modal dialog and the page behind it is inert', () => {
  assert.match(SRC, /role="dialog" aria-modal="true"/);
  assert.match(SRC, / inert/);
  assert.match(SRC, /Escape/);
});
test('writes go through set-data only, in one place each', () => {
  assert.match(SRC, /SX\.setWeek/);
  assert.match(SRC, /SX\.changeWeek/);
  assert.doesNotMatch(SRC, /\bfetch\((?!'data\/patterns\.json')/);
  assert.doesNotMatch(SRC, /localStorage\.(set|remove)Item\([^)]*(words|progress)/);
});
test('the module loads without a page', () => {
  for (const n of ['setWeek', 'changeWeek', 'renameWeek', 'useSetTools']) assert.equal(typeof V[n], 'function');
});

// ---- the page end to end, on the fake account and a tiny fake `main` (no DOM) ----
test('the page sets a week for one child: words, children, date, Set, done page', async () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  globalThis.location = { hash: '', origin: 'https://account.example', hostname: 'localhost', search: '' };
  const { fakeAccount } = await import('../shared/tests/fake-account.js');
  const A = await import('../site/js/grownups-data.js');
  const who = await import('../site/js/who.js');
  const S = await import('../site/js/store.js');
  const Dt = await import('../site/js/data.js');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL('../site/' + u, import.meta.url), 'utf8')) });
  try { await Dt.loadData(); } finally { globalThis.fetch = realFetch; }
  const ADULT = '33333333-3333-4333-8333-333333333333';
  const kids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
  const acct = fakeAccount();
  acct.children = (id) => (id === ADULT ? kids.map((c, i) => ({ id: c, nickname: ['Ada', 'Cy'][i], year: 4, avatar: null })) : []);
  acct.who = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', childLimit: 5, plan: 'parent', playingAs: null };
  who.useWho(() => ({ kind: 'adult', id: ADULT, name: 'Sam' }));
  S.usePlayer(ADULT);
  globalThis.fetch = async (u, i) => (String(u).startsWith('data/') ? { ok: true, json: async () => ({ patterns: [] }) } : acct.fetch(u, i));
  V.useSetTools({ api: A.createChildApi({ origin: 'https://account.example', fetch: (u, i) => acct.fetch(u, i) }) });
  const L = {};
  const main = { innerHTML: '', addEventListener: (t, f) => { L[t] = f; }, removeEventListener() {}, querySelector: () => null };
  const click = (act, data = {}) => L.click({ target: { closest: () => ({ dataset: { act, ...data } }) } });
  const wait = () => new Promise((r) => setTimeout(r, 60));
  const stop = V.setWeek(main, {});
  await wait();
  assert.match(main.innerHTML, /Which words\?/);
  click('tab', { tab: 'ready' });
  click('year', { year: 'y4' });
  const ch = /data-chapter="([^"]+)"/.exec(main.innerHTML)[1];
  L.change({ target: { dataset: { chapter: ch }, value: ch, checked: true } });
  click('next');
  assert.match(main.innerHTML, /Who and when\?/);
  assert.match(main.innerHTML, /disabled/, 'no child ticked: Set is off');
  L.change({ target: { dataset: { kid: kids[0] }, checked: true } });
  click('chip', { days: '5' });
  assert.match(main.innerHTML, /What Ada will see first/);
  assert.match(main.innerHTML, /Set a week for Ada/);
  click('set');
  await wait(); await wait();
  assert.match(main.innerHTML, /Week set for Ada/);
  assert.match(main.innerHTML, /Cy has no week yet\./);
  assert.ok(acct.calls.some((c) => /PUT/.test(JSON.stringify(c))), 'one PUT went to the account');
  if (typeof stop === 'function') stop();
});
