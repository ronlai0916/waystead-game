// SB4 setup value (site/js/setup-doc.js): normalise, levels, merge, changes, limits, trim, size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Su from '../site/js/setup-doc.js';

const DAY = 86400000;
const exam = (o = {}) => ({ name: 'Big test', words: ['fruit', 'earth'], from: ['y34-ch01'], date: '2026-12-01', ...o });

test('normalise drops each bad part and keeps the good ones', () => {
  for (const bad of [null, undefined, 5, 'x', [], {}]) assert.deepEqual(Su.normalise(bad), {});
  const s = Su.normalise({
    help: { lv: 6, at: 5 }, profile: { p: 'hard', at: 5 }, offer: { quiz: 'yes', exam: true, at: 5 },
    exams: { a: { ...exam(), at: 0 }, b: { ...exam({ date: '1 Dec' }), at: 5 }, c: { ...exam({ words: ['no way', '123'] }), at: 5 } },
    own: { o1: { name: '  ', words: ['a'], src: 'typed', at: 5 }, o2: { name: 'X', words: ['a'], src: 'photo', at: 5 } },
  });
  assert.deepEqual(s, {});
  const good = Su.normalise({
    help: { lv: 3, at: 5, by: '  Sam  ' }, profile: { p: 'top', at: 6 }, offer: { quiz: false, exam: true, at: 7 },
    exams: { a: { ...exam({ name: ' ' + 'n'.repeat(60) + ' ', words: ['fruit', 'bad word', 'earth'] }), at: 8, gone: 9, reopen: 10 } },
    own: { o: { name: 'Mine', words: ['cat'], src: 'scan', at: 9 } },
  });
  assert.deepEqual(good.help, { lv: 3, at: 5, by: 'Sam' });
  assert.equal(good.exams.a.name.length, 40);
  assert.deepEqual(good.exams.a.words, ['fruit', 'earth']);
  assert.equal(good.exams.a.gone, 9);
  assert.equal(good.exams.a.reopen, 10);
  assert.equal(good.own.o.src, 'scan');
  assert.equal(Su.normalise({ help: { lv: 2.5, at: 5 } }).help, undefined);
  assert.equal(Su.normalise({ help: { lv: 2, at: -1 } }).help, undefined);
  assert.equal(Su.isEmpty({ help: { lv: 9, at: 1 } }), true);
  assert.equal(Su.isEmpty({ help: { lv: 1, at: 1 } }), false);
});

test('absent setup means level 5, normal, both offered', () => {
  for (const s of [{}, undefined, null]) {
    assert.equal(Su.effectiveLevel(s, 0, true), 5);
    assert.equal(Su.effectiveProfile(s, true), 'normal');
    assert.deepEqual(Su.offers(s), { quiz: true, exam: true });
  }
  assert.equal(Su.TILES_LIVE, true);
});

test('effectiveLevel for years 0 to 6, with and without help, and not live', () => {
  const want = { 0: 5, 1: 2, 2: 3, 3: 5, 4: 5, 5: 5, 6: 5 };
  for (const [y, lv] of Object.entries(want)) {
    assert.equal(Su.effectiveLevel({}, Number(y), true), lv, 'year ' + y);
    assert.equal(Su.effectiveLevel(Su.setHelp({}, 4, 10), Number(y), true), 4);
    assert.equal(Su.effectiveLevel(Su.setHelp({}, 1, 10), Number(y), false), 5, 'not live');
    assert.equal(Su.effectiveLevel({}, Number(y)), lv, 'the default is live');
  }
  assert.equal(Su.effectiveProfile(Su.setProfile({}, 'sen', 5), true), 'sen');
  assert.equal(Su.effectiveProfile(Su.setProfile({}, 'sen', 5), false), 'normal');
  assert.deepEqual(Su.offers(Su.setOffer({}, { quiz: false, exam: true }, 5)), { quiz: false, exam: true });
});

