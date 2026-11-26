// SB6 WP-3 (TR-60, TR-61): the sentence-builder bank and its checker. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as B from '../tools/builder-check.mjs';
import { gapOf } from '../site/js/info-doc.js';

const ctx = B.makeContext();
const bank = JSON.parse(readFileSync(fileURLToPath(new URL('../site/data/builder.json', import.meta.url)), 'utf8'));
const res = B.checkBank(bank, ctx);

test('the bank passes every rule of the checker, and is the one the batches build', () => {
  assert.deepEqual(res.problems, []);
  const built = B.buildBank(B.loadSources(), ctx);
  assert.deepEqual(built.problems, []);
  assert.deepEqual(bank, built.bank, 'run: node tools/builder-check.mjs --build');
});
test('format (TR-60): meta, five groups, size', () => {
  assert.equal(bank._meta.v, 1);
  assert.equal(bank._meta.rules, B.RULES_VERSION);
  assert.equal(bank._meta.spotCheck, 'pending (Ron)');
  assert.deepEqual(Object.keys(bank.frames), B.GROUPS);
  assert.equal(bank._meta.frames, B.GROUPS.reduce((n, g) => n + bank.frames[g].length, 0));
  assert.ok(res.stats.bytes <= B.MAX_BYTES);
});
test('every curriculum word has a model sentence and frames of its own part of speech', () => {
  assert.equal(Object.keys(bank.w).length, ctx.curr.entries.size);
  const group = new Map();
  for (const g of B.GROUPS) for (const f of bank.frames[g]) group.set(f.id, g);
  for (const [word, e] of ctx.curr.entries) {
    const w = bank.w[word];
    assert.ok(w.f.length >= 1 && w.f.length <= B.F_PER_WORD, word);
    for (const id of w.f) assert.equal(group.get(id), B.groupOfPos(e.partOfSpeech), word + ' ' + id);
    assert.ok(gapOf(w.m, word), word);
  }
});
test('every frame has one {w}, exactly 3 cards in every other slot and at most 27 combinations', () => {
  for (const g of B.GROUPS) for (const f of bank.frames[g]) {
    assert.equal(f.t.split('{w}').length, 2, f.id);
    const keys = Object.keys(f.s);
    assert.ok(keys.length >= 1 && keys.length <= 3, f.id);
    for (const k of keys) assert.equal(f.s[k].length, 3, f.id);
    assert.ok(B.enumerate(f, 'x').length <= 27, f.id);
    const n = Math.max(...B.enumerate(f, 'x').map((e) => e.text.split(' ').length));
    assert.ok(n <= (f.y[0] <= 2 ? 8 : 12), f.id);
  }
});
test('no word of copy that is banned, no digit, no American spelling anywhere in the bank', () => {
  const text = JSON.stringify(bank);
  assert.doesNotMatch(text, B.BANNED_COPY);
  const strings = [...B.GROUPS.flatMap((g) => bank.frames[g].flatMap((f) => [f.t, ...Object.values(f.s).flat()])), ...Object.values(bank.w).map((e) => e.m)];
  for (const t of strings) assert.doesNotMatch(t, /\d/, t);
});
test('Years 1-2 models are at most 10 words, Years 3-6 at most 14', () => {
  for (const [word, e] of ctx.curr.entries) assert.ok(bank.w[word].m.split(' ').length <= (e.year <= 2 ? 10 : 14), word);
});
test('a Mr or Mrs model keeps his or her, so the two titles never swap', () => {
  assert.match(bank.w.Mr.m, /\bhis\b/);
  assert.match(bank.w.Mrs.m, /\bher\b/);
});
test('the checker refuses a bad frame, a bad card and a bad model', () => {
  const mk = (frame) => ({ ...bank, frames: { ...bank.frames, noun: [...bank.frames.noun, frame] } });
  const probs = (frame) => B.checkBank(mk(frame), ctx).problems.join('\n');
  const ok = { id: 'n900', t: 'The {w} sat by the {a}.', s: { a: ['door', 'gate', 'chair'] }, y: [1, 6] };
  assert.equal(B.checkBank(mk(ok), ctx).problems.length, 0);
  assert.match(probs({ ...ok, t: 'The sat by the {a}.' }), /exactly one \{w\}/);
  assert.match(probs({ ...ok, s: { a: ['door', 'gate'] } }), /exactly 3 cards/);
  assert.match(probs({ ...ok, t: 'The {w} sat by the {a} 5.' }), /digit/);
  assert.match(probs({ ...ok, t: 'The {w} sat by the {a} in the error.' }), /banned copy word/);
  assert.match(probs({ ...ok, t: 'The {w} sat by the {a} in the color.' }), /American spelling/);
  assert.match(probs({ ...ok, s: { a: ['door', 'gate', 'zorbflat'] } }), /not on the word lists/);
  assert.match(probs({ ...ok, s: { a: ['door', 'gate', 'Tom'] } }), /name|capital/);
  assert.match(probs({ ...ok, s: { a: ['door', 'gate', 'gun'] } }), /banned topic|blocked/);
  assert.match(probs({ ...ok, t: 'The {w} sat by the {a}' }), /full stop/);
  assert.match(probs({ ...ok, t: 'The {w} sat by the {a}. It was nice.' }), /more than one sentence/);
  assert.match(probs({ ...ok, t: 'The {w} sat by the {a} and the {b}.', s: { a: ['door', 'gate', 'chair'], b: ['door', 'gate'] } }), /exactly 3 cards/);
  assert.match(probs({ ...ok, t: 'The {w} sat by the {a} with the {b} and the {c} and {d}.', s: { a: ['door', 'gate', 'chair'], b: ['door', 'gate', 'chair'], c: ['door', 'gate', 'chair'], d: ['door', 'gate', 'chair'] } }), /combinations/);
  assert.match(probs({ ...ok, t: 'Here is the {w} and the {a} that the girl and boy and dog and cat like.', y: [1, 2] }), /words \(max 8/);
  assert.match(probs({ ...ok, id: 'n001' }), /used twice/);
  assert.match(probs({ ...ok, id: 'x1' }), /id must be/);
  assert.match(probs({ ...ok, y: [3, 2] }), /y must be/);
  const bad = (m) => B.checkBank({ ...bank, w: { ...bank.w, dogs: { ...bank.w.dogs, m } } }, ctx).problems.join('\n');
  assert.match(bad('The cat ran home.'), /whole word/);
  assert.match(bad('The dogs ran and the dogs hid.'), /whole word|appears more than once/);
  assert.match(bad('The dogs ran in the park and then they all went home to have tea at six.'), /model has \d+ words/);
  assert.match(bad('The dogs made a mistake.'), /banned copy word/);
  const nof = { ...bank.w }; delete nof.dogs;
  assert.match(B.checkBank({ ...bank, w: nof }, ctx).problems.join('\n'), /dogs: no entry/);
});
test('a frame is not given to a word that is one of its cards', () => {
  const f = bank.frames.noun.find((x) => x.id === 'n020');
  assert.ok(B.collides(f, 'garden') && B.collides(f, 'cars') && !B.collides(f, 'train'));
  for (const w of ['garden', 'box', 'door', 'bed', 'tree']) if (bank.w[w]) assert.ok(!bank.w[w].f.some((id) => B.collides(bank.frames.noun.find((x) => x.id === id) || { s: {}, t: '' }, w)), w);
});
test('voice report (BR-17 AC4): frames and models on the allow-list are found, a name that is not is reported', () => {
  const rep = B.voiceReport(bank, ctx);
  assert.equal(rep.frames.length, bank._meta.frames);
  assert.ok(rep.frames.filter((f) => f.ok).length > rep.frames.length * 0.9);
  assert.ok(rep.words.filter((w) => w.modelOk).length > 500);
  assert.deepEqual(B.unvoiced('We play in the garden.', ctx.allowed, ctx.names), []);
  assert.deepEqual(B.unvoiced('We play in the zorbflat.', ctx.allowed, ctx.names), ['zorbflat']);
  assert.match(B.voiceText(bank, rep), /Words missing from the allow-list/);
});

test('review rules: general verb frames, number agreement, body parts, dark nouns, food adjectives', () => {
  const w = (word, f) => B.checkBank({ ...bank, w: { ...bank.w, [word]: { ...bank.w[word], f } } }, ctx).problems.join('\n');
  assert.match(w('told', ['v001']), /general verb frame/);
  assert.match(w('find', ['v002']), /general verb frame/);
  assert.match(w('five', ['n071']), /only for "one"/);
  assert.match(w('eye', ['n001']), /body-part/);
  assert.match(w('ghost', ['n004']), /spectator/);
  assert.match(w('delicious', ['a001']), /animal or person/);
  assert.equal(w('five', ['n070']), '');
});
test('every word x frame line is in enumerated.txt (one block per word) and the file is current', () => {
  const text = B.enumeratedText(bank);
  assert.equal(text, readFileSync(fileURLToPath(new URL('../spellbright-design/sb6/content/enumerated.txt', import.meta.url)), 'utf8'));
  assert.equal((text.match(/^## /gm) || []).length, Object.keys(bank.w).length);
  assert.match(text, /Gran puts sugar in her tea\./);
});
test('no frame assumes a two-parent family and no frame has a fixed Mum or Dad', () => {
  for (const g of B.GROUPS) for (const f of bank.frames[g]) assert.doesNotMatch(f.t, /\b(Mum|Dad)\b/, f.id);
});

test('review rule: a person noun is never put in a box, a shed or a bed', () => {
  const w = (word, f) => B.checkBank({ ...bank, w: { ...bank.w, [word]: { ...bank.w[word], f } } }, ctx).problems.join('\n');
  const hiding = { ...bank, frames: { ...bank.frames, noun: [...bank.frames.noun, { id: 'n950', t: 'The {w} was in the {a}.', s: { a: ['box', 'car', 'garden'] }, y: [1, 6], sp: 1 }] }, w: { ...bank.w, woman: { ...bank.w.woman, f: ['n950'] } } };
  assert.match(B.checkBank(hiding, ctx).problems.join('\n'), /person is put in a box/);
  assert.equal(w('woman', ['n020']), '');
  assert.ok(bank.frames.noun.find((f) => f.id === 'n020').s.a.includes('hall'));
});
