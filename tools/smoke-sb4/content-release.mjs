// SB4-E/F content release: Years 1 to 6 built into the real site/data/curriculum.json (no fixture here: the
// scenes in content.mjs and years.mjs keep using tests/fixtures). Loaded by tools/sb2-smoke.mjs with the harness H.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CUR = JSON.parse(readFileSync(fileURLToPath(new URL('../../site/data/curriculum.json', import.meta.url)), 'utf8'));
const ASSETS = JSON.parse(readFileSync(fileURLToPath(new URL('../../site/data/assets.json', import.meta.url)), 'utf8'));
const OLD = /^y(34|56)-ch\d\d$/;
const ALL = ['year_1', 'year_2', 'year_3_4', 'year_5_6'].flatMap((b) => CUR[b].chapters);
const byYear = (n) => ALL.filter((c) => c.year === n);

export default function (H) {
  const { scene, go, click, ev, ok, has, text, until, sleep, width, open, acct, W, MON, plus, CHILD } = H;
  const q = (s) => JSON.stringify(s);
  const T0 = Date.parse(MON + 'T09:00:00');
  const step = (n) => console.log('  · ' + n);
  const progDoc = (chapters = {}, results = []) => ({ v: 1, resetAt: 0, chapters, results, folded: {}, tricky: {} });
  const passedCh = (id, n = 1) => ({ id: 'r' + id + n, c: id, s: 5, t: 5, at: T0 + n });
  const me = (year) => ({ signedIn: true, kind: 'child', id: CHILD, nickname: 'Robin', year, avatar: null, parentId: H.ADULT });
  const noSideways = () => ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth');
  const years = () => ev('[...document.querySelectorAll(".yearswitch__b")].map((b) => b.dataset.year || "more")');
  const panelStones = () => ev('[...document.querySelectorAll("[data-yearpanel] .stonelink")].map((a) => a.dataset.state)');
  const said = () => ev('globalThis.__lines.slice()');
  /** A child of `year` with `passed` chapters passed, opened at `hash` two days in. */
  async function asChild(year, passed, hash, day = plus(2)) {
    await H.seedChild(W.emptyDoc(), day);
    await ev('localStorage.setItem("sb.progress:' + CHILD + '",' + q(JSON.stringify(progDoc({}, passed.map((id, i) => passedCh(id, i + 1))))) + ')');
    acct.who = me(year);
    await open(day, hash);
  }

  scene('SB4-EF a Year 1 child opens Year 1: ten stones, the first one open, no sideways scroll', async () => {
    await asChild(1, [], '#/chapters');
    await until('document.querySelector("[data-yearpanel]")', 'More practice');
    ok(await ev('document.querySelector("[data-yearpanel]").dataset.yearpanel') === 'y1', 'opens on Year 1');
    const stones = await panelStones();
    ok(stones.length === 10, 'ten stones in Year 1: ' + stones.length);
    ok(stones.every((s) => s === 'todo') && await ev('document.querySelectorAll("[data-yearpanel] .stonelink")[0].classList.contains("is-next")'), 'nothing begun, the first is the next one: ' + stones);
    ok(JSON.stringify(await years()) === JSON.stringify(['y1', 'y2', 'more']), 'Year 1, Year 2 and Other years: ' + await years());
    ok(!/\b(all )?10 passed\b/i.test(await text('.yearcard')), 'no "10 passed" count in the card');
    ok(await noSideways(), 'no sideways scroll at 390');
    await click('[data-chapter=ch01]');
    await until('document.querySelector("[data-chapterpage]")', 'Year 1 chapter 1');
    ok(/Year 1 common exception words \(from the national curriculum\)/.test(await text()) || /Pattern words: our examples for the Year 1 rule/.test(await text()), 'the chapter says where its words come from: ' + (await text('[data-chapterpage]')).slice(0, 200));
    ok(!/statutory/i.test(await text('[data-chapterpage]')), 'nothing here calls a Year 1 list statutory');
  });

  const FIRST_NEW = { 1: 'y1-ch01', 2: 'y2-ch01', 3: 'y3-n01', 4: 'y4-n01', 5: 'y5-n01', 6: 'y6-n01' };
  scene('SB4-EF a chapter of every new year opens and studies: sentence cards, no broken pictures, Hear with the device voice', async () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const ch = ALL.find((c) => c.id === FIRST_NEW[n]);
      const inYear = byYear(n);
      const slug = 'ch' + String(inYear.indexOf(ch) + 1).padStart(2, '0');
      step('Year ' + n + ', ' + ch.id + ' as ' + slug);
      await asChild(n, inYear.slice(0, inYear.indexOf(ch)).map((c) => c.id), '#/y' + n + '/' + slug + '/study');
      await until('document.querySelector(".studylist .wordcard")', 'the study page, Year ' + n);
      const cards = await ev('document.querySelectorAll(".studylist .wordcard").length');
      ok(cards === ch.words.length, ch.id + ' shows ' + ch.words.length + ' words: ' + cards);
      const noPic = ch.words.filter((w) => !ASSETS.images.includes(w.image || ''));
      ok(noPic.length === ch.words.length, 'none of a new chapter\'s words has a picture yet (' + ch.id + ')');
      ok(await ev('document.querySelectorAll(".studylist .pic--sentence").length') === ch.words.length, 'every word shows its sentence card');
      ok(await ev('document.querySelectorAll(".studylist img[src*=\\"assets/images\\"]").length') === 0, 'no picture is asked for');
      ok(!/\b(wrong|fail|failed|incorrect|mistake|late|lost|error)\b/i.test(await text('.studylist')), 'no banned words');
      ok(await noSideways(), 'no sideways scroll at 390');
      const first = ch.words[0];
      await ev('globalThis.__lines.length = 0');
      await click('#w-' + first.word + ' [data-sentence]');
      await until('globalThis.__lines.length > 0', 'the sentence read aloud');
      ok((await said()).includes(first.meaning.example), 'Hear the sentence uses the device voice: ' + (await said()).join('|'));
      await ev('globalThis.__lines.length = 0');
      await click('#w-' + first.word + ' [data-hear]');
      await until('globalThis.__lines.length > 0', 'the word read aloud');
      ok((await said()).some((l) => l.toLowerCase() === first.word.toLowerCase()), 'Hear it says the word with the device voice when there is no MP3: ' + (await said()).join('|') + ' (' + first.word + ')');
      ok(!await ev('globalThis.__said.length'), 'no MP3 was asked for');
      await width(320);
      ok(await noSideways(), 'no sideways scroll at 320');
      await width(390);
    }
  });

  scene('SB4-EF a new chapter plays: the quick game and the Hello card open without a picture', async () => {
    await asChild(1, [], '#/y1/ch01/quick');
    await until('document.querySelector(".blanks, .keyboard, .play")', 'the quick game');
    ok(await has('[data-hearmain]'), 'Hear the word is there');
    ok(!await has('.play img[src*="assets/images"]'), 'no picture file asked for');
    const ch = ALL.find((c) => c.id === 'y1-ch03');
    const words = ch.words.map((w) => w.word).filter((w) => w !== 'a' && w !== 'I').slice(0, 3);
    const doc = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week one', test: plus(7), words, today: MON, now: T0 }).doc;
    await H.seedChild(doc, plus(0));
    acct.who = me(1);
    await open(plus(0), '#/words/g/g1/study/hello');
    await until('document.querySelector(".wordcard--hello")', 'the Hello card');
    ok(await has('.wordcard--hello .pic--sentence') || await has('.wordcard--hello .pic__ph'), 'a sentence card or the lettered tile');
    ok(!await has('.wordcard--hello img[src*="assets/images"]'), 'no picture file asked for');
  });

  scene('SB4-EF Years 3 to 6: the old chapters and their progress are unchanged, new ones follow the gate', async () => {
    const oldIds = (n) => byYear(n).filter((c) => OLD.test(c.id)).map((c) => c.id);
    ok(oldIds(3).join() === 'y34-ch01,y34-ch02,y34-ch03,y34-ch04,y34-ch05' && oldIds(4).join() === 'y34-ch06,y34-ch07,y34-ch08,y34-ch09,y34-ch10', 'the old ids are where they were');
    ok(byYear(3).map((c) => c.id).slice(5).join() === 'y3-n01,y3-n02,y3-n03,y3-n04,y3-n05', 'the new ones come after them');
    step('two of the old chapters passed, a third studied');
    await asChild(4, [], '#/chapters');
    await ev('localStorage.setItem("sb.progress:' + CHILD + '",' + q(JSON.stringify(progDoc({ 'y34-ch01': { studiedAt: T0, practisedAt: T0 }, 'y34-ch02': { studiedAt: T0, practisedAt: T0 }, 'y34-ch03': { studiedAt: T0 } }, [passedCh('y34-ch01', 1), passedCh('y34-ch02', 2)]))) + ')');
    await ev('localStorage.setItem("sb.chaptersYear","y3")');
    await open(plus(2), '#/chapters');
    await until('document.querySelector("[data-yearpanel=y3]")', 'Year 3');
    const y3 = await panelStones();
    ok(y3.length === 10, 'ten stones in Year 3: ' + y3.length);
    ok(y3.join() === 'passed,passed,studying,todo,todo,todo,todo,todo,todo,todo', 'the old progress shows as before: ' + y3);
    step('an old address still lands on its chapter');
    await go('#/y34/ch07');
    await until('location.hash === "#/y4/ch02"', 'y34/ch07 is Year 4, Chapter 2');
    await until('document.querySelector("[data-chapterpage]") || document.querySelector("[data-chapter-locked]")', 'the chapter page');
    ok(/Chapter 2/.test(await text()), 'it is Year 4, Chapter 2');
    step('with the five old chapters passed, the first new one opens');
    await asChild(3, oldIds(3), '#/chapters');
    await ev('localStorage.setItem("sb.chaptersYear","y3")');
    await open(plus(2), '#/chapters');
    await until('document.querySelector("[data-yearpanel=y3]")', 'Year 3');
    const after = await panelStones();
    ok(after.slice(0, 5).every((s) => s === 'passed') && after.slice(5).every((s) => s === 'todo'), 'five passed, five to do: ' + after);
    ok(await ev('document.querySelectorAll("[data-yearpanel] .stonelink")[5].classList.contains("is-next")'), 'Chapter 6 is the next one');
    await go('#/y3/ch06');
    await until('document.querySelector("[data-chapterpage]")', 'Chapter 6 opens');
    ok(!await has('[data-chapter-locked]'), 'Chapter 6 is not closed');
    await go('#/y3/ch07');
    await until('document.querySelector("[data-chapter-locked]")', 'Chapter 7 waits for Chapter 6');
    step('the old words are in the old chapters');
    const words = await ev(`(async () => { const D = await import('./js/data.js'); return D.chapterById('y34-ch07').words.map((w) => w.word); })()`);
    ok(JSON.stringify(words) === JSON.stringify(ALL.find((c) => c.id === 'y34-ch07').words.map((w) => w.word)), 'y34-ch07 has its own words');
  });

  scene('SB4-EF More practice has a tab for each of the six years, at 320, 390 and 1180, for a grown-up and a child', async () => {
    await H.adultWith(progDoc(), '#/chapters');
    for (const w of [320, 390, 1180]) {
      step('width ' + w);
      await width(w, 900);
      ok(JSON.stringify(await years()) === JSON.stringify(['y1', 'y2', 'y3', 'y4', 'y5', 'y6']), 'six tabs at ' + w + ': ' + await years());
      ok(await noSideways(), 'no sideways scroll at ' + w + ' with six tabs');
      const sizes = await ev('[...document.querySelectorAll(".yearswitch__b")].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })');
      ok(sizes.every(([x, y]) => x >= 44 && y >= 44), 'every tab at least 44 px at ' + w + ': ' + JSON.stringify(sizes));
      for (const y of ['y1', 'y2', 'y3', 'y4', 'y5', 'y6']) {
        step(y);
        await click('.yearswitch__b[data-year=' + y + ']');
        await until('document.querySelector("[data-yearpanel=' + y + ']")', y + ' at ' + w);
        ok((await panelStones()).length === 10, y + ' has ten stones at ' + w);
        ok(await noSideways(), y + ' does not scroll sideways at ' + w);
      }
    }
    step('Year 1 and Year 2 say where their words come from, and never "statutory"');
    await width(390);
    await click('.yearswitch__b[data-year=y1]');
    const t1 = await text('[data-yearpanel=y1]');
    ok(/Year 1 common exception words \(from the national curriculum\)/.test(t1), 'Year 1 source line: ' + t1.slice(0, 300));
    ok(!/statutory/i.test(t1), 'Year 1 never says statutory');
    await click('.yearswitch__b[data-year=y2]');
    const t2 = await text('[data-yearpanel=y2]');
    ok(/Year 2 common exception words \(from the national curriculum\)/.test(t2) && !/statutory/i.test(t2), 'Year 2 source line');
    step('the Menu says which years have chapters, and each row has its own icon');
    await click('#adult-menu-btn');
    await until('!document.querySelector("#adult-panel-menu, [data-adult-panel=menu]")?.hidden || document.querySelector("[data-adultrow=chapters]")', 'the Menu');
    ok(/Year 1 to Year 6 chapters/.test(await text('[data-adultrow=chapters]')), 'More practice says Year 1 to Year 6 chapters: ' + await text('[data-adultrow=chapters]'));
    const icons = await ev('[...document.querySelectorAll("[data-adultrow]")].map((a) => a.dataset.adultrow + "|" + a.querySelector(".adultrow__ico svg").innerHTML)');
    const distinct = new Set(icons.map((s) => s.split('|')[1]));
    ok(icons.length === 8 && distinct.size === 8, 'eight rows, eight icons: ' + icons.length + ' / ' + distinct.size);
    ok(icons.some((s) => s.startsWith('own|')) && icons.some((s) => s.startsWith('teach|')), 'Your own chapters and For teachers have their own');
    await H.seedChild(W.emptyDoc(), plus(2));
    acct.who = me(2);
    await width(390);
    await open(plus(2), '#/chapters');
    await until('document.querySelector("[data-yearpanel]")', 'a Year 2 child\'s page');
    ok(JSON.stringify(await years()) === JSON.stringify(['y2', 'y3', 'more']), 'a Year 2 child: Year 2, Year 3, Other years: ' + await years());
    await click('[data-moreyears]');
    ok(await ev('[...document.querySelectorAll("#yearmore .yearswitch__b")].map((b) => b.dataset.year).join()') === 'y1,y4,y5,y6', 'the other four years');
    await width(320);
    ok(await noSideways(), 'no sideways scroll at 320 with Other years open');
    await width(1180, 800);
    ok(await noSideways(), 'no sideways scroll at 1180');
    await width(390);
  });

  scene('SB4-EF while a test is due, no study page shows an example that holds one of its words', async () => {
    const ch = ALL.find((c) => c.id === 'y1-ch02');
    const has_ = (w, x) => new RegExp('\\b' + x + '\\b', 'i').test(w.meaning.example);
    const withThe = ch.words.filter((w) => has_(w, 'the'));
    const without = ch.words.filter((w) => !has_(w, 'the'));
    ok(!ch.words.some((w) => w.word.toLowerCase() === 'the') && withThe.length > 0 && without.length > 0, 'the chapter holds sentences with "the" and without, but not "the" itself');
    // a group whose test is due today holds "the"
    const doc0 = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week one', test: plus(3), words: ['the', 'is'], today: MON, now: T0 }).doc;
    const g = W.groupById(doc0, 'g1');
    let doc = ['hello', 'fix', 'games', 'story'].reduce((x, st) => W.markStep(x, g, st, plus(1), Date.parse(plus(1) + 'T09:00:00')), doc0);
    W.rows(g).forEach((w, i) => { for (const h of [10, 11, 12]) doc = W.addTry(doc, { id: 'st' + i + h, word: w, day: plus(1), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(1) + 'T' + h + ':00:00') + i }); });
    step('the day before the test: every sentence shows');
    const setUp = async (d, day) => {
      await H.seedChild(d, day);
      await ev('localStorage.setItem("sb.progress:' + CHILD + '",' + q(JSON.stringify(progDoc({}, [passedCh('y1-ch01')]))) + ')'); // Chapter 2 is open
      acct.who = me(1);
    };
    await setUp(doc, plus(2));
    await open(plus(2), '#/y1/ch02/study');
    await until('document.querySelector(".studylist .wordcard")', 'the study page');
    ok(await ev('document.querySelectorAll(".studylist .pic--sentence").length') === ch.words.length, 'all ' + ch.words.length + ' sentence cards the day before');
    step('test day: the sentences with "the" are held back, the others stay');
    await open(plus(3), '#/y1/ch02/study');
    await until('document.querySelector(".studylist .wordcard")', 'the study page on test day');
    ok(await ev('document.querySelectorAll(".studylist .wordcard").length') === ch.words.length, 'the chapter page opens (it holds none of the due words)');
    ok(await ev('document.querySelectorAll(".studylist .pic--sentence").length') === without.length, 'sentence cards: only the ' + without.length + ' without "the"');
    ok(await ev('document.querySelectorAll(".studylist .pic__ph").length') === withThe.length, 'the other ' + withThe.length + ' have the lettered tile');
    const body = await text('.studylist .example');
    ok(!/\bthe\b/i.test(body), 'no sentence on the page holds "the": ' + body.slice(0, 160));
    ok(!await ev('[...document.querySelectorAll(".studylist [data-sentence]")].some((b) => /\\bthe\\b/i.test(b.closest(".pic").textContent))'), 'and no Hear button for one');
    await H.style('night');
    ok(await noSideways(), 'no sideways scroll in Night');
    await H.style('garden');
    step('the Hello card for another week holding one of those words');
    const w2 = withThe[0].word;
    const doc2 = W.createGroup(doc, { id: 'g2', name: 'Week two', test: plus(9), words: [w2, without[0].word], today: plus(3), now: Date.parse(plus(3) + 'T09:00:00') }).doc;
    await setUp(doc2, plus(3));
    await open(plus(3), '#/words/g/g2/study/hello');
    await until('document.querySelector(".wordcard--hello")', 'the Hello card');
    const card = await text('.wordcard--hello');
    ok(!/\bthe\b/i.test(await text('.wordcard--hello .example')), 'the Hello card for ' + w2 + ' shows no sentence with "the": ' + card.slice(0, 160));
    ok(!await has('.wordcard--hello .pic--sentence') && await has('.wordcard--hello.wordcard--nopic'), 'it shows no sentence card, the calm no-picture layout instead');
  });
}
