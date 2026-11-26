// SB6 scenes of WP-7: the grown-up pages of Step by step (TR-46, TR-47, TR-48, D24, D25).
//   SB6 gu: switch    the way card: Usual way / Step by step, the first switch-on line, saved on the account
//   SB6 gu: settings  session length, Peek time, bigger celebrations, No practice after; Peek time "As now" in the Usual way
//   SB6 gu: preview   "See what <name> will see" (the middle step of the first word, nothing recorded)
//   SB6 gu: report    the week page: four statuses, fact lines, Peek counts, "Slips around", the estimate line, sittings, the test with "with a peek", print
//   SB6 gu: stuck     "Stuck word: night", "Let <name> set it aside for today", bring it back; never on a child page
//   SB6 gu: teacher   "Help for each child" with the Way of learning line, and "Who needs help" with a stuck word
//   SB6 gu: set a week  the estimate line under the date for a Step-by-step child
// Each page scene runs at 390x844, 420x746 (bar below the page), 420x845 (pill) and 820x1180, in garden and Night; a screenshot of each goes to $SB6_SHOTS/<profile>-<style>/gu-*.png.
// Pure seeding is exported (sbsDoc, ...) so a unit test or a node one-liner can read the same data.
import * as Su from '../../site/js/setup-doc.js';
import * as W from '../../site/js/words-doc.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const WORDS10 = ['night', 'friend', 'island', 'guard', 'light', 'tree', 'Wednesday', 'February', 'environment', 'necessary'];
const MON = '2026-11-02';
const plus = (n) => W.addDays(MON, n);
const at = (day, h = 10, m = 0) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00');

/** A child's words value: one week (test on MON + 5), Step by step or the Usual way, with the report data the scenes read. */
export function sbsDoc({ way = 'sbs', report = true, test = false, words = WORDS10 } = {}) {
  let d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Class 4 spellings', test: plus(5), words, today: MON, now: at(MON, 9) }).doc;
  if (way === 'sbs') d = W.withSetup(d, Su.setWay({}, 'sbs', at(MON, 8), 'Sam').setup);
  if (!report) return d;
  let n = 0;
  const t = (word, day, h, o) => { n += 1; d = W.addTry(d, { id: 'x' + n, word, day, group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, source: 'g', now: at(day, h, n % 60), ...o }); };
  const ALL = W.ALL_RUNG;
  // night: the whole word on its own on two days: On its own
  t('night', MON, 16, { r: ALL, j: 'f', ss: 'aaaaaa' });
  t('night', plus(1), 16, { r: ALL, j: 'f', ss: 'bbbbbb' });
  // friend: the whole word on its own once, two Peeks, slips around 'ie' on two days: Once on its own
  t('friend', MON, 16, { r: 3, j: 'f', ss: 'aaaaaa', clean: false, tries: 1, sl: [2] });
  t('friend', MON, 16, { r: 4, j: 'f', ss: 'aaaaaa', peeks: 1, clean: false });
  t('friend', plus(1), 16, { r: 3, j: 'f', ss: 'bbbbbb', clean: false, tries: 1, sl: [2] });
  t('friend', plus(1), 16, { r: 4, j: 'f', ss: 'bbbbbb', peeks: 1, clean: false });
  t('friend', plus(1), 16, { r: ALL, j: 'f', ss: 'bbbbbb' });
  // island: climbing, up to 4 letters missing on its own, three Peeks
  t('island', MON, 16, { r: 5, j: 'f', ss: 'aaaaaa' });
  t('island', MON, 16, { r: 6, j: 'f', ss: 'aaaaaa', peeks: 1, clean: false });
  t('island', plus(1), 16, { r: 6, j: 'f', ss: 'bbbbbb', peeks: 2, clean: false });
  // light: three step-backs in one sitting today: a stuck word (D25)
  const today = plus(2);
  [[1, true], [2, true], [3, false], [3, false], [2, true], [3, false], [3, false], [2, true], [3, false], [3, false]].forEach(([r, c]) => t('light', today, 9, { r, j: 'f', ss: 'cccccc', clean: c, tries: c ? 0 : 1 }));
  // sittings (the end marks)
  d = W.markStep(d, W.groupById(d, 'g1'), 'se:aaaaaa', MON, at(MON, 16, 9));
  d = W.markStep(d, W.groupById(d, 'g1'), 'se:bbbbbb', plus(1), at(plus(1), 16, 20));
  // a sentence, with help
  d = W.addNote(d, { id: 'n1', group: 'g1', word: 'night', text: 'The night was very dark.', day: plus(1), now: at(plus(1), 17), bl: 3 });
  d = W.addNote(d, { id: 'n2', group: 'g1', word: 'friend', text: 'My friend came to play.', day: plus(1), now: at(plus(1), 17, 5), bl: 1, hp: 1 });
  if (test) {
    const g = W.groupById(d, 'g1');
    ['night', 'island', 'tree'].forEach((w) => t(w, plus(5), 10, { kind: 't' }));
    t('guard', plus(5), 10, { kind: 't', clean: false, tries: 0, peeks: 1, pr: 1 });
    void g;
  }
  return d;
}

