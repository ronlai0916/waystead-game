// SB6 WP-1b: U-session (TR-26). One Step-by-step sitting, with a fake clock. (Named session6.test.js: tests/session.test.js is SB2c's.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../site/js/sbs-rules.js';
import { CODE, rungsFor } from '../site/js/ladder-doc.js';
import * as S from '../site/js/session-doc.js';
import * as W from '../site/js/words-doc.js';

const e = (word) => ({ word, chunks: [word] });
const NEW = { best: 0, days: [], secure: false, metOn: '' };
const KNOWN = { best: CODE.ALL, bestToday: 0, secure: false, days: ['2026-11-20'], metOn: '2026-11-20' };
const MET = (best) => ({ best, bestToday: 0, secure: false, days: ['2026-11-20'], metOn: '2026-11-20' });
const T0 = 1_000_000;
const SETUP = (min) => ({ sbs: { min, big: 0, after: '', at: 1 } });

const mkCtx = (words, facts = {}) => ({ words, facts: (w) => facts[w] || NEW, entries: (w) => e(w) });

// Plays a whole sitting. child(item, n) -> { tries, peeks }. Each item costs `step` ms.
function play(s0, ctx, child, { step = 15000, max = 600 } = {}) {
  let s = s0;
  let now = s0.startedAt;
  const log = [];
  for (let n = 0; n < max; n += 1) {
    const item = nextItem(s, ctx, now);
    if (item.kind === 'end') { s = S.afterItem(s, { item }, now, ctx); log.push({ item, now }); return { s, log, now }; }
    let out = item.kind === 'firstThen' || item.kind === 'break-offer' || item.kind === 'then' || item.kind === 'meet' ? {} : child(item, n);
    if (item.kind === 'row' && !out.perWord) out = { perWord: item.words.map((w) => (typeof out === 'function' ? out(w) : { ...out })) };
    now += step;
    s = S.afterItem(s, { item, ...out }, now, ctx);
    log.push({ item, out, now, last: s.last });
  }
  throw new Error('sitting did not end');
}
const nextItem = S.nextItem;
const clean = () => ({});
const spells = (log) => log.filter((x) => x.item.kind === 'rung' || x.item.kind === 'check');
const isClean = (x) => !(x.out && (x.out.tries || x.out.peeks));
const sit = (o = {}) => S.newSitting({ gid: 'g1', stone: 'hello', ss: 'ab12cd', startedAt: T0, year: 4, setup: SETUP(10), ...o });

test('new words per sitting by year: Years 1-2 three, Years 3-6 four, never more than 5, unknown year three', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((y) => S.newWordCap(y)), [3, 3, 4, 4, 4, 4]);
  assert.equal(S.newWordCap(undefined), 3);
  assert.equal(S.newWordCap(0), 3);
  assert.ok([1, 2, 3, 4, 5, 6].every((y) => S.newWordCap(y) <= RULES.session.newWords.max));
});

test('a sitting brings at most the cap of new words (by year), whatever the week holds', () => {
  const words = ['cat', 'dog', 'sun', 'hat', 'bed', 'pig', 'cup', 'map'];
  for (const [year, cap] of [[1, 3], [2, 3], [3, 4], [6, 4]]) {
    const r = play(sit({ year, setup: SETUP(15) }), mkCtx(words), clean, { step: 1000 });
    const started = r.s.done.filter((x) => x.isNew).length;
    assert.equal(started, cap, 'year ' + year);
    assert.equal(r.s.done.length, cap);
  }
});

test('review stones (Letter ladder, Mend) bring up to 5 words a sitting, each from startCode', () => {
  const words = ['cat', 'dog', 'sun', 'hat', 'bed', 'pig', 'cup'];
  const facts = Object.fromEntries(words.map((w) => [w, MET(3)]));
  const r = play(sit({ stone: 'fix', setup: SETUP(15) }), mkCtx(words, facts), clean, { step: 1000 });
  assert.equal(r.s.done.length, RULES.session.reviewWords);
  const first = r.log.find((x) => x.item.kind === 'rung' && x.item.start);
  assert.equal(first.item.code, 2, 'one rung below the best (3 letters word: best 3 -> 2)');
});

test('5, 10 and 15 minutes: the sitting length comes from the setup and the sitting ends between words once it is up', () => {
  for (const min of [5, 10, 15]) assert.equal(sit({ setup: SETUP(min) }).ms, min * 60000);
  assert.equal(sit({ setup: {} }).minutes, 10, 'default 10');
  const words = ['cat', 'dog', 'sun', 'hat', 'bed', 'pig'];
  const facts = Object.fromEntries(words.map((w) => [w, MET(3)]));
  // 20 s an item: a 5-minute sitting holds far fewer words than a 15-minute one
  const few = play(sit({ stone: 'fix', setup: SETUP(5) }), mkCtx(words, facts), clean, { step: 20000 }).s.done.length;
  const lots = play(sit({ stone: 'fix', setup: SETUP(15) }), mkCtx(words, facts), clean, { step: 20000 }).s.done.length;
  assert.ok(few < lots, `${few} < ${lots}`);
  assert.ok(few >= 1);
});

