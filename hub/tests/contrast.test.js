// Waystead Game home page: every text/background pair is WCAG AA (4.5:1) in
// all three styles, and icons/outlines 3:1, read from the real CSS: the
// shared tokens in home-assets/css/hub.css, then each style's own block in
// home-assets/css/styles/. Same method as tests/contrast.test.js (Spellbright).
// Run: node --test hub/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ASSETS = fileURLToPath(new URL('../site/home-assets/', import.meta.url));
const CSS = ASSETS + 'css/';

// The custom properties declared in the first block that starts with `selector {`.
function tokens(file, selector) {
  const css = readFileSync(CSS + file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const at = css.indexOf(selector + ' {');
  assert.ok(at >= 0, `${selector} in ${file}`);
  const body = css.slice(at, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const BASE = tokens('hub.css', ':root');
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
  ['--link', '--bg'], ['--link', '--surface'], ['--link', '--surface-2'],
  ['--eyebrow', '--bg'], ['--eyebrow', '--surface'], ['--product', '--bg'], ['--wordmark', '--bg'],
  // The game cards: eyebrow and "Play" link on the card, "Coming soon" pill
  ['--spellbright', '--surface'], ['--spellbright', '--spellbright-soft'],
  ['--wordbright', '--surface'], ['--wordbright', '--wordbright-soft'],
  // The Waystead Learning panel (its heading, text and darker Teal button)
  ['--learning', '--learning-soft'], ['--text', '--learning-soft'], ['#FFFFFF', '--learning-btn'], ['#FFFFFF', '--learning-btn-hover'],
  // Text on the hero picture (wide screens): the same cream in every style
  ['--hero-text', '--hero-bg'], ['--hero-eyebrow', '--hero-bg'],
];
// Icons and outlines: 3:1 (WCAG 1.4.11): focus rings, the open menu's ring,
// the card colour rails.
const UI = [['--focus', '--bg'], ['--focus', '--surface'], ['--focus', '--surface-2'], ['--accent', '--bg'], ['--accent', '--surface'],
  ['--spellbright', '--bg'], ['--wordbright', '--bg'], ['--wordmark', '--bg']];

for (const [style, t] of Object.entries(STYLES)) {
  test(`${style}: every text pair is 4.5:1 or more, icons and outlines 3:1`, () => {
    const low = [];
    const check = (pairs, min) => {
      for (const [fg, bg] of pairs) {
        const r = ratio(colour(t, fg), colour(t, bg));
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

test('brand colours: Terracotta accent, Plum and Indigo cards by day, darker Teal only on the Learning panel', () => {
  for (const s of ['garden', 'paint']) {
    const t = STYLES[s];
    assert.equal(colour(t, '--accent'), '#B4532A', `${s} accent`);
    assert.equal(colour(t, '--spellbright'), '#6B3FA0', `${s} Spellbright`);
    assert.equal(colour(t, '--wordbright'), '#3B5BDB', `${s} Wordbright`);
  }
  assert.equal(colour(STYLES.night, '--accent'), '#E8875E', 'night: light Terracotta');
  for (const [s, t] of Object.entries(STYLES)) {
    assert.equal(colour(t, '--learning-btn'), '#0C7167', `${s} Learning button`);
    assert.equal(colour(t, '--amber'), '#F2A31D', `${s} waypoint dot`);
    for (const k of ['--accent', '--accent-strong', '--link', '--eyebrow', '--product', '--focus', '--spellbright', '--wordbright']) {
      assert.ok(!['#0F8B7E', '#0C7167', '#0A5C54'].includes(colour(t, k)), `${s} ${k} is Teal`);
    }
  }
  assert.equal(colour(STYLES.garden, '--wordmark'), '#1B1A20');
  assert.equal(colour(STYLES.paint, '--wordmark'), '#1B1A20');
  assert.equal(colour(STYLES.night, '--wordmark'), '#F3F1EC');
});

test('every font in the CSS is here with its OFL licence, and none is Manrope', () => {
  const LICENCE = { andika: 'andika', atkinson: 'atkinsonhyperlegible', baloo2: 'baloo2', fredoka: 'fredoka', lexend: 'lexend', nunito: 'nunito', sora: 'sora' };
  const files = ['hub.css', 'styles/garden.css', 'styles/paint.css', 'styles/night.css'];
  let n = 0;
  for (const f of files) {
    const css = readFileSync(CSS + f, 'utf8');
    assert.doesNotMatch(css, /Manrope/, f);
    for (const [, url] of css.matchAll(/url\("\.\.\/(?:\.\.\/)?fonts\/([\w-]+\.woff2)"\)/g)) {
      assert.ok(existsSync(ASSETS + 'fonts/' + url), url);
      const family = url.split('-')[0];
      assert.ok(LICENCE[family], 'licence name for ' + url);
      assert.ok(existsSync(ASSETS + 'fonts/licences/OFL-' + LICENCE[family] + '.txt'), 'licence for ' + url);
      n++;
    }
  }
  assert.equal(n, 9);
});

test('the formula matches known WCAG values', () => {
  assert.equal(ratio('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(ratio('#777777', '#FFFFFF').toFixed(2), '4.48');
});
