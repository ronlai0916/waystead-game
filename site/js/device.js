// SB5 D1: the app checks the device (platform, browser, screen) and lays out to fit.
// A classic script in <head> (no inline script: the CSP is strict), so it runs before the first paint.
// Two halves:
//   1. PURE (unit-tested in tests/device-sb5.test.js, many user-agent strings): detect(), reserveFor(), sizeClass(), orientOf().
//   2. DOM: measures the real room and writes it on <html>:
//        data-os  ios | ipados | android | desktop          data-browser  safari | chrome | firefox | edge | samsung | webview | other
//        data-standalone  yes | no                          data-orient   portrait | landscape
//        data-h   xs (<600) | s (600-719) | m (720-859) | l (>=860), from the AVAILABLE height: the visible height less the top inset and the bottom reserve
//        --app-h / --app-w   the real visible size in px (visualViewport, else innerHeight / innerWidth)
//        --sat / --sab / --sal / --sar   the real safe-area insets in px (a probe element reads env(safe-area-inset-*))
//        --bottom-reserve   how far above the bottom edge the last control must end (a floating browser bar, the home bar)
//        --head-h   the top bar's measured height
// CSS never guesses a viewport unit minus a fixed pixel number: it uses var(--app-h) and these.
// TEST HOOK: only when localStorage "sb.devTest" holds JSON such as {"sat":59,"sab":34} does the measured inset become that
// (Chromium cannot set env(); tools/smoke-sb5/devices.mjs uses it). A real visitor never has the key.
(function (root) {
  'use strict';

  // ---- 1. pure -------------------------------------------------------------------------------------------------------------------
  function verOf(ua, re) { var m = re.exec(ua); return m ? parseFloat(m[1].replace('_', '.')) : 0; }

  /** What device is this? in: { ua, maxTouchPoints, standalone }. out: { os, browser, iosVersion, standalone, mobile }. */
  function detect(inp) {
    var ua = String((inp && inp.ua) || '');
    var touch = Number((inp && inp.maxTouchPoints) || 0);
    var standalone = !!(inp && inp.standalone);
    var os = 'desktop';
    if (/iPhone|iPod/.test(ua)) os = 'ios';
    else if (/iPad/.test(ua)) os = 'ipados';
    else if (/Macintosh/.test(ua) && touch > 1) os = 'ipados'; // iPadOS asks for the desktop site by default
    else if (/Android/.test(ua)) os = 'android';

    var browser = 'other';
    var iosVersion = 0;
    if (os === 'ios' || os === 'ipados') {
      var osVer = verOf(ua, /OS (\d+[_.]\d+)/);
      var safariVer = verOf(ua, /Version\/(\d+\.\d+)/);
      iosVersion = Math.max(osVer, safariVer); // Safari 26 still says "iPhone OS 18_6" in its user agent; Version/26 tells the truth
      if (/CriOS/.test(ua)) browser = 'chrome';
      else if (/FxiOS/.test(ua)) browser = 'firefox';
      else if (/EdgiOS/.test(ua)) browser = 'edge';
      else if (/OPiOS|OPT\//.test(ua)) browser = 'other';
      else if (/FBAN|FBAV|Instagram|Line\/|MicroMessenger|GSA\/|Snapchat|TikTok|Twitter/.test(ua)) browser = 'webview';
      else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'safari';
      else if (/Macintosh/.test(ua) && /Version\//.test(ua)) browser = 'safari';
      else if (/Mobile\//.test(ua) && !/Safari\//.test(ua)) browser = 'webview'; // WKWebView: no Safari token
      else if (/Chrome\//.test(ua)) browser = 'chrome';
    } else if (os === 'android') {
      if (/; wv\)|\bwv\b/.test(ua) || /FBAN|FBAV|Instagram|Line\/|MicroMessenger|GSA\//.test(ua)) browser = 'webview';
      else if (/SamsungBrowser/.test(ua)) browser = 'samsung';
      else if (/EdgA/.test(ua)) browser = 'edge';
      else if (/Firefox\//.test(ua)) browser = 'firefox';
      else if (/OPR\/|OPT\/|UCBrowser|MiuiBrowser|HuaweiBrowser/.test(ua)) browser = 'other';
      else if (/Chrome\//.test(ua)) browser = 'chrome';
    } else {
      if (/Edg\//.test(ua)) browser = 'edge';
      else if (/Firefox\//.test(ua)) browser = 'firefox';
      else if (/OPR\//.test(ua)) browser = 'other';
      else if (/Chrome\//.test(ua) || /Chromium\//.test(ua)) browser = 'chrome';
      else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'safari';
    }
    return { os: os, browser: browser, iosVersion: iosVersion, standalone: standalone, mobile: os !== 'desktop' };
  }

  function orientOf(w, h) { return w > h ? 'landscape' : 'portrait'; }

  /** The size class from the available height (px). */
  function sizeClass(h) { return h < 600 ? 'xs' : h < 720 ? 's' : h < 860 ? 'm' : 'l'; }

  /** The bottom overlay reserve (px): how far above the bottom edge the last control must end. in: detect() result + { orient, sab }. */
  function reserveFor(d, orient, sab, w, h, scr) {
    var b = Math.max(0, Number(sab) || 0);
    var land = orient === 'landscape';
    if (d.os === 'ios') {
      // 22 Nov (Ron's iPhone Air, Safari 27.2, About this device): with Safari's full bar showing, the page is 746 px of a 912 px screen. The page starts under
      // the status bar (inset top 0) and ENDS ABOVE the bar, so the bar covers none of it and 84 more left a 100 px gap. So: 84 less the part of the screen's foot
      // that already lies below the page (screen height - page height - the status-bar strip above the page, about 62 px when the inset top is 0), at least 8.
      // When the bar shrinks to the small pill the page grows to the foot again and the reserve goes back to about 84. scr = { sh: screen height, sat: inset top }.
      if (d.browser === 'safari' && !d.standalone && d.iosVersion >= 15 && !land && scr && scr.sh > 0 && h > 0) {
        var below = scr.sh - h - ((Number(scr.sat) || 0) > 0 ? 0 : 62);
        return Math.max(8, Math.min(84, Math.round(84 - Math.max(0, below))));
      }
      // The floating bottom bar overlays the page. Measured on Ron's iPhone Air (Safari 26, screenshot 21 Nov): the bar's top is about 80 px above the screen's foot,
      // and that foot INCLUDES the 34 px home-indicator strip (the bar sits inside it, it does not stack on top of it). The old 78 + inset (= 112) counted the
      // strip twice and left about 30 px blank (about 60 px with the sticky bar's own padding). So: 84 in total, whatever the inset reads. Landscape: a thinner bar.
      if (d.browser === 'safari' && !d.standalone && d.iosVersion >= 15) return land ? Math.max(48, b + 20) : 84;
      if (d.browser === 'safari' && d.standalone) return b;
      return b + 12; // Chrome, Firefox, Edge, a web view, an old Safari: the toolbar is outside the page
    }
    if (d.os === 'ipados') return d.standalone ? b : b + 16;
    if (d.os === 'android') return b + 16; // the gesture bar
    if ((w > 0 && w < 600) || (h > 0 && h < 500)) return 112 + b; // a desktop-looking agent in a phone-sized window (a phone asking for the desktop site, an emulator, a phone on its side): the old safe zone
    return 16;
  }

  var api = { detect: detect, reserveFor: reserveFor, sizeClass: sizeClass, orientOf: orientOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined' || !root || !root.document) return;

  // ---- 2. DOM --------------------------------------------------------------------------------------------------------------------
  var doc = root.document;
  var html = doc.documentElement;
  var probe = null;
  var last = {};
  var queued = false;
  var headEl = null;
  var DEFAULT_HEAD = 72;

  function readLS(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function writeLS(k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function standaloneNow() {
    try { if (root.matchMedia && root.matchMedia('(display-mode: standalone)').matches) return true; } catch (e) { /* ignore */ }
    return !!(root.navigator && root.navigator.standalone);
  }

  function insets() {
    var o = { sat: 0, sab: 0, sal: 0, sar: 0 };
    try {
      if (!probe) {
        probe = doc.createElement('div');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
        html.appendChild(probe);
      }
      var cs = root.getComputedStyle(probe);
      o.sat = parseFloat(cs.paddingTop) || 0; o.sar = parseFloat(cs.paddingRight) || 0;
      o.sab = parseFloat(cs.paddingBottom) || 0; o.sal = parseFloat(cs.paddingLeft) || 0;
    } catch (e) { /* zero insets */ }
    var t = readLS('sb.devTest'); // the test hook
    if (t) {
      try {
        var j = JSON.parse(t);
        ['sat', 'sab', 'sal', 'sar'].forEach(function (k) { if (typeof j[k] === 'number') o[k] = j[k]; });
      } catch (e) { /* ignore */ }
    }
    return o;
  }

  function editing() {
    var a = doc.activeElement;
    return !!(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable));
  }

  function screenTall() { // the screen's long side (iOS reports the portrait size whichever way the phone is held)
    var sc = root.screen || {};
    return Math.max(Number(sc.width) || 0, Number(sc.height) || 0);
  }

  function measure() {
    var vv = root.visualViewport;
    var w = Math.round((vv && vv.width) || root.innerWidth || 0);
    var h = Math.round((vv && vv.height) || root.innerHeight || 0);
    var orient = orientOf(w, h);
    // an on-screen keyboard shrinks the visual viewport: the layout keeps the height it had (unless the phone turned)
    if (last.h && editing() && last.orient === orient) h = last.h;
    var d = detect({ ua: root.navigator && root.navigator.userAgent, maxTouchPoints: root.navigator && root.navigator.maxTouchPoints, standalone: standaloneNow() });
    var ins = insets();
    if (!headEl || !headEl.isConnected) headEl = doc.querySelector('.topbar');
    var head = headEl ? Math.round(headEl.getBoundingClientRect().height) : 0;
    if (!head) head = Number(readLS('sb.headH')) || DEFAULT_HEAD;
    return { d: d, w: w, h: h, orient: orient, ins: ins, head: head, reserve: reserveFor(d, orient, ins.sab, w, h, { sh: screenTall(), sat: ins.sat }) };
  }

  function apply() {
    queued = false;
    var m = measure();
    var s = html.style;
    var set = function (k, v) { if (last[k] !== v) { last[k] = v; s.setProperty(k, v); } };
    var attr = function (k, v) { if (last[k] !== v) { last[k] = v; html.setAttribute(k, v); } };
    attr('data-os', m.d.os); attr('data-browser', m.d.browser); attr('data-standalone', m.d.standalone ? 'yes' : 'no');
    attr('data-orient', m.orient); attr('data-h', sizeClass(m.h - m.ins.sat - m.reserve)); // the room the page really has: visible height less the status-bar inset and the bottom reserve
    set('--app-h', m.h + 'px'); set('--app-w', m.w + 'px');
    set('--sat', m.ins.sat + 'px'); set('--sab', m.ins.sab + 'px'); set('--sal', m.ins.sal + 'px'); set('--sar', m.ins.sar + 'px');
    set('--bottom-reserve', m.reserve + 'px');
    set('--head-h', m.head + 'px');
    if (headEl && m.head !== last.savedHead) { last.savedHead = m.head; writeLS('sb.headH', String(m.head)); }
    last.h = m.h; last.orient = m.orient;
    return m;
  }

  function queue() {
    if (queued) return;
    queued = true;
    if (root.requestAnimationFrame) root.requestAnimationFrame(apply); else apply();
  }

  apply(); // before the first paint
  root.addEventListener('resize', queue);
  root.addEventListener('orientationchange', queue);
  if (root.visualViewport) { root.visualViewport.addEventListener('resize', queue); root.visualViewport.addEventListener('scroll', queue); }
  doc.addEventListener('focusout', queue);
  doc.addEventListener('DOMContentLoaded', function () {
    apply();
    var bar = doc.querySelector('.topbar');
    if (bar && root.ResizeObserver) new root.ResizeObserver(queue).observe(bar);
  });
  root.sbDevice = { detect: detect, reserveFor: reserveFor, sizeClass: sizeClass, orientOf: orientOf, apply: apply, measure: measure };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