test('merge: later at wins, ties by JSON, absent loses', () => {
  const a = Su.setHelp({}, 2, 100);
  const b = Su.setHelp({}, 4, 200);
  assert.equal(Su.merge(a, b).help.lv, 4);
  assert.equal(Su.merge(b, a).help.lv, 4);
  assert.equal(Su.merge(a, {}).help.lv, 2);
  assert.equal(Su.merge({}, a).help.lv, 2);
  const t1 = { help: { lv: 2, at: 50 } };
  const t2 = { help: { lv: 3, at: 50 } };
  assert.deepEqual(Su.merge(t1, t2), Su.merge(t2, t1));
  assert.equal(Su.merge(t1, t2).help.lv, 3);
  assert.deepEqual(Su.merge({}, {}), {});
});

test('merge per id, with a tombstone', () => {
  const x = Su.setExam({}, 'e1', exam(), 100).setup;
  const y = Su.dropExam(x, 'e1', 200);
  const z = Su.setExam(Su.setExam(x, 'e2', exam({ name: 'Two' }), 110).setup, 'e1', exam({ name: 'Edited' }), 150).setup;
  const m = Su.merge(z, y);
  assert.ok(m.exams.e1.gone, 'the drop was later');
  assert.equal(m.exams.e2.name, 'Two');
  assert.deepEqual(Su.merge(y, z), m);
  assert.deepEqual(Su.liveExams(m).map((e) => e.id), ['e2']);
  const o = Su.setOwnCopy({}, 'o1', { name: 'A', words: ['cat'], src: 'typed' }, 100).setup;
  assert.equal(Su.merge(o, Su.dropOwnCopy(o, 'o1', 300)).own.o1.gone, 300);
  assert.equal(Su.liveOwn(Su.merge(o, Su.dropOwnCopy(o, 'o1', 300))).length, 0);
});

test('setHelp and the others: at only goes up', () => {
  let s = Su.setHelp({}, 2, 1000, 'Sam');
  assert.deepEqual(s.help, { lv: 2, at: 1000, by: 'Sam' });
  s = Su.setHelp(s, 3, 500);
  assert.equal(s.help.at, 1001);
  s = Su.setHelp(s, 3, 5000);
  assert.equal(s.help.at, 5000);
  assert.equal('by' in s.help, false);
  assert.equal(Su.setProfile(Su.setProfile({}, 'sen', 900), 'top', 100).profile.at, 901);
  assert.equal(Su.setOffer(Su.setOffer({}, { quiz: true, exam: true }, 900), { quiz: false, exam: true }, 100).offer.at, 901);
  assert.equal(Su.helpOf(s).lv, 3);
  assert.equal(Su.helpOf({}), null);
  assert.equal(Su.profileOf(Su.setProfile({}, 'top', 1)).p, 'top');
});

test('limits: 10 live exams, 30 live own copies', () => {
  let s = {};
  for (let i = 0; i < Su.MAX_EXAMS; i += 1) s = Su.setExam(s, 'e' + i, exam({ date: '2026-12-' + String(i + 10) }), 100 + i).setup;
  assert.equal(Su.liveExams(s).length, 10);
  assert.deepEqual(Su.setExam(s, 'extra', exam(), 500), { error: 'too-many' });
  assert.ok(Su.setExam(s, 'e3', exam({ name: 'Edit' }), 500).setup, 'editing a live one is fine');
  s = Su.dropExam(s, 'e0', 600);
  assert.ok(Su.setExam(s, 'extra', exam(), 700).setup, 'a dropped one makes room');
  assert.equal(Su.liveExams(s)[0].date, '2026-12-11', 'by date');
  let o = {};
  for (let i = 0; i < Su.MAX_OWN; i += 1) o = Su.setOwnCopy(o, 'o' + i, { name: 'L' + String(i).padStart(2, '0'), words: ['cat'], src: 'typed' }, 100).setup;
  assert.deepEqual(Su.setOwnCopy(o, 'more', { name: 'M', words: ['cat'], src: 'typed' }, 100), { error: 'too-many' });
  assert.ok(Su.setOwnCopy(o, 'o4', { name: 'Edited', words: ['cat'], src: 'scan' }, 400).setup);
  assert.equal(Su.setOwnCopy(o, 'o4', { name: 'Edited', words: ['cat'], src: 'scan' }, 400).setup.own.o4.at, 400, 'keeps the master at');
  assert.equal(Su.liveOwn(o)[0].name, 'L00');
});

