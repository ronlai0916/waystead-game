// Simulated children against the ladder (D18, D19, D20, D22). A child is a function of (code, tryNo, run) giving the
// slips and Peeks of the next try. D22: nothing is ever parked or passed over, so a child who never succeeds loops;
// the CALLER's contract is a cap on items per sitting (a sitting ends between items and the word resumes at its exact
// step next sitting). The sim enforces that cap and checks the invariants at every item.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CODE, rungsFor, newWordRun, afterTry, replay } from '../site/js/ladder-doc.js';

const WORDS = ['a', 'at', 'cat', 'night', 'knee', 'friend', 'because', 'beautiful', 'accommodate', 'extraordinary', 'unnecessarily', 'a'.repeat(14)];
const e = (word) => ({ word, chunks: [word] });
const cap = (rungs) => 4 * rungs.length + 10; // the sitting's item cap (the session's time cap in the real app)

// One word in one sitting from `start`, at most `cap` items. Returns { items, run, rungs, tries }.
function sit(entry, start, child, maxItems) {
  const rungs = rungsFor(entry);
  let run = newWordRun(entry, start);
  const items = []; const tries = [];
  const limit = maxItems || cap(rungs);
  for (let i = 0; i < limit && !run.done; i += 1) {
    const { t = 0, p = 0 } = child(run.code, i, run);
    const out = afterTry(run, { tries: t, peeks: p, entry }, rungs);
    items.push({ code: run.code, t, p, clean: t === 0 && p === 0, next: out.next, res: out });
    tries.push({ t, p });
    run = out.run;
  }
  return { items, run, rungs, tries, entry, start };
}

function check(label, r) {
  const { items, run, rungs } = r;
  assert.ok(items.length <= cap(rungs), `${label}: the caller's item cap holds`);
  for (const it of items) {
    assert.ok(['up', 'repeat', 'back', 'done'].includes(it.next), `${label}: ${it.next}`);
    assert.equal(it.res.park, undefined);
    assert.ok(it.res.run.code >= 1 || it.res.run.done, `${label}: never below Copy`);
    if (it.next === 'up') assert.ok(it.clean, `${label}: climbed on a try that was not clean`);
    if (it.next === 'done') assert.ok(it.clean && it.code === CODE.ALL, `${label}: done without a clean whole word`);
  }
  for (const c of run.passed) assert.ok(items.some((it) => it.code === c && it.clean), `${label}: rung ${c} passed with no clean try`);
  if (run.done) assert.ok(run.passed.includes(CODE.ALL), `${label}: done but whole word not passed clean`);
  // resumable: replaying the tries lands on the same step
  assert.equal(replay(r.tries, r.entry, rungs, r.start).code, run.code, `${label}: replay`);
  // no rung jumped on the way up
  for (let i = 1; i < items.length; i += 1) {
    if (items[i - 1].next === 'up') assert.equal(rungs.indexOf(items[i].code), rungs.indexOf(items[i - 1].code) + 1);
  }
}

// children that eventually succeed (must finish within the cap)
const finishing = {
  clean: () => ({}),
  slipsNTimes: (n) => (c, i) => (i < n ? { t: 1 } : {}),
  peeksNTimes: (n) => (c, i) => (i < n ? { p: 1 } : {}),
  repeatSlips: (c, i, run) => (run.repeat ? { t: 1 } : {}), // clean first go always: climbs
  mixedThenClean: (n) => (c, i) => (i < n ? (i % 2 ? { p: 1 } : { t: 2 }) : {}),
};
// children that never succeed on some rung (the cap ends their sitting; the word is NOT done)
const stuck = {
  alwaysSlip: () => ({ t: 2 }),
  oneSlipEvery: () => ({ t: 1 }),
  alwaysPeek: () => ({ p: 1 }),
  slipThenPeek: (c, i) => (i % 2 ? { p: 1 } : { t: 1 }),
  hardOnly: (c) => (c >= 4 && c !== CODE.COPY ? { t: 1 } : {}),
};

for (const [name, kid] of Object.entries(stuck)) {
  test(`stuck child "${name}": the item cap holds, nothing parked, never marked done`, () => {
    for (const w of WORDS) {
      const entry = e(w); const rungs = rungsFor(entry);
      for (const start of new Set([1, rungs[Math.floor(rungs.length / 2)], CODE.ALL])) {
        const r = sit(entry, start, kid);
        check(`${name} ${w} from ${start}`, r);
        if (!(name === 'hardOnly' && rungs.filter((c) => c >= 4 && c < CODE.ALL).length === 0 && !rungs.includes(CODE.ALL))) assert.equal(r.run.done && !r.run.passed.includes(CODE.ALL), false);
        assert.ok(r.items.length === cap(rungs) || r.run.done);
      }
    }
  });
}

for (const [name, mk] of [['clean first go, slips on repeats', finishing.repeatSlips], ['slips 5 times', finishing.slipsNTimes(5)], ['peeks 5 times', finishing.peeksNTimes(5)], ['mixed 7 times', finishing.mixedThenClean(7)]]) {
  test(`child who ${name} then spells clean: finishes the word inside the cap`, () => {
    for (const w of WORDS) {
      const entry = e(w); const rungs = rungsFor(entry);
      const r = sit(entry, 1, mk);
      check(`${name} ${w}`, r);
      assert.ok(r.run.done, `${name} ${w} done`);
      assert.equal(r.run.endedClean, true);
    }
  });
}

test('clean child: every rung once, in order, up to the whole word, 1 to 14 letters', () => {
  for (let n = 1; n <= 14; n += 1) {
    const entry = e('abcdefghijklmn'.slice(0, n));
    const { items, run, rungs } = sit(entry, 1, finishing.clean);
    assert.deepEqual(items.map((i) => i.code), rungs.filter((r) => r >= 1));
    assert.equal(items.length, n + 1);
    assert.equal(run.endedClean, true);
  }
});

test('a word cut off mid-way resumes at its exact step and can finish', () => {
  const entry = e('beautiful'); const rungs = rungsFor(entry);
  const first = sit(entry, 1, finishing.clean, 4);              // the time cap ends the sitting after 4 items
  assert.equal(first.run.done, false);
  const resumeAt = first.run.code;
  assert.equal(resumeAt, rungs[1 + 4]);
  const second = sit(entry, resumeAt, finishing.clean);
  assert.ok(second.run.done);
  assert.equal(second.items[0].code, resumeAt);
});

test('a child who always slips at Copy loops, and the cap, not the ladder, ends the sitting', () => {
  const entry = e('cat'); const rungs = rungsFor(entry);
  const r = sit(entry, 1, () => ({ t: 1 }));
  assert.equal(r.items.length, cap(rungs));
  assert.ok(r.items.every((i) => i.code === 1));
  assert.equal(r.run.done, false);
});

test('the ladder alone does not end on a clean try: the session must add one', () => {
  const r = sit(e('night'), 2, stuck.alwaysSlip);
  assert.equal(r.run.endedClean, false);
});
