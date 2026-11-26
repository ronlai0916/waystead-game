// SB6 WP-2 (TRS TR-10, TR-14, TR-15): the grown-up's Step by step settings in setup-doc.js and grownups-data.js. U-setup6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Su from '../site/js/setup-doc.js';
import * as W from '../site/js/words-doc.js';
import * as G from '../site/js/grownups-data.js';

test('way, sbs and peek are validated exactly; anything else is dropped (TR-10)', () => {
  const good = { way: { m: 'sbs', at: 5, by: 'Mum' }, sbs: { min: 15, big: 1, after: '16:30', at: 6 }, peek: { s: 5, at: 7 } };
  assert.deepEqual(Su.normalise(good), good);
  for (const bad of [
    { way: { m: 'step', at: 5 } }, { way: { m: 'sbs' } }, { way: 'sbs' },
    { sbs: { min: 7, big: 0, after: '', at: 1 } }, { sbs: { min: 5, big: 2, after: '', at: 1 } }, { sbs: { min: 5, big: true, after: '', at: 1 } },
    { sbs: { min: 5, big: 0, after: '24:00', at: 1 } }, { sbs: { min: 5, big: 0, after: '9:30', at: 1 } }, { sbs: { min: 5, big: 0, at: 1 } },
    { peek: { s: 4, at: 1 } }, { peek: { s: '3', at: 1 } }, { peek: { s: 3 } },
  ]) assert.deepEqual(Su.normalise(bad), {}, JSON.stringify(bad));
  assert.deepEqual(Su.normalise({ sbs: { min: 5, big: 0, after: '', at: 1 } }).sbs, { min: 5, big: 0, after: '', at: 1 });
  assert.deepEqual(Su.normalise({ sbs: { min: 5, big: 0, after: '00:00', at: 1 } }).sbs.after, '00:00');
  assert.equal(Su.isEmpty({ peek: { s: 0, at: 3 } }), false, 'isEmpty counts them');
});
test('reads and defaults: wayOf, sbsOf, peekSecondsOf (TR-10)', () => {
  assert.equal(Su.wayOf({}), 'usual');
  assert.equal(Su.wayOf(undefined), 'usual');
  assert.equal(Su.wayOf({ way: { m: 'sbs', at: 1 } }), 'sbs');
  assert.deepEqual(Su.sbsOf({}), { min: 10, big: 0, after: '' });
  assert.deepEqual(Su.sbsOf({ sbs: { min: 5, big: 1, after: '07:15', at: 1 } }), { min: 5, big: 1, after: '07:15' });
  // peek: absent = 0 in the Usual way (as now: 2 s keys, 3 s tiles); 3 when sbs
  assert.equal(Su.peekSecondsOf({}, { input: 'keys' }), 2);
  assert.equal(Su.peekSecondsOf({}, { input: 'tiles' }), 3);
  assert.equal(Su.peekSecondsOf({ way: { m: 'sbs', at: 1 } }, { input: 'keys' }), 3);
  assert.equal(Su.peekSecondsOf({}, { way: 'sbs', input: 'keys' }), 3, 'the way can be given');
  assert.equal(Su.peekSecondsOf({ way: { m: 'sbs', at: 1 }, peek: { s: 0, at: 2 } }, { input: 'keys' }), 2, 'a set 0 is "as now"');
  assert.equal(Su.peekSecondsOf({ way: { m: 'sbs', at: 1 }, peek: { s: 0, at: 2 } }, { input: 'tiles' }), 3);
  for (const s of [2, 3, 5]) assert.equal(Su.peekSecondsOf({ peek: { s, at: 1 } }, { input: 'keys' }), s);
});
test('setSbs and setPeek: valid values only, later at, parts left out are kept (TR-10)', () => {
  let s = Su.setSbs({}, { min: 5 }, 100, 'Mum');
  assert.deepEqual(s.sbs, { min: 5, big: 0, after: '', at: 100, by: 'Mum' });
  s = Su.setSbs(s, { big: true, after: '17:00' }, 50);
  assert.deepEqual(s.sbs, { min: 5, big: 1, after: '17:00', at: 101 }, 'at always goes up');
  assert.equal(Su.setSbs(s, { min: 7 }, 200), s, 'a bad value changes nothing');
  assert.equal(Su.setSbs(s, { after: '25:00' }, 200), s);
  let p = Su.setPeek(s, 5, 300);
  assert.deepEqual(p.peek, { s: 5, at: 300 });
  assert.equal(Su.setPeek(p, 4, 400), p);
  assert.deepEqual(Su.setPeek(p, 0, 400).peek, { s: 0, at: 400 });
  assert.deepEqual(Su.normalise(p), p, 'what the setters write normalises to itself');
});
test('setWay: the first switch-on sets Extra support only when no profile was chosen (BR-4 AC6)', () => {
  const on = Su.setWay({}, 'sbs', 100, 'Mum');
  assert.equal(on.profileSet, true);
  assert.deepEqual(on.setup, { way: { m: 'sbs', at: 100, by: 'Mum' }, profile: { p: 'sen', at: 100, by: 'Mum' } });
  const chosen = Su.setWay({ profile: { p: 'top', at: 5 }, help: { lv: 3, at: 5 } }, 'sbs', 100);
  assert.equal(chosen.profileSet, false);
  assert.equal(chosen.setup.profile.p, 'top', 'a chosen profile is never changed');
  const off = Su.setWay(on.setup, 'usual', 200);
  assert.deepEqual([off.profileSet, off.setup.way.m, off.setup.profile.p], [false, 'usual', 'sen'], 'switching off leaves the help as it is');
  const again = Su.setWay(off.setup, 'sbs', 300);
  assert.equal(again.profileSet, false, 'the profile now exists: the second switch-on does not touch it');
  assert.equal(Su.setWay(on.setup, 'sbs', 500).setup, on.setup, 'the same way again changes nothing');
  assert.equal(Su.setWay({}, 'weird', 1).setup.way, undefined);
  assert.equal(Su.setWay(on.setup, 'usual', 50).setup.way.at, 101, 'at goes up');
});
test('merge: absent loses to present, the later at wins, a tie keeps the larger JSON (TR-14)', () => {
  const a = { way: { m: 'sbs', at: 5 }, sbs: { min: 5, big: 0, after: '', at: 5 }, peek: { s: 2, at: 5 } };
  assert.deepEqual(Su.merge(a, {}), a);
  assert.deepEqual(Su.merge({}, a), a);
  const b = { way: { m: 'usual', at: 9 }, peek: { s: 3, at: 2 } };
  const m = Su.merge(a, b);
  assert.deepEqual([m.way.m, m.peek.s, m.sbs.min], ['usual', 2, 5]);
  assert.deepEqual(Su.merge(a, b), Su.merge(b, a), 'commutative');
  const tie = Su.merge({ way: { m: 'sbs', at: 5 } }, { way: { m: 'sbs', at: 5, by: 'Mum' } });
  assert.deepEqual(Su.merge({ way: { m: 'sbs', at: 5, by: 'Mum' } }, { way: { m: 'sbs', at: 5 } }), tie);
});
test('trim keeps them; a child-side change keeps them byte for byte (TR-10, BR-4 AC5)', () => {
  const s = { profile: { p: 'sen', at: 5 }, way: { m: 'sbs', at: 5 }, sbs: { min: 15, big: 1, after: '', at: 6 }, peek: { s: 5, at: 7 } }; // key order as normalise writes it
  assert.deepEqual(Su.trim(s, 1e12), s);
  let d = W.withSetup(W.emptyDoc(), s);
  d = W.createGroup(d, { id: 'g1', test: '2026-12-01', words: ['night'], today: '2026-11-24', now: 3 }).doc;
  d = W.addTry(d, { id: 'r00001', word: 'night', day: '2026-11-24', group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: 9 });
  d = W.setClue(d, 'night', 'a clue', 10);
  const back = W.normalise(JSON.parse(JSON.stringify(d)));
  assert.equal(JSON.stringify(back.setup), JSON.stringify(s));
  assert.equal(JSON.stringify(W.setupOf(W.merge(d, W.emptyDoc()))), JSON.stringify(s));
  assert.equal(JSON.stringify(W.setupOf(W.trim(d, 1e12))), JSON.stringify(s));
  assert.equal(JSON.stringify(W.setupOf(W.reset(5, d))), JSON.stringify(s), '"Clear my progress" keeps the grown-up\'s settings');
});
test('unknown sub-fields of setup: kept when an object with a numeric at; merged by at (TR-15)', () => {
  const s = { help: { lv: 2, at: 1 }, zz: { at: 4, q: [1] }, yy: { x: 1 }, 'Bad': { at: 1 }, big: { at: 1, v: 'x'.repeat(3000) } };
  assert.deepEqual(Su.normalise(s), { help: { lv: 2, at: 1 }, zz: { at: 4, q: [1] } });
  assert.deepEqual(Su.merge({ zz: { at: 4, v: 'a' } }, { zz: { at: 6, v: 'b' } }).zz.v, 'b');
  assert.deepEqual(Su.trim({ zz: { at: 4 } }, 1), { zz: { at: 4 } });
  assert.equal(Su.isEmpty({ zz: { at: 4 } }), false);
  assert.equal(Su.normalise({ __proto__: null, zz: { at: 1 } }).zz.at, 1);
});

