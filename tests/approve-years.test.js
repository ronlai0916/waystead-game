// SB4-E/F: tools/build-chapters.mjs --approve for Year 1 and Year 2 (it creates the year_1 / year_2 blocks) and for Years 3 to 6
// (it appends to the old blocks). Runs on a temporary copy of the list as it was before SB4-E/F: only the 20 old chapters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approveYear, loadBatches, loadContext, ROOT } from '../tools/build-chapters.mjs';

const real = JSON.parse(readFileSync(join(ROOT, 'site/data/curriculum.json'), 'utf8'));
const OLD = /^y(34|56)-ch\d\d$/;
const before = () => {
  const o = JSON.parse(JSON.stringify(real));
  delete o.year_1;
  delete o.year_2;
  for (const k of ['year_3_4', 'year_5_6']) o[k].chapters = o[k].chapters.filter((c) => OLD.test(c.id));
  return o;
};
const tmpRoot = (cur) => {
  const root = mkdtempSync(join(tmpdir(), 'approve-'));
  mkdirSync(join(root, 'site/data'), { recursive: true });
  writeFileSync(join(root, 'site/data/curriculum.json'), JSON.stringify(cur, null, 2));
  return root;
};
const read = (root) => JSON.parse(readFileSync(join(root, 'site/data/curriculum.json'), 'utf8'));
// the batch files are only read here (a sign-off would write them): hand approveYear copies in memory
const batches = () => {
  const b = loadBatches(ROOT);
  for (const v of Object.values(b)) { v.data = JSON.parse(JSON.stringify(v.data)); v.file = join(tmpdir(), 'approve-batch-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.json'); }
  return b;
};
const ctx = loadContext(ROOT);

test('approving Year 1 creates year_1 before the old blocks, and leaves the old blocks and their keys alone', () => {
  const start = before();
  const root = tmpRoot(start);
  const r = approveYear(1, root, batches(), ctx);
  assert.equal(r.chapters, 10);
  const now = read(root);
  assert.deepEqual(Object.keys(now), ['_meta', 'year_1', 'year_3_4', 'year_5_6']);
  assert.equal(now.year_1.title, 'Year 1');
  assert.deepEqual(now.year_1.chapters.map((c) => c.id), real.year_1.chapters.map((c) => c.id));
  assert.ok(now.year_1.chapters.every((c) => c.year === 1 && c.signedOff === true));
  assert.deepEqual(now.year_3_4, start.year_3_4);
  assert.deepEqual(now.year_5_6, start.year_5_6);
  assert.equal(now._meta.credit, 'Department for Education, English Appendix 1: Spelling. Open Government Licence v3.0.');
});

test('approving Year 2 after Year 1 puts year_2 second; the other order gives the same file', () => {
  const a = tmpRoot(before());
  approveYear(1, a, batches(), ctx);
  approveYear(2, a, batches(), ctx);
  const b = tmpRoot(before());
  approveYear(2, b, batches(), ctx);
  approveYear(1, b, batches(), ctx);
  assert.deepEqual(Object.keys(read(a)), ['_meta', 'year_1', 'year_2', 'year_3_4', 'year_5_6']);
  assert.deepEqual(Object.keys(read(b)), ['_meta', 'year_1', 'year_2', 'year_3_4', 'year_5_6']);
  assert.deepEqual(read(a), read(b));
});

test('all six approvals on the old list give exactly the list in the repo, and a second run changes nothing', () => {
  const root = tmpRoot(before());
  for (const y of [1, 2, 3, 4, 5, 6]) approveYear(y, root, batches(), ctx);
  assert.deepEqual(read(root), real);
  const text = readFileSync(join(root, 'site/data/curriculum.json'), 'utf8');
  for (const y of [1, 2, 3, 4, 5, 6]) {
    const r = approveYear(y, root, batches(), ctx);
    assert.equal(r.changed, false, 'Year ' + y + ' changes nothing the second time');
  }
  assert.equal(readFileSync(join(root, 'site/data/curriculum.json'), 'utf8'), text);
});

test('every chapter of Years 1 to 6 holds words whose chunks join to the word; ids and the year_3_4 / year_5_6 keys are the old ones', () => {
  for (const k of ['year_1', 'year_2', 'year_3_4', 'year_5_6']) {
    for (const c of real[k].chapters) for (const w of c.words) assert.equal(w.chunks.join(''), w.word, c.id + '/' + w.word);
  }
  assert.deepEqual(real.year_3_4.chapters.filter((c) => OLD.test(c.id)).map((c) => c.id), Array.from({ length: 10 }, (_, i) => 'y34-ch' + String(i + 1).padStart(2, '0')));
  assert.deepEqual(real.year_5_6.chapters.filter((c) => OLD.test(c.id)).map((c) => c.id), Array.from({ length: 10 }, (_, i) => 'y56-ch' + String(i + 1).padStart(2, '0')));
});

test('an existing chapter is never rewritten: a changed batch is refused', () => {
  const root = tmpRoot(before());
  approveYear(1, root, batches(), ctx);
  const b = batches();
  b['y1-a'].data.chapters[0].words[0].meaning.definition = 'something else entirely';
  assert.throws(() => approveYear(1, root, b, ctx), /existing chapters are never changed/);
});
