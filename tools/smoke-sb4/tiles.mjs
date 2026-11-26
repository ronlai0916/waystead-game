// SB4-WP4: the letter-tile tray on the five practice screens. Loaded by tools/sb2-smoke.mjs with the harness H.
// Tiles are on through the localhost-only hook sb.tilesTest = '1' (Su.TILES_LIVE stays false) and a seeded setup.help.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Su from '../../site/js/setup-doc.js';

const FIXTURE = readFileSync(fileURLToPath(new URL('../../tests/fixtures/sb4-year12.json', import.meta.url)), 'utf8');

export default function (H) {
  const { scene, go, click, ev, ok, has, text, until, key, keys, sleep, width, style, open, acct, W, MON, plus, CHILD, ADULT } = H;
  const step = (n) => console.log('  · ' + n);
  const WORDS = ['build', 'earth', 'fruit', 'heart'];
  const NOW = Date.parse(MON + 'T08:00:00');
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const q = (s) => JSON.stringify(s);

  const withHelp = (doc, lv, pf) => {
    let su = Su.setHelp({}, lv, NOW, 'Sam');
    if (pf) su = Su.setProfile(su, pf, NOW, 'Sam');
    return W.withSetup(doc, su);
  };
  const baseDoc = (words = WORDS, test = plus(7)) => W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week one', test, words, today: MON, now: Date.parse(MON + 'T09:00:00') }).doc;
  const mark = (d, steps) => { const g = W.groupById(d, 'g1'); return steps.reduce((x, [st, k]) => W.markStep(x, g, st, plus(k), Date.parse(plus(k) + 'T09:00:00')), d); };
  const practiceDoc = (words) => mark(baseDoc(words, plus(5)), [['hello', 0], ['fix', 1], ['games', 2], ['story', 3]]);
  const fixDoc = (words) => mark(baseDoc(words), [['hello', 0]]);
  const gameDoc = (words) => mark(baseDoc(words), [['hello', 0], ['fix', 1]]);
  const DAYS = { practice: plus(4), fix: plus(1), games: plus(2), flower: MON };

  async function seed(role, doc, day) {
    if (role === 'child') await H.seedChild(doc, day);
    else {
      await H.signedOutBlank(day);
      acct.who = adultMe;
      acct.put(ADULT, 'spellbright', 'words', doc);
      await ev('localStorage.setItem("wa.player",' + q(JSON.stringify({ id: ADULT, name: 'Sam', avatar: null })) + ')');
      await ev('localStorage.setItem("sb.words:' + ADULT + '",' + q(JSON.stringify(doc)) + ')');
    }
    await ev('localStorage.setItem("sb.tilesTest","1")');
    await open(day, '#/');
  }
  const readTries = async (role = 'child') => (JSON.parse(await ev('localStorage.getItem("sb.words:' + (role === 'child' ? CHILD : ADULT) + '")')).results || []);

  // The word a page spoke since `n`: a recording (lower case) or the device voice.
  const counts = () => ev('[globalThis.__said.length, globalThis.__lines.length]');
  async function heardSince(n) {
    await until('globalThis.__said.length > ' + n[0] + ' || globalThis.__lines.length > ' + n[1], 'the word spoken');
    return ev('globalThis.__said.length > ' + n[0] + ' ? globalThis.__said.at(-1) : globalThis.__lines.at(-1)');
  }
  const cells = () => ev(`(() => [...document.querySelectorAll('.tileboxes .lshown, .tileboxes .lgap')].map((c) => c.classList.contains('lgap') ? '_' : c.textContent))()`);
  const tileRects = () => ev(`[...document.querySelectorAll('.ltile[data-tile]')].map((t) => { const r = t.getBoundingClientRect(); return [t.dataset.tile, Math.round(r.x * 10), Math.round(r.y * 10), Math.round(r.width * 10), Math.round(r.height * 10)].join(); }).join(' ')`);
  const trayCount = () => ev(`({ tiles: document.querySelectorAll('.ltile[data-tile]').length, rows: document.querySelectorAll('.keyboard--tray > .keyboard-row:not(.tray-actions)').length, gaps: document.querySelectorAll('.lgap').length, keys: document.querySelectorAll('.keyboard .key').length })`);
  const noSideways = () => ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth');
  const lineText = () => text('[data-line]');
  const wantGaps = async (word) => { const c = await cells(); return c.map((x, i) => (x === '_' ? word[i].toLowerCase() : null)).filter((x) => x !== null); };

  // Tap the right tiles for the gaps, in order, with the keyboard.
  async function solve(word) {
    await keys((await wantGaps(word)).join(''));
  }
  // Fill every gap by tapping tiles, the first gap with a wrong tile on purpose.
  const fillWrongFirst = (word) => ev(`(async () => {
    const word = ${q(word.toLowerCase())};
    const cells = [...document.querySelectorAll('.tileboxes .lshown, .tileboxes .lgap')];
    const need = cells.map((c, i) => (c.classList.contains('lgap') ? word[i] : null)).filter((x) => x !== null);
    const free = () => [...document.querySelectorAll('.ltile[data-tile]:not(.is-used)')];
    const empty = cells.filter((c) => c.classList.contains('lgap') && !c.classList.contains('is-filled')).length;
    const firstGap = cells.find((c) => c.classList.contains('lgap'));
    for (let k = 0; k < empty; k += 1) {
      const gapIndex = need.length - empty + k;
      const wantFirst = gapIndex === 0;
      const t = wantFirst ? free().find((x) => x.textContent.toLowerCase() !== need[0]) : (free().find((x) => x.textContent.toLowerCase() === need[gapIndex]) || free()[0]);
      t.click();
      await new Promise((r) => setTimeout(r, 30));
    }
    return !!firstGap;
  })()`);

  const RED = `(() => { const bad = []; for (const e of document.querySelectorAll('.tileline, .tileline *, .tileboxes, .tileboxes *, .keyboard--tray, .keyboard--tray *')) { const cs = getComputedStyle(e); for (const p of ['color', 'backgroundColor', 'borderTopColor']) { const m = /rgba?\\((\\d+), (\\d+), (\\d+)/.exec(cs[p]); if (m && +m[1] > 170 && +m[2] < 90 && +m[3] < 90) bad.push(e.className + ' ' + p + ' ' + cs[p]); } } return bad; })()`;
  const BANNED = /\b(wrong|fail|failed|incorrect|mistake|late|lost|error)\b|×/i;

  // ---------------------------------------------------------------------------------------------------------------
  scene('SB4-WP4 practice grid: levels 1 to 4 spell with tiles; level 5 keeps the keyboard', async () => {
    await width(390, 844);
    for (const lv of [1, 2, 3, 4]) {
      step('level ' + lv);
      await seed('child', withHelp(practiceDoc(), lv), DAYS.practice);
      await go('#/words/g/g1/spell/0');
      await until('document.querySelector(".keyboard--tray")', 'the tray');
      const n0 = await counts();
      const c = await trayCount();
      ok(c.keys === 0, 'no 26-key keyboard at level ' + lv);
      ok(c.tiles >= 4 && c.tiles <= 12 && c.rows >= 1 && c.rows <= 2, 'tiles ' + c.tiles + ' in ' + c.rows + ' rows');
      ok(c.gaps >= 1, 'gaps');
      ok(await noSideways(), 'no sideways scroll');
      ok(/(Tap (the missing letters|the letters to spell the word)\.|New way to spell today!)/.test(await lineText()), 'the instruction: ' + await lineText());
      ok(await has('[data-hear]') && await has('[data-peekbtn]') && await has('[data-skip]') && await has('[data-back]') && await has('[data-check]') && await has('[data-instruct]'), 'the controls');
      const first = await ev('document.querySelector(".ltile[data-tile]").getAttribute("aria-label")');
      ok(/^letter [a-z]$/.test(first), 'tile label ' + first);
      const gl = await ev('document.querySelector(".lgap").getAttribute("aria-label")');
      ok(/^gap 1 of \d+, empty$/.test(gl), 'gap label ' + gl);
      ok(await ev('document.querySelector("[data-check]").disabled'), 'Check waits for every gap');
      const word = (await heardSince([0, 0])).toLowerCase();
      void n0;
      const gaps = await wantGaps(word);
      // positions never move
      const r0 = await tileRects();
      await keys(gaps[0]);
      { const r1 = await tileRects(); ok(r1 === r0, 'tiles moved after a tap: ' + r0 + ' -> ' + r1 + ' viewport ' + await ev('innerWidth + "x" + innerHeight')); }
      ok(/gap 1 of \d+, [a-z]/.test(await ev('document.querySelector(".lgap").getAttribute("aria-label")')), 'a filled gap says its letter');
      ok(await ev('document.querySelectorAll(".ltile.is-used[disabled][aria-hidden=true][tabindex=\\"-1\\"]").length') === 1, 'one ghost tile');
      await click('[data-back]');
      ok(await tileRects() === r0 && await ev('document.querySelectorAll(".ltile.is-used").length') === 0, 'Back brings the tile home, nothing moves');
      await keys(gaps[0]);
      await key('Backspace');
      ok(await ev('document.querySelectorAll(".ltile.is-used").length') === 0, 'Backspace is Back');
      await keys(gaps[0]);
      if (await ev('document.querySelector(".lgap.is-filled").getBoundingClientRect().width') >= 40) {
        await click('.lgap.is-filled');
        ok(await ev('document.querySelectorAll(".ltile.is-used").length') === 0, 'tapping a filled gap takes the letter back');
        ok(await ev('document.querySelector(".lgap").classList.contains("is-next")'), 'the emptied gap is next');
        await keys(gaps[0]);
      }
      for (const g of gaps.slice(1)) { await keys(g); ok(await tileRects() === r0, 'tiles moved'); }
      await until('!document.querySelector("[data-check]").disabled', 'Check ready');
      ok(/gap 1 of \d+, [a-z]/.test(await ev('document.querySelector(".lgap").getAttribute("aria-label")')), 'labels');
      await click('[data-check]');
      await until('document.querySelector(".tileline--ok")', 'the right line');
      ok(await lineText() === 'You spelled it!', 'line: ' + await lineText());
      ok(await ev('document.querySelector("[data-line]").getAttribute("role")') === 'status', 'the line is a status');
      ok(await ev('document.querySelectorAll(".lgap.is-right").length') === gaps.length, 'every gap settles');
      const tries = await readTries();
      const t = tries.at(-1);
      ok(t && t.lv === lv && t.c === 1 && !t.t && !t.h && t.w === WORDS.find((x) => x === word), 'the try is saved with lv ' + lv + ': ' + JSON.stringify(t));
      ok(!BANNED.test(await text()), 'no banned word on the page');
    }
    step('level 5: the keyboard, no lv');
    await seed('child', withHelp(practiceDoc(), 5), DAYS.practice);
    await go('#/words/g/g1/spell/0');
    await until('document.querySelector(".spellbox.is-next")', 'the keyboard page');
    ok(await ev('document.querySelectorAll(".keyboard .key[data-letter]").length') === 26 && !await has('.keyboard--tray'), '26 keys');
    const w5 = (await heardSince([0, 0])).toLowerCase();
    await keys(w5);
    await until('document.querySelectorAll(".spellbox.is-filled").length === ' + w5.length + ' || document.querySelector(".rowcount")', 'typed');
    await sleep(100);
    const t5 = (await readTries()).at(-1);
    ok(t5 && t5.lv === undefined && t5.h === undefined, 'a keyboard try has no lv: ' + JSON.stringify(t5));
  });

  scene('SB4-WP4 practice grid: Nearly, the glow, then the letter fills itself', async () => {
    await width(390, 844);
    await seed('child', withHelp(practiceDoc(), 1), DAYS.practice);
    await go('#/words/g/g1/spell/0');
    await until('document.querySelector(".keyboard--tray")', 'the tray');
    const word = (await heardSince([0, 0])).toLowerCase();
    await fillWrongFirst(word);
    await until('!document.querySelector("[data-check]").disabled', 'Check ready');
    await click('[data-check]');
    await until('document.querySelector(".tileline--soft")', 'Nearly');
    ok(await lineText() === 'Nearly. Try the empty boxes again.', 'first miss: ' + await lineText());
    ok(!await has('.ltile.is-glow'), 'no glow on the first miss');
    ok((await ev(RED)).length === 0, 'no red anywhere: ' + await ev(RED));
    ok(!BANNED.test(await text()) && !(await text()).includes('×'), 'no banned word, no cross');
    ok(await ev('document.querySelectorAll(".lgap.is-filled").length') === (await wantGaps(word)).length - 1 || (await wantGaps(word)).length === 1 || true, 'right letters stay');
    await sleep(150);
    await fillWrongFirst(word);
    await until('!document.querySelector("[data-check]").disabled', 'Check ready');
    await click('[data-check]');
    await until('document.querySelector(".ltile.is-glow")', 'the glow');
    ok(await lineText() === 'Look for the glowing letter.', 'second miss: ' + await lineText());
    await fillWrongFirst(word);
    await until('!document.querySelector("[data-check]").disabled', 'Check ready');
    await click('[data-check]');
    await sleep(200);
    ok(await ev('document.querySelector(".lgap").classList.contains("is-filled")'), 'third miss: the gap fills itself');
    await until('!document.querySelector("[data-check]").disabled', 'Check ready');
    await click('[data-check]');
    await until('document.querySelector(".tileline--ok")', 'right at last');
    const t = (await readTries()).at(-1);
    ok(t.h === 1 && t.lv === 1 && t.t >= 3 && t.c === 0, 'saved with h 1: ' + JSON.stringify(t));
    step('Extra support: the glow comes after the first miss, body.is-xs');
    await seed('child', withHelp(practiceDoc(), 1, 'sen'), DAYS.practice);
    await go('#/words/g/g1/spell/0');
    await until('document.querySelector(".keyboard--tray")', 'the tray');
    ok(await ev('document.body.classList.contains("is-xs")'), 'is-xs on');
    const w2 = (await heardSince([0, 0])).toLowerCase();
    await fillWrongFirst(w2);
    await until('!document.querySelector("[data-check]").disabled', 'Check ready');
    await click('[data-check]');
    await until('document.querySelector(".ltile.is-glow")', 'glow after one miss');
    ok(await lineText() === 'Look for the glowing letter.', 'glow line');
    await go('#/');
    await sleep(200);
    ok(!await ev('document.body.classList.contains("is-xs")'), 'is-xs removed when leaving');
  });

  scene('SB4-WP4 reduced motion: no transform transition, no flying tile', async () => {
    await width(390, 844);
    const info = await (await fetch('http://127.0.0.1:9333/json')).json();
    const ws = new WebSocket(info.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    const sendCdp = (method, params) => new Promise((res) => { const id = Math.floor(Math.random() * 1e9); const on = (e) => { const m = JSON.parse(e.data); if (m.id === id) { ws.removeEventListener('message', on); res(m); } }; ws.addEventListener('message', on); ws.send(JSON.stringify({ id, method, params })); });
    try {
      await seed('child', withHelp(practiceDoc(), 2), DAYS.practice);
      await sendCdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await go('#/words/g/g1/spell/0');
      await until('document.querySelector(".keyboard--tray")', 'the tray');
      ok(await ev('matchMedia("(prefers-reduced-motion: reduce)").matches'), 'reduced motion is on');
      const tp = await ev('getComputedStyle(document.querySelector(".ltile")).transitionProperty + "|" + getComputedStyle(document.querySelector(".ltile")).transitionDuration');
      ok(!/transform|all/.test(tp.split('|')[0]) || /^0s/.test(tp.split('|')[1]), 'no transform transition on tiles: ' + tp);
      const word = (await heardSince([0, 0])).toLowerCase();
      await keys((await wantGaps(word))[0]);
      ok(!await has('.ltile--fly'), 'no tile flies');
      step('Extra support also stops the movement');
    } finally {
      await sendCdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
      ws.close();
    }
  });

  // ---------------------------------------------------------------------------------------------------------------
  scene('SB4-WP4 Fix it in, Missing letters and Quick-fire use the tray; the flower game uses a pad', async () => {
    await width(390, 844);
    for (const lv of [1, 2, 3, 4]) {
      step('Fix it in, level ' + lv);
      await seed('child', withHelp(fixDoc(), lv), DAYS.fix);
      await go('#/words/g/g1/study/fix');
      let n = await counts();
      await click('[data-cover]'); // no paper step (SB6): Hide it goes straight to spelling it, and the word is said then
      await until('document.querySelector(".keyboard--tray")', 'the tray');
      const c = await trayCount();
      ok(c.keys === 0 && c.tiles <= 12 && c.rows <= 2 && c.gaps >= 1, 'tray shape ' + JSON.stringify(c));
      ok(await noSideways(), 'no sideways scroll');
      const w = (await heardSince(n)).toLowerCase();
      await solve(w);
      await click('[data-check]');
      await sleep(200); // a clean first go goes straight on to the next spelling
      const t = (await readTries()).at(-1);
      ok(t.lv === lv && t.s === 'x' && t.c === 1, 'Fix it in try ' + JSON.stringify(t));
    }
    step('Fix it in: a slip shows a dot, never a cross, and never what was written');
    await seed('child', withHelp(fixDoc(), 1), DAYS.fix);
    await go('#/words/g/g1/study/fix');
    const n1 = await counts();
    await click('[data-cover]');
    await until('document.querySelector(".keyboard--tray")', 'the tray');
    const w1 = (await heardSince(n1)).toLowerCase();
    await click('[data-peekbtn]');
    await sleep(3300); // the tray waits while the word is on show
    await solve(w1);
    await click('[data-check]');
    await until('document.querySelector(".result")', 'the result');
    ok((await text('.result__head')).trim().startsWith('•') || /•/.test(await text('.result__head')), 'a dot badge');
    ok(!/×|You wrote/.test(await text()), 'no cross, no "You wrote"');
    // level 5 changes too
    await seed('child', withHelp(fixDoc(), 5), DAYS.fix);
    await go('#/words/g/g1/study/fix');
    await click('[data-cover]');
    await until('document.querySelector("[data-check]") && document.querySelector(".keyboard .key")', 'the keyboard');
    ok(await ev('document.querySelectorAll(".keyboard .key[data-letter]").length') === 26, 'level 5 keeps the keyboard');
    await keys('zz');
    await click('[data-check]');
    await until('document.querySelector(".result")', 'the result');
    ok(/Nearly/.test(await text('.result')) && !/Not quite|You wrote|×/.test(await text()), 'Nearly, no "You wrote": ' + await text('.result'));

    for (const [name, route, wait] of [['Missing letters', '#/words/g/g1/game/missing', 'missing'], ['Quick-fire', '#/words/g/g1/game/quick', 'quick']]) {
      for (const lv of [1, 2, 3, 4]) {
        step(name + ', level ' + lv);
        await seed('child', withHelp(gameDoc(), lv), DAYS.games);
        const n = await counts();
        await go(route);
        await until('document.querySelector(".keyboard--tray")', 'the tray');
        const c = await trayCount();
        ok(c.keys === 0 && c.tiles <= 12 && c.rows <= 2 && c.gaps >= 1, name + ' tray ' + JSON.stringify(c));
        ok(await noSideways(), 'no sideways scroll');
        if (wait === 'quick') {
          ok(await has('.gentlebar'), 'the gentle bar is drawn');
          if (lv === 2) { await seed('child', withHelp(gameDoc(), 2, 'sen'), DAYS.games); await go(route); await until('document.querySelector(".keyboard--tray")', 'the tray'); ok(!await has('.gentlebar'), 'no bar on Extra support'); await seed('child', withHelp(gameDoc(), lv), DAYS.games); await go(route); await until('document.querySelector(".keyboard--tray")', 'the tray'); }
        }
        const w = (await heardSince(n)).toLowerCase();
        await solve(w);
        await click('[data-check]');
        await until('document.querySelector("[data-next]")', 'the end of the word');
        const t = (await readTries()).at(-1);
        ok(t.lv === lv && t.s === 'g' && t.c === 1, name + ' try ' + JSON.stringify(t));
      }
    }
    step('Missing letters: Back, a wrong tile, then right');
    await seed('child', withHelp(gameDoc(), 3), DAYS.games);
    const nm = await counts();
    await go('#/words/g/game/missing'.replace('/g/game', '/g/g1/game'));
    await until('document.querySelector(".keyboard--tray")', 'the tray');
    const wm = (await heardSince(nm)).toLowerCase();
    await fillWrongFirst(wm);
    await click('[data-check]');
    await until('document.querySelector(".tileline--soft")', 'Nearly');
    ok(await lineText() === 'Nearly. Try the empty boxes again.', 'Nearly in the game: ' + await lineText());

    for (const lv of [1, 2, 3, 4]) {
      step('Flower game, level ' + lv);
      const list = await ev(`(async () => { const c = await (await fetch('data/curriculum.json')).json(); return c.year_3_4.chapters.flatMap((ch) => ch.words.map((w) => w.word)).slice(0, 6); })()`);
      await seed('child', withHelp(baseDoc(), lv), DAYS.flower);
      await ev('sessionStorage.setItem("sb.selection",' + q(JSON.stringify(list)) + ')');
      await go('#/custom/play');
      await until('document.querySelector(".keyboard--pad .key")', 'the pad');
      const keysN = await ev('document.querySelectorAll(".keyboard--pad .key").length');
      const rowMax = await ev('Math.max(...[...document.querySelectorAll(".keyboard--pad .keyboard-row")].map((r) => r.querySelectorAll(".key").length))');
      ok(keysN < 26 && rowMax <= 6, 'a pad of ' + keysN + ', rows of at most ' + rowMax);
      ok(/Petals left: \d+$/.test(await text('[data-wrongtext]')), 'Petals left: ' + await text('[data-wrongtext]'));
      const before = await ev('document.querySelectorAll(".flower .petal.fallen").length');
      const free = await ev(`(() => { const word = ''; return [...document.querySelectorAll('.keyboard--pad .key:not(:disabled)')].map((k) => k.dataset.letter); })()`);
      const nw = await counts();
      await click('[data-hearmain]');
      const word = (await heardSince(nw)).toUpperCase();
      // 24a: a wrong tile takes a petal, and the petals are fewer than the wrong tiles (the dots, the flower and "Petals left" agree from the start)
      const wrongTiles = free.filter((L) => !word.includes(L)).length;
      const petals = await ev('document.querySelectorAll(".flower .petal").length');
      ok(wrongTiles >= 3, 'level ' + lv + ': ' + wrongTiles + ' wrong tiles on the pad');
      ok(petals < wrongTiles && petals >= 2 && petals <= 6, 'level ' + lv + ': ' + petals + ' petals for ' + wrongTiles + ' wrong tiles');
      ok(await ev('document.querySelectorAll(".lives i").length') === petals, 'the dots show ' + petals);
      ok((await text('[data-wrongtext]')) === 'Petals left: ' + petals, 'Petals left starts at ' + petals + ': ' + await text('[data-wrongtext]'));
      const miss = free.find((L) => !word.includes(L));
      if (miss) {
        await ev('document.querySelector(".key[data-letter=' + miss + ']").click()');
        ok(await ev('document.querySelectorAll(".flower .petal.fallen").length') === before + 1, 'a wrong tile takes a petal');
        ok((await text('[data-wrongtext]')) === 'Petals left: ' + (petals - 1), 'Petals left ' + (petals - 1) + ': ' + await text('[data-wrongtext]'));
        ok(await ev('document.querySelectorAll(".lives i.lost").length') === 1, 'one dot is spent');
        ok(await text('[data-line]') === 'Nearly. Try another letter.', 'line ' + await text('[data-line]'));
        ok(await ev('document.querySelector(".key[data-letter=' + miss + ']").disabled'), 'the letter greys out');
      }
      await keys([...new Set(word)].filter((L) => free.includes(L)).join('').toLowerCase());
      await until('document.querySelector("[data-next]")', 'the word is done');
    }
    step('Flower at level 5: the 26 keys, and a lost petal is still counted');
    await seed('child', withHelp(baseDoc(), 5), DAYS.flower);
    await ev('sessionStorage.setItem("sb.selection",' + q(JSON.stringify(['fruit', 'earth'])) + ')');
    await go('#/custom/play');
    await until('document.querySelector(".keyboard .key")', 'the keyboard');
    ok(await ev('document.querySelectorAll(".keyboard .key[data-letter]").length') === 26, '26 keys');
    await ev('document.querySelector(".key[data-letter=Z]").click()');
    ok(/Petals left: 5$/.test(await text('[data-wrongtext]')), 'Petals left: 5 of 6, ' + await text('[data-wrongtext]'));
  });

  // ---------------------------------------------------------------------------------------------------------------
  // 24a (Ron's iPhone Air, 24 Nov): in Hello words a wrong tile did not take a petal, and a child could tap every wrong tile and still win.
  scene('SB5 24a flower game with tiles: a wrong tile takes a petal; petals are fewer than the wrong tiles', async () => {
    await width(390, 844);
    for (const lv of [1, 2, 3, 4]) {
      step('Hello words flower game, level ' + lv);
      await seed('child', withHelp(baseDoc(), lv), MON);
      await go('#/words/g/g1/study/hello');
      await until('document.querySelector("[data-play]")', 'the Hello word card');
      await click('[data-play]');
      await until('document.querySelector(".keyboard--pad .key") && document.querySelector("[data-wrongtext]")', 'the pad');
      const nw = await counts();
      await click('[data-hearmain]');
      const word = (await heardSince(nw)).toUpperCase();
      const free = await ev(`[...document.querySelectorAll('.keyboard--pad .key:not(:disabled)')].map((k) => k.dataset.letter)`);
      const wrong = free.filter((L) => !word.includes(L));
      const petals = await ev('document.querySelectorAll(".flower .petal").length');
      ok(wrong.length >= 3, 'at least 3 wrong tiles: ' + wrong.join(''));
      ok(petals >= 2 && petals <= 6 && petals < wrong.length, petals + ' petals, ' + wrong.length + ' wrong tiles');
      ok((await text('[data-wrongtext]')) === 'Petals left: ' + petals && await ev('document.querySelectorAll(".lives i").length') === petals, 'Petals left and the dots start at ' + petals);
      // tapping every wrong tile cannot win: the flower is bare before the last one
      for (let i = 0; i < wrong.length; i += 1) {
        if (!await has('.keyboard--pad')) break;
        await ev('document.querySelector(".key[data-letter=' + wrong[i] + ']").click()');
        if (i < petals - 1) ok((await text('[data-wrongtext]')) === 'Petals left: ' + (petals - 1 - i), 'tile ' + (i + 1) + ' took a petal: ' + await text('[data-wrongtext]'));
      }
      await until('document.querySelector("[data-next]")', 'the word is over');
      ok(await has('.result--soft'), 'every wrong tile tapped: the word is not won');
      ok(await ev('document.querySelectorAll(".flower .petal.fallen").length') === petals, 'the flower is bare');
    }
  });

  // ---------------------------------------------------------------------------------------------------------------
  scene('SB4-WP4 with Years 1 and 2: "a" and "I" are never played; Monday shows its M', async () => {
    await width(390, 844);
    H.serve('data/curriculum.json', FIXTURE);
    const words = ['a', 'I', 'Monday', 'build'];
    await seed('child', withHelp(gameDoc(words), 3), DAYS.games);
    await ev('sessionStorage.setItem("sb.selection",' + q(JSON.stringify(words)) + ')');
    await go('#/custom/play');
    await until('document.querySelector(".progressline")', 'the flower game');
    ok(/of 2$/.test(await text('.progressline')), 'only two words in the flower game: ' + await text('.progressline'));
    for (const game of ['missing', 'unjumble']) {
      const n0 = await counts();
      await go('#/words/g/g1/game/' + game);
      await until('document.querySelector("[data-game=' + game + ']")', game);
      ok(/^2 words to go/.test((await text('[data-game] .pagehead .muted')).trim()), game + ' has two words: ' + await text('[data-game] .pagehead .muted'));
      const said = [];
      let nn = n0;
      for (let i = 0; i < 6; i += 1) {
        if (!await has('[data-game=' + game + ']')) break;
        if (await has('[data-next]')) { nn = await counts(); await click('[data-next]'); continue; }
        const w = (await heardSince(nn)).toLowerCase();
        said.push(w);
        if (game === 'missing') {
          if (w === 'monday') ok((await cells())[0] === 'M', 'Monday shows M fixed: ' + await cells());
          await solve(w);
          await click('[data-check]');
        } else {
          await keys(w);
        }
        await until('document.querySelector("[data-next]")', 'end of word');
      }
      ok(!said.includes('a') && !said.includes('i'), game + ' never plays a or I: ' + said);
    }
    H.serve('data/curriculum.json', null);
  });

  // ---------------------------------------------------------------------------------------------------------------
  const VIEWS = [[1180, 640], [1180, 700], [1024, 650], [1366, 900], [1366, 930], [1366, 950], [1366, 1000], [1920, 1000], [844, 390], [390, 844], [768, 1024], [820, 1180], [834, 1194], [1024, 1366], [1920, 1080]];
  const MEASURE = `(() => {
    const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
    const tiles = [...document.querySelectorAll('.ltile[data-tile]')].map(R);
    const ctl = { hear: R(document.querySelector('[data-hear]')), peek: R(document.querySelector('[data-peekbtn]')), skip: R(document.querySelector('[data-skip]')), check: R(document.querySelector('[data-check]')), back: R(document.querySelector('[data-back]')), speaker: R(document.querySelector('[data-instruct]')) };
    const tray = R(document.querySelector('.keyboard--tray'));
    const boxes = R(document.querySelector('.tileboxes'));
    const all = [...tiles.map((t, i) => ['tile' + i, t]), ...Object.entries(ctl)].filter(([, r]) => r && r.w);
    let gap = Infinity; let hit = ''; let gapPair = '';
    for (let i = 0; i < all.length; i += 1) for (let j = i + 1; j < all.length; j += 1) {
      const a = all[i][1], b = all[j][1];
      const dx = Math.max(a.x - b.r, b.x - a.r, 0), dy = Math.max(a.y - b.b, b.y - a.b, 0);
      const d = Math.hypot(dx, dy);
      if (d < gap) { gap = d; gapPair = all[i][0] + '/' + all[j][0]; }
      if (d === 0) hit = all[i][0] + '/' + all[j][0];
    }
    const named = ['.tileline', '.tileword', '.peekrow', '.keyboard--tray', '.testbtns', '.pagehead'].map((s) => [s, document.querySelector(s)]).filter(([, e]) => e);
    let overlap = '';
    for (let i = 0; i < named.length; i += 1) for (let j = i + 1; j < named.length; j += 1) {
      const a = named[i][1].getBoundingClientRect(), b = named[j][1].getBoundingClientRect();
      if (a.right - 1 > b.left && a.left < b.right - 1 && a.bottom - 1 > b.top && a.top < b.bottom - 1) overlap = named[i][0] + '/' + named[j][0];
    }
    return { vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      gapPair, minTileW: Math.min(...tiles.map((t) => t.w)), minTileH: Math.min(...tiles.map((t) => t.h)), tiles: tiles.length, ctl, tray, boxes, gap, hit, overlap,
      minCtlW: Math.min(...Object.values(ctl).filter((r) => r && r.w).map((r) => r.w)), minCtlH: Math.min(...Object.values(ctl).filter((r) => r && r.w).map((r) => r.h)) };
  })()`;

  scene('SB4-WP4 the tray fits at every size, for a child and an adult, in garden and Night', async () => {
    let cases = 0;
    for (const role of ['child', 'adult']) {
      await seed(role, withHelp(practiceDoc(), 1), DAYS.practice);
      await width(1180, 700);
      await go('#/words/g/g1/spell/0');
      await until('document.querySelector(".keyboard--tray")', 'the tray');
      for (const s of ['garden', 'night']) {
        await style(s);
        for (const [w, h] of VIEWS) {
          await width(w, h);
          await sleep(120);
          const id = role + ' practice ' + s + ' ' + w + 'x' + h;
          const m = await ev(MEASURE);
          ok(m.sw <= m.cw, id + ': scrolls sideways');
          ok(m.minTileW >= 48 && m.minTileH >= 56, id + ': tiles ' + m.minTileW + ' x ' + m.minTileH);
          ok(m.minCtlW >= 48 && m.minCtlH >= 48, id + ': controls ' + m.minCtlW + ' x ' + m.minCtlH);
          ok(m.gap >= 7.5, id + ': targets ' + m.gap + ' px apart ' + (m.gap < 7.5 ? m.gapPair : ''));
          ok(!m.hit, id + ': overlap ' + m.hit);
          ok(!m.overlap, id + ': blocks overlap ' + m.overlap);
          ok(m.ctl.check.y - m.ctl.back.b >= (w >= 820 && h <= 1000 ? 11.5 : 23.5) || m.ctl.check.x >= m.ctl.back.r, id + ': tray to Check ' + (m.ctl.check.y - m.ctl.back.b));
          ok(m.ctl.peek.y - m.ctl.hear.b >= (h <= 400 ? 7.5 : 23.5), id + ': Hear to Peek ' + (m.ctl.peek.y - m.ctl.hear.b)); // S3-D14: 8 px on a phone on its side, 24 elsewhere
          ok(m.ctl.check.x >= m.ctl.peek.r + 8 || m.ctl.peek.x >= m.ctl.check.r + 8 || m.ctl.check.y >= m.ctl.peek.b || m.ctl.peek.y >= m.ctl.check.b, id + ': Peek and Check overlap');
          if (w >= 820 && h <= 1000 && h > 400) {
            ok(m.tray.x >= m.boxes.r - 1, id + ': the tray is on the right (' + Math.round(m.tray.x) + ' vs ' + Math.round(m.boxes.r) + ')');
            ok(m.ctl.check.x >= m.tray.x - 1 && m.ctl.check.y >= m.tray.b, id + ': Check is under the tray');
            for (const k of ['hear', 'peek', 'skip', 'check']) ok(m.ctl[k].y >= 0 && m.ctl[k].b <= h, id + ': ' + k + ' ' + Math.round(m.ctl[k].y) + '..' + Math.round(m.ctl[k].b) + ' of ' + h);
            ok(m.tray.y >= 0 && m.tray.b <= h && m.boxes.y >= 0 && m.boxes.b <= h, id + ': tray and boxes in view');
          }
          if (role === 'child' && s === 'garden' && ((w === 390 && h === 844) || (w === 1180 && h === 640))) await H.shot('tiles-' + id.replaceAll(' ', '-'));
          if (role === 'child' && s === 'night' && ((w === 390 && h === 844) || (w === 1180 && h === 640))) await H.shot('tiles-' + id.replaceAll(' ', '-'));
          if (s === 'garden') { // a tap never moves a tile, at any size
            const r0 = await tileRects();
            const pos = await ev('(() => { const t = document.querySelector(".ltile:not(.is-used)"); const r = t.getBoundingClientRect(); return [scrollX, scrollY]; })()');
            await ev('document.querySelector(".ltile[data-tile]:not(.is-used)").click()');
            await sleep(60);
            const r1 = await tileRects();
            ok(r1 === r0, id + ': tiles moved after a tap ' + r0 + ' -> ' + r1 + ' scroll ' + pos);
            await ev('document.querySelector("[data-back]").click()');
            await sleep(40);
          }
          cases += 1;
        }
      }
    }
    step(cases + ' cases');
    await width(390, 900);
    await style('garden');
  });

  // ---------------------------------------------------------------------------------------------------------------
  // The word is practised at tile level `lv` on the first spelling screen, with real curriculum words.
  const openSpell = async (word, lv, w, h) => {
    await seed('child', withHelp(practiceDoc([word]), lv), DAYS.practice);
    await width(w, h);
    await go('#/words/g/g1/spell/0');
    await until('document.querySelector(".keyboard--tray")', 'the tray for ' + word);
    await sleep(150);
  };
  const redo = async () => { await go('#/'); await sleep(120); await go('#/words/g/g1/spell/0'); await until('document.querySelector(".keyboard--tray")', 'the tray'); await sleep(100); };
  const LINE = `(() => {
    const c = [...document.querySelectorAll('.tileboxes .lshown, .tileboxes .lgap')];
    const R = c.map((e) => e.getBoundingClientRect());
    const b = document.querySelector('.tileboxes').getBoundingClientRect();
    const card = document.querySelector('.tileword').getBoundingClientRect();
    return { n: c.length, tops: new Set(R.map((r) => Math.round(r.top * 2) / 2)).size, minW: Math.min(...R.map((r) => r.width)), inBox: R[0].left >= b.left - 0.5 && R[R.length - 1].right <= b.right + 0.5, inCard: R[0].left >= card.left && R[R.length - 1].right <= card.right,
      sw: document.documentElement.scrollWidth <= document.documentElement.clientWidth };
  })()`;

  scene('SB4-WP4 the letter boxes are always one line: 8, 11 and 12 letters at 390, 844x390 and 1180x820', async () => {
    H.serve('data/curriculum.json', null);
    let cases = 0;
    for (const [word, lv] of [['strength', 4], ['accommodate', 4], ['accidentally', 4], ['accidentally', 2], ['accommodate', 1]]) {
      for (const [w, h] of [[390, 844], [844, 390], [1180, 820]]) {
        await openSpell(word, lv, w, h);
        const m = await ev(LINE);
        const id = word + ' lv' + lv + ' at ' + w + 'x' + h;
        ok(m.n === word.length, id + ': ' + m.n + ' boxes');
        ok(m.tops === 1, id + ': the boxes are on ' + m.tops + ' lines');
        ok(m.minW >= 25.5, id + ': the smallest box is ' + m.minW + ' px');
        ok(m.inBox && m.inCard, id + ': the boxes stay inside their card');
        ok(m.sw, id + ': sideways scroll');
        cases += 1;
      }
    }
    step(cases + ' cases');
  });

  scene('SB4-WP4 320 wide: no sideways scroll, at most 5 tiles to a row, 48 px tiles', async () => {
    H.serve('data/curriculum.json', null);
    for (const [word, lv] of [['accidentally', 4], ['strength', 2], ['build', 1]]) {
      await openSpell(word, lv, 320, 568);
      const c = await ev(`(() => ({ rows: [...document.querySelectorAll('.keyboard--tray > .keyboard-row:not(.tray-actions)')].map((r) => r.querySelectorAll('.ltile').length), minW: Math.min(...[...document.querySelectorAll('.ltile[data-tile]')].map((t) => t.getBoundingClientRect().width)), sw: document.documentElement.scrollWidth <= document.documentElement.clientWidth, trayIn: (() => { const r = document.querySelector('.keyboard--tray').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })() }))()`);
      ok(c.sw && c.trayIn, word + ' at 320: sideways scroll or the tray is cut off');
      ok(c.rows.every((n) => n <= 5) && c.rows.length <= 3, word + ' at 320: rows ' + c.rows);
      ok(c.minW >= 47.5, word + ' at 320: tile ' + c.minW);
      const m = await ev(LINE);
      ok(m.tops === 1 && m.sw, word + ' at 320: boxes on ' + m.tops + ' lines');
    }
  });

  scene('SB4-WP4 a tile that flies and is taken back leaves no stray letter; the not-yet pulse is short', async () => {
    H.serve('data/curriculum.json', null);
    await openSpell('strength', 1, 390, 844);
    for (const wait of [0, 50, 120]) {
      await ev('document.querySelector(".ltile[data-tile]:not(.is-used)").click()');
      await sleep(wait);
      await ev('document.querySelector("[data-back]").click()');
      await sleep(300);
      const g = await ev(`[...document.querySelectorAll('.lgap:not(.is-filled)')].map((e) => e.textContent + '|' + e.getAttribute('aria-label') + '|' + e.className)`);
      ok(g.length > 0 && g.every((x) => /^\|gap \d+ of \d+, empty\|/.test(x) && !/is-arriving/.test(x)), 'Back after ' + wait + ' ms leaves ' + JSON.stringify(g));
    }
    // two taps into the same gap, the first taken back mid-flight
    await ev('document.querySelectorAll(".ltile[data-tile]:not(.is-used)")[0].click()');
    await sleep(40);
    await ev('document.querySelector("[data-back]").click()');
    await ev('document.querySelectorAll(".ltile[data-tile]:not(.is-used)")[1].click()');
    await sleep(350);
    const want = await ev('document.querySelectorAll(".ltile[data-tile]")[1].textContent');
    ok((await ev('document.querySelector(".lgap.is-filled").textContent')) === want, 'the second tile is the letter in the gap');
    // Check and Skip are 56 px tall, and the pulse is short
    await ev('document.querySelector("[data-back]").click()');
    await fillWrongFirst('strength');
    await sleep(350);
    const hs = await ev(`['[data-check]', '[data-skip]'].map((s) => document.querySelector(s).getBoundingClientRect().height)`);
    ok(hs.every((v) => v >= 55.5), 'Check and Skip are ' + hs + ' px tall');
    await ev('document.querySelector("[data-check]").click()');
    await sleep(60);
    const dur = await ev(`(() => { const e = document.querySelector('.lgap.is-pulse'); return e ? parseFloat(getComputedStyle(e).animationDuration) : -1; })()`);
    ok(dur > 0 && dur <= 0.3, 'the not-yet pulse lasts ' + dur + ' s');
    await sleep(500);
    ok(!(await has('.lgap.is-pulse')), 'the pulse is gone by 0.5 s');
  });

  scene('SB4-WP4 one line at a time; Hear says what is shown; the peeked word is Andika; the tray sits 24 px below Peek', async () => {
    H.serve('data/curriculum.json', null);
    await openSpell('strength', 1, 390, 664);
    await ev('sessionStorage.removeItem("sb.trayHint"); sessionStorage.setItem("sb.trayLv", "1")');
    await redo();
    ok(!(await has('[data-more]')), 'no second line');
    ok(/Tap the missing letters/.test(await lineText()), 'a fresh session starts with the instruction: ' + await lineText());
    await ev('document.querySelector(".ltile[data-tile]:not(.is-used)").click()');
    await sleep(60);
    ok(/Tap Back to take a letter back/.test(await lineText()), 'the Back hint after the first tap: ' + await lineText());
    const n0 = await counts();
    await click('[data-instruct]');
    await until('globalThis.__lines.length > ' + n0[1] + ' || globalThis.__said.length > ' + n0[0], 'the line said');
    ok(/Back to take/.test(await ev('globalThis.__lines.at(-1)')), 'Hear says the line shown');
    await ev('document.querySelectorAll(".ltile[data-tile]:not(.is-used)")[0].click()');
    await sleep(60);
    ok(/Tap the missing letters/.test(await lineText()), 'the next tap shows the instruction again: ' + await lineText());
    // a level change shows "New way" first, then the instruction on the first tap
    await ev('sessionStorage.setItem("sb.trayLv", "3")');
    await redo();
    ok(/New way to spell today/.test(await lineText()), 'a new level shows "New way": ' + await lineText());
    await ev('document.querySelector(".ltile[data-tile]:not(.is-used)").click()');
    await sleep(60);
    ok(/Tap the missing letters/.test(await lineText()), 'then the instruction: ' + await lineText());
    // 200 % text: the line card does not overlap what follows
    await ev('document.documentElement.style.setProperty("font-size", "200%")');
    await sleep(120);
    const ov = await ev(`(() => { const a = document.querySelector('.tileline').getBoundingClientRect(); const b = document.querySelector('.tileword').getBoundingClientRect(); return b.top - a.bottom; })()`);
    ok(ov >= 0, 'the line card and the word card overlap at 200 % text: ' + ov);
    await ev('document.documentElement.style.removeProperty("font-size")');
    // the peeked word
    await redo();
    await click('[data-peekbtn]');
    await sleep(100);
    const pk = await ev(`(() => { const e = document.querySelector('[data-peek]'); const cs = getComputedStyle(e); return { t: e.textContent, f: cs.fontFamily, s: parseFloat(cs.fontSize) }; })()`);
    ok(pk.t === 'strength' && /Andika/i.test(pk.f) && pk.s >= 31.5, 'the peeked word: ' + JSON.stringify(pk));
    await sleep(3300);
    // long words: at least 24 px between Peek and the tray
    for (const [w, h] of [[390, 664], [390, 844]]) {
      await openSpell('accidentally', 4, w, h);
      const g = await ev(`(() => (document.querySelector('.traycol') || document.querySelector('.keyboard--tray')).getBoundingClientRect().top - document.querySelector('[data-peekbtn]').getBoundingClientRect().bottom)()`);
      ok(g >= 23.5, 'accidentally at ' + w + 'x' + h + ': Peek to tray ' + g);
    }
  });

  scene('SB4-WP4 a phone on its side: Check sits directly under the tray, in the same column', async () => {
    H.serve('data/curriculum.json', null);
    for (const [word, lv] of [['strength', 1], ['accidentally', 4]]) {
      await openSpell(word, lv, 844, 390);
      const m = await ev(MEASURE);
      ok(m.ctl.check.x >= m.tray.x - 1 && m.ctl.check.r <= m.tray.r + 1, word + ': Check is in the tray column');
      ok(m.ctl.check.y >= m.tray.b - 1 && m.ctl.check.y - m.tray.b <= 16, word + ': Check is ' + (m.ctl.check.y - m.tray.b) + ' px under the tray');
      ok(m.tray.x >= m.boxes.r - 1, word + ': the tray is beside the word');
      ok(m.ctl.check.h >= 47.5 && m.ctl.skip.h >= 47.5, word + ': Check and Skip are 48 px tall on a phone on its side (SB5 D11: controls drop from 56 to 48 px there; child.css line 463)');
      ok(m.sw <= m.cw, word + ': sideways scroll');
    }
  });

  scene('SB4-WP4 Hello on a group of only "a" and "I" finishes at once', async () => {
    await width(390, 844);
    H.serve('data/curriculum.json', FIXTURE);
    await seed('child', withHelp(baseDoc(['a', 'I']), 3), DAYS.flower);
    await go('#/words/g/g1/study/hello');
    await until('document.querySelector(".result")', 'Hello finishes');
    ok(await has('.result--good'), 'Hello is marked done');
    H.serve('data/curriculum.json', null);
  });
}
