// Saving, merging, trimming and marks (compose/site/js/writing-doc.js), through
// the real sync client and the fake account. Run: node --test compose/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../site/js/writing-doc.js';
import { createSync } from '../../shared/account/sync.js';
import { createApi } from '../../shared/account/api.js';
import { fakeAccount } from '../../shared/tests/fake-account.js';

const T3 = { id: 'lost-kite', level: 3 };
const T5 = { id: 'seal-pup', level: 5 };
const start = (t = T3, id = 'p1', now = 1000) => W.startPiece(W.emptyDoc(), t, { id, now });
const write = (d, id, parts, now) => W.change(d, id, { parts }, now);

test('Year 3 has a box per picture; later years one', () => {
  assert.equal(start().pieces.p1.parts.length, 4);
  assert.equal(start(T5).pieces.p1.parts.length, 1);
});
test('the text joins the boxes into paragraphs, leaving out empty ones', () => {
  assert.equal(W.textOf(['One.', '', ' Three. ', '']), 'One.\n\nThree.');
});
test('the stages: write, handed in, one revision, final', () => {
  let d = write(start(), 'p1', ['My story.', '', '', ''], 2000);
  d = W.submit(d, 'p1', { checks: [{ id: 'words', ok: true, text: 'x' }], feedback: null }, 3000);
  assert.equal(d.pieces.p1.stage, 'feedback');
  assert.equal(d.pieces.p1.first, 'My story.');
  d = W.startRevision(d, 'p1', 4000);
  assert.equal(d.pieces.p1.stage, 'better');
  d = write(d, 'p1', ['My better story.', '', '', ''], 5000);
  d = W.finish(d, 'p1', 6000);
  assert.deepEqual([d.pieces.p1.stage, d.pieces.p1.final, d.pieces.p1.first], ['final', 'My better story.', 'My story.']);
  assert.equal(W.openPiece(d, 'lost-kite'), null);
  assert.deepEqual(W.finals(d).map((p) => p.id), ['p1']);
});
test('only one revision', () => {
  let d = W.submit(start(), 'p1', { checks: [] }, 2000);
  d = W.startRevision(d, 'p1', 3000);
  d = W.submit(d, 'p1', { checks: [] }, 4000);
  assert.equal(W.startRevision(d, 'p1', 5000).pieces.p1.stage, 'feedback');
});
test('merge: the newer copy wins, and the older words aren\'t lost', () => {
  const a = write(start(), 'p1', ['From the tablet.', '', '', ''], 2000);
  const b = write(start(), 'p1', ['From the phone.', '', '', ''], 3000);
  const m = W.merge(a, b);
  assert.equal(m.pieces.p1.parts[0], 'From the phone.');
  assert.equal(m.pieces.p1.other.text, 'From the tablet.');
});
test('merge: a finished copy beats a later unfinished one, words kept', () => {
  const done = W.finish(write(start(), 'p1', ['The end.', '', '', ''], 2000), 'p1', 2500);
  const later = write(start(), 'p1', ['Still going', '', '', ''], 9000);
  const m = W.merge(later, done);
  assert.equal(m.pieces.p1.final, 'The end.');
  assert.equal(m.pieces.p1.other.text, 'Still going');
});
test('merge: identical words leave no copy; merging is stable', () => {
  const a = write(start(), 'p1', ['Same.', '', '', ''], 2000);
  const m = W.merge(a, write(start(), 'p1', ['Same.', '', '', ''], 3000));
  assert.equal(m.pieces.p1.other, undefined);
  assert.deepEqual(W.merge(m, m), m);
  assert.deepEqual(W.merge(W.emptyDoc(), m), m);
});
test('merge: pieces from each device are all kept', () => {
  const m = W.merge(start(T3, 'a'), start(T5, 'b'));
  assert.deepEqual(Object.keys(m.pieces).sort(), ['a', 'b']);
});
test('merge: a reset wins over older pieces', () => {
  const m = W.merge(start(), W.reset(5000));
  assert.deepEqual(m.pieces, {});
});
test('trim: nothing happens under the limit', () => {
  const d = start();
  assert.equal(W.trim(d, 1), d);
});
function bigDoc(now) {
  let d = W.emptyDoc();
  for (let i = 0; i < 12; i += 1) {
    d = W.startPiece(d, { id: 't' + i, level: 5 }, { id: 'f' + i, now: i });
    d = write(d, 'f' + i, ['x'.repeat(2500)], i + 1);
    d = W.submit(d, 'f' + i, { checks: [] }, i + 2);
    d = W.finish(d, 'f' + i, i + 3);
    d = W.change(d, 'f' + i, { first: 'y'.repeat(2500) }, i + 4);
  }
  d = W.startPiece(d, { id: 'old', level: 5 }, { id: 'stale', now: now - 90 * 86400000 });
  d = write(d, 'stale', ['z'.repeat(20000)], now - 90 * 86400000);
  return d;
}
test('trim: old drafts go, finals stay, and it fits', () => {
  const now = Date.parse('2026-11-05');
  const big = bigDoc(now);
  assert.ok(W.sizeOf(big) > W.TRIM_AT);
  const t = W.trim(big, now);
  assert.ok(W.sizeOf(t) <= W.TRIM_TO, 'size ' + W.sizeOf(t));
  assert.equal(W.finals(t).length, 12);
  assert.ok(W.finals(t).every((p) => p.final.length === 2500));
  assert.equal(t.pieces.stale, undefined);
});
test('trim: an unfinished piece written recently stays', () => {
  const now = Date.parse('2026-11-05');
  let d = bigDoc(now);
  d = W.startPiece(d, { id: 'new', level: 5 }, { id: 'fresh', now: now - 1000 });
  assert.ok(W.trim(d, now).pieces.fresh);
});
test('a mark needs all five scores, 1 to 5; the comment is cut to size', () => {
  const ok = { ideas: 3, order: 4, words: 5, sentences: '2', spelling: 1, comment: 'c'.repeat(900) };
  const r = W.setMark(W.emptyMarks(), 'p1', ok, 10);
  assert.equal(r.doc.marks.p1.sentences, 2);
  assert.equal(r.doc.marks.p1.comment.length, 500);
  assert.match(W.setMark(W.emptyMarks(), 'p1', { ...ok, ideas: 0 }, 10).error, /each part/);
  assert.match(W.setMark(W.emptyMarks(), 'p1', { ...ok, words: 6 }, 10).error, /each part/);
  assert.match(W.setMark(W.emptyMarks(), 'p1', { ...ok, order: 2.5 }, 10).error, /each part/);
});
test('marks merge per piece, newest first', () => {
  const a = { v: 1, marks: { p1: { at: 1, comment: 'old' }, p2: { at: 1, comment: 'two' } } };
  const b = { v: 1, marks: { p1: { at: 2, comment: 'new' } } };
  const m = W.mergeMarks(a, b);
  assert.deepEqual([m.marks.p1.comment, m.marks.p2.comment], ['new', 'two']);
});
test('settings: AI feedback is off unless it\'s exactly true', () => {
  assert.equal(W.normaliseSettings(null).aiFeedback, false);
  assert.equal(W.normaliseSettings({}).aiFeedback, false);
  assert.equal(W.normaliseSettings({ aiFeedback: 'yes' }).aiFeedback, false);
  assert.equal(W.normaliseSettings({ aiFeedback: true }).aiFeedback, true);
});

