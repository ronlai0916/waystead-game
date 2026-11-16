// SB4-WP9: Years 1 and 2 content in the app, with tests/fixtures/sb4-year12.json served as the curriculum.
// Loaded by tools/sb2-smoke.mjs with the harness H.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Su from '../../site/js/setup-doc.js';

const FIXTURE = readFileSync(fileURLToPath(new URL('../../tests/fixtures/sb4-year12.json', import.meta.url)), 'utf8');

export default function (H) {
  const { scene, go, click, ev, ok, has, text, until, keys, sleep, width, open, acct, W, MON, plus, CHILD } = H;
  const q = (s) => JSON.stringify(s);
  const NOW = Date.parse(MON + 'T08:00:00');
  const T0 = Date.parse(MON + 'T09:00:00');
  const step = (n) => console.log('  · ' + n);
  const progDoc = (chapters = {}, results = []) => ({ v: 1, resetAt: 0, chapters, results, folded: {}, tricky: {} });
  const passedCh = (id, n = 1) => ({ id: 'r' + id + n, c: id, s: 5, t: 5, at: T0 + n });
  const me = (year) => ({ signedIn: true, kind: 'child', id: CHILD, nickname: 'Robin', year, avatar: null, parentId: H.ADULT });
  const withHelp = (doc, lv) => (lv ? W.withSetup(doc, Su.setHelp({}, lv, NOW, 'Sam')) : doc);
  const baseDoc = (words, test = plus(7)) => W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week one', test, words, today: MON, now: T0 }).doc;
  const mark = (d, steps) => { const g = W.groupById(d, 'g1'); return steps.reduce((x, [st, k]) => W.markStep(x, g, st, plus(k), Date.parse(plus(k) + 'T09:00:00')), d); };
  const practiceDoc = (words) => mark(baseDoc(words, plus(5)), [['hello', 0], ['fix', 1], ['games', 2], ['story', 3]]);
  const noExample = (word) => { const c = JSON.parse(FIXTURE); for (const b of Object.values(c)) for (const ch of (b && b.chapters) || []) for (const w of ch.words) if (w.word === word) delete w.meaning.example; return JSON.stringify(c); };
  const said = () => ev('globalThis.__lines.slice()');
  const cells = () => ev(`[...document.querySelectorAll('.tileboxes .lshown, .tileboxes .lgap')].map((c) => (c.classList.contains('lgap') ? '_' : c.textContent))`);
  const asYear1 = async (doc, day, hash) => { await H.seedChild(doc, day); acct.who = me(1); await open(day, hash); };

  scene('SB4-WP9 a word with no picture shows its sentence, with Hear; no example keeps the lettered tile', async () => {
    H.serve('data/curriculum.json', noExample('well'));
    await asYear1(W.emptyDoc(), MON, '#/y1/ch01/study');
    await until('document.querySelector(".studylist .wordcard")', 'the study page');
    const n = await ev('document.querySelectorAll(".studylist .wordcard").length');
    ok(n === 9, 'nine words: ' + n);
    ok(await ev('document.querySelectorAll(".studylist .pic--sentence").length') === 8, 'eight sentence cards');
    ok(await ev('document.querySelectorAll(".studylist .pic__ph").length') === 1, 'one lettered tile, for the word with no example');
    ok(await ev('document.querySelector("#w-well .pic__ph b").textContent') === 'W', 'it is the W of well');
    ok(await ev('document.querySelector("#w-off .pic--sentence b").textContent') === 'off', 'the word is in bold in its sentence');
    ok(await ev('document.querySelectorAll("#w-off .example").length') === 1, 'the sentence is shown once');
    const sentence = await ev('document.querySelector("#w-off .pic--sentence .example").textContent');
    await ev('globalThis.__lines.length = 0');
    await click('#w-off [data-sentence]');
    await until('globalThis.__lines.length > 0', 'the sentence read aloud');
    ok((await said()).includes(sentence), 'Hear reads the sentence with the device voice (no MP3): ' + (await said()).join('|'));
    ok(!/\b(wrong|fail|failed|incorrect|mistake|late|lost|error)\b/i.test(await text('.studylist')), 'no banned words');
    for (const st of ['garden', 'paint', 'night']) {
      await H.style(st);
      const r = await ev('(() => { const r = document.querySelector("[data-sentence]").getBoundingClientRect(); return [r.width, r.height]; })()');
      ok(r[0] >= 48 && r[1] >= 48, 'Hear is at least 48 x 48 in ' + st + ': ' + r);
      await H.shot('wp9-sentence-' + st);
    }
    await H.style('garden');
    await width(320);
    ok(await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'no sideways scroll at 320');
    await width(390);
    step('the Hello card');
    const doc = baseDoc(['off', 'well']);
    await asYear1(doc, MON, '#/words/g/g1/study/hello');
    await until('document.querySelector(".wordcard--hello")', 'the Hello card');
    const w0 = await ev('document.querySelector(".wordcard__word").textContent.replace(/\\s/g, "")');
    ok(await has('.wordcard--hello .pic--sentence') && !await has('.wordcard--hello .pic__ph'), 'the Hello card for ' + w0 + ' shows the sentence card');
    ok(await ev('document.querySelectorAll(".wordcard--hello .example").length') === 1, 'the sentence once');
    await ev('globalThis.__lines.length = 0');
    await click('.wordcard--hello [data-sentence]');
    await until('globalThis.__lines.length > 0', 'the Hello sentence read aloud');
    H.serve('data/curriculum.json', null);
  });

  scene('SB4-WP9 More practice opens on Year 1; a noMatch chapter offers no Meaning match; busy has separate progress', async () => {
    H.serve('data/curriculum.json', FIXTURE);
    const stateOf = async (yr, i) => { await click('[data-moreyears]').catch(() => {}); await click('.yearswitch__b[data-year=' + yr + ']'); return ev('document.querySelectorAll("[data-yearpanel=' + yr + '] .stonelink")[' + i + '].dataset.state'); };
    // a Year 2 child with no data at all: the state of the Year 3 chapter that also holds busy
    await H.childWith(progDoc(), '#/chapters');
    acct.who = me(2);
    await open(plus(2), '#/chapters');
    await until('document.querySelector("[data-yearpanel]")', 'More practice');
    const base34 = await stateOf('y3', 1);
    const baseWords = JSON.stringify(await ev(`(async () => { const D = await import('./js/data.js'); return D.chapterBySlug('y3', 'ch02').words.map((w) => w.word); })()`));
    // now Year 2 chapter 1 passed, and busy tried in it
    await H.childWith(W.addTry(W.emptyDoc(), { id: 'tb1', word: 'busy', day: MON, group: 'y2-ch01', kind: 'p', tries: 0, peeks: 0, clean: true, now: T0 }), '#/chapters');
    await ev('localStorage.setItem("sb.progress:' + CHILD + '",' + q(JSON.stringify(progDoc({}, [passedCh('y2-ch01')]))) + ')');
    acct.who = me(2);
    await open(plus(2), '#/chapters');
    await until('document.querySelector("[data-yearpanel]")', 'More practice');
    ok(await stateOf('y2', 0) === 'passed', 'Year 2 Chapter 1 is passed');
    ok((await stateOf('y3', 1)) === base34, 'Year 3 Chapter 2 (also busy) is the same as with no Year 2 data: ' + base34);
    ok(JSON.stringify(await ev(`(async () => { const D = await import('./js/data.js'); return D.chapterBySlug('y3', 'ch02').words.map((w) => w.word); })()`)) === baseWords, 'and has the same words');
    await H.childWith(progDoc({}, [passedCh('y2-ch01')]), '#/chapters');
    acct.who = me(1);
    await open(plus(2), '#/chapters');
    await until('document.querySelector("[data-yearpanel]")', 'More practice');
    ok(await ev('document.querySelector("[data-yearpanel]").dataset.yearpanel') === 'y1', 'a Year 1 child opens on Year 1');
    const verdict = await ev(`(async () => {
      const D = await import('./js/data.js'); const G = await import('./js/games-doc.js');
      const ch = D.chapterBySlug('y1', 'ch01'); const entries = ch.words.map((w) => D.entry(w.word));
      const ch2 = D.chapterBySlug('y1', 'ch02'); const e2 = ch2.words.map((w) => D.entry(w.word));
      return { noMatch: ch.noMatch === true, one: G.gamesFor(entries, ch).includes('match'), two: G.gamesFor(e2, ch2).includes('match') };
    })()`);
    ok(verdict.noMatch && !verdict.one, 'the noMatch chapter offers no Meaning match');
    ok(verdict.two, 'a chapter without noMatch still does');
    await click('.yearswitch__b[data-year=y2]');
    const y2 = await ev('[...document.querySelectorAll("[data-yearpanel=y2] .stonelink")].map((a) => a.dataset.state)');
    ok(y2[0] === 'passed', 'busy\'s Year 2 chapter is passed: ' + y2);
    await click('[data-moreyears]');
    await click('.yearswitch__b[data-year=y3]');
    const y3 = await ev('[...document.querySelectorAll("[data-yearpanel=y3] .stonelink")].map((a) => a.dataset.state)');
    ok(y3[1] !== 'passed', 'the Year 3 chapter that also has busy is not passed: ' + y3);
    H.serve('data/curriculum.json', null);
  });

  scene('SB4-WP9 "a" and "I" come from three tiles; Monday and Mr show their capital; "monday" is accepted typed', async () => {
    H.serve('data/curriculum.json', FIXTURE);
    for (const lv of [1, 2, 3, 4]) {
      for (const [word, shown] of [['a', null], ['I', null], ['Monday', 'M'], ['Mr', 'M']]) {
        await H.seedChild(withHelp(practiceDoc([word]), lv), plus(4));
        acct.who = me(1);
        await ev('localStorage.setItem("sb.tilesTest","1")');
        await open(plus(4), '#/');
        await width(390, 844);
        await go('#/words/g/g1/spell/0');
        await until('document.querySelector(".keyboard--tray")', 'the tray for ' + word + ' at level ' + lv);
        await sleep(120);
        const c = await cells();
        if (shown) ok(c[0] === shown, word + ' at level ' + lv + ' shows its capital as a fixed letter: ' + c);
        else {
          const t = await ev('document.querySelectorAll(".ltile[data-tile]").length');
          ok(t === 3 && c.filter((x) => x === '_').length === 1, word + ' at level ' + lv + ' is asked from three tiles: ' + t + ' tiles, cells ' + c);
        }
      }
    }
    step('the games page never offers a or I');
    const gdoc = mark(baseDoc(['a', 'I', 'Monday', 'build'], plus(5)), [['hello', 0], ['fix', 1]]);
    await H.seedChild(gdoc, plus(2));
    acct.who = me(1);
    await open(plus(2), '#/');
    await ev('sessionStorage.setItem("sb.selection",' + q(JSON.stringify(['a', 'I', 'Monday', 'build'])) + ')');
    await go('#/custom/play');
    await until('document.querySelector(".progressline")', 'the flower game');
    ok(/of 2$/.test(await text('.progressline')), 'the flower game has two words, not a or I: ' + await text('.progressline'));
    for (const game of ['missing', 'unjumble']) {
      await go('#/words/g/g1/game/' + game);
      await until('document.querySelector("[data-game=' + game + ']")', game);
      ok(/^2 words to go/.test((await text('[data-game] .pagehead .muted')).trim()), game + ' has two words: ' + await text('[data-game] .pagehead .muted'));
    }
    step('keyboard level: Monday typed in lower case');
    await H.seedChild(practiceDoc(['Monday']), plus(4));
    acct.who = me(3);
    await open(plus(4), '#/');
    await go('#/words/g/g1/spell/0');
    await until('document.querySelector(".spellbox") && !document.querySelector(".keyboard--tray")', 'the plain keyboard');
    await keys('monday');
    await until('document.querySelectorAll(".spellbox.is-filled").length === 6 || document.querySelector("[data-next]")', 'six letters typed', 6000);
    await sleep(900);
    const tries = JSON.parse(await ev('localStorage.getItem("sb.words:' + CHILD + '")')).results || [];
    ok(tries.some((t) => t.w === 'Monday' && t.c === 1 && t.t === 0), 'a typed monday is a clean try: ' + JSON.stringify(tries.map((t) => [t.w, t.c, t.t])));
    H.serve('data/curriculum.json', null);
  });
}
