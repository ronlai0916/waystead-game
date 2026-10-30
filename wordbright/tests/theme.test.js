// Theme model (W2b): theme-boot.js sets data-theme and data-style before the
// first paint, from the shared mode ("sb.theme"), this device's day style
// ("wb.dayStyle") and the device's light/dark setting; the Day style picker
// saves "wb.dayStyle" and changes the look at once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers.js';

const BOOT = readFileSync(ROOT + 'site/js/theme-boot.js', 'utf8');

// A tiny browser: localStorage, <html> attributes and a prefers-color-scheme query.
function browser({ mode = null, dayStyle = null, dark = false } = {}) {
  const store = new Map();
  if (mode != null) store.set('sb.theme', mode);
  if (dayStyle != null) store.set('wb.dayStyle', dayStyle);
  const attrs = new Map();
  const listeners = [];
  const mq = { matches: dark, addEventListener: (type, fn) => listeners.push(fn) };
  const win = {
    matchMedia: (q) => { assert.equal(q, '(prefers-color-scheme: dark)'); return mq; },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    document: { documentElement: { setAttribute: (k, v) => attrs.set(k, v), getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null), removeAttribute: (k) => attrs.delete(k) } },
  };
  new Function('window', 'localStorage', 'document', BOOT)(win, win.localStorage, win.document);
  const setDark = (d) => { mq.matches = d; listeners.forEach((fn) => fn()); };
  return { win, store, attrs, setDark };
}

const MODES = [null, 'light', 'dark', 'bogus'];
const DAY_STYLES = [null, 'garden', 'paint', 'bogus'];

test('theme-boot sets data-theme, data-style and data-theme-mode for every combination', () => {
  let n = 0;
  for (const mode of MODES) for (const dayStyle of DAY_STYLES) for (const dark of [false, true]) {
    const { attrs } = browser({ mode, dayStyle, dark });
    const m = mode === 'light' || mode === 'dark' ? mode : 'system';
    const theme = m === 'system' ? (dark ? 'dark' : 'light') : m;
    const style = theme === 'dark' ? 'night' : (dayStyle === 'paint' ? 'paint' : 'garden');
    const at = `mode=${mode} dayStyle=${dayStyle} dark=${dark}`;
    assert.equal(attrs.get('data-theme-mode'), m, at);
    assert.equal(attrs.get('data-theme'), theme, at);
    assert.equal(attrs.get('data-style'), style, at);
    n++;
  }
  assert.equal(n, 32);
});

test('Night always uses the night style; Day uses garden unless paint is chosen', () => {
  assert.equal(browser({ mode: 'dark', dayStyle: 'paint' }).attrs.get('data-style'), 'night');
  assert.equal(browser({ mode: 'light' }).attrs.get('data-style'), 'garden');
  assert.equal(browser({ mode: 'light', dayStyle: 'paint', dark: true }).attrs.get('data-style'), 'paint');
});

test('Match device follows the device live; a chosen Day or Night does not', () => {
  const sys = browser({ dayStyle: 'paint', dark: false });
  assert.equal(sys.attrs.get('data-style'), 'paint');
  sys.setDark(true);
  assert.equal(sys.attrs.get('data-theme'), 'dark');
  assert.equal(sys.attrs.get('data-style'), 'night');
  sys.setDark(false);
  assert.equal(sys.attrs.get('data-style'), 'paint');

  const day = browser({ mode: 'light', dark: false });
  day.setDark(true);
  assert.equal(day.attrs.get('data-theme'), 'light');
  assert.equal(day.attrs.get('data-style'), 'garden');
});

test('no localStorage (private mode) still gives a look', () => {
  const win = {
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    document: { documentElement: { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } } },
  };
  const broken = { getItem() { throw new Error('blocked'); } };
  new Function('window', 'localStorage', 'document', BOOT)(win, broken, win.document);
  assert.equal(win.document.documentElement.attrs['data-style'], 'garden');
});

test('the Day style picker saves wb.dayStyle and changes the look at once', async () => {
  const b = browser({ mode: 'light' });
  globalThis.window = b.win;
  globalThis.localStorage = b.win.localStorage;
  globalThis.document = b.win.document;
  try {
    const { dayStyleHtml, wireDayStyle } = await import('../site/js/ui/daystyle.js');
    const { getDayStyle } = await import('../site/js/store.js');

    assert.match(dayStyleHtml(), /value="garden" checked/);
    let onChange = null;
    const note = { textContent: 'x' };
    const box = { addEventListener: (type, fn) => { assert.equal(type, 'change'); onChange = fn; }, removeEventListener() {}, querySelector: () => note };
    const root = { querySelector: (sel) => (sel === '[data-daystyle]' ? box : null) };
    wireDayStyle(root);
    assert.equal(note.textContent, '', 'no Night note by day');

    onChange({ target: { name: 'daystyle', value: 'paint' } });
    assert.equal(b.store.get('wb.dayStyle'), 'paint');
    assert.equal(getDayStyle(), 'paint');
    assert.equal(b.attrs.get('data-style'), 'paint');
    assert.match(dayStyleHtml(), /value="paint" checked/);

    onChange({ target: { name: 'daystyle', value: 'bogus' } });
    assert.equal(b.store.get('wb.dayStyle'), 'paint', 'unknown styles are ignored');
    onChange({ target: { name: 'board', value: 'garden' } });
    assert.equal(b.store.get('wb.dayStyle'), 'paint', 'other inputs are ignored');

    onChange({ target: { name: 'daystyle', value: 'garden' } });
    assert.equal(b.attrs.get('data-style'), 'garden');

    // At Night the choice is saved, the page stays Night sky, and a note says why.
    b.store.set('sb.theme', 'dark');
    b.win.wbTheme.apply();
    onChange({ target: { name: 'daystyle', value: 'paint' } });
    assert.equal(b.store.get('wb.dayStyle'), 'paint');
    assert.equal(b.attrs.get('data-style'), 'night');
    assert.match(note.textContent, /Night is on/);
  } finally {
    delete globalThis.window;
    delete globalThis.localStorage;
    delete globalThis.document;
  }
});
