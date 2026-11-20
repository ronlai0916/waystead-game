// SB5 round 3b (R1): the SB5 pages drawn in a real Chromium. Loaded by tools/sb2-smoke.mjs with the harness H (scene prefix 'SB5 pages: ').
//   CHROME_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tools/sb2-smoke.mjs <fresh dir> 'SB5 pages*'
// Also: grown-up sticky-bar sweep (S2 round 4, every adult page at seven sizes and 130 % text).
// Scenes: role chooser | three homes | Set a week | Word list editor | Today | Game day | Fill in the blanks | Mix and match.
// Each page is opened, then measured at 390x844, 375x667, 360x640 (phones, the 110 px bottom overlay is simulated) and 1180x820:
//   - no console or CSP problem (the harness reports these at the end)
//   - no sideways scroll
//   - at the very end of the page, every control's bottom edge is above the 110 px band (phones); a fixed or sticky bar never reaches into it
//   - the page's own marker is there (the page drew, not "That page isn't here")
// Every defect is collected, printed as "DEFECT <page> <size>: ...", appended to <dir>/pages-defects.ndjson, and fails the scene at its end (so one run lists them all).
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import * as W from '../../site/js/words-doc.js';
import * as Su from '../../site/js/setup-doc.js';
import * as Ow from '../../site/js/own-doc.js';

export const PAGE_SIZES = [[390, 844, true], [375, 667, true], [360, 640, true], [1180, 820, false]];
// S2 round 4: the sticky-bar sweep sizes (TR-60 F2, F1, F4, F5, desktop, F3, F6)
export const SWEEP_SIZES = [[390, 844, true], [375, 667, true], [360, 640, true], [360, 800, true], [1180, 820, false], [430, 932, true], [412, 915, true]];
const BAND = 110;