test('D22: the time cap ends the sitting between items; the word in hand is saved at its exact step and comes back first next sitting', () => {
  const words = ['beautiful', 'cat'];
  const facts = { beautiful: MET(2), cat: MET(2) };
  const r = play(sit({ stone: 'fix', setup: SETUP(5) }), mkCtx(words, facts), clean, { step: 60000 }); // a minute an item
  const spelt = spells(r.log).length;
  assert.ok(spelt >= 4 && spelt <= 6, 'five minutes, a minute an item: ' + spelt);
  const end = r.log.at(-1).item;
  assert.deepEqual([end.kind, end.normal], ['end', true]);
  assert.equal(end.resume.length, 1);
  assert.equal(end.resume[0].word, 'beautiful');
  assert.ok(end.resume[0].code > 2 && end.resume[0].code < CODE.ALL, 'saved part-way up');
  assert.equal(r.s.current.word, 'beautiful');
  // the next sitting: facts.resume (newest ladder try) puts the word first, at the step after a clean try
  const lastTry = spells(r.log).at(-1);
  const resume = { r: lastTry.item.code, clean: true, day: '2026-11-24', ss: 'ab12cd' };
  const next = nextItem(S.afterItem(sit({ stone: 'fix', ss: 'zz99zz' }), { item: { kind: 'firstThen' } }, T0, mkCtx(['cat', 'beautiful'], { cat: MET(2), beautiful: { ...MET(2), resume } })), mkCtx(['cat', 'beautiful'], { cat: MET(2), beautiful: { ...MET(2), resume } }), T0);
  assert.equal(next.word, 'beautiful');
  assert.equal(next.code, end.resume[0].code, 'the exact step');
});

test('D23: no word starts in the last 90 seconds, new or already met', () => {
  const s = sit({ setup: SETUP(5) });
  assert.equal(S.canStartNewWord(s, T0 + 5 * 60000 - 91000), true);
  assert.equal(S.canStartNewWord(s, T0 + 5 * 60000 - 90000), false, '90 s left is not more than 90 s');
  assert.equal(S.canStartNewWord({ ...s, newCount: s.newCap }, T0), false, 'the cap');
  const t = S.afterItem(s, { item: { kind: 'firstThen', plan: 2 } }, T0, mkCtx(['cat']));
  const now = T0 + 5 * 60000 - 60000;
  assert.equal(nextItem(t, mkCtx(['cat']), now).kind, 'end', 'a new word is not started with a minute left');
  assert.equal(nextItem(t, mkCtx(['cat'], { cat: MET(2) }), now).kind, 'end', 'nor a met one');
  assert.equal(nextItem(t, mkCtx(['cat'], { cat: MET(2) }), T0 + 5 * 60000 - 100000).kind, 'rung', 'with 100 s left it may');
  // a word already in hand carries on in the last 90 seconds
  const u = S.afterItem(t, { item: nextItem(t, mkCtx(['cat'], { cat: MET(2) }), T0 + 1000), tries: 0 }, T0 + 2000, mkCtx(['cat'], { cat: MET(2) }));
  assert.equal(nextItem(u, mkCtx(['cat'], { cat: MET(2) }), now).kind, 'rung');
});

test('time with a break left out: pausedMs is not counted', () => {
  let s = sit({ setup: SETUP(5) });
  s = S.afterItem(s, { item: { kind: 'break-offer' }, pausedMs: 120000 }, T0 + 130000, mkCtx([]));
  assert.equal(S.elapsedMs(s, T0 + 130000), 10000);
});

test('First / then card: "First: 3 words." "Then: a game."', () => {
  const words = ['cat', 'dog', 'sun', 'hat'];
  const s = sit();
  const item = nextItem(s, mkCtx(words), T0);
  assert.equal(item.kind, 'firstThen');
  assert.equal(item.plan, 4);
  assert.deepEqual(item.firstThen, { first: 'First: 4 words.', then: 'Then: a game.', game: 'meaning-match' });
  assert.equal(S.firstThenOf('hello', { ...s, plan: 1 }).first, 'First: 1 word.');
  assert.equal(S.firstThenOf('mend', { ...s, then: false, plan: 2 }).then, 'Then: we stop.');
  assert.equal(nextItem(sit({ year: 1 }), mkCtx(words), T0).plan, 3, 'the plan follows the year');
});

test('warnings: "last-word" before the last word when a game follows, "last-one" otherwise', () => {
  const words = ['cat', 'dog'];
  for (const [then, warn] of [[true, 'last-word'], [false, 'last-one']]) {
    const r = play(sit({ then }), mkCtx(words), clean);
    const starts = r.log.filter((x) => x.item.start);
    assert.equal(starts.length, 2);
    assert.equal(starts[0].item.warn, undefined);
    assert.equal(starts[1].item.warn, warn);
  }
  // the word cap makes the last word too
  const r = play(sit({ year: 1 }), mkCtx(['a1', 'b1', 'c1', 'd1', 'e1'].map((w) => w.replace(/\d/, 'x'))), clean);
  const starts = r.log.filter((x) => x.item.start);
  assert.equal(starts.length, 3);
  assert.equal(starts[2].item.warn, 'last-word');
});

