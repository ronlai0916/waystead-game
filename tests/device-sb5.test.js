// SB5 D1: site/js/device.js, the pure half (detect, reserveFor, sizeClass) with many user-agent strings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const D = require('../site/js/device.js');
const SITE = fileURLToPath(new URL('../site/', import.meta.url));

const UA = {
  iphoneSafari18: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneSafari26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  iphoneSafari14: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.37 Mobile/15E148 Safari/604.1',
  iphoneFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/128.0 Mobile/15E148 Safari/605.1.15',
  iphoneEdge: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/126.0.2592.100 Mobile/15E148 Safari/605.1.15',
  iphoneWebview: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0',
  iphoneFacebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]',
  ipadSafari: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  ipadChrome: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
  pixelChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0',
  androidEdge: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.2592.80',
  androidWebview: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36',
  androidFacebook: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]',
  androidOpera: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 OPR/80.0',
  winChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  linuxChrome: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  empty: '',
};

const d = (ua, extra) => D.detect({ ua: UA[ua], ...(extra || {}) });

test('iPhone: Safari, Chrome, Firefox, Edge and web views', () => {
  assert.deepEqual([d('iphoneSafari18').os, d('iphoneSafari18').browser], ['ios', 'safari']);
  assert.equal(d('iphoneSafari18').iosVersion, 18);
  assert.equal(d('iphoneSafari26').iosVersion, 26, 'Safari 26 says OS 18_6 but Version/26');
  assert.equal(d('iphoneSafari14').iosVersion, 14.8);
  assert.equal(d('iphoneChrome').browser, 'chrome');
  assert.equal(d('iphoneFirefox').browser, 'firefox');
  assert.equal(d('iphoneEdge').browser, 'edge');
  for (const k of ['iphoneWebview', 'iphoneInstagram', 'iphoneFacebook']) assert.equal(d(k).browser, 'webview', k);
  assert.equal(d('iphoneWebview').os, 'ios');
});

test('iPad, including the desktop user agent with touch points', () => {
  assert.equal(d('ipadSafari').os, 'ipados');
  assert.equal(d('ipadDesktop', { maxTouchPoints: 5 }).os, 'ipados');
  assert.equal(d('ipadDesktop', { maxTouchPoints: 5 }).browser, 'safari');
  assert.equal(d('ipadDesktop', { maxTouchPoints: 0 }).os, 'desktop', 'a Mac has no touch points');
  assert.equal(d('ipadDesktop', { maxTouchPoints: 1 }).os, 'desktop');
  assert.equal(d('ipadChrome').browser, 'chrome');
});

test('Android browsers', () => {
  assert.deepEqual([d('pixelChrome').os, d('pixelChrome').browser], ['android', 'chrome']);
  assert.equal(d('samsung').browser, 'samsung');
  assert.equal(d('androidFirefox').browser, 'firefox');
  assert.equal(d('androidEdge').browser, 'edge');
  assert.equal(d('androidWebview').browser, 'webview');
  assert.equal(d('androidFacebook').browser, 'webview');
  assert.equal(d('androidOpera').browser, 'other');
});

test('desktop and unknown', () => {
  for (const [k, b] of [['winChrome', 'chrome'], ['winEdge', 'edge'], ['winFirefox', 'firefox'], ['macSafari', 'safari'], ['linuxChrome', 'chrome']]) {
    assert.deepEqual([d(k).os, d(k).browser], ['desktop', b], k);
    assert.equal(d(k).mobile, false);
  }
  assert.deepEqual([d('empty').os, d('empty').browser], ['desktop', 'other']);
  assert.deepEqual([D.detect({}).os, D.detect().os], ['desktop', 'desktop']);
});

test('standalone is passed through', () => {
  assert.equal(d('iphoneSafari18', { standalone: true }).standalone, true);
  assert.equal(d('iphoneSafari18').standalone, false);
});

test('bottom reserve per profile', () => {
  const r = (k, o, sab, x) => D.reserveFor(d(k, x), o, sab);
  assert.equal(r('iphoneSafari26', 'portrait', 34), 84, 'the floating bar: 84 in total, the 78 spans the inset (no double count)');
  assert.equal(r('iphoneSafari26', 'portrait', 0), 84, 'iPhone SE: the same 84');
  assert.equal(r('iphoneSafari26', 'landscape', 21), 48, 'landscape: max(48, inset + 20)');
  assert.equal(r('iphoneSafari26', 'landscape', 34), 54);
  assert.equal(r('iphoneSafari26', 'portrait', 34, { standalone: true }), 34, 'home-screen app: the inset only');
  assert.equal(r('iphoneSafari14', 'portrait', 34), 46, 'old Safari: toolbar outside the page');
  for (const k of ['iphoneChrome', 'iphoneFirefox', 'iphoneEdge', 'iphoneWebview']) assert.equal(r(k, 'portrait', 34), 46, k);
  for (const k of ['pixelChrome', 'samsung', 'androidFirefox']) assert.equal(r(k, 'portrait', 0), 16, k);
  assert.equal(r('pixelChrome', 'portrait', 24), 40);
  assert.equal(r('winChrome', 'portrait', 0), 16);
  assert.equal(r('winChrome', 'landscape', 0), 16);
  assert.equal(D.reserveFor(d('winChrome'), 'portrait', 0, 390), 112, 'a desktop agent in a phone-sized window keeps the old safe zone');
  assert.equal(D.reserveFor(d('winChrome'), 'portrait', 0, 1280, 800), 16);
  assert.equal(D.reserveFor(d('winChrome'), 'landscape', 0, 844, 390), 112, 'a short window too');
  assert.equal(D.reserveFor(d('pixelChrome'), 'portrait', 0, 360), 16, 'Android is still 16');
  assert.equal(D.reserveFor(d('ipadSafari'), 'landscape', 20), 36);
});

