// SB5 S1 (round 4): child-side defects in a real browser. Run:  CHROME_PATH=... node tools/sb2-smoke.mjs <dir> 'SB5 S1*'
export default function (H) {
  const { scene, go, click, ev, ok, until, sleep, send, kbSeed, shot, seedChild, open, weekDoc, MON, plus, gameDayDoc } = H;
  const SIZES = [[390, 844], [375, 667], [360, 640]];
  const phone = async (w, h, z = false) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true });
    await ev(`document.documentElement.style.fontSize = ${z ? "'130%'" : "''"}`);
    await sleep(150);
  };
  /** Scroll to the end; the last control's bottom must be 110 px above the viewport bottom. */
  const endClear = async (sel) => ev(`(() => { window.scrollTo(0, 1e6); const l = [...document.querySelectorAll(${JSON.stringify(sel)})].map((e) => e.getBoundingClientRect().bottom); return { ih: innerHeight, last: Math.round(Math.max(...l)) }; })()`);

  // S1_DUMP='[["child","test",375,527,false]]': print the boxes of a keyboard page at a size, and a picture
  if (process.env.S1_DUMP) scene('SB5 S1 dump', async () => {
    for (const [role, page, w, h, z] of JSON.parse(process.env.S1_DUMP)) {
      await kbSeed(role, page);
      await phone(w, h, z);
      await ev('window.scrollTo(0,0)');
      const rows = await ev(`(() => { const out = []; const walk = (e, d) => { if (d > 4) return; for (const c of e.children) { const r = c.getBoundingClientRect(); const cs = getComputedStyle(c); if (!r.height || cs.display === 'none') continue; out.push('  '.repeat(d) + c.tagName.toLowerCase() + (c.className && typeof c.className === 'string' ? '.' + c.className.trim().split(/\\s+/).join('.') : '') + ' top ' + Math.round(r.top) + ' h ' + Math.round(r.height) + ' w ' + Math.round(r.width) + ' pos ' + cs.position); if (!c.classList.contains('keyboard-row') && !c.matches('svg,button,a,span,p,h1,h2,label')) walk(c, d + 1); } }; out.push('ih ' + innerHeight + ' ph ' + document.documentElement.scrollHeight); walk(document.body, 0); return out; })()`);
      console.log('--- ' + role + ' ' + page + ' ' + w + 'x' + h + (z ? ' Z' : '')); rows.forEach((r) => console.log(r));
      console.log('  controls: ' + JSON.stringify(await ev(`[...document.querySelectorAll('[data-fold],[data-hear],[data-check],[data-next],[data-skip],[data-peekbtn],[data-go]')].map((e) => { const r = e.getBoundingClientRect(); return [e.dataset.fold || Object.keys(e.dataset).join(','), Math.round(r.width), Math.round(r.height), e.scrollHeight, e.scrollWidth, e.clientWidth, e.textContent.trim().slice(0, 24)]; })`)));
      await shot('s1-dump-' + role + '-' + page + '-' + w + 'x' + h + (z ? 'Z' : ''));
    }
  });
  if (process.env.S1_EVAL) scene('SB5 S1 eval', async () => {
    if (process.env.S1_KB) { await kbSeed('child', process.env.S1_KB); } else await seedChild(process.env.S1_NOWEEK ? (await import('../../site/js/words-doc.js')).emptyDoc() : gameDayDoc(), plus(2));
    if (!process.env.S1_KB) await open(plus(2), process.env.S1_HASH || '#/');
    if (process.env.S1_VP) { const [w, h, z] = process.env.S1_VP.split(','); await phone(Number(w), Number(h), z === 'z'); }
    await sleep(500);
    console.log(JSON.stringify(await ev(process.env.S1_EVAL), null, 1));
  });
  scene('SB5 S1 child with no week: Today draws, footer clears the band at the end', async () => {
    await seedChild(H.weekDoc ? (await import('../../site/js/words-doc.js')).emptyDoc() : {}, MON);
    await open(MON, '#/');
    await until('document.querySelector("[data-room]")', 'Today for a child with no week');
    ok(await ev('document.querySelector("[data-room]").dataset.room') === 'none', 'status none');
    ok(/grown-up sets your weeks/i.test(await ev('document.querySelector("main").textContent')), 'says the grown-up will set the week');
    for (const [w, h, z] of [...SIZES.map(([a, b]) => [a, b, false]), [360, 640, true]]) {
      await phone(w, h, z);
      const e = await endClear('[data-todayfoot] a');
      ok(e.last <= e.ih - 110, 'no week: footer ends above the band at ' + w + 'x' + h + (z ? '+Z' : '') + ' (bottom ' + e.last + ', limit ' + (e.ih - 110) + ')');
    }
    await shot('s1-today-none');
  });
  scene('SB5 S1 child Today: footer ends above the 110 px band at the end of the page', async () => {
    await seedChild(gameDayDoc(), plus(2));
    await open(plus(2), '#/');
    await until('document.querySelector("[data-todayfoot]")', 'the footer links');
    for (const [w, h] of SIZES) {
      await phone(w, h);
      const e = await endClear('[data-todayfoot] a');
      ok(e.last <= e.ih - 110, 'Today with a week: footer ends above the band at ' + w + 'x' + h + ' (bottom ' + e.last + ', limit ' + (e.ih - 110) + ')');
    }
  });
  scene('SB5 S1 inline back links are 44 px high or more', async () => {
    await seedChild(gameDayDoc(), plus(2));
    for (const hash of ['#/tricky', '#/chapters', '#/about', '#/settings', '#/look']) {
      await open(plus(2), hash);
      await until('document.querySelector("main section")', hash);
      for (const [w, h] of SIZES) {
        await phone(w, h);
        const hs = await ev('[...document.querySelectorAll("main a[data-backlink], main .backlink")].map((e) => Math.round(e.getBoundingClientRect().height))');
        ok(hs.length >= 1 && hs.every((x) => x >= 44), hash + ' back link at ' + w + 'x' + h + ': ' + JSON.stringify(hs));
      }
    }
  });
  // Mix and match: at each phone size (visible height = the screen minus the browser bars) the sentences start above the bar, the bar's buttons are in view.
  const mixBoxes = () => ev(`(() => { const r = (e) => { const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom) }; };
    const bar = document.querySelector('.mixbar'); const slots = [...document.querySelectorAll('[data-slot-i]')].map(r);
    const acts = [...document.querySelectorAll('.mixbar .btn')].map(r);
    return { ih: innerHeight, bar: bar ? r(bar) : null, slots, acts, sw: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()`);
  scene('SB5 S1 Mix and match: the bar never covers the first sentences, and its buttons are in view', async () => {
    await seedChild(gameDayDoc(), plus(2));
    await open(plus(2), '#/');
    await go('#/words/g/g1/game/mix');
    await until('document.querySelector("[data-slot-i]") && document.querySelector("[data-card]")', 'Mix and match board', 8000);
    for (const [w, h, z] of [[360, 640, true], [360, 640, false], [375, 667, false], [375, 667, true], [390, 844, false], [360, 530, false], [375, 527, false]]) {
      await phone(w, h, z);
      await ev('window.scrollTo(0, 0)');
      const m = await mixBoxes();
      console.log('  · mix ' + w + 'x' + h + (z ? '+Z' : '') + ' ' + JSON.stringify(m));
      ok(m.sw <= 0, 'no sideways scroll');
      // the first sentence ends above the bar (the bar sits at the foot; the board starts above it)
      const first = m.slots.slice(0, 1);
      ok(first.every((sl) => sl.b <= m.bar.t + 1), 'the first sentence ends above the bar at ' + w + 'x' + h + (z ? '+Z' : '') + ': ' + JSON.stringify(first) + ' bar ' + JSON.stringify(m.bar));
      ok(m.bar.b <= m.ih - 110 + 1, 'the bar ends above the 110 px band at ' + w + 'x' + h + (z ? '+Z' : '') + ': ' + m.bar.b);
      ok(m.acts.every((a) => a.b <= m.ih - 8), 'the bar buttons are in view at ' + w + 'x' + h + (z ? '+Z' : '') + ': ' + JSON.stringify(m.acts));
    }
  });
}
