// SB4 content: the batch validator (tools/build-chapters.mjs) and the built curriculum.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validate, loadBatches, loadContext, ROOT } from '../tools/build-chapters.mjs';

const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const ctx = loadContext(ROOT);
const batches = loadBatches(ROOT);
const cur = ctx.curriculum;
const blocks = Object.entries(cur).filter(([k, v]) => k !== '_meta' && v && v.chapters);
const chapters = blocks.flatMap(([, v]) => v.chapters);
const allWords = chapters.flatMap((c) => c.words.map((w) => ({ w, c })));

test('statutory lists: 45 Year 1 words and 64 Year 2 words, no repeats', () => {
  assert.equal(ctx.lists.year1.length, 45);
  assert.equal(ctx.lists.year2.length, 64);
  assert.equal(new Set(ctx.lists.year1).size, 45);
  assert.equal(new Set(ctx.lists.year2).size, 64);
  assert.match(ctx.lists.credit, /Open Government Licence v3\.0/);
});

test('every batch file that exists validates', async (t) => {
  if (!Object.keys(batches).length) return t.skip('no batch files yet');
  const r = await validate(ROOT, { ctx, batches });
  assert.deepEqual(r.errors.map((e) => `[${e.batch}] ${e.where}: ${e.msg}`), []);
});

test('curriculum.json: every chapter has a year (once years are tagged)', (t) => {
  if (!chapters.some((c) => c.year !== undefined)) return t.skip('no chapter has a year yet (WP1 not merged)');
  for (const c of chapters) assert.ok(Number.isInteger(c.year) && c.year >= 1 && c.year <= 6, `${c.id} has no year`);
});

test('curriculum.json: each live year has 5 or 10 chapters', (t) => {
  if (!chapters.some((c) => c.year !== undefined)) return t.skip('no chapter has a year yet (WP1 not merged)');
  const n = {};
  for (const c of chapters) n[c.year] = (n[c.year] || 0) + 1;
  for (const [y, k] of Object.entries(n)) assert.ok(k === 5 || k === 10, `Year ${y} has ${k} chapters`);
});

test('curriculum.json: chunks join, meaning and example present, letters only', () => {
  for (const { w, c } of allWords) {
    assert.equal(w.chunks.join(''), w.word, `${c.id}/${w.word} chunks`);
    assert.ok(w.meaning && w.meaning.definition && w.meaning.example, `${c.id}/${w.word} meaning`);
    assert.doesNotMatch(w.word, /['’\- ]/, `${c.id}/${w.word} has an apostrophe, hyphen or space`);
  }
});

test('curriculum.json: Years 1 and 2, when built', (t) => {
  const y1 = cur.year_1 && cur.year_1.chapters, y2 = cur.year_2 && cur.year_2.chapters;
  if (!y1 && !y2) return t.skip('year_1 / year_2 are not built yet');
  for (const [list, ch, label] of [[ctx.lists.year1, y1, 'Year 1'], [ctx.lists.year2, y2, 'Year 2']]) {
    if (!ch) continue;
    const have = new Set(ch.flatMap((c) => c.words.filter((w) => w.set === 'cew').map((w) => w.word)));
    assert.deepEqual(list.filter((w) => !have.has(w)), [], `${label} statutory words missing`);
  }
  const exact = (ch, word) => assert.ok((ch || []).some((c) => c.words.some((w) => w.word === word)), `${word} missing, with that exact case`);
  if (y1) { exact(y1, 'a'); exact(y1, 'I'); }
  if (y2) { for (const w of ['Mr', 'Mrs', 'Christmas']) exact(y2, w); }
  if (y1) exact(y1, 'Monday');
  if (y2) {
    const busy = chapters.filter((c) => c.words.some((w) => w.word === 'busy'));
    assert.ok(busy.length >= 2, 'busy must be in two chapters');
  }
});

test('words with neither an MP3 nor a voice allow-list entry (printed, not a failure)', () => {
  const mp3 = new Set((ctx.assets.audioWords || []).map((s) => s.toLowerCase()));
  const none = [...new Set(allWords.map(({ w }) => w.word.toLowerCase()))].filter((w) => !mp3.has(w) && !ctx.allow.has(w));
  console.log(`# ${none.length} words with no MP3 and no voice allow-list entry` + (none.length ? ': ' + none.slice(0, 40).join(', ') + (none.length > 40 ? ', …' : '') : ''));
});
