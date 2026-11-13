// SB3-F: the adult's front page and top bar. Pure rules, and the files' wording. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as P from '../site/js/grownups-doc.js';
import * as A from '../site/js/adult-doc.js';

const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const read = (p) => readFileSync(file(p), 'utf8');
const step = (id, title, kind) => ({ id, title, kind });
const steps = (kinds) => ['hello:Hello words', 'fix:Fix it in', 'games:Game day', 'story:Story day', 'practice:Practice day', 'test:Test day', 'mend:Mend and keep'].map((x, i) => step(x.split(':')[0], x.split(':')[1], kinds[i] || 'later'));

test('"Next ... Then ..." names the next job first, a waiting one with (waiting)', () => {
  assert.equal(P.nextLine({ steps: steps(['waiting', 'later']) }), 'Next: Hello words (waiting). Then Fix it in.');
  assert.equal(P.nextLine({ steps: steps(['todaywait', 'later']) }), 'Next: Hello words (waiting). Then Fix it in.');
  assert.equal(P.nextLine({ steps: steps(['done', 'done', 'today', 'later']) }), 'Next: Game day. Then Story day.');
  assert.equal(P.nextLine({ steps: steps(['done', 'done', 'done', 'done', 'done', 'done', 'later']) }), 'Next: Mend and keep.');
  assert.equal(P.nextLine({ steps: steps(['done', 'done', 'done', 'done', 'done', 'done', 'done']) }), '');
  assert.equal(P.nextLine({ steps: steps(['missed', 'done', 'done', 'done', 'done', 'done', 'later']) }), 'Next: Mend and keep.', 'a legacy "not done" job is never next');
});
test('the sun is on the next job, today or not', () => {
  assert.equal(P.sunStep({ steps: steps(['done', 'later']) }), 'fix');
  assert.equal(P.sunStep({ steps: steps(['waiting', 'later']) }), 'hello');
  assert.equal(P.sunStep({ steps: steps(['done', 'done', 'done', 'done', 'done', 'done', 'done']) }), '');
});

const kid = (name, key, waiting = 0) => ({ name, key, waiting });
test('the summary sentence', () => {
  assert.equal(P.glanceSummary([kid('Robin', 'ontrack'), kid('Wren', 'waiting', 1)]), 'Wren has a job waiting. Robin is on track.');
  assert.equal(P.glanceSummary([kid('Robin', 'ontrack'), kid('Wren', 'ontrack')]), 'Robin and Wren are on track.');
  assert.equal(P.glanceSummary([kid('Robin', 'ontrack')]), 'Robin is on track.');
  assert.equal(P.glanceSummary([kid('Ellie', 'waiting', 2)]), 'Ellie has 2 jobs waiting.');
  assert.equal(P.glanceSummary([kid('Robin', 'ended'), kid('Wren', 'ontrack')]), 'Robin’s week has ended. Wren is on track.');
  assert.equal(P.glanceSummary([kid('Robin', 'noweek')]), 'Robin has no week yet.');
  assert.equal(P.glanceSummary([]), '');
  const five = ['Amara', 'Ben', 'Chloe', 'Dev', 'Ellie'];
  assert.equal(P.glanceSummary([kid(five[0], 'ontrack'), kid(five[1], 'waiting', 1), kid(five[2], 'ontrack'), kid(five[3], 'ontrack'), kid(five[4], 'waiting', 2)]), 'Ben and Ellie need you. Three children are on track.');
  assert.equal(P.glanceSummary(five.map((n) => kid(n, 'ontrack'))), 'All five children are on track.');
  assert.equal(P.glanceSummary(['A', 'B', 'C', 'D'].map((n, i) => kid(n, i ? 'ontrack' : 'waiting', 1))), 'A needs you. Three children are on track.');
});
test('who gets the green button: the first child who needs attention, else Plan a week', () => {
  const items = [kid('Amara', 'ontrack'), kid('Ben', 'waiting', 1), kid('Ellie', 'waiting', 2)];
  assert.deepEqual(P.primaryAction(items), { kind: 'see', index: 1, label: 'See Ben’s week' });
  assert.equal(P.primaryAction([kid('Robin', 'ontrack'), kid('Wren', 'notstarted')]).label, 'Plan a week');
  assert.equal(P.planIsPrimary([kid('Robin', 'ontrack')]), true);
  assert.equal(P.planIsPrimary([kid('Robin', 'ended')]), false);
  assert.equal(P.primaryAction([kid('Robin', 'ended')]).label, 'Plan Robin’s next week');
  assert.equal(P.primaryAction([kid('Robin', 'noweek')]).label, 'Plan a week for Robin');
  assert.equal(P.primaryAction([kid('Robin', 'problem')]).kind, 'plan');
});
test('one or two children get cards, three or more get rows', () => {
  assert.deepEqual([1, 2, 3, 5].map(P.isCompact), [false, false, true, true]);
});
test('the date line', () => { assert.equal(P.longDate('2026-11-17'), 'Tuesday 17 November'); assert.equal(P.longDate(''), ''); });

