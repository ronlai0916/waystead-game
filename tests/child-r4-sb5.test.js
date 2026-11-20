// SB5 (R4): the child's footer links, "Stop for now?", Look and voice, the inline back link, and the landscape rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as CV from '../site/js/child-views.js';

const read = (p) => readFileSync(fileURLToPath(new URL('../' + p, import.meta.url)), 'utf8');

test('07a: the four footer links, in order', () => {
  assert.deepEqual(CV.FOOT_LINKS.map((l) => l.text), ['Waystead Learning papers', 'Spellbright is part of Waystead', 'For parents', 'More games']);
  assert.equal(CV.FOOT_LINKS[2].href, '#/about');
});
test('the footer sits below the bottom safe zone on a phone, outside the Today section', () => {
  const css = read('site/css/child.css');
  assert.match(css, /\.today__foot \{ margin-top: var\(--safe-zone\); margin-bottom: 0; \}/);
  assert.match(read('site/js/child-views.js'), /<\/div><\/section>' \+ todayFoot\(\)/);
});
test('11d: the Stop sheet says where you are and what happens', () => {
  assert.deepEqual(CV.stopLines({ word: 3 }), ['Your place is saved.', 'You can come back to word 3. If you stop, you go to Today.']);
  assert.deepEqual(CV.stopLines({}), ['Your place is saved.', 'You can come back later. If you stop, you go to Today.']);
  assert.deepEqual(CV.stopLines({ word: 3, unsaved: true })[0], 'Your sentence is not saved yet.');
  const src = read('site/js/child-views.js');
  assert.match(src, /Keep going/);
  assert.match(src, /Stop and go to Today/);
  assert.doesNotMatch(src, /window\.confirm/, 'the sheet replaces the browser confirm');
});
test('10: the Menu has Look and voice between Games and Settings, and Settings is the account rows', () => {
  const ids = CV.menuItems({ gid: 'g', wordsGid: 'g', hasGroup: true, gamesOpen: true }).map((r) => r.id);
  assert.deepEqual(ids.slice(-2), ['look', 'settings']);
  assert.equal(CV.menuItems({ hasGroup: false }).find((r) => r.id === 'look').href, '#/look');
  assert.equal(CV.menuItems({ hasGroup: false }).find((r) => r.id === 'settings').sub, 'Switch player, account, sign out');
  const src = read('site/js/child-views.js');
  assert.match(src, /export function lookVoicePage/);
  assert.match(src, /Hear a sample/);
});
test('the four looks have the short names of 06d and 10d', () => {
  assert.deepEqual(Object.values(CV.LOOK_NAMES), ['Garden', 'Paint', 'Night', 'Match device']);
});
test('the inline back link', () => {
  const html = CV.backLink('Today', '#/');
  assert.match(html, /^<a class="backlink" href="#\/" data-backlink>/);
  assert.match(html, />Today<\/a>$/);
});
test('landscape phone rules are CSS only and use no :has or inline style', () => {
  const css = read('site/css/app.css');
  const block = css.slice(css.indexOf('SB5 (R4): a phone on its side'));
  assert.ok(block.length > 500);
  assert.doesNotMatch(block, /:has\(/);
  for (const f of ['views.js', 'child-views.js']) assert.doesNotMatch(read('site/js/' + f), /\sstyle="/, f);
});
