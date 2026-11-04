// SB2-4: Story day. Every story covers its chapter and is the right length; an
// unreviewed story is never shown; the sentence check. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as T from '../site/js/stories.js';
import * as St from '../site/js/study-doc.js';

const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const data = JSON.parse(readFileSync(file('site/data/stories.json'), 'utf8'));
const cur = JSON.parse(readFileSync(file('site/data/curriculum.json'), 'utf8'));
const chapters = ['year_3_4', 'year_5_6'].flatMap((k) => cur[k].chapters);
const chapter = (id) => chapters.find((c) => c.id === id);

test('one story for each of the 20 chapters', () => {
  assert.equal(chapters.length, 20);
  assert.deepEqual(data.stories.map((s) => s.chapter).sort(), chapters.map((c) => c.id).sort());
  assert.equal(new Set(data.stories.map((s) => s.title)).size, 20);
});
for (const s of data.stories) {
  test(s.chapter + ': every chapter word is in the story, at 120–200 words', () => {
    const text = s.sentences.join(' ');
    for (const { word } of chapter(s.chapter).words) assert.match(text, new RegExp('\\b' + word + '\\b', 'i'), word);
    const n = T.wordCount(s);
    assert.ok(n >= 120 && n <= 200, n + ' words');
  });
}
test('stories are as written: no straight-to-children flag, plain safe text', () => {
  for (const s of data.stories) {
    assert.equal(typeof s.reviewed, 'boolean');
    assert.ok(s.sentences.every((x) => typeof x === 'string' && x.trim() && !/[<>]/.test(x)), s.title);
  }
});
test('British spelling in the stories', () => {
  const text = data.stories.flatMap((s) => s.sentences).join(' ');
  assert.doesNotMatch(text, /\b(color|favorite|neighbor|center|realize|organize|theater|mom)\b/i);
});

const g = (words) => ({ words, back: [] });
const chs = chapters;
const ch1 = chapter('y34-ch01').words.map((w) => w.word);
const hidden = { chapter: 'y34-ch01', title: 'x', reviewed: false, sentences: ['a'] };
const shown = { ...hidden, reviewed: true };

test('a group from a chapter finds its chapter, even with some of its words', () => {
  assert.equal(T.chapterOf(g(ch1), chs).id, 'y34-ch01');
  assert.equal(T.chapterOf(g(ch1.slice(0, 3)), chs).id, 'y34-ch01');
});
test('a group with other words is from no chapter', () => {
  assert.equal(T.chapterOf(g(['tractor']), chs), null);
  assert.equal(T.chapterOf(g([ch1[0], chapter('y56-ch01').words[0].word]), chs), null);
  assert.equal(T.chapterOf(g([]), chs), null);
});
test('an unreviewed story is hidden', () => {
  assert.equal(T.storyFor([hidden], g(ch1), chs), null);
});
test('only reviewed: true will do', () => {
  assert.equal(T.storyFor([{ ...hidden, reviewed: 'yes' }], g(ch1), chs), null);
  assert.equal(T.storyFor([shown], g(ch1), chs), shown);
});
test('a group not from a chapter never gets a story', () => {
  assert.equal(T.storyFor([shown], g(['tractor']), chs), null);
});
test('as shipped, no story is live: all 20 wait for review', () => {
  assert.equal(data.stories.filter((s) => s.reviewed).length, 0);
  for (const c of chapters) assert.equal(T.storyFor(data.stories, g(c.words.map((w) => w.word).slice(0, 10)), chs), null, c.id);
});
test('the review page\'s switch can\'t release a story: Story day reads only the data file', () => {
  const src = readFileSync(file('site/js/study-views.js'), 'utf8');
  assert.match(src, /storyFor\(stories, g, D\.allChapters\(\)\)/);
  for (const f of ['site/js/stories.js', 'site/js/study-views.js']) assert.doesNotMatch(readFileSync(file(f), 'utf8'), /localStorage\.(get|set)/, f);
});
test('the review page is for adults only', () => {
  const src = readFileSync(file('site/js/story-views.js'), 'utf8');
  const body = src.slice(src.indexOf('export function storyReview'));
  assert.match(body.slice(0, 120), /adultOnly\(main\)/);
  assert.ok(body.indexOf('adultOnly') < body.indexOf('loadStories'), 'checked before the stories are fetched');
});
test('the approve tool sets the flag, takes it back, and refuses an unknown id', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stories-'));
  mkdirSync(join(dir, 'tools'));
  mkdirSync(join(dir, 'site/data'), { recursive: true });
  copyFileSync(file('tools/approve-stories.mjs'), join(dir, 'tools/approve-stories.mjs'));
  writeFileSync(join(dir, 'site/data/stories.json'), JSON.stringify({ stories: [{ ...hidden }, { ...hidden, chapter: 'y34-ch02' }] }));
  const run = (...a) => execFileSync(process.execPath, [join(dir, 'tools/approve-stories.mjs'), ...a], { stdio: 'pipe' }).toString();
  const read = () => JSON.parse(readFileSync(join(dir, 'site/data/stories.json'), 'utf8')).stories.map((s) => s.reviewed);
  run('y34-ch02');
  assert.deepEqual(read(), [false, true]);
  run('--off', 'y34-ch02');
  assert.deepEqual(read(), [false, false]);
  assert.throws(() => run('nope'));
  assert.deepEqual(read(), [false, false]);
});
test('the command the review page shows', () => {
  assert.equal(T.approveCommand(['y34-ch01', 'y56-ch02']), 'node tools/approve-stories.mjs y34-ch01 y56-ch02');
  assert.equal(T.approveCommand([]), '');
});
test('the week\'s words are picked out, whatever their capitals, and only whole words', () => {
  assert.deepEqual(T.lineParts('Build a builder a build.', ['build']).filter((p) => p.hit).map((p) => p.text), ['Build', 'build']);
  assert.equal(T.lineParts('Build a den.', ['build']).map((p) => p.text).join(''), 'Build a den.');
  assert.deepEqual(T.lineParts('No words', []), [{ text: 'No words', hit: false }]);
});
test('a sentence: the check on Story day', () => {
  assert.equal(St.checkSentence('The earth moves round the sun.', 'earth'), '');
  assert.notEqual(St.checkSentence('The erth moves round the sun.', 'earth'), '');
  assert.notEqual(St.checkSentence('Earth is big', 'earth'), '');
  assert.equal(St.checkSentence('Earth is very big', 'earth'), '');
});
test('every sentence has a recording name, for the Waystead voice', () => {
  assert.equal(T.lineKey({ chapter: 'y34-ch01' }, 3), 'y34-ch01-3');
});
