// The top bar (G4b): links never wrap, and fold into a Menu button when they
// don't fit. Keyboard and sizes are checked in a real browser by the smoke run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fits, ALWAYS_MENU_PX } from '../topbar/nav.js';

const read = (f) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
const SITES = [
  { css: 'site/css/app.css', html: 'site/index.html', js: 'site/js/app.js', sw: 'site/sw.js' },
  { css: 'wordbright/site/css/app.css', html: 'wordbright/site/index.html', js: 'wordbright/site/js/app.js', sw: 'wordbright/site/sw.js' },
  { css: 'hub/site/home-assets/css/hub.css', html: 'hub/site/index.html', js: 'hub/site/home-assets/js/hub.js' },
];

test('fits counts the gaps between items, and a tie fits', () => {
  assert.equal(fits(100, [40, 50], 10), true);
  assert.equal(fits(99, [40, 50], 10), false);
  assert.equal(fits(0, [], 10), true);
});

for (const s of SITES) {
  test(s.css + ': labels never wrap, and folding keeps the links measurable', () => {
    const css = read(s.css);
    for (const sel of [/\.topbar__nav a \{[^}]*white-space: nowrap/, /\.themebtn \{[^}]*white-space: nowrap/, /\.navmenu__btn \{[^}]*white-space: nowrap/]) {
      assert.match(css, sel);
    }
    assert.match(css, /\.topbar__nav \{ display: flex; flex: none;/);
    assert.match(css, new RegExp('@media \\(max-width: ' + ALWAYS_MENU_PX + 'px\\) \\{ \\.topbar__nav \\{ position: absolute; width: 0;'));
    assert.doesNotMatch(css, /\.topbar__nav \{ display: none/, 'a nav with display: none cannot be measured');
  });
  test(s.js + ' wires the menu before the first draw', () => {
    assert.match(read(s.js), /import \{ wireTopNav \} from '\.\/nav\/nav\.js';/);
    assert.match(read(s.js), /wireTopNav\(\);/);
  });
  if (s.sw) test(s.sw + ' has the menu in its shell', () => assert.match(read(s.sw), /'js\/nav\/nav\.js'/));
}

test('the block is the same in all three sites, and adds no colour or font', () => {
  const block = (f) => read(f).match(/\/\* G4b: folded[\s\S]*?\.navmenu__phone \{ display: block; \} \}\n/)[0];
  const [a, b, c] = SITES.map((s) => block(s.css));
  assert.equal(a, b);
  assert.equal(a, c);
  assert.doesNotMatch(a, /#[0-9a-f]{3,8}\b|rgba?\(|font-family/i);
});