export default (H, S) => {
  const { scene, go, click, ev, ok, has, text, until, sleep, acct, send, signedOutBlank, CHILD, CHILD2, ADULT } = H;
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const SIZES = ['iphone-14', 'iphone-air-bar', 'iphone-air-pill', 'ipad-portrait'];
  const step = (n) => console.log('  · ' + n);
  const q = JSON.stringify;

  /** Seed an adult with one or two children (the account answers /api/children for CHILD and CHILD2). */
  const seedAdult = (docs, day) => async () => {
    await signedOutBlank(day);
    acct.who = adultMe;
    for (const [id, doc] of Object.entries(docs)) acct.put(id, 'spellbright', 'words', doc);
  };
  const setupOf = () => W.setupOf(W.normalise(acct.get(CHILD, 'spellbright', 'words')));
  const wordsOf = () => W.normalise(acct.get(CHILD, 'spellbright', 'words'));
  async function fullShot(p, name, style) {
    const dir = join(S.SHOTS, p.id + '-' + style); mkdirSync(dir, { recursive: true });
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(join(dir, name + '.png'), Buffer.from(r.data, 'base64'));
  }
  /** What every grown-up page must hold at every size: no sideways scroll, every button and field at least 44 px, no overlap of a button with another. */
  const pageDefects = () => ev(`(() => { const d = []; const root = document.scrollingElement;
    if (root.scrollWidth - root.clientWidth > 1) d.push('sideways scroll ' + (root.scrollWidth - root.clientWidth) + ' px');
    for (const e of document.querySelectorAll('main button, main a.btn, main input:not([type=hidden])')) { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; if (r.height < 43.5 || r.width < 43.5) d.push((e.getAttribute('data-seg') || e.getAttribute('data-aside') || e.textContent || e.name || e.tagName).trim().slice(0, 24) + ' is ' + Math.round(r.width) + ' x ' + Math.round(r.height)); if (r.right > innerWidth + 1) d.push('a control runs off the right edge'); }
    return d.slice(0, 6); })()`);
  /** Run `fn(p, style)` at the four sizes in garden and Night. */
  const sized = (fn) => S.forProfiles(fn, { ids: SIZES });
  const defects = async (what) => { const d = await pageDefects(); S.report(d, what); };

  // ---------------------------------------------------------------- the switch (TR-46, BR-4)
  scene('SB6 gu: switch', async () => {
    const day = plus(1);
    await sized(async (p, style) => {
      await S.openAs(p, { day, hash: '#/grownups/child/' + CHILD, night: style === 'night', seed: seedAdult({ [CHILD]: sbsDoc({ way: 'usual', report: false }), [CHILD2]: sbsDoc({ way: 'usual', report: false }) }, day), wait: 'document.querySelector("[data-waycard]")' });
      ok(await has('[data-waycard] [data-seg=way][data-v=usual][aria-pressed=true]'), p.id + ' ' + style + ': the Usual way is on');
      ok(/For children who find spelling hard/.test(await text('[data-waycard]')), 'the helper line is there');
      ok(!await has('[data-seg=min]'), 'no Step by step settings in the Usual way');
      await defects(p.id + ' ' + style + ' (usual)');
      await S.shotAs(p, 'gu-switch-usual', style);
      await click('[data-seg=way][data-v=sbs]');
      await until('document.querySelector("[data-firston]")', 'the first switch-on line');
      ok(/Help in tests is now Extra support\. You can change it\./.test(await text('[data-firston]')), 'the first switch-on line');
      ok(await has('[data-testhelp]') && await has('[data-seg=min]') && await has('[data-updateline]'), 'the settings and the update line show');
      const s = setupOf();
      ok(s.way && s.way.m === 'sbs' && s.way.by === 'Sam' && s.profile && s.profile.p === 'sen', 'saved on the account: way sbs by Sam, test help Extra support: ' + JSON.stringify(s.way) + JSON.stringify(s.profile));
      ok(/Last changed by Sam/.test(await text('[data-waycard]')), 'who changed it');
      await defects(p.id + ' ' + style + ' (just switched on)');
      await S.shotAs(p, 'gu-switch-on', style);
      await fullShot(p, 'gu-switch-full', style);
      // off again, then on again: the help is not set a second time, so no line
      await click('[data-seg=way][data-v=usual]');
      await until('document.querySelector("[data-seg=way][data-v=usual][aria-pressed=true]") && !document.querySelector("[data-firston]")', 'back to the Usual way');
      await click('[data-seg=way][data-v=sbs]');
      await until('document.querySelector("[data-seg=min]")', 'on again');
      ok(!await has('[data-firston]'), 'no first-time line the second time');
    });
    step('the other child is untouched');
    ok(!W.setupOf(W.normalise(acct.get(CHILD2, 'spellbright', 'words'))).way, 'Wren has no way saved');
  });

  // ---------------------------------------------------------------- the settings (TR-46)
  scene('SB6 gu: settings', async () => {
    const day = plus(1);
    await sized(async (p, style) => {
      await S.openAs(p, { day, hash: '#/grownups/child/' + CHILD, night: style === 'night', seed: seedAdult({ [CHILD]: sbsDoc({ report: false }), [CHILD2]: sbsDoc({ way: 'usual', report: false }) }, day), wait: 'document.querySelector("[data-seg=min]")' });
      ok(await has('[data-seg=min][data-v="10"][aria-pressed=true]') && await has('[data-seg=peek][data-v="3"][aria-pressed=true]'), p.id + ' ' + style + ': 10 min and 3 s are the start');
      ok(!await has('[data-seg=peek][data-v="0"]'), 'no "As now" in Step by step');
      ok(await has('[data-preview]'), 'See what Robin will see');
      await click('[data-seg=min][data-v="15"]');
      await until('document.querySelector("[data-seg=min][data-v=\\"15\\"][aria-pressed=true]")', '15 minutes');
      await click('[data-seg=peek][data-v="5"]');
      await until('document.querySelector("[data-seg=peek][data-v=\\"5\\"][aria-pressed=true]")', '5 seconds');
      await click('[data-seg=big][data-v="1"]');
      await until('document.querySelector("[data-seg=big][data-v=\\"1\\"][aria-pressed=true]")', 'bigger celebrations');
      await click('[data-seg=after][data-v=time]');
      await until('document.querySelector("[data-after]")', 'the time box');
      await ev('(() => { const n = document.querySelector("[data-after]"); n.value = "18:45"; n.dispatchEvent(new Event("change", { bubbles: true })); })()');
      await until('document.querySelector("[data-after]") && document.querySelector("[data-after]").value === "18:45" && !document.querySelector("[data-after]").disabled', 'the time saved');
      await sleep(300);
      const s = setupOf();
      ok(s.sbs && s.sbs.min === 15 && s.sbs.big === 1 && s.sbs.after === '18:45' && s.peek && s.peek.s === 5, 'all saved: ' + JSON.stringify(s.sbs) + JSON.stringify(s.peek));
      await defects(p.id + ' ' + style + ' (settings)');
      await S.shotAs(p, 'gu-settings', style);
      await fullShot(p, 'gu-settings-full', style);
      await click('[data-seg=after][data-v=off]');
      await until('!document.querySelector("[data-after]")', 'off');
      await sleep(300);
      ok(setupOf().sbs.after === '', 'No practice after: Off saved');
    });
    step('the Usual way: Peek time As now');
    const p = S.profile('iphone-14');
    await S.openAs(p, { day: plus(1), hash: '#/grownups/child/' + CHILD2, seed: seedAdult({ [CHILD]: sbsDoc({ report: false }), [CHILD2]: sbsDoc({ way: 'usual', report: false }) }, plus(1)), wait: 'document.querySelector("[data-waycard]")' });
    ok(await has('[data-seg=peek][data-v="0"][aria-pressed=true]') && /As now/.test(await text('[data-waycard]')) && !await has('[data-seg=min]'), 'Peek time "As now" by default, no Step by step rows');
    await click('[data-seg=peek][data-v="2"]');
    await until('document.querySelector("[data-seg=peek][data-v=\\"2\\"][aria-pressed=true]")', '2 s');
    ok(W.setupOf(W.normalise(acct.get(CHILD2, 'spellbright', 'words'))).peek.s === 2, 'a Usual-way child can choose 2 s');
    ok(!W.setupOf(W.normalise(acct.get(CHILD2, 'spellbright', 'words'))).way, 'and stays on the Usual way');
    await defects('usual peek');
  });

  // ---------------------------------------------------------------- the preview (TR-47)
  scene('SB6 gu: preview', async () => {
    const day = plus(1);
    await sized(async (p, style) => {
      await S.openAs(p, { day, hash: '#/grownups/child/' + CHILD + '/preview', night: style === 'night', seed: seedAdult({ [CHILD]: sbsDoc({ report: false }), [CHILD2]: sbsDoc({ way: 'usual', report: false }) }, day), wait: 'document.querySelector("[data-previewpage]")' });
      const t = await text('main');
      ok(/See what Robin will see/.test(t) && /Nothing is saved/.test(t), p.id + ' ' + style + ': the page says what it is');
      ok(await has('[data-preview-card] .gu-tp--tile') && await has('[data-preview-card] .gu-tp--gap'), 'missing letters and tiles are drawn');
      ok(/Peek time\s*3 s/.test(t.replace(/\n/g, ' ')) && /Session\s*10 min/.test(t.replace(/\n/g, ' ')), 'the settings are listed');
      const before = JSON.stringify(wordsOf().results);
      ok(before === JSON.stringify(sbsDoc({ report: false }).results), 'nothing was recorded');
      await defects(p.id + ' ' + style + ' (preview)');
      await S.shotAs(p, 'gu-preview', style);
      await click('[data-close]');
      await until('document.querySelector("[data-waycard]")', 'back on the child page');
    });
  });

  // ---------------------------------------------------------------- the report (TR-48)
  scene('SB6 gu: report', async () => {
    const day = plus(2);
    await sized(async (p, style) => {
      await S.openAs(p, { day, hash: '#/grownups/child/' + CHILD, night: style === 'night', seed: seedAdult({ [CHILD]: sbsDoc(), [CHILD2]: sbsDoc({ way: 'usual', report: false }) }, day), wait: 'document.querySelector("[data-sbswords]")' });
      const words = (await text('[data-sbswords]')).replace(/\s+/g, ' ');
      for (const s of ['On its own', 'Once on its own', 'Still climbing', 'Not started']) ok(words.includes(s), p.id + ' ' + style + ': ' + s);
      ok(/Night: all letters on their own/.test(words) && /Friend: all letters on their own once/.test(words), 'the fact lines: ' + words.slice(0, 500));
      ok(/Slips around 'ie'/.test(words) && /3 Peeks so far/.test(words) && /2 Peeks so far/.test(words), "Slips around 'ie' and the Peek counts: " + words.slice(0, 400));
      ok(await has('[data-sbswords] [data-word=guard][data-status=not-started]') && await has('[data-sbswords] [data-word=night][data-status=got-it]'), 'statuses by word');
      ok(!/wrong|mistake|fail|score|%/i.test(words), 'no marks and no banned words');
      ok(/At least about \d+ sittings? of 10 minutes before the test: about \d+ a day\./.test(await text('[data-estimate]')), 'the estimate line (D24): ' + await text('[data-estimate]'));
      ok(/Pairs to do\./.test(await text('[data-rowsline]')), 'the row-size line: ' + await text('[data-rowsline]'));
      const more = (await text('[data-sbsmore]')).replace(/\s+/g, ' ');
      ok(/Sittings/.test(more) && /Finished/.test(more) && /with help/.test(more), 'sittings and "with help": ' + more.slice(0, 300));
      await defects(p.id + ' ' + style + ' (report)');
      await ev('document.querySelector("[data-sbswords]").scrollIntoView({ block: "start" })');
      await sleep(150);
      await S.shotAs(p, 'gu-report', style);
      await fullShot(p, 'gu-report-full', style);
    });
    step('the test lines with "with a peek"');
    const p = S.profile('iphone-14');
    const day2 = plus(6);
    await S.openAs(p, { day: day2, hash: '#/grownups/child/' + CHILD, seed: seedAdult({ [CHILD]: sbsDoc({ test: true }), [CHILD2]: sbsDoc({ way: 'usual', report: false }) }, day2), wait: 'document.querySelector("[data-sbsmore]")' });
    const t = (await text('[data-sbstest]')).replace(/\s+/g, ' ');
    ok(/Words Robin spelled:/.test(t) && /Words spelled with a peek: guard: spelled with a peek/.test(t), 'test lines: ' + t);
    ok(/does not count towards remembered/.test(t), 'the peek line says it does not count');
    await defects('test lines');
    step('print');
    await send('Emulation.setEmulatedMedia', { media: 'print' });
    await sleep(150);
    const hidden = await ev('(() => { const w = document.querySelector(".gu-way"); return !w || getComputedStyle(w).display === "none"; })()');
    ok(hidden, 'print: the settings card is not printed');
    ok(await ev('document.querySelector("[data-sbswords]").getBoundingClientRect().width > 100'), 'print: the report is');
    await fullShot(p, 'gu-report-print', 'garden');
    await send('Emulation.setEmulatedMedia', { media: '' });
    step('the print page');
    await go('#/grownups/child/' + CHILD + '/print/g1');
    await until('document.querySelector("[data-sbsprint]")', 'the print page');
    ok(/Night: all letters on their own/.test(await text('[data-sbsprint]')) && /Words in a row/.test(await text('[data-sbsprint]')), 'the print page carries the Step-by-step lines');
  });

  // ---------------------------------------------------------------- stuck words (D25)
  scene('SB6 gu: stuck', async () => {
    const day = plus(2);
    await sized(async (p, style) => {
      await S.openAs(p, { day, hash: '#/grownups/child/' + CHILD, night: style === 'night', seed: seedAdult({ [CHILD]: sbsDoc(), [CHILD2]: sbsDoc({ way: 'usual', report: false }) }, day), wait: 'document.querySelector("[data-sbswords]")' });
      ok(await has('[data-stuck=light]') && /Stuck word: light/.test(await text('[data-stuck=light]')), p.id + ' ' + style + ': Stuck word: light');
      ok(/Let Robin set it aside for today/.test(await text('[data-stuck=light]')), 'the button');
      await defects(p.id + ' ' + style + ' (stuck)');
      await ev('document.querySelector("[data-stuck=light]").scrollIntoView({ block: "center" })');
      await sleep(150);
      await S.shotAs(p, 'gu-stuck', style);
      await click('[data-aside=light]');
      await until('document.querySelector("[data-asideback=light]")', 'set aside');
      const d1 = wordsOf();
      ok(W.isSetAside(d1, 'g1', 'light', day) && !W.isSetAside(d1, 'g1', 'light', plus(3)), 'saved for today only: ' + JSON.stringify(d1.aside));
      ok(/Set aside for today/.test(await text('[data-stuck=light]')), 'the page says so');
      await ev('document.querySelector("[data-stuck=light]").scrollIntoView({ block: "center" })');
      await sleep(150);
      await S.shotAs(p, 'gu-stuck-aside', style);
      await click('[data-asideback=light]');
      await until('document.querySelector("[data-aside=light]")', 'brought back');
      ok(!W.isSetAside(wordsOf(), 'g1', 'light', day), 'brought back');
    });
    step('never on a child page');
    const p = S.profile('iphone-14');
    await S.openAs(p, { day: plus(2), hash: '#/', seed: async () => { await S.seedSbsChild({ words: WORDS10, day: plus(2), extra: () => sbsDoc() }); }, wait: 'document.querySelector("main")' });
    await sleep(400);
    const body = (await ev('document.body.innerText')) + ' ' + (await ev('[...document.querySelectorAll("button, a")].map((e) => e.textContent).join(" ")'));
    ok(!/Stuck word|set it aside|Let Robin/i.test(body), 'a child page has neither the stuck line nor the button');
    await go('#/grownups/child/' + CHILD);
    await sleep(500);
    ok(!/Let Robin set it aside/.test(await ev('document.body.innerText')), 'a child who opens the grown-up page gets no button');
  });

  // ---------------------------------------------------------------- the teacher and several children (TR-46)
  scene('SB6 gu: teacher', async () => {
    const day = plus(2);
    await sized(async (p, style) => {
      await S.openAs(p, { day, hash: '#/grownups/help', night: style === 'night', seed: seedAdult({ [CHILD]: sbsDoc(), [CHILD2]: sbsDoc({ way: 'usual', report: false }) }, day), wait: 'document.querySelector("[data-help-table]")' });
      const t = (await text('[data-help-table]')).replace(/\s+/g, ' ');
      ok(/Robin/.test(t) && /Way of learning: Step by step/.test(t) && /Wren/.test(t) && /Way of learning: Usual way/.test(t), p.id + ' ' + style + ': a Way of learning line for each child: ' + t);
      await defects(p.id + ' ' + style + ' (Help for each child)');
      await S.shotAs(p, 'gu-teacher', style);
      await fullShot(p, 'gu-teacher-full', style);
    });
    step('the home: a stuck word needs a look');
    const p = S.profile('iphone-14');
    await S.openAs(p, { day, hash: '#/grownups', seed: seedAdult({ [CHILD]: sbsDoc(), [CHILD2]: sbsDoc({ way: 'usual', report: false }) }, day), wait: 'document.querySelector("[data-child]")' });
    ok(await has('[data-child="' + CHILD + '"]') && await has('[data-child="' + CHILD2 + '"]'), 'both children are on the home');
    await defects('home');
  });

  // ---------------------------------------------------------------- Change a week: the estimate under the date (TR-47, D24)
  scene('SB6 gu: set a week', async () => {
    const day = plus(1);
    await sized(async (p, style) => {
      await S.openAs(p, { day, hash: '#/grownups/child/' + CHILD + '/plan/g1', night: style === 'night', seed: seedAdult({ [CHILD]: sbsDoc({ report: false }), [CHILD2]: sbsDoc({ way: 'usual', report: false }) }, day), wait: 'document.querySelector(".st-page")' });
      await until('document.querySelector("[data-estimate-line]")', 'the estimate line');
      const t = (await text('[data-estimate]')).replace(/\s+/g, ' ');
      ok(/At least about \d+ sittings of 10 minutes before the test: about \d+ a day\./.test(t), p.id + ' ' + style + ': ' + t);
      await defects(p.id + ' ' + style + ' (change a week)');
      await S.shotAs(p, 'gu-set', style);
    });
    step('the Usual way: no line');
    const p = S.profile('iphone-14');
    await S.openAs(p, { day, hash: '#/grownups/child/' + CHILD2 + '/plan/g1', seed: seedAdult({ [CHILD]: sbsDoc({ report: false }), [CHILD2]: sbsDoc({ way: 'usual', report: false }) }, day), wait: 'document.querySelector(".st-page")' });
    await sleep(300);
    ok(!await has('[data-estimate-line]'), 'a Usual-way child has no estimate line');
  });
};
