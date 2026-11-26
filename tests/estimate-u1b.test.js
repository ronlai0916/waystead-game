// FIX-U1b: the estimate wording (TR-30a), the Word pictures card wording, Step-by-step stone names on the grown-up page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../site/js/words-doc.js';
import * as K from '../site/js/sbs-week-doc.js';
import * as P from '../site/js/grownups-doc.js';
import * as SD from '../site/js/set-doc.js';
import * as SV from '../site/js/set-views.js';
import * as PD from '../site/js/pictures-doc.js';
import { sbsDoc, WORDS10 } from '../tools/smoke-sb6/gu.mjs';

const MON = '2026-11-02';
const TEST = '2026-11-08';
const usual = () => W.normalise(sbsDoc({ way: 'usual', report: false }));
const step = () => W.normalise(sbsDoc({ report: false }));

test('D21: createPlan and weekChange never write a focus field, even when one is offered', () => {
  const plan = { name: 'Class 4', test: TEST, words: WORDS10, focus: WORDS10.slice(2) };
  assert.ok(!('focus' in P.createPlan(W.emptyDoc(), plan, { id: 'g1', today: MON, now: 1 }).doc.groups.g1));
  const d = step();
  assert.ok(!('focus' in SD.weekChange(d, 'g1', { name: 'X', focus: WORDS10 }, { today: MON, now: 5 }).doc.groups.g1));
  assert.ok(!('focus' in P.editPlan(d, 'g1', { name: 'Y', focus: WORDS10 }, { today: MON, now: 6 }).doc.groups.g1));
  assert.ok(!('focus' in SD.setChange(W.emptyDoc(), { gid: 'a.pabcde', name: 'W', test: TEST, words: WORDS10, focus: WORDS10 }, { today: MON, now: 1 }).doc.groups['a.pabcde']));
  assert.equal(SV.focusHtml, undefined, 'no focus ticks on the Set a week pages');
});

test('the estimate under the list: new wording, one line per Step-by-step child, follows the words and the date', () => {
  const kids = [{ nickname: 'Robin', year: 4, d: step() }, { nickname: 'Wren', year: 4, d: usual() }];
  const a = SD.estimateLines({ kids, words: WORDS10, test: TEST, today: MON });
  const b = SD.estimateLines({ kids, words: WORDS10.slice(0, 5), test: TEST, today: MON });
  const c = SD.estimateLines({ kids, words: WORDS10, test: '2026-11-03', today: MON });
  assert.equal(a.length, 1);
  assert.match(a[0].line, /^At least about \d+ sittings? of 10 minutes before the test: about \d+ a day\./);
  assert.ok(/^At least about/.test(a[0].line), 'D24: it starts "At least about"');
  assert.ok(b[0].tries < a[0].tries, 'fewer words, fewer tries');
  assert.ok(c[0].calm && !a[0].calm, 'a near date gives the calm line');
});

test('the estimate: the worked example (N = 10, six letters, m = 10 and 15, D = 6) and the calm line', () => {
  const ex = Array(10).fill('garden');
  const e = K.estimate(ex, { minutes: 10, today: MON, test: '2026-11-08', year: 4 });
  assert.equal(e.line, 'At least about ' + e.sittings + ' sittings of 10 minutes before the test: about ' + e.perDay + ' a day.');
  const f = K.estimate(ex, { minutes: 15, today: MON, test: '2026-11-08', year: 4 });
  assert.ok(f.sittings < e.sittings);
  const rush = K.estimate(ex, { minutes: 5, today: MON, test: '2026-11-03', year: 4 });
  assert.ok(rush.calm);
  assert.match(rush.line, /^At least about \d+ sittings of 5 minutes before the test: about \d+ a day\. That is a lot for this week\. You could give it more days\.$/);
  const late = K.estimate(ex, { minutes: 10, today: '2026-11-09', test: '2026-11-08' });
  assert.match(late.line, /^About \d+ sittings left before the test can open\.$/);
});

test('the estimate html: the calm line gets a link to change the date; a plain line does not; no warning colour class', () => {
  const calm = SV.estimateHtml([{ name: 'Robin', line: 'At least about 9 sittings of 5 minutes before the test: about 5 a day. That is a lot for this week. You could give it more days.', calm: true }]);
  assert.match(calm, /data-estimate-date/);
  assert.match(calm, /data-act="pickdate"/);
  assert.ok(!/warn|alert|danger|error/i.test(calm));
  assert.ok(!/data-estimate-date/.test(SV.estimateHtml([{ name: 'Robin', line: 'At least about 3 sittings of 10 minutes before the test: about 1 a day.', calm: false }])));
});

test('Word pictures card: an unlimited account says what it covers, not "Unlimited" above "0 available"', () => {
  const a = { on: true, unlimited: true };
  assert.equal(PD.allowanceLine(a), 'No limit on word pictures.');
  assert.equal(PD.UNLIMITED_HELP, 'Word pictures never use story credits. Story credits are for Story Adventure.');
  assert.ok(!/unlimited/i.test(PD.allowanceLine(a) + PD.UNLIMITED_HELP));
});

test('F7: a Step-by-step week on the grown-up page uses the child\'s stone names; the Usual way is unchanged', () => {
  const s = P.weekCard(step(), W.groupById(step(), 'g1'), MON);
  assert.equal(s.sbs, true);
  assert.deepEqual(s.steps.map((x) => x.title).slice(0, 5), ['Meet the words', 'Letter ladder', 'Meanings', 'Sentences', 'Words in a row']);
  assert.deepEqual(s.steps.map((x) => x.short).slice(0, 2), ['Meet', 'Ladder']);
  assert.equal(s.today, 'Meet the words');
  assert.ok(!/Hello words|Fix it in|Game day|Story day|Practice day/.test(JSON.stringify([s.steps.map((x) => [x.title, x.name]), s.today, P.nextLine(s)])));
  const u = P.weekCard(usual(), W.groupById(usual(), 'g1'), MON);
  assert.equal(u.sbs, false);
  assert.deepEqual(u.steps.map((x) => x.title).slice(0, 3), ['Hello words', 'Fix it in', 'Game day']);
  assert.equal(u.today, 'Hello words');
});
