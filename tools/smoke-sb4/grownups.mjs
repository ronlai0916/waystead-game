// SB4-WP6: grown-ups: how a child spells, exams, honest result lines, the overview. Loaded by tools/sb2-smoke.mjs with the harness H.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as PR from '../../site/js/progress-doc.js';

const CURRICULUM = JSON.parse(readFileSync(fileURLToPath(new URL('../../site/data/curriculum.json', import.meta.url)), 'utf8'));
const chapterWords = (id) => {
  for (const b of Object.values(CURRICULUM)) for (const ch of (b && b.chapters) || []) if (ch.id === id) return ch.words.map((w) => w.word);
  return [];
};

export default function (H) {
  const { scene, go, click, ev, ok, has, text, until, sleep, width, open, acct, W, CHILD, CHILD2, ADULT, plus, shot } = H;
  const DAY = plus(2);
  const NOW = Date.parse(DAY + 'T10:00:00');
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const WORDS = ['build', 'earth', 'fruit', 'heart'];
  const step = (n) => console.log('  · ' + n);
  const q = (s) => JSON.stringify(s);
  const week = (test = plus(5)) => W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week one', test, words: WORDS, today: H.MON, now: Date.parse(H.MON + 'T09:00:00') }).doc;
  const progDoc = (ids = [], extra = (p) => p) => extra(ids.reduce((p, id, i) => PR.recordTest(p, id, 5, 5, NOW - 86400000 + i, 'rp' + i), PR.emptyDoc()));
  const saved = () => W.normalise(acct.get(CHILD, 'spellbright', 'words'));
  const noSideways = () => ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth');
  async function asAdult(doc, progress, hash) {
    await H.signedOutBlank(DAY);
    acct.who = adultMe;
    acct.put(CHILD, 'spellbright', 'words', doc);
    acct.put(CHILD, 'spellbright', 'progress', progress || PR.emptyDoc());
    await open(DAY, hash);
  }
  const rawWords = (tweak) => { const d = week(); return tweak ? tweak(d) : d; };

  scene('SB4-WP6 the card, the screen, and each tap saves at once', async () => {
    await asAdult(week(), null, '#/grownups/child/' + CHILD);
    await until('document.querySelector("[data-spellcard]")', 'the card');
    ok(/How Robin spells/.test(await text('[data-spellcard]')) && /Letters or keyboard: Keyboard/.test(await text('[data-sc-level]')) && /Help in tests: Standard/.test(await text('[data-sc-help]')), 'card lines');
    await click('[data-spell-change]');
    await until('document.querySelector("[data-spelling]")', 'the screen');
    ok(await ev('document.querySelectorAll(".gu-group").length') === 3, 'exactly three groups');
    ok(await ev('[...document.querySelectorAll(".gu-group h2")].map((h) => h.textContent).join("|")') === 'Letters or keyboard|Help in tests|Tests to offer', 'group names');
    ok(await ev('document.querySelectorAll("input[name=lv]").length') === 5 && await ev('document.querySelector("input[name=lv][value=\\"5\\"]").checked'), 'five radios, Keyboard chosen');
    ok(/Recommended for Year 4/.test(await text('[data-opt-lv="5"]')) && /Recommended for Year 4/.test(await text('[data-opt-pf="normal"]')) && !/Default/.test(await text()), 'one badge each, never Default');
    await width(1280, 900);
    await shot('wp6-spelling-1280');
    await ev('document.querySelector("input[name=lv][value=\\"3\\"]").click()');
    await until('/Saved\\. Robin will see this next time\\./.test(document.querySelector("[data-status]").innerText)', 'the saved line');
    const first = saved().setup.help;
    ok(first.lv === 3 && first.by === 'Sam', 'saved help.lv 3 by Sam: ' + JSON.stringify(first));
    ok(await ev('document.querySelector("input[name=lv][value=\\"3\\"]").checked'), 'Most letters shown as chosen');
    ok(/Most letters/.test(await text('[data-seeline]')), 'the panel follows the choice');
    await ev('document.querySelector("input[name=lv][value=\\"4\\"]").click()');
    await sleep(400);
    ok(saved().setup.help.lv === 4 && saved().setup.help.at > first.at, 'a second tap has a later at');
    step('help in tests and the exam offer');
    await ev('document.querySelector("input[name=pf][value=\\"sen\\"]").click()');
    await sleep(400);
    ok(saved().setup.profile.p === 'sen', 'Extra support saved');
    await ev('document.querySelector("input[name=exam]").click()');
    await sleep(400);
    ok(saved().setup.offer.exam === false && saved().setup.offer.quiz === true, 'Exam off saved');
    ok(await ev('document.querySelector("input[name=test]").disabled && document.querySelector("input[name=test]").checked'), 'Test ticked and disabled');
    await width(390, 844);
    ok(await noSideways(), 'no sideways scroll at 390');
    await shot('wp6-spelling-390');
    const rows = await ev('[...document.querySelectorAll(".gu-opt")].map((e) => Math.round(e.getBoundingClientRect().height))');
    ok(rows.length === 11 && rows.every((h) => h >= 64), 'every radio and check row at least 64 px: ' + rows);
    const small = await ev('[...document.querySelectorAll("main a[href], main button, main label")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.height < 44 || r.width < 44) && !e.closest(".gu-seecard"); }).map((e) => e.tagName + ":" + e.textContent.trim().slice(0, 20))');
    ok(small.length === 0, 'targets at least 44 px: ' + small);
    await go('#/grownups/child/' + CHILD);
    await until('document.querySelector("[data-spellcard]")', 'back on the page');
    ok(/Letters or keyboard: All the letters/.test(await text('[data-sc-level]')) && /Help in tests: Extra support/.test(await text('[data-sc-help]')) && /Last changed by Sam/.test(await text('[data-spellcard]')), 'the card follows');
    ok(!await has('[data-setexam]'), 'no Set an exam when exams are off');
  });

  scene('SB4-WP6 the child saved first: the save is retried and their tries are kept', async () => {
    await asAdult(week(), null, '#/grownups/child/' + CHILD + '/spelling');
    await until('document.querySelector("[data-spelling]")', 'the screen');
    const { g } = { g: W.groupById(week(), 'g1') };
    const newer = W.addTry(week(), { id: 'late1', word: 'earth', day: DAY, group: g.id, kind: 'p', tries: 0, peeks: 0, clean: true, now: NOW + 5 });
    const real = acct.fetch;
    let raced = false;
    acct.fetch = async (url, init) => {
      if (init.method === 'PUT' && String(url).includes('/api/children/') && !raced) { raced = true; acct.put(CHILD, 'spellbright', 'words', newer); }
      return real(url, init);
    };
    await ev('document.querySelector("input[name=lv][value=\\"2\\"]").click()');
    await until('/Saved\\./.test(document.querySelector("[data-status]").innerText)', 'saved after the retry');
    acct.fetch = real;
    ok(raced, 'the 409 really happened');
    ok(saved().setup.help.lv === 2 && saved().results.some((r) => r.id === 'late1'), 'the choice saved and the child\'s try kept');
  });

  scene('SB4-WP6 a child cannot open any of it', async () => {
    await H.seedChild(week());
    acct.calls.length = 0;
    for (const p of ['#/grownups/child/' + CHILD + '/spelling', '#/grownups/child/' + CHILD + '/exam', '#/grownups/child/' + CHILD + '/exam/e1', '#/grownups/overview']) {
      await open(DAY, p);
      await until('document.querySelector("[data-notforyou]")', 'refused at ' + p);
    }
    ok(!acct.calls.some((c) => c.path.startsWith('/api/children')), 'no /api/children call at all');
    step('an adult playing as a child');
    acct.who = { ...adultMe, playingAs: { id: CHILD, nickname: 'Robin', year: 4, avatar: null } };
    for (const p of ['#/grownups/child/' + CHILD + '/spelling', '#/grownups/child/' + CHILD + '/exam', '#/grownups/overview']) {
      await open(DAY, p);
      await until('document.querySelector("[data-playing]")', 'the card at ' + p);
    }
    ok(!acct.calls.some((c) => c.path.startsWith('/api/children')), 'still no child data asked for');
  });

  scene('SB4-WP6 set an exam from tested chapters, see its report, let the child sit it again', async () => {
    const ids = ['y34-ch06', 'y34-ch07'];
    await asAdult(week(), progDoc(ids), '#/grownups/child/' + CHILD);
    await until('document.querySelector("[data-setexam]")', 'Set an exam');
    await click('[data-setexam]');
    await until('document.querySelector("[data-examform]")', 'the form');
    ok(await ev('document.querySelectorAll("[data-src] input:not(:disabled)").length') === 2, 'two tested chapters and no week yet: ' + await ev('document.querySelectorAll("[data-src] input:not(:disabled)").length'));
    ok(await ev('[...document.querySelectorAll("[data-src]")].filter((e) => e.classList.contains("is-off")).every((e) => /Test not done yet/.test(e.textContent))'), 'untested sources say Test not done yet');
    await ev('document.querySelector("[data-src=\\"y34-ch08\\"] input").disabled && true');
    await click('[data-setexam-go]');
    ok(/Choose at least one chapter or week\./.test(await text('[data-error]')), 'no source chosen');
    for (const id of ids) await click('[data-src="' + id + '"] input');
    ok(/^20 words from 2 chapters$/.test(await text('[data-examline]')), 'the live line: ' + await text('[data-examline]'));
    await ev('(() => { const e = document.querySelector("#gu-exdate"); e.value = "' + W.addDays(DAY, -1) + '"; e.dispatchEvent(new Event("input")); })()');
    await click('[data-setexam-go]');
    ok(/Choose today or a later date\./.test(await text('[data-error]')), 'a past date refused');
    await ev('(() => { const e = document.querySelector("#gu-exdate"); e.value = "' + DAY + '"; e.dispatchEvent(new Event("input")); })()');
    await width(1280, 900);
    await shot('wp6-exam-form-1280');
    await click('[data-setexam-go]');
    await until('/#\\/grownups\\/child\\/[^/]+\\/exam\\/./.test(location.hash) && document.querySelector("[data-examreport]")', 'the report');
    const exams = Object.entries(saved().setup.exams);
    ok(exams.length === 1, 'one exam');
    const [eid, ex] = exams[0];
    const pool = new Set([...chapterWords('y34-ch06'), ...chapterWords('y34-ch07')]);
    ok(ex.words.length === 20 && ex.words.every((w) => pool.has(w)), '20 words, all from the two tested chapters: ' + ex.words.length);
    ok(ex.name.startsWith('Big test, ') && ex.date === DAY && ex.from.join() === ids.join(), 'name, date and sources');
    ok(await text('[data-examstatetext]') === 'Ready', 'the report says Ready: ' + await text('[data-examstatetext]'));
    step('a result arrives');
    const withRun = PR.addCheck(progDoc(ids), { c: 'e:' + eid, k: 'e', s: 18, t: 20, d: DAY, miss: ['alpha', 'beta'], lv: 2, pf: 'normal' }, NOW - 5000, 'ex1');
    acct.put(CHILD, 'spellbright', 'progress', withRun);
    await open(DAY, '#/grownups/child/' + CHILD + '/exam/' + eid);
    await until('document.querySelector("[data-examresult]")', 'the result line');
    ok(/Done on/.test(await text('[data-examstatetext]')), 'Done on');
    ok(/\(exam\) · 18 of 20 · Standard · with letter tiles \(Some letters\)/.test(await text('[data-examresult]')), 'the result line: ' + await text('[data-examresult]'));
    ok(/Words to practise: alpha, beta/.test(await text('[data-exammiss]')), 'words to practise');
    await click('[data-reopen]');
    await until('document.querySelector("[data-examstate=ready]")', 'ready again');
    ok(saved().setup.exams[eid].reopen > 0, 'reopen set');
    step('Delete');
    await click('[data-delete]');
    await click('[data-confirm]');
    await until('document.querySelector("[data-spellcard]")', 'back on the child\'s page');
    ok(!!saved().setup.exams[eid].gone, 'a soft delete');
    step('Extra support: ten words, and a week whose test is to come is not offered');
    acct.put(CHILD, 'spellbright', 'words', { ...saved(), setup: { ...saved().setup, profile: { p: 'sen', at: NOW } } });
    await open(DAY, '#/grownups/child/' + CHILD + '/exam');
    await until('document.querySelector("[data-examform]")', 'the form');
    ok(await ev('document.querySelector("[data-src=\\"g-g1\\"] input").disabled'), 'the untested week cannot be chosen');
    for (const id of ids) await click('[data-src="' + id + '"] input');
    ok(/^10 words from 2 chapters$/.test(await text('[data-examline]')), 'ten for Extra support');
    await ev('(() => { const e = document.querySelector("#gu-exdate"); e.value = "' + DAY + '"; e.dispatchEvent(new Event("input")); })()');
    await click('[data-setexam-go]');
    await until('document.querySelector("[data-examreport]")', 'the second report');
    ok(Object.values(saved().setup.exams).filter((e) => !e.gone && e.words.length === 10).length === 1, 'a 10-word exam');
  });

  scene('SB4-WP6 report lines say how it was done: letter tiles and Getting there', async () => {
    let d = week(plus(2));
    const g = W.groupById(d, 'g1');
    const t = (word, day, o) => { d = W.addTry(d, { id: 'x' + d.results.length, word, day, group: 'g1', tries: 0, peeks: 0, clean: true, now: Date.parse(day + 'T10:00:00') + d.results.length, ...o }); };
    for (let i = 0; i < 3; i += 1) t('build', plus(1), { kind: 'p', source: 'x', lv: 2 });
    for (let i = 0; i < 3; i += 1) t('earth', plus(1), { kind: 'p', source: 'x' });
    for (const w of WORDS) t(w, plus(2), { kind: 't', lv: 2 });
    void g;
    await asAdult(d, null, '#/grownups/child/' + CHILD + '/week/g1');
    await until('document.querySelector("[data-weekline]")', 'the week line');
    ok(/Week one test · 4 of 4 · Standard · with letter tiles \(Some letters\)/.test(await text('[data-weekline]')), 'the week line: ' + await text('[data-weekline]'));
    const chip = await text('[data-word="build"] [data-wordchip]');
    ok(/Getting there/.test(chip) && /3 in a row with letter tiles/.test(chip), 'build is Getting there: ' + chip);
    ok(/Got it/.test(await text('[data-word="earth"] [data-wordchip]')), 'a keyboard word is Got it');
    ok(await has('[data-years] [data-yearcounts]'), 'a line for each year');
    await width(390, 844);
    ok(await noSideways(), 'no sideways scroll at 390');
    await shot('wp6-report-390');
  });

  scene('SB4-WP6 ready for fewer letters: Yes saves the next level', async () => {
    let d = week();
    for (const w of WORDS) for (let i = 0; i < 3; i += 1) d = W.addTry(d, { id: 'h' + w + i, word: w, day: plus(1), group: 'g1', kind: 'p', source: 'x', tries: 0, peeks: 0, clean: true, lv: 2, now: Date.parse(plus(1) + 'T10:00:00') + i });
    d = { ...d, setup: { help: { lv: 2, at: NOW - 1000, by: 'Sam' } } };
    await asAdult(d, null, '#/grownups/child/' + CHILD);
    await until('document.querySelector("[data-levelhint]")', 'the hint');
    ok(/Robin is ready for fewer letters\. Try 'Most letters'\?/.test(await text('[data-levelhint]')), 'the hint: ' + await text('[data-levelhint]'));
    ok(saved().setup.help.lv === 2, 'nothing changed by itself');
    await click('[data-hint-no]');
    ok(!await has('[data-levelhint]') && saved().setup.help.lv === 2, 'Not now hides it');
    await open(DAY, '#/grownups/child/' + CHILD);
    await until('document.querySelector("[data-levelhint]")', 'the hint again on a new visit');
    await click('[data-hint-yes]');
    await until('document.querySelector("[data-sc-flash]")', 'saved');
    ok(saved().setup.help.lv === 3, 'Most letters saved');
  });

  scene('SB4-WP6 the overview keeps the account order', async () => {
    await asAdult(week(), progDoc(['y34-ch06']), '#/grownups');
    await until('document.querySelector("[data-overview-link]")', 'the link with two children');
    await click('[data-overview-link]');
    await until('document.querySelector("[data-overview]")', 'the table');
    const names = await ev('[...document.querySelectorAll("[data-overview] tbody tr")].map((r) => r.querySelector("th").textContent.trim()).join()');
    ok(names === 'Robin,Wren', 'account order: ' + names);
    ok(/One row for each child, in the order on your account\. This is not a ranking\./.test(await text('[data-overview] caption')), 'the caption');
    ok(/Week one/.test(await text('[data-child="' + CHILD + '"]')), 'Robin\'s week');
    ok(await has('[data-child="' + CHILD2 + '"]'), 'Wren has a row');
    await width(390, 844);
    ok(await noSideways(), 'no sideways scroll at 390');
    await shot('wp6-overview-390');
  });
}
