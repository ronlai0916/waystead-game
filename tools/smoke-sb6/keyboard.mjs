// SB7 (FIX-1, CHECK-1 S8): Ron's iPad bug itself. A hardware keyboard on the letter-tile screens: a Step by step rung (Copy, then Hide and spell on
// tiles) is finished with real key events only (CDP Input.dispatchKeyEvent: letters, Backspace, Enter), then one Usual-way tile screen the same way.
// 'SB6 keyboard*' runs this file's scenes. At 1180 x 640 (a landscape iPad with Safari's bars), the size CHECK-1 asked for.
export default (H, S) => {
  const { ev, until, sleep, key, keys, MON, plus, W } = H;
  const q = JSON.stringify;
  const has = (sel) => ev(`!!document.querySelector(${q(sel)})`);
  const tap = (sel) => ev(`(() => { const e = document.querySelector(${q(sel)}); if (!e || e.disabled) return false; e.click(); return true; })()`);
  const filled = () => ev('document.querySelectorAll(".lgap.is-filled").length');
  const kind = () => ev('(document.querySelector("[data-sbs]") || {className: ""}).className');
  const mount = async (step) => {
    await ev(`(async () => {
      const [S, W, V] = await Promise.all([import('./js/store.js'), import('./js/words-doc.js'), import('./js/sbs-views.js')]);
      const d = S.readWords(); const g = W.groupById(d, 'g1');
      window.__sbsOff = V.sbsStone(document.querySelector('main'), { g, step: ${q(step)} });
      return true; })()`);
    await until('document.querySelector("[data-sbs]")', 'an sbs screen', 8000);
    await sleep(250);
  };
  /** Count real pointer presses from here on: a keyboard-only run must have none on the page. */
  const watchPointers = () => ev('(() => { window.__ptr = 0; for (const t of ["pointerdown", "mousedown", "touchstart"]) document.addEventListener(t, () => { window.__ptr += 1; }, true); return true; })()');
  const pointers = () => ev('window.__ptr || 0');

  H.scene('SB6 keyboard: a Step by step rung is finished with a hardware keyboard (Copy, then Hide and spell on tiles), 1180 x 640', async () => {
    const defects = [];
    const p = S.profile('ipad-landscape-bars');
    await S.openAs(p, { seed: () => S.seedSbsChild({ year: 4, words: ['build'] }), wait: 'document.querySelector("main")' });
    await mount('fix');
    await watchPointers();
    let guard = 0; let rungs = 0; let backs = 0; let early = 0; let end = '';
    while (guard++ < 60) {
      const k = await kind();
      if (/end|stopped|stuck/.test(k)) { end = k; break; }
      if (!/prac/.test(k)) { await tap('[data-next]'); await sleep(450); continue; } // First/then and Meet screens are not tile screens
      if (await has('[data-next]')) { await key('Enter'); await sleep(550); continue; } // after a right answer Enter is Next (focus is on it or on a tile)
      const w = await ev('document.querySelector("[data-sbs]").dataset.word');
      const gaps = await ev('[...document.querySelectorAll(".lgap[data-gap]")].filter((g) => !g.classList.contains("is-filled")).map((g) => Number(g.dataset.gap))');
      if (!gaps.length) { await key('Enter'); await sleep(450); continue; }
      if (gaps.length >= 2 && !backs) {
        const b0 = await filled();
        await key(w[gaps[0]]); await sleep(120);
        const b1 = await filled();
        if (b1 !== b0 + 1) defects.push('a letter key placed ' + (b1 - b0) + ' tiles, not 1 (' + w[gaps[0]] + ')');
        await key('Enter'); await sleep(250); // not full: Enter must do nothing
        if ((await filled()) !== b1 || (await has('[data-next]')) || (await ev('document.querySelectorAll(".lgap.is-slip").length'))) { early += 1; defects.push('Enter with the boxes not full did something'); }
        await key('Backspace'); await sleep(120);
        if ((await filled()) !== b0) defects.push('Backspace did not take the tile back (filled ' + (await filled()) + ', was ' + b0 + ')');
        backs += 1;
      }
      const again = await ev('[...document.querySelectorAll(".lgap[data-gap]")].filter((g) => !g.classList.contains("is-filled")).map((g) => Number(g.dataset.gap))');
      await keys(again.map((g) => w[g]).join('')); await sleep(200);
      if (await ev('(document.querySelector("[data-check]") || {disabled: true}).disabled')) defects.push('Check stayed off after every letter was typed (' + w + ')');
      await key('Enter'); await sleep(550); rungs += 1;
    }
    const tries = await ev(`(async () => { const S = await import('./js/store.js'); const d = S.readWords(); return d.results.filter((r) => r.w === 'build' && r.j === 'f').map((r) => r.r + (r.c === 1 ? 'c' : '')); })()`);
    console.log('  · rungs by keyboard: ' + rungs + ', the word ended as "' + end.replace(/\s+/g, ' ').trim() + '", Fix tries: ' + tries.join(','));
    if (rungs < 2) defects.push('fewer than two rungs were finished by the keyboard (' + rungs + ')');
    if (!end) defects.push('the word never reached the end of the ladder');
    if (!tries.length) defects.push('no Letter ladder try was saved');
    if (await pointers()) defects.push((await pointers()) + ' pointer presses: the run was not keyboard only');
    if (early) defects.push('Enter fired early ' + early + ' times');
    await S.shotAs(p, 'keyboard-rung', 'garden');
    S.report(defects, 'keyboard rung');
    await S.reset();
  });

  H.scene('SB6 keyboard: a Usual-way tile screen (Hide and spell) takes letters, Backspace and Enter', async () => {
    const defects = [];
    const p = S.profile('ipad-landscape-bars');
    const day = plus(4);
    const T0 = Date.parse(MON + 'T09:00:00');
    await S.openAs(p, {
      day, hash: '#/words/g/g1/spell/0',
      seed: () => S.seedNormalChild({ year: 1, words: ['build'], day, extra: (d) => ['hello', 'fix', 'games', 'story'].reduce((x, st) => W.markStep(x, W.groupById(x, 'g1'), st, day, T0), d) }),
      wait: '!!document.querySelector("[data-check]")',
    });
    await sleep(300);
    await watchPointers();
    if (!(await has('.ltile'))) defects.push('no tiles: the child is not on tiles');
    const w = 'build'; // the week's one word
    const gapsOf = () => ev('[...document.querySelectorAll(".lgap[data-gap]")].filter((g) => !g.classList.contains("is-filled")).map((g) => Number(g.dataset.gap))');
    const gaps = await gapsOf();
    if (gaps.length < 2) defects.push('fewer than two empty boxes (' + gaps.length + '): the child is not on level 2 tiles');
    const b0 = await filled();
    await key(w[gaps[0]]); await sleep(120);
    if ((await filled()) !== b0 + 1) defects.push('a letter key did not place a tile (' + w[gaps[0]] + ')');
    await key('b'); await sleep(120); // a letter with no tile left or shown: nothing happens
    if ((await filled()) !== b0 + 1) defects.push('a letter with no tile changed the boxes');
    await key('Backspace'); await sleep(120);
    if ((await filled()) !== b0) defects.push('Backspace did not take it back');
    await key('Enter'); await sleep(200);
    if (await has('[data-next]')) defects.push('Enter with the boxes not full went on');
    await keys((await gapsOf()).map((g) => w[g]).join('')); await sleep(200);
    if (await ev('(document.querySelector("[data-check]") || {disabled: true}).disabled')) defects.push('Check stayed off after every missing letter was typed');
    await key('Enter');
    await sleep(900);
    const after = await ev('document.querySelector("main").innerText.replace(/\\s+/g, " ").slice(0, 200)');
    console.log('  · after Enter: ' + after);
    const saved = await ev(`(async () => { const S = await import('./js/store.js'); return S.readWords().results.filter((r) => r.w === 'build').length; })()`);
    if (!saved) defects.push('Enter did not check the word: no try was saved');
    if (await pointers()) defects.push((await pointers()) + ' pointer presses: the run was not keyboard only');
    await S.shotAs(p, 'keyboard-usual', 'garden');
    S.report(defects, 'keyboard usual');
    await S.reset();
  });
};
