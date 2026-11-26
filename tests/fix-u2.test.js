// SB6 FIX-U2: S3 (Usual boards unchanged), S4 (8 px Hear gap), C2 (Peek line announced), C6 (date button outside the live block).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as SV from '../site/js/set-views.js';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('S3: the Fill board has the mixbar--sbs class only in Step by step; the 320 px tray rule is scoped to it', () => {
  const g = src('site/js/games-views.js');
  assert.match(g, /'<div class="mixbar' \+ \(sbs \? ' mixbar--sbs' : ''\) \+ '" data-fold="keys">/);
  assert.doesNotMatch(g, /class="mixbar mixbar--sbs"/);
  const css = src('site/css/mix.css');
  assert.doesNotMatch(css, /\.mixbar \.mixtray/, 'no unscoped .mixbar .mixtray rule');
  assert.match(css, /\.mixbar--sbs \.mixtray \{ gap: 8px; \}/);
});

test('FIX-U5 S1/S2: the Step by step trays keep 8 px round every Hear; the xs board minimum is Step by step only', () => {
  const css = src('site/css/mix.css');
  assert.match(css, /\.mixbar\.mixbar--sbs \{ gap: 8px; \}/);
  assert.doesNotMatch(css, /mixbar--sbs \.mixtray \{ gap: [0-7]px/);
  assert.doesNotMatch(css, /matchcol \{ gap: [0-7]px/);
  assert.match(css, /html\[data-h="xs"\] body \.mixpage > \.mixboard\.mixboard--sbs \{ min-height: 80px; \}/);
  assert.doesNotMatch(css, /\.mixpage > \.mixboard \{ min-height: 80px/);
  assert.doesNotMatch(css, /320 x 568 only/);
  assert.match(src('site/js/games-views.js'), /class="mixboard' \+ \(ctx\.sbs \? ' mixboard--sbs' : ''\) \+ '"/);
});

test('S4: every Hear-to-option gap in mix.css is at least 8 px, at every size', () => {
  const css = src('site/css/mix.css');
  const gaps = [...css.matchAll(/(\.matchopt|\.mixopt) \{[^}]*?gap: (\d+)px/g)].map((m) => [m[1], Number(m[2])]);
  assert.ok(gaps.length >= 4, JSON.stringify(gaps));
  for (const [sel, px] of gaps) assert.ok(px >= 8, sel + ' ' + px);
});

test('C2: the line that says Peeked is announced politely, even when the static hint is hidden at 320', () => {
  for (const f of ['site/js/words-views.js', 'site/js/study-views.js']) assert.match(src(f), /class="peekhint" data-hint aria-live="polite"/, f);
});

test('C6: the Change the test date button is after the live estimate block, not inside it', () => {
  const html = SV.estimateHtml([{ name: 'Robin', line: 'At least about 9 sittings of 5 minutes before the test: about 5 a day. That is a lot for this week. You could give it more days.', calm: true }]);
  const status = html.slice(html.indexOf('role="status"'));
  const inner = status.slice(0, status.indexOf('</div>'));
  assert.ok(!/data-estimate-date/.test(inner), 'not inside the status block');
  assert.match(html, /role="status">[\s\S]*<\/div><button[^>]*data-estimate-date/);
});