test('break offers: after every 2 words and once after 8 minutes; never forced; no park trigger any more', () => {
  const words = ['cat', 'dog', 'sun', 'hat'];
  const r = play(sit({ year: 5, setup: SETUP(15) }), mkCtx(words), clean, { step: 1000 });
  assert.equal(r.log.filter((x) => x.item.kind === 'break-offer').length, 1, 'four words: one offer, after the second');
  const slow = play(sit({ stone: 'fix', setup: SETUP(15) }), mkCtx(['cat', 'dog'], { cat: MET(2), dog: MET(2) }), clean, { step: 150000 });
  assert.ok(slow.log.filter((x) => x.item.kind === 'break-offer').length <= 2);
  const s0 = S.afterItem(sit(), { item: { kind: 'firstThen', plan: 1 } }, T0, mkCtx([]));
  const s1 = S.afterItem(s0, { item: { kind: 'break-offer' } }, T0 + 5000, mkCtx([]));
  assert.equal(s1.paused, 0, 'passing the offer changes nothing about time');
});

test('the late offer comes once only', () => {
  const ctx = mkCtx(['cat', 'dog', 'sun'], { cat: MET(2), dog: MET(2), sun: MET(2) });
  let s = S.afterItem(sit({ stone: 'fix', setup: SETUP(15) }), { item: { kind: 'firstThen', plan: 3 } }, T0, ctx);
  const late = T0 + 9 * 60000;
  assert.equal(nextItem(s, ctx, late).kind, 'break-offer');
  s = S.afterItem(s, { item: { kind: 'break-offer' } }, late, ctx);
  assert.equal(nextItem(s, ctx, late + 1000).kind, 'rung', 'not again');
});

test('D22: a word left unfinished comes back first, at its exact step: the next rung after a clean try, the same rung after a slip', () => {
  const words = ['cat', 'dog', 'sun'];
  const f = (resume) => ({ cat: MET(2), dog: { ...MET(2), resume }, sun: MET(2) });
  for (const [resume, code] of [[{ r: 2, clean: true }, 3], [{ r: 2, clean: false }, 2], [{ r: 3, clean: false }, 3], [{ r: CODE.COPY, clean: true }, 2], [{ r: CODE.ALL, clean: true }, null]]) {
    const ctx = mkCtx(words, f(resume));
    const item = nextItem(S.afterItem(sit({ stone: 'fix' }), { item: { kind: 'firstThen' } }, T0, ctx), ctx, T0);
    if (code === null) assert.equal(item.word, 'cat', 'a finished word is not resumed');
    else assert.deepEqual([item.word, item.code], ['dog', code], JSON.stringify(resume));
  }
  // ctx.resume overrides (the runner may know better)
  const ctx = { ...mkCtx(words, f(null)), resume: { sun: 3 } };
  assert.deepEqual([nextItem(S.afterItem(sit({ stone: 'fix' }), { item: { kind: 'firstThen' } }, T0, ctx), ctx, T0)].map((x) => [x.word, x.code]), [['sun', 3]]);
});

test('ends on a success when it can: a child who slips on one word but not the others ends on a clean try (a quick check of a word that ended clean)', () => {
  const words = ['night', 'light', 'knee'];
  const known = { night: KNOWN, light: KNOWN, knee: KNOWN };
  for (const bad of [{ tries: 2 }, { peeks: 1 }]) {
    const hard = (item) => (item.word === 'night' && item.code !== CODE.COPY ? bad : {});
    const r = play(sit({ stone: 'fix', setup: SETUP(5) }), mkCtx(words, known), hard);
    const end = r.log.at(-1).item;
    assert.ok(isClean(spells(r.log).at(-1)), 'the last try is clean');
    assert.equal(end.clean, true);
    assert.equal(end.line, '');
    assert.ok(r.log.some((x) => x.item.kind === 'stuck' && x.item.word === 'night'), 'night got stuck and the sitting moved on');
  }
});