// ---- grownups-data.js helpers, against a tiny fake account ---------------------------------------------------------------
function fake(initial) {
  let value = initial; let version = 1;
  return {
    game: async () => ({ ok: true, status: 200, data: { items: { words: { value, version } } } }),
    put: async (id, key, v, ver) => { if (ver !== version) return { ok: false, status: 409, data: {} }; value = v; version += 1; return { ok: true, status: 200, data: {} }; },
    get value() { return value; },
  };
}
test('grownups-data setWay / setSbs / setPeek go through changeSetup (TR-10)', async () => {
  const api = fake(W.emptyDoc());
  const r = await G.setWay(api, 'c1', 'sbs', { now: () => 1000, who: 'Mum' });
  assert.equal(r.ok, true);
  assert.equal(r.profileSet, true);
  assert.deepEqual(Su.wayOf(api.value.setup), 'sbs');
  assert.equal(api.value.setup.profile.p, 'sen');
  assert.equal((await G.setWay(api, 'c1', 'usual', { now: () => 2000 })).profileSet, false);
  assert.equal(Su.wayOf(api.value.setup), 'usual');
  assert.equal((await G.setSbs(api, 'c1', { min: 15, big: 1 }, { now: () => 3000 })).ok, true);
  assert.deepEqual(Su.sbsOf(api.value.setup), { min: 15, big: 1, after: '' });
  assert.equal((await G.setPeek(api, 'c1', 5, { now: () => 4000 })).ok, true);
  assert.equal(Su.peekSecondsOf(api.value.setup, { input: 'keys' }), 5);
  // the profile of a child who already had help chosen is kept
  const api2 = fake(W.withSetup(W.emptyDoc(), Su.setProfile({}, 'normal', 5)));
  assert.equal((await G.setWay(api2, 'c1', 'sbs', { now: () => 9 })).profileSet, false);
  assert.equal(api2.value.setup.profile.p, 'normal');
});

test('D25: grownups-data setAsideWord writes aside through changeWords (409 retried) and can bring the word back', async () => {
  const api = fake(W.createGroup(W.emptyDoc(), { id: 'g1', test: '2026-12-01', words: ['night'], today: '2026-11-24', now: 1 }).doc);
  const r = await G.setAsideWord(api, 'c1', 'g1', 'night', '2026-11-24', { now: () => Date.parse('2026-11-24T10:00:00') });
  assert.equal(r.ok, true);
  assert.equal(W.isSetAside(api.value, 'g1', 'night', '2026-11-24'), true);
  assert.equal((await G.setAsideWord(api, 'c1', 'g1', 'night', '', { now: () => Date.parse('2026-11-24T11:00:00') })).ok, true);
  assert.equal(W.isSetAside(api.value, 'g1', 'night', '2026-11-24'), false);
  assert.equal(typeof G.setAsideWord, 'function');
});
