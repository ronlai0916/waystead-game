// SB5 D1: the device-profile harness. Loaded by tools/sb2-smoke.mjs with the harness H (scene prefix 'SB5 devices: ').
//   CHROME_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tools/sb2-smoke.mjs <fresh dir> 'SB5 devices*'
// Why: the fold checks passed in a plain Chromium while Ron's real iPhone (Safari 26, floating bottom bar, status-bar and home-bar insets) failed. So each profile here REALLY emulates the device:
//   - the viewport the page really gets (the full screen on an iPhone: the floating bar overlays the page; a browser's toolbar already taken off on Chrome and Android),
//   - the device's user agent, platform and touch points (so js/device.js detects it exactly as on the phone),
//   - the safe-area insets: Chromium cannot set env(safe-area-inset-*), so the harness stores {"sat":..,"sab":..} in localStorage "sb.devTest", which js/device.js reads
//     (only when that key exists; no visitor has it) and writes into --sat/--sab. No product CSS path differs.
//   - for iPhone Safari a drawn overlay (red band, pointer-events none) of the floating bar's real size, at the bottom, over the page: its top is 78 px above the SCREEN foot, which INCLUDES the home-indicator inset (D2 fix: it was drawn 78 px above the inset, so the double count never showed).
// Checks, per profile and page, at scroll 0: the main buttons fully visible, ABOVE the bottom reserve (so never under the overlay), not clipped or covered (hit test),
//   no sideways scroll, the page's own markers; pages that must fit one screen (practice, tiles, test, quiz, quick-fire, the six games, the Menu sheet) also have no scroll;
//   sheets: the rows scroll inside the sheet, which reaches down to the reserve, and the last row can be scrolled clear of it; the data-* attributes match the profile.
// Every defect is printed as DEFECT, and the numbers (control bottom, the line it must clear, slack, page height) go to <shots>/devices-numbers.ndjson.
// Screenshots (viewport only): $DEVICES_SHOTS or /tmp/claude-0/d1/shots/<profile>/<page>.png. DEVICES_ONLY='iphone-air|iphone-se' limits the profiles; DEVICES_PAGES='^child-today' the pages.
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import * as Su from '../../site/js/setup-doc.js';
import * as Ow from '../../site/js/own-doc.js';

const IOS = (v, extra) => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ' + extra;
const SAFARI26 = IOS(18, 'Version/26.0 Mobile/15E148 Safari/604.1');
const CHROME_IOS = IOS(18, 'CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1');
const PIXEL = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const SAMSUNG = 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A346B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'; // iPadOS asks for the desktop site
const DESK = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// w x h is the viewport the page gets (innerWidth x innerHeight). bar: the drawn overlay height (iPhone Safari). reserve/os/browser/h: what device.js must conclude.
export const PROFILES = [
  { id: 'iphone-air', label: 'iPhone Air, Safari 26 (Ron)', w: 420, h: 912, ua: SAFARI26, touch: 5, sat: 59, sab: 34, bar: 78, os: 'ios', browser: 'safari', reserve: 84, cls: 'm' },
  // Ron's real iPhone Air with Safari 27's FULL bar showing (About this device, 22 Nov): the page is 746 of a 912 screen, starts under the status bar
  // (inset top 0) and ends above the bar, which covers none of it: nothing to draw, and the reserve must shrink to 8 (no 100 px gap).
  { id: 'iphone-air-bar', label: 'iPhone Air, Safari 27, full bar (Ron, real)', w: 420, h: 746, sh: 912, ua: SAFARI26, touch: 5, sat: 0, sab: 0, bar: 0, os: 'ios', browser: 'safari', reserve: 8, cls: 'm' },
  // The OTHER real Safari state on Ron's iPhone Air (23 Nov): the bar shrinks to the pill and the page grows to the screen's foot (845 of 912, inset top 0), the floating bar drawn over it.
  // device.js: 84 - (912 - 845 - 62) = 79.
  { id: 'iphone-air-pill', label: 'iPhone Air, Safari 27, bar shrunk to the pill (Ron, real)', w: 420, h: 845, sh: 912, ua: SAFARI26, touch: 5, sat: 0, sab: 0, bar: 78, os: 'ios', browser: 'safari', reserve: 79, cls: 'm' },
  { id: 'iphone-17pro', label: 'iPhone 17 Pro, Safari 26', w: 402, h: 874, ua: SAFARI26, touch: 5, sat: 62, sab: 34, bar: 78, os: 'ios', browser: 'safari', reserve: 84, cls: 'm' },
  { id: 'iphone-16', label: 'iPhone 16, Safari 26', w: 393, h: 852, ua: SAFARI26, touch: 5, sat: 59, sab: 34, bar: 78, os: 'ios', browser: 'safari', reserve: 84, cls: 's' },
  { id: 'iphone-14', label: 'iPhone 14, Safari 26', w: 390, h: 844, ua: SAFARI26, touch: 5, sat: 47, sab: 34, bar: 78, os: 'ios', browser: 'safari', reserve: 84, cls: 's' },
  { id: 'iphone-se', label: 'iPhone SE, Safari 26', w: 375, h: 667, ua: SAFARI26, touch: 5, sat: 20, sab: 0, bar: 78, os: 'ios', browser: 'safari', reserve: 84, cls: 'xs' },
  { id: 'iphone-chrome', label: 'iPhone 16, Chrome', w: 393, h: 700, ua: CHROME_IOS, touch: 5, sat: 0, sab: 0, bar: 0, os: 'ios', browser: 'chrome', reserve: 12, cls: 's' },
  { id: 'pixel-9', label: 'Pixel 9, Chrome', w: 412, h: 915, ua: PIXEL, touch: 5, sat: 0, sab: 0, bar: 0, os: 'android', browser: 'chrome', reserve: 16, cls: 'l' },
  { id: 'android-360x800', label: 'Android 360x800, Chrome', w: 360, h: 800, ua: PIXEL, touch: 5, sat: 0, sab: 0, bar: 0, os: 'android', browser: 'chrome', reserve: 16, cls: 'm' },
  { id: 'samsung-360x640', label: 'Samsung 360x640, Samsung Internet', w: 360, h: 640, ua: SAMSUNG, touch: 5, sat: 0, sab: 0, bar: 0, os: 'android', browser: 'samsung', reserve: 16, cls: 's' },
  { id: 'ipad-portrait', label: 'iPad 820x1180, Safari', w: 820, h: 1180, ua: IPAD, touch: 5, sat: 0, sab: 20, bar: 0, os: 'ipados', browser: 'safari', reserve: 36, cls: 'l' },
  { id: 'ipad-landscape', label: 'iPad 1180x820, Safari', w: 1180, h: 820, ua: IPAD, touch: 5, sat: 0, sab: 20, bar: 0, os: 'ipados', browser: 'safari', reserve: 36, cls: 'm' },
  { id: 'desktop', label: 'Desktop 1280x800', w: 1280, h: 800, ua: DESK, touch: 0, sat: 0, sab: 0, bar: 0, os: 'desktop', browser: 'chrome', reserve: 16, cls: 'm' },
];