test('M5: a closing check never uses the word in hand, a stuck word or a word that ended unclean; with no word left the sitting ends calmly (clean: false, a calm line, nothing praised)', () => {
  const alwaysSlip = (item) => (item.code === CODE.COPY ? {} : { tries: 2 });
  const r = play(sit({ setup: SETUP(5) }), mkCtx(['night', 'light', 'knee']), alwaysSlip);
  const end = r.log.at(-1).item;
  assert.equal(end.clean, false);
  assert.equal(end.line, "That's all for today. See you next time.");
  assert.ok(!/well done|great|good|star|proud/i.test(end.line));
  assert.equal(end.resume[0].word, 'night', 'saved at its step, first in line');
  assert.ok(end.resume.every((x) => x.stuck || x.code >= CODE.COPY));
  const stuck = new Set(end.resume.map((x) => x.word));
  assert.ok(!r.log.some((x) => x.item.kind === 'check' && stuck.has(x.item.word)), 'never a stuck or unfinished word');
  assert.ok(!r.log.some((x) => x.item.kind === 'then'), 'no game of cards with nothing finished');
  // Letter ladder, one word slips, the other is known: the check is of the other word and the end is clean
  const hard = (item) => (item.word === 'night' && item.code !== CODE.COPY ? { tries: 2 } : {});
  const q = play(sit({ stone: 'fix', setup: SETUP(5) }), mkCtx(['night', 'light'], { night: KNOWN, light: KNOWN }), hard);
  assert.ok(q.log.filter((x) => x.item.kind === 'check').every((c) => c.item.word !== 'night'));
  assert.equal(q.log.at(-1).item.clean, true);
  // no word at all to check: never a check of the word in hand
  const one = play(sit({ stone: 'fix', setup: SETUP(5) }), mkCtx(['night'], { night: KNOWN }), alwaysSlip);
  assert.ok(!one.log.some((x) => x.item.kind === 'check' && x.item.word === 'night'));
  assert.equal(one.log.at(-1).item.clean, one.s.lastClean);
});

test('a child who cannot even copy still gets a finite sitting (at most closeTries closing checks)', () => {
  const r = play(sit({ stone: 'fix' }), mkCtx(['night'], { night: KNOWN }), () => ({ tries: 3 }));
  assert.equal(r.log.at(-1).item.kind, 'end');
  assert.ok(r.log.filter((x) => x.item.closing).length <= 2);
});

test('a clean child ends without a needless extra check; the new-word check follows each new word that reached the whole word', () => {
  const words = ['cat', 'dog'];
  const facts = { cat: NEW, dog: NEW, older: KNOWN };
  const ctx = { ...mkCtx(words, facts), known: ['older'] };
  const r = play(sit(), ctx, clean);
  const checks = r.log.filter((x) => x.item.kind === 'check');
  assert.equal(checks.length, 2, 'one check after each new word, none to close');
  assert.ok(checks.every((c) => !c.item.closing && c.item.code === CODE.ALL && c.item.j === 'k'));
  assert.equal(checks[0].item.word, 'older');
  // the second check is of a word already at the whole word: the first new word counts now
  assert.equal(checks[1].item.word, 'cat', 'not the word just done, and the least-checked one first');
});

test('D22 + D25: a word that is not clean stays in hand and steps back one rung each time (never below Copy) until it is stuck (3 step-backs); it is never swapped before that', () => {
  const ctx = mkCtx(['night', 'light'], { night: MET(3), light: MET(3) });
  const slippy = (item) => (item.word === 'night' && item.code !== CODE.COPY ? { tries: 2 } : {});
  const r = play(sit({ stone: 'fix', setup: SETUP(5) }), ctx, slippy, { step: 10000 });
  const items = r.log.map((x) => x.item);
  const iStuck = items.findIndex((x) => x.kind === 'stuck');
  assert.ok(iStuck > 0);
  const before = items.slice(0, iStuck).filter((x) => x.kind === 'rung');
  assert.ok(before.every((x) => x.word === 'night') && before.every((x) => x.code >= CODE.COPY));
  assert.equal(r.log.filter((x) => x.last && x.last.next === 'back' && x.last.word === 'night').length, 3, 'the third step-back makes it stuck');
  assert.deepEqual([items[iStuck].word, items[iStuck].line], ['night', 'This word is tricky today. Ask your grown-up.']);
  assert.ok(r.log.every((x) => !x.last || !('park' in x.last)), 'no park in the data');
  assert.equal(r.s.parked, undefined);
  // moved on, and not offered again in this sitting
  assert.ok(items.slice(iStuck + 1).some((x) => x.kind === 'rung' && x.word === 'light'));
  assert.ok(!items.slice(iStuck + 1).some((x) => x.word === 'night' && x.kind !== 'end'));
  assert.deepEqual(r.s.stuck.map((x) => x.word), ['night']);
  assert.equal(r.log.at(-1).item.resume[0].word, 'night');
  assert.equal(r.log.at(-1).item.resume[0].stuck, true);
  // a word that is slipped on a few times and then clean is done: it leaves only on a clean whole word
  let n = 0;
  const finally_ = () => { n += 1; return n <= 3 ? { tries: 1 } : {}; };
  const f = play(sit({ stone: 'fix', setup: SETUP(15) }), mkCtx(['night'], { night: MET(3) }), finally_, { step: 1000 });
  assert.ok(f.s.done.some((x) => x.word === 'night' && x.passedAll && x.clean));
  assert.equal(f.s.stuck.length, 0);
});

