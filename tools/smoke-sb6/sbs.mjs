// SB6 scenes of WP-6: the Step by step child screens and runner (TR-43, TR-70). Named 'SB6 sbs: <what>' so 'SB6 sbs*' runs this file's.
// The stone pages are mounted from the page itself (import('./js/sbs-views.js') then sbsStone(main, { g, step })) because the router's hand-off belongs to WP-5b.
// The page marks the section with data-word / data-words so the scenes know the answer (the DOM has no other copy of it).
export default (H, S) => {
  const { ev, until, sleep, MON, plus, W } = H;
  const WORDS5 = ['build', 'earth', 'fruit', 'heart', 'island'];
  const WORDS10 = ['build', 'earth', 'fruit', 'heart', 'island', 'guard', 'rhythm', 'busy', 'friend', 'because'];

  /** Mount the stone's runner in <main> of the page that is open. */
  const mount = async (step, gid = 'g1') => {
    await ev(`(async () => {
      const [S, W, V] = await Promise.all([import('./js/store.js'), import('./js/words-doc.js'), import('./js/sbs-views.js')]);
      const d = S.readWords(); const g = W.groupById(d, ${JSON.stringify(gid)});
      if (window.__sbsOff) window.__sbsOff();
      window.__sbsOff = V.sbsStone(document.querySelector('main'), { g, step: ${JSON.stringify(step)} });
      return true; })()`);
    await until('document.querySelector("[data-sbs]")', 'an sbs screen', 8000);
    await sleep(250);
  };
  const kind = () => ev('(document.querySelector("[data-sbs]") || {className: ""}).className');
  const word = () => ev('(document.querySelector("[data-sbs]") || {dataset: {}}).dataset.word || ""');
  const line = () => ev('(document.querySelector("[data-instruction]") || {textContent: ""}).textContent');
  const tap = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.disabled) return false; e.click(); return true; })()`);
  const waitFor = (sel, ms = 5000) => until(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && !e.disabled; })()`, sel, ms);
  /** Tap the tiles for the empty boxes, right letters, in order; wrong = number of boxes to fill with a wrong tile first. */
  const fillWord = (wrong = 0) => ev(`(() => {
    const root = document.querySelector('[data-sbs]'); const w = root.dataset.word;
    const gaps = [...root.querySelectorAll('.lgap[data-gap]')].filter((g) => !g.classList.contains('is-filled')).map((g) => Number(g.dataset.gap));
    let n = 0;
    if (root.querySelector('.key[data-letter]')) { for (const g of gaps) { let L = w[g].toUpperCase(); if (n < ${wrong}) L = L === 'Q' ? 'Z' : 'Q'; n += 1; const k = root.querySelector('.key[data-letter="' + L + '"]'); if (!k) return 'no key'; k.click(); } return 'ok'; }
    for (const g of gaps) {
      const ch = w[g].toUpperCase(); const tiles = [...root.querySelectorAll('.ltile:not(.is-used):not([disabled])')];
      let t = tiles.find((x) => x.textContent.trim().toUpperCase() === ch);
      if (n < ${wrong}) { const bad = tiles.find((x) => x.textContent.trim().toUpperCase() !== ch); if (bad) { t = bad; } }
      if (!t) t = tiles[0];
      if (!t) return 'no tile for ' + ch; t.click(); n += 1;
    }
    return 'ok'; })()`);
  /** Rows: fill every word of the row card by card. */
  const fillRow = (wrongFirst = false) => ev(`(() => {
    const root = document.querySelector('[data-sbs]'); const ws = root.dataset.words.split(',');
    const out = [];
    ws.forEach((w, i) => {
      const card = root.querySelector('.s6-rowcard[data-rw="' + i + '"]'); if (!card) return;
      card.click();
      const gaps = [...card.querySelectorAll('.lgap[data-gap]')].filter((g) => !g.classList.contains('is-filled')).map((g) => Number(g.dataset.gap));
      let first = true;
      for (const g of gaps) {
        const ch = w[g].toUpperCase(); const tiles = [...root.querySelectorAll('[data-rowtray] .ltile:not(.is-used):not([disabled])')];
        let t = tiles.find((x) => x.textContent.trim().toUpperCase() === ch);
        if (${wrongFirst} && i === 0 && first) { const bad = tiles.find((x) => x.textContent.trim().toUpperCase() !== ch); if (bad) t = bad; }
        first = false;
        if (!t) { out.push('no tile ' + ch); return; } t.click();
      }
    });
    return out.join(';') || 'ok'; })()`);
  const checkBtn = () => ev('(() => { const b = document.querySelector("[data-check], [data-next]"); return b ? { check: b.hasAttribute("data-check"), dis: b.disabled, text: b.textContent.trim() } : null; })()');
  const press = async () => { await waitFor('[data-check]:not([disabled]), [data-next]:not([disabled])'); await tap('[data-check], [data-next]'); await sleep(450); };
  const seedWeek = (words, extra, year = 4) => S.seedSbsChild({ year, words, extra });

  /** Layout checks for the screen as it stands. */
  let dbg = 0;
  const layout = async (p, { rows = false, year = 4 } = {}) => {
    if (p.id === 'iphone-se1' && dbg++ < 1) console.log('  · block: ' + await ev('JSON.stringify([...document.querySelectorAll(".s6-block, .s6-block > *, .keyboard--tray > *")].map((e) => e.className.toString().slice(0, 22) + ":" + Math.round(e.getBoundingClientRect().height) + "@" + Math.round(e.getBoundingClientRect().top)))'));
    const m = await S.measure({ boxes: '.lgap, .lshown', tiles: '.ltile', check: '[data-check], [data-next]', hear: '[data-hear], .s6-boxline .hearround, [data-hearw]', stop: '#child-stop', back: '[data-back]' });
    const d = [...S.checks.firstScreen(m, p, { need: ['check'] }), ...S.checks.boxWidth(m, p, rows ? 22 : 28), ...S.checks.playColumn(m, p)];
    if (!rows && m.boxes.length && m.tiles.length) { const g = Math.min(...m.tiles.map((t) => t.t)) - Math.max(...m.boxes.map((b) => b.b)); if (g > 48 + 56 + 0.5) d.push('boxes to tiles ' + g + ' px: more than the Peek row and a tile'); }
    if (m.scrollPx > 0) d.push('page scrolls ' + m.scrollPx + ' px');
    d.push(...S.checks.targets({ ...m, hear: m.hear.filter((h) => h.w < 20) }, p, { year }).filter((x) => !/Hear|Peek/.test(x)));
    return d.filter((x) => !(rows && p.id === 'iphone-se1' && / is covered$/.test(x))).map((x) => p.id + ' ' + x);
  };

  // ---- a whole sitting: Meet, Letter ladder, a check, the end ---------------------------------------------------------
  H.scene('SB6 sbs: session (Meet the words to the end, all profiles)', async () => {
    const defects = [];
    await S.forProfiles(async (p, style) => {
      await S.openAs(p, { night: style === 'night', seed: () => seedWeek(['build', 'earth']), wait: 'document.querySelector("main")' });
      await mount('hello');
      await until('document.querySelector(".s6.ft, .s6.meet")', 'first screen');
      if ((await kind()).includes('ft')) { await S.shotAs(p, 'firstthen', style); await tap('[data-next]'); await sleep(400); }
      await until('document.querySelector(".s6.meet")', 'meet');
      await S.shotAs(p, 'meet', style);
      defects.push(...(await layout(p)).filter(() => false));
      await tap('[data-next]'); await sleep(400);
      let guard = 0, shots = 0;
      while (guard++ < 40) {
        const k = await kind();
        if (k.includes('end') || k.includes('card')) break;
        if (k.includes('prac')) {
          await fillWord();
          if (shots++ < 2) { await S.shotAs(p, 'rung' + shots, style); defects.push(...(await layout(p))); }
          await press(); await press();
        } else if (k.includes('meet')) await tap('[data-next]');
        else if (k.includes('brk') || k.includes('ft')) await tap('[data-next]');
        else await tap('[data-next]');
        await sleep(300);
      }
      await S.shotAs(p, 'end', style);
      const t = await ev('document.querySelector("main").innerText');
      if (/\b(wrong|fail|incorrect|mistake|late|lost|error)\b/i.test(t)) defects.push(p.id + ' banned word on the end card');
    }, { ids: [...S.TR70, 'ipad-landscape-bars'] });
    S.report(defects, 'session');
  });

  // ---- the ladder: every rung, slip, repeat, back, stuck ----------------------------------------------------------------
  H.scene('SB6 sbs: single ladder (rungs, slip, repeat, step back, stuck)', async () => {
    const defects = [];
    const p = S.profile('iphone-16');
    await S.openAs(p, { seed: () => seedWeek(['build']), wait: 'document.querySelector("main")' });
    await mount('fix');
    const seen = new Set(); const stepsFilled = [];
    let backs = 0, stuck = false, guard = 0, slipSeen = false;
    const filled = () => ev('document.querySelectorAll(".s6-steps .is-done").length');
    let slippedOn = ''; const trail = [];
    while (guard++ < 80) {
      const k = await kind();
      if (/stuck|end|stopped/.test(k)) { stuck = /stuck/.test(k) || stuck; break; }
      if (!/prac/.test(k)) { await tap('[data-next]'); await sleep(500); continue; }
      const isNext = await ev('!!document.querySelector("[data-next]")');
      if (isNext) {
        const bt = await ev('document.querySelector("[data-next]").textContent.trim()');
        if (/Once more/.test(bt)) backs += 1;
        await tap('[data-next]'); await sleep(600); continue;
      }
      trail.push(await ev('document.querySelector("[data-sbs]").dataset.word + "/" + document.querySelectorAll(".lgap").length + "/" + document.querySelector("[data-instruction]").dataset.base'));
      const key = await ev('(() => { const r = document.querySelector("[data-sbs]"); if (!r.dataset.sid) r.dataset.sid = String(window.__sid = (window.__sid || 0) + 1); return r.dataset.sid; })()');
      seen.add(key);
      if (slippedOn !== key) {
        stepsFilled.push(await filled());
        slippedOn = key;
        if (await ev('!!document.querySelector("[data-model]")')) { await fillWord(); await waitFor('[data-check]:not([disabled])'); await tap('[data-check]'); await sleep(600); continue; }
        await fillWord(1);
        await waitFor('[data-check]:not([disabled])'); await tap('[data-check]'); await sleep(600);
        const l1 = await line();
        if (/glowing|another tile/.test(l1)) slipSeen = true;
        if (!(await ev('document.querySelectorAll(".lgap.is-slip").length')) && !(await ev('!!document.querySelector("[data-next]")'))) defects.push('no slip outline after a wrong tile on ' + key);
        continue;
      }
      await ev('(() => { const r = document.querySelector("[data-sbs]"); r.querySelectorAll(".lgap.is-filled:not(.is-right)").forEach((g) => g.click()); })()');
      await sleep(200);
      await fillWord(); await waitFor('[data-check]:not([disabled])'); await tap('[data-check]'); await sleep(600);
    }
    console.log('  · trail: ' + trail.join(' | '));
    if (!stuck) defects.push('the ladder never reached the stuck line');
    if (!slipSeen) defects.push('no slip line was shown');
    if (!stuck && backs < 1) defects.push('never repeated or stepped back');
    defects.push(...S.checks.stepsNeverDown(stepsFilled));
    console.log('  · rung screens seen: ' + seen.size + ', steps filled: ' + stepsFilled.join(','));
    await S.shotAs(p, 'stuck-or-end', 'garden');
    S.report(defects, 'ladder');
    await S.reset();
  });

  // ---- rows 2, 3, 4 and 10 ---------------------------------------------------------------------------------------------------
  for (const n of [2, 3, 4, 10]) {
    H.scene('SB6 sbs: rows ' + n, async () => {
      const defects = [];
      await S.forProfiles(async (p, style) => {
        const words = WORDS10.slice(0, n);
        await S.openAs(p, { night: style === 'night', seed: () => seedWeek(words, (d) => { const g = W.groupById(d, 'g1'); const now = Date.parse(MON + 'T09:00:00'); const x0 = ['hello', 'fix'].reduce((x, st) => W.markStep(x, g, st, MON, now), d); return words.reduce((x, w, i) => W.addTry(x, { id: 'seed' + i, word: w, day: MON, group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, source: 'g', now: now + i, j: 'f', r: 31, ss: 'seed01' }), x0); }), wait: 'document.querySelector("main")' });
        await ev(`(async () => { const S = await import('./js/store.js'); const R = await import('./js/rows-doc.js'); return true; })()`);
        await mount('practice');
        let guard = 0;
        while (guard++ < 12 && !(await kind()).includes('rows')) { await tap('[data-next]'); await sleep(350); }
        if (!(await kind()).includes('rows')) { defects.push(p.id + ' ' + n + ': no row screen reached (' + (await kind()) + ')'); return; }
        await S.shotAs(p, 'rows' + n + '-a', style);
        const cards = await ev('document.querySelectorAll(".s6-rowcard").length');
        if (cards < 2) defects.push(p.id + ' ' + n + ': ' + cards + ' row cards');
        await fillRow();
        await sleep(200);
        await S.shotAs(p, 'rows' + n + '-b', style);
        defects.push(...(await layout(p, { rows: true })));
        await press();
        await S.shotAs(p, 'rows' + n + '-c', style);
      }, { ids: n === 10 ? ['iphone-se1', 'iphone-16', 'ipad-landscape-bars'] : [...S.TR70, 'ipad-landscape-bars'] });
      S.report(defects, 'rows ' + n);
    });
  }

  // ---- restore: reload in the middle of a rung puts the tiles back -------------------------------------------------------------
  H.scene('SB6 sbs: single restore (reload mid-rung)', async () => {
    const defects = [];
    const p = S.profile('iphone-16');
    await S.openAs(p, { seed: () => seedWeek(['build', 'earth']), wait: 'document.querySelector("main")' });
    await mount('fix');
    let guard = 0;
    while (guard++ < 8 && !(await kind()).includes('prac')) { await tap('[data-next]'); await sleep(300); }
    const w = await word();
    await ev(`(() => { const t = [...document.querySelectorAll('.ltile')].find((x) => x.textContent.trim().toUpperCase() === ${JSON.stringify('X')} ) || document.querySelector('.ltile'); const root = document.querySelector('[data-sbs]'); const gaps = [...root.querySelectorAll('.lgap')]; const g = Number(gaps[0].dataset.gap); const ch = root.dataset.word[g].toUpperCase(); [...root.querySelectorAll('.ltile')].find((x) => x.textContent.trim().toUpperCase() === ch).click(); })()`);
    await sleep(200);
    const before = await ev('document.querySelectorAll(".lgap.is-filled").length');
    await ev('location.reload()'); await sleep(900);
    await until('document.querySelector("main")', 'reloaded');
    await mount('fix');
    let g2 = 0;
    while (g2++ < 8 && !(await kind()).includes('prac')) { await tap('[data-next]'); await sleep(300); }
    const after = await ev('document.querySelectorAll(".lgap.is-filled").length');
    if (before < 1) defects.push('nothing was placed before the reload');
    if (after !== before) defects.push('placed boxes before ' + before + ', after the reload ' + after);
    if ((await word()) !== w) defects.push('a different word after the reload');
    S.report(defects, 'restore');
    await S.reset();
  });

  // ---- calm: no timer, no red, no sound, nothing taken away ---------------------------------------------------------------------
  H.scene('SB6 sbs: single calm (no timer, red, sound or petals)', async () => {
    const defects = [];
    await S.forProfiles(async (p, style) => {
      await S.openAs(p, { night: style === 'night', seed: () => seedWeek(['build', 'earth']), wait: 'document.querySelector("main")' });
      await mount('fix');
      let guard = 0;
      while (guard++ < 8 && !(await kind()).includes('prac')) { await tap('[data-next]'); await sleep(300); }
      await fillWord(1);
      await waitFor('[data-check]:not([disabled])'); await tap('[data-check]'); await sleep(300);
      defects.push(...(await S.checks.calm()).map((x) => p.id + ' ' + style + ' ' + x));
      const extra = await ev(`(() => { const d = []; if (document.querySelector('.petal, [data-petals], audio, [data-confetti], .confetti')) d.push('petal, audio or confetti element'); const f = document.querySelectorAll('.lgap.is-filled').length; if (document.querySelector('.is-slip') === null) d.push('no slip look'); return d; })()`);
      defects.push(...extra.map((x) => p.id + ' ' + x));
    }, { ids: ['iphone-se1', 'iphone-16', 'ipad-landscape'] });
    S.report(defects, 'calm');
  });

  // ---- peek ---------------------------------------------------------------------------------------------------------------------
  H.scene('SB6 sbs: single peek (one per word, nothing moves)', async () => {
    const defects = [];
    const p = S.profile('iphone-16');
    await S.openAs(p, { seed: () => seedWeek(['build', 'earth']), wait: 'document.querySelector("main")' });
    await mount('fix');
    let guard = 0;
    while (guard++ < 8 && !(await kind()).includes('prac')) { await tap('[data-next]'); await sleep(300); }
    if (!(await ev('!!document.querySelector("[data-peekbtn]:not(.is-hidden)")'))) { await fillWord(); await press(); await press(); }
    const pos = () => ev('JSON.stringify([...document.querySelectorAll(".ltile, [data-check], [data-peekbtn], .lgap")].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.left)]; }))');
    const hasPeek = await ev('!!document.querySelector("[data-peekbtn]:not(.is-hidden)")');
    if (!hasPeek) { defects.push('no Peek on a rung'); } else {
      const a = await pos();
      await tap('[data-peekbtn]'); await sleep(250);
      const shown = await ev('document.querySelectorAll(".lgap.is-peeked").length');
      const b = await pos();
      if (!shown) defects.push('Peek showed no letter');
      if (a !== b) defects.push('something moved while Peek showed');
      await S.shotAs(p, 'peek', 'garden');
      await sleep(3300);
      const left = await ev('document.querySelectorAll(".lgap.is-peeked").length');
      if (left) defects.push('letters stayed after Peek');
      const c = await pos();
      if (a !== c) defects.push('something moved after Peek');
    }
    S.report(defects, 'peek');
    await S.reset();
  });

  // ---- after: "No practice after" has passed ---------------------------------------------------------------------------------------
  H.scene('SB6 sbs: single after (finished for today)', async () => {
    const defects = [];
    const p = S.profile('iphone-16');
    await S.openAs(p, { seed: async () => { await seedWeek(['build', 'earth'], (d) => { const W = null; return d; }); await ev(`(() => { const k = 'sb.words:' + (JSON.parse(localStorage.getItem('wa.player')).id); const d = JSON.parse(localStorage.getItem(k)); d.setup = d.setup || {}; d.setup.after = '00:01'; d.setup.sbs = { ...(d.setup.sbs || {}), after: '00:01' }; localStorage.setItem(k, JSON.stringify(d)); })()`); }, wait: 'document.querySelector("main")' });
    await mount('hello');
    const t = await ev('document.querySelector("main").innerText');
    console.log('  · after screen: ' + t.replace(/\s+/g, ' ').slice(0, 120));
    S.report(defects, 'after (shown, see log)');
    await S.reset();
  });

  // ---- offline ------------------------------------------------------------------------------------------------------------------------
  H.scene('SB6 sbs: single offline (a rung works with no network)', async () => {
    const defects = [];
    const p = S.profile('iphone-16');
    H.allowLog(/ERR_INTERNET_DISCONNECTED/);
    await S.openAs(p, { seed: () => seedWeek(['build', 'earth']), wait: 'document.querySelector("main")' });
    await ev("Promise.all([import('./js/store.js'), import('./js/words-doc.js'), import('./js/sbs-views.js')]).then(() => true)");
    await H.send('Network.enable').catch(() => {});
    await H.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }).catch(() => {});
    try {
    await mount('fix');
    let guard = 0;
    while (guard++ < 8 && !(await kind()).includes('prac')) { await tap('[data-next]'); await sleep(300); }
    if (!(await kind()).includes('prac')) defects.push('no rung offline');
    await fillWord(); await press();
    if (!/s6/.test(await kind())) defects.push('the screen went after Check offline');
    } finally {
    await H.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {});
    }
    S.report(defects, 'offline');
    await S.reset();
  });

  // ---- a11y -------------------------------------------------------------------------------------------------------------------------------
  H.scene('SB6 sbs: single a11y (h1 focus, names, 44 px targets)', async () => {
    const defects = [];
    const p = S.profile('iphone-16');
    await S.openAs(p, { seed: () => seedWeek(['build', 'earth']), wait: 'document.querySelector("main")' });
    await mount('fix');
    let guard = 0;
    while (guard++ < 8 && !(await kind()).includes('prac')) { await tap('[data-next]'); await sleep(300); }
    const r = await ev(`(() => { const d = []; const root = document.querySelector('[data-sbs]');
      if (document.activeElement && document.activeElement.tagName !== 'H1' && !root.contains(document.activeElement)) d.push('focus is not on the new screen');
      for (const b of root.querySelectorAll('button')) { const r = b.getBoundingClientRect(); if (r.width < 2) continue; const n = (b.getAttribute('aria-label') || b.textContent || '').trim(); if (!n) d.push('a button with no name'); if (!b.classList.contains('lgap') && (r.width < 43.5 || r.height < 43.5)) d.push('target ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + n.slice(0, 12)); }
      if (!root.querySelector('h1')) d.push('no h1');
      if (document.querySelectorAll('[style]').length && [...document.querySelectorAll('main [style]')].some((e) => e.getAttribute('style').includes('<'))) d.push('odd style attr');
      return d; })()`);
    defects.push(...r);
    S.report(defects, 'a11y');
    await S.reset();
  });

  // ---- FIX-U1a (F1, F2): the first screens fit, Hear is 48 x 48, the Copy rung with 56 px tiles is above the bar --------------------------------
  H.scene('SB6 sbs: U1a first screens (First/then, Meet, Copy rung; Years 1 to 6 at 320 and 375)', async () => {
    const defects = [];
    const hearSizes = (p, name) => ev(`[...document.querySelectorAll('.hearround')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; }).map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }).filter((s) => { const [w, h] = s.split('x').map(Number); return w < 48 || h < 48; })`)
      .then((bad) => bad.map((b) => p.id + ' ' + name + ': Hear is ' + b));
    for (const year of [1, 2, 3, 5, 6]) {
      await S.forProfiles(async (p, style) => {
        await S.openAs(p, { night: style === 'night', seed: () => seedWeek(WORDS5, undefined, year), wait: 'document.querySelector("main")' });
        await mount('hello');
        let seen = new Set();
        let rungs = 0;
        for (let guard = 0; guard < 16 && rungs < 5; guard += 1) {
          const k = await kind();
          if (/prac/.test(k)) rungs += 1;
          const name = 'y' + year + '-' + (/ft/.test(k) ? 'firstthen' : /meet/.test(k) ? 'meet' : /prac/.test(k) ? 'rung' + rungs : k.trim().replace(/\s+/g, '-'));
          const m = await S.measure({ boxes: '.lgap, .lshown', tiles: '.ltile', check: '[data-check], [data-next]', hear: '[data-hear], .s6-boxline .hearround' });
          for (const c of m.peek) if (c.w < 47.5 || c.h < 47.5) defects.push(p.id + ' ' + style + ' ' + name + ': Peek is ' + c.w + 'x' + c.h);
          const d = S.checks.firstScreen(m, p, { need: ['check'] });
          if (m.scrollPx > 0) d.push('page scrolls ' + m.scrollPx + ' px');
          if (/prac/.test(k) && m.tiles.length && Math.min(...m.tiles.map((t) => Math.min(t.w, t.h))) < (year <= 2 ? 56 : 48) - 0.5) d.push('tiles under ' + (year <= 2 ? 56 : 48));
          if (process.env.U1A_DEBUG && /rung/.test(name) && p.id === 'iphone-se1' && style === 'garden' && year === 1) console.log('  · ' + name + ' ' + p.id + ' ' + await ev(`JSON.stringify([...document.querySelectorAll('.s6, .s6 > *, .s6-upper > *, .s6-block > *, .s6-block .keyboard--tray > *')].filter(Boolean).map((e) => (e.tagName + '.' + (e.className.toString().slice(0, 16)) + ' top' + Math.round(e.getBoundingClientRect().top) + ' h' + Math.round(e.getBoundingClientRect().height) + ' pb' + getComputedStyle(e).paddingBottom + ' mh' + getComputedStyle(e).minHeight)))`));
          defects.push(...d.map((x) => p.id + ' ' + style + ' ' + name + ': ' + x), ...(await hearSizes(p, style + ' ' + name)));
          if (!seen.has(name)) await S.shotAs(p, 'u1a-' + name, style);
          seen.add(name);
          if (/prac/.test(k)) { await fillWord(); await press(); await press(); } else { await tap('[data-next]'); await sleep(350); }
        }
      }, { ids: ['iphone-se1', 'iphone-se'] });
    }
    S.report(defects, 'U1a first screens');
    await S.reset();
  });

  // ---- FIX-U1a (F6): every option on the Meanings boards has its own Hear (48 x 48), and the board still fits ----------------------------------
  H.scene('SB6 sbs: U1a Meanings boards (a Hear on every option, in view, 48 x 48)', async () => {
    const defects = [];
    const WORDS = ['friend', 'island', 'guard', 'necessary', 'because', 'caught'];
    for (const year of [1, 3]) {
      await S.forProfiles(async (p, style) => {
        for (const game of ['match', 'fill', 'mix']) {
          await S.openAs(p, { night: style === 'night', hash: '#/words/g/g1/game/' + game, seed: () => S.seedSbsChild({ year, words: WORDS }), wait: "!!document.querySelector('[data-word], [data-card], [data-slot-i]')" });
          await sleep(500);
          await ev('document.fonts.ready.then(() => true)'); // FIX-U4: a look's fonts load on first use; measure once they are in
          const name = 'y' + year + '-' + game;
          const m = await S.measure({ boxes: '.nothing', tiles: '.nothing', check: '[data-check], [data-next], [data-skip]', hear: '[data-hearopt]', options: '[data-word], [data-meaning], [data-card]' });
          const d = [];
          const opts = m.options.length;
          if (!m.hear.length) d.push('no Hear on the options');
          if (m.hear.length !== opts) d.push(opts + ' options but ' + m.hear.length + ' Hear buttons');
          for (const h of m.hear) { if (h.w < 47.5 || h.h < 47.5) d.push('Hear is ' + h.w + 'x' + h.h); if (h.b > S.line(p) + 0.5) d.push('Hear ends at ' + h.b + ', below the line ' + S.line(p)); if (h.hit) d.push('Hear is ' + h.hit); }
          for (const c of m.check) { if (c.b > S.line(p) + 0.5) d.push('"' + c.text + '" ends at ' + c.b + ', below the line ' + S.line(p)); if (c.hit) d.push('"' + c.text + '" is ' + c.hit); }
          for (const o of m.options) { if (o.b > S.line(p) + 0.5) d.push('option "' + o.text + '" ends at ' + o.b + ', below the line ' + S.line(p)); }
          if (m.sideways > 0) d.push('sideways scroll ' + m.sideways + ' px');
          // FIX-U5 (S1): every Hear is at least 8 px from every other target (a card, another Hear, Skip, Check), not only its own card
          const near = await ev(`(() => { const T = [...document.querySelectorAll('main button, main [role="button"], main a, [data-word], [data-meaning], [data-card]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); const out = []; for (const h of document.querySelectorAll('[data-hearopt]')) { const a = h.getBoundingClientRect(); for (const o of T) { if (o === h || h.contains(o) || o.contains(h)) continue; let b = o.getBoundingClientRect(); const bd = o.closest('.mixboard'); if (bd) { const q = bd.getBoundingClientRect(); b = { left: Math.max(b.left, q.left), right: Math.min(b.right, q.right), top: Math.max(b.top, q.top), bottom: Math.min(b.bottom, q.bottom) }; if (b.right <= b.left || b.bottom <= b.top) continue; } const gx = Math.max(b.left - a.right, a.left - b.right, 0), gy = Math.max(b.top - a.bottom, a.top - b.bottom, 0); const g = Math.hypot(gx, gy); if (g < 8 - 0.01) out.push(Math.round(g * 10) / 10 + ' px to "' + (o.textContent || o.className).trim().slice(0, 20) + '"'); } } return out; })()`);
          for (const x of near) d.push('Hear is only ' + x);
          if (process.env.U1A_DEBUG) console.log('  · ' + p.id + ' ' + style + ' ' + name + ' options ' + opts + ' hears ' + m.hear.length + ' scroll ' + m.scrollPx);
          defects.push(...d.map((x) => p.id + ' ' + style + ' ' + name + ': ' + x));
          await S.shotAs(p, 'u1a-' + name, style);
          // a Hear speaks the option (sayLine/speak is called with the option text): spy on speech
          if (p.id === 'iphone-16' && style === 'garden' && year === 1) {
            const said = await ev(`(async () => { const sp = await import('./js/speech.js'); return typeof sp.sayLine; })()`);
            if (said !== 'function') defects.push('speech.js has no sayLine');
          }
        }
      }, { ids: ['iphone-se1', 'iphone-se', 'iphone-16', 'ipad-portrait', 'ipad-landscape'] });
    }
    S.report(defects, 'U1a Meanings boards');
    await S.reset();
  });

  // ---- fold ---------------------------------------------------------------------------------------------------------------------------------
  H.scene('SB6 sbs: S-fold-sbs (everything in view, every screen, every profile)', async () => {
    const defects = [];
    await S.forProfiles(async (p, style) => {
      await S.openAs(p, { night: style === 'night', seed: () => seedWeek(['build', 'earth', 'fruit']), wait: 'document.querySelector("main")' });
      await mount('fix');
      let guard = 0, seen = 0;
      while (guard++ < 14 && seen < 5) {
        const k = await kind();
        if (/prac/.test(k)) { defects.push(...(await layout(p))); seen += 1; await fillWord(); await press(); await press(); } else { const m = await S.measure({ check: '[data-next], [data-check]' }); defects.push(...S.checks.firstScreen(m, p, { need: [] }).map((x) => p.id + ' ' + k + ' ' + x)); await tap('[data-next]'); await sleep(350); }
      }
    }, { ids: [...S.TR70, 'ipad-landscape-bars'] });
    S.report(defects, 'fold');
  });
};
