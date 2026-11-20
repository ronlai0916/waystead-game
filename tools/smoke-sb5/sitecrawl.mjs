// SB5 WP-H part two: the WHOLE-SITE phone crawl (R-PH6, TR-60 extended). Loaded by tools/sb2-smoke.mjs with the harness H.
// Scenes (prefix 'SB5 site: '):  signed out | child | adult | panels
//   node tools/sb2-smoke.mjs <fresh dir> 'SB5 site: *'        (CHROME_PATH=... flock /tmp/claude-0/smoke.lock ...)
// Every route in site/js/app.js ROUTES (child, grown-up, signed out) plus the open Menu / account / Which week? / look menu / confirm dialogs / toast,
// at nine phone sizes (the SCREEN size, 375x667 ... 915x412: the layout viewport is the screen), in garden, paint and night, with a simulated 110 px
// bottom overlay (an injected fixed, non-interactive div: Safari's floating bar), text at 130% on F1/F4/F7 in garden.
// Checks (R-PH6):
//   a  after scrolling to the very end, every control's bottom edge is >= 120 px above the viewport bottom, OR it is inside the first screen above the overlay (bottom <= h-110 at scroll 0), OR it is REACHABLE (some scroll stop puts it wholly above the 110 px band and clear of every fixed or sticky element)
//   b  no sideways scroll
//   c  tap targets >= 44x44 (letter keys and tiles >= 32x48); a link running inside a sentence is exempt
//   d  a fixed or sticky element (hit test, so z-order counts; the toast by geometry) sits over >= 40 % of a control at scroll 0 AND at the very end AND at no stop of a scroll sweep (S3: reachability; one that can be scrolled clear of a sticky bar and the band is fine)
// KNOWN failures: tools/smoke-sb5/sitecrawl-known.json (key -> worst px; for c the worst shortfall, for d the covered px height). New or worse fails the scene; a listed one that now passes prints FIXED.
// Env: SITE_RECORD=<dir> writes sitecrawl-results.json and sitecrawl-known.json there (the baseline; the scene then does not fail); SITE_ONLY='<regexp on "role page">'; SITE_SIZES='F1,F4'; SITE_STYLES='garden'.
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import * as Su from '../../site/js/setup-doc.js';
import * as Ow from '../../site/js/own-doc.js';
import { FOLD_STYLES } from './fold.mjs';

// TR-60 sizes, as the SCREEN: [id, device, w, h]
export const SITE_SIZES = [
  ['F1', 'iPhone SE', 375, 667], ['F2', 'iPhone 14', 390, 844], ['F3', 'iPhone Pro Max', 430, 932],
  ['F4', 'Android small', 360, 640], ['F5', 'Android', 360, 800], ['F6', 'Android large', 412, 915],
  ['F7', 'iPhone SE landscape', 667, 375], ['F8', 'iPhone landscape', 844, 390], ['F9', 'Android landscape', 915, 412],
].map(([id, device, w, h]) => ({ id, device, w, h }));
export const OVERLAY = 110; // Safari's floating bottom bar
export const SAFE = 120; // the bottom safe zone (R-PH6)
const Z_SIZES = ['F1', 'F4', 'F7'];

