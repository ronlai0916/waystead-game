// Spellbright: every text/background pair is WCAG AA (4.5:1) in all three
// styles, and icons/outlines 3:1, read from the real CSS: the shared tokens in
// site/css/app.css, then each style's own block in site/css/styles/.
// Same method as wordbright/tests/contrast.test.js.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS = fileURLToPath(new URL('../site/css/', import.meta.url));

// The custom properties declared in the first block that starts with `selector {`.
function tokens(file, selector) {
  const css = readFileSync(CSS + file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const at = css.indexOf(selector + ' {');
  assert.ok(at >= 0, `${selector} in ${file}`);
  const body = css.slice(at, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const BASE = tokens('app.css', ':root');
const GARDEN = tokens('styles/garden.css', ':root');
export const STYLES = {
  garden: { ...BASE, ...GARDEN },
  paint: { ...BASE, ...GARDEN, ...tokens('styles/paint.css', ':root[data-style="paint"]') },
  night: { ...BASE, ...GARDEN, ...tokens('styles/night.css', ':root[data-style="night"]') },
};

// A token's colour as #RRGGBB, following var(--x) and var(--x, fallback).
// A literal colour (e.g. '#FFFFFF') can be passed instead of a token name.
function colour(t, name, seen = []) {
  if (name.startsWith('#')) return colour({ __lit: name }, '__lit');
  assert.ok(!seen.includes(name), 'loop at ' + name);
  let v = t[name];
  assert.ok(v, `${name} is not set`);
  const ref = /^var\((--[\w-]+)(?:,\s*(.+))?\)$/.exec(v);
  if (ref) return t[ref[1]] ? colour(t, ref[1], [...seen, name]) : colour({ ...t, __fb: ref[2] }, '__fb', [...seen, name]);
  if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + [...v.slice(1)].map((c) => c + c).join('');
  assert.match(v, /^#[0-9a-f]{6}$/i, `${name} is ${v}, not a solid colour`);
  return v.toUpperCase();
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [text, background]
const TEXT = [
  ['--text', '--bg'], ['--text', '--surface'], ['--text', '--surface-2'], ['--text', '--accent-soft'],
  ['--muted', '--bg'], ['--muted', '--surface'], ['--muted', '--surface-2'],
  ['--on-accent', '--accent'], ['--on-accent', '--accent-strong'], ['--accent-strong', '--accent-soft'],
  ['--link', '--bg'], ['--link', '--surface'],
  ['--eyebrow', '--bg'], ['--eyebrow', '--surface'], ['--product', '--bg'], ['--wordmark', '--bg'],
  // The keyboard: keys, right letters, wrong letters
  ['--key-fg', '--key-bg'], ['--key-hit-fg', '--key-hit-bg'], ['--key-miss-fg', '--key-miss-bg'],
  // Pills, results, the chapter-test star
  ['--good', '--good-soft'], ['--good', '--surface'], ['--bad', '--surface'], ['--bad', '--bg'],
  ['--badge-fg', '--good'], ['--badge-fg', '--bad'], ['--pass-fg', '--pass-bg'],
  ['--sb', '--sb-soft'],
  // The Waystead Learning panel (its heading, text and Teal button)
  ['--learning', '--learning-soft'], ['--text', '--learning-soft'], ['#FFFFFF', '--learning-btn'],
];
// Icons and outlines: 3:1 (WCAG 1.4.11). --sb is the spelling-part rail;
// --petal-edge colours the lives dots.
const UI = [['--focus', '--bg'], ['--accent', '--surface'], ['--sb', '--surface'], ['--sb', '--bg'], ['--petal-edge', '--bg'], ['--ring-still', '--surface']];
// The "Best 7/11" pill: dark amber by day, Amber at night.
const WARM = { garden: ['--amber-700', '--warm-soft'], paint: ['--amber-700', '--warm-soft'], night: ['--amber', '--warm-soft'] };

for (const [style, t] of Object.entries(STYLES)) {
  test(`${style}: every text pair is 4.5:1 or more, icons and outlines 3:1`, () => {
    const low = [];
    const check = (pairs, min) => {
      for (const [fg, bg] of pairs) {
        const r = ratio(colour(t, fg), colour(t, bg));
        if (r < min) low.push(`${fg} on ${bg}: ${r.toFixed(2)}:1 (needs ${min})`);
      }
    };
    check([...TEXT, WARM[style]], 4.5);
    check(UI, 3);
    assert.deepEqual(low, []);
  });
}

test('the three styles really differ, and Night is dark', () => {
  assert.equal(new Set(Object.values(STYLES).map((t) => colour(t, '--bg'))).size, 3);
  assert.ok(luminance(colour(STYLES.night, '--bg')) < 0.05);
  assert.ok(luminance(colour(STYLES.garden, '--bg')) > 0.8 && luminance(colour(STYLES.paint, '--bg')) > 0.8);
});

test('Plum stays Spellbright\'s own colour by day, and Teal stays on the Learning panel', () => {
  for (const s of ['garden', 'paint']) assert.equal(colour(STYLES[s], '--sb'), '#6B3FA0');
  for (const s of Object.keys(STYLES)) {
    const t = STYLES[s];
    for (const k of ['--accent', '--link', '--product', '--sb']) assert.ok(!['#0F8B7E', '#0C7167'].includes(colour(t, k)), `${s} ${k} is Teal`);
  }
});

test('the formula matches known WCAG values', () => {
  assert.equal(ratio('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(ratio('#777777', '#FFFFFF').toFixed(2), '4.48');
});