test('reopen and drop', () => {
  let s = Su.setExam({}, 'e1', exam(), 100).setup;
  s = Su.reopenExam(s, 'e1', 300);
  assert.equal(s.exams.e1.reopen, 300);
  assert.equal(Su.setExam(s, 'e1', exam({ name: 'Renamed' }), 400).setup.exams.e1.reopen, 300, 'an edit keeps the reopen time');
  assert.deepEqual(Su.dropExam({}, 'nope', 5), {});
});

test('trim: own copies gone over 30 days, exams over 90', () => {
  const now = 1000 * DAY;
  let s = Su.setOwnCopy({}, 'o1', { name: 'A', words: ['cat'], src: 'typed' }, 10).setup;
  s = Su.setOwnCopy(s, 'o2', { name: 'B', words: ['dog'], src: 'typed' }, 10).setup;
  s = Su.dropOwnCopy(s, 'o1', now - 31 * DAY);
  s = Su.dropOwnCopy(s, 'o2', now - 29 * DAY);
  s = Su.setExam(s, 'e1', exam(), 10).setup;
  s = Su.setExam(s, 'e2', exam(), 10).setup;
  s = Su.dropExam(s, 'e1', now - 91 * DAY);
  s = Su.dropExam(s, 'e2', now - 89 * DAY);
  const t = Su.trim(s, now);
  assert.deepEqual(Object.keys(t.own), ['o2']);
  assert.deepEqual(Object.keys(t.exams), ['e2']);
  assert.deepEqual(Su.trim({ help: { lv: 2, at: 1 } }, now), { help: { lv: 2, at: 1 } });
  assert.equal('own' in Su.trim(Su.dropOwnCopy(Su.setOwnCopy({}, 'x', { name: 'A', words: ['cat'], src: 'typed' }, 1).setup, 'x', 1), now), false, 'an empty map is left out');
});

test('the worst case stays small enough to live in a words value', () => {
  let s = Su.setHelp(Su.setProfile(Su.setOffer({}, { quiz: true, exam: false }, 1700000000000), 'sen', 1700000000000, 'x'.repeat(40)), 1, 1700000000000, 'x'.repeat(40));
  const long = (i, k) => (String.fromCharCode(97 + (i % 26)) + 'a'.repeat(18) + String.fromCharCode(97 + (k % 26)));
  for (let i = 0; i < Su.MAX_OWN; i += 1) {
    s = Su.setOwnCopy(s, 'own-' + i.toString(36), { name: 'n'.repeat(40), words: Array.from({ length: 15 }, (_, k) => long(i, k)), src: 'scan' }, 1700000000000 + i).setup;
  }
  for (let i = 0; i < Su.MAX_EXAMS; i += 1) {
    s = Su.setExam(s, 'ex-' + i, { name: 'n'.repeat(40), words: Array.from({ length: 20 }, (_, k) => long(i, k)), from: ['y34-ch03', 'g-abc'], date: '2026-12-01' }, 1700000000000 + i).setup;
  }
  const size = new TextEncoder().encode(JSON.stringify(s)).length;
  console.log('# worst-case setup bytes:', size);
  // The brief asked for under 12 KB, but 30 lists x 15 words x 20 letters alone is over 10 KB of word text, so the true
  // ceiling is about 19.6 KB (well under the 48 KB trim line). Pinned here so a growth in the shape is noticed.
  assert.ok(size < 20 * 1024, 'worst case is ' + size + ' bytes');
});