export default function (H) {
  const { scene, go, ev, ok, until, sleep, shot, open, acct, signedOutBlank, seedChild, weekDoc, gameDayDoc, MON, plus, CHILD, CHILD2, ADULT } = H;
  const OUT = process.env.SB5_OUT || process.argv[2] || '.';
  const q = (s) => JSON.stringify(s);
  const OID = 'rown1';
  const DAY = plus(2);
  const NOW = Date.parse(DAY + 'T10:00:00');
  const WORDS6 = ['build', 'earth', 'fruit', 'heart', 'island', 'because'];
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const step = (n) => console.log('  · ' + n);

  const MEASURE = `(() => {
    const BAND = ${BAND}, h = innerHeight, w = innerWidth, phone = w < 700;
    const root = document.scrollingElement;
    let ov = document.getElementById('__ov');
    if (phone && !ov) { ov = document.createElement('div'); ov.id = '__ov'; ov.setAttribute('aria-hidden', 'true'); ov.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:' + BAND + 'px;pointer-events:none;z-index:2147483647;background:rgba(200,0,0,.18)'; document.body.append(ov); }
    if (!phone && ov) ov.remove();
    const hiddenUp = (e) => { for (let n = e; n && n !== document.documentElement; n = n.parentElement) { if (n.hasAttribute('inert') || n.getAttribute('aria-hidden') === 'true' || n.hidden || n.id === '__ov') return true; const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return true; } return false; };
    const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]';
    const name = (e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') + ' "' + (e.innerText || e.getAttribute('aria-label') || e.value || '').trim().replace(/\\s+/g, ' ').slice(0, 24) + '"';
    const inFixed = (e) => { for (let n = e; n && n !== document.documentElement; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
    root.scrollTo({ top: root.scrollHeight, behavior: 'instant' });
    const out = { over: Math.max(0, root.scrollWidth - root.clientWidth), band: [], off: [], h1: (document.querySelector('main h1') || {}).textContent || '', notFound: /isn.t here|not here/i.test((document.querySelector('main') || {}).innerText || '') };
    for (const e of document.querySelectorAll(SEL)) {
      if (e.closest('.sr, .skip, [data-skip-link]') || hiddenUp(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      if (phone && r.bottom > h - BAND + 0.5 && r.top < h) out.band.push({ n: name(e), bottom: Math.round(r.bottom), fixed: inFixed(e) });
      if (r.right > w + 1 && !inFixed(e)) out.off.push({ n: name(e), right: Math.round(r.right) });
    }
    root.scrollTo({ top: 0, behavior: 'instant' });
    return out;
  })()`;

  /** Measure the open page at every size; defects go to `defects`. `shotName` saves a screenshot at each size. */
  async function measure(page, shotName, defects) {
    for (const [w, h, mobile] of PAGE_SIZES) {
      await send_metrics(w, h, mobile);
      await sleep(250);
      const m = await ev(MEASURE);
      const size = w + 'x' + h;
      const add = (what) => defects.push({ page, size, what });
      if (m.over > 0) add('sideways scroll by ' + m.over + ' px');
      if (m.notFound) add('shows the not-found page');
      if (m.off.length) add('off the right edge: ' + m.off.slice(0, 3).map((x) => x.n + ' (right ' + x.right + ')').join('; '));
      if (m.band.length) add('in the 110 px band at the end of the page: ' + m.band.slice(0, 4).map((x) => x.n + ' (bottom ' + x.bottom + (x.fixed ? ', fixed' : '') + ')').join('; '));
      await shot(shotName + '-' + size);
    }
    await send_metrics(390, 844, true);
    await ev('document.getElementById("__ov") && document.getElementById("__ov").remove()');
  }
  // ---- the sticky-bar sweep (S2 round 4) -----------------------------------------------------------------------------------
  // Rule: on every grown-up page with a sticky or fixed bar (or the sticky top bar), each control can be scrolled to a place where no bar is over it
  // (hit test at three heights of the control, every few pixels of scroll), nothing sideways, and at the very end no control sits in the bottom 110 px band.
  const SWEEP = `(() => {
    const BAND = ${BAND}, root = document.scrollingElement, h = innerHeight, phone = innerWidth < 700;
    const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]';
    const hidden = (e) => { for (let n = e; n && n !== document.documentElement; n = n.parentElement) { if (n.hasAttribute('inert') || n.getAttribute('aria-hidden') === 'true' || n.hidden) return true; if (n.tagName === 'DETAILS' && !n.open && !(e.tagName === 'SUMMARY' && e.parentElement === n)) return true; const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return true; } return false; };
    const fixedOf = (t) => { for (let n = t; n && n !== document.documentElement; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return n; } return null; };
    const name = (e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/)[0] : '') + ' "' + (e.innerText || e.getAttribute('aria-label') || e.value || '').trim().replace(/\\s+/g, ' ').slice(0, 24) + '"';
    const ctl = [...document.querySelectorAll(SEL)].filter((e) => !e.closest('.sr, .skip, [data-skip-link]') && !hidden(e) && e.getBoundingClientRect().width > 1 && e.getBoundingClientRect().height > 1);
    const max = Math.max(0, root.scrollHeight - h), clear = ctl.map(() => false);
    const under = (c) => { const r = c.getBoundingClientRect(); const x = r.left + r.width / 2; for (const f of [0.1, 0.5, 0.9]) { const y = r.top + r.height * f; if (y < 0 || y > innerHeight) return true; const t = document.elementFromPoint(x, y); if (!t || c.contains(t) || t.contains(c)) continue; const fx = fixedOf(t); if (fx && !fx.contains(c)) return true; } return false; };
    for (let y = 0; y <= max + 8; y += Math.max(8, Math.floor(max / 150))) {
      root.scrollTo({ top: Math.min(y, max), behavior: 'instant' });
      ctl.forEach((c, i) => { if (!clear[i] && !under(c)) clear[i] = true; });
    }
    root.scrollTo({ top: max, behavior: 'instant' });
    const stuck = [], band = [];
    ctl.forEach((c, i) => { if (!clear[i]) stuck.push(name(c)); const r = c.getBoundingClientRect(); if (phone && r.bottom > h - BAND + 0.5 && r.top < h) band.push(name(c) + ' (bottom ' + Math.round(r.bottom) + ')'); });
    const out = { n: ctl.length, stuck, band, over: Math.max(0, root.scrollWidth - root.clientWidth), notFound: /isn.t here|not here/i.test((document.querySelector('main') || {}).innerText || '') };
    root.scrollTo({ top: 0, behavior: 'instant' });
    return out;
  })()`;
  /** Sweep the open page at the seven sizes, then at 130 % text at three of them. */
  async function sweep(page, defects) {
    for (const [w, h, mobile] of SWEEP_SIZES) {
      for (const z of (w === 390 || w === 360 && h === 640 || w === 1180) ? [false, true] : [false]) {
        await send_metrics(w, h, mobile);
        await ev('document.documentElement.style.fontSize = ' + (z ? "'130%'" : "''"));
        await sleep(200);
        const m = await ev(SWEEP);
        const size = w + 'x' + h + (z ? '+Z' : '');
        const add = (what) => defects.push({ page, size, what });
        if (m.notFound) add('shows the not-found page');
        if (m.over > 0) add('sideways scroll by ' + m.over + ' px');
        if (m.stuck.length) add('under a sticky bar at every scroll position: ' + m.stuck.slice(0, 3).join('; '));
        if (m.band.length && !z) add('in the 110 px band at the end: ' + m.band.slice(0, 3).join('; '));
      }
    }
    await ev('document.documentElement.style.fontSize = ""');
    await send_metrics(390, 844, true);
  }
  const send_metrics = (w, h, mobile) => H.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile }).then(() => H.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 5 }));

  const finish = (scn, defects) => {
    for (const d of defects) {
      console.log('  DEFECT ' + d.page + ' ' + d.size + ': ' + d.what);
      try { appendFileSync(join(OUT, 'pages-defects.ndjson'), JSON.stringify({ scene: scn, ...d }) + '\n'); } catch (e) { /* ignore */ }
    }
    ok(!defects.length, defects.length + ' browser defects on ' + scn + ' (listed above)');
  };

  // ---- the adult's household --------------------------------------------------------------------------------------------
  const ownList = () => {
    const own = Ow.set({}, OID, { name: 'Spring spellings', words: WORDS6, src: 'typed', to: [CHILD, CHILD2] }, NOW).own;
    const setup = Su.setOwnCopy({}, OID, { name: 'Spring spellings', words: WORDS6, src: 'typed' }, own[OID].at).setup;
    return { own, setup };
  };
  /** Signed in as a grown-up with the given role (null: none chosen yet), two children, one week and one list. */
  async function asAdult(role, hash = '#/grownups') {
    const { own, setup } = ownList();
    await signedOutBlank(DAY);
    acct.who = adultMe;
    if (role) await ev('localStorage.setItem("sb.role:' + ADULT + '",' + q(JSON.stringify({ r: role, n: role === 'tutor' ? 'Ben' : '', at: NOW })) + ')');
    await ev('localStorage.setItem("sb.words:' + ADULT + '",' + q(JSON.stringify(W.withOwn(weekDoc(), own))) + ')');
    acct.put(ADULT, 'spellbright', 'words', W.withOwn(weekDoc(), own));
    acct.put(CHILD, 'spellbright', 'words', W.withSetup(weekDoc(), setup));
    acct.put(CHILD2, 'spellbright', 'words', W.withSetup(W.emptyDoc(), setup));
    await open(DAY, hash);
  }
  const waitFor = (expr, what) => until(expr, what, 9000);

  scene('SB5 pages: role chooser', async () => {
    const defects = [];
    H.askRole(true);
    await asAdult(null, '#/');
    await waitFor('/grownups\\/role/.test(location.hash) && document.querySelector("main h1")', 'the role page (an adult with no role is sent there)');
    step('role chooser: ' + await ev('document.querySelector("main h1").textContent'));
    ok(await ev('document.querySelectorAll("[data-role-card], [data-pick-role], input[name=role], [data-role]").length') >= 3, 'three role choices');
    await measure('role-chooser', 'sb5-role', defects);
    H.askRole(false);
    finish('role chooser', defects);
  });

  scene('SB5 pages: three homes', async () => {
    const defects = [];
    for (const role of ['parent', 'tutor', 'teacher']) {
      await asAdult(role, '#/grownups');
      await waitFor('document.querySelector("main .gu, main .gh-page")', 'the ' + role + ' home');
      await sleep(300);
      step(role + ': ' + (await ev('document.querySelector("main h1").textContent')));
      await measure('home-' + role, 'sb5-home-' + role, defects);
    }
    finish('three homes', defects);
  });

  scene('SB5 pages: Set a week', async () => {
    const defects = [];
    await asAdult('parent', '#/grownups');
    await waitFor('document.querySelector("main .gu, main .gh-page")', 'the home');
    await go('#/grownups/set');
    await waitFor('document.querySelector(".st-page, [data-setweek], main h1")', 'Set a week');
    await sleep(400);
    step('Set a week: ' + await ev('document.querySelector("main h1") && document.querySelector("main h1").textContent'));
    await measure('set-a-week', 'sb5-set-a-week', defects);
    await go('#/grownups/set/list/' + OID);
    await sleep(500);
    await measure('set-a-week-list', 'sb5-set-a-week-list', defects);
    finish('Set a week', defects);
  });

  scene('SB5 pages: Word list editor', async () => {
    const defects = [];
    await asAdult('parent', '#/grownups/own/new');
    await waitFor('document.querySelector("main h1")', 'the editor');
    await sleep(400);
    step('editor: ' + await ev('document.querySelector("main h1").textContent'));
    await measure('word-list-editor-new', 'sb5-editor-new', defects);
    await go('#/grownups/own/' + OID + '/edit');
    await sleep(500);
    await measure('word-list-editor-saved', 'sb5-editor-saved', defects);
    await go('#/grownups/own');
    await sleep(400);
    await measure('word-lists', 'sb5-word-lists', defects);
    finish('Word list editor', defects);
  });

  const CID = CHILD;
  scene('SB5 pages: grown-up sticky-bar sweep', async () => {
    const defects = [];
    const K = '#/grownups/child/' + CID;
    const ROUTES = ['#/grownups', '#/grownups/set', '#/grownups/set/list/' + OID, '#/grownups/set/child/' + CID, K, K + '/plan/g1', K + '/rename/g1', K + '/weeks', K + '/week/g1', K + '/print/g1',
      '#/grownups/own', '#/grownups/own/new', '#/grownups/own/' + OID, '#/grownups/own/' + OID + '/edit', '#/grownups/own/' + OID + '/give', '#/grownups/own/' + OID + '/results', '#/grownups/own/' + OID + '/copy', '#/grownups/own/' + OID + '/sentences',
      '#/grownups/own/ready', '#/grownups/own/ready/y4', '#/grownups/own/ready/y34-ch03', '#/grownups/own/ready/y34-ch03/copy', '#/grownups/overview', '#/grownups/help', '#/grownups/yourself', '#/grownups/more', '#/grownups/stories', '#/about'];
    for (const role of ['parent', 'tutor', 'teacher']) {
      await asAdult(role, '#/grownups');
      await waitFor('document.querySelector("main .gu, main .gh-page")', 'the ' + role + ' home');
      for (const r of (role === 'parent' ? ROUTES : ['#/grownups', '#/grownups/set', '#/grownups/own', '#/grownups/overview', '#/grownups/help'])) {
        await go(r);
        await sleep(450);
        await sweep(role + ' ' + r.replace('#/grownups', '').replace(CID, ':cid') || role + ' home', defects);
      }
    }
    finish('grown-up sticky-bar sweep', defects);
  });

  // ---- the child's day ------------------------------------------------------------------------------------------------------
  async function asChild(hash) {
    await seedChild(gameDayDoc(), DAY);
    await ev('localStorage.setItem("sb.fillLevel", "")');
    await open(DAY, hash);
  }

  scene('SB5 pages: Today', async () => {
    const defects = [];
    await asChild('#/');
    await waitFor('document.querySelector("[data-room=job]")', 'Today');
    step('Today: ' + await ev('document.querySelector("main h1").textContent'));
    await measure('today', 'sb5-today', defects);
    await go('#/words/g/g1/path');
    await sleep(400);
    await measure('my-week', 'sb5-my-week', defects);
    finish('Today', defects);
  });

  scene('SB5 pages: Game day', async () => {
    const defects = [];
    await asChild('#/words/g/g1/study/games');
    await waitFor('document.querySelector("main h1")', 'Game day');
    await sleep(400);
    step('Game day: ' + await ev('document.querySelector("main h1").textContent'));
    await measure('game-day', 'sb5-game-day', defects);
    await go('#/words/g/g1/games');
    await sleep(500);
    await measure('game-list', 'sb5-game-list', defects);
    finish('Game day', defects);
  });

  for (const [id, label] of [['fill', 'Fill in the blanks'], ['mix', 'Mix and match']]) {
    scene('SB5 pages: ' + label, async () => {
      const defects = [];
      await asChild('#/words/g/g1/game/' + id);
      await waitFor('document.querySelector("main h1, main .card")', label);
      await sleep(800);
      const t = await ev('document.querySelector("main").innerText.slice(0, 80)');
      step(label + ': ' + t.replace(/\s+/g, ' '));
      ok(!/done$|Nothing to play/i.test(t.trim()), label + ' drew a board, not "done" (the bank needs at least 3 usable entries)');
      await measure(id, 'sb5-' + id, defects);
      finish(label, defects);
    });
  }
}
