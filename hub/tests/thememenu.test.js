// The home page's look menu in the top bar (the same as both games'): each
// choice saves the right keys and gives the right data-theme/data-style; the
// tick and the button follow; the menu works from the keyboard and closes on
// Esc, Tab and a click outside. Run: node --test hub/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BOOT = readFileSync(fileURLToPath(new URL('../site/home-assets/js/theme-boot.js', import.meta.url)), 'utf8');

// Just enough DOM for the menu.
class El {
  constructor(doc, attrs = {}, kids = []) {
    this.doc = doc; this.attrs = { ...attrs }; this.kids = kids; this.parent = null; this.listeners = {};
    this.dataset = {}; this.hidden = false; this.tabIndex = -1; this.textContent = '';
    for (const [k, v] of Object.entries(attrs)) if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(\w)/g, (m, c) => c.toUpperCase())] = v;
    kids.forEach((k) => { k.parent = this; });
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn); }
  all() { return this.kids.flatMap((k) => [k, ...k.all()]); }
  querySelectorAll(sel) { const a = /^\[([\w-]+)\]$/.exec(sel)[1]; return this.all().filter((e) => a in e.attrs); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  contains(e) { for (let x = e; x; x = x.parent) if (x === this) return true; return false; }
  closest(sel) { const a = /^\[([\w-]+)\]$/.exec(sel)[1]; for (let x = this; x; x = x.parent) if (a in x.attrs) return x; return null; }
  focus() { this.doc.activeElement = this; }
  // A DOM-like event: runs on this element, then bubbles up to the document.
  fire(type, props = {}) {
    const e = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
    for (let x = this; x; x = x.parent) (x.listeners[type] || []).forEach((fn) => fn(e));
    (this.doc.listeners[type] || []).forEach((fn) => fn(e));
    return e;
  }
}

function page({ mode = null, dayStyle = null, dark = false } = {}) {
  const store = new Map();
  if (mode != null) store.set('sb.theme', mode);
  if (dayStyle != null) store.set('sb.dayStyle', dayStyle);
  const attrs = new Map();
  const doc = {
    listeners: {}, activeElement: null,
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn); },
    dispatchEvent(e) { (this.listeners[e.type] || []).forEach((fn) => fn(e)); return true; },
    documentElement: { setAttribute: (k, v) => attrs.set(k, v), getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null) },
  };
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const win = { matchMedia: () => ({ matches: dark, addEventListener() {} }), localStorage, document: doc };
  new Function('window', 'localStorage', 'document', BOOT)(win, localStorage, doc);
  globalThis.window = win;
  globalThis.localStorage = localStorage;
  globalThis.document = doc;

  const items = ['garden', 'paint', 'night', 'system'].map((id) => new El(doc, { 'data-choice': id, role: 'menuitemradio', 'aria-checked': 'false' }));
  const name = new El(doc, { 'data-theme-name': '' });
  const btn = new El(doc, { id: 'theme', 'aria-expanded': 'false' }, [name]);
  const menu = new El(doc, { id: 'theme-menu', role: 'menu' }, items);
  menu.hidden = true;
  const outside = new El(doc, {});
  return { store, attrs, doc, btn, menu, items, name, outside, item: (id) => items.find((i) => i.dataset.choice === id) };
}

const cleanup = () => { delete globalThis.window; delete globalThis.localStorage; delete globalThis.document; };
const checked = (p) => p.items.filter((i) => i.getAttribute('aria-checked') === 'true').map((i) => i.dataset.choice);

const CASES = [
  // choice, sb.theme after, sb.dayStyle after (from paint saved before), data-theme, data-style (device light / dark)
  { id: 'garden', mode: 'light', dayStyle: 'garden', light: ['light', 'garden'], dark: ['light', 'garden'] },
  { id: 'paint', mode: 'light', dayStyle: 'paint', light: ['light', 'paint'], dark: ['light', 'paint'] },
  { id: 'night', mode: 'dark', dayStyle: 'paint', light: ['dark', 'night'], dark: ['dark', 'night'] },
  { id: 'system', mode: null, dayStyle: 'paint', light: ['light', 'paint'], dark: ['dark', 'night'] },
];

test('each menu choice saves the right keys and sets data-theme and data-style', async () => {
  const { wireThemeMenu } = await import('../site/home-assets/js/thememenu.js');
  try {
    for (const c of CASES) for (const dark of [false, true]) {
      // Start from the opposite: Night saved, Paint box as the day style.
      const p = page({ mode: c.id === 'night' ? 'light' : 'dark', dayStyle: 'paint', dark });
      wireThemeMenu(p.btn, p.menu, p.doc);
      p.btn.fire('click');
      assert.equal(p.menu.hidden, false);
      p.item(c.id).fire('click');
      const at = `${c.id}, device ${dark ? 'dark' : 'light'}`;
      assert.equal(p.store.has('sb.theme') ? p.store.get('sb.theme') : null, c.mode, at + ': sb.theme');
      assert.equal(p.store.get('sb.dayStyle'), c.dayStyle, at + ': sb.dayStyle');
      const [theme, style] = dark ? c.dark : c.light;
      assert.equal(p.attrs.get('data-theme'), theme, at + ': data-theme');
      assert.equal(p.attrs.get('data-style'), style, at + ': data-style');
      assert.deepEqual(checked(p), [c.id], at + ': tick');
      assert.equal(p.btn.getAttribute('data-choice'), c.id, at + ': button icon');
      assert.match(p.btn.getAttribute('aria-label'), /^Look: .+\. Change the look$/);
      assert.equal(p.menu.hidden, true, at + ': closes after choosing');
      assert.equal(p.btn.getAttribute('aria-expanded'), 'false');
      assert.equal(p.doc.activeElement, p.btn, at + ': focus back on the button');
    }
  } finally { cleanup(); }
});

