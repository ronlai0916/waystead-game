// The player chip's CSS (the "Player chip" block in each site's style sheet):
// the same in all three sites, only existing tokens, no colour or font of its
// own, and every text/background pair it uses is in that site's contrast test
// (which checks it in all three styles: garden, paint, night).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITES = [
  { css: 'site/css/app.css', styles: 'site/css/styles/', contrast: 'tests/contrast.test.js' },
  { css: 'wordbright/site/css/app.css', styles: 'wordbright/site/css/styles/', contrast: 'wordbright/tests/contrast.test.js' },
  { css: 'hub/site/home-assets/css/hub.css', styles: 'hub/site/home-assets/css/styles/', contrast: 'hub/tests/contrast.test.js' },
];
const block = (css) => {
  const at = css.indexOf('/* ---- Player chip');
  assert.ok(at >= 0, 'has the Player chip block');
  const end = css.indexOf('/* ----', at + 10);
  return css.slice(at, end < 0 ? undefined : end).trim();
};
// The chip draws: the name and icons in --text on the button (.iconbtn: --surface)
// and the menu (--surface); the initial, and a menu item under the pointer, on --surface-2.
const PAIRS = [['--text', '--surface'], ['--text', '--surface-2']];

test('the chip block is the same in all three sites', () => {
  const blocks = SITES.map((s) => block(readFileSync(ROOT + s.css, 'utf8')));
  assert.equal(blocks[1], blocks[0]);
  assert.equal(blocks[2], blocks[0]);
});

for (const s of SITES) {
  test(s.css + ': the chip uses only tokens that already exist; no colour, font or variable of its own', () => {
    const css = readFileSync(ROOT + s.css, 'utf8');
    const b = block(css).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(b, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|color-mix/i, 'no colour literal');
    assert.doesNotMatch(b, /font-family|@font-face/, 'no font');
    assert.doesNotMatch(b, /--[\w-]+\s*:/, 'no new custom property');
    const defined = css + ['garden', 'paint', 'night'].map((n) => readFileSync(ROOT + s.styles + n + '.css', 'utf8')).join('');
    for (const [, name] of b.matchAll(/var\((--[\w-]+)/g)) assert.match(defined, new RegExp(name + '\\s*:'), name + ' is defined');
  });
  test(s.contrast + ' checks every pair the chip uses, in all three styles', () => {
    const t = readFileSync(ROOT + s.contrast, 'utf8');
    for (const [fg, bg] of PAIRS) assert.ok(t.includes(`['${fg}', '${bg}']`), `${fg} on ${bg}`);
  });
}
