// SB5 (R4): the About page, "How Spellbright works" (design 06d), and the Account row that opens it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ABOUT } from '../site/js/views.js';

const read = (p) => readFileSync(fileURLToPath(new URL('../' + p, import.meta.url)), 'utf8');
const all = [ABOUT.title, ABOUT.sub, ...ABOUT.sections.flat(), ABOUT.scan, ABOUT.licence, ABOUT.privacy, ABOUT.fonts].join(' | ');

test('06d: the sections, in order', () => {
  assert.equal(ABOUT.title, 'How Spellbright works');
  assert.equal(ABOUT.sub, 'For parents, teachers and tutors.');
  assert.deepEqual(ABOUT.sections.map((s) => s[0]), ['Set a week', 'Word lists', 'How a day goes', 'See how it is going', 'Three ways to use Spellbright', 'Lists stay with you', 'The name your children see', 'Sentences and AI']);
});
test('three ways to use it, and no sharing between grown-ups', () => {
  assert.match(all, /As a parent \(My own children\), as a tutor \(My learners\) or as a teacher \(My class\)/);
  assert.match(all, /Lists are not shared between grown-ups\./);
  assert.match(all, /“Set by Mum”\), never your email/);
});
test('the AI line is there, and says no name or work goes to an AI', () => {
  assert.match(all, /Spellbright uses AI to help write practice sentences\./);
  assert.match(all, /never send your child’s name or work to an AI/);
});
test('nothing of the old page is left: no 5 children, no Game mode, no sun or moon menu, no cover', () => {
  assert.doesNotMatch(all, /5 children|Game mode|Study mode|sun or moon|look menu|share it with them|\bcover, write/i);
  const src = read('site/js/views.js');
  const about = src.slice(src.indexOf('export function about('));
  assert.doesNotMatch(about, /Game mode|5 children|sun or moon/);
});
test('the Look picker is the four looks, and the Account row is "How Spellbright works"', () => {
  assert.match(read('site/js/views.js'), /lookHtml\('about-look-h'\)/);
  assert.match(read('site/js/child-views.js'), /LOOK_NAMES = \{ garden: 'Garden', paint: 'Paint', night: 'Night', system: 'Match device' \}/);
  assert.match(read('site/js/adult-chrome.js'), /row\(links\.parentsHref, I\.parents, 'How Spellbright works', 'For parents, teachers and tutors', ' data-parents'\)/);
});
