// SB5 WP-H: the phone-fold harness (TRS TR-60, TR-61, R-PH2/R-PH3). Loaded by tools/sb2-smoke.mjs with the harness H.
// Run one scene at a time:  node tools/sb2-smoke.mjs <fresh dir> 'SB5 fold: practice pages'   (or the prefix 'SB5 fold*')
// Each child practice page, with its keys or tiles showing, at every phone size (visible height = screen minus browser bars), in garden, paint and night,
// child and adult: every Check/Next/Hear/Peek/Skip bottom edge must be inside the visible viewport (minus 8 px) with no scroll.
// KNOWN failures (tools/smoke-sb5/fold-known.json, key -> worst px) are reported but do not fail the scene; a failure not listed, or worse than listed, fails it.
// A listed failure that now passes is reported as FIXED: remove it from the list. FOLD_RECORD=<dir> writes fold-results.json and fold-known.json there (the baseline).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// TR-60: [id, device, screen w, screen h, browser chrome px]
export const FOLD_SIZES = [
  ['F1', 'iPhone SE', 375, 667, 140], ['F2', 'iPhone 14', 390, 844, 140], ['F3', 'iPhone Pro Max', 430, 932, 140],
  ['F4', 'Android small', 360, 640, 110], ['F5', 'Android', 360, 800, 110], ['F6', 'Android large', 412, 915, 110],
  ['F7', 'iPhone SE landscape', 667, 375, 60], ['F8', 'iPhone landscape', 844, 390, 60], ['F9', 'Android landscape', 915, 412, 56],
].map(([id, device, w, sh, chrome]) => ({ id, device, w, h: sh - chrome, screen: w + 'x' + sh }));
export const FOLD_STYLES = ['garden', 'paint', 'night'];
// the controls that answer or move on (TR-61 data-fold values once WP-F adds them; today's data- attributes until then)
export const FOLD_CONTROLS = '[data-fold="check"],[data-fold="next"],[data-fold="hear"],[data-fold="peek"],[data-fold="skip"],[data-check],[data-next],[data-hear],[data-hearmain],[data-peekbtn],[data-skip],[data-go]';
const MARGIN = 8;

