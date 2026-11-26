// SB6 scenes of WP-4: S-builder (levels 1 to 4, hints, typed words refused), S-normal-builder (the Usual way's "Help me build it").
// The builder has no route of its own (Story day, WP-5b, calls buildSentence), so each scene loads the module in the page and draws it into <main>.
// Helpers: tools/smoke-sb6/helpers.mjs; how to use: sb6-process/builds/WP-10.md. Name every scene 'SB6 builder: <what>'.
const WORDS = ['friend', 'island', 'guard', 'necessary'];
const SEL = {
  boxes: '.tileboxes .lgap, .tileboxes .lshown', tiles: '.ltile', check: '[data-next]', hear: '.hearround', peek: '[data-peekbtn]',
  options: '[data-card], [data-pick]', steps: '.s6-steps > i', column: 'main .s6',
};

export default (H, S) => {
  const { ev, until, sleep, ok } = H;
  const q = JSON.stringify;

  /** Draws the builder in <main>. `o` is the options object as JS source. */
  const start = (o) => ev(`(async () => {
    const S = await import('./js/store.js'); const W = await import('./js/words-doc.js'); const B = await import('./js/builder-views.js');
    const g = W.liveGroups(S.readWords())[0];
    window.__fx = []; if (!window.__fetchWrapped) { const f = window.fetch; window.fetch = (...a) => { window.__fx.push(String(a[0]) + ' ' + ((a[1] && a[1].method) || 'GET') + ' ' + ((a[1] && a[1].body) ? String(a[1].body).length : 0)); return f(...a); }; window.__fetchWrapped = true; }
    window.__done = undefined;
    window.__b = ${o.normal ? 'B.helpMeBuild' : 'B.buildSentence'}(document.querySelector('main'), { g, ${o.opts}, onDone: (n) => { window.__done = n || null; } });
    return true; })()`);
  const tap = (sel, i = 0) => ev(`(() => { const e = [...document.querySelectorAll(${q(sel)})].filter((x) => !x.disabled)[${i}]; if (!e) return false; e.click(); return true; })()`);
  const has = (sel) => ev(`!!document.querySelector(${q(sel)})`);
  const txt = (sel) => ev(`(document.querySelector(${q(sel)}) || {}).textContent || ''`);
  const waitLevel = (cls) => until(`!!document.querySelector('.b6.${cls}')`, 'level ' + cls, 9000);
  const notes = () => ev(`(async () => { const S = await import('./js/store.js'); return S.readWords().notes; })()`);
  const results = () => ev(`(async () => { const S = await import('./js/store.js'); return S.readWords().results; })()`);

  async function seedOpen(p, style, { year = 4, normal = false } = {}) {
    await S.openAs(p, { night: style === 'night', wait: "!!document.querySelector('main')", seed: () => (normal ? S.seedNormalChild({ year, words: WORDS }) : S.seedSbsChild({ year, words: WORDS })) });
    await until("!!document.querySelector('main section, main .wrap') && document.body.classList.contains('is-child')", 'the child home page', 9000);
  }
  /** One screen's checks: everything inside the first screen above the reserve line, no sideways scroll, 44 px targets, nothing covered. */
  async function screen(p, style, name, { year = 4, need = ['check'], tray = false } = {}) {
    await sleep(120);
    const m = await S.measure(SEL);
    const d = S.checks.firstScreen(m, p, { need });
    if (m.scrollPx > 1) d.push(name + ': the page scrolls ' + m.scrollPx + ' px');
    const small = await ev(`[...document.querySelectorAll('main button, main textarea')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && !e.hidden && !e.disabled && (r.height < 43.5 || r.width < 43.5); }).map((e) => (e.className + ' ' + (e.textContent || '').trim().slice(0, 12) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)))`);
    // a placed word box in a long word may be narrower than 44 px (the design allows it; Undo gives a second way back)
    for (const s of small) if (!/ltile|lgap/.test(s)) d.push(name + ': a control under 44 px: ' + s);
    if (tray) { d.push(...S.checks.targets(m, p, { year }), ...S.checks.gapBoxesTiles(m), ...S.checks.hearBesideBoxes(m), ...S.checks.boxWidth(m, p, 20)); }
    d.push(...(await S.checks.calm()));
    if (p.w >= 820) d.push(...S.checks.playColumn(m, p));
    await S.shotAs(p, 'builder-' + name, style);
    return d.map((x) => p.id + ' ' + style + ' ' + name + ': ' + x);
  }
  /** The tiles that spell the empty boxes, in order. */
  const spellIt = (word) => ev(`(() => { const w = ${q(word)}; const out = []; for (const g of [...document.querySelectorAll('.lgap[data-gap]:not(.is-filled)')]) { const ch = w[Number(g.dataset.gap)].toLowerCase(); const t = [...document.querySelectorAll('.ltile:not(.is-used):not(:disabled)')].find((x) => x.textContent.trim().toLowerCase() === ch); if (!t) return 'no tile ' + ch; t.click(); out.push(ch); } return out.join(''); })()`);

  H.scene('SB6 builder: levels 1 to 4 at every phone and tablet, garden and Night', async () => {
    const defects = [];
    await S.forProfiles(async (p, style) => {
      await seedOpen(p, style, { year: 4 });
      await start({ opts: "word: 'friend', levels: [1, 2, 3, 4], way: 'sbs', year: 4, index: 1, of: 3, seed: 0" });
      // level 1: the target has ONE card, the other gaps three; any pick makes a sentence
      await waitLevel('b6-l1');
      defects.push(...(await screen(p, style, 'l1', { need: ['hear'] })));
      let guard = 0;
      const counts = [];
      while (await has('[data-cards]:not([hidden]) [data-card]') && guard++ < 6) {
        const n = await ev(`document.querySelectorAll('[data-cards]:not([hidden]) [data-card]').length`);
        counts.push(n);
        await tap('[data-cards]:not([hidden]) [data-card]', n - 1);
      }
      ok(counts.length >= 2 && counts[0] === 1 || counts.length >= 2 && counts.includes(1), 'the target gap has one card (' + counts.join(',') + ')');
      ok(counts.every((n) => n === 1 || n === 3), 'every other gap has 3 cards (' + counts.join(',') + ')');
      ok((await txt('[data-instruction]')).includes('Hear your sentence'), 'level 1 ends on "Hear your sentence."');
      ok((await txt('.s6-pill')).includes('Silly is fine'), 'silly is fine');
      defects.push(...(await screen(p, style, 'l1-done', { need: ['check', 'hear'] })));
      ok(await ev(`document.querySelector('[data-next]') && !document.querySelector('[data-next]').disabled`), 'Next is open at the end of level 1');
      await tap('[data-next]');
      // level 2: find the missing word, with the tray at the middle rung, Peek and Undo
      await waitLevel('b6-l2');
      defects.push(...(await screen(p, style, 'l2', { year: 4, need: ['check', 'peek', 'hear'], tray: true })));
      ok(await has('[data-undo]') && await has('[data-peekbtn]') && await has('[data-hearword]'), 'level 2 has Peek, Undo and the word\'s own Hear');
      await tap('[data-peekbtn]');
      await sleep(150);
      ok((await ev(`document.querySelectorAll('.lgap.is-peeked').length`)) > 0, 'Peek shows the letters in the empty boxes');
      await sleep(3300);
      ok((await ev(`document.querySelectorAll('.lgap.is-peeked').length`)) === 0, 'the Peek goes away by itself');
      // a wrong tile first (kind line, nothing red), Undo, then the word
      const slip = await ev(`(() => { const g = document.querySelector('.lgap[data-gap]:not(.is-filled)'); const want = 'friend'[Number(g.dataset.gap)]; const t = [...document.querySelectorAll('.ltile:not(.is-used):not(:disabled)')].find((x) => x.textContent.trim().toLowerCase() !== want); if (!t) return false; t.click(); return true; })()`);
      ok(slip, 'a tile can be placed');
      await tap('[data-undo]');
      ok((await ev(`document.querySelectorAll('.lgap.is-filled').length`)) === 0, 'Undo takes the tile back');
      ok(!/^no tile/.test(await spellIt('friend')), 'the word is spelled with the tiles');
      await sleep(200);
      await tap('[data-next]');
      await sleep(250);
      ok((await txt('[data-instruction]')).includes('You spelled it'), 'level 2: right answer says so');
      ok(await ev(`!!document.querySelector('.is-ok')`), 'the line turns to its ok style');
      await tap('[data-next]');
      // level 3: the words in order
      await waitLevel('b6-l3');
      defects.push(...(await screen(p, style, 'l3', { need: ['check', 'hear'] })));
      ok((await ev(`document.querySelectorAll('.s6-slot').length`)) >= 4 && (await ev(`document.querySelectorAll('.s6-slot').length`)) <= 6, 'level 3 has 4 to 6 cards');
      ok((await ev(`[...document.querySelectorAll('.s6-slot small')].map((s) => s.textContent).join('|')`)).startsWith('Aa') && (await ev(`[...document.querySelectorAll('.s6-slot small')].map((s) => s.textContent).join('|')`)).includes('End'), 'the capital and the full stop are marked');
      // hints: Which first? (a still outline), Show me (sets "with help")
      await tap('[data-which]');
      ok(await has('.s6-cardbtn.is-outline'), 'Which first? outlines a card');
      defects.push(...(await screen(p, style, 'l3-hint', { need: ['check', 'hear'] })));
      await tap('[data-show]');
      ok((await ev(`document.querySelectorAll('.s6-slot.is-filled').length`)) === 1, 'Show me places one card');
      for (let k = 0; k < 8 && await ev(`document.querySelector('.s6-slot:not(.is-filled)') !== null`); k += 1) { await tap('[data-show]'); await sleep(40); }
      await tap('[data-next]');
      await sleep(250);
      ok((await txt('[data-instruction]')).includes('Hear your sentence'), 'level 3 finished');
      await tap('[data-next]');
      // level 4: make your own, tapping words; a typed word that is not on our lists is refused with one kind line
      await waitLevel('b6-l4');
      defects.push(...(await screen(p, style, 'l4', { need: ['check', 'peek'] })));
      await ev(`(() => { const t = document.querySelector('[data-own]'); t.focus(); t.value = 'My friend wibble ran home'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await sleep(150);
      ok(await has('.b6.is-typing'), 'the keyboard-open state is on while typing');
      defects.push(...(await screen(p, style, 'l4-typing', { need: ['check', 'peek'] })));
      await tap('[data-next]');
      await sleep(150);
      ok((await txt('[data-instruction]')) === 'Try a different word.', 'an unknown word gets "Try a different word."');
      ok(await has('.b6-textin.is-soft'), 'the box turns soft, not red');
      await ev(`(() => { const t = document.querySelector('[data-own]'); t.value = 'My friend came to play'; t.dispatchEvent(new Event('input', { bubbles: true })); t.blur(); })()`);
      await tap('[data-peekbtn]');
      ok((await txt('[data-peekword]')) === 'friend', 'Peek shows the week word');
      await tap('[data-next]');
      await sleep(300);
      // the end: saved as the word's sentence, "My sentences" with stickers
      ok(await has('.b6-l9'), 'My sentences is shown');
      defects.push(...(await screen(p, style, 'l9', { need: ['check'] })));
      await tap('[data-sid]');
      await tap('[data-next]');
      await until('window.__done !== undefined', 'onDone', 4000);
      const ns = await notes();
      ok(ns.length === 1 && ns[0].w === 'friend' && ns[0].bl === 4 && /^My friend came to play\.$/.test(ns[0].x), 'the note is saved with bl 4: ' + JSON.stringify(ns));
      ok(ns[0].hp === undefined, 'no "with help" on a sentence the child made alone');
      const tr = (await results()).filter((r) => r.j === 'b');
      ok(tr.length === 1 && tr[0].s === 'g' && tr[0].lv >= 2 && tr[0].r >= 2, 'level 2 is one try with j b, s g and the middle rung: ' + JSON.stringify(tr));
      const fx = await ev('window.__fx');
      ok(!fx.some((x) => /api\/(voice|pictures|story|sentences)|POST/.test(x)), 'nothing was sent anywhere: ' + fx.join(' ; '));
    });
    S.report(defects, 'builder levels 1-4');
  });

  H.scene('SB6 builder: Years 1-2 get level 1 only, with no step row, and a word with one level left out', async () => {
    const p = S.profile('iphone-16');
    await seedOpen(p, 'garden', { year: 1 });
    await start({ opts: "word: 'friend', levels: [1], way: 'sbs', year: 1, seed: 2" });
    await waitLevel('b6-l1');
    ok(!(await has('.s6-steps')), 'one level: no step row');
    while (await has('[data-cards]:not([hidden]) [data-card]')) await tap('[data-cards]:not([hidden]) [data-card]');
    await tap('[data-next]');
    await sleep(300);
    ok(await has('.b6-l9'), 'My sentences after the only level');
    await tap('[data-next]');
    await until('window.__done !== undefined', 'onDone', 4000);
    const ns = await notes();
    ok(ns.length === 1 && ns[0].bl === 1, 'saved as level 1: ' + JSON.stringify(ns));
    // an own word with no model: levels 2 and 3 are left out, and the screen still works
    await start({ opts: "word: 'zzword', levels: [1, 2, 3], way: 'sbs', year: 4, seed: 0" });
    await waitLevel('b6-l1');
    ok(await ev(`document.querySelectorAll('.s6-steps > i').length`) <= 1, 'only one level is left for a word with no model sentence');
  });

  H.scene('SB6 builder: hints, "Show me" shows to the grown-up as with help, and typed words are refused kindly', async () => {
    const p = S.profile('iphone-16');
    await seedOpen(p, 'garden', { year: 5 });
    await start({ opts: "word: 'island', levels: [3], way: 'sbs', year: 5, seed: 1" });
    await waitLevel('b6-l3');
    for (let k = 0; k < 8 && !(await ev(`document.querySelector('.s6-slot:not(.is-filled)') === null`)); k += 1) { await tap('[data-show]'); await sleep(40); }
    await tap('[data-next]');
    await sleep(250);
    ok((await txt('[data-instruction]')).includes('Hear your sentence'), 'Show me can finish the sentence');
    await tap('[data-next]');
    await sleep(250);
    await tap('[data-next]');
    await until('window.__done !== undefined', 'onDone', 4000);
    const ns = await notes();
    ok(ns.length === 1 && ns[0].bl === 3 && ns[0].hp === 1, 'the sentence is saved with bl 3 and hp 1: ' + JSON.stringify(ns));
    // level 4 alone: under four words, the word missing, an unknown word, a name: each gets one kind line and nothing is saved
    await start({ opts: "word: 'island', levels: [4], way: 'sbs', year: 5, seed: 1" });
    await waitLevel('b6-l4');
    ok(!(await has('[data-skip]')), 'no "Not now" when level 4 is the only level');
    const tryText = async (t) => { await ev(`(() => { const e = document.querySelector('[data-own]'); e.value = ${q(t)}; e.dispatchEvent(new Event('input', { bubbles: true })); })()`); await tap('[data-next]'); await sleep(120); return txt('[data-instruction]'); };
    ok((await tryText('The island')) === 'Add a few more words.', 'under 4 words');
    ok((await tryText('The sky was very dark')) === 'Use the word island.', 'the week word is missing');
    ok((await tryText('The island wibble was very big')) === 'Try a different word.', 'an unknown word');
    ok((await tryText('Maya went to the island')) === 'Try a different word.', 'a name is not accepted');
    ok((await tryText('The island was very stupid')) === 'Try a different word.', 'an unkind word gets the same answer');
    ok((await notes()).length === 1, 'nothing was saved by a refused sentence');
    ok(await ev(`!document.body.innerText.match(/wrong|fail|mistake|error/i)`), 'no unkind word on the page');
    const fx = await ev('window.__fx');
    ok(!fx.some((x) => /api\//.test(x) && /voice|POST/.test(x)), 'a typed word was never sent: ' + fx.join(' ; '));
  });

  H.scene('SB6 builder: the Usual way\'s "Help me build it" gives levels 1 and 3, no Peek, saves nothing and returns the sentence', async () => {
    const defects = [];
    for (const [pid, style] of [['iphone-se1', 'garden'], ['iphone-16', 'night'], ['ipad-landscape-bars', 'garden']]) {
      const p = S.profile(pid);
      await seedOpen(p, style, { year: 4, normal: true });
      await start({ normal: true, opts: "word: 'guard', seed: 1" });
      await waitLevel('b6-l1');
      defects.push(...(await screen(p, style, 'n1', { need: ['hear'] })));
      while (await has('[data-cards]:not([hidden]) [data-card]')) await tap('[data-cards]:not([hidden]) [data-card]');
      await tap('[data-next]');
      await waitLevel('b6-l3');
      ok(!(await has('[data-peekbtn]')), 'the Usual way has no Peek in levels 1 and 3');
      defects.push(...(await screen(p, style, 'n3', { need: ['check', 'hear'] })));
      for (let k = 0; k < 9 && !(await txt('[data-instruction]')).includes('Hear your sentence'); k += 1) {
        await tap('[data-show]'); await sleep(40);
        if (await ev(`document.querySelector('.s6-slot:not(.is-filled)') === null`)) { await tap('[data-next]'); await sleep(200); }
      }
      await tap('[data-next]');
      await until('window.__done !== undefined', 'onDone', 4000);
      const done = await ev('window.__done');
      ok(done && typeof done.text === 'string' && done.text.length > 10 && done.bl === 3, 'the sentence comes back for the box: ' + JSON.stringify(done));
      ok((await notes()).length === 0, 'the builder saved nothing: the Story day box saves with today\'s Save');
      ok((await results()).filter((r) => r.j === 'b').length === 0, 'no level 2 try in the Usual way');
    }
    S.report(defects, 'Usual way builder');
  });

};
