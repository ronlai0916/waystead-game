// SB6 scenes of WP-5a: S-peek-everywhere (K1 to K5 and K7, one Peek on each screen, same place), S-flower-petals, S-sbs-meanings.
// Helpers: tools/smoke-sb6/helpers.mjs (S.openAs, S.seedNormalChild, S.seedSbsChild, S.measure, S.checks.*, S.forProfiles). Name every scene 'SB6 peek: <what>'.
import { readFileSync } from 'node:fs';
const WORDS = ['friend', 'island', 'guard', 'necessary', 'because', 'caught'];
const PROFILES = ['iphone-se', 'iphone-16', 'iphone-air-bar', 'ipad-landscape'];
const SEL = { peek: '[data-peekbtn]', boxes: '.spellbox, .blanks span, .tileboxes .lgap, .tileboxes .lshown', check: '[data-check]', hear: '[data-hear], [data-hearmain]' };

export default (H, S) => {
  const { ev, until, sleep, ok } = H;
  const q = JSON.stringify;
  const has = (sel) => ev(`!!document.querySelector(${q(sel)})`);
  const count = (sel) => ev(`document.querySelectorAll(${q(sel)}).length`);
  const txt = (sel) => ev(`(document.querySelector(${q(sel)}) || {}).textContent || ''`);
  const tap = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${q(sel)})].find((x) => !x.disabled); if (!e) return false; e.click(); return true; })()`);
  const key = (k) => ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: ${q(k)}, bubbles: true }))`);
  const tries = () => ev(`(async () => { const S = await import('./js/store.js'); return S.readWords().results; })()`);
  const route = (game) => '#/words/g/g1/game/' + game;

  async function open(p, style, { year = 4, hash, wait, sbs = false }) {
    await S.openAs(p, { night: style === 'night', hash, wait: wait || "!!document.querySelector('[data-peekbtn]')",
      seed: () => (sbs ? S.seedSbsChild({ year, words: WORDS }) : S.seedNormalChild({ year, words: WORDS })) });
    await sleep(150);
  }
  /** One screen: exactly one Peek, 48 x 48 or more, in view above the reserve line, below the boxes; then a tap shows the word, and it goes. */
  async function screen(p, style, name, defects, { tapIt = true, beside = false } = {}) {
    const n = await count('[data-peekbtn]');
    if (n !== 1) defects.push(p.id + ' ' + style + ' ' + name + ': ' + n + ' Peek buttons');
    const m = await S.measure(SEL);
    const pk = (m.peek || [])[0];
    if (!pk) { defects.push(p.id + ' ' + style + ' ' + name + ': no Peek measured'); return; }
    if (pk.w < 47.5 || pk.h < 47.5) defects.push(p.id + ' ' + style + ' ' + name + ': Peek is ' + pk.w + ' x ' + pk.h);
    if (pk.b > p.h - p.reserve + 1) defects.push(p.id + ' ' + style + ' ' + name + ': Peek bottom ' + pk.b + ' is under the reserve line ' + (p.h - p.reserve));
    const lastBox = (m.boxes || []).reduce((a, b) => Math.max(a, b.b), 0);
    if (!beside && lastBox && pk.t < lastBox - 4) defects.push(p.id + ' ' + style + ' ' + name + ': Peek (' + pk.t + ') is above the boxes (' + lastBox + ')');
    if (m.sideways > 1 && p.w >= 375) defects.push(p.id + ' ' + style + ' ' + name + ': sideways scroll ' + m.sideways);
    S.numbers({ scene: 'peek', screen: name, profile: p.id, style, peekTop: pk.t, peekBottom: pk.b, boxesBottom: lastBox, scrollPx: m.scrollPx });
    await S.shotAs(p, 'peek-' + name, style);
    if (tapIt && p.w >= 375) {
      await tap('[data-peekbtn]');
      await sleep(120);
      if (!(await ev(`document.querySelector('[data-peekbtn]').disabled`))) defects.push(p.id + ' ' + style + ' ' + name + ': Peek is not disabled while it shows');
      await S.shotAs(p, 'peek-' + name + '-showing', style);
      await until(`!document.querySelector('[data-peekbtn]') || !document.querySelector('[data-peekbtn]').disabled || document.querySelector('[data-next]')`, name + ' Peek ends', 7000);
    }
  }

  H.scene('SB6 peek: one Peek on every spelling game, same place, in view (garden and Night)', async () => {
    const defects = [];
    await S.forProfiles(async (p, style) => {
      await open(p, style, { year: 4, hash: route('missing') });
      await screen(p, style, 'k2-missing-keys', defects);
      await open(p, style, { year: 4, hash: route('unjumble') });
      await screen(p, style, 'k3-unjumble', defects);
      await open(p, style, { year: 4, hash: route('quick') });
      await screen(p, style, 'k4-quick-keys', defects);
      await open(p, style, { year: 6, hash: route('fill') });
      await screen(p, style, 'k5-fill-spelled', defects);
      await open(p, style, { year: 2, hash: route('missing') });
      await screen(p, style, 'k2-missing-tiles', defects);
      await open(p, style, { year: 4, hash: '#/words/g/g1/study/hello', wait: "!!document.querySelector('[data-play]')" });
      await tap('[data-play]');
      await until("!!document.querySelector('.blanks') && !!document.querySelector('[data-peekbtn]')", 'the flower game', 9000);
      await screen(p, style, 'k1-flower', defects, { beside: true }); // the flower's Peek sits beside Hear (the keyboard does not move)
    }, { ids: PROFILES });
    S.report(defects);
  });

  // P2c SF4: with the Peek rows added, the keys or tiles and Check still sit above the bottom reserve, the page scrolls no more than in 23b, and "Hear the word" in the half-width Hear / Peek row does not wrap (or wraps cleanly with nothing under the reserve).
  const PHONES = ['iphone-se1', 'iphone-se', 'iphone-14', 'iphone-16', 'iphone-air-bar', 'iphone-air-pill', 'android-360x800'];
  const baseline = JSON.parse(readFileSync(new URL('./baseline-23b.json', import.meta.url), 'utf8')).pages;
  const fit = () => ev(`(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') && e.id !== '__ov'; };
    const low = (sel) => Math.max(0, ...[...document.querySelectorAll(sel)].filter(vis).map((e) => Math.round(e.getBoundingClientRect().bottom)));
    const hear = [...document.querySelectorAll('[data-hearmain], [data-hear]')].filter(vis)[0];
    let lines = 0, hearW = 0;
    if (hear) {
      hearW = Math.round(hear.getBoundingClientRect().width);
      const tops = new Set();
      const walk = document.createTreeWalker(hear, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) { if (!n.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(n); for (const c of r.getClientRects()) tops.add(Math.round(c.top)); }
      lines = tops.size;
    }
    const root = document.scrollingElement;
    return { ih: innerHeight, keys: low('.key, .ltile, .tray [data-tile]'), check: low('[data-check]'), hear: low('[data-hearmain], [data-hear]'), lines, hearW, scrollPx: Math.max(0, root.scrollHeight - innerHeight), sideways: Math.max(0, root.scrollWidth - root.clientWidth) };
  })()`);
  async function fitPage(p, style, name, base, defects) {
    await sleep(250);
    const m = await fit();
    const line = p.h - p.reserve;
    const was = baseline[p.id + ' ' + style + ' ' + base];
    const allowed = was ? was.scrollPx + (was.scrollPx && name.endsWith('tiles') ? 12 : 0) : 0; // 23b measured the keys page; the tile page of a short phone is a little taller (the tray)
    const tag = p.id + ' ' + style + ' ' + name + ': ';
    if (m.scrollPx > allowed + 1) defects.push(tag + 'the page scrolls ' + m.scrollPx + ' px (23b: ' + allowed + ')');
    if (!allowed && p.w >= 360) { // a 320 px phone (iphone-se1) may scroll, as in 23b: only the page's growth and the wrap are checked there
      if (m.keys > line + 1) defects.push(tag + 'the keys or tiles end at ' + m.keys + ', under the reserve line ' + line);
      if (m.check > line + 1) defects.push(tag + 'Check ends at ' + m.check + ', under the reserve line ' + line);
      if (m.hear > line + 1) defects.push(tag + 'Hear ends at ' + m.hear + ', under the reserve line ' + line);
    }
    if (m.lines > 1 && (m.scrollPx > allowed + 1 || m.keys > line + 1 || m.check > line + 1)) defects.push(tag + '"Hear the word" wraps to ' + m.lines + ' lines (' + m.hearW + ' px wide) and pushes the page');
    if (m.sideways > 1 && p.w >= 375) defects.push(tag + 'sideways scroll ' + m.sideways);
    S.numbers({ scene: 'peek-fit', screen: name, profile: p.id, style, keysBottom: m.keys, checkBottom: m.check, line, hearLines: m.lines, hearW: m.hearW, scrollPx: m.scrollPx, allowed });
  }
  H.scene('SB6 peek: keys, tiles and Check stay above the reserve; Hear the word does not wrap (flower and four games)', async () => {
    const defects = [];
    await S.forProfiles(async (p, style) => {
      for (const year of [4, 2]) {
        await open(p, style, { year, hash: '#/words/g/g1/study/hello', wait: "!!document.querySelector('[data-play]')" });
        await tap('[data-play]');
        await until("!!document.querySelector('.blanks') && !!document.querySelector('[data-peekbtn]')", 'the flower game', 9000);
        await fitPage(p, style, 'flower-' + (year === 4 ? 'keys' : 'tiles'), 'flower', defects);
      }
      const pages = [['missing', 4, 'game-missing'], ['missing', 2, 'game-missing'], ['unjumble', 4, 'game-unjumble'], ['unjumble', 2, 'game-unjumble'], ['quick', 4, 'quick-fire'], ['fill', 6, 'game-fill']];
      for (const [g, year, base] of pages) {
        await open(p, style, { year, hash: route(g) });
        await fitPage(p, style, g + '-' + (year < 5 ? (year === 2 ? 'tiles' : 'keys') : 'keys'), base, defects);
      }
    }, { ids: PHONES });
    S.report(defects);
  });

  H.scene('SB6 peek: Missing letters: a Peek is written on the try, never clean, the word comes back', async () => {
    const p = S.profile('iphone-16');
    await open(p, 'garden', { year: 4, hash: route('missing') });
    await until("!!document.querySelector('.spellbox')", 'the boxes', 6000);
    const before = await tries();
    await tap('[data-peekbtn]');
    await sleep(150);
    ok(await ev(`[...document.querySelectorAll('.spellbox')].every((b) => b.textContent.length === 1)`), 'the whole word shows in the boxes');
    const word = await ev(`[...document.querySelectorAll('.spellbox')].map((b) => b.textContent).join('')`);
    ok(await ev(`document.querySelectorAll('.spellbox.is-peeked').length`) >= 1, 'the missing letters are lighter (is-peeked)');
    await key('x');
    ok(await ev(`[...document.querySelectorAll('.spellbox')].filter((b) => b.dataset.gap !== undefined && !b.classList.contains('is-peeked')).length === 0`), 'a key during the Peek does nothing');
    await until(`!document.querySelector('[data-peekbtn]').disabled`, 'the Peek ends', 5000);
    ok(await ev(`[...document.querySelectorAll('.spellbox[data-gap]')].every((b) => b.textContent === '')`), 'the gaps are empty again');
    const gaps = await ev(`[...document.querySelectorAll('.spellbox[data-gap]')].map((b) => Number(b.getAttribute('data-gap')) )`);
    const at = await ev(`[...document.querySelectorAll('.spellbox')].map((b, i) => b.hasAttribute('data-gap') ? i : -1).filter((i) => i >= 0)`);
    for (const i of at) await key(word[i]);
    await sleep(300);
    const after = await tries();
    const t = after.slice(before.length).filter((r) => r.s === 'g').pop();
    ok(t && t.p === 1 && t.c === 0, 'the try has p 1 and is not clean: ' + JSON.stringify(t));
    ok((await txt('[data-line]')).length > 0 && await has('[data-peekbtn]'), 'the word comes back once more (' + (await txt('[data-line]')) + ')');
    ok(await ev(`[...document.querySelectorAll('.spellbox[data-gap]')].every((b) => b.textContent === '')`), 'with empty boxes');
  });

  H.scene('SB6 peek: Quick-fire: the time bar stops while the word shows and starts again full', async () => {
    const p = S.profile('iphone-16');
    await open(p, 'garden', { year: 4, hash: route('quick') });
    await until("!!document.querySelector('[data-bar]')", 'the bar', 6000);
    await sleep(1500);
    const w0 = await ev(`document.querySelector('[data-bar]').getBoundingClientRect().width / document.querySelector('.gentlebar').getBoundingClientRect().width`);
    ok(w0 < 0.97, 'the bar has shrunk before the Peek (' + w0.toFixed(2) + ')');
    await tap('[data-peekbtn]');
    await sleep(300);
    const a = await ev(`document.querySelector('[data-bar]').getBoundingClientRect().width`);
    await sleep(700);
    const b = await ev(`document.querySelector('[data-bar]').getBoundingClientRect().width`);
    ok(Math.abs(a - b) < 1.5, 'the bar stands still while the word shows (' + a + ' / ' + b + ')');
    ok((await txt('[data-answer]')).length > 1, 'the word shows on the answer line');
    await until(`!document.querySelector('[data-peekbtn]').disabled`, 'the Peek ends', 5000);
    await sleep(150);
    const w1 = await ev(`document.querySelector('[data-bar]').getBoundingClientRect().width / document.querySelector('.gentlebar').getBoundingClientRect().width`);
    ok(w1 > 0.9, 'the bar starts again from full (' + w1.toFixed(2) + ')');
  });

  H.scene('SB6 peek: the flower game: a Peek ends the round "with a peek" and no petal falls', async () => {
    const p = S.profile('iphone-16');
    for (const year of [4, 2]) {
      await open(p, 'garden', { year, hash: '#/words/g/g1/study/hello', wait: "!!document.querySelector('[data-play]')" });
      await tap('[data-play]');
      await until("!!document.querySelector('.blanks') && !!document.querySelector('[data-peekbtn]')", 'the flower game', 9000);
      const petals = await count('.flower .petal');
      await tap('[data-peekbtn]');
      await sleep(200);
      ok(await ev(`[...document.querySelectorAll('.blanks span')].every((s) => s.textContent.trim().length === 1)`), 'year ' + year + ': the word shows in the blanks');
      await until("!!document.querySelector('[data-next]')", 'the round ends', 7000);
      ok((await txt('.result h2')) === 'With a peek', 'the card says "With a peek": ' + (await txt('.result h2')));
      ok(await count('.flower .petal.fallen') === 0 && (await count('.flower .petal')) === petals, 'no petal fell');
    }
  });

  H.scene('SB6 peek: Step by step Meanings: three cards, tap only, the Peek on spelled Fill (Year 6)', async () => {
    const p = S.profile('iphone-16');
    await open(p, 'garden', { year: 3, sbs: true, hash: route('match'), wait: "!!document.querySelector('[data-word]')" });
    ok(await count('[data-word]') === 3 && await count('[data-meaning]') === 3, 'Meaning match has 3 cards and 3 meanings');
    ok(!(await has('[data-peekbtn]')), 'no Peek on Meaning match');
    await open(p, 'garden', { year: 3, sbs: true, hash: route('fill'), wait: "!!document.querySelector('[data-card]')" });
    ok(await count('[data-card]') === 3, 'Fill in the blanks: pick from 3');
    ok(!(await has('[data-peekbtn]')), 'no Peek on a pick');
    await open(p, 'garden', { year: 3, sbs: true, hash: route('mix'), wait: "!!document.querySelector('[data-slot-i]')" });
    ok(await count('[data-slot-i]') <= 3, 'Mix and match: boards of 3 (' + (await count('[data-slot-i]')) + ')');
    ok(await count('[data-card]') <= 3, 'with 3 cards and no spare');
    await open(p, 'garden', { year: 6, sbs: true, hash: route('fill'), wait: "!!document.querySelector('[data-check]')" });
    ok(await count('[data-peekbtn]') === 1, 'Fill spelled (Year 6) has one Peek');
    await open(p, 'garden', { year: 3, sbs: true, hash: route('quick'), wait: "!!document.querySelector('main')" });
    await sleep(400);
    ok(!(await has('[data-bar]')), 'Quick-fire is never offered in Step by step');
  });
};