// ---- through the real sync client -----------------------------------------------------
const KID = '11111111-1111-4111-8111-111111111111';
function device(acct, store) {
  const api = createApi({ origin: 'https://account.example', fetch: acct.fetch });
  const m = new Map();
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const docs = { [W.DOC_KEY]: { read: () => store.value, write: (v) => { store.value = W.normalise(v); }, merge: W.merge, prepare: (v) => W.trim(W.normalise(v), 1e13) } };
  return createSync({ api, game: 'compose', storage, playerId: KID, docs, setTimer: () => 0, clearTimer: () => {} });
}
test('a draft saves through /api/game/compose/writing, and a 409 loses nothing', async () => {
  const acct = fakeAccount();
  acct.who = { signedIn: true, kind: 'child', id: KID, nickname: 'Robin', year: 4, avatar: null, parentId: 'x' };
  const phone = { value: write(start(), 'p1', ['Phone words.', '', '', ''], 2000) };
  const tablet = { value: write(start(T5, 'p2'), 'p2', ['Tablet words.'], 2500) };
  const a = device(acct, phone);
  const b = device(acct, tablet);
  a.changed(W.DOC_KEY);
  await a.flush();
  b.changed(W.DOC_KEY);
  await b.flush(); // stale version: 409, merged, sent again
  const saved = W.normalise(acct.data.get(KID).get('compose/writing').value);
  assert.deepEqual(Object.keys(saved.pieces).sort(), ['p1', 'p2']);
  assert.ok(acct.calls.some((c) => c.path === '/api/game/compose/writing'));
});
test('offline: the queue keeps the draft and sends it later', async () => {
  const acct = fakeAccount();
  acct.who = { signedIn: true, kind: 'child', id: KID, nickname: 'Robin', year: 4, avatar: null, parentId: 'x' };
  const here = { value: start() };
  const s = device(acct, here);
  acct.offline = true;
  s.changed(W.DOC_KEY);
  await s.flush();
  assert.deepEqual(s.pending, [W.DOC_KEY]);
  acct.offline = false;
  await s.flush();
  assert.deepEqual(s.pending, []);
  assert.ok(acct.data.get(KID).get('compose/writing'));
});
test('a child can\'t write a parent\'s values: consent and marks are refused', async () => {
  const acct = fakeAccount();
  acct.who = { signedIn: true, kind: 'child', id: KID, nickname: 'Robin', year: 4, avatar: null, parentId: 'x' };
  const api = createApi({ origin: 'https://account.example', fetch: acct.fetch });
  for (const key of [W.SETTINGS_KEY, W.MARKS_KEY]) {
    const r = await api.putItem('compose', key, { v: 1, aiFeedback: true }, 0);
    assert.deepEqual([r.status, r.data.error], [403, 'parent-only-key'], key);
  }
});
