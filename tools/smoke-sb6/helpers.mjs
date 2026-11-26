// SB6 (WP-10): shared helpers for the SB6 smoke scenes. `makeHelpers(H)` answers S; every scene file is `export default (H, S) => { H.scene('SB6 <name>: ...', async () => {...}) }`.
// Reuses tools/smoke-sb5/devices.mjs (PROFILES, the device emulation) and the fold harness's measuring ideas (controls, keys, scroll).
//
// S.TR70            the profile ids a Step by step child scene must pass (TR-70), in order
// S.STYLES          ['garden', 'night']
// S.profile(id)     the device profile object ({ id, w, h, sh, ua, sat, sab, bar, reserve, os, browser, cls })
// S.forProfiles(fn, { ids, styles })   runs fn(profile, style) for every profile and style (env SB6_ONLY='iphone-se1|ipad' limits the profiles, SB6_STYLES='garden')
// S.openAs(p, { day, hash, seed, night, wait })  emulates the device, seeds (seed is async), opens the page at the profile's size, draws the Safari bar overlay
// S.seedSbsChild({ year, words, way, extra })   Step by step child with a week (setup.way = sbs, profile 'sen' as the first switch-on sets it); extra(doc) may change the doc
// S.seedNormalChild({ year, words })            today's child (Usual way)
// S.measure(sel)    one object of numbers: controls, boxes, tiles, hear buttons, scroll, column width; sel overrides S.SEL
// S.checks.*        the design's measure checks (see NOTES.md "measure checks"), each (m, p) => string[] of defects (empty = pass)
// S.report(defects) prints DEFECT lines and asserts none
// S.numbers(row)    appends a row to <SB6_SHOTS>/numbers.ndjson
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILES } from '../smoke-sb5/devices.mjs';
import * as Su from '../../site/js/setup-doc.js';

/** TR-70 profile ids: the ones in the TRS list. */
export const TR70 = ['iphone-se1', 'iphone-se', 'iphone-16', 'iphone-air-bar', 'iphone-air-pill', 'android-360x800', 'ipad-portrait', 'ipad-landscape'];
/** D17 tablets: 820x1180, 1180x820 and 1180x640 (the two-column rule). */
export const TABLETS = ['ipad-portrait', 'ipad-landscape', 'ipad-landscape-bars'];
export const STYLES = ['garden', 'night'];

/** Default selectors; the sbs and builder DOM is not built yet, so every entry lists today's and the design's classes. A scene passes its own to override. */
export const SEL = {
  boxes: '.spellbox, .blanks .box, .blanks > *, [data-box], .s6-box',
  tiles: '.tray .key, .tiles .tile, .ltile, .s6-tile, [data-tile]',
  check: '[data-check], [data-next], [data-fold="check"], [data-fold="next"]',
  hear: '[data-hear], [data-hearmain], [data-fold="hear"]',
  peek: '[data-peekbtn], [data-fold="peek"], [data-peek]',
  stop: '[data-stop], [data-fold="stop"], [data-job-stop]',
  back: '[data-back], [data-fold="back"]',
  options: '[data-option], .s6-option, .meaning-option, [data-meaning]',
  steps: '[data-step-dot], .s6-step, .s6-steps > *, .stones > *',
  sizes: '[data-rowsize], .s6-size, .s6-sizes > *',
  testWord: '[data-test-word], .s6-test, [data-fold="test"]',
  column: 'main .s6-play, main .s6-upper, main .play, main > section',
};

