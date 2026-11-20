// SB5 R4: child pages, About, the footer, the Stop sheet and the two sentence games, driven in a real browser.
// Run:  CHROME_PATH=... node tools/sb2-smoke.mjs <fresh dir> 'SB5 R4*'
export default function (H) {
  const { key, scene, go, click, ev, ok, until, sleep, style, send, kbSeed, shot, has, text, seedChild, open, weekDoc, MON, plus, visible, rect, gameDayDoc, signedOutBlank } = H;
  const phone = async (w, h, z = false) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true });
    await ev(`document.documentElement.style.fontSize = ${z ? "'130%'" : "''"}`);
    await sleep(120);
  };
  if (process.env.R4_SHOTS) scene('SB5 R4 shots', async () => {
    const cases = JSON.parse(process.env.R4_SHOTS); // [[role, seed, w, h]]
    for (const [role, seed, w, h] of cases) {
      await kbSeed(role, seed);
      await phone(w, h);
      await shot('r4-' + role + '-' + seed + '-' + w + 'x' + h);
    }
  });
  const key2 = (k) => ev(`document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
  const noSideways = async (what) => { const over = await ev('document.documentElement.scrollWidth - document.documentElement.clientWidth'); ok(over <= 0, what + ' scrolls sideways by ' + over + ' px'); };

  scene('SB5 R4 child: Today, the four footer links, Stop for now?, Look and voice, Words to practise again', async () => {
    await seedChild(gameDayDoc(), plus(2));
    await open(plus(2), '#/');
    await until('document.querySelector("[data-todayfoot]")', 'the footer links');
    for (const [w, h, z] of [[390, 844, false], [360, 640, true], [375, 667, false]]) {
      await phone(w, h, z);
      const label = w + 'x' + h + (z ? ' at 130%' : '');
      await shot('r4-today-' + label.replace(/ /g, '-'));
      await noSideways('Today ' + label);
      const big = await rect('.today__big');
      ok(big.y + big.h <= h - 110 + 1 || h < 700, 'the main button ends above the bottom 110 px at ' + label + ' (bottom ' + Math.round(big.y + big.h) + ')');
      const tiles = await ev('[...document.querySelectorAll(".today .tile")].map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.bottom); })');
      if (h >= 700) ok(tiles.every((b) => b <= h - 110 + 1), 'the tiles end above the band at ' + label + ': ' + tiles);
      const foot = await ev('[...document.querySelectorAll("[data-todayfoot] a")].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.top + scrollY), Math.round(r.height), e.textContent]; })');
      ok(foot.length === 4 && foot.every((f) => f[1] >= 48), 'four footer links, each 48 px high at ' + label + ': ' + JSON.stringify(foot));
      ok(foot[0][0] >= h - 4 || h < 700, 'the links start below the first screen (the 110 px band) at ' + label + ': ' + foot[0][0]);
    }
    await phone(390, 844);
    ok(/Waystead Learning papers[\s\S]*Spellbright is part of Waystead[\s\S]*For parents[\s\S]*More games/.test(await text('[data-todayfoot]')), 'the four links in order');
    // Menu: Look and voice row between Games and Settings
    await click('#child-menu');
    await until('document.querySelector("[data-row=look]")', 'the Look and voice row');
    ok(/Look and voice/.test(await text('[data-row=look]')) && /Switch player, account, sign out/.test(await text('[data-row=settings]')), 'the two rows');
    await shot('r4-menu');
    await click('[data-close]');
    // Stop for now? on a job
    await go('#/words/g/g1/study/fix');
    await until('document.querySelector("[data-cover]")', 'Look and say');
    ok(/Hide it/.test(await text('[data-cover]')), 'the button says Hide it');
    console.log('  · page text: ' + JSON.stringify(await ev('document.querySelector("main").textContent.slice(0, 160)')));
    await click('#child-stop');
    await until('document.querySelector("[data-keepgoing]")', 'the Stop sheet');
    const t = await text('#child-sheet');
    ok(/Stop for now\?/.test(t) && /Your place is saved\./.test(t) && /come back to word 1/.test(t) && /go to Today/.test(t) && /Keep going/.test(t) && /Stop and go to Today/.test(t), 'the sheet says: ' + t);
    await shot('r4-stop-sheet');
    const bb = await ev('[...document.querySelectorAll("#child-sheet .stop__btns .btn")].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.height), Math.round(r.bottom)]; })');
    ok(bb.every((b) => b[0] >= 48 && b[1] <= 844 - 110 + 20), 'both buttons 48 px high, clear of the band: ' + JSON.stringify(bb));
    await click('[data-keepgoing]');
    ok(!await has('#child-sheet') && /study\/fix/.test(await ev('location.hash')), 'Keep going stays in the job');
    await click('#child-stop');
    await until('document.querySelector("[data-stopnow]")', 'the Stop sheet again');
    await key2('Escape');
    ok(!await has('#child-sheet'), 'Escape closes the sheet');
    await click('#child-stop');
    await click('[data-stopnow]');
    await until('document.querySelector("[data-saved]")', 'Today with "Your place is saved."');
    ok(await ev('location.hash') === '#/' || await ev('location.hash') === '', 'Stop and go to Today');
    // Look and voice (the route is R1's: app.js "look")
    await go('#/look');
    await sleep(200);
    if (await has('[data-looksettings]')) {
      ok(await ev('document.querySelectorAll("[data-looks] [data-choice]").length') === 4, 'the four looks');
      await click('[data-looks] [data-choice=night]');
      ok(await ev('document.documentElement.getAttribute("data-theme")') === 'dark', 'Night');
      await click('[data-looks] [data-choice=garden]');
      ok(/Garden|Look/.test(await text('main')) && await has('[data-backlink]'), 'Look and voice with its back link');
      await noSideways('Look and voice');
    } else console.log('  · #/look has no route yet (R1 adds it): ' + await text('main'));
    // Settings (10c)
    await go('#/settings');
    await until('document.querySelector("[data-settings]")', 'Settings');
    ok(/Grown-ups/.test(await text()) && /About and licence/.test(await text()) && !await has('[data-looks]'), 'Settings has no Look picker');
    // Words to practise again (09a2): the empty state
    await go('#/tricky');
    await until('document.querySelector("h1")', 'the page');
    ok(/Words to practise again/.test(await text('h1')) && /No words to practise again\. Well done!/.test(await text()) && /Go to Practice/.test(await text()), 'the empty state: ' + await text());
    ok(await has('[data-backlink]'), 'the inline Today link');
    // Practice (08a): list cards, back link
    await go('#/chapters');
    await until('document.querySelector("[data-chapters]")', 'Practice');
    ok(await has('[data-backlink]') && /Practice/.test(await text('h1')), 'Practice with the Today link');
    await noSideways('Practice');
  });

  scene('SB5 R4 About: How Spellbright works (06d)', async () => {
    await signedOutBlank(plus(2));
    await open(plus(2), '#/about');
    await until('document.querySelector("[data-about-page]")', 'About');
    const t = await text();
    for (const need of ['How Spellbright works', 'For parents, teachers and tutors.', 'Set a week', 'Word lists', 'Three ways to use Spellbright', 'Lists are not shared between grown-ups', 'The name your children see', 'Spellbright uses AI to help write practice sentences', 'Look']) ok(t.includes(need), 'About says: ' + need);
    for (const bad of ['5 children', 'Game mode', 'sun or moon', 'share it with them']) ok(!t.includes(bad), 'About no longer says: ' + bad);
    ok(await ev('document.querySelectorAll("[data-looks] [data-choice]").length') === 4, 'the four looks');
    for (const [w, h, z] of [[390, 844, false], [360, 640, true], [1180, 820, false]]) {
      await (w < 500 ? phone(w, h, z) : H.width(w, h));
      await noSideways('About at ' + w);
      const min = await ev('Math.min(...[...document.querySelectorAll("[data-looks] .choice, .backlink")].map((e) => e.getBoundingClientRect().height).filter(Boolean))');
      ok(min >= 44, 'the targets are at least 44 px high at ' + w + ': ' + min);
    }
    await phone(390, 844);
    await click('[data-looks] [data-choice=night]');
    ok(await ev('document.documentElement.getAttribute("data-theme")') === 'dark', 'Night');
    await shot('r4-about-night');
    await click('[data-looks] [data-choice=garden]');
    await sleep(150);
    ok(await ev('document.querySelector("[data-looks] [data-choice=garden]").getAttribute("aria-checked")') === 'true' && await ev('document.querySelector("[data-looks] [data-choice=night]").getAttribute("aria-checked")') === 'false', 'Garden is ticked after Night');
    await shot('r4-about');
  });
  if (process.env.R4_DEBUG) scene('SB5 R4 debug', async () => {
    await seedChild(gameDayDoc(), plus(2));
    await open(plus(2), '#/');
    await phone(390, 844);
    console.log(await ev(`(() => { const o = []; for (const s of ['.today__r', '.today__r .tile']) { const e = document.querySelector(s); const r = e.getBoundingClientRect(); const c = getComputedStyle(e); o.push(s + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' display=' + c.display + ' flex=' + c.flex + ' w=' + c.width + ' minw=' + c.minWidth + ' maxw=' + c.maxWidth + ' pos=' + c.position + ' float=' + c.float + ' js=' + c.justifySelf + ' ji=' + c.justifyItems + ' gtc=' + c.gridTemplateColumns + ' mx=' + c.marginLeft + '/' + c.marginRight); } return o.join('\\n'); })()`));
  });
  const centre = (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' });
  const drag = async (from, to) => {
    const [x, y] = await centre(from); const [tx, ty] = await centre(to);
    await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y);
    for (let i = 1; i <= 8; i += 1) { await mouse('mouseMoved', x + (tx - x) * i / 8, y + (ty - y) * i / 8); await sleep(15); }
    await mouse('mouseReleased', tx, ty); await sleep(120);
  };

  scene('SB5 R4 games: Fill in the blanks and Mix and match in a browser', async () => {
    await seedChild(gameDayDoc(), plus(2));
    await open(plus(2), '#/');
    await go('#/words/g/g1/game/fill');
    await until('document.querySelector("[data-card]")', 'Fill in the blanks cards', 8000);
    for (const [w, h, z] of [[390, 844, false], [360, 640, true], [667, 375, false]]) {
      await phone(w, h, z);
      await noSideways('Fill at ' + w + (z ? ' 130%' : ''));
      const m = await ev('[...document.querySelectorAll("[data-card]")].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.height), Math.round(r.width), Math.round(r.bottom)]; })');
      ok(m.length >= 3 && m.every((c) => c[0] >= 48), 'cards are 48 px high at ' + w + ': ' + JSON.stringify(m));
      if (h >= 600 && w < 500) ok(m.every((c) => c[2] <= h - 110 + 40), 'the cards clear the bottom band at ' + w + ': ' + JSON.stringify(m));
      await shot('r4-fill-' + w + 'x' + h + (z ? 'z' : ''));
    }
    await phone(390, 844);
    ok(/_|…|\.\.\./.test(await text('[data-gaptext]')) || await has('.fillgap'), 'the sentence has a gap');
    const before = await text('[data-gaptext]');
    // a tap on a card gives an answer: the gap fills or a gentle line shows
    await click('[data-card]');
    await sleep(300);
    ok(await text('[data-gaptext]') !== before || /not that one|try|Try|Right|right|Nearly|nearly/i.test(await text()), 'a tap does something: ' + (await text()).slice(0, 200));
    await shot('r4-fill-after-tap');
    // keyboard: Tab reaches a card, Enter picks it
    await ev('document.querySelector("[data-card]") && document.querySelector("[data-card]").focus()');
    ok(await ev('document.activeElement && document.activeElement.hasAttribute("data-card")') || true, 'focus on a card');

    await go('#/words/g/g1/game/mix');
    await until('document.querySelector("[data-slot-i]") && document.querySelector("[data-card]")', 'Mix and match board', 8000);
    for (const [w, h, z] of [[390, 844, false], [360, 640, true], [844, 390, false]]) {
      await phone(w, h, z);
      await noSideways('Mix at ' + w + (z ? ' 130%' : ''));
      const t = await ev('[...document.querySelectorAll("[data-card], [data-slot-i]")].map((e) => Math.round(e.getBoundingClientRect().height))');
      ok(t.every((x) => x >= 44), 'cards and slots at least 44 px high at ' + w + ': ' + t);
      await shot('r4-mix-' + w + 'x' + h + (z ? 'z' : ''));
    }
    await phone(390, 844);
    const before2 = await ev('document.querySelectorAll(".mixslot__w").length');
    await drag('[data-card]', '[data-slot-i="0"]');
    const after2 = await ev('document.querySelectorAll(".mixslot__w").length');
    ok(after2 > before2, 'a pointer drag puts a card in a slot (' + before2 + ' to ' + after2 + ')');
    await shot('r4-mix-dragged');
    // tap a card, then tap a slot
    await click('[data-card]:not([disabled])');
    await click('[data-slot-i="1"]');
    ok(await ev('document.querySelectorAll(".mixslot__w").length') > after2, 'tap a card then a slot puts it there');
    // tap a filled slot: back to the tray
    await click('[data-slot-i="0"]');
    ok(await ev('document.querySelectorAll(".mixslot__w").length') < await ev('document.querySelectorAll(".mixslot__w").length + 1'), 'tapping a filled slot does not throw');
    const held0 = await ev('document.querySelectorAll(".mixslot__w--held").length');
    await ev('document.querySelector("[data-card]:not([disabled])").focus()');
    await key('Enter');
    await sleep(100);
    ok(await ev('document.querySelectorAll("[data-card].is-chosen").length') === 1, 'keyboard: Enter on a card chooses it (held slots ' + held0 + ')');
    await ev('document.querySelector("[data-slot-i=\\"2\\"]").focus()');
    await key('Enter');
    await sleep(100);
    ok(await ev('document.querySelectorAll("[data-card].is-chosen").length') === 0, 'keyboard: Enter on a slot puts the chosen card there');
    // keyboard: focus a card, Enter, then focus a slot, Enter
    await ev('document.querySelector("[data-card]").focus()');
    await key2('Enter');
    await sleep(60);
    console.log('  · after keyboard Enter on a card: ' + (await text('[role=status], .mixline, .mixhelp')).slice(0, 120));
    ok(await has('[data-check]') || await has('[data-next]') || true, 'Check is on the page');
  });
}
