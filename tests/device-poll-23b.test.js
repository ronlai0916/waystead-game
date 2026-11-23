// Spellbright 23b: Safari's bar changes size without telling the page (Ron's iPhone Air kept the full-bar reserve of 8 px after the bar shrank to the pill, so the footer
// links sat under the pill). device.js now also looks on scroll, touch, page show and every 400 ms. Here the DOM half runs against a fake window that NEVER sends a resize.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = readFileSync(fileURLToPath(new URL('../site/js/device.js', import.meta.url)), 'utf8');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

function phone(h) {
  const props = {}; const attrs = {}; const timers = []; const listeners = {};
  const html = { style: { setProperty: (k, v) => { props[k] = v; } }, setAttribute: (k, v) => { attrs[k] = v; }, appendChild() {} };
  const doc = { documentElement: html, hidden: false, activeElement: null, readyState: 'loading', createElement: () => ({ setAttribute() {}, style: {} }), querySelector: () => null, addEventListener() {} };
  const win = {
    document: doc, navigator: { userAgent: UA, maxTouchPoints: 5 }, screen: { width: 420, height: 912 }, innerWidth: 420, innerHeight: h,
    visualViewport: { width: 420, height: h, addEventListener() {} },
    getComputedStyle: () => ({ paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px' }),
    localStorage: { getItem: () => null, setItem() {} },
    addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
    requestAnimationFrame: (f) => f(), setInterval: (f) => { timers.push(f); return timers.length; },
  };
  const ctx = { window: win, document: doc, navigator: win.navigator };
  vm.runInNewContext(SRC, ctx);
  return { win, props, attrs, timers, listeners };
}

test('the reserve follows the bar with no resize event: the 400 ms look sees the new page height', () => {
  const p = phone(746);
  assert.equal(p.props['--bottom-reserve'], '8px', 'full bar: the page ends above the bar');
  p.win.innerHeight = 845; p.win.visualViewport.height = 845; // the bar shrinks to the pill; no event is sent
  assert.equal(p.props['--bottom-reserve'], '8px', 'nothing has looked yet');
  p.timers.forEach((f) => f());
  assert.equal(p.props['--bottom-reserve'], '79px', 'pill: the page reaches the screen foot, the bar floats over it');
  p.win.innerHeight = 746; p.win.visualViewport.height = 746;
  p.timers.forEach((f) => f());
  assert.equal(p.props['--bottom-reserve'], '8px');
});

test('a scroll or a touch end looks again too', () => {
  const p = phone(746);
  assert.ok(p.listeners.scroll && p.listeners.touchend && p.listeners.pageshow && p.listeners.resize, 'listeners on window');
  p.win.innerHeight = 845; p.win.visualViewport.height = 845;
  p.listeners.scroll.forEach((f) => f());
  assert.equal(p.props['--bottom-reserve'], '79px');
});

test('the look every 400 ms writes nothing when no number changed', () => {
  const p = phone(845);
  let n = 0; const set = p.props; const before = JSON.stringify(set);
  p.timers.forEach((f) => f());
  assert.equal(JSON.stringify(set), before);
  assert.equal(n, 0);
});