export default function (H) {
  const { scene, go, click, ev, ok, until, sleep, style, send, kbSeed, ROOT } = H;
  const KNOWN_FILE = join(ROOT, 'tools/smoke-sb5/fold-known.json');

  /** Phone emulation (TR-60): the visible size, mobile, deviceScaleFactor 2, touch on; z = text 130%. */
  async function phone(sz, z = false) {
    await send('Emulation.setDeviceMetricsOverride', { width: sz.w, height: sz.h, deviceScaleFactor: 2, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await ev(`document.documentElement.style.fontSize = ${z ? "'130%'" : "''"}`);
    await sleep(120);
  }
  /** Measure the page as it stands at scroll 0: every visible control's bottom, the keys, the page height, sideways scroll. */
  const measure = () => ev(`(() => {
    window.scrollTo(0, 0);
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const label = (e) => (e.dataset.fold ? 'fold:' + e.dataset.fold : (Object.keys(e.dataset).find((k) => ['check','next','hear','hearmain','peekbtn','skip','go'].includes(k)) || e.tagName.toLowerCase()));
    const seen = new Set();
    const ctl = [...document.querySelectorAll(${JSON.stringify(FOLD_CONTROLS)})].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { n: label(e), top: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) }; })
      .filter((c) => { const k = c.n + c.b; if (seen.has(k)) return false; seen.add(k); return true; });
    // D11/TR-60: letter keys (the typing keyboard) are 32 x 48; tiles and the tile tray keep 44 x 48.
    const keys = [...document.querySelectorAll('.keyboard .key, .tray .key, .tiles .tile')].filter(vis).map((e) => ({ r: e.getBoundingClientRect(), letter: !!e.closest('.keyboard') && !e.closest('.keyboard--tray, .keyboard--pad') }));
    const minOf = (a, f) => (a.length ? Math.round(Math.min(...a.map(f)) * 10) / 10 : 0);
    const letters = keys.filter((k) => k.letter); const tiles = keys.filter((k) => !k.letter);
    // Round 4: a control must not sit on top of another control or a key (>= 16 px2 of overlap), and its text must stay inside its box.
    const boxes = [...document.querySelectorAll(${JSON.stringify(FOLD_CONTROLS)})].filter(vis);
    const keyEls = [...document.querySelectorAll('.keyboard .key, .tray .key, .tiles .tile')].filter(vis);
    const overlaps = []; const clipped = [];
    const ix = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    boxes.forEach((e, i) => {
      const r = e.getBoundingClientRect();
      for (const o of [...boxes.slice(i + 1), ...keyEls]) { if (o === e || o.contains(e) || e.contains(o)) continue; if (ix(r, o.getBoundingClientRect()) >= 16) overlaps.push(label(e) + '/' + (o.className || o.tagName)); }
      if (e.scrollHeight > e.clientHeight + 3 && getComputedStyle(e).overflow !== 'visible' || e.scrollHeight > Math.ceil(r.height) + 6) clipped.push(label(e));
    });
    return { overlaps, clipped, ih: innerHeight, iw: innerWidth, ph: document.documentElement.scrollHeight, sy: scrollY, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      hash: location.hash, ctl, nkeys: keys.length, kw: minOf(keys, (k) => k.r.width), kh: minOf(keys, (k) => k.r.height),
      lw: minOf(letters, (k) => k.r.width), lh: minOf(letters, (k) => k.r.height), tw: minOf(tiles, (k) => k.r.width), th: minOf(tiles, (k) => k.r.height), nl: letters.length, nt: tiles.length };
  })()`);

  /** The pages: [id, how to reach it from the seeded child or adult]. Each ends with the keys or tiles showing. */
  const KEYS_UP = 'document.querySelector(".keyboard .key, .tray .key, .tiles .tile")';
  const PAGES = [
    ['spell-flower', 'flower', null, 'custom/play'],
    ['spell-practice', 'practice', null, 'words/g/:gid/spell/:n'],
    ['test', 'test', null, 'words/g/:gid/test'],
    ['fix-typing', 'fix', null, 'words/g/:gid/study/fix'],
    ['quick-fire', 'quick', null, 'words/g/:gid/game/quick'],
    ['hello-spell', 'flower', async () => { // Hello: the word card, then "Flower game" opens the spell-it-out page
      await go('#/words/g/g1/study/hello');
      await until('document.querySelector("[data-play]")', 'the Hello word card');
      await click('[data-play]');
      await until('document.querySelector(".blanks") && ' + KEYS_UP, 'Hello spell-it-out');
    }, 'words/g/:gid/study/hello'],
    ['quiz', 'quick', async () => { // the grown-up-set / help-level quiz; may redirect (then recorded as unreachable)
      await go('#/words/g/g1/quiz');
      await sleep(400);
      if (!await ev('/\\/quiz$/.test(location.hash)')) return 'redirected: ' + await ev('location.hash');
      await until('document.querySelector("[data-check],[data-next],.keyboard .key")', 'the quiz', 4000).catch(() => {});
      return null;
    }, 'words/g/:gid/quiz'],
  ];

  async function runCase(label, role, p, results, unreachable) {
    const [pid, seed, extra, route] = p;
    await kbSeed(role, seed);
    let why = null;
    if (extra) {
      try { why = await extra(); } catch (e) { why = 'could not load: ' + e.message.slice(0, 80); }
    }
    if (why) { unreachable.push(role + ' ' + pid + ' ' + why); return false; }
    await ev('document.fonts.ready.then(() => true)');
    await sleep(120);
    for (const s of FOLD_STYLES) {
      await style(s);
      for (const sz of FOLD_SIZES) {
        for (const z of (s === 'garden' && ['F1', 'F4', 'F7'].includes(sz.id)) ? [false, true] : [false]) {
          await phone(sz, z);
          const m = await measure();
          const id = [role, pid, s, sz.id + '(' + sz.w + 'x' + sz.h + ')' + (z ? '+Z' : '')].join(' ');
          const limit = m.ih - MARGIN;
          const row = { id, role, page: pid, route, style: s, size: sz.id, device: sz.device, w: sz.w, h: sz.h, z, ph: m.ph, nctl: m.ctl.length, fails: {} };
          if (!m.ctl.length) row.fails['no-controls'] = 1;
          for (const c of m.ctl) { const over = c.b - limit; if (over > 0) row.fails[c.n] = Math.max(row.fails[c.n] || 0, over); }
          for (const c of m.ctl) if (c.h < 44 || c.w < 44) row.fails['small:' + c.n] = Math.max(row.fails['small:' + c.n] || 0, Math.max(44 - c.h, 0) + Math.max(44 - c.w, 0)); // controls at least 44 x 48 (D11); 44 px floor here
          for (const o of new Set(m.overlaps)) row.fails['overlap:' + o] = 1;
          for (const o of new Set(m.clipped)) row.fails['clipped:' + o] = 1;
          if (m.sw > m.cw) row.fails['sideways'] = m.sw - m.cw;
          if (m.nl && (m.lw < 32 || m.lh < 48)) row.fails['keys<32x48'] = Math.round((Math.max(32 - m.lw, 0) + Math.max(48 - m.lh, 0)) * 10) / 10;
          if (m.nt && (m.tw < 44 || m.th < 48)) row.fails['tiles<44x48'] = Math.round((Math.max(44 - m.tw, 0) + Math.max(48 - m.th, 0)) * 10) / 10;
          row.keys = m.nkeys ? m.kw + 'x' + m.kh : '-';
          results.push(row);
        }
      }
    }
    return true;
  }

  scene('SB5 fold: practice pages', async () => {
    const known = existsSync(KNOWN_FILE) ? JSON.parse(readFileSync(KNOWN_FILE, 'utf8')) : {};
    const only = process.env.FOLD_ONLY ? new RegExp(process.env.FOLD_ONLY) : null; // developing: e.g. FOLD_ONLY='^child test'
    const results = [];
    const unreachable = [];
    for (const role of ['child', 'adult']) {
      for (const p of PAGES) {
        if (only && !only.test(role + ' ' + p[0])) continue;
        await runCase(role + ' ' + p[0], role, p, results, unreachable);
      }
    }
    try { await send('Emulation.setTouchEmulationEnabled', { enabled: false }); await ev("document.documentElement.style.fontSize=''"); } catch (e) { /* ignore */ }
    await H.width(390, 900);
    // judge
    const failList = [];
    const msgs = [];
    let fixed = 0; let knownHit = 0; let fresh = 0;
    for (const r of results) {
      for (const [ctl, px] of Object.entries(r.fails)) {
        const key = r.id + ' | ' + ctl;
        failList.push({ key, px, row: r });
        if (key in known) { knownHit += 1; if (px > known[key] + 0.5) { fresh += 1; msgs.push(key + ': worse than known (' + px + ' px, known ' + known[key] + ')'); } } else { fresh += 1; msgs.push(key + ': ' + px + (ctl.startsWith('keys') || ctl.startsWith('tiles') || ctl.startsWith('small:') || ctl.startsWith('overlap:') || ctl.startsWith('clipped:') || ctl === 'sideways' || ctl === 'no-controls' ? ' (size, not px)' : ' px past the fold')); }
      }
    }
    const nowFailing = new Set(failList.map((f) => f.key));
    for (const k of Object.keys(known)) if (!nowFailing.has(k) && (!only || only.test(k))) { fixed += 1; console.log('  · FIXED (remove from fold-known.json): ' + k); }
    console.log('  · ' + results.length + ' cases, ' + failList.length + ' failing controls (' + knownHit + ' known, ' + fresh + ' new), ' + fixed + ' fixed');
    msgs.slice(0, 40).forEach((m) => console.log('  · NEW: ' + m));
    unreachable.forEach((u) => console.log('  · not reachable: ' + u));
    if (process.env.FOLD_RECORD) {
      writeFileSync(join(process.env.FOLD_RECORD, 'fold-results.json'), JSON.stringify({ at: new Date().toISOString(), results, unreachable }, null, 1));
      const kn = {}; for (const f of failList) kn[f.key] = f.px;
      writeFileSync(join(process.env.FOLD_RECORD, 'fold-known.json'), JSON.stringify(kn, null, 1) + '\n');
    }
    ok(!msgs.length, msgs.length + ' fold failures not in fold-known.json (first: ' + msgs[0] + ')');
  });
}
