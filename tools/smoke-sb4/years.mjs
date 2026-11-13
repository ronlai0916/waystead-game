// SB4-WP1: one school year at a time. Loaded by tools/sb2-smoke.mjs with the harness H.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FIXTURE = readFileSync(fileURLToPath(new URL('../../tests/fixtures/sb4-year12.json', import.meta.url)), 'utf8');
const SRC34 = 'From the Years 3 and 4 statutory word list (we split it into two years)';
const SRC56 = 'From the Years 5 and 6 statutory word list (we split it into two years)';

export default function (H) {
  const { scene, go, click, ev, ok, has, text, until, sleep, width, open, acct, visible } = H;
  const T0 = Date.parse(H.MON + 'T09:00:00');
  const progDoc = (chapters = {}, results = []) => ({ v: 1, resetAt: 0, chapters, results, folded: {}, tricky: {} });
  const passedCh = (id, n = 1) => ({ id: 'r' + id + n, c: id, s: 5, t: 5, at: T0 + n });
  const old = (n) => 'y34-ch' + String(n).padStart(2, '0');
  const step = (n) => console.log('  · ' + n);
  const heights = (sel) => ev('[...document.querySelectorAll(' + JSON.stringify(sel) + ')].map((e) => Math.round(e.getBoundingClientRect().height))');
  const noSideways = () => ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth');
  const years = () => ev('[...document.querySelectorAll(".yearswitch__b")].map((b) => b.textContent.trim() + (b.getAttribute("aria-label") ? "|" + b.getAttribute("aria-label") : ""))');
  const pressed = () => ev('(document.querySelector(".yearswitch__b[aria-pressed=true]") || {}).dataset ? document.querySelector(".yearswitch__b[aria-pressed=true]").dataset.year : ""');
  const panel = () => ev('document.querySelector("[data-yearpanel]").dataset.yearpanel');

  scene('SB4-WP1 a child in Year 4 sees Year 4, Year 5 and Other years', async () => {
    await H.childWith(progDoc(), '#/chapters'); // the smoke's child is in Year 4
    await width(390);
    await until('document.querySelector("[data-yearpanel]")', 'More practice');
    ok(JSON.stringify(await years()) === JSON.stringify(['Year 4', 'Year 5', 'Other years']), 'three buttons: ' + await years());
    ok((await heights('.yearswitch__b')).every((h) => h >= 48), 'each button is at least 48 px: ' + await heights('.yearswitch__b'));
    ok(await pressed() === 'y4' && await panel() === 'y4', 'opens on Year 4');
    ok(await ev('document.querySelector("[data-moreyears]").getAttribute("aria-expanded")') === 'false', 'Other years is closed');
    ok(await noSideways(), 'no sideways scroll at 390');
    await click('[data-moreyears]');
    ok(await ev('document.querySelector("[data-moreyears]").getAttribute("aria-expanded")') === 'true', 'Other years is open');
    const t = await years();
    ok(t.includes('Year 3') && t.includes('Year 6') && t.length === 5, 'Year 3 and Year 6 appear in place: ' + t);
    ok(await ev('document.activeElement && document.activeElement.hasAttribute("data-moreyears")'), 'focus stays on Other years');
    ok(await ev('document.querySelector("[data-moreyears]").getAttribute("aria-controls")') === 'yearmore' && await has('#yearmore'), 'Other years controls its row');
    const wide = () => ev('[...document.querySelectorAll(".yearswitch__b")].map(b=>b.getBoundingClientRect().width)');
    ok((await wide()).every((w) => w >= 48), 'every year button at least 48 wide when Other years is open: ' + await wide());
    ok(await ev('(() => { const r = document.querySelector("#yearmore").getBoundingClientRect(), m = document.querySelector("[data-moreyears]").getBoundingClientRect(); return r.top >= m.bottom - 1; })()'), 'the opened years are on their own row, below');
    ok(await ev('[...document.querySelectorAll("#yearmore .yearswitch__b")].map((b) => b.dataset.year).join()') === 'y3,y6', 'in year order');
    await width(320);
    ok((await wide()).every((w) => w >= 48) && await noSideways(), 'and at 320 wide, no sideways scroll');
    await width(390);
    await click('.yearswitch__b[data-year=y6]');
    ok(await panel() === 'y6' && await pressed() === 'y6', 'Year 6 chosen');
    ok(await ev('document.activeElement && document.activeElement.tagName === "H1"'), 'focus goes to the page heading');
    ok(await ev('localStorage.getItem("sb.chaptersYear")') === 'y6', 'the choice is remembered');
    await open(H.plus(2), '#/chapters');
    await until('document.querySelector("[data-yearpanel=y6]")', 'the remembered year');
    ok(await ev('document.querySelectorAll("[data-yearpanel] .stonelink").length') === 5, 'five stones in a year');
    ok(!/\b(ten|10)\b/i.test(await text('.yearcard')), 'no count of ten in a year');
  });

  scene('SB4-WP1 an adult sees four years, six with Years 1 and 2, with no sideways scroll', async () => {
    await H.adultWith(progDoc(), '#/chapters');
    await width(390);
    ok((await years()).length === 4 && (await years()).join() === 'Year 3,Year 4,Year 5,Year 6', 'four buttons: ' + await years());
    ok(!await has('[data-moreyears]'), 'no Other years for an adult');
    ok(await noSideways(), 'no sideways scroll at 390 with four');
    H.serve('data/curriculum.json', FIXTURE);
    await H.adultWith(progDoc(), '#/chapters');
    await width(390);
    ok((await years()).join() === 'Y1|Year 1,Y2|Year 2,Y3|Year 3,Y4|Year 4,Y5|Year 5,Y6|Year 6', 'six short buttons with long names: ' + await years());
    ok((await heights('.yearswitch__b')).every((h) => h >= 48), 'each at least 48 px');
    ok(await noSideways(), 'no sideways scroll at 390 with six');
    await click('.yearswitch__b[data-year=y2]');
    ok(await panel() === 'y2', 'Year 2');
    ok(/Not included yet: words with an apostrophe\./.test(await text('[data-yearpanel]')), 'a grown-up sees the apostrophe note under Year 2');
    ok(/Year 2 common exception words \(statutory\)/.test(await text('[data-yearpanel]')), 'and where the words come from');
    await click('.yearswitch__b[data-year=y3]');
    ok(!/apostrophe/.test(await text('[data-yearpanel]')), 'not under Year 3');
    await width(1280, 800);
    ok(await noSideways(), 'no sideways scroll at 1280');
    H.serve('data/curriculum.json', null);
  });

  scene('SB4-WP1 the old addresses, saved progress, the gate and the source lines', async () => {
    await H.childWith(progDoc({}, [passedCh(old(6), 1), passedCh(old(7), 2)]), '#/y34/ch07');
    await until('location.hash === "#/y4/ch02"', 'y34/ch07 lands on Year 4 Chapter 2');
    await until('document.querySelector("[data-chapterpage]")', 'the chapter page');
    await go('#/y34/ch07/study');
    await until('location.hash === "#/y4/ch02/study"', 'a suffix is kept');
    await go('#/y56');
    await until('location.hash === "#/chapters" && document.querySelector("[data-yearpanel]")', 'y56 goes to More practice');
    ok(await panel() === 'y5' && await pressed() === 'y5', 'showing Year 5');
    await go('#/y34');
    await until('location.hash === "#/chapters" && document.querySelector("[data-yearpanel=y3]")', 'y34 shows Year 3');
    await ev('localStorage.setItem("sb.chaptersYear", "y34")'); // an old remembered year
    await open(H.plus(2), '#/chapters');
    await until('document.querySelector("[data-yearpanel=y3]")', 'an old remembered year becomes Year 3');
    step('progress under the old id shows on the new page');
    await go('#/chapters');
    await click('[data-moreyears]');
    await click('.yearswitch__b[data-year=y4]');
    const states = await ev('[...document.querySelectorAll(".stonelink")].map((a) => a.dataset.state)');
    ok(states[0] === 'passed' && states[1] === 'passed', 'Year 4 Chapters 1 and 2 passed: ' + states);
    step('Chapter 1 of Year 4 is open without passing Year 3; Chapter 2 says Pass Chapter 1 first');
    await H.childWith(progDoc(), '#/y4/ch01');
    await until('document.querySelector("[data-chapterpage]")', 'Year 4 Chapter 1 is open');
    await go('#/y4/ch02');
    await until('document.querySelector("[data-chapter-locked]")', 'Chapter 2 is closed');
    ok(/Pass Chapter 1 first\./.test(await text()), 'Pass Chapter 1 first.');
    step('the source line');
    await go('#/y3/ch01');
    await until('document.querySelector("[data-chapterpage]")', 'Year 3 Chapter 1');
    ok(await text('[data-source]') === SRC34, 'Year 3 chapter eyebrow: ' + await text('[data-source]'));
    await go('#/chapters');
    await click('[data-moreyears]');
    await click('.yearswitch__b[data-year=y5]');
    ok(await text('[data-yearpanel] [data-source]') === SRC56, 'Year 5 line: ' + await text('[data-yearpanel] [data-source]'));
    await go('#/y9');
    await until('/isn.t here/.test(document.querySelector("main").innerText)', 'a year that does not exist is not a page');
    await go('#/y1');
    await until('/isn.t here/.test(document.querySelector("main").innerText)', 'Year 1 is not a page until it has words');
    await width(390);
    ok(await noSideways(), 'no sideways scroll');
  });

  scene('SB4-WP1 with Years 1 and 2: every year opens at Chapter 1, a Year 1 child reads 22 px', async () => {
    H.serve('data/curriculum.json', FIXTURE);
    await H.childWith(progDoc(), '#/chapters');
    acct.who = { ...acct.who, year: 1 };
    await open(H.plus(2), '#/chapters');
    await until('document.querySelector("[data-yearpanel]")', 'More practice');
    ok(await panel() === 'y1' && await pressed() === 'y1', 'a Year 1 child opens on Year 1');
    ok((await years()).join() === 'Year 1,Year 2,Other years', 'Year 1, Year 2, Other years: ' + await years());
    const px = (sel) => ev('parseFloat(getComputedStyle(document.querySelector(' + JSON.stringify(sel) + ')).fontSize)');
    ok(await has('.chapterspage.front--y12') && await px('.front__lede') === 22, 'the chapters page reads at 22 px');
    await width(390);
    ok(await ev('[...document.querySelectorAll(".stonelink")].every(a=>a.querySelector(".stonelink__label").scrollWidth<=a.clientWidth)'), 'stone labels fit');
    ok(!/Pass|Start game/.test(await text('[data-yearpanel] .yearsource')), 'a source line');
    await go('#/y1/ch01');
    await until('document.querySelector("[data-chapterpage]")', 'Year 1 Chapter 1');
    ok(await has('.chapterpage.front--y12') && await px('.stepcard p') === 22, 'the chapter page reads at 22 px');
    const lines = await ev('[...document.querySelectorAll("[data-source]")].map((e) => e.textContent)');
    ok(lines.length === 2 && /^Year 1 common exception words \(statutory\)$/.test(lines[0]) && /^Pattern words: our examples for the Year 1 rule 'ff, ll, ss, zz, ck'$/.test(lines[1]), 'both lines on a chapter with both kinds: ' + lines);
    for (const y of ['y1', 'y2', 'y3', 'y4', 'y5', 'y6']) {
      await go('#/' + y + '/ch01');
      await until('document.querySelector("[data-chapterpage]") || document.querySelector("[data-chapter-locked]")', y + ' chapter 1');
      ok(await has('[data-chapterpage]') && !await has('[data-chapter-locked]'), y + ' Chapter 1 is open');
    }
    await go('#/y1/ch02');
    await until('document.querySelector("[data-chapter-locked]")', 'Year 1 Chapter 2 closed');
    ok(/Pass Chapter 1 first\./.test(await text()), 'Pass Chapter 1 first.');
    await go('#/y3/ch02');
    await until('document.querySelector("[data-chapter-locked]")', 'Year 3 Chapter 2 closed');
    ok(/Pass Chapter 1 first\./.test(await text()), 'Year 3: Pass Chapter 1 first.');
    // Years 3 to 6 do not read at 22 px for a Year 1 child on a keyboard page? Not here: only the two chapter pages carry the class.
    await go('#/progress');
    await until('document.querySelector("main h1")', 'Progress');
    ok(!await has('.front--y12'), 'no big text class on other pages');
    ok((await text()).includes('Year 1') && (await text()).includes('Year 6'), 'Progress has a block for every live year');
    H.serve('data/curriculum.json', null);
  });

  scene('SB4-WP1 a test due still replaces a chapter page that shares a word', async () => {
    const WORDS = ['build', 'earth', 'fruit', 'heart']; // Year 3 Chapter 1 has these
    const day = (n) => H.plus(n);
    let d = H.W.createGroup(H.W.emptyDoc(), { id: 'g1', name: 'Week one', test: day(5), words: WORDS, today: H.MON, now: Date.parse(H.MON + 'T09:00:00') }).doc;
    const g = H.W.groupById(d, 'g1');
    d = ['hello', 'fix', 'games', 'story'].reduce((x, st) => H.W.markStep(x, g, st, day(1), Date.parse(day(1) + 'T09:00:00')), d);
    H.W.rows(g).forEach((w, i) => { for (const h of [10, 11, 12]) d = H.W.addTry(d, { id: 'st' + i + h, word: w, day: day(1), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: Date.parse(day(1) + 'T' + h + ':00:00') + i }); });
    await H.seedChild(d, day(5));
    await open(day(5), '#/y3/ch01/study');
    await until('document.querySelector("[data-testcard]")', 'the test card replaces Year 3 Chapter 1 study');
    const t = (await text()).toLowerCase();
    for (const w of WORDS) ok(!new RegExp('\\b' + w + '\\b').test(t), 'the page shows ' + w);
    await go('#/y34/ch01/study'); // the old address still ends at the card
    await until('document.querySelector("[data-testcard]")', 'the old address too');
    await go('#/y4/ch01');
    await until('document.querySelector("main h1")', 'a chapter with no shared word');
    ok(!await has('[data-testcard]'), 'Year 4 Chapter 1 shares no word with the test');
  });

  // Take a chapter's test, typing every word right (the smoke's audio records the word it was asked to say).
  async function passTest() {
    for (let n = 0; n < 24; n += 1) {
      await until('document.querySelector("#ans") || document.querySelector(".passmark, [data-next-year], [data-back-practice], [data-next-chapter]")', 'a word or the score');
      if (!await has('#ans')) break;
      await ev('globalThis.__said.length = 0');
      await click('[data-hear]');
      await until('globalThis.__said.length', 'the word spoken');
      const w = await ev('globalThis.__said.at(-1)');
      await ev('(() => { const i = document.querySelector("#ans"); i.value = ' + JSON.stringify(w) + '; document.querySelector("form").requestSubmit(); })()');
      await click('[data-next]');
    }
  }
  scene('SB4-WP1 the last test of a year leads on: Start Year 4, or back to More practice after Year 6', async () => {
    await H.childWith(progDoc({}, [1, 2, 3, 4].map((n) => passedCh(old(n), n))), '#/y3/ch05/test');
    await passTest();
    await until('document.querySelector("[data-next-year]")', 'a way on after Year 3');
    ok(await ev('document.querySelector("[data-next-year]").getAttribute("href")') === '#/y4/ch01' && /Start Year 4/.test(await text('[data-next-year]')), 'Start Year 4, to its Chapter 1');
    const y56 = (n) => 'y56-ch' + String(n).padStart(2, '0');
    await H.childWith(progDoc({}, [6, 7, 8, 9].map((n) => passedCh(y56(n), n))), '#/y6/ch05/test');
    await passTest();
    await until('document.querySelector("[data-back-practice]")', 'a way on after Year 6');
    ok(await ev('document.querySelector("[data-back-practice]").getAttribute("href")') === '#/chapters' && !await has('[data-next-year]'), 'back to More practice');
    await H.childWith(progDoc({}, [passedCh(old(1), 1)]), '#/y3/ch02/test');
    await passTest();
    await until('document.querySelector("[data-next-chapter]")', 'Next chapter');
    ok(await ev('document.querySelector("[data-next-chapter]").getAttribute("href")') === '#/y3/ch03', 'Next chapter is built from the chapter\'s own address');
  });
}