test('the adult chip never shows "Grown-up" as a name', () => {
  assert.equal(A.chipView({ name: 'Sam' }).label, 'Sam');
  assert.equal(A.chipView({ name: 'Sam' }).initial, 'S');
  for (const p of [{ name: 'Grown-up' }, { name: '' }, { name: '  ' }, null]) {
    const v = A.chipView(p);
    assert.equal(v.label, 'Your account');
    assert.equal(v.named, false);
  }
  // the shared fallback this relies on (shared/account/player.js, also what Wordbright, Composition and the hub show)
  assert.match(read('shared/account/player.js'), new RegExp("cleanName\\(me\\.displayName, '" + A.SHARED_FALLBACK + "'\\)"));
});
test('the Menu rows and the switch rows', () => {
  assert.deepEqual(A.MENU_ROWS.map((r) => r.title), ['More practice', 'My words', 'Pick words', 'Tricky words', 'Progress', 'All games']);
  assert.deepEqual(A.MENU_ROWS.map((r) => r.href), ['#/chapters', '#/words', '#/custom', '#/tricky', '#/progress', '../']);
  assert.equal(A.MENU_ROWS.find((r) => r.id === 'progress').sub, 'Chapters you have passed');
  const kid = (n) => ({ id: n, nickname: n, year: 4 });
  assert.equal(A.playAsLine([kid('Robin')]), 'Play as Robin');
  assert.equal(A.playAsLine([kid('Robin'), kid('Wren')]), 'Robin or Wren');
  assert.equal(A.playAsLine([kid('A'), kid('B'), kid('C')]), 'A, B or C');
  assert.equal(A.playAsLine(['A', 'B', 'C', 'D', 'E'].map(kid)), 'A, B, C and 2 more');
  assert.equal(A.playAsLine([]), '');
});
test('the files: no inline style, the bar is a Spellbright-only mode, the shared nav is not changed', () => {
  for (const f of ['site/js/adult-chrome.js', 'site/js/adult-doc.js', 'site/js/grownups-views.js']) assert.doesNotMatch(read(f), /\sstyle="/, f);
  const css = read('site/css/adult.css');
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')[0].trim()).filter((s) => s && !s.startsWith('@'))) {
    for (const sel of rule.split(',').map((x) => x.trim())) assert.match(sel, /^(body\.is-adult|\.adult|\.brand__tag|\.foot__papers)/, 'scoped: ' + sel);
  }
  assert.doesNotMatch(css, /\.topbar__nav\s*\{[^}]*display:\s*none/);
  assert.equal(read('shared/topbar/nav.js'), read('site/js/nav/nav.js'));
  const sw = read('site/sw.js');
  for (const f of ['css/adult.css', 'js/adult-doc.js', 'js/adult-chrome.js']) assert.ok(sw.includes("'" + f + "'"), f);
  assert.match(sw, /VERSION = 'spellbright-2026-11-13e'/);
});