export default function (H) {
  const { scene, go, click, ev, ok, until, sleep, style, send, ROOT, acct, signedOutBlank, seedChild, weekDoc, studied, W, MON, plus, CHILD, CHILD2, ADULT, open } = H;
  const KNOWN_FILE = join(ROOT, 'tools/smoke-sb5/sitecrawl-known.json');
  const q = (s) => JSON.stringify(s);
  const OID = 'rown1';
  const NOW = Date.parse(plus(2) + 'T10:00:00');
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const WORDS6 = ['build', 'earth', 'fruit', 'heart', 'island', 'because'];

  // S3: the test pages shuffle their words with Math.random, which moves a landscape page by a few px from run to run. A seeded generator makes the crawl repeat.
  const SEED = `(() => { let a = 20261119; Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;
  const seedOn = async () => (await send('Page.addScriptToEvaluateOnNewDocument', { source: SEED })).identifier;
  const seedOff = async (id) => { try { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: id }); } catch (e) { /* page gone */ } };

  // ---- the page: what is measured -----------------------------------------------------------------------------------------
  const MEASURE = `(() => {
    const OV = ${OVERLAY}, SAFE = ${SAFE};
    let ov = document.getElementById('__ov');
    if (!ov) { ov = document.createElement('div'); ov.id = '__ov'; ov.setAttribute('aria-hidden', 'true'); ov.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:' + OV + 'px;pointer-events:none;z-index:2147483647;background:rgba(200,0,0,.18)'; document.body.append(ov); }
    const h = innerHeight, w = innerWidth;
    const root = document.scrollingElement;
    const jump = (y) => root.scrollTo({ top: y, behavior: 'instant' });
    const scrollers = () => [...document.querySelectorAll('body *')].filter((e) => e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e !== root && e !== document.body);
    const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=menuitemradio], [role=radio], [data-letter], .key, .tile';
    const hiddenUp = (e) => { for (let n = e; n && n !== document.documentElement; n = n.parentElement) { if (n.hasAttribute('inert') || n.getAttribute('aria-hidden') === 'true' || n.hidden || n.id === '__ov') return true; const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return true; } return false; };
    const pick = () => {
      const out = [];
      for (const e0 of document.querySelectorAll(SEL)) {
        let e = e0;
        if (e.tagName === 'INPUT' && /^(radio|checkbox)$/.test(e.type)) { const l = e.closest('label') || (e.id && document.querySelector('label[for="' + e.id + '"]')); if (!l) continue; e = l; }
        if (e.closest('.sr, [data-skip-link], .skip')) continue;
        if (hiddenUp(e) || (e0 !== e && hiddenUp(e0) && getComputedStyle(e0).display === 'none')) continue;
        if (e.checkVisibility && !e.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) continue; // S3: a control inside a closed <details> is not on the page (it keeps a rect but is never drawn or hit)
        const r = e.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1 || r.bottom <= 0 || r.right <= 0) continue;
        const cs = getComputedStyle(e);
        const inline = e.tagName === 'A' && cs.display === 'inline';
        const letter = !!(e.matches('.key, .tile, [data-letter]'));
        const cls = (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
        const host = (e.closest('.sheet, .adultpanel, .gu-overlay, .stickybar, .s-sticky, .keyboard, .traycol, .tray, .foot, .topbar, .toast, .weeksheet, .thememenu__list') || {}).className || 'main';
        out.push({ e, name: e.tagName.toLowerCase() + cls + (e.dataset && Object.keys(e.dataset)[0] ? '[data-' + Object.keys(e.dataset)[0] + ']' : '') + ' "' + (e.innerText || e.getAttribute('aria-label') || e.value || '').trim().slice(0, 18).replace(/\\s+/g, ' ') + '"', host: String(host).split(' ').slice(0, 2).join('.'), letter, inline, fixed: !!e.closest('.foot') ? 'foot' : '' });
      }
      return out;
    };
    const fixedEls = () => [...document.querySelectorAll('body *')].filter((e) => { if (e.id === '__ov') return false; const p = getComputedStyle(e).position; if (p !== 'fixed' && p !== 'sticky') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !hiddenUp(e); });
    const rects = (list) => list.map((c) => { const r = c.e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right }; });
    // scroll 0 (the window and every inner scroller)
    jump(0); scrollers().forEach((s) => { s.scrollTop = 0; });
    const ctl = pick();
    const r0 = rects(ctl);
    const fixedOf = (t) => { for (let n = t; n && n !== document.documentElement; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return n; } return null; };
    // how much of a control a fixed or sticky element (that is not its ancestor) sits over, by hit test (z-order counts) plus the toast by geometry
    const covered = () => ctl.map((c) => {
      const r = c.e.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) return null;
      const x = r.left + r.width / 2; let hits = 0, by = '', tot = 0;
      for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const y = r.top + r.height * f; if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue; tot += 1;
        const t = document.elementFromPoint(x, y); if (!t || t.id === '__ov' || c.e.contains(t) || t.contains(c.e)) continue;
        const fx = fixedOf(t); if (fx && !fx.contains(c.e)) { hits += 1; by = fx.tagName.toLowerCase() + (typeof fx.className === 'string' && fx.className.trim() ? '.' + fx.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''); }
      }
      const tt = document.querySelector('.toast.show');
      if (tt && !tt.contains(c.e)) { const q = tt.getBoundingClientRect(); const ix = Math.min(r.right, q.right) - Math.max(r.left, q.left), iy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top); if (ix > 0 && iy > 0 && ix * iy > 0.25 * r.width * r.height) { hits = Math.max(hits, 3); by = 'div.toast'; tot = Math.max(tot, 5); } }
      return tot && hits / tot >= 0.4 ? { by, px: Math.round(r.height * hits / tot) } : null;
    });
    const cv0 = covered();
    const fx0 = [];
    const doc = root.scrollHeight;
    // the very end
    jump(doc); scrollers().forEach((s) => { s.scrollTop = s.scrollHeight; });
    const r1 = rects(ctl);
    const cv1 = covered();
    const fx1 = fixedEls().map((e) => ({ e, r: e.getBoundingClientRect() }));
    const sy = root.scrollTop;
    const res = { h, w, doc, sy, sw: root.scrollWidth, cw: root.clientWidth, n: ctl.length, hash: location.hash, a: [], c: [], d: [], b: Math.max(0, root.scrollWidth - root.clientWidth) };
    const cover0 = (a, b) => { const x = Math.min(a.r, b.right) - Math.max(a.l, b.left), y = Math.min(a.b, b.bottom) - Math.max(a.t, b.top); return x > 0 && y > 0 ? { area: x * y, y } : null; };
    const dname = (e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
    // REACHABILITY (S3): can the control be brought fully clear of the bottom OV px band AND of any fixed or sticky element? Sweep the window (0, the end, and steps between) with the
    // inner scrollers both at the top and at the end; the control passes if at one stop it is wholly inside [0, h - OV] and a hit test finds no fixed or sticky element over it.
    // A control taller than the free area passes when its top edge is in view above the band and clear (its whole face cannot fit).
    const maxY = Math.max(0, root.scrollHeight - h);
    const stops = [0]; for (let y = Math.round(h / 3); y < maxY; y += Math.round(h / 3)) stops.push(y); if (maxY > 0) stops.push(maxY);
    const reach = ctl.map(() => false);
    for (const inner of [0, 1]) {
      scrollers().forEach((s) => { s.scrollTop = inner ? s.scrollHeight : 0; });
      for (const y of stops) {
        jump(y);
        ctl.forEach((c, i) => {
          if (reach[i]) return;
          const r = c.e.getBoundingClientRect();
          if (r.width <= 1 || r.height <= 1) return;
          const free = h - OV;
          const fits = r.height <= free ? (r.top >= 0 && r.bottom <= free) : (r.top >= 0 && r.top <= free - 44);
          if (!fits) return;
          const x = r.left + r.width / 2; let hits = 0, tot = 0;
          for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
            const yy = r.top + Math.min(r.height, free - r.top) * f; if (x < 0 || yy < 0 || x > innerWidth || yy > innerHeight) continue; tot += 1;
            const t = document.elementFromPoint(x, yy); if (!t || t.id === '__ov' || c.e.contains(t) || t.contains(c.e)) continue;
            const fx = fixedOf(t); if (fx && !fx.contains(c.e)) hits += 1;
          }
          if (!tot || hits / tot < 0.4) reach[i] = true;
        });
      }
    }
    jump(maxY); scrollers().forEach((s) => { s.scrollTop = s.scrollHeight; });
    ctl.forEach((c, i) => {
      const a = r0[i], z = r1[i];
      // a: bottom zone
      const inFirst = a.b <= h - OV;
      if (z.b > h - SAFE && !inFirst && !reach[i]) res.a.push({ n: c.name, host: c.host, px: Math.round(z.b - (h - SAFE)), at: Math.round(z.b), first: Math.round(a.b) });
      // c: tap size
      const rr = c.e.getBoundingClientRect();
      const wd = Math.max(a.r - a.l, 0), ht = Math.max(a.b - a.t, 0);
      if (!c.inline) {
        const mw = c.letter ? 32 : 44, mh = c.letter ? 48 : 44;
        if (wd < mw - 0.5 || ht < mh - 0.5) res.c.push({ n: c.name, host: c.host, px: Math.round((Math.max(mw - wd, 0) + Math.max(mh - ht, 0)) * 10) / 10, size: Math.round(wd) + 'x' + Math.round(ht) });
      }
      // d: covered at the top AND at the very end (a control that scrolls clear of a sticky bar somewhere is fine)
      if (cv0[i] && cv1[i] && !reach[i]) res.d.push({ n: c.name, by: cv1[i].by, px: Math.max(cv0[i].px, cv1[i].px) });
    });
    // the last control (scrolled clear?)
    if (ctl.length) { let k = 0; r1.forEach((x, i) => { if (x.b > r1[k].b) k = i; }); res.last = { n: ctl[k].name, host: ctl[k].host, at: Math.round(r1[k].b), clear: Math.round(h - SAFE - r1[k].b) }; }
    const fixedNames = fx1.map((f) => dname(f.e) + '@' + Math.round(f.r.top) + '-' + Math.round(f.r.bottom));
    res.fixed = fixedNames.slice(0, 6);
    // paddings that matter for the fix list
    const cssn = (sel, p) => { const e = document.querySelector(sel); return e ? Math.round(parseFloat(getComputedStyle(e)[p])) : null; };
    res.pad = { main: cssn('main', 'paddingBottom'), page: cssn('main > section, main > .page', 'paddingBottom'), foot: cssn('.foot', 'paddingBottom'), body: cssn('body', 'paddingBottom') };
    jump(0); scrollers().forEach((s) => { s.scrollTop = 0; });
    return res;
  })()`;

  async function viewport(sz, z) {
    await send('Emulation.setDeviceMetricsOverride', { width: sz.w, height: sz.h, deviceScaleFactor: 2, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await ev(`document.documentElement.style.fontSize = ${z ? "'130%'" : "''"}`);
    await sleep(90);
  }

  /** Measure the page as it stands, in every look and at every size. */
  async function crawl(role, pid, route, results, only) {
    const sizes = process.env.SITE_SIZES ? SITE_SIZES.filter((s) => process.env.SITE_SIZES.split(',').includes(s.id)) : SITE_SIZES;
    const styles = process.env.SITE_STYLES ? process.env.SITE_STYLES.split(',') : FOLD_STYLES;
    await ev('document.fonts.ready.then(() => true)');
    for (const s of styles) {
      await style(s);
      for (const sz of sizes) {
        for (const z of (s === 'garden' && Z_SIZES.includes(sz.id)) ? [false, true] : [false]) {
          await viewport(sz, z);
          const m = await ev(MEASURE);
          const id = [role, pid, s, sz.id + '(' + sz.w + 'x' + sz.h + ')' + (z ? '+Z' : '')].join(' ');
          const fails = {};
          if (m.a.length) fails.a = Math.max(...m.a.map((x) => x.px));
          if (m.b > 0) fails.b = m.b;
          if (m.c.length) fails.c = Math.max(...m.c.map((x) => x.px));
          if (m.d.length) fails.d = Math.max(...m.d.map((x) => x.px));
          results.push({ id, role, page: pid, route, style: s, size: sz.id, device: sz.device, w: sz.w, h: sz.h, z, doc: m.doc, n: m.n, hash: m.hash, last: m.last || null, pad: m.pad, fixed: m.fixed, fails, a: m.a.slice(0, 6), na: m.a.length, c: m.c.slice(0, 6), nc: m.c.length, d: m.d.slice(0, 4) });
        }
      }
    }
  }

  async function settle() { await sleep(320); }
  /** Close whatever a panel scene opened: sheets, the grown-up panels, dialogs, the look menu, the toast. */
  const closeAll = async () => {
    await ev(`(() => { const esc = () => new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      document.querySelectorAll('.sheetlayer, .gu-overlay, #adult-layer').forEach((e) => e.dispatchEvent(esc())); document.dispatchEvent(esc());
      document.querySelectorAll('.gu-overlay').forEach((e) => e.remove());
      const m = document.getElementById('theme-menu'); if (m && !m.hidden) document.getElementById('theme').click();
      const t = document.getElementById('toast'); if (t) t.classList.remove('show'); return true; })()`);
    await sleep(200);
  };
  /** Go to a route and crawl it. A route that sends the visitor elsewhere is recorded as the page it lands on (route says where it was meant to go). */
  async function page(role, pid, hash, results, unreachable, prep = null) {
    const only = process.env.SITE_ONLY ? new RegExp(process.env.SITE_ONLY) : null;
    if (only && !only.test(role + ' ' + pid)) return;
    try {
      await closeAll();
      await ev('document.getElementById("__ov") && document.getElementById("__ov").remove()');
      await viewport({ w: 390, h: 844 }, false);
      await go(hash);
      await settle();
      if (prep) { const why = await prep(); if (why) { unreachable.push(role + ' ' + pid + ' ' + why); return; } }
      await crawl(role, pid, hash, results);
    } catch (e) { unreachable.push(role + ' ' + pid + ' could not load: ' + String(e.message).slice(0, 110)); }
  }
  /** Panels: a dialog, menu or sheet opened on a host page, crawled while open, then closed. */
  async function panel(role, pid, host, opener, results, unreachable, closer = 'Escape') {
    await page(role, pid, host, results, unreachable, async () => {
      const got = await opener();
      if (got) return got;
      return null;
    });
    await closeAll();
    void closer;
  }
  const clickIf = async (sel, wait) => {
    if (!await ev('!!document.querySelector(' + q(sel) + ')')) return 'no ' + sel + ' on the page';
    await ev('document.querySelector(' + q(sel) + ').click()');
    await sleep(260);
    if (wait && !await ev('!!document.querySelector(' + q(wait) + ')')) return 'clicked ' + sel + ' but ' + wait + ' did not appear';
    return null;
  };

  // ---- the states ------------------------------------------------------------------------------------------------------------
  const ownBits = () => {
    const own = Ow.set({}, OID, { name: 'Spring spellings', words: WORDS6, src: 'typed', to: [CHILD, CHILD2] }, NOW).own;
    const setup = Su.setOwnCopy({}, OID, { name: 'Spring spellings', words: WORDS6, src: 'typed' }, own[OID].at).setup;
    return { own, setup };
  };
  async function asOut() { await signedOutBlank(MON); await open(MON, '#/'); }
  /** A week with the first jobs done, so Fix it in, Games and the story are open (n = how many of hello, fix, games are done; the day moves on with them). */
  const stepsDoc = (n) => { let d = weekDoc(); const g = W.groupById(d, 'g1'); ['hello', 'fix', 'games'].slice(0, n).forEach((st, i) => { d = W.markStep(d, g, st, plus(i), Date.parse(plus(i) + 'T09:00:00')); }); return d; };
  /** Two live weeks, so the child's home has the Change button and the Which week? sheet. */
  const twoWeeks = () => W.createGroup(weekDoc(), { id: 'g2', name: 'Week two', test: plus(12), words: ['island', 'because', 'guard', 'group'], today: MON, now: Date.parse(MON + 'T09:30:00') }).doc;
  async function asChild(kind) {
    const { setup } = ownBits();
    if (/^steps[123]$/.test(kind)) { const n = Number(kind.slice(5)); await seedChild(stepsDoc(n), plus(n)); await open(plus(n), '#/'); }
    else if (kind === 'two') { await seedChild(twoWeeks(), MON); await open(MON, '#/'); }
    else if (kind === 'week') { await seedChild(W.withSetup(weekDoc(), setup), MON); await open(MON, '#/'); }
    else if (kind === 'test') { await seedChild(studied(weekDoc()), plus(5)); await open(plus(5), '#/'); }
    else { await seedChild(W.emptyDoc(), MON); await open(MON, '#/'); }
    await ev('sessionStorage.setItem("sb.selection",' + q(JSON.stringify(['build', 'earth', 'fruit', 'heart', 'island', 'because', 'guard', 'group'])) + ')');
  }
  async function asAdult() {
    const { own, setup } = ownBits();
    await signedOutBlank(plus(2));
    acct.who = adultMe;
    await ev('localStorage.setItem("sb.words:' + ADULT + '",' + q(JSON.stringify(W.withOwn(weekDoc(), own))) + ')');
    acct.put(ADULT, 'spellbright', 'words', W.withOwn(weekDoc(), own));
    acct.put(CHILD, 'spellbright', 'words', W.withSetup(weekDoc(), setup));
    acct.put(CHILD2, 'spellbright', 'words', W.withSetup(W.emptyDoc(), setup));
    await open(plus(2), '#/');
  }
  /** The first chapter link More practice offers (a year and a slug). */
  async function chapterHash() {
    await go('#/chapters');
    await sleep(300);
    return (await ev('(document.querySelector("a[href^=\\"#/y\\"][href*=\\"/\\"]") || {}).getAttribute ? document.querySelector("a[href^=\\"#/y\\"][href*=\\"/\\"]").getAttribute("href") : ""')) || '#/y4/first-steps';
  }

  const SPELL = (g) => [['words', ''], ['words/new', ''], ['words/progress', ''], [g, ''], [g + '/edit', ''], [g + '/spell/0', ''], [g + '/study/hello', ''], [g + '/study/fix', ''], [g + '/study/games', ''], [g + '/study/story', ''],
    [g + '/games', ''], [g + '/game/missing', ''], [g + '/game/unjumble', ''], [g + '/game/match', ''], [g + '/game/quick', ''], [g + '/path', ''], [g + '/quiz', '']];
  const CHAPTER = (c) => [[c, ''], [c + '/study', ''], [c + '/study/build', ''], [c + '/quick', ''], [c + '/quick/build', ''], [c + '/practice', ''], [c + '/test', ''], [c + '/quiz', '']];
  const OWNW = [['words/own/' + OID, ''], ['words/own/' + OID + '/study', ''], ['words/own/' + OID + '/study/build', ''], ['words/own/' + OID + '/quick', ''], ['words/own/' + OID + '/practice', ''], ['words/own/' + OID + '/test', ''], ['words/own/' + OID + '/quiz', '']];
  const ID = (s) => s.replace(/^#\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';

  async function runList(role, list, results, unreachable) {
    for (const [r] of list) await page(role, ID(r), '#/' + r, results, unreachable);
  }

  // ---- the scenes -----------------------------------------------------------------------------------------------------------
  const judge = (label, results, unreachable) => {
    const known = existsSync(KNOWN_FILE) ? JSON.parse(readFileSync(KNOWN_FILE, 'utf8')) : {};
    const record = process.env.SITE_RECORD;
    const only = process.env.SITE_ONLY ? new RegExp(process.env.SITE_ONLY) : null;
    const msgs = []; let knownHit = 0; let fresh = 0; let fixed = 0; const cur = {};
    for (const r of results) for (const [k, px] of Object.entries(r.fails)) {
      const key = r.id + ' | ' + k; cur[key] = px;
      if (key in known) { knownHit += 1; if (px > known[key] + 0.5) { fresh += 1; msgs.push(key + ': worse than known (' + px + ', known ' + known[key] + ')'); } } else { fresh += 1; msgs.push(key + ': ' + px); }
    }
    const roles = new Set(results.map((r) => r.role));
    for (const k of Object.keys(known)) if (!(k in cur) && roles.has(k.split(' ')[0]) && (!only || only.test(k))) { fixed += 1; console.log('  · FIXED (remove from sitecrawl-known.json): ' + k); }
    console.log('  · ' + label + ': ' + results.length + ' measurements over ' + new Set(results.map((r) => r.role + ' ' + r.page)).size + ' pages, ' + Object.keys(cur).length + ' failing checks (' + knownHit + ' known, ' + fresh + ' new), ' + fixed + ' fixed');
    msgs.slice(0, 30).forEach((m) => console.log('  · NEW: ' + m));
    unreachable.forEach((u) => console.log('  · not reachable: ' + u));
    if (record) {
      const f = join(record, 'sitecrawl-results.ndjson');
      appendFileSync(f, results.map((r) => JSON.stringify(r)).join('\n') + '\n');
      appendFileSync(join(record, 'sitecrawl-unreachable.txt'), unreachable.join('\n') + (unreachable.length ? '\n' : ''));
      appendFileSync(join(record, 'sitecrawl-known.ndjson'), Object.entries(cur).map(([k, v]) => JSON.stringify([k, v])).join('\n') + '\n');
      return;
    }
    ok(!msgs.length, msgs.length + ' site-crawl failures not in sitecrawl-known.json (first: ' + msgs[0] + ')');
  };
  const done = async () => { try { await send('Emulation.setTouchEmulationEnabled', { enabled: false }); await ev("document.documentElement.style.fontSize='';document.getElementById('__ov')&&document.getElementById('__ov').remove()"); } catch (e) { /* ignore */ } await H.width(390, 900); };
  const toastUp = () => ev('(() => { const t = document.getElementById("toast"); t.textContent = "Type the word first"; t.classList.add("show"); return true; })()').then(() => null);

  scene('SB5 site: signed out', async () => {
    const results = []; const unreachable = [];
    await asOut();
    const ch = await chapterHash();
    await runList('out', [[''], ['about'], ['chapters'], ['custom'], ['tricky'], ['progress'], ['words'], ['words/new'], ['settings'], ['grownups'], ['y4'], ['nonsense/page/here'], [ch.replace(/^#\//, '')]], results, unreachable);
    await panel('out', 'toast', '#/about', toastUp, results, unreachable);
    await done();
    judge('signed out', results, unreachable);
  });

  scene('SB5 site: child', async () => {
    const results = []; const unreachable = [];
    const sid = await seedOn();
    await asChild('week');
    const ch = await chapterHash();
    const c = ch.replace(/^#\//, '');
    await runList('child', [[''], ['chapters'], ['about'], ['custom'], ['custom/play'], ['tricky'], ['progress'], ['settings'], ['look'], ...SPELL('words/g/g1'), ...CHAPTER(c), ...OWNW, ['y4'], ['nonsense/page/here']], results, unreachable);
    await asChild('test'); // the test is due: the room's Test card, the test page, and the pages the guard sends back
    await runList('childdue', [[''], ['words/g/g1/test'], ['words/g/g1'], ['words/g/g1/spell/0'], ['chapters']], results, unreachable);
    for (const [n, st] of [[1, 'fix'], [2, 'games'], [3, 'story']]) { await asChild('steps' + n); await runList('childstep', [['words/g/g1/study/' + st], ['words/g/g1/study/' + st + '/0']], results, unreachable); }
    await asChild('empty'); // no word group yet
    await runList('childnew', [[''], ['words'], ['words/new'], ['words/progress'], ['words/g/nogroup'], ['progress']], results, unreachable);
    await asChild('two');
    await panel('child', 'menu-sheet', '#/', () => clickIf('#child-menu', '.sheetlayer .sheet'), results, unreachable);
    await panel('child', 'weeks-sheet', '#/', () => clickIf('[data-week-change]', '.sheetlayer .sheet'), results, unreachable);
    await panel('child', 'toast', '#/words/new', toastUp, results, unreachable);
    await done();
    await seedOff(sid);
    judge('child', results, unreachable);
  });

  scene('SB5 site: adult', async () => {
    const results = []; const unreachable = [];
    await asAdult();
    const ch = await chapterHash();
    const c = ch.replace(/^#\//, '');
    const K = 'grownups/child/' + CHILD;
    for (const [n, st] of [[1, 'fix'], [2, 'games'], [3, 'story']]) { // the adult's own words, with the first jobs done
      const g = W.groupById(weekDoc(), 'g1'); let d = weekDoc(); ['hello', 'fix', 'games'].slice(0, n).forEach((x, i) => { d = W.markStep(d, g, x, plus(i), Date.parse(plus(i) + 'T09:00:00')); });
      acct.put(ADULT, 'spellbright', 'words', d); await ev('localStorage.setItem("sb.words:' + ADULT + '",' + q(JSON.stringify(d)) + ')'); await open(plus(n), '#/');
      await runList('adultstep', [['words/g/g1/study/' + st]], results, unreachable);
    }
    await asAdult();
    await runList('adult', [[''], ['grownups'], ['grownups/overview'], ['grownups/stories'], ['grownups/plan'], [K], [K + '/week/g1'], [K + '/plan'], [K + '/plan/g1'], [K + '/spelling'], [K + '/exam'], [K + '/exam/nope'], ['grownups/child/nobody'],
      ['grownups/own'], ['grownups/own/new'], ['grownups/own/' + OID], ['grownups/own/' + OID + '/edit'], ['grownups/own/' + OID + '/give'], ['grownups/own/' + OID + '/results'], ['grownups/own/ready'], ['grownups/own/ready/y4'], ['grownups/own/ready/y34-ch03'], ['grownups/own/ready/y34-ch03/copy'], ['grownups/own/' + OID + '/copy'], ['grownups/own/' + OID + '/sentences'],
      ['grownups/set'], ['grownups/set/list/' + OID], ['grownups/set/child/' + CHILD], ['grownups/role'], ['grownups/help'], ['grownups/yourself'], ['grownups/more'], [K + '/rename/g1'], [K + '/weeks'], [K + '/print/g1'], ['grownups/scan'], ['grownups/teach'], ['grownups/teach/' + OID],
      ['chapters'], ['about'], ['custom'], ['tricky'], ['progress'], ['settings'], ...SPELL('words/g/g1'), ...CHAPTER(c), ...OWNW, ['words/exam/nope']], results, unreachable);
    await panel('adult', 'menu-panel', '#/grownups', () => clickIf('#adult-menu-btn', '.adultpanel--menu:not([hidden])'), results, unreachable);
    await panel('adult', 'account-panel', '#/grownups', () => clickIf('#adult-chip', '.adultpanel--account:not([hidden])'), results, unreachable);
    await panel('adult', 'confirm-delete-week', '#/' + K + '/week/g1', () => clickIf('[data-delete]', '.gu-overlay'), results, unreachable);
    await panel('adult', 'confirm-delete-chapter', '#/grownups/own/' + OID, () => clickIf('[data-delete-list]', '.gu-overlay'), results, unreachable);
    await panel('adult', 'toast', '#/grownups', toastUp, results, unreachable);
    await done();
    judge('adult', results, unreachable);
  });
}