test('size classes and orientation', () => {
  assert.deepEqual([599, 600, 719, 720, 859, 860, 912].map(D.sizeClass), ['xs', 's', 's', 'm', 'm', 'l', 'l']);
  assert.equal(D.orientOf(420, 912), 'portrait');
  assert.equal(D.orientOf(1180, 820), 'landscape');
});

test('wired in: loaded early from index.html, in the service worker shell, CSP untouched', () => {
  const html = readFileSync(SITE + 'index.html', 'utf8');
  const sw = readFileSync(SITE + 'sw.js', 'utf8');
  assert.match(html, /<script src="js\/device\.js"><\/script>/);
  assert.ok(html.indexOf('js/device.js') < html.indexOf('css/app.css'), 'before the stylesheet');
  assert.ok(!/<script>[^<]/.test(html), 'no inline script');
  assert.match(sw, /'js\/device\.js'/);
  const src = readFileSync(SITE + 'js/device.js', 'utf8');
  assert.ok(!/\.innerHTML|setAttribute\(['"]style/.test(src), 'no inline style attribute');
});

// ---- the pages use the measured numbers, never a viewport unit minus a pixel guess ----
import * as C from '../site/js/child-doc.js';
test('no calc() of a viewport unit minus pixels is left in the stylesheets', () => {
  for (const f of ['app', 'child', 'mix', 'adult', 'grownups', 'set', 'tray', 'lists', 'front', 'device']) {
    const css = readFileSync(SITE + 'css/' + f + '.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const bad = css.match(/calc\(\s*100\s*(?:d|s|l)?vh\s*[-+]/g);
    assert.equal(bad, null, f + '.css: ' + bad);
  }
  const app = readFileSync(SITE + 'css/app.css', 'utf8');
  assert.match(app, /--safe-zone: var\(--bottom-reserve\)/);
  assert.match(app, /--bottom-reserve: calc\(env\(safe-area-inset-bottom, 0px\) \+ 112px\)/, 'no-script fallback');
  assert.match(app, /\.topbar \{[^}]*padding-top: var\(--sat\)/, 'the top bar clears the status bar');
  assert.match(readFileSync(SITE + 'css/device.css', 'utf8'), /data-h="xs"/);
});

test('the grown-up name is read from the device cache when the words value has none', () => {
  assert.equal(C.setByLine('g.p1', C.setupWithBy({}, 'Dad')), C.setByLine('g.p1', { by: { n: 'Dad', at: 5 } }));
  assert.match(C.setByLine('g.p1', C.setupWithBy({}, 'Dad')), /Dad/);
  assert.match(C.setByLine('g.p1', C.setupWithBy({}, '')), /grown-up/i);
  assert.deepEqual(C.setupWithBy({ by: { n: 'Mum', at: 9 } }, 'Dad'), { by: { n: 'Mum', at: 9 } }, 'a name in the setup wins');
  assert.deepEqual(C.setupWithBy(undefined, null), {});
});

// ---- D2: the About this device page, its link, the shell, the reserve comment -----------------------------------------------------
import { rowsText } from '../site/js/device-view.js';
test('D2: #/device is routed, safe, in the shell, linked from Settings (child) and the account panel (adult)', () => {
  const rd = (p) => readFileSync(SITE + p, 'utf8');
  assert.match(rd('js/app.js'), /\['device', devicePage\]/);
  assert.match(rd('js/test-guard.js'), /device: 'safe'/);
  assert.match(rd('sw.js'), /'js\/device-view\.js'/);
  assert.match(rd('js/child-views.js'), /href="#\/device" data-devicelink>About this device/);
  assert.match(rd('js/adult-chrome.js'), /href="#\/device" data-devicelink>About this device/);
  const css = rd('css/device.css');
  assert.match(css, /\.devline \{[^}]*bottom: var\(--bottom-reserve\)/);
  assert.doesNotMatch(rd('js/device-view.js'), /style="/, 'no style attribute in the markup (strict CSP)');
  assert.equal(rowsText([['A', '1'], ['B', '2']]), 'A: 1\nB: 2');
});

test('22 Nov: iOS Safari portrait reserve uses the real page vs screen height (Ron\'s iPhone Air, full bar)', () => {
  const ios = D.detect({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1', maxTouchPoints: 5 });
  assert.equal(D.reserveFor(ios, 'portrait', 0, 420, 746, { sh: 912, sat: 0 }), 8, 'the page ends above the bar: no gap');
  assert.equal(D.reserveFor(ios, 'portrait', 34, 420, 912, { sh: 912, sat: 59 }), 84, 'the page reaches the foot (bar over it): 84');
  assert.equal(D.reserveFor(ios, 'portrait', 0, 420, 845, { sh: 912, sat: 0 }), 79, 'small pill: the page nearly reaches the foot');
  assert.equal(D.reserveFor(ios, 'portrait', 34, 420, 912), 84, 'no screen numbers: 84 as before');
  assert.equal(D.reserveFor(ios, 'landscape', 0, 912, 380, { sh: 912, sat: 0 }), 48, 'landscape unchanged');
});
