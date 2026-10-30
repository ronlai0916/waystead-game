// Every text/background pair is WCAG AA (4.5:1) in all three styles, read
// from the real CSS: the shared tokens in css/app.css, then each style's own
// block in css/styles/. Same formula as wordbright-design/style-options/tools/contrast.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers.js';

const CSS = ROOT + 'site/css/';

// The custom properties declared in the first block that starts with `selector {`.
function tokens(file, selector) {
  const css = readFileSync(CSS + file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const at = css.indexOf(selector + ' {');
  assert.ok(at >= 0, `${selector} in ${file}`);
  const body = css.slice(at, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const BASE = tokens('app.css', ':root');
const STYLES = {
  garden: { ...BASE, ...tokens('styles/garden.css', ':root') },
  paint: { ...BASE, ...tokens('styles/garden.css', ':root'), ...tokens('styles/paint.css', ':root[data-style="paint"]') },
  night: { ...BASE, ...tokens('styles/garden.css', ':root'), ...tokens('styles/night.css', ':root[data-style="night"]') },
};

// A token's colour as #RRGGBB, following var(--x) and var(--x, fallback).
function colour(t, name, seen = []) {
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

// [text, background]; square names fall back to --sq-ink like the CSS does.
const TEXT = [
  ['--text', '--bg'], ['--text', '--surface'], ['--text', '--surface-2'], ['--text', '--accent-soft'], ['--text', '--rack-bg'],
  ['--muted', '--bg'], ['--muted', '--surface'], ['--muted', '--surface-2'],
  ['--on-accent', '--accent'], ['--on-accent', '--accent-strong'], ['--accent-strong', '--accent-soft'],
  ['--link', '--bg'], ['--link', '--surface'], ['--link', '--row-bg'], ['--link', '--row-star-bg'],
  ['--eyebrow', '--bg'], ['--eyebrow', '--surface'], ['--product', '--bg'], ['--wordmark', '--bg'],
  ['--text', '--row-bg'], ['--text', '--row-star-bg'], ['--muted', '--row-bg'], ['--muted', '--row-star-bg'],
  ['--tile-fg', '--tile-bg'], ['--tile-blank', '--tile-bg'], ['--tile-pending-fg', '--tile-pending-bg'],
  ['--spark-ink', '--spark'], ['--glow-ink', '--glow'], ['--shine-ink', '--shine'], ['--star-ink', '--star'],
  ['--plus5-fg', '--plus5-bg'], ['--winner-fg', '--winner-bg'], ['--pill-fg', '--pill-bg'],
  ['--bad', '--bg'], ['--bad', '--surface'], ['--good', '--surface'],
  ['--learning', '--learning-soft'], ['--spellbright', '--surface'],
];
// Icons and outlines: 3:1 (WCAG 1.4.11).
const UI = [['--why-fg', '--why-bg'], ['--focus', '--bg'], ['--accent', '--surface'], ['--plus5-ring', '--surface']];

const SQUARE_FALLBACK = { '--spark-ink': '--sq-ink', '--glow-ink': '--sq-ink', '--shine-ink': '--sq-ink', '--star-ink': '--sq-ink' };

for (const [style, t] of Object.entries(STYLES)) {
  test(`${style}: every text pair is 4.5:1 or more, icons and outlines 3:1`, () => {
    const low = [];
    const check = (pairs, min) => {
      for (const [fg, bg] of pairs) {
        const f = t[fg] ? fg : SQUARE_FALLBACK[fg];
        const r = ratio(colour(t, f), colour(t, bg));
        if (r < min) low.push(`${fg} on ${bg}: ${r.toFixed(2)}:1 (needs ${min})`);
      }
    };
    check(TEXT, 4.5);
    check(UI, 3);
    assert.deepEqual(low, []);
  });
}

test('the three styles really differ, and Night is dark', () => {
  assert.equal(new Set(Object.values(STYLES).map((t) => colour(t, '--bg'))).size, 3);
  assert.ok(luminance(colour(STYLES.night, '--bg')) < 0.05);
  assert.ok(luminance(colour(STYLES.garden, '--bg')) > 0.8 && luminance(colour(STYLES.paint, '--bg')) > 0.8);
});

test('the formula matches known WCAG values', () => {
  assert.equal(ratio('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(ratio('#777777', '#FFFFFF').toFixed(2), '4.48');
});