test('Match device keeps the saved day style, and the button names the current look', async () => {
  const { wireThemeMenu, currentChoice } = await import('../site/home-assets/js/thememenu.js');
  try {
    const p = page({ mode: null, dayStyle: 'paint' });
    wireThemeMenu(p.btn, p.menu, p.doc);
    assert.equal(currentChoice(), 'system');
    assert.equal(p.btn.getAttribute('aria-label'), 'Look: Match device. Change the look');
    assert.equal(p.name.textContent, 'Match device');
    assert.deepEqual(checked(p), ['system']);
    assert.equal(p.attrs.get('data-style'), 'paint');

    const q = page({ mode: 'light', dayStyle: 'garden' });
    wireThemeMenu(q.btn, q.menu, q.doc);
    assert.equal(q.btn.getAttribute('aria-label'), 'Look: Day, Sunny garden. Change the look');
    assert.equal(q.btn.getAttribute('data-choice'), 'garden');
  } finally { cleanup(); }
});

test('Esc closes the menu and returns focus; so do Tab and a click outside (without choosing)', async () => {
  const { wireThemeMenu } = await import('../site/home-assets/js/thememenu.js');
  try {
    const p = page({ mode: 'light', dayStyle: 'garden' });
    wireThemeMenu(p.btn, p.menu, p.doc);

    p.btn.fire('click');
    assert.equal(p.doc.activeElement, p.item('garden'), 'opens on the ticked choice');
    const esc = p.doc.activeElement.fire('keydown', { key: 'Escape' });
    assert.ok(esc.defaultPrevented);
    assert.equal(p.menu.hidden, true);
    assert.equal(p.btn.getAttribute('aria-expanded'), 'false');
    assert.equal(p.doc.activeElement, p.btn);

    p.btn.fire('click');
    p.outside.fire('pointerdown');
    assert.equal(p.menu.hidden, true, 'click outside closes');
    p.btn.fire('click');
    p.item('garden').fire('pointerdown');
    assert.equal(p.menu.hidden, false, 'a click inside does not close it early');
    p.doc.activeElement.fire('keydown', { key: 'Tab' });
    assert.equal(p.menu.hidden, true, 'Tab closes');

    assert.equal(p.store.get('sb.theme'), 'light');
    assert.equal(p.store.get('sb.dayStyle'), 'garden', 'closing chose nothing');
  } finally { cleanup(); }
});

test('keyboard: Down opens, arrows/Home/End move and wrap, Enter chooses', async () => {
  const { wireThemeMenu } = await import('../site/home-assets/js/thememenu.js');
  try {
    const p = page({ mode: 'dark' });
    wireThemeMenu(p.btn, p.menu, p.doc);
    p.btn.fire('keydown', { key: 'ArrowDown' });
    assert.equal(p.menu.hidden, false);
    assert.equal(p.doc.activeElement, p.item('night'));
    p.doc.activeElement.fire('keydown', { key: 'ArrowDown' });
    assert.equal(p.doc.activeElement, p.item('system'));
    p.doc.activeElement.fire('keydown', { key: 'ArrowDown' });
    assert.equal(p.doc.activeElement, p.item('garden'), 'wraps to the top');
    p.doc.activeElement.fire('keydown', { key: 'End' });
    assert.equal(p.doc.activeElement, p.item('system'));
    p.doc.activeElement.fire('keydown', { key: 'Home' });
    p.doc.activeElement.fire('keydown', { key: 'ArrowDown' });
    assert.equal(p.doc.activeElement, p.item('paint'));
    assert.equal(p.item('paint').tabIndex, 0, 'roving tabindex');
    p.doc.activeElement.fire('keydown', { key: 'Enter' });
    assert.equal(p.store.get('sb.theme'), 'light');
    assert.equal(p.store.get('sb.dayStyle'), 'paint');
    assert.equal(p.attrs.get('data-style'), 'paint');

    p.btn.fire('keydown', { key: 'ArrowUp' });
    assert.equal(p.doc.activeElement, p.item('system'), 'Up opens on the last choice');
    p.doc.activeElement.fire('keydown', { key: ' ' });
    assert.equal(p.store.has('sb.theme'), false, 'Match device removes the key, as both games do');
  } finally { cleanup(); }
});
