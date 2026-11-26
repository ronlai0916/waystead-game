// SB6 scenes of WP-5b: S-fix-no-paper, S-normal-week, S-sbs-test, plus the Story day hook and the studyStep dispatch.
// Helpers: tools/smoke-sb6/helpers.mjs (S.openAs, S.seedSbsChild, S.seedNormalChild, S.measure, S.checks.*, S.forProfiles); how to use: sb6-process/builds/WP-10.md.
// Name every scene 'SB6 normal: <what>' so 'SB6 normal*' runs this file's.
import * as Su from '../../site/js/setup-doc.js';

const WORDS = ['build', 'earth'];
const PAPER = /\bpaper\b|\bpencil\b|\bwritten\b|write it|I.ve written|on paper/i;

export default (H, S) => {
  const { ev, until, sleep, ok, W, MON, plus, key, keys, click } = H;
  const q = JSON.stringify;
  const T0 = Date.parse(MON + 'T09:00:00');
  const has = (sel) => ev(`!!document.querySelector(${q(sel)})`);
  const txt = (sel) => ev(`(document.querySelector(${q(sel)}) || {}).textContent || ''`);
  const tap = (sel, i = 0) => ev(`(() => { const e = [...document.querySelectorAll(${q(sel)})].filter((x) => !x.disabled)[${i}]; if (!e) return false; e.click(); return true; })()`);
  const readWords = () => ev(`(async () => { const S = await import('./js/store.js'); return S.readWords(); })()`);
  const done = (doc, steps, day = MON) => { const g = W.groupById(doc, 'g1'); return steps.reduce((d, st) => W.markStep(d, g, st, day, T0), doc); };
  const drawn = () => ev(`document.body.classList.contains('is-sbs') || !!document.querySelector('[data-sbs], .s6')`);

  /** The look pages fit like any other: the main controls inside the first screen, nothing covered. */
  async function fit(p, style, name, need) {
    await sleep(120);
    const m = await S.measure();
    const d = S.checks.firstScreen(m, p, { need }).filter((x) => !(p.id === 'iphone-se1' && /sideways|below the line/.test(x))); // 320 px: today's keyboard rows are 9 px wide and Check is 3 px under the line (baseline-23b.json, Fix it in typing)
    d.push(...(await S.checks.calm()));
    await S.shotAs(p, name, style);
    return d.map((x) => p.id + ' ' + style + ' ' + name + ': ' + x);
  }

  // ---- S-fix-no-paper -------------------------------------------------------------------------------------------------
  H.scene('SB6 normal: Fix it in has no paper step, Hide it goes straight to Hide and spell (S-fix-no-paper)', async () => {
    const defects = [];
    await S.forProfiles(async (p, style) => {
      await S.openAs(p, {
        day: plus(1), hash: '#/words/g/g1/study/fix', night: style === 'night',
        seed: () => S.seedNormalChild({ year: 4, words: WORDS, day: plus(1), extra: (d) => done(d, ['hello']) }),
        wait: '!!document.querySelector("[data-cover]")',
      });
      const look = await txt('main');
      ok(!PAPER.test(look), p.id + ' the Look page has no paper line: ' + look.slice(0, 160));
      ok(/Look and say/.test(await txt('h1')), 'the Look page');
      defects.push(...(await fit(p, style, 'normal-fix-look', ['hear'])));
      const word = (await txt('.spell__word')).replace(/\s+/g, '').toLowerCase();
      ok(word.length > 2, 'the word is on show to look at: ' + word);
      await tap('[data-cover]');
      await until('!!document.querySelector("[data-check]")', 'the spelling page straight after Hide it', 5000);
      ok(!(await has('[data-written]')), 'no "I\'ve written it" button');
      ok(/Hide and spell/.test(await txt('h1')), 'the page says Hide and spell: ' + await txt('h1'));
      const t = await txt('main');
      ok(!PAPER.test(t), 'no paper line on the spelling page: ' + t.slice(0, 160));
      ok(!t.toLowerCase().includes(word), 'the word is hidden');
      ok(await has('[data-peekbtn]'), 'Fix it in keeps its Peek');
      defects.push(...(await fit(p, style, 'normal-fix-hide', ['check', 'hear', 'peek'])));
    }, { ids: ['iphone-se1', 'iphone-16', 'iphone-air-pill', 'ipad-landscape'] });
    S.report(defects, 'Fix it in without paper');
  });

  // ---- FIX-U1a (M1, F1): Hide and spell on tiles (Years 1 and 2) keeps Hear, Peek, tiles, Back/Check/Skip above the Safari bar ---------------------------
  H.scene('SB6 normal: U1a Hide and spell on tiles fits at 320 and 375 (Peek beside Hear, hint short, Check above the bar)', async () => {
    const defects = [];
    for (const year of [1, 2]) {
      await S.forProfiles(async (p, style) => {
        for (const page of ['fix', 'grid']) {
          const day = page === 'fix' ? plus(1) : plus(4);
          await S.openAs(p, {
            day, hash: page === 'fix' ? '#/words/g/g1/study/fix' : '#/words/g/g1/spell/0', night: style === 'night',
            seed: () => S.seedNormalChild({ year, words: ['build', 'earth', 'island'], day, extra: (d) => done(d, page === 'fix' ? ['hello'] : ['hello', 'fix', 'games', 'story'], day) }),
            wait: '!!document.querySelector("[data-cover], [data-check]")',
          });
          if (page === 'fix') { await tap('[data-cover]'); await until('!!document.querySelector("[data-check]")', 'Hide and spell', 5000); }
          await sleep(250);
          const name = 'y' + year + '-hide-' + page;
          const m = await S.measure({ boxes: '.tileboxes .lgap, .tileboxes .lshown', tiles: '.ltile', check: '[data-check]', hear: '[data-hear]', peek: '[data-peekbtn]', back: '[data-skip]' });
          const d = [];
          if (!m.tiles.length) d.push('no tiles (the child is not on tiles)');
          d.push(...S.checks.firstScreen(m, p, { need: ['check', 'hear', 'peek'] }));
          for (const k of ['peek', 'hear']) for (const c of m[k]) if (c.w < 47.5 || c.h < 47.5) d.push(k + ' is ' + c.w + ' x ' + c.h + ', under 48 x 48'); // the Usual tray tiles are today's (52 x 60, 48 x 56 at 320): only Hear and Peek are measured here
          if (m.scrollPx > 0) d.push('page scrolls ' + m.scrollPx + ' px');
          const hear = m.hear[0]; const peek = m.peek[0];
          if (hear && peek && (Math.abs(hear.t - peek.t) > 6 || peek.l < hear.r)) d.push('Peek (' + peek.l + ',' + peek.t + ') is not on the same row, to the right of Hear (' + hear.l + '-' + hear.r + ',' + hear.t + ')');
          const hint = await ev('(document.querySelector("[data-hint]") || {}).textContent || ""');
          if (!/^Peek restarts your count\.$/.test(hint)) d.push('the hint reads "' + hint + '"');
          if (process.env.U1A_DEBUG) console.log('  · ' + p.id + ' ' + style + ' ' + name + ' scroll ' + m.scrollPx + ' check ' + JSON.stringify(m.check.map((c) => c.b)) + ' tiles ' + m.tiles.length);
          defects.push(...d.map((x) => p.id + ' ' + style + ' ' + name + ': ' + x));
          await S.shotAs(p, 'u1a-' + name, style);
        }
      }, { ids: ['iphone-se1', 'iphone-se'] });
    }
    S.report(defects, 'U1a Hide and spell');
    await S.reset();
  });

  // ---- Story day, the Usual way: "Help me build it" ----------------------------------------------------------------------
  H.scene('SB6 normal: Story day keeps its box and adds Help me build it; the builder fills the box, nothing is saved until Save', async () => {
    const defects = [];
    for (const [pid, style] of [['iphone-se1', 'garden'], ['iphone-16', 'night'], ['ipad-landscape-bars', 'garden']]) {
      const p = S.profile(pid);
      await S.openAs(p, {
        day: plus(4), hash: '#/words/g/g1/study/story', night: style === 'night',
        seed: () => S.seedNormalChild({ year: 4, words: ['friend', 'island', 'guard'], day: plus(4), extra: (d) => done(d, ['hello', 'fix', 'games']) }),
        wait: '!!document.querySelector("[data-go], [data-story]")',
      });
      if (await has('[data-go]')) await tap('[data-go]');
      await until('!!document.querySelector("[data-story] [data-text]")', 'the sentence box', 6000);
      ok(/Make a sentence/.test(await txt('h1')), 'Make a sentence, not Write: ' + await txt('h1'));
      ok(!/\bwrite\b/i.test(await txt('main')), 'no "write" on the Story day page: ' + (await txt('main')).slice(0, 200));
      ok(await has('[data-build]') && (await txt('[data-build]')).trim() === 'Help me build it', 'the quiet Help me build it button');
      const r = await ev(`(() => { const r = document.querySelector('[data-build]').getBoundingClientRect(); return [r.width, r.height]; })()`);
      ok(r[0] >= 44 && r[1] >= 44, 'Help me build it is at least 44 px: ' + r);
      ok(!(await ev('document.documentElement.scrollWidth > document.documentElement.clientWidth')), 'no sideways scroll on the Story day box (a scrolling form, as before)');
      await S.shotAs(p, 'normal-story-box', style);
      await ev(`(() => { const t = document.querySelector('[data-text]'); t.value = 'my own start'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await tap('[data-build]');
      await until('!!document.querySelector(".b6.b6-l1")', 'level 1', 9000);
      while (await has('[data-cards]:not([hidden]) [data-card]')) await tap('[data-cards]:not([hidden]) [data-card]');
      await tap('[data-next]');
      await until('!!document.querySelector(".b6.b6-l3")', 'level 3', 9000);
      ok(!(await has('[data-peekbtn]')), 'no Peek in the Usual way builder');
      for (let k = 0; k < 9 && !(await txt('[data-instruction]')).includes('Hear your sentence'); k += 1) {
        await tap('[data-show]'); await sleep(40);
        if (await ev(`document.querySelector('.s6-slot:not(.is-filled)') === null`)) { await tap('[data-next]'); await sleep(200); }
      }
      await tap('[data-next]');
      await until('!!document.querySelector("[data-story] [data-text]")', 'back at the Story day box', 6000);
      const box = await ev(`document.querySelector('[data-text]').value`);
      ok(box.length > 10 && box !== 'my own start', 'the built sentence fills the box: ' + box);
      ok((await readWords()).notes.length === 0, 'nothing is saved by the builder');
      ok(!(await ev('document.body.classList.contains("is-sbs")')), 'the builder left no Step by step look behind');
      await ev(`(() => { const t = document.querySelector('[data-text]'); t.value = t.value + ' today'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await tap('[data-save]');
      await sleep(200);
      const ns = (await readWords()).notes;
      ok(ns.length === 1 && !ns[0].bl && !ns[0].hp, 'Save writes today\'s note, with no builder fields: ' + JSON.stringify(ns));
      await S.shotAs(p, 'normal-story-next', style);
    }
    S.report(defects, 'Usual way Story day');
  });

  // ---- S-normal-week: the Usual way's stones are today's ---------------------------------------------------------------------
  H.scene('SB6 normal: a Usual way child\'s stones are today\'s (no Step by step screen anywhere) (S-normal-week)', async () => {
    const days = [
      ['hello', plus(1), [], '.wordcard'],
      ['fix', plus(2), ['hello'], '[data-cover]'],
      ['games', plus(3), ['hello', 'fix'], '[data-game], .gamepick, .page'],
    ];
    for (const [step, day, before, wait] of days) {
      await S.openAs(S.profile('iphone-16'), {
        day, hash: '#/words/g/g1/study/' + step,
        seed: () => S.seedNormalChild({ year: 4, words: WORDS, day, extra: (d) => done(d, before) }),
        wait: '!!document.querySelector(' + q(wait) + ')',
      });
      await sleep(250);
      ok(!(await drawn()), step + ': the Usual way has no Step by step screen');
      ok(/study\/|\/g1/.test(await ev('location.hash')), step + ' opens');
      ok(!/Meanings|Meet the words|Letter ladder|Sentences$/.test(await txt('.eyebrow, h1')), step + ' keeps its Usual names: ' + await txt('.eyebrow, h1'));
    }
    // Words in a row is Step by step only: a Usual child's address goes back to the week, and the job button goes to the grid
    await S.openAs(S.profile('iphone-16'), {
      day: plus(4), hash: '#/words/g/g1/study/practice',
      seed: () => S.seedNormalChild({ year: 4, words: WORDS, day: plus(4), extra: (d) => done(d, ['hello', 'fix', 'games', 'story']) }),
    });
    await until('/\\/g1$/.test(location.hash)', 'a Usual child is sent back to the week from the Step by step address', 4000);
    const href = await ev(`(async () => { const SV = await import('./js/study-views.js'); const S = await import('./js/store.js'); const W = await import('./js/words-doc.js'); const d = S.readWords(); return SV.stepHref(d, W.groupById(d, 'g1'), 'practice', ${q(plus(4))}); })()`);
    ok(/\/spell\/\d+$/.test(href), 'the Usual practice job goes to the grid: ' + href);
  });

  // ---- the Quiz Stretch: one Peek (TR-41) ----------------------------------------------------------------------------------
  H.scene('SB6 normal: a Stretch quiz has one Peek, then the button stays off', async () => {
    await S.openAs(S.profile('iphone-16'), {
      day: MON, hash: '#/y3/ch01/quiz',
      seed: () => S.seedNormalChild({ year: 5, words: WORDS, extra: (d) => W.withSetup(d, Su.setProfile({}, 'top', T0, 'Sam')) }),
      wait: '!!document.querySelector("[data-assess=word]")',
    });
    ok(await has('[data-peekbtn]'), 'Stretch has a Peek on the quiz');
    ok(!(await ev('document.querySelector("[data-peekbtn]").disabled')), 'on at the start');
    await tap('[data-peekbtn]');
    await until('document.querySelector("[data-peek]").textContent.length > 2', 'the word on show', 3000);
    ok(await ev('document.querySelector("[data-peekbtn]").disabled'), 'off while the word shows');
    await until('document.querySelector("[data-peek]").textContent === ""', 'the word goes again', 6000);
    ok(await ev('document.querySelector("[data-peekbtn]").disabled'), 'a second Peek is not offered');
    ok(!(await has('[data-hint]')), 'no hint on Stretch');
  });

  // ---- S-sbs-test: one Peek a word, a peeked word is "spelled with a peek" ----------------------------------------------------------
  H.scene('SB6 normal: a Step by step weekly test has one Peek a word; a peeked word keeps being practised, never remembered (S-sbs-test)', async () => {
    const defects = [];
    for (const [pid, style] of [['iphone-16', 'garden'], ['iphone-se', 'night'], ['ipad-landscape-bars', 'garden']]) {
      const p = S.profile(pid);
      await S.openAs(p, {
        day: plus(5), hash: '#/words/g/g1/test', night: style === 'night',
        seed: () => S.seedSbsChild({ year: 4, words: WORDS, day: plus(5), extra: (d) => H.studied(d, 'g1', plus(1)) }),
        wait: '!!document.querySelector("[data-assess]")',
      });
      let step = 0;
      const peeked = [];
      for (let guard = 0; guard < 6; guard += 1) {
        const screen = await ev('document.querySelector("[data-assess]") ? document.querySelector("[data-assess]").dataset.assess : ""');
        if (screen === 'ready') { await tap('[data-start]'); await sleep(120); continue; }
        if (screen === 'rest') { await tap('[data-carry]'); await sleep(120); continue; }
        if (screen === 'wait') { await tap('[data-show]'); await sleep(120); continue; }
        if (screen === 'end') break;
        if (screen !== 'word') { await sleep(150); continue; }
        // which word is it? the page spoke it (or its sentence)
        await until('globalThis.__said.length + globalThis.__lines.length > 0', 'the word spoken', 4000);
        const heard = (await ev('globalThis.__said.concat(globalThis.__lines).slice(-3).join(" ")')).toLowerCase();
        const w = WORDS.find((x) => new RegExp('\\b' + x).test(heard) && !peeked.includes(x) && !(step === 1 && x === peeked[0]));
        ok(w, 'a week word was spoken: ' + heard);
        ok(await has('[data-peekbtn]'), 'the Step by step test offers one Peek');
        if (step === 0) {
          await tap('[data-peekbtn]');
          await until('document.querySelector("[data-peek]").textContent.toLowerCase() === ' + q(w), 'the word shows once', 3000);
          ok(await ev('document.querySelector("[data-peekbtn]").disabled && document.querySelector("[data-next]").disabled'), 'Peek is off and Next waits while it shows');
          defects.push(...(await fit(p, style, 'sbs-test-peek', ['hear', 'peek'])));
          await until('document.querySelector("[data-peek]").textContent === ""', 'the word goes again', 8000);
          ok(await ev('document.querySelector("[data-peekbtn]").disabled'), 'a second Peek is not offered, and nothing says so');
          ok((await txt('[data-peek]')) === '', 'no message after the Peek');
          peeked.push(w);
        } else {
          ok(!(await ev('document.querySelector("[data-peekbtn]").disabled')), 'the next word has its own Peek');
        }
        await keys(w);
        await tap('[data-next]');
        await sleep(200);
        step += 1;
      }
      await until('!!document.querySelector("[data-assess=end]")', 'the end of the test', 6000);
      const end = await txt('[data-assess=end]');
      ok(/Test done/.test(end) && /Words you spelled/.test(end) && /Words we.ll keep practising/.test(end), p.id + ' the two lists: ' + end.slice(0, 200));
      ok(!/\d+ of \d+|\bpassed?\b|\bscore\b|not yet|not this time/i.test(end), 'no count, no pass word: ' + end.slice(0, 200));
      const keep = (await txt('[data-keep]')).toLowerCase();
      const spelled = (await txt('[data-spelled]')).toLowerCase();
      ok(keep.includes(peeked[0]) && !keep.includes(WORDS.find((x) => x !== peeked[0])), 'the peeked word will be practised again: ' + keep);
      ok(spelled.includes(WORDS.find((x) => x !== peeked[0])) && !spelled.includes(peeked[0]), 'the other word was spelled: ' + spelled);
      defects.push(...(await fit(p, style, 'sbs-test-end', [])));
      const tries = (await readWords()).results.filter((r) => r.k === 't');
      const a = tries.find((r) => r.w === peeked[0]);
      const b = tries.find((r) => r.w !== peeked[0]);
      ok(a && a.p === 1 && a.c === 0 && a.pr === 1, 'the peeked word is recorded with a peek (p 1, c 0, pr 1): ' + JSON.stringify(a));
      ok(b && b.c === 1 && !b.p && b.pr === undefined, 'the other is a clean try: ' + JSON.stringify(b));
      const res = await ev(`(async () => { const S = await import('./js/store.js'); const W = await import('./js/words-doc.js'); const d = S.readWords(); return { fix: W.fixups(d, W.groupById(d, 'g1')), left: W.testLeft(d, W.groupById(d, 'g1')) }; })()`);
      ok(res.left.length === 0 && res.fix.includes(peeked[0]) && !res.fix.includes(WORDS.find((x) => x !== peeked[0])), 'the peeked word goes to Mend, never to remembered: ' + JSON.stringify(res));
    }
    S.report(defects, 'Step by step test');
  });

  // ---- the studyStep dispatch (TR-43) --------------------------------------------------------------------------------------------
  H.scene('SB6 normal: a Step by step child\'s stones open their own screens: Meet, Meanings, Sentences, Words in a row (S-sbs-dispatch)', async () => {
    const open = async (day, hash, before, wait) => {
      await S.openAs(S.profile('iphone-16'), {
        day, hash, seed: () => S.seedSbsChild({ year: 4, words: ['friend', 'island', 'guard'], day, extra: (d) => done(d, before, day) }), wait,
      });
      await sleep(300);
    };
    await open(MON, '#/words/g/g1/study/hello', [], '!!document.querySelector(".s6")');
    ok(await ev('document.body.classList.contains("is-sbs")'), 'Meet the words is the Step by step runner');
    await open(plus(1), '#/words/g/g1/study/fix', ['hello'], '!!document.querySelector(".s6")');
    ok(await ev('document.body.classList.contains("is-sbs")') && !(await has('[data-cover]')), 'Letter ladder is the runner, with no Hide it');
    // Meanings: the games stone under its Step by step name
    await open(plus(2), '#/words/g/g1/study/games', ['hello', 'fix'], '!!document.querySelector("main section, main .wrap")');
    ok(!/Game day/.test(await txt('main')), 'the games stone is not Game day: ' + (await txt('main')).slice(0, 80));
    ok(/Meanings/.test(await txt('main')), 'it is called Meanings: ' + (await txt('main')).slice(0, 80));
    // Sentences: the builder, once for each word
    await open(plus(3), '#/words/g/g1/study/story', ['hello', 'fix', 'games'], '!!document.querySelector("[data-builder]")');
    ok(await has('.b6') && !(await has('[data-story]')), 'Story day is the builder, not the box');
    ok(/Sentence 1 of 3/.test(await txt('main')) || (await has('.s6-steps')), 'one sentence for each word');
    // the builder may answer null (no sentence made, nothing saved): the next word comes, the stone ends, nothing is invented
    await ev(`(async () => {
      const SV = await import('./js/study-views.js'); const S = await import('./js/store.js'); const W = await import('./js/words-doc.js');
      const g = W.groupById(S.readWords(), 'g1'); window.__calls = [];
      window.__end = SV.storySbs(document.querySelector('main'), g, { build: (m, o) => { window.__calls.push(o.word + ' ' + o.index + '/' + o.of + ' ' + o.levels.join('')); setTimeout(() => o.onDone(null), 20); return () => {}; } });
    })()`);
    await until('window.__calls.length >= 3', 'three words asked', 4000);
    await sleep(300);
    const calls = await ev('window.__calls');
    ok(calls.length === 3 && new Set(calls.map((c) => c.split(' ')[0])).size === 3 && calls.every((c) => /^\w+ \d\/3 \d+$/.test(c)), 'one builder call a word, each once: ' + calls.join(' | '));
    ok(/done|Done for today/i.test(await txt('main')), 'the stone ends after the last word: ' + (await txt('main')).slice(0, 100));
    const dd = await readWords();
    ok(dd.notes.length === 0 && Object.keys(dd.steps).some((k) => k.endsWith('|story')), 'no sentence was invented, and the stone is marked');
    await ev('window.__end && window.__end()');
    // Words in a row
    await open(plus(4), '#/words/g/g1/study/practice', ['hello', 'fix', 'games', 'story'], '!!document.querySelector(".s6")');
    ok(await ev('document.body.classList.contains("is-sbs")'), 'Words in a row is the Step by step runner');
    const href = await ev(`(async () => { const SV = await import('./js/study-views.js'); const S = await import('./js/store.js'); const W = await import('./js/words-doc.js'); const d = S.readWords(); return SV.stepHref(d, W.groupById(d, 'g1'), 'practice', ${q(plus(4))}); })()`);
    ok(/\/study\/practice$/.test(href), 'the job button goes to the stone, not the grid: ' + href);
  });
  // ---- FIX-U1a (F8): Step by step revisit from the path page ------------------------------------------------------------------
  H.scene('SB6 normal: U1a Step by step revisit (Do it again opens the earlier stone; on test day it goes to the test)', async () => {
    const hrefOf = (step) => ev(`(() => { const e = document.querySelector('[data-again="${step}"]'); return e ? (e.getAttribute('href') || '') : null; })()`);
    const openPath = async (day, before) => {
      await S.openAs(S.profile('iphone-16'), {
        day, hash: '#/words/g/g1/path', seed: () => S.seedSbsChild({ year: 4, words: ['friend', 'island', 'guard'], day, extra: (d) => done(d, before, day) }),
        wait: '!!document.querySelector("main")',
      });
      await sleep(400);
    };
    // before test day: Meet the words is done; Do it again on it opens that stone (the runner), not the test
    await openPath(plus(2), ['hello', 'fix']);
    const h1 = await hrefOf('hello');
    ok(h1 && /\/study\/hello$/.test(h1), 'path page: Do it again on Meet the words points at its stone: ' + h1);
    await tap('[data-again="hello"]');
    await until('location.hash.includes("/study/hello")', 'the earlier stone opens', 6000);
    await until('document.body.classList.contains("is-sbs") && !!document.querySelector(".s6")', 'the Meet runner draws', 6000);
    ok(!/\/test/.test(await ev('location.hash')), 'it is the stone, not the test: ' + await ev('location.hash'));
    ok(!/Game day|Hello words/.test(await txt('main')), 'under its Step by step name');
    const h2 = await (async () => { await openPath(plus(3), ['hello', 'fix', 'games']); return hrefOf('fix'); })();
    ok(h2 && /\/study\/fix$/.test(h2), 'a second earlier stone (Letter ladder) opens its stone too: ' + h2);
    // on test day: the same Do it again goes to the test
    await openPath(plus(5), ['hello', 'fix', 'games', 'story', 'practice']);
    const ag = await ev(`[...document.querySelectorAll('[data-again]')].map((e) => e.getAttribute('href') || '')`);
    ok(ag.every((x) => /\/test$/.test(x)), 'on test day no Do it again opens a stone; any that shows goes to the test: ' + ag.join(' | '));
    const jobHref = await ev(`(() => { const e = document.querySelector('[data-job]'); return e ? (e.getAttribute('href') || '') : null; })()`);
    ok(jobHref && /\/test$/.test(jobHref), 'on test day the path page\'s live row goes to the test: ' + jobHref);
    await tap('[data-job]');
    await until('location.hash.endsWith("/test")', 'the test opens', 6000);
  });

  // ---- FIX-U1a (Normal S3): the Usual Story day builder finishes by taps alone ----------------------------------------------------
  H.scene('SB6 normal: U1a Story day builder finishes by taps alone (empty box, no typing, Save)', async () => {
    const defects = [];
    for (const [pid, style] of [['iphone-se1', 'garden'], ['iphone-se', 'night']]) {
      const p = S.profile(pid);
      await S.openAs(p, {
        day: plus(4), hash: '#/words/g/g1/study/story', night: style === 'night',
        seed: () => S.seedNormalChild({ year: 4, words: ['friend', 'island', 'guard'], day: plus(4), extra: (d) => done(d, ['hello', 'fix', 'games']) }),
        wait: '!!document.querySelector("[data-go], [data-story]")',
      });
      if (await has('[data-go]')) await tap('[data-go]');
      await until('!!document.querySelector("[data-story] [data-text]")', 'the sentence box', 6000);
      ok(!(await ev('document.querySelector("[data-text]").value')), 'the box starts empty');
      await tap('[data-build]');
      await until('!!document.querySelector(".b6.b6-l1")', 'level 1', 9000);
      let taps = 0;
      while (await has('[data-cards]:not([hidden]) [data-card]')) { await tap('[data-cards]:not([hidden]) [data-card]'); taps += 1; if (taps > 40) break; }
      await tap('[data-next]');
      await until('!!document.querySelector(".b6.b6-l3")', 'level 3', 9000);
      for (let k = 0; k < 12 && !(await txt('[data-instruction]')).includes('Hear your sentence'); k += 1) {
        const m = await S.measure({ check: '[data-next], [data-show]' });
        defects.push(...S.checks.firstScreen(m, p, { need: [] }).map((x) => p.id + ' ' + style + ' level 3: ' + x));
        await tap('[data-show]'); await sleep(40);
        if (await ev(`document.querySelector('.s6-slot:not(.is-filled)') === null`)) { await tap('[data-next]'); await sleep(200); }
      }
      await tap('[data-next]');
      await until('!!document.querySelector("[data-story] [data-text]")', 'back at the Story day box', 6000);
      const box = await ev(`document.querySelector('[data-text]').value`);
      ok(box.length > 10, 'taps alone filled the box: ' + box);
      await tap('[data-save]');
      await sleep(250);
      ok((await readWords()).notes.length === 1, 'Save wrote the note: ' + box);
    }
    S.report(defects, 'U1a Story builder by taps');
    await S.reset();
  });

};