test('D25: a grown-up can set a word aside for TODAY (ctx.setAside(word, day)): skipped today, first in line next day; without the record nothing is skipped', () => {
  const words = ['night', 'light', 'knee'];
  const facts = { night: MET(2), light: MET(2), knee: MET(2) };
  const aside = (w, day) => w === 'night' && day === '2026-11-24';
  const ctx = { ...mkCtx(words, facts), setAside: aside };
  const r = play(sit({ stone: 'fix', day: '2026-11-24', setup: SETUP(15) }), ctx, clean, { step: 1000 });
  assert.ok(!r.log.some((x) => x.item.word === 'night'), 'skipped today');
  assert.deepEqual(r.s.done.map((x) => x.word), ['light', 'knee']);
  // the next day it is back, first, at its saved step
  const next = { ...ctx, facts: (w) => (w === 'night' ? { ...MET(2), resume: { r: 3, clean: false } } : facts[w]) };
  const t = nextItem(S.afterItem(sit({ stone: 'fix', day: '2026-11-25' }), { item: { kind: 'firstThen' } }, T0, next), next, T0);
  assert.deepEqual([t.word, t.code], ['night', 3]);
  // no record: D22, nobody is skipped
  const none = play(sit({ stone: 'fix', day: '2026-11-24', setup: SETUP(15) }), mkCtx(words, facts), clean, { step: 1000 });
  assert.equal(none.s.done.length, 3);
});

test('D25: a stuck word in a row steps out of the row (saved at its step); the row goes on with the others and is not offered again this sitting', () => {
  const rows = fakeRows(GROUPS(2, 2), () => 4);
  const r = playRows(rows, (w) => (w.word === 'night' ? { tries: 2, peeks: 0 } : cleanW()), { step: 5000 });
  const stuckItem = r.log.find((x) => x.last && x.last.kind === 'row' && x.last.words.some((w) => w.stuck));
  assert.ok(stuckItem);
  assert.ok(r.log.some((x) => x.item.kind === 'stuck' && x.item.word === 'night'));
  assert.ok(rowItems(r).filter((x) => x.start).length === 1);
  assert.equal(r.log.at(-1).item.resume.find((x) => x.word === 'night').stuck, true);
  assert.ok(r.s.done.some((x) => x.word === 'light' && x.passedAll));
});

test('the tries to write (the WP-6 contract): every Step-by-step try carries s "g" except Mend\'s ladder tries; Meet writes none; a row writes one per word with rw and j w', () => {
  const ctx = mkCtx(['cat'], { cat: NEW });
  const r = play(sit({ setup: SETUP(5) }), ctx, clean, { step: 1000 });
  const all = [];
  let st = sit({ setup: SETUP(5) });
  let now = T0;
  for (let i = 0; i < 80; i += 1) {
    const item = nextItem(st, ctx, now);
    if (item.kind === 'end') break;
    const out = ['firstThen', 'break-offer', 'then', 'meet'].includes(item.kind) ? {} : { tries: 0, peeks: 0 };
    now += 1000;
    st = S.afterItem(st, { item, ...out }, now, ctx);
    all.push(...S.triesOf(st, out).map((t) => ({ t, by: item.kind })));
  }
  assert.ok(all.length >= 4 && all.some((x) => x.t.j === 'h'));
  assert.ok(all.every((x) => x.t.source === 'g' && x.t.ss === 'ab12cd' && Number.isInteger(x.t.r) && !('pk' in x.t) && !('s' in x.t)));
  assert.ok(all.every((x) => (x.by === 'check' ? x.t.j === 'k' : x.t.j === 'h')));
  assert.ok(r.log.filter((x) => x.item.kind === 'meet').length === 1);
  // each try, written by W.addTry, is NOT the Normal practice flow (a try with no s would be flow p)
  let d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'x', test: '2026-12-01', words: ['cat'], today: '2026-11-24', now: 1 }).doc;
  all.forEach((x, i) => { d = W.addTry(d, { id: 'x' + i, group: 'g1', kind: 'p', day: '2026-11-24', now: 100 + i, ...x.t }); }); // the triesOf output, UNCHANGED (R-M1)
  assert.ok(d.results.every((x) => x.s === 'g'), 'every stored try carries s g');
  assert.ok(d.results.length >= 4 && d.results.every((x) => W.flowOf(x) === ''), 'no Normal flow');
  const g = W.groupById(d, 'g1');
  assert.equal(W.studyJobDay(d, g, 'practice'), '');
  assert.equal(W.studyJobDay(d, g, 'fix'), '');
  // Mend: ladder tries have no s
  const m = play(sit({ stone: 'mend', then: false }), mkCtx(['cat'], { cat: KNOWN }), clean, { step: 1000 });
  let ms = sit({ stone: 'mend', then: false });
  const mctx = mkCtx(['cat'], { cat: KNOWN });
  const mt = [];
  let t = T0;
  for (let i = 0; i < 40; i += 1) {
    const item = nextItem(ms, mctx, t);
    if (item.kind === 'end') break;
    const out = ['firstThen', 'break-offer', 'then', 'meet'].includes(item.kind) ? {} : { tries: 0 };
    t += 1000;
    ms = S.afterItem(ms, { item, ...out }, t, mctx);
    mt.push(...S.triesOf(ms, out));
  }
  assert.ok(mt.length >= 3 && mt.every((x) => x.j === 'm' && !('s' in x) && !('source' in x)));
  assert.ok(m.s.done.length === 1);
});

