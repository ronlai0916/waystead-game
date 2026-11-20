// SB5 (S5): the fourteen defects S3 found in the site (agents/S3-coder.md S3-D1..D14), each pinned so it cannot come back.
// Pure parts run for real; layout and focus parts are read as source and CSS (the smoke scenes assert them in a real browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as V from '../site/js/set-views.js';
import * as Ow from '../site/js/own-doc.js';
import * as Sc from '../site/js/scan-doc.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const UI = read('site/js/ui.js');
const CHILD_CSS = read('site/css/child.css');
const APP_CSS = read('site/css/app.css');
const TRAY_CSS = read('site/css/tray.css');
const LISTS_CSS = read('site/css/lists.css');
const GU = read('site/js/grownups-views.js');
const SET = read('site/js/set-views.js');
const OWN = read('site/js/own-views.js');
const SCAN = read('site/js/scan-views.js');
const RES = read('site/js/results-views.js');
const CHROME = read('site/js/adult-chrome.js');
const FRONT = read('site/js/front-views.js');

test('S3-D1: with the pop-up room gone the key pop-up shows in the key row, not above it', () => {
  assert.match(UI, /getComputedStyle\(board, '::before'\)\.display === 'none'/);
  assert.match(UI, /keypop--side/);
  assert.match(UI, /pop\.style\.top = \(side \? key\.offsetTop : key\.offsetTop - 76\)/);
  assert.match(CHILD_CSS, /\.keypop--side \{ height: 48px;/);
  assert.match(CHILD_CSS, /\.keyboard::before \{ display: none; \}/, 'the rule that drops the room is the one the script reads');
});

test('S3-D2: the Help link is a quiet link at least 48 px high', () => {
  assert.match(GU, /<a class="gh-quiet" href="#\/grownups\/help" data-helplink>/);
  assert.match(read('site/css/grownups.css'), /\.gu \.gh-quiet \{[^}]*min-height: 48px/);
});

test('S3-D3: the week page loads the meanings of its typed words, then redraws only the word rows', () => {
  assert.match(GU, /import \{ findEntry, hasMeaning, meaningsFor \} from '\.\/word-info\.js'/);
  assert.match(GU, /meaningsFor\(typedNow\)\.then/);
  assert.match(GU, /ul\.innerHTML = words\.map\(\(w\) => wordRow\(/);
});

test('S3-D4: Change a week shows the passed-date note, only while the date is kept', () => {
  const m = { name: 'Robin', label: 'Week one', count: 3, dates: '<i>dates</i>', length: '', nameValue: '', saveLine: '', passed: 'The test date has passed. Robin\'s test opens when the jobs are done. You can pick a new date.' };
  assert.match(V.changeHtml(m), /The test date has passed\. Robin&#39;s test opens when the jobs are done\. You can pick a new date\.|The test date has passed\. Robin's test opens/);
  assert.ok(!/has passed/.test(V.changeHtml({ ...m, passed: '' })));
  assert.match(SET, /passed: g\.test < day && st\.test === g\.test \? P\.passedLine\(kid\.nickname\) : ''/);
});

test('S3-D5: the Set a week guard card is the home card (the child\'s name, Switch back to myself)', () => {
  assert.match(SET, /import \{ playingCard \} from '\.\/grownups-views\.js'/);
  assert.match(SET, /if \(playingAsChild\(\)\) \{ playingCard\(main\); return false; \}/);
  assert.match(GU, /export function playingCard\(main\)/);
  assert.match(GU, /data-switchback/);
});

test('S3-D6/D7: after a Menu row, the page\'s h1 takes focus even when the page redraws', () => {
  assert.match(CHROME, /function keepHeadingFocus\(\)/);
  assert.match(CHROME, /new MutationObserver\(/);
  assert.match(CHROME, /if \(!chose\) return;\s*chose = false;[^}]*\n\s*keepHeadingFocus\(\);/);
  assert.match(CHROME, /h\.setAttribute\('tabindex', '-1'\)/);
});

test('S3-D8: a year chosen on a child\'s Practice page keeps keyboard focus on that year button', () => {
  assert.match(FRONT, /paint\(\); b\.focus\(\{ preventScroll: true \}\); \}\)\);/);
});

test('S3-D9: the saved line on the Word lists editor says Saved. once', () => {
  assert.ok(!/data-saved>Saved\. '/.test(OWN), 'the view adds no second "Saved. "');
  const line = Sc.savedLineFor(0, [], (await_names) => 'Saved. Set a week with it, or give it to a child for practice.');
  assert.equal(line, 'Saved. Set a week with it, or give it to a child for practice.');
  assert.ok(!/Saved\. Saved\./.test(Sc.savedLineFor(2, [], () => 'x')));
});

test('S3-D10: the scan Done page takes its "more" button from scan-doc, the one source', () => {
  assert.equal(Sc.MORE_BUTTON, 'Make another list from the rest');
  assert.equal(Sc.moreButton, undefined, 'the unused second wording is gone');
  assert.match(SCAN, /more: Sc\.MORE_BUTTON/);
});

test('S3-D11: the Word lists library is newest first (TR-43), then by name', () => {
  let own = {};
  own = Ow.set(own, 'a', { name: 'Autumn', words: ['one'], src: 'typed', to: [] }, 1000).own;
  own = Ow.set(own, 'b', { name: 'Spring', words: ['two'], src: 'typed', to: [] }, 2000).own;
  own = Ow.set(own, 'c', { name: 'Trip', words: ['six'], src: 'typed', to: [] }, 3000).own;
  assert.deepEqual(Ow.liveNewest(own).map((e) => e.name), ['Trip', 'Spring', 'Autumn']);
  assert.deepEqual(Ow.live(own).map((e) => e.name), ['Autumn', 'Spring', 'Trip'], 'live() keeps its name order for the other pages');
  assert.match(OWN, /const live = Ow\.liveNewest\(own\)/);
});

test('S3-D12: results table cells never split a word on paper', () => {
  assert.match(LISTS_CSS, /\.ls \.gu-table:not\(\.t-table\) th/);
  assert.match(LISTS_CSS, /@media print \{ \.ls \.t-table th, \.ls \.t-table td \{ overflow-wrap: normal; \} \}/);
  assert.ok(!/\.ls \.gu-table th, \.ls \.gu-table td \{ overflow-wrap: anywhere/.test(LISTS_CSS), 'the rule that beat grownups.css is gone');
});

test('S3-D13: Results asks the account who is signed in again on a signed-out or playing answer', () => {
  assert.match(RES, /import \{ recheckWho \} from '\.\/who\.js'/);
  assert.match(RES, /if \(problem === 'signed-out' \|\| problem === 'playing'\) recheckWho\(\)/);
});

test('S3-D14: Hear and Peek on a phone on its side are 8 px apart, and a grown-up\'s tiles as far apart as a child\'s', () => {
  assert.match(APP_CSS, /body main > \.page\.spellpage\.tilepage \.peekrow \{ margin-top: 8px; \}/);
  assert.match(TRAY_CSS, /body \.keyboard\.keyboard--tray \{ gap: var\(--tgap\); \}/);
  assert.match(TRAY_CSS, /body \.keyboard--tray \.keyboard-row \{ gap: var\(--tgap\); \}/);
});