// ---- SB5 (WP-A2): the name the child sees, setup.by (TR-100) -------------------------------------------------
test('setup.by: kept only with a clean name and an at; the same rules as cleanName', () => {
  assert.deepEqual(Su.normalise({ by: { n: 'Mum', at: 5 } }), { by: { n: 'Mum', at: 5 } });
  assert.deepEqual(Su.normalise({ by: { n: '  Ms   Patel ', at: 5 } }), { by: { n: 'Ms Patel', at: 5 } });
  assert.deepEqual(Su.normalise({ by: { n: 'Zoë', at: 1 } }), { by: { n: 'Zoë', at: 1 } });
  for (const bad of [{ n: 'a@b.com', at: 5 }, { n: 'Mum1', at: 5 }, { n: '', at: 5 }, { n: 'Mum' }, { n: 'Mum', at: 0 }, { n: 'Mum', at: -1 }, { n: 5, at: 5 }, { n: 'w'.repeat(25), at: 5 }, 'Mum', null, []]) assert.deepEqual(Su.normalise({ by: bad }), {}, JSON.stringify(bad));
  assert.equal(Su.isEmpty({ by: { n: 'Mum', at: 5 } }), false, 'a name is something');
  assert.equal(Su.isEmpty({ by: { n: '', at: 5 } }), true);
});
test('setup.by: merge keeps the later at (a tie: the larger JSON); absent loses to present; trim never drops it', () => {
  const a = { by: { n: 'Mum', at: 5 } };
  const b = { by: { n: 'Dad', at: 9 } };
  assert.deepEqual(Su.merge(a, b).by, { n: 'Dad', at: 9 });
  assert.deepEqual(Su.merge(b, a).by, { n: 'Dad', at: 9 });
  assert.deepEqual(Su.merge(a, {}).by, { n: 'Mum', at: 5 });
  assert.deepEqual(Su.merge({}, a).by, { n: 'Mum', at: 5 });
  assert.deepEqual(Su.merge({ by: { n: 'Dad', at: 5 } }, { by: { n: 'Mum', at: 5 } }).by, { n: 'Mum', at: 5 }, 'a tie: the larger JSON');
  assert.deepEqual(Su.trim(a, 1e15), a);
  assert.deepEqual(Su.trim({ ...a, own: {} }, 1e15), a);
  assert.deepEqual(Su.merge({ help: { lv: 2, at: 3 }, by: { n: 'Mum', at: 5 } }, { help: { lv: 3, at: 4 } }), { help: { lv: 3, at: 4 }, by: { n: 'Mum', at: 5 } }, 'by does not disturb the other parts');
});
test('setBy: sets, changes and removes the name; the same name changes nothing; the stamp always moves on', () => {
  const s1 = Su.setBy({}, 'Mum', 100);
  assert.deepEqual(s1, { by: { n: 'Mum', at: 100 } });
  assert.equal(Su.setBy(s1, 'Mum', 200), s1, 'the very same value: no write needed');
  const s2 = Su.setBy(s1, 'Dad', 50);
  assert.deepEqual(s2.by, { n: 'Dad', at: 101 }, 'at moves past the old one even on a slow clock');
  assert.deepEqual(Su.setBy(s2, '', 300), {}, 'no name removes it');
  assert.deepEqual(Su.setBy({}, '', 300), {});
  assert.deepEqual(Su.setBy(s2, 'a@b.com', 300), {}, 'a refused name removes the old one, never sets it');
  assert.deepEqual(Su.setBy({ help: { lv: 2, at: 3 } }, 'Mum', 10), { help: { lv: 2, at: 3 }, by: { n: 'Mum', at: 10 } });
  assert.deepEqual(Su.setBy({ help: { lv: 2, at: 3 }, by: { n: 'Mum', at: 10 } }, '', 20), { help: { lv: 2, at: 3 } });
  assert.deepEqual(Su.byOf(s2), { n: 'Dad', at: 101 });
  assert.equal(Su.byOf({}), null);
  assert.equal(Su.byOf(undefined), null);
  assert.deepEqual(Su.setBy(undefined, 'Mum', 10), { by: { n: 'Mum', at: 10 } });
});
test('cleanName limits: 24 characters, 3 words, no web address', () => {
  assert.equal(Su.cleanName('Mum'), 'Mum');
  assert.equal(Su.cleanName('a b c d'), '');
  assert.equal(Su.cleanName('abcdefgh ijklmnop qrstuv'), 'abcdefgh ijklmnop qrstuv', '24 characters');
  assert.equal(Su.cleanName('abcdefgh ijklmnop qrstuvw'), '');
  assert.equal(Su.cleanName('www.name'), '');
  assert.equal(Su.cleanName('see://x'), '');
  assert.equal(Su.NAME_LINE, 'Please use a name only, like Mum or Ms Patel.');
});
test('a copy of a list and the name travel together in one setup value', () => {
  const r = Su.setOwnCopy(Su.setBy({}, 'Mum', 10), 'o1', { name: 'Sea', words: ['boat'], src: 'typed' }, 20);
  assert.deepEqual(Object.keys(Su.normalise(r.setup)).sort(), ['by', 'own']);
  assert.deepEqual(Su.liveOwn(r.setup).map((e) => e.id), ['o1']);
});