test('say: the first time each screen kind appears in the sitting, not after', () => {
  const r = play(sit(), mkCtx(['cat', 'dog']), clean);
  const byKind = {};
  for (const { item } of r.log) {
    const k = item.kind === 'rung' ? (item.code === CODE.COPY ? 'copy' : item.code >= CODE.ALL ? 'all' : 'rung') : item.kind;
    (byKind[k] = byKind[k] || []).push(item.say);
  }
  for (const [k, says] of Object.entries(byKind)) {
    assert.equal(says[0], true, k + ' first time');
    assert.ok(says.slice(1).every((x) => x === false), k + ' after');
  }
  assert.ok(Object.keys(byKind).length >= 5);
});

test('afterTime: "No practice after" compares the local time at the minute', () => {
  const su = { sbs: { min: 10, big: 0, after: '19:30', at: 1 } };
  assert.equal(S.afterTime(su, '19:29'), false);
  assert.equal(S.afterTime(su, '19:30'), true);
  assert.equal(S.afterTime(su, '23:59'), true);
  assert.equal(S.afterTime(su, '00:10'), false);
  assert.equal(S.afterTime({}, '23:59'), false, 'no limit set');
  assert.equal(S.afterTime(su, 'late'), false);
});

test('"Stop for now": the sitting ends at once, not as a normal end (no end mark)', () => {
  const ctx = mkCtx(['cat', 'dog']);
  let s = S.afterItem(sit(), { item: { kind: 'firstThen', plan: 2 } }, T0, ctx);
  s = S.afterItem(s, { item: nextItem(s, ctx, T0), stop: true }, T0 + 1000, ctx);
  const end = nextItem(s, ctx, T0 + 2000);
  assert.deepEqual([end.kind, end.normal], ['end', false]);
});

test('the Then game uses words already met, at most 3 cards, and only when at least 2', () => {
  const r = play(sit({ year: 5 }), mkCtx(['cat', 'dog', 'sun', 'hat']), clean);
  const then = r.log.find((x) => x.item.kind === 'then').item;
  assert.equal(then.game, 'meaning-match');
  assert.ok(then.cards <= RULES.meanings.cards && then.cards >= 2);
  assert.equal(r.log.find((x) => x.item.kind === 'end').item.normal, true);
  const one = play(sit(), mkCtx(['cat']), clean);
  assert.ok(!one.log.some((x) => x.item.kind === 'then'), 'one word: no game of cards');
  const none = play(sit({ then: false }), mkCtx(['cat', 'dog']), clean);
  assert.ok(!none.log.some((x) => x.item.kind === 'then'));
});

test('Mend: a word at the whole word goes on until 3 clean goes in a row (mend.allRunNeeded)', () => {
  const ctx = mkCtx(['night'], { night: KNOWN });
  const r = play(sit({ stone: 'mend', then: false }), ctx, clean);
  const alls = spells(r.log).filter((x) => x.item.code === CODE.ALL && x.item.word === 'night');
  assert.equal(alls.length, RULES.mend.allRunNeeded);
  assert.ok(alls.slice(1).every((x) => x.item.once));
  // a slip resets the run, and it is bounded
  let n = 0;
  const flaky = (item) => (item.code === CODE.ALL && (n += 1) === 2 ? { tries: 1 } : {});
  const q = play(sit({ stone: 'mend', then: false }), mkCtx(['night'], { night: KNOWN }), flaky);
  assert.ok(spells(q.log).filter((x) => x.item.code === CODE.ALL).length >= 4);
  const bad = play(sit({ stone: 'mend', then: false }), mkCtx(['night'], { night: KNOWN }), (item) => (item.code === CODE.ALL ? { tries: 1 } : {}));
  assert.equal(bad.log.at(-1).item.kind, 'end');
});

test('a sitting is finite for every kind of child (always slips, always Peeks, mixes) over a 10-word week: the clock or the item bound ends it, the word in hand is saved', () => {
  const words = ['night', 'light', 'friend', 'knee', 'because', 'beautiful', 'a', 'it', 'garden', 'accommodate'];
  const facts = Object.fromEntries(words.map((w, i) => [w, i % 3 === 0 ? NEW : MET(2 + (i % 4))]));
  const kids = [clean, () => ({ tries: 2 }), () => ({ peeks: 1 }), (it, n) => (n % 2 ? { tries: 1 } : {}), (it, n) => (n % 3 === 0 ? { peeks: 1 } : { tries: n % 2 })];
  for (const stone of ['hello', 'fix', 'mend']) {
    for (const k of kids) {
      for (const step of [4000, 1]) { // a fast child never runs the clock out: the item bound ends it
        const r = play(sit({ stone, year: 6, setup: SETUP(15) }), mkCtx(words, facts), k, { step });
        assert.equal(r.log.at(-1).item.kind, 'end', stone);
        assert.ok(r.log.length <= 220, 'bounded: ' + r.log.length);
        if (r.s.current) assert.equal(r.log.at(-1).item.resume[0].word, r.s.current.word);
      }
    }
  }
});

