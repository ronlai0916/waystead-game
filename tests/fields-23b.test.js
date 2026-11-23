// Spellbright 23b: no text box may have a colour that is not a style token (Ron's Night "Save in" and "Name your list" boxes were white with pale text:
// set.css gave them var(--card, #fff), and --card is defined in no style).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS = fileURLToPath(new URL('../site/css/', import.meta.url));
const files = [...readdirSync(CSS).filter((f) => f.endsWith('.css')).map((f) => f), ...readdirSync(CSS + 'styles').map((f) => 'styles/' + f)];
const src = (f) => readFileSync(CSS + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = (f) => [...src(f).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
const FIELD = /(^|[\s,>])(input|textarea|select)\b|\.(field|answer|st-input|st-select|st-text|s-input|gh-input|typedword)\b/;

test('no CSS uses var(--card ...): the token does not exist', () => {
  for (const f of files) assert.doesNotMatch(src(f), /var\(--card[,)]/, f);
});

test('a text box background and text colour always come from the style tokens', () => {
  let seen = 0;
  for (const f of files) for (const r of rules(f)) {
    if (!FIELD.test(r.sel) || /::placeholder|checkbox|radio/.test(r.sel) || /accent-color/.test(r.body) && !/background/.test(r.body)) continue;
    const bg = /(?:^|;|\s)background(?:-color)?\s*:\s*([^;]+)/.exec(r.body);
    if (bg) {
      seen++;
      assert.match(bg[1].trim(), /^var\(--(surface|surface-2|bg|panel)(\)|,)/, f + ': ' + r.sel + ' background ' + bg[1]);
      assert.doesNotMatch(bg[1], /#fff|white/i, f + ': ' + r.sel);
    }
    const col = /(?:^|;|\s)color\s*:\s*([^;]+)/.exec(r.body);
    if (col) assert.match(col[1].trim(), /^var\(--(text|muted|bad|sb)\)$/, f + ': ' + r.sel + ' colour ' + col[1]);
  }
  assert.ok(seen >= 4, 'found the field rules');
});

test('every field class has a background and a text colour from tokens, and a hint colour', () => {
  const all = files.map(src).join('\n');
  assert.match(all, /\.st-input, \.st-select, \.st-text \{[^}]*background: var\(--surface\)[^}]*color: var\(--text\)/);
  assert.match(all, /\.field \{[^}]*background: var\(--surface\)[^}]*color: var\(--text\)/);
  assert.match(all, /input::placeholder, textarea::placeholder \{ color: var\(--muted\); opacity: 1; \}/);
});