const CONTROLS = '[data-check],[data-next],[data-hear],[data-hearmain],[data-peekbtn],[data-skip],[data-go],[data-job],[data-fold="check"],[data-fold="next"]';

export default function (H) {
  const { scene, go, click, ev, ok, until, sleep, open, acct, signedOutBlank, seedChild, weekDoc, gameDayDoc, practiceDayDoc, studied, MON, plus, W, CHILD, CHILD2, ADULT, send } = H;
  const SHOTS = process.env.DEVICES_SHOTS || '/tmp/claude-0/d1/shots';
  const only = process.env.DEVICES_ONLY ? new RegExp(process.env.DEVICES_ONLY) : null;
  const onlyPages = process.env.DEVICES_PAGES ? new RegExp(process.env.DEVICES_PAGES) : null;
  const q = (s) => JSON.stringify(s);
  const step = (n) => console.log('  · ' + n);
  const NOW = Date.parse(MON + 'T08:00:00');
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const OID = 'rown1';
  const WORDS6 = ['build', 'earth', 'fruit', 'heart', 'island', 'because'];

  async function apply(p) {
    const mobile = p.os === 'ios' || p.os === 'android';
    await send('Emulation.setDeviceMetricsOverride', { width: p.w, height: p.h, deviceScaleFactor: 2, mobile, ...(p.sh ? { screenWidth: p.w, screenHeight: p.sh } : {}) });
    await send('Emulation.setUserAgentOverride', { userAgent: p.ua, platform: p.os === 'desktop' ? 'Linux x86_64' : p.os === 'android' ? 'Linux armv81' : p.os === 'ipados' ? 'MacIntel' : 'iPhone' });
    await send('Emulation.setTouchEmulationEnabled', { enabled: p.touch > 0, maxTouchPoints: p.touch || 1 });
    await send('Emulation.setEmitTouchEventsForMouse', { enabled: false }).catch(() => {});
  }
  async function reset() {
    await send('Emulation.setUserAgentOverride', { userAgent: DESK });
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: false });
  }
  /** Seed (the page storage is cleared by the seeding, so the hook key goes in last), then open at the profile's own size. */
  async function openAs(p, day, hash, seeder, night) {
    await reset();
    await seeder();
    await ev('localStorage.setItem("sb.devTest",' + q(JSON.stringify({ sat: p.sat, sab: p.sab })) + ')');
    await ev('localStorage.setItem("sb.tilesTest","' + (seeder.tiles ? '1' : '0') + '")');
    if (night || process.env.DEVICES_NIGHT) await ev('localStorage.setItem("sb.theme","dark")'); // DEVICES_NIGHT=1: the Night look (screenshots)
    await apply(p);
    await open(day, hash);
  }
  const drawOverlay = (p) => ev(`(() => {
    let o = document.getElementById('__ov'); if (o) o.remove();
    if (!${p.bar}) return;
    o = document.createElement('div'); o.id = '__ov'; o.setAttribute('aria-hidden', 'true');
    o.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:${p.bar}px;pointer-events:none;z-index:2147483647;background:rgba(200,0,0,.22)';
    const b = document.createElement('div'); b.style.cssText = 'position:absolute;left:18px;right:18px;bottom:0;height:48px;border-radius:24px;background:rgba(80,80,80,.55)'; o.append(b);
    document.body.append(o);
  })()`);

  const MEASURE = (limit) => `(() => {
    const limit = ${limit}, ih = innerHeight, root = document.scrollingElement;
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') return false; for (let n = e; n && n !== document.documentElement; n = n.parentElement) if (n.hidden || n.hasAttribute('inert') || n.getAttribute('aria-hidden') === 'true') return false; return true; };
    const name = (e) => (e.dataset && Object.keys(e.dataset).find((k) => ['check','next','hear','hearmain','peekbtn','skip','go','job'].includes(k))) || e.tagName.toLowerCase();
    const seen = new Set();
    const ctl = [...document.querySelectorAll(${JSON.stringify(CONTROLS)})].filter(vis).map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ e, r }) => { const k = name(e) + Math.round(r.bottom); if (seen.has(k)) return false; seen.add(k); return true; });
    const hit = (e, r) => { for (const [fx, fy] of [[0.5, 0.5], [0.15, 0.5], [0.85, 0.5]]) { const x = r.left + r.width * fx, y = r.top + r.height * fy; if (y < 0 || y > ih || x < 0 || x > innerWidth) return 'off-screen'; const t = document.elementFromPoint(x, y); if (t && !e.contains(t) && !t.contains(e)) return 'covered by ' + (t.className || t.tagName); } return ''; };
    const out = { ih, iw: innerWidth, sh: root.scrollHeight, sy: Math.round(root.scrollTop), sideways: Math.max(0, root.scrollWidth - root.clientWidth), limit,
      head: Math.round((document.querySelector('.topbar') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height),
      html: Object.fromEntries(['data-os','data-browser','data-standalone','data-orient','data-h'].map((a) => [a, document.documentElement.getAttribute(a)])),
      vars: Object.fromEntries(['--app-h','--app-w','--sat','--sab','--bottom-reserve','--head-h'].map((v) => [v, document.documentElement.style.getPropertyValue(v)])),
      ctl: ctl.map(({ e, r }) => ({ n: name(e), t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), bad: hit(e, r) })),
      h1: (document.querySelector('main h1') || {}).textContent || '', notFound: /isn.t here|not here|something went wrong/i.test((document.querySelector('main') || {}).innerText || '') };
    return out;
  })()`;

  // ---- pages --------------------------------------------------------------------------------------------------------------
  const helloDone = () => { const d = weekDoc(); return W.markStep(d, W.groupById(d, 'g1'), 'hello', MON, Date.parse(MON + 'T09:00:00')); };
  const withHelp = (doc, lv) => W.withSetup(doc, Su.setHelp({}, lv, NOW, 'Sam'));
  const childSeed = (doc, day) => async () => { await seedChild(doc(), day); };
  const childTiles = (doc, day, lv) => { const f = async () => { await seedChild(withHelp(doc(), lv), day); }; f.tiles = true; return f; };
  const ownList = () => {
    const own = Ow.set({}, OID, { name: 'Spring spellings', words: WORDS6, src: 'typed', to: [CHILD, CHILD2] }, NOW).own;
    const setup = Su.setOwnCopy({}, OID, { name: 'Spring spellings', words: WORDS6, src: 'typed' }, own[OID].at).setup;
    return { own, setup };
  };
  const adultSeed = (day) => async () => {
    const { own, setup } = ownList();
    await signedOutBlank(day);
    acct.who = adultMe;
    await ev('localStorage.setItem("sb.role:' + ADULT + '",' + q(JSON.stringify({ r: 'parent', n: '', at: NOW })) + ')');
    await ev('localStorage.setItem("sb.words:' + ADULT + '",' + q(JSON.stringify(W.withOwn(weekDoc(), own))) + ')');
    acct.put(ADULT, 'spellbright', 'words', W.withOwn(weekDoc(), own));
    acct.put(CHILD, 'spellbright', 'words', W.withSetup(weekDoc(), setup));
    acct.put(CHILD2, 'spellbright', 'words', W.withSetup(W.emptyDoc(), setup));
  };
  const KEYS = 'document.querySelector(".keyboard .key, .tray .key, .ltile, .keyboard--tray")';
  const D1 = plus(1); const D2 = plus(2); const D4 = plus(4); const D5 = plus(5);
  const FLOWER_LIST = `(async () => { const c = await (await fetch('data/curriculum.json')).json(); return c.year_3_4.chapters.flatMap((ch) => ch.words.map((w) => w.word)).slice(0, 10); })()`;
  const fixTyping = async () => { await click('[data-cover]'); await click('[data-written]'); await until('document.querySelector("[data-check]") && ' + KEYS, 'Fix it in typing'); };
  // Set a week: Children step, Next, the New tab, Word by word
  const toWordByWord = async () => {
    await sleep(400);
    if (await ev('!!document.querySelector("[data-kid]:not(:checked)")')) await ev('document.querySelector("[data-kid]:not(:checked)").click()');
    await click('[data-act="next"]');
    await until('document.querySelector("[data-tab=new], [data-act=toWords], [data-act=words]")', 'the words step');
    if (await ev('!document.querySelector("[data-tab=new]")')) await click('[data-act=toWords], [data-act=words]');
    await until('document.querySelector("[data-tab=new]")', 'the words tabs');
    await click('[data-tab="new"]');
    await click('[data-act="wbw"]');
    await until('document.querySelector("#st-find")', 'Word by word');
  };
  // [id, seeder, day, hash, wait expression, after-load step, options { fit: no scroll, sheet: opens a sheet }]
  const PAGES = [
    ['child-today', childSeed(gameDayDoc, D2), D2, '#/', 'document.querySelector("[data-room=job]")', null, { today: true }],
    ['child-fix-keyboard', childSeed(helloDone, D1), D1, '#/words/g/g1/study/fix', 'document.querySelector("[data-cover]")', fixTyping, { fit: true }],
    ['child-fix-tiles', childTiles(helloDone, D1, 1), D1, '#/words/g/g1/study/fix', 'document.querySelector("[data-cover]")', async () => { await click('[data-cover]'); await click('[data-written]'); await until('document.querySelector("[data-check]") && document.querySelector(".keyboard--tray .ltile, .keyboard--tray")', 'Fix it in tiles'); }, { fit: true }],
    ['child-practice', childSeed(practiceDayDoc, D4), D4, '#/words/g/g1/spell/0', 'document.querySelector(".spellbox.is-next")', null, { fit: true }],
    ['child-test', childSeed(() => studied(weekDoc()), D5), D5, '#/words/g/g1/test', 'document.querySelector("[data-next]") && ' + KEYS, null, { fit: true }],
    ['child-quiz', childSeed(gameDayDoc, D2), D2, '#/words/g/g1/quiz', 'document.querySelector("[data-check],[data-next],.keyboard .key,main h1")', null, { fit: true }],
    ['child-quick-fire', childSeed(gameDayDoc, D2), D2, '#/words/g/g1/game/quick', 'document.querySelector("[data-game=quick]") && ' + KEYS, null, { fit: true }],
    ['child-flower', childSeed(weekDoc, MON), MON, '#/', 'document.querySelector("main section")', async () => {
      const list = await ev(FLOWER_LIST);
      await ev('sessionStorage.setItem("sb.selection",' + q(JSON.stringify(list)) + ')');
      await go('#/custom/play');
      await until('document.querySelector(".blanks") && ' + KEYS, 'the flower game');
    }, { flower: true }],
    ['child-today-noweek', childSeed(() => W.emptyDoc(), D2), D2, '#/', 'document.querySelector("main section, main nav")', async () => { await sleep(500); }, { last: true, optional: true }],
    ['child-today-night', childSeed(gameDayDoc, D2), D2, '#/', 'document.querySelector("[data-room=job]")', null, { today: true, last: true, night: true }],
    ['child-flower-tiles', childTiles(weekDoc, MON, 1), MON, '#/', 'document.querySelector("main section")', async () => {
      const list = await ev(FLOWER_LIST);
      await ev('sessionStorage.setItem("sb.selection",' + q(JSON.stringify(list)) + ')');
      await go('#/custom/play');
      await until('document.querySelector(".blanks") && document.querySelector("[data-wrongtext]")', 'the flower game with tiles');
    }, { flower: true, last: true, fitTall: true }],
    ['child-hello-tiles', childTiles(weekDoc, MON, 1), MON, '#/words/g/g1/study/hello', 'document.querySelector("[data-play]")', async () => { await click('[data-play]'); await until('document.querySelector(".blanks") && document.querySelector("[data-wrongtext]")', 'Hello words flower game'); }, { flower: true, last: true, fitTall: true }],
    ['child-hello-keys', childSeed(weekDoc, MON), MON, '#/words/g/g1/study/hello', 'document.querySelector("[data-play]")', async () => { await click('[data-play]'); await until('document.querySelector(".blanks") && document.querySelector("[data-wrongtext]")', 'Hello words flower game'); }, { flower: true, last: true, fitTall: true }],
    ['adult-word-by-word-night', adultSeed(D2), D2, '#/grownups/set', 'document.querySelector(".st-page")', async () => { await toWordByWord(); }, { bar: '.st-bar', optional: true, last: true, fields: true, night: true }],
    ['adult-word-by-word-day', adultSeed(D2), D2, '#/grownups/set', 'document.querySelector(".st-page")', async () => { await toWordByWord(); }, { bar: '.st-bar', optional: true, last: true, fields: true }],
    ...['missing', 'unjumble', 'match', 'fill', 'mix'].map((g) => ['child-game-' + g, childSeed(gameDayDoc, D2), D2, '#/words/g/g1/game/' + g, 'document.querySelector("main h1")', null, { fit: true, game: g, noctl: g === 'match' }]),
    ['child-menu-sheet', childSeed(gameDayDoc, D2), D2, '#/', 'document.querySelector("[data-room=job]")', async () => { await click('#child-menu'); await until('document.querySelector(".menusheet .sheet__rows")', 'the menu sheet'); }, { sheet: '.menusheet' }],
    ['adult-home', adultSeed(D2), D2, '#/grownups', 'document.querySelector("main h1")', async () => { await sleep(500); }, { bar: '.gh-bar, .gu-obar', optional: true }],
    ['child-device-page', childSeed(gameDayDoc, D2), D2, '#/device', 'document.querySelector("[data-device-page]")', null, { bar: '[data-none]', optional: true }],
    ['adult-set-a-week', adultSeed(D2), D2, '#/grownups/set', 'document.querySelector(".st-page")', async () => { await sleep(400); }, { bar: '.st-bar' }],
    ['adult-list-editor-night', adultSeed(D2), D2, '#/grownups/own/new', 'document.querySelector("main h1")', async () => { await sleep(500); }, { bar: '[data-none]', optional: true, fields: 'maybe', night: true }],
    ['adult-list-find-night', adultSeed(D2), D2, '#/grownups/own/ready', 'document.querySelector("main h1")', async () => { await sleep(500); }, { bar: '[data-none]', optional: true, fields: 'maybe', night: true }],
    ['adult-type-all-night', adultSeed(D2), D2, '#/grownups/set', 'document.querySelector(".st-page")', async () => { await toWordByWord(); await click('[data-act="toWords"]'); await click('[data-tab="new"]'); await click('[data-act="typeall"]'); await until('document.querySelector("[data-text]")', 'type all'); }, { bar: '.st-bar', optional: true, fields: true, night: true }],
    ['adult-word-lists', adultSeed(D2), D2, '#/grownups/own', 'document.querySelector("main h1")', async () => { await sleep(400); }, { bar: '.ls-bar, .gh-bar, .gu-obar', optional: true }],
  ];

  async function shotTo(p, id) {
    const dir = join(SHOTS, p.id);
    mkdirSync(dir, { recursive: true });
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(dir, id + '.png'), Buffer.from(r.data, 'base64'));
  }

  async function runPage(p, pg, defects) {
    const [id, seeder, day, hash, wait, after, o] = pg;
    const add = (what) => defects.push({ profile: p.id, page: id, what });
    await openAs(p, day, hash, seeder, o.night);
    try {
      await until(wait, id + ' page', 9000);
      if (after) await after();
    } catch (e) { add('could not reach: ' + e.message.slice(0, 120)); return; }
    await ev('document.fonts.ready.then(() => true)');
    await sleep(250);
    await drawOverlay(p);
    const limit = p.h - p.reserve;
    const m = await ev(MEASURE(limit));
    const num = { profile: p.id, page: id, ih: m.ih, limit, head: m.head, sh: m.sh, scrollPx: Math.max(0, m.sh - m.ih), ctl: m.ctl.map((c) => c.n + ':' + c.b).join(' '), maxB: m.ctl.length ? Math.max(...m.ctl.map((c) => c.b)) : null };
    if (process.env.DEVICES_DUMP) num.tree = await ev(`(() => { const out = []; const walk = (e, d) => { if (d > 3) return; for (const c of e.children) { const r = c.getBoundingClientRect(); if (r.height > 0) out.push('  '.repeat(d) + c.tagName.toLowerCase() + (c.className && typeof c.className === 'string' ? '.' + c.className.split(' ').join('.') : '') + ' ' + Math.round(r.top + scrollY) + '-' + Math.round(r.bottom + scrollY) + ' h' + Math.round(r.height) + ' mt' + getComputedStyle(c).marginTop + ' mb' + getComputedStyle(c).marginBottom); walk(c, d + 1); } }; walk(document.querySelector('main'), 0); return out; })()`);
    num.dbg = await ev(`(() => { const m = document.querySelector('main'), c = m.firstElementChild, a = getComputedStyle(m), b = getComputedStyle(c); return [a.paddingTop, a.marginTop, b.marginTop, b.paddingTop, b.minHeight, b.height].join(' '); })()`);
    num.slack = num.maxB === null ? null : limit - num.maxB;
    num.kids = await ev(`[...document.body.children].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '') + ':' + Math.round(e.getBoundingClientRect().top + scrollY) + '-' + Math.round(e.getBoundingClientRect().bottom + scrollY)).concat([...document.querySelectorAll('main > *')].map((e) => '  main>' + e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ').join('.') : '') + ':' + Math.round(e.getBoundingClientRect().top + scrollY) + '-' + Math.round(e.getBoundingClientRect().bottom + scrollY)))`);
    // the profile was detected the way the phone would be
    const exp = { 'data-os': p.os, 'data-browser': p.browser, 'data-h': p.cls, 'data-orient': p.w > p.h ? 'landscape' : 'portrait' };
    for (const [k, v] of Object.entries(exp)) if (m.html[k] !== v) add(k + ' is "' + m.html[k] + '", expected "' + v + '"');
    if (parseInt(m.vars['--bottom-reserve'], 10) !== p.reserve) add('--bottom-reserve is ' + m.vars['--bottom-reserve'] + ', expected ' + p.reserve + 'px');
    if (parseInt(m.vars['--sat'], 10) !== p.sat || parseInt(m.vars['--sab'], 10) !== p.sab) add('--sat/--sab are ' + m.vars['--sat'] + '/' + m.vars['--sab']);
    if (parseInt(m.vars['--app-h'], 10) !== p.h) add('--app-h is ' + m.vars['--app-h'] + ', expected ' + p.h + 'px');
    if (Math.abs(parseInt(m.vars['--head-h'], 10) - m.head) > 1) add('--head-h ' + m.vars['--head-h'] + ' but the top bar is ' + m.head + ' px');
    if (m.notFound) add('shows the not-found or error page');
    if (m.sideways > 0) add('sideways scroll by ' + m.sideways + ' px');
    if (!o.sheet && !o.bar && !o.fixedBars) {
      if (!m.ctl.length && !o.noctl) add('no main buttons found');
      for (const c of m.ctl) {
        if (c.b > limit + 0.5) add(c.n + ' bottom ' + c.b + ' is ' + (c.b - limit) + ' px below the line ' + limit + ' (reserve ' + p.reserve + ')');
        if (c.t < 0) add(c.n + ' top ' + c.t + ' is above the screen');
        if (c.bad) add(c.n + ' ' + c.bad);
        if (c.r > m.iw + 0.5 || c.l < -0.5) add(c.n + ' is cut off sideways (' + c.l + '..' + c.r + ' of ' + m.iw + ')');
      }
      if (o.fit && m.sh > m.ih + 1) add('the page scrolls: ' + m.sh + ' px tall in ' + m.ih);
    }
    if (o.today) {
      // content top-aligned (no big gap above the main button), footer reachable clear of the reserve
      const g = await ev(`(() => { const j = document.querySelector('[data-job]').getBoundingClientRect(); const lead = document.querySelector('.today__head, .today h1, .today > *:first-child'); const a = [...document.querySelectorAll('.today > *')].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0 && r.top < j.top); const gap = Math.max(0, ...a.map((r, i) => (i ? r.top - a[i - 1].bottom : 0))); void lead; return { gap: Math.round(gap), jobTop: Math.round(j.top) }; })()`);
      num.gap = g.gap;
      if (g.gap > 64) add('a ' + g.gap + ' px gap above the main button');
      const f = await ev(`(() => { const r = document.scrollingElement; r.scrollTo({ top: r.scrollHeight, behavior: 'instant' }); const out = [...document.querySelectorAll('.today__foot a, .foot a')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => Math.round(e.getBoundingClientRect().bottom)); r.scrollTo({ top: 0, behavior: 'instant' }); return out; })()`);
      num.footBottoms = f.join(',');
      if (f.some((b) => b > limit + 0.5)) add('the footer links end at ' + Math.max(...f) + ', under the reserve line ' + limit + ' when scrolled to the end');
      const nm = await ev('(document.querySelector(".today__eyebrow, .eyebrow") || {}).textContent || ""');
      num.eyebrow = nm;
    }
    if (o.last || o.fields) {
      // the LAST content (footer links included, fixed and sticky bars and the harness overlay left out) must end above the reserve line when the page is scrolled to its end
      const LASTB = `(() => { const main = document.querySelector('main'); const foot = document.querySelector('.foot'); let max = 0, who = '';
        const skip = (e) => { for (let n = e; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (n.id === '__ov' || n.id === 'toast' || (n.tagName === 'DETAILS' && !n.open && e.tagName !== 'SUMMARY' && !e.closest('summary')) || cs.position === 'fixed' || cs.position === 'sticky' || n.hidden) return true; } return false; };
        for (const root of [main, foot]) { if (!root) continue; for (const e of root.querySelectorAll('*')) { if (e.children.length && e.tagName !== 'BUTTON' && e.tagName !== 'A' && e.tagName !== 'INPUT') continue; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none' || skip(e)) continue; if (r.bottom > max) { max = r.bottom; who = e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + ' ' + (e.textContent || '').trim().slice(0, 24); } } }
        return { b: Math.round(max), who }; })()`;
      const top = await ev(LASTB);
      const r = await ev(`(() => { const r = document.scrollingElement; const before = r.scrollHeight > innerHeight + 1; r.scrollTo({ top: r.scrollHeight, behavior: 'instant' }); return before; })()`);
      await sleep(120);
      const end = await ev(LASTB);
      await ev(`document.scrollingElement.scrollTo({ top: 0, behavior: 'instant' })`);
      num.lastTop = top.b; num.lastEnd = end.b; num.lastWho = end.who;
      if (o.last && !o.bar && !o.sheet && end.b > limit + 0.5) add('the last content (' + end.who + ') ends at ' + end.b + ' when scrolled to the end: under the reserve line ' + limit);
      if (o.fitTall && p.w >= 390 && p.h >= 744 && (top.b > limit + 0.5 || r)) add('must fit with no scrolling: the last content (' + top.who + ') ends at ' + top.b + ', the reserve line is ' + limit + (r ? ', the page scrolls' : ''));
    }
    if (o.fields) {
      const f = await ev(`(() => { const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        const parse = (s) => { const m = /rgba?\\(([^)]+)\\)/.exec(s); if (!m) return null; const a = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { c: a.slice(0, 3), a: a.length > 3 ? a[3] : 1 }; };
        const bgOf = (e) => { let acc = [0, 0, 0], have = false; const layers = []; for (let n = e; n; n = n.parentElement) { const p = parse(getComputedStyle(n).backgroundColor); if (p && p.a > 0) { layers.push(p); if (p.a >= 1) break; } } let base = [255, 255, 255]; for (const p of layers.reverse()) base = base.map((b, i) => b * (1 - p.a) + p.c[i] * p.a); return base; };
        const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const out = []; for (const e of document.querySelectorAll('main input:not([type=checkbox]):not([type=radio]):not([type=file]), main textarea, main select')) { const r = e.getBoundingClientRect(); if (r.width < 2) continue; const cs = getComputedStyle(e); const bg = bgOf(e); const fg = parse(cs.color).c; const o = { n: e.tagName.toLowerCase() + '#' + e.id, text: Math.round(ratio(fg, bg) * 10) / 10 };
          if (e.placeholder) { const ph = parse(getComputedStyle(e, '::placeholder').color); o.ph = ph ? Math.round(ratio(ph.c, bg) * 10) / 10 : 0; o.phA = ph ? ph.a : 0; }
          out.push(o); } return out; })()`);
      num.fields = f.map((x) => x.n + ':' + x.text + (x.ph !== undefined ? '/' + x.ph : '')).join(' ');
      if (!f.length && o.fields !== 'maybe') add('no text fields found');
      for (const x of f) {
        if (x.text < 4.5) add('field ' + x.n + ' text contrast ' + x.text + ':1, needs 4.5');
        if (x.ph !== undefined && x.ph < 4.5) add('field ' + x.n + ' hint contrast ' + x.ph + ':1, needs 4.5');
      }
    }
    if (o.game === 'mix') {
      const s = await ev(`(() => { const sl = [...document.querySelectorAll('.mixslot')]; const board = document.querySelector('.mixboard').getBoundingClientRect(); const bar = document.querySelector('.mixbar').getBoundingClientRect();
        const full = sl.filter((e) => { const r = e.getBoundingClientRect(); return r.top >= board.top - 1 && r.bottom <= board.bottom + 1; }).length; return { full, n: sl.length, boardB: Math.round(board.bottom), barT: Math.round(bar.top), barB: Math.round(bar.bottom) }; })()`);
      Object.assign(num, { fullSentences: s.full, sentences: s.n, boardBottom: s.boardB, barTop: s.barT, barBottom: s.barB });
      if (p.w < 600 && p.h >= 850 && s.full < 2) add('only ' + s.full + ' full sentences visible on a ' + p.h + ' px phone');
      if (p.w < 600 && Math.abs(s.barB - limit) > 3) add('the tray and Check bar ends at ' + s.barB + ', not at the reserve line ' + limit);
      if (p.w < 600 && s.barT - s.boardB > 24) add('blank band of ' + (s.barT - s.boardB) + ' px between the board and the tray');
    }
    if (o.sheet) {
      const s = await ev(`(() => { const sh = document.querySelector('${o.sheet}'); const rows = sh.querySelector('.sheet__rows'); const items = [...rows.children]; const last = items[items.length - 1];
        const box = sh.getBoundingClientRect(); const rb = rows.getBoundingClientRect(); const over = rows.scrollHeight > rows.clientHeight + 1;
        rows.scrollTop = rows.scrollHeight; const lb = last.getBoundingClientRect(); const fb = items[0].getBoundingClientRect();
        const hit = document.elementFromPoint(lb.left + lb.width / 2, lb.top + lb.height / 2);
        const out = { sheetTop: Math.round(box.top), sheetB: Math.round(box.bottom), rowsT: Math.round(rb.top), rowsB: Math.round(rb.bottom), over, lastB: Math.round(lb.bottom), lastT: Math.round(lb.top), n: items.length, hitOk: !!hit && (last.contains(hit) || hit.contains(last)), sideways: sh.scrollWidth - sh.clientWidth, sh: root => 0 };
        rows.scrollTop = 0; out.firstT = Math.round(items[0].getBoundingClientRect().top); out.firstB = Math.round(items[0].getBoundingClientRect().bottom); return out; })()`);
      Object.assign(num, s, { limit });
      if (s.lastB > limit + 0.5) add('the last row ends at ' + s.lastB + ' when scrolled to the end: under the reserve line ' + limit);
      if (!s.hitOk) add('the last row is covered or clipped');
      if (s.over && s.rowsB < limit - 4) add('the rows stop at ' + s.rowsB + ', a blank band above the reserve line ' + limit);
      if (s.rowsB > limit + 0.5) add('the rows box reaches ' + s.rowsB + ', past the reserve line ' + limit);
      if (s.over && p.browser === 'safari' && p.os === 'ios' && p.w >= 393 && p.h >= 852) add('the sheet rows need scrolling on a tall iPhone (' + p.id + '): every row must show without scrolling');
      if (s.sideways > 0) add('the sheet scrolls sideways');
      if (s.sheetTop < p.sat) add('the sheet top ' + s.sheetTop + ' is under the status bar (' + p.sat + ')');
    }
    if (o.bar) {
      const s = await ev(`(() => { const bars = [...document.querySelectorAll('${o.bar}')].filter((e) => e.getBoundingClientRect().height > 0); const out = []; for (const b of bars) { for (const x of b.querySelectorAll('button, a.btn, .btn')) { const r = x.getBoundingClientRect(); if (r.height > 1 && getComputedStyle(x).visibility !== 'hidden') out.push({ b: Math.round(r.bottom), t: Math.round(r.top), n: (x.textContent || '').trim().slice(0, 20) }); } } return out; })()`);
      num.barBottoms = s.map((x) => x.b).join(',');
      if (!s.length && !o.optional) add('no buttons in the bar ' + o.bar);
      for (const x of s) {
        if (x.b > limit + 0.5) add('bar button "' + x.n + '" ends at ' + x.b + ', under the reserve line ' + limit);
        if (x.t < 0) add('bar button "' + x.n + '" is off the top');
      }
    }
    try { appendFileSync(join(SHOTS, 'devices-numbers.ndjson'), JSON.stringify(num) + '\n'); } catch (e) { /* ignore */ }
    await shotTo(p, id);
    if (o.sheet) { /* the menu's second screenshot is the scrolled end */ }
  }

  function make(name, pick) {
    scene('SB5 devices: ' + name, async () => {
      mkdirSync(SHOTS, { recursive: true });
      const defects = [];
      let n = 0;
      for (const p of PROFILES) {
        if (only && !only.test(p.id)) continue;
        for (const pg of PAGES.filter(pick)) {
          if (onlyPages && !onlyPages.test(pg[0])) continue;
          await runPage(p, pg, defects);
          n += 1;
        }
        step(p.id + ' done');
      }
      await reset();
      for (const d of defects) {
        console.log('  DEFECT ' + d.profile + ' ' + d.page + ': ' + d.what);
        try { appendFileSync(join(SHOTS, 'devices-defects.ndjson'), JSON.stringify({ scene: name, ...d }) + '\n'); } catch (e) { /* ignore */ }
      }
      console.log('  · ' + n + ' profile-page checks, ' + defects.length + ' defects');
      ok(!defects.length, defects.length + ' device defects (listed above)');
    });
  }
  // 23b: the bar changes size AFTER the page has loaded (Ron's phone kept the full-bar reserve of 8 when the bar shrank to the pill). The resize, visualViewport and scroll events are swallowed here,
  // so only device.js's own look every 400 ms can notice. Full bar (420x746, reserve 8) -> pill (420x845, reserve 79) -> full bar again; at each state the reserve is right and the last content
  // (the footer links of Today) scrolls to above the reserve line.
  scene('SB5 devices: Safari bar changes', async () => {
    mkdirSync(SHOTS, { recursive: true });
    const full = PROFILES.find((x) => x.id === 'iphone-air-bar'); const pill = PROFILES.find((x) => x.id === 'iphone-air-pill');
    const defects = [];
    const pages = [['child-today', childSeed(gameDayDoc, D2), D2, '#/', 'document.querySelector("[data-room=job]")', null], ['child-today-noweek', childSeed(() => W.emptyDoc(), D2), D2, '#/', 'document.querySelector("main section, main nav")', null]];
    for (const [id, seeder, day, hash, wait] of pages) {
      await openAs(full, day, hash, seeder);
      await until(wait, id, 9000); await sleep(400);
      await ev(`(() => { for (const t of [window, window.visualViewport]) for (const n of ['resize', 'scroll']) t.addEventListener(n, (e) => e.stopImmediatePropagation(), true); window.addEventListener('touchend', (e) => e.stopImmediatePropagation(), true); })()`);
      for (const [label, p] of [['pill', pill], ['full bar', full], ['pill', pill]]) {
        await apply(p);
        let got = '';
        for (let i = 0; i < 20; i++) { await sleep(150); got = await ev('document.documentElement.style.getPropertyValue("--bottom-reserve")'); if (parseInt(got, 10) === p.reserve) break; }
        if (parseInt(got, 10) !== p.reserve) defects.push(id + ' -> ' + label + ': --bottom-reserve is ' + got + ' 3 s after the bar changed, expected ' + p.reserve + 'px');
        await drawOverlay(p);
        const limit = p.h - p.reserve;
        const f = await ev(`(() => { const r = document.scrollingElement; r.scrollTo({ top: r.scrollHeight, behavior: 'instant' }); const out = [...document.querySelectorAll('.today__foot a, .foot a, main section *')].filter((e) => !e.children.length && e.getBoundingClientRect().height > 0).map((e) => Math.round(e.getBoundingClientRect().bottom)); return Math.max(0, ...out); })()`);
        await shotTo(p, id + '-end-' + label.replace(' ', '-'));
        await ev(`document.scrollingElement.scrollTo({ top: 0, behavior: 'instant' })`);
        if (f > limit + 0.5) defects.push(id + ' -> ' + label + ': the last content ends at ' + f + ' when scrolled to the end, under the reserve line ' + limit);
      }
    }
    await reset();
    for (const d of defects) console.log('  DEFECT ' + d);
    ok(!defects.length, defects.length + ' bar-change defects (listed above)');
  });
  make('child keyboard and tile pages', (pg) => /^child-(fix|practice|test|quiz|quick|flower|hello)/.test(pg[0]));
  make('child Today, games and Menu', (pg) => /^child-(today|game|menu)/.test(pg[0]));
  make('grown-up pages', (pg) => /^adult-/.test(pg[0]));
}
