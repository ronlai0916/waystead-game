// The home page's theme model (the same as both games'): theme-boot.js sets
// data-theme and data-style before the first paint, from the shared mode
// ("sb.theme") and day style ("sb.dayStyle") and the device's light/dark
// setting. Run: node --test hub/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../site/', import.meta.url));
const BOOT = readFileSync(SITE + 'home-assets/js/theme-boot.js', 'utf8');

// A tiny browser: localStorage, <html> attributes and a prefers-color-scheme query.
function browser({ mode = null, dayStyle = null, dark = false } = {}) {
  const store = new Map();
  if (mode != null) store.set('sb.theme', mode);
  if (dayStyle != null) store.set('sb.dayStyle', dayStyle);
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

test('theme-boot sets data-theme, data-style and data-theme-mode for every mode × day style × device', () => {
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

test('store.js saves the shared keys and changes the look at once; Match device removes sb.theme', async () => {
  const b = browser({ mode: 'light' });
  globalThis.window = b.win;
  globalThis.localStorage = b.win.localStorage;
  globalThis.document = b.win.document;
  try {
    const { getTheme, setTheme, getDayStyle, setDayStyle } = await import('../site/home-assets/js/store.js');
    assert.equal(getDayStyle(), 'garden');
    setDayStyle('paint');
    assert.equal(b.store.get('sb.dayStyle'), 'paint');
    assert.equal(b.attrs.get('data-style'), 'paint');
    setDayStyle('bogus');
    assert.equal(b.store.get('sb.dayStyle'), 'paint', 'unknown styles are ignored');
    setTheme('dark');
    assert.equal(getTheme(), 'dark');
    assert.equal(b.attrs.get('data-style'), 'night');
    setTheme('system');
    assert.equal(b.store.has('sb.theme'), false);
    assert.equal(b.attrs.get('data-style'), 'paint');
  } finally {
    delete globalThis.window;
    delete globalThis.localStorage;
    delete globalThis.document;
  }
});

test('a day style chosen in Wordbright before it was shared moves across once', () => {
  const store = new Map([['wb.dayStyle', 'paint'], ['sb.theme', 'light']]);
  const attrs = new Map();
  const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const doc = { documentElement: { setAttribute: (k, v) => attrs.set(k, v) } };
  new Function('window', 'localStorage', 'document', BOOT)({ matchMedia: () => ({ matches: false, addEventListener() {} }) }, ls, doc);
  assert.equal(store.get('sb.dayStyle'), 'paint');
  assert.equal(store.has('wb.dayStyle'), false);
  assert.equal(attrs.get('data-style'), 'paint');
});

test('theme-boot is the same as the games\' (apart from comments)', () => {
  const code = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
  const sb = readFileSync(SITE + '../../site/js/theme-boot.js', 'utf8');
  assert.equal(code(BOOT), code(sb));
});

test('the page runs theme-boot before its stylesheets, loads all three styles and preloads no font', () => {
  const html = readFileSync(SITE + 'index.html', 'utf8');
  const boot = html.indexOf('home-assets/js/theme-boot.js');
  assert.ok(boot > 0 && boot < html.indexOf('rel="stylesheet"'), 'theme-boot first');
  for (const s of ['garden', 'paint', 'night']) assert.ok(html.includes(`href="home-assets/css/styles/${s}.css"`), s);
  assert.doesNotMatch(html, /rel="preload"[^>]*font/);
  assert.doesNotMatch(html, /<script>|style="/, 'CSP: no inline script or style');
  for (const id of ['garden', 'paint', 'night', 'system']) assert.match(html, new RegExp(`data-choice="${id}"`));
});
