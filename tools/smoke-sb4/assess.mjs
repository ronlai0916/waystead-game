// SB4-WP5: the one runner for a quiz, a test and an exam. Loaded by tools/sb2-smoke.mjs with the harness H.
// Tile help and the help names are on through the localhost-only hook sb.tilesTest = '1' (Su.TILES_LIVE stays false), with a seeded setup.
import * as Su from '../../site/js/setup-doc.js';

export default function (H) {
  const { scene, go, click, ev, ok, has, text, until, key, keys, sleep, width, style, open, acct, W, MON, plus, CHILD, ADULT, visible, rect } = H;
  const step = (n) => console.log('  · ' + n);
  const q = (s) => JSON.stringify(s);
  const NOW = Date.parse(MON + 'T08:00:00');
  const T0 = Date.parse(MON + 'T09:00:00');
  const BANNED = /\b(wrong|fail|failed|incorrect|mistake|late|lost|error)\b|×/i;
  const WORDS = ['build', 'earth', 'fruit', 'heart'];
  const me = (year) => ({ signedIn: true, kind: 'child', id: CHILD, nickname: 'Robin', year, avatar: null, parentId: ADULT });
  const ch1 = () => ev(`(async () => { const D = await import('./js/data.js'); return D.chapterBySlug('y3', 'ch01').words.map((w) => w.word); })()`);

  // ---- docs ----
  const baseWeek = (words = WORDS, test = plus(5)) => W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week one', test, words, today: MON, now: Date.parse(MON + 'T09:00:00') }).doc;
  // The four jobs before the test done on plus(1), and every word spelled three times clean: practice is done, and the test is due from its date.
  function studiedDoc(words = WORDS, test = plus(5)) {
    const d0 = baseWeek(words, test);
    const g = W.groupById(d0, 'g1');
    let d = ['hello', 'fix', 'games', 'story'].reduce((x, st) => W.markStep(x, g, st, plus(1), Date.parse(plus(1) + 'T09:00:00')), d0);
    W.rows(g).forEach((w, i) => { for (const h of [10, 11, 12]) d = W.addTry(d, { id: 'st' + i + h, word: w, day: plus(1), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(1) + 'T' + h + ':00:00') + i }); });
    return d;
  }
  const helloOnly = (words = WORDS) => { const d = baseWeek(words, plus(7)); return W.markStep(d, W.groupById(d, 'g1'), 'hello', MON, T0); };
  const withSetup = (doc, { lv, pf, exams = [], offer } = {}) => {
    let su = {};
    if (lv) su = Su.setHelp(su, lv, NOW, 'Sam');
    if (pf) su = Su.setProfile(su, pf, NOW, 'Sam');
    for (const [eid, e] of exams) su = Su.setExam(su, eid, e, NOW).setup;
    if (offer) su = Su.setOffer(su, offer, NOW);
    return W.withSetup(doc, su);
  };
  const progDoc = (chapters = {}, results = []) => ({ v: 1, resetAt: 0, chapters, results, folded: {}, tricky: {} });
  const readProg = async () => JSON.parse((await ev('localStorage.getItem("sb.progress:' + CHILD + '")')) || 'null') || progDoc();
  const readWords = () => H.readLocal();

  /** Seed the child (year `year`), then open `hash` on `day`. */
  async function start({ doc = W.emptyDoc(), prog = null, year = 4, day = MON, hash = '#/', tiles = true } = {}) {
    await H.seedChild(doc, day);
    acct.who = me(year);
    if (prog) await ev('localStorage.setItem("sb.progress:' + CHILD + '",' + q(JSON.stringify(prog)) + ')');
    if (tiles) await ev('localStorage.setItem("sb.tilesTest","1")');
    await open(day, hash);
  }

  // ---- what the page asked to be said, and driving the words ----
  const heard = async (list) => {
    const probe = `(() => { const s = new Set(${q(list.map((w) => w.toLowerCase()))}); return [...globalThis.__said, ...globalThis.__lines.map((l) => l.toLowerCase())].reverse().find((x) => s.has(x)) || ''; })()`;
    await until(probe + ' !== ""', 'the word spoken');
    return ev(probe);
  };
  const clearSaid = () => ev('(() => { globalThis.__said.length = 0; globalThis.__lines.length = 0; })()');
  const screenNow = () => ev('(document.querySelector("[data-assess]") || {}).dataset ? document.querySelector("[data-assess]").dataset.assess : ""');
  const wordNo = () => ev('Number((document.querySelector("[data-assess=word]") || { dataset: {} }).dataset.wordNo || 0)');
  const cells = () => ev(`[...document.querySelectorAll('.tileboxes .lshown, .tileboxes .lgap')].map((c) => (c.classList.contains('lgap') ? '_' : c.textContent))`);
  const trayRight = async (word) => { const c = await cells(); await keys(c.map((x, i) => (x === '_' ? word[i].toLowerCase() : '')).join('')); };
  const trayWrong = (word) => ev(`(async () => {
    const word = ${q(word.toLowerCase())};
    const cells = [...document.querySelectorAll('.tileboxes .lshown, .tileboxes .lgap')];
    const gaps = cells.map((c, i) => (c.classList.contains('lgap') ? i : -1)).filter((i) => i >= 0);
    const free = () => [...document.querySelectorAll('.ltile[data-tile]:not(.is-used)')];
    for (let k = 0; k < gaps.length; k += 1) {
      const want = word[gaps[k]];
      const t = k === 0 ? free().find((x) => x.textContent.toLowerCase() !== want) : (free().find((x) => x.textContent.toLowerCase() === want) || free()[0]);
      t.click();
      await new Promise((r) => setTimeout(r, 30));
    }
  })()`);
  /**
   * Answer every word of a run. `plan(k, word)` gives 'right' or 'wrong' (default right); `on(kind, k, word)` may act on a word first.
   * Returns the words in the order they were asked. Stops at a screen that is not a word, a rest or a quiz's after-word card.
   */
  async function drive(list, { plan = () => 'right', before = null, rest = null, fb = null, stopAt = null } = {}) {
    const asked = [];
    let last = 0;
    for (let guard = 0; guard < 200; guard += 1) {
      await until('document.querySelector("[data-assess]")', 'a screen', 9000);
      const s = await screenNow();
      if (s === 'rest') { if (rest) await rest(); await click('[data-carry]'); await sleep(40); continue; }
      if (s === 'fb') { if (fb) await fb(asked.at(-1)); await click('[data-next]'); await sleep(40); continue; }
      if (s !== 'word') break;
      const no = await wordNo();
      if (no === last) { await sleep(40); continue; }
      last = no;
      const w = await heard(list);
      await clearSaid();
      const k = asked.length;
      asked.push(w);
      if (stopAt !== null && k === stopAt) break;
      if (before) await before(k, w);
      const right = plan(k, w) === 'right';
      const tray = await has('.keyboard--tray');
      if (tray) { if (right) await trayRight(w); else await trayWrong(w); } else if (right) { const typed = await text('[data-answer]'); await keys(w.slice(typed.length)); } else await keys('zz');
      await click('[data-next]');
      await sleep(40);
    }
    return asked;
  }
  const isRun = async () => (await screenNow()) === 'end';
  const progress = () => text('[data-progress]');
  const results = async (c) => (await readProg()).results.filter((r) => r.c === c);
  const noSideways = () => ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth');

  // ---------------------------------------------------------------------------------------------------------------
  scene('SB4-WP5 chapter test, Standard, keyboard: no feedback between words; a pass opens the next chapter', async () => {
    await width(390, 844);
    await start({ hash: '#/y3/ch01/test', tiles: false });
    await until('document.querySelector("[data-assess=word]")', 'the first word');
    ok(!await has('[data-assess=ready]'), 'no ready screen on Standard');
    ok(/Listen, then type the word\./.test(await text('h1')) && /Hear the word/.test(await text('[data-hear]')) && await has('.key--del') && await has('[data-answer]'), 'the keyboard page as the weekly test has it');
    ok(/^Word 1 of 11$/.test(await progress()) && await has('.meter'), 'the progress line and bar: ' + await progress());
    ok(!await has('[data-peekbtn]') && !await has('[data-hint]'), 'no Peek, no hint');
    const list = await ch1();
    ok(list.length === 11, 'eleven words');
    let bad = '';
    const asked = await drive(list, { before: async (k) => { if (k > 0) { const t = await text(); if (/Correct|Not quite|spelled it|Nearly|right|well done/i.test(t) || BANNED.test(t)) bad = t.slice(0, 120); } } });
    ok(bad === '', 'feedback between words: ' + bad);
    ok(asked.length === 11 && new Set(asked).size === 11, 'asked 11 different words: ' + asked.join(','));
    await until('document.querySelector("[data-assess=end]")', 'the end screen');
    const t = await text();
    ok(/You passed!/.test(t) && /11 words spelled\./.test(t) && !BANNED.test(t), 'the pass screen: ' + t.slice(0, 100));
    ok(await has('[data-end=celebrate]') && await has('[data-next-chapter]') && /Next chapter/.test(await text('[data-next-chapter]')), 'a celebration and the way on');
    const r = await results('y34-ch01');
    ok(r.length === 1 && r[0].passed === true && r[0].s === 11 && r[0].t === 11 && r[0].pf === undefined && r[0].lv === undefined && r[0].hr === undefined && r[0].hn === undefined, 'saved as today: ' + JSON.stringify(r));
    await go('#/y3/ch02');
    await until('document.querySelector("[data-chapterpage]")', 'chapter 2');
    ok(!await has('[data-chapter-locked]'), 'the next chapter is open');
    await H.shot('wp5-chapter-test-pass');

    step('a slip: "Not yet", the right spelling only, and the test again');
    await go('#/y3/ch01/test');
    await until('document.querySelector("[data-assess=word]")', 'the first word');
    let slipped = '';
    await drive(list, { plan: (k, w) => { if (k === 0) slipped = w; return k === 0 ? 'wrong' : 'right'; } });
    await until('document.querySelector("[data-assess=end]")', 'the end screen');
    const e = await text();
    ok(/Not yet\./.test(e) && /You spelled 10 of 11\./.test(e) && /Let.s practise 1\./.test(e) && !BANNED.test(e), 'the end: ' + e.slice(0, 140));
    ok(!/zz/i.test(e), 'what the child typed is never shown');
    ok((await text('[data-practise-word]')).replace(/\s|·/g, '').toLowerCase() === slipped.toLowerCase() && await has('[data-hearword]'), 'one card with the right spelling and Hear');
    ok(await has('[data-retry]') && /Practise again/.test(e) && /Take the test again/.test(e) && !await has('[data-end=celebrate]'), 'the buttons as today, no celebration');
    const again = await results('y34-ch01');
    ok(again.length === 2 && again[1].passed === false, 'saved, not passed: ' + JSON.stringify(again.map((x) => x.passed)));
    ok((await readProg()).tricky[slipped] && (await readProg()).tricky[slipped].n >= 1, 'the slip is in the tricky words');
    await click('[data-retry]');
    await until('document.querySelector("[data-assess=word]")', 'the test again');
    ok(/^Word 1 of 11$/.test(await progress()), 'the test starts again');
  });

  // ---------------------------------------------------------------------------------------------------------------
  scene('SB4-WP5 Extra support: ready, a rest after 6, First letter once a word; 8 of 11 passes, 7 does not', async () => {
    await width(390, 844);
    await start({ doc: withSetup(W.emptyDoc(), { pf: 'sen' }), hash: '#/y3/ch01/test' });
    await until('document.querySelector("[data-assess=ready]")', 'the ready screen');
    const r = await text();
    ok(/11 words\. Hear each one as often as you like\./.test(r) && /Start when you.re ready\./.test(r) && (await text('[data-start]')) === 'Start' && !BANNED.test(r), 'the ready screen: ' + r.slice(0, 120));
    ok((await rect('[data-start]')).h >= 56 && (await ev('document.querySelectorAll("[data-say]").length')) === 2, 'Start is 56 tall, a Hear for each line');
    await click('[data-say="0"]');
    ok(/11 words/.test(await ev('globalThis.__lines.at(-1)')), 'Hear reads the line');
    const list = await ch1();

    step('seven of eleven: "Not this time."');
    await click('[data-start]');
    await until('document.querySelector("[data-assess=word]")', 'the first word');
    let sawRest = false;
    let hinted = 0;
    const run = async (rights) => {
      const asked = await drive(list, {
        plan: (k) => (k < rights ? 'right' : 'wrong'),
        before: async (k) => {
          ok(await has('[data-hint]'), 'First letter on word ' + (k + 1));
          if (k === 0) {
            ok((await ev('document.querySelector("[data-hint]").disabled')) === false, 'the hint is there for the first word');
            await click('[data-hint]');
            hinted += 1;
            ok((await text('[data-answer]')).length === 1 && await ev('document.querySelector("[data-hint]").disabled'), 'one letter in the answer, and the hint is used up for this word');
          }
        },
        rest: async () => { sawRest = true; const t = await text(); ok(/Have a rest\./.test(t) && /Carry on when you.re ready\./.test(t) && (await text('[data-carry]')) === 'Carry on', 'the rest screen: ' + t); ok(asked0.length === 6, 'the rest comes after 6 words'); },
      });
      return asked;
    };
    const asked0 = [];
    // the rest check counts the words asked so far: keep a live list
    const live = drive.bind(null);
    void live;
    const origHeard = null;
    void origHeard;
    const askedNow = await (async () => {
      const out = [];
      let last = 0;
      for (let guard = 0; guard < 60; guard += 1) {
        await until('document.querySelector("[data-assess]")', 'a screen', 9000);
        const s = await screenNow();
        if (s === 'rest') { sawRest = true; ok(out.length === 6, 'the rest comes after 6 words, not ' + out.length); const t = await text(); ok(/Have a rest\./.test(t) && /Carry on when you.re ready\./.test(t) && (await text('[data-carry]')) === 'Carry on', 'the rest screen: ' + t); await click('[data-carry]'); await sleep(40); continue; }
        if (s !== 'word') break;
        const no = await wordNo();
        if (no === last) { await sleep(40); continue; }
        last = no;
        const w = await heard(list);
        await clearSaid();
        const k = out.length;
        out.push(w);
        ok(await has('[data-hint]') && /First letter/.test(await text('[data-hint]')), 'First letter on word ' + (k + 1));
        if (k === 0) {
          await click('[data-hint]');
          hinted += 1;
          ok((await text('[data-answer]')).length === 1 && await ev('document.querySelector("[data-hint]").disabled'), 'one letter in the answer; the hint is used up for this word');
          const typed = await text('[data-answer]');
          await keys(w.slice(typed.length));
        } else if (k < 7) await keys(w);
        else await keys('zz');
        await click('[data-next]');
        await sleep(40);
      }
      return out;
    })();
    void run;
    ok(sawRest && askedNow.length === 11, 'a rest was shown; 11 words asked: ' + askedNow.length);
    await until('document.querySelector("[data-assess=end]")', 'the end');
    let t = await text();
    ok(/Not this time\./.test(t) && /You spelled 7 words\./.test(t) && /Practise these 4\. Try again any time\./.test(t) && !BANNED.test(t) && !await has('[data-end=celebrate]'), 'the end: ' + t.slice(0, 160));
    let res = await results('y34-ch01');
    ok(res.length === 1 && res[0].passed === false && res[0].pf === 'sen' && res[0].hn === 1 && res[0].s === 7, 'saved, not passed, with the help: ' + JSON.stringify(res));
    ok(!await has('[data-next-chapter]'), 'no way on');
    await go('#/y3/ch02');
    await until('document.querySelector("[data-chapter-locked]")', 'chapter 2 stays closed');

    step('eight of eleven: passed');
    await go('#/y3/ch01/test');
    await until('document.querySelector("[data-assess=ready]")', 'the ready screen again');
    await click('[data-start]');
    const again = await (async () => {
      const out = [];
      let last = 0;
      for (let guard = 0; guard < 60; guard += 1) {
        await until('document.querySelector("[data-assess]")', 'a screen', 9000);
        const s = await screenNow();
        if (s === 'rest') { await click('[data-carry]'); continue; }
        if (s !== 'word') break;
        const no = await wordNo();
        if (no === last) { await sleep(40); continue; }
        last = no;
        const w = await heard(list);
        await clearSaid();
        out.push(w);
        await keys(out.length <= 8 ? w : 'zz');
        await click('[data-next]');
        await sleep(40);
      }
      return out;
    })();
    ok(again.length === 11, '11 asked');
    await until('document.querySelector("[data-assess=end]")', 'the end');
    t = await text();
    ok(/You passed!/.test(t) && /You spelled 8 words\./.test(t) && await has('[data-end=celebrate]') && await has('[data-next-chapter]'), 'passed on 8 of 11: ' + t.slice(0, 120));
    res = await results('y34-ch01');
    ok(res.length === 2 && res[1].passed === true && res[1].pf === 'sen' && res[1].s === 8 && res[1].t === 11 && res[1].hn === undefined, 'saved as passed: ' + JSON.stringify(res[1]));
    await go('#/y3/ch02');
    await until('document.querySelector("[data-chapterpage]")', 'chapter 2');
    ok(!await has('[data-chapter-locked]'), 'chapter 2 is open now');
  });

  // ---------------------------------------------------------------------------------------------------------------
  scene('SB4-WP5 Stretch: the keyboard even for a level-2 child; Hear again stops after 2', async () => {
    await width(390, 844);
    await start({ doc: withSetup(W.emptyDoc(), { pf: 'top', lv: 2 }), hash: '#/y3/ch01/test' });
    await until('document.querySelector("[data-assess=word]")', 'the first word (no ready screen on a chapter test)');
    ok(await has('.keyboard .key') && !await has('.keyboard--tray') && !await has('.ltile'), 'the keyboard, not the tray');
    const list = await ch1();
    await heard(list);
    await clearSaid();
    ok(!await ev('document.querySelector("[data-hear]").disabled') && (await text('[data-heard]')) === '', 'Hear again is on');
    await click('[data-hear]');
    await sleep(60);
    ok(!await ev('document.querySelector("[data-hear]").disabled'), 'still on after one replay');
    await click('[data-hear]');
    await sleep(60);
    ok(await ev('document.querySelector("[data-hear]").disabled') && (await text('[data-heard]')) === 'You\'ve heard it 2 times.', 'off after 2 replays, with the line: ' + await text('[data-heard]'));
    const spoken = await ev('globalThis.__said.length + globalThis.__lines.length');
    await ev('document.querySelector("[data-hear]").click()');
    await sleep(80);
    ok(await ev('globalThis.__said.length + globalThis.__lines.length') === spoken, 'a third press says nothing');
    if (await has('[data-sentence]')) ok(await ev('document.querySelector("[data-sentence]").disabled'), 'In a sentence uses a hear, so it is off too');
    ok(!await has('[data-peekbtn]') && !await has('[data-hint]'), 'no Peek, no hint');
    await H.shot('wp5-stretch-word');
    // a pass needs every word right
    await keys('zz');
    await click('[data-next]');
    await sleep(60);
    ok(/^Word 2 of 11$/.test(await progress()), 'the next word');
    ok(await ev('!document.querySelector("[data-hear]").disabled') && (await text('[data-heard]')) === '', 'a new word has its replays again');
  });

  // ---------------------------------------------------------------------------------------------------------------
  const testDay = () => ({ doc: withSetup(studiedDoc(), { lv: 2 }), day: plus(5), hash: '#/words/g/g1/test' });
  scene('SB4-WP5 Standard keyboard: Enter after Hear goes on; the progress bar is wide in landscape', async () => {
    await width(390, 844);
    await start({ doc: studiedDoc(), day: plus(5), hash: '#/words/g/g1/test', tiles: false });
    await until('document.querySelector("[data-assess=word]")', 'the first word');
    const w = await heard(WORDS);
    await clearSaid();
    await click('[data-hear]');
    await ev('document.querySelector("[data-hear]").focus()');
    await keys(w);
    await key('Enter');
    await until('document.querySelector("[data-assess=word][data-word-no=\\"2\\"]")', 'word 2 after Enter on Hear');
    const tries = (await readWords()).results.filter((r) => r.k === 't');
    ok(tries.length === 1 && tries[0].hr === 1 && tries[0].c === 1, 'one try, one hear, right: ' + JSON.stringify(tries));
    for (const [wd, ht] of [[844, 390], [1180, 640], [1180, 820]]) {
      await width(wd, ht);
      await sleep(80);
      const m = await rect('.assess__prog .meter');
      ok(m.w >= 120, 'the progress bar is ' + m.w + ' px wide at ' + wd + 'x' + ht);
    }
    await width(390, 844);
  });

  scene('SB4-WP5 weekly test at tile level 2: Next waits for the tray; tries saved k t with lv 2; a stopped test carries on; slips reach Mend', async () => {
    await width(390, 844);
    const s = testDay();
    await start(s);
    await until('document.querySelector("[data-assess=word]") && document.querySelector(".keyboard--tray")', 'the tray');
    const list = WORDS;
    ok(await ev('document.querySelector("[data-next]").disabled'), 'Next is off while the tray is not full');
    ok(!await has('[data-check]') && !await has('[data-hint]') && !await has('[data-peekbtn]'), 'no Check, no hint, no Peek');
    ok(/^Word 1 of 4$/.test(await progress()), 'the progress line');
    let w = await heard(list);
    await clearSaid();
    const c0 = await cells();
    await keys(c0.map((x, i) => (x === '_' ? w[i] : '')).join('').slice(0, 1));
    ok(await ev('document.querySelector("[data-next]").disabled'), 'a part-filled tray keeps Next off');
    await keys(c0.map((x, i) => (x === '_' ? w[i] : '')).join('').slice(1));
    ok(!(await ev('document.querySelector("[data-next]").disabled')), 'Next is on once the tray is full');
    ok(!await ev('document.querySelector(".lgap.is-glow, .ltile.is-glow") !== null') && await ev('document.querySelectorAll(".lgap.is-right").length') === 0, 'no glow, nothing says it is right');
    await click('[data-next]');
    ok(!/spelled it|Nearly|Correct|right/i.test(await text()), 'nothing between words');
    await until('document.querySelector("[data-assess=word][data-word-no=\\"2\\"]")', 'word 2');
    w = await heard(list);
    const second = w;
    await clearSaid();
    await trayWrong(w);
    await click('[data-next]');
    await until('document.querySelector("[data-assess=word][data-word-no=\\"3\\"]")', 'word 3');
    const tries = (await readWords()).results.filter((r) => r.k === 't');
    ok(tries.length === 2 && tries.every((r) => r.lv === 2 && r.g === 'g1'), 'two tries saved at once with lv 2: ' + JSON.stringify(tries));
    ok(tries[0].c === 1 && tries[0].t === 0 && tries[1].c === 0 && tries[1].t === 1 && tries.every((r) => r.hr === undefined && r.pf === undefined), 'right, then a slip; no help fields');

    step('stopped: leave and come back');
    await go('#/words/g/g1');
    await until('document.querySelector("[data-testcard]") || document.querySelector("main h1")', 'the week page');
    await go('#/words/g/g1/test');
    await until('document.querySelector("[data-assess=word]")', 'the test again');
    ok(/^Word 3 of 4$/.test(await progress()), 'it carries on at word 3: ' + await progress());
    let asked = 0;
    for (;;) {
      await until('document.querySelector("[data-assess=word]") || document.querySelector("[data-assess=end]")', 'a screen');
      if (await screenNow() !== 'word') break;
      const n = await wordNo();
      if (n <= asked) { await sleep(40); continue; }
      w = await heard(list);
      await clearSaid();
      await trayRight(w);
      await click('[data-next]');
      asked = n;
      await sleep(40);
    }
    await until('document.querySelector("[data-assess=end]")', 'the end');
    const t = await text();
    ok(/Test done\./.test(t) && /You spelled 3 of 4\./.test(t) && /1 word will come back to practise\./.test(t) && !BANNED.test(t), 'the end: ' + t.slice(0, 160));
    ok(!await has('[data-end=celebrate]') && (await text('[data-practise-word]')).replace(/\s|·/g, '').toLowerCase() === second, 'the slipped word as a card, no celebration');
    ok(/Back to my words/.test(await text('.assess__end')), 'the way back');
    const d = await readWords();
    ok(d.results.filter((r) => r.k === 't').length === 4, 'four tries in all');
    ok(W.slipped(d, W.groupById(d, 'g1')).join() === second, 'the slip is in the group\'s results');

    step('the slip reaches Mend the next day');
    await H.seedChild(d, plus(6));
    acct.who = me(4);
    await ev('localStorage.setItem("sb.tilesTest","1")');
    await open(plus(6), '#/words/g/g1');
    await until('document.querySelector("main h1")', 'the week page');
    ok(new RegExp(second, 'i').test(await text()) && await has('a[href*="/spell/"]'), 'the slipped word is waiting to be fixed: ' + (await text()).slice(0, 80));
  });

  scene('SB4-WP5 weekly test, Extra support on the keyboard: the tries carry the help they had', async () => {
    await width(390, 844);
    await start({ doc: withSetup(studiedDoc(), { pf: 'sen' }), day: plus(5), hash: '#/words/g/g1/test' });
    await until('document.querySelector("[data-assess=ready]")', 'the ready screen');
    ok(/4 words\./.test(await text()), 'the ready line');
    await click('[data-start]');
    await drive(WORDS, { before: async (k) => { if (k === 0) await click('[data-hint]'); if (k === 1) { await click('[data-hear]'); await click('[data-hear]'); } } });
    await until('document.querySelector("[data-assess=end]")', 'the end');
    ok(/You spelled all 4!/.test(await text()) && await has('[data-end=celebrate]'), 'all four: ' + (await text()).slice(0, 80) );
    const tries = (await readWords()).results.filter((r) => r.k === 't');
    ok(tries.length === 4 && tries.every((r) => r.pf === 'sen' && r.c === 1), 'four right tries with pf sen: ' + JSON.stringify(tries));
    ok(tries.filter((r) => r.hn === 1).length === 1 && tries.filter((r) => r.hr === 2).length === 1, 'one hint and two extra hears saved on their own words');
  });

  // ---------------------------------------------------------------------------------------------------------------
  scene('SB4-WP5 quiz: 5 words (3 on Extra support, in Year 1); Nearly shows the right spelling; one q: record and nothing else; Quiz again', async () => {
    await width(390, 844);
    await start({ hash: '#/y3/ch01/quiz', tiles: true });
    await until('document.querySelector("[data-assess=word]")', 'the first word');
    ok(!await has('[data-assess=ready]') && /^Word 1 of 5$/.test(await progress()) && await has('[data-peekbtn]'), 'five words, Peek on a quiz');
    const list = await ch1();
    const first = [];
    const slipped = [];
    const asked = await drive(list, {
      plan: (k, w) => { first.push(w); if (k === 2) slipped.push(w); return k === 2 ? 'wrong' : 'right'; },
      fb: async (w) => {
        const t = await text();
        const kind = await ev('document.querySelector("[data-assess=fb]").dataset.fb');
        if (kind === 'right') ok(/You spelled it!/.test(t) && await has('.assess__fbicon') && !BANNED.test(t), 'a tick and "You spelled it!"');
        else {
          ok(/Nearly! Here.s how it goes\./.test(t) && !BANNED.test(t) && await has('.assess__fb--soft .assess__fbicon'), 'Nearly: ' + t.slice(0, 80));
          ok((await text('[data-right-spelling]')).replace(/\s|·/g, '').toLowerCase() === w.toLowerCase() && await has('[data-right-spelling] .is-tricky, [data-right-spelling] .chunked'), 'the right spelling, with its parts');
          ok(!/zz/i.test(t), 'not what was typed');
          await H.shot('wp5-quiz-nearly');
        }
        ok((await rect('[data-next]')).h >= 48, 'Next is 48 tall');
      },
    });
    ok(asked.length === 5, '5 asked: ' + asked.length);
    await until('document.querySelector("[data-assess=end]")', 'the end');
    const t = await text();
    ok(/Quiz done\./.test(t) && /You spelled 4 of 5\./.test(t) && !await has('[data-end=celebrate]') && !BANNED.test(t), 'the end: ' + t.slice(0, 100));
    ok(/Practise them/.test(t) && /Quiz again/.test(t) && (await ev('document.querySelector(".assess__end a").getAttribute("href")')) === '#/y3/ch01/practice', 'the two buttons');
    ok((await text('[data-practise-word]')).replace(/\s|·/g, '').toLowerCase() === slipped[0].toLowerCase(), 'the slipped word as a card');
    const p = await readProg();
    const qs = p.results.filter((r) => r.c === 'q:y34-ch01');
    ok(qs.length === 1 && qs[0].k === 'q' && qs[0].s === 4 && qs[0].t === 5 && qs[0].miss.join() === slipped.join() && qs[0].d === MON, 'exactly one q: record: ' + JSON.stringify(qs));
    ok(p.results.length === 1 && Object.keys(p.chapters).length === 0 && Object.keys(p.folded).length === 0, 'nothing else in the progress');
    const d = await readWords();
    ok(d.results.length === 0, 'no try, no star, no dot');
    ok(Object.keys(p.tricky).length === 0, 'the tricky words are not touched');

    step('Quiz again gives other words');
    await click('[data-again]');
    await until('document.querySelector("[data-assess=word]")', 'the second quiz');
    const second = await drive(list, {});
    ok(second.length === 5 && second.join() !== asked.join(), 'other words: ' + asked.join() + ' then ' + second.join());
    await until('document.querySelector("[data-assess=end]")', 'the end again');
    ok(/You spelled all 5!/.test(await text()), 'all five');
    ok((await results('q:y34-ch01')).length === 2, 'now two quiz records');

    step('Year 1 and Extra support: three words');
    await start({ year: 1, hash: '#/y3/ch01/quiz' });
    await until('document.querySelector("[data-assess=word]")', 'a Year 1 quiz');
    ok(/^Word 1 of 3$/.test(await progress()), 'three words in Year 1');
    await start({ doc: withSetup(W.emptyDoc(), { pf: 'sen' }), hash: '#/y3/ch01/quiz' });
    await until('document.querySelector("[data-assess=word]")', 'an Extra support quiz');
    ok(/^Word 1 of 3$/.test(await progress()), 'three words on Extra support');
    ok(await has('[data-peekbtn]'), 'a quiz keeps Peek');
    const w = await heard(list);
    await clearSaid();
    await click('[data-peekbtn]');
    ok((await text('[data-peek]')).toLowerCase() === w.toLowerCase() && await ev('document.querySelector("[data-peekbtn]").disabled'), 'Peek shows the word once');
    await until('document.querySelector("[data-peek]").textContent === ""', 'the peek goes after a few seconds', 5000);
    await keys(w);
    await click('[data-next]');
    await until('document.querySelector("[data-assess=fb]")', 'the right card');
    await click('[data-next]');
    await until('document.querySelector("[data-assess=word]")', 'word 2');
    await drive(list, {});
    await until('document.querySelector("[data-assess=end]")', 'the end');
    const qq = (await results('q:y34-ch01'))[0];
    ok(qq.pk === 1 && qq.pf === 'sen' && qq.t === 3, 'the peek and the help are on the record: ' + JSON.stringify(qq));
    ok(await has('.assess--y12') === false, 'a Year 4 page is not the large-print one');
    await start({ year: 1, hash: '#/y3/ch01/quiz' });
    await until('document.querySelector("[data-assess=word]")', 'a Year 1 quiz');
    await drive(list, {});
    await until('document.querySelector("[data-assess=end]")', 'the end');
    ok(await has('.assess--y12') && (await ev('parseFloat(getComputedStyle(document.querySelector(".assess__line")).fontSize)')) === 22, 'Year 1: the end screen is in 22 px');
  });

  scene('SB4-WP5 where a quiz is offered: after step 2 and Practice day; never while the test is due', async () => {
    await width(390, 844);
    step('the chapter page');
    await start({ prog: progDoc({ 'y34-ch01': { studiedAt: T0 } }), hash: '#/y3/ch01' });
    await until('document.querySelector("[data-chapterpage]")', 'the chapter page');
    ok(!await has('[data-quizrow]'), 'not before step 2');
    await start({ prog: progDoc({ 'y34-ch01': { studiedAt: T0, practisedAt: T0 } }), hash: '#/y3/ch01' });
    await until('document.querySelector("[data-chapterpage]")', 'the chapter page');
    ok(await has('[data-quizrow]') && /Try a quick quiz/.test(await text('[data-quizrow]')) && (await ev('document.querySelector("[data-quizrow]").getAttribute("href")')) === '#/y3/ch01/quiz', 'the quiet row');
    await start({ doc: withSetup(W.emptyDoc(), { offer: { quiz: false, exam: true } }), prog: progDoc({ 'y34-ch01': { studiedAt: T0, practisedAt: T0 } }), hash: '#/y3/ch01' });
    await until('document.querySelector("[data-chapterpage]")', 'the chapter page');
    ok(!await has('[data-quizrow]'), 'quizzes off: no row');
    await go('#/y3/ch01/quiz');
    await sleep(150);
    ok(await ev('location.hash') === '#/y3/ch01' && !await has('[data-assess]'), 'and the route goes back to the chapter');

    step('the week page');
    await start({ doc: withSetup(helloOnly()), day: plus(1), hash: '#/words/g/g1' });
    await until('document.querySelector("main h1")', 'the week page');
    ok(!await has('[data-quizrow]'), 'not before Practice day is done');
    await start({ doc: withSetup(studiedDoc()), day: plus(2), hash: '#/words/g/g1' });
    await until('document.querySelector("main h1")', 'the week page');
    ok(await has('[data-quizrow]') && /Try a quick quiz/.test(await text('[data-quizrow]')), 'the row after Practice day');
    await click('[data-quizrow]');
    await until('document.querySelector("[data-assess=word]")', 'the week quiz');
    ok(/^Word 1 of 4$/.test(await progress()) || /^Word 1 of 5$/.test(await progress()), 'a quiz of the week\'s words: ' + await progress());
    await drive(WORDS, {});
    await until('document.querySelector("[data-assess=end]")', 'the end');
    const g = await results('q:g-g1');
    ok(g.length === 1 && g[0].k === 'q' && g[0].t === Math.min(5, WORDS.length), 'a g- record: ' + JSON.stringify(g));
    ok((await readWords()).results.filter((r) => r.k === 't').length === 0 && (await ev('document.querySelector(".assess__end a").getAttribute("href")')) === '#/words/g/g1', 'no try; Practise them goes to the week');

    step('test day: no row, and the route shows the test card');
    await start({ doc: withSetup(studiedDoc()), day: plus(5), hash: '#/words/g/g1' });
    await until('document.querySelector("[data-testcard]")', 'the test card');
    ok(!await has('[data-quizrow]'), 'no quiz row while the test is due');
    await go('#/words/g/g1/quiz');
    await until('document.querySelector("[data-testcard]")', 'the test card instead of the quiz');
    ok(!await has('[data-assess]') && !new RegExp(WORDS.join('|'), 'i').test(await text()), 'no quiz and no word');
    await start({ doc: studiedDoc(), prog: progDoc({ 'y34-ch01': { studiedAt: T0, practisedAt: T0 } }), day: plus(5), hash: '#/y3/ch01/quiz', tiles: false });
    await until('document.querySelector("[data-testcard]")', 'a chapter that holds a due word shows the test card, not its quiz');
    ok(!await has('[data-assess]'), 'no quiz for a chapter holding a hidden word');
  });

  // ---------------------------------------------------------------------------------------------------------------
  const EXAM = { name: 'Spring check', words: ['build', 'earth', 'wyvern'], from: ['Chapter 1'], date: plus(3) };
  const examDoc = (extra = {}) => withSetup(W.emptyDoc(), { exams: [['e1', EXAM]], ...extra });
  scene('SB4-WP5 exam: later, ready, change an answer, wait, one e: record, done, reopened', async () => {
    await width(390, 844);
    step('before its date');
    await start({ doc: examDoc(), day: plus(2), hash: '#/' });
    await until('document.querySelector("[data-room]")', 'the home');
    ok(!await has('[data-examrow]'), 'no row before the date');
    await go('#/words/exam/e1');
    await until('document.querySelector("[data-assess=later]")', 'the later screen');
    ok(/Your big test opens on Thu 5 Nov\./.test(await text()) && !/build|earth|wyvern/i.test(await text()) && await has('[data-back]'), 'the later line: ' + (await text()).slice(0, 80));
    await go('#/words/exam/nope');
    await until('document.querySelector("main h1")', 'the not-found page');
    ok(/isn.t here/.test(await text()), 'an unknown exam is the not-found page');

    step('Year 6 on Standard: "Your exam is ready."');
    await start({ doc: examDoc(), year: 6, day: plus(3), hash: '#/' });
    await until('document.querySelector("[data-examrow]")', 'the home row');
    ok((await text('[data-examrow]')).trim() === 'Your exam is ready.', 'Year 6: ' + await text('[data-examrow]'));

    step('Year 4: "Your big test is ready."');
    await start({ doc: examDoc(), year: 4, day: plus(3), hash: '#/' });
    await until('document.querySelector("[data-examrow]")', 'the home row');
    ok((await text('[data-examrow]')).trim() === 'Your big test is ready.' && (await rect('[data-examrow]')).h >= 48, 'Year 4: ' + await text('[data-examrow]'));
    await H.shot('wp5-exam-home');
    await ev('sessionStorage.removeItem("sb.examDraft")');
    await click('[data-examrow]');
    await until('document.querySelector("[data-assess=ready]")', 'the ready screen');
    const t = await text();
    ok(/Big test/.test(t) && /3 words\. You can hear each word again 3 times\./.test(t) && /Start when you.re ready\./.test(t) && await has('.exampaper .paperlines'), 'the ready screen on paper: ' + t.slice(0, 120));
    ok(!await has('img') && !await has('.pip'), 'no Pip on the paper');
    await H.shot('wp5-exam-ready');
    await click('[data-start]');
    await until('document.querySelector("[data-assess=word]")', 'word 1');
    ok(await has('.exampaper .paperno') && (await text('.paperno')) === '1' && !await has('[data-prevword]'), 'the paper: the number on the left, no Back on word 1');
    ok(/^Word 1 of 3$/.test(await progress()), 'progress');

    const list = EXAM.words;
    // word 1 right
    let w = await heard(list);
    await clearSaid();
    ok(w === 'build' && await ev('document.querySelectorAll("[data-sentence]").length') <= 1, 'the exam asks in the grown-up\'s order: ' + w);
    await keys(w);
    await click('[data-next]');
    await until('document.querySelector("[data-word-no=\\"2\\"]")', 'word 2');
    ok((await text('.paperno')) === '2' && await has('[data-prevword]') && (await rect('[data-prevword]')).h >= 48, 'word 2 has Back one word');
    w = await heard(list);
    await clearSaid();
    ok(w === 'earth', 'the second word');
    await keys('erth'); // a slip, to change before Finish
    step('leave halfway and come back');
    await click('[data-next]');
    await until('document.querySelector("[data-word-no=\\"3\\"]")', 'word 3');
    await go('#/');
    await until('document.querySelector("[data-room]")', 'the home');
    ok(await ev('!!sessionStorage.getItem("sb.examDraft")') && !await has('[data-examrow]') === false, 'a draft is kept and the exam is still waiting');
    await click('[data-examrow]');
    await until('document.querySelector("[data-assess=word]")', 'the exam again');
    ok(!await has('[data-assess=ready]') && /^Word 3 of 3$/.test(await progress()), 'it carries on at word 3: ' + await progress());
    await click('[data-hear]');
    w = await heard(list);
    await clearSaid();
    ok(w === 'wyvern', 'the off-list word is asked too');
    await keys('wyvern');
    await click('[data-next]');
    await until('document.querySelector("[data-assess=finish]")', 'the finish screen');
    ok((await results('e:e1')).length === 0, 'nothing is saved before Finish');
    const f = await text();
    ok(/You can check your answers first\./.test(f) && /Finish/.test(f) && await has('[data-edit="1"]'), 'the finish screen: ' + f.slice(0, 120));
    ok(/erth/i.test(await text('[data-edit="1"]')), 'it shows what was written, to check');
    await H.shot('wp5-exam-finish');

    step('change an answer before Finish');
    await click('[data-edit="1"]');
    await until('document.querySelector("[data-assess=word]")', 'word 2 again');
    ok((await text('[data-answer]')) === 'erth' && /^Word 2 of 3$/.test(await progress()), 'the answer is still there: ' + await text('[data-answer]'));
    await click('[data-del]');
    await click('[data-del]');
    await click('[data-del]');
    await keys('arth');
    ok(await text('[data-answer]') === 'earth', 'changed to ' + await text('[data-answer]'));
    await click('[data-next]');
    await until('document.querySelector("[data-assess=finish]")', 'back at the finish screen');
    ok((await results('e:e1')).length === 0, 'still nothing saved');
    await click('[data-finish]');
    await until('document.querySelector("[data-assess=wait]")', 'the wait screen');
    ok(/All done\. Ready to see how you did\?/.test(await text()) && (await text('[data-show]')) === 'Show me' && !/\d of \d/.test(await text()), 'the wait screen shows no score: ' + await text());
    let r = await results('e:e1');
    ok(r.length === 1 && r[0].k === 'e' && r[0].s === 3 && r[0].t === 3 && r[0].d === plus(3) && r[0].miss === undefined && r[0].pf === undefined, 'exactly one e: record at Finish: ' + JSON.stringify(r));
    ok(await ev('sessionStorage.getItem("sb.examDraft")') === null, 'the draft is cleared');
    await click('[data-show]');
    await until('document.querySelector("[data-assess=end]")', 'the results');
    const e = await text();
    ok(/All done\./.test(e) && /You spelled 3 of 3\./.test(e) && !BANNED.test(e), 'the results: ' + e.slice(0, 100));
    ok((await readWords()).results.length === 0, 'an exam writes no try');

    step('done afterwards; reopened it is ready again');
    await go('#/');
    await until('document.querySelector("[data-room]")', 'the home');
    await go('#/words/exam/e1');
    await until('document.querySelector("[data-assess=done]")', 'the done screen');
    ok(/You have done this one\. Well done\./.test(await text()), 'done');
    await go('#/');
    await until('document.querySelector("[data-room]")', 'the home');
    ok(!await has('[data-examrow]'), 'no row once done');
    const d = await readWords();
    const su = Su.reopenExam(W.setupOf(d), 'e1', Date.parse(plus(3) + 'T15:00:00'));
    await ev('localStorage.setItem("sb.words:' + CHILD + '",' + q(JSON.stringify(W.withSetup(d, su))) + ')');
    await open(plus(3), '#/');
    await until('document.querySelector("[data-room]")', 'the home after reopening');
    ok(await has('[data-examrow]'), 'reopened: the row is back');
    await click('[data-examrow]');
    await until('document.querySelector("[data-assess=ready]")', 'ready again');
    await click('[data-start]');
    await drive(list, { plan: (k) => (k === 1 ? 'wrong' : 'right') });
    await until('document.querySelector("[data-assess=finish]")', 'finish');
    await click('[data-finish]');
    await click('[data-show]');
    await until('document.querySelector("[data-assess=end]")', 'results');
    const e2 = await text();
    ok(/You spelled 2 of 3\./.test(e2) && /Let.s practise these\./.test(e2) && (await text('[data-practise-word]')).replace(/\s|·/g, '').toLowerCase() === 'earth' && !/zz/.test(e2), 'a slip shows the right spelling only: ' + e2.slice(0, 120));
    r = await results('e:e1');
    ok(r.length === 2 && r.some((x) => x.miss && x.miss.join() === 'earth'), 'the second record: ' + JSON.stringify(r));
  });

  scene('SB4-WP5 exam: a weekly test that is due comes first, on the route and on the home; Extra support halves it', async () => {
    await width(390, 844);
    const due = withSetup(studiedDoc(), { exams: [['e1', { ...EXAM, date: plus(1) }]] });
    await start({ doc: due, day: plus(5), hash: '#/' });
    await until('document.querySelector("[data-room]")', 'the home');
    ok(!await has('[data-examrow]') && await has('[data-taketest]') || await has('[data-job]'), 'the test is the home\'s one job');
    ok(!await has('[data-examrow]'), 'no exam row while a test is due');
    await go('#/words/exam/e1');
    await until('document.querySelector("[data-testcard]")', 'the test card');
    ok(!await has('[data-assess]'), 'the exam route shows the test card');
    step('Extra support: two parts');
    const words = ['build', 'earth', 'fruit', 'heart', 'island', 'recent'];
    const sen = withSetup(W.emptyDoc(), { pf: 'sen', exams: [['e2', { name: 'Big one', words, from: ['x'], date: plus(1) }]] });
    await start({ doc: sen, day: plus(2), hash: '#/words/exam/e2' });
    await until('document.querySelector("[data-assess=ready]")', 'ready');
    ok(/6 words\. Hear each one as often as you like\./.test(await text()), 'the ready line');
    await click('[data-start]');
    let sawRest = false;
    const out = [];
    let last = 0;
    for (let guard = 0; guard < 40; guard += 1) {
      await until('document.querySelector("[data-assess]")', 'a screen', 9000);
      const s = await screenNow();
      if (s === 'rest') { sawRest = true; ok(out.length === 3, 'the rest is halfway: ' + out.length); await click('[data-carry]'); continue; }
      if (s !== 'word') break;
      const n = await wordNo();
      if (n === last) { await sleep(40); continue; }
      last = n;
      const w = await heard(words);
      await clearSaid();
      out.push(w);
      await keys(w);
      await click('[data-next]');
    }
    ok(sawRest && out.join() === words.join(), 'a rest, and the grown-up\'s order for everyone: ' + out.join());
    ok((await screenNow()) === 'finish', 'then Finish');
  });

  // ---------------------------------------------------------------------------------------------------------------
  scene('SB4-WP5 sizes: every control is 48 px or more; landscape and 390 wide, garden and Night', async () => {
    const small = () => ev(`(() => [...document.querySelectorAll('main button, main a.btn, main .hearround, main .linkbtn')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('.keyboard') && !e.matches('.lgap') && (r.width < 47.5 || r.height < 47.5); }).map((e) => e.className + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)))()`);
    const inView = (sel, w, h, id) => ev(`(() => { const e = document.querySelector(${q(sel)}); if (!e) return 'missing'; const r = e.getBoundingClientRect(); return r.top >= -0.5 && r.bottom <= ${h} + 0.5 && r.left >= -0.5 && r.right <= ${w} + 0.5 ? '' : ${q(id)} + ' ' + ${q(sel)} + ' ' + Math.round(r.top) + '..' + Math.round(r.bottom); })()`);

    step('keyboard pages through kbFit: the weekly test, a quiz, an exam');
    const pages = [
      ['assess-test', () => start({ doc: studiedDoc(), day: plus(5), hash: '#/words/g/g1/test', tiles: false }), 'document.querySelector("[data-next]") && document.querySelector(".keyboard .key")'],
      ['assess-quiz', () => start({ hash: '#/y3/ch01/quiz' }), 'document.querySelector("[data-next]") && document.querySelector(".keyboard .key")'],
      ['assess-exam', async () => { await start({ doc: examDoc(), year: 6, day: plus(3), hash: '#/words/exam/e1' }); await until('document.querySelector("[data-start]")', 'ready'); await click('[data-start]'); await click('[data-next]').catch(() => {}); }, 'document.querySelector("[data-next]") && document.querySelector(".keyboard .key")'],
    ];
    let cases = 0;
    for (const [id, seed, ready] of pages) {
      await width(1180, 700);
      await seed();
      await until(ready, id);
      for (const s of ['garden', 'night']) {
        await style(s);
        for (const [w, h] of [[1180, 640], [1366, 900]]) {
          await width(w, h);
          await sleep(120);
          await H.kbFit({ role: 'child', page: id, style: s, w, h });
          const bad = await small();
          ok(bad.length === 0, id + ' ' + s + ' ' + w + 'x' + h + ': small controls ' + bad.join('; '));
          cases += 1;
        }
        await width(390, 844);
        await sleep(100);
        ok(await noSideways(), id + ' ' + s + ': sideways scroll at 390');
        const bad = await small();
        ok(bad.length === 0, id + ' ' + s + ' 390: small controls ' + bad.join('; '));
        cases += 1;
      }
      await style('garden');
    }

    step('the tray page at level 2: the whole tray and Next in view');
    await width(1180, 700);
    await start({ doc: withSetup(studiedDoc(), { lv: 2 }), day: plus(5), hash: '#/words/g/g1/test' });
    await until('document.querySelector(".keyboard--tray")', 'the tray');
    for (const s of ['garden', 'night']) {
      await style(s);
      for (const [w, h] of [[1180, 640], [1366, 900], [390, 844]]) {
        await width(w, h);
        await sleep(150);
        const id = 'tray ' + s + ' ' + w + 'x' + h;
        for (const sel of ['.keyboard--tray', '[data-next]', '[data-hear]', '.tileboxes']) {
          if (w < 820) continue; // a phone page may scroll
          const miss = await inView(sel, w, h, id);
          ok(miss === '', miss);
        }
        ok(await noSideways(), id + ': sideways scroll');
        const bad = await small();
        ok(bad.length === 0, id + ': small controls ' + bad.join('; '));
        if (w >= 820) {
          const col = await ev('(() => { const t = document.querySelector(".keyboard--tray").getBoundingClientRect(); const b = document.querySelector("[data-next]").getBoundingClientRect(); const l = document.querySelector(".tileword").getBoundingClientRect(); return { trayRight: t.left >= l.right - 1, nextUnder: b.top >= t.bottom - 1 }; })()');
          ok(col.trayRight && col.nextUnder, id + ': the tray is in the right column with Next under it ' + JSON.stringify(col));
        }
        cases += 1;
      }
    }
    await style('garden');

    step('the screens with no keyboard: ready, rest, end, at 390 and 1180x640');
    await width(390, 844);
    await start({ doc: withSetup(W.emptyDoc(), { pf: 'sen' }), hash: '#/y3/ch01/test' });
    await until('document.querySelector("[data-assess=ready]")', 'ready');
    for (const [w, h] of [[390, 844], [1180, 640]]) {
      await width(w, h);
      await sleep(80);
      ok(await noSideways() && (await rect('[data-start]')).h >= 56 && (await inView('[data-start]', w, h, 'ready')) === '', 'ready at ' + w + 'x' + h);
      ok((await small()).length === 0, 'ready controls at ' + w + 'x' + h + ': ' + (await small()).join('; '));
    }
    await H.shot('wp5-ready-extra');
    await width(390, 844);
    await click('[data-start]');
    const list = await ch1();
    const seen = [];
    let last = 0;
    for (let guard = 0; guard < 40; guard += 1) {
      await until('document.querySelector("[data-assess]")', 'a screen', 9000);
      const s = await screenNow();
      if (s === 'rest') { ok(await noSideways() && (await small()).length === 0 && (await rect('[data-carry]')).h >= 56, 'the rest screen'); await H.shot('wp5-rest'); await click('[data-carry]'); continue; }
      if (s !== 'word') break;
      const n = await wordNo();
      if (n === last) { await sleep(40); continue; }
      last = n;
      const w = await heard(list);
      await clearSaid();
      seen.push(w);
      await keys(n % 2 ? w : 'zz');
      await click('[data-next]');
    }
    await until('document.querySelector("[data-assess=end]")', 'end');
    for (const s of ['garden', 'night']) {
      await style(s);
      for (const [w, h] of [[390, 844], [1180, 640]]) {
        await width(w, h);
        await sleep(80);
        ok(await noSideways() && (await small()).length === 0, 'end at ' + s + ' ' + w + 'x' + h + ': ' + (await small()).join('; '));
        cases += 1;
      }
      await H.shot('wp5-end-' + s);
    }
    await style('garden');
    ok(!(await visible('.assess__card .pip, .assess img')), 'no picture of a word on the end screen');
    step(cases + ' cases');
    await width(390, 900);
  });
}