test('D9: several sittings a day are separate sittings with their own id and caps; a second sitting carries on with what is left', () => {
  const words = ['cat', 'dog', 'sun', 'hat', 'bed', 'pig'];
  const first = play(sit({ ss: 'aaaaaa', year: 3, setup: SETUP(15) }), mkCtx(words), clean, { step: 1000 });
  const left = words.filter((w) => !first.s.done.some((x) => x.word === w));
  assert.equal(left.length, 2);
  const second = play(sit({ ss: 'bbbbbb', year: 3, setup: SETUP(15) }), mkCtx(left), clean, { step: 1000 });
  assert.equal(second.s.done.length, 2);
  assert.equal(second.s.newCount, 2);
});

// ---- M1: the rows stone has its sitting (TR-25, TR-26) --------------------------------------------------------------
const GROUPS = (n, size) => {
  const words = ['night', 'light', 'fight', 'sight', 'right', 'might', 'tight', 'bright', 'flight', 'plight'].slice(0, n);
  const out = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size));
  return out.map((group, index, all) => ({ size, index, of: all.length, group, left: [...group] }));
};
// a fake of rows-doc rowsCtx: the runner's value changes as groups finish; `start` says each word's starting step
function fakeRows(groups, start = () => CODE.ALL - 0) {
  const todo = groups.map((g) => ({ ...g }));
  return { todo, next: () => todo[0] || null, start, plan: () => todo.length, finishFirst: () => todo.shift() };
}
function playRows(rows, child, { step = 5000, setup = SETUP(10), words = [] } = {}) {
  const ctx = { words, facts: () => KNOWN, entries: (w) => e(w), rows };
  let s = sit({ stone: 'practice', setup });
  let now = T0;
  const log = [];
  for (let n = 0; n < 500; n += 1) {
    const item = nextItem(s, ctx, now);
    if (item.kind === 'end') { s = S.afterItem(s, { item }, now, ctx); log.push({ item, now }); return { s, log }; }
    const out = ['firstThen', 'break-offer', 'then'].includes(item.kind) ? {} : (item.kind === 'row' ? { perWord: item.words.map((w) => child(w, item, n)) } : child(item, item, n));
    now += step;
    s = S.afterItem(s, { item, ...out }, now, ctx);
    if (s.last && s.last.kind === 'row' && s.last.done) rows.finishFirst();
    log.push({ item, out, now, last: s.last });
  }
  throw new Error('rows sitting did not end');
}
const rowItems = (r) => r.log.filter((x) => x.item.kind === 'row').map((x) => x.item);
const cleanW = () => ({ tries: 0, peeks: 0 });

test('rows sitting: First / then says rows; each row item holds several words with their own step, one Check each; a clean row climbs word by word', () => {
  const rows = fakeRows(GROUPS(4, 2), (size, w) => 2); // everyone starts at "1 letter missing"
  const r = playRows(rows, cleanW);
  const first = r.log[0].item;
  assert.equal(first.kind, 'firstThen');
  assert.deepEqual(first.firstThen, { first: 'First: 2 rows.', then: 'Then: a game.', game: 'meaning-match' });
  const items = rowItems(r);
  assert.ok(items[0].start && items[0].words.length === 2);
  assert.deepEqual(items[0].words.map((w) => w.code), [2, 2]);
  assert.deepEqual(items[1].words.map((w) => w.code), [3, 3], 'each word climbs one rung a clean Check (night: 5 letters)');
  assert.equal(items.filter((x) => x.start).length, 2, 'two rows');
  assert.ok(r.s.rowKeys.length === 2);
  assert.equal(r.s.done.length, 4);
  assert.ok(r.s.done.every((x) => x.passedAll && x.clean));
  assert.equal(r.log.at(-1).item.clean, true);
  assert.equal(r.log.at(-1).item.normal, true);
});

test('rows sitting: each word has its own ladder step; a word that is done keeps its boxes (kept) while the others carry on', () => {
  const rows = fakeRows(GROUPS(2, 2), (size, w) => (w === 'night' ? CODE.ALL : 2));
  const r = playRows(rows, cleanW);
  const items = rowItems(r);
  assert.deepEqual(items[0].words.map((w) => [w.word, w.code]), [['night', CODE.ALL], ['light', 2]]);
  assert.deepEqual(items[1].words.map((w) => w.word), ['light'], 'night is done after one clean whole word');
  assert.deepEqual(items[1].kept, ['night']);
  assert.ok(items.length >= 4);
  // a slip in a row: only that word repeats / steps back, the other is not touched
  let slipped = false;
  const rows2 = fakeRows(GROUPS(2, 2), () => 2);
  const r2 = playRows(rows2, (w, item) => (w.word === 'light' && item.words.length === 2 && !slipped && (slipped = true) ? { tries: 1, peeks: 0 } : cleanW()));
  const nexts = r2.log.filter((x) => x.last && x.last.kind === 'row').map((x) => x.last.words.map((w) => w.next));
  assert.deepEqual(nexts[0], ['up', 'repeat']);
  assert.ok(rowItems(r2)[1].words.find((w) => w.word === 'light').repeat);
  assert.equal(rowItems(r2)[1].words.find((w) => w.word === 'night').code, 3);
});