export function makeHelpers(H) {
  const { ev, click, until, sleep, send, open, seedChild, signedOutBlank, acct, weekDoc, W, MON, plus, CHILD, ROOT, ok } = H;
  const SHOTS = process.env.SB6_SHOTS || '/tmp/claude-0/sb6/shots';
  const only = process.env.SB6_ONLY ? new RegExp(process.env.SB6_ONLY) : null;
  const onlyStyles = process.env.SB6_STYLES ? process.env.SB6_STYLES.split(',') : null;
  const q = (s) => JSON.stringify(s);
  const profile = (id) => PROFILES.find((p) => p.id === id);

  async function apply(p) {
    const mobile = p.os === 'ios' || p.os === 'android';
    await send('Emulation.setDeviceMetricsOverride', { width: p.w, height: p.h, deviceScaleFactor: 2, mobile, ...(p.sh ? { screenWidth: p.w, screenHeight: p.sh } : {}) });
    await send('Emulation.setUserAgentOverride', { userAgent: p.ua, platform: p.os === 'desktop' ? 'Linux x86_64' : p.os === 'android' ? 'Linux armv81' : p.os === 'ipados' ? 'MacIntel' : 'iPhone' });
    await send('Emulation.setTouchEmulationEnabled', { enabled: p.touch > 0, maxTouchPoints: p.touch || 1 });
    await send('Emulation.setEmitTouchEventsForMouse', { enabled: false }).catch(() => {});
  }
  async function reset() {
    await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: false });
  }
  const drawOverlay = (p) => ev(`(() => {
    let o = document.getElementById('__ov'); if (o) o.remove();
    if (!${p.bar}) return;
    o = document.createElement('div'); o.id = '__ov'; o.setAttribute('aria-hidden', 'true');
    o.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:${p.bar}px;pointer-events:none;z-index:2147483647;background:rgba(200,0,0,.22)';
    document.body.append(o);
  })()`);

  /** Seed (the seeding clears page storage, so the device key goes in last), then open at the profile's own size. */
  async function openAs(p, { day = MON, hash = '#/', seed, night = false, wait } = {}) {
    await reset();
    if (seed) await seed();
    await ev('localStorage.setItem("sb.devTest",' + q(JSON.stringify({ sat: p.sat, sab: p.sab })) + ')');
    await ev('localStorage.setItem("sb.tilesTest","0")');
    if (night) await ev('localStorage.setItem("sb.theme","dark")');
    await apply(p);
    await open(day, hash);
    if (wait) await until(wait, 'the page', 9000);
    await ev('document.fonts.ready.then(() => true)');
    await sleep(200);
    await drawOverlay(p);
  }

  async function forProfiles(fn, { ids = TR70, styles = STYLES } = {}) {
    try {
      for (const id of ids) {
        const p = profile(id);
        if (!p) throw new Error('no profile ' + id);
        if (only && !only.test(p.id)) continue;
        for (const s of styles) {
          if (onlyStyles && !onlyStyles.includes(s)) continue;
          await fn(p, s);
        }
      }
    } finally { await reset(); }
  }

  // ---- seeding ----
  /** A Step by step child: setup.way = sbs (TR-10) and profile 'sen' (the first switch-on sets it), one week with `words`. Uses Su.setWay when WP-2 has landed, else writes the same shape. */
  async function seedSbsChild({ year = 4, words, day = MON, way = 'sbs', extra, name = 'Robin' } = {}) {
    const now = Date.parse(day + 'T08:00:00');
    let d = weekDoc(words);
    let setup = {};
    if (typeof Su.setWay === 'function') {
      const r = Su.setWay(setup, way, now, 'Sam');
      setup = r && r.setup ? r.setup : r;
    } else setup = { way: { m: way, at: now, by: 'Sam' }, ...(way === 'sbs' ? { profile: { p: 'sen', at: now } } : {}) };
    d = W.withSetup(d, setup);
    if (extra) d = extra(d) || d;
    await seedChild(d, day);
    await setYear(year, name);
    return d;
  }
  async function seedNormalChild({ year = 4, words, day = MON, extra } = {}) {
    let d = weekDoc(words);
    if (extra) d = extra(d) || d;
    await seedChild(d, day);
    await setYear(year);
    return d;
  }
  async function setYear(year, name = 'Robin') {
    acct.who = { ...acct.who, year, nickname: name };
    await ev('localStorage.setItem("sb.year:' + CHILD + '",' + q(String(year)) + ')');
  }

  // ---- measuring ----
  /** Everything the design's checks read, in px, in one call. sel overrides SEL (any key). */
  const measure = (sel = {}) => ev(`(() => {
    const SEL = ${JSON.stringify({ ...SEL, ...sel })};
    const ih = innerHeight, iw = innerWidth, root = document.scrollingElement;
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') return false; for (let n = e; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).display === 'none' || getComputedStyle(n).visibility === 'hidden') return false; return true; };
    const all = (s) => [...document.querySelectorAll(s)].filter(vis).filter((e) => e.id !== '__ov');
    const box = (e) => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; };
    const hit = (e) => { const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; if (y < 0 || y > ih || x < 0 || x > iw) return 'off-screen'; const t = document.elementFromPoint(x, y); return t && (e === t || e.contains(t) || t.contains(e)) ? '' : 'covered'; };
    const take = (s) => all(s).map((e) => ({ ...box(e), hit: hit(e), text: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24), done: /\\b(done|filled|is-done|is-filled)\\b/.test(e.className + ' ' + (e.getAttribute('aria-label') || '')) || e.getAttribute('data-done') === '1' || e.getAttribute('aria-current') === null && /\\bis-(done|on)\\b/.test(e.className) }));
    const boxes = take(SEL.boxes), tiles = take(SEL.tiles);
    const col = (document.querySelector(SEL.column) || null);
    const m = {
      ih, iw, sh: root.scrollHeight, scrollPx: Math.max(0, root.scrollHeight - ih), sideways: Math.max(0, root.scrollWidth - root.clientWidth),
      h1: (document.querySelector('main h1') || {}).textContent || '', body: (document.body.innerText || '').slice(0, 2000),
      check: take(SEL.check), hear: take(SEL.hear), peek: take(SEL.peek), stop: take(SEL.stop), back: take(SEL.back),
      options: take(SEL.options), steps: take(SEL.steps), sizes: take(SEL.sizes), testWord: take(SEL.testWord),
      boxes, tiles, column: col ? box(col) : null,
      playWidth: Math.max(0, ...[...document.querySelectorAll('main .s6-upper, main .s6-block, main .play, main .blanks')].filter(vis).map((e) => e.getBoundingClientRect().width)),
      overlay: (() => { const o = document.getElementById('__ov'); return o ? o.getBoundingClientRect().top : null; })(),
    };
    return m;
  })()`);

  /** The design's measure checks (NOTES.md). Each answers a list of defects. p = the profile (its reserve line). */
  const line = (p) => p.h - p.reserve;
  const checks = {
    /** Boxes, Peek, tiles, Check inside the first screen and above the reserve line; none covered. */
    firstScreen(m, p, { need = ['check'] } = {}) {
      const d = [];
      for (const k of need) if (!m[k].length) d.push('no ' + k + ' on screen');
      for (const k of ['check', 'peek', 'hear', 'boxes', 'tiles', 'stop']) for (const c of m[k]) {
        if (c.b > line(p) + 0.5) d.push(k + ' "' + c.text + '" ends at ' + c.b + ', below the line ' + line(p));
        if (c.t < 0) d.push(k + ' "' + c.text + '" is above the screen');
        if (c.hit) d.push(k + ' "' + c.text + '" is ' + c.hit);
      }
      if (m.sideways > 0) d.push('sideways scroll ' + m.sideways + ' px');
      return d;
    },
    /** Gap between the boxes' foot and the tiles' top is at most one tile (the block stays together). */
    gapBoxesTiles(m) {
      if (!m.boxes.length || !m.tiles.length) return [];
      const boxB = Math.max(...m.boxes.map((b) => b.b)); const tileT = Math.min(...m.tiles.map((t) => t.t)); const tileH = Math.max(...m.tiles.map((t) => t.h));
      return tileT - boxB > tileH + 0.5 ? ['boxes end at ' + boxB + ', tiles start at ' + tileT + ': a gap of ' + (tileT - boxB) + ' px, more than one tile (' + tileH + ')'] : [];
    },
    /** Box width at least 28 px (the design's floor). */
    boxWidth(m, p, min = 28) {
      const w = m.boxes.filter((b) => b.w > 8); // thin separators are not boxes
      return w.length && Math.min(...w.map((b) => b.w)) < min - 0.01 ? ['a box is ' + Math.min(...w.map((b) => b.w)) + ' px wide, under ' + min] : [];
    },
    /** Tiles 56 px (Years 1-2) or 48 px (Years 3-6) with at least 8 px between them; Peek and Hear at least 48 x 48 (TR-70). */
    targets(m, p, { year = 4 } = {}) {
      const d = []; const tile = year <= 2 ? 56 : 48;
      if (m.tiles.length && Math.min(...m.tiles.map((t) => Math.min(t.w, t.h))) < tile - 0.5) d.push('tiles under ' + tile + ' px');
      for (const k of ['peek', 'hear']) for (const c of m[k]) if (c.w < 47.5 || c.h < 47.5) d.push(k + ' is ' + c.w + ' x ' + c.h + ', under 48 x 48');
      const ts = [...m.tiles].sort((a, b) => a.t - b.t || a.l - b.l);
      for (let i = 1; i < ts.length; i += 1) { const a = ts[i - 1]; const b = ts[i]; if (Math.abs(a.t - b.t) < 4 && b.l - a.r < 7.5 && b.l - a.r > -1) { d.push('tiles are ' + (b.l - a.r) + ' px apart, under 8'); break; } }
      return d;
    },
    /** Stop and Back at least 48 px from Check (no slip onto the main button). */
    stopAwayFromCheck(m) {
      const d = [];
      for (const s of [...m.stop, ...m.back]) for (const c of m.check) {
        const dx = Math.max(0, Math.max(s.l - c.r, c.l - s.r)); const dy = Math.max(0, Math.max(s.t - c.b, c.t - s.b));
        if (Math.hypot(dx, dy) < 48) d.push('"' + s.text + '" is ' + Math.round(Math.hypot(dx, dy)) + ' px from Check, under 48');
      }
      return d;
    },
    /** Filled steps never go down: pass the counts in order seen (tracker). */
    stepsNeverDown(counts) {
      const d = [];
      for (let i = 1; i < counts.length; i += 1) if (counts[i] < counts[i - 1]) d.push('filled steps went from ' + counts[i - 1] + ' to ' + counts[i] + ' (step ' + i + ')');
      return d;
    },
    /** Every row size 2 ... N is on the page (the row-size path). */
    rowSizesPresent(m, n) {
      const have = new Set(m.sizes.map((s) => (s.text.match(/\d+/) || [])[0]).filter(Boolean).map(Number));
      const miss = []; for (let i = 2; i <= n; i += 1) if (!have.has(i)) miss.push(i);
      return miss.length ? ['row sizes missing: ' + miss.join(', ')] : [];
    },
    /** The word "Test" is visible (T1..T4, T6). */
    testVisible(m) { return /\bTest\b/.test(m.body) || m.testWord.length ? [] : ['the word Test is not visible']; },
    /** One Hear per meaning option. */
    hearPerOption(m) { return m.options.length && m.hear.length < m.options.length ? [m.options.length + ' options but ' + m.hear.length + ' Hear buttons'] : []; },
    /** The word's Hear sits beside the boxes (within one box height, and left or right of them, not far above). */
    hearBesideBoxes(m) {
      if (!m.boxes.length) return [];
      if (!m.hear.length) return ['no Hear on a screen with boxes'];
      const top = Math.min(...m.boxes.map((b) => b.t)); const bot = Math.max(...m.boxes.map((b) => b.b));
      const near = m.hear.some((h) => h.b >= top - 56 && h.t <= bot + 56);
      return near ? [] : ['Hear is not beside the boxes (boxes ' + top + '..' + bot + ')'];
    },
    /** The play column is at most 640 px wide on a tablet. */
    playColumn(m, p, max = 640) { return m.playWidth > max + 0.5 && p.w >= 820 ? ['a play column is ' + m.playWidth + ' px, over ' + max] : []; },
    /** No timer, countdown or red (computed colour) on a Step by step screen (S-sbs-calm). */
    async calm() {
      return ev(`(() => { const d = []; if (document.querySelector('[data-timer], .timer, .countdown, progress, [role=timer]')) d.push('a timer element'); if (/\\b\\d{1,2}:\\d{2}\\b|\\bseconds? left\\b/i.test(document.querySelector('main').innerText)) d.push('a clock in the text');
        for (const e of document.querySelectorAll('main *')) { const r = e.getBoundingClientRect(); if (r.width < 2) continue; const cs = getComputedStyle(e); for (const c of [cs.color, cs.backgroundColor, cs.borderTopColor]) { const m = /rgba?\\((\\d+), (\\d+), (\\d+)/.exec(c); if (m && +m[1] > 170 && +m[2] < 80 && +m[3] < 80 && (cs.borderTopWidth !== '0px' || c === cs.color || c === cs.backgroundColor)) { d.push('red on ' + e.tagName + '.' + e.className); break; } } }
        return d.slice(0, 5); })()`);
    },
  };

  function numbers(row) {
    mkdirSync(SHOTS, { recursive: true });
    try { appendFileSync(join(SHOTS, 'numbers.ndjson'), JSON.stringify(row) + '\n'); } catch (e) { /* ignore */ }
  }
  async function shotAs(p, name, style = 'garden') {
    const dir = join(SHOTS, p.id + '-' + style); mkdirSync(dir, { recursive: true });
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(dir, name + '.png'), Buffer.from(r.data, 'base64'));
  }
  function report(defects, what = 'SB6 checks') {
    for (const d of defects) console.log('  DEFECT ' + d);
    console.log('  · ' + what + ': ' + defects.length + ' defects');
    ok(!defects.length, defects.length + ' defects (listed above)');
  }

  return { TR70, TABLETS, STYLES, SEL, PROFILES, profile, apply, reset, drawOverlay, openAs, forProfiles, seedSbsChild, seedNormalChild, setYear, measure, checks, line, numbers, shotAs, report, SHOTS, q, ROOT, click, plus };
}
