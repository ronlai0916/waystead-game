// SB5 (R4): every class a view of mine writes has a CSS rule, or is a hook on the list below (a wrapper or a marker with nothing to style).
// Found in a real browser: .tile (a row) took the width of a spelling tile from app.css; the check below keeps new markup from going unstyled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const css = [...readdirSync(root('site/css')).filter((f) => f.endsWith('.css')).map((f) => 'site/css/' + f), ...readdirSync(root('site/css/styles')).map((f) => 'site/css/styles/' + f)]
  .map((f) => readFileSync(root(f), 'utf8')).join('\n');
const inCss = new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]));
const FILES = ['views.js', 'child-views.js', 'front-views.js', 'study-views.js', 'words-views.js', 'games-views.js', 'adult-chrome.js'];
// markers and wrappers with nothing to style (the page or the list item is styled by its parent or by its modifiers)
const HOOKS = new Set(['pathrow2', 'frontout', 'practice__one', 'weekpage', 'nopic', 'job--test', 'adultpanel--menu', 'adultpanel--account']);

test('every class in my views has a CSS rule (or is a listed hook)', () => {
  const missing = [];
  for (const f of FILES) {
    const src = readFileSync(root('site/js/' + f), 'utf8');
    for (const m of src.matchAll(/class(?:Name)?(?:=\\?["']|\s*=\s*['"])([^"'<>]*?)["']/g)) {
      for (const t of m[1].split(/\s+/)) if (/^[a-z][\w-]*$/i.test(t) && !t.endsWith('--') && !t.endsWith('-') && !inCss.has(t) && !HOOKS.has(t) && !/^(is|has)-/.test(t)) missing.push(f + ': .' + t);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('the new R4 classes are styled', () => {
  for (const c of ['backlink', 'today__foot', 'choices--look', 'stop__line', 'stop__btns', 'stopsheet', 'empty__line', 'about__scan', 'sheetrow--closed']) assert.ok(inCss.has(c), c);
});

test('a row tile takes the whole row (it shares the name .tile with the spelling tiles)', () => {
  assert.match(readFileSync(root('site/css/child.css'), 'utf8'), /\.sheetrow\.tile \{ flex: 0 0 auto; width: 100%;/);
});