test('rows sitting: ends only between items on the clock (5/10/15 minutes) and saves each unfinished word at its step; the same group is not offered twice in a sitting', () => {
  for (const min of [5, 10, 15]) {
    const rows = fakeRows(GROUPS(10, 10), () => CODE.COPY);
    const r = playRows(rows, (w, item, n) => (n === 0 ? cleanW() : { tries: 1, peeks: 0 }), { step: 20000, setup: SETUP(min) });
    const end = r.log.at(-1).item;
    assert.equal(end.kind, 'end');
    assert.ok(r.log.at(-1).now - T0 >= min * 60000 - 20000, 'ran to the cap');
    assert.equal(end.resume.length, 10, min + ': the whole row is saved');
    assert.ok(end.resume.every((x) => x.code >= CODE.COPY && x.code < CODE.ALL), 'at its step');
  }
  // a group offered again after it was finished is not started again in the same sitting
  const rows = fakeRows(GROUPS(2, 2), () => CODE.ALL);
  rows.finishFirst = () => {}; // the runner has not moved on: next() keeps giving the same group
  const r = playRows(rows, cleanW);
  assert.equal(rowItems(r).filter((x) => x.start).length, 1);
  assert.equal(r.log.at(-1).item.kind, 'end');
});

test('rows sitting: no row starts in the last 90 seconds; break offers between rows; ends on a clean try, else calmly', () => {
  const rows = fakeRows(GROUPS(10, 2), () => CODE.ALL);
  const r = playRows(rows, cleanW, { step: 2000, setup: SETUP(5) });
  assert.equal(r.s.rowKeys.length, 5);
  assert.ok(r.log.some((x) => x.item.kind === 'break-offer'), 'after two words (one row of two... then offers every 2 words)');
  // time: a row never starts with <= 90 s left
  const s = S.afterItem(sit({ stone: 'practice', setup: SETUP(5) }), { item: { kind: 'firstThen' } }, T0, { rows: fakeRows(GROUPS(2, 2)) });
  assert.equal(nextItem(s, { words: [], facts: () => KNOWN, entries: (w) => e(w), rows: fakeRows(GROUPS(2, 2)) }, T0 + 5 * 60000 - 60000).kind, 'end');
  // a child who slips on every whole word: unclean at the cap, nothing to check, a calm end with the words saved
  const hard = playRows(fakeRows(GROUPS(2, 2), () => CODE.ALL), () => ({ tries: 2, peeks: 0 }), { step: 15000, setup: SETUP(5) });
  const end = hard.log.at(-1).item;
  assert.equal(end.clean, false);
  assert.ok(end.line.length > 0);
  assert.ok(end.resume.length >= 1);
});

test('rows sitting: the tries to write are one per word with j "w", rw = the row size, s "g" and the step; the item bound holds for a row of ten that never gets clean', () => {
  const rows = fakeRows(GROUPS(10, 10), () => CODE.COPY);
  const ctx = { words: [], facts: () => KNOWN, entries: (w) => e(w), rows };
  let s = S.afterItem(sit({ stone: 'practice' }), { item: { kind: 'firstThen', plan: 1 } }, T0, ctx);
  const item = nextItem(s, ctx, T0);
  const out = { perWord: item.words.map((w, i) => (i === 0 ? { tries: 2, peeks: 0 } : { tries: 0, peeks: 1 })) };
  s = S.afterItem(s, { item, ...out }, T0 + 1000, ctx);
  const tries = S.triesOf(s, out);
  assert.equal(tries.length, 10);
  assert.ok(tries.every((t) => t.j === 'w' && t.rw === 10 && t.source === 'g' && !('s' in t) && t.ss === 'ab12cd' && t.r === CODE.COPY));
  assert.deepEqual([tries[0].tries, tries[0].clean, tries[1].peeks, tries[1].clean], [2, false, 1, false]);
  // never clean: the clock or the bound ends it
  const hard = playRows(fakeRows(GROUPS(10, 10), () => CODE.COPY), () => ({ tries: 1, peeks: 0 }), { step: 1, setup: SETUP(15) });
  assert.equal(hard.log.at(-1).item.kind, 'end');
  assert.ok(hard.log.length <= 220);
});

test('F3: the end of a sitting names each word once, however many rows it was in (a 10-word week never says 90)', () => {
  const ctx = mkCtx(['cat', 'dog']);
  let s = S.afterItem(sit(), { item: { kind: 'firstThen', plan: 2 } }, T0, ctx);
  s = { ...s, done: [...Array(45)].flatMap(() => [{ word: 'cat', clean: true }, { word: 'dog', clean: true }]), wordsDone: 90, closed: true, stopped: false };
  const end = nextItem(s, ctx, T0 + 2000);
  assert.deepEqual(end.words, ['cat', 'dog']);
});
